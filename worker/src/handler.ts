/**
 * Annum's Plaid proxy (docs/02 "The Worker"). It holds the Plaid keys, checks each phone's
 * access key, and forwards a short allowlist of read-only Plaid calls. It stores one number
 * (bank connections used on the Trial) and logs nothing: no console output anywhere in here.
 *
 * Pure: everything it touches arrives as arguments, so tests run it with a fake Plaid.
 */

/** The small part of Workers KV used here. */
export interface CountStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

/** Cloudflare's rate-limit binding (free plan). */
export interface RateLimit {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
  PLAID_CLIENT_ID?: string;
  /** Sandbox (fake banks, free and unlimited). */
  PLAID_SECRET_SANDBOX?: string;
  /** Real banks on the Trial. Until it's set, a real connection is impossible. */
  PLAID_SECRET_PRODUCTION?: string;
  /** The access key the phones scanned (`npm run worker:rotate-key`). */
  ANNUM_WORKER_KEY?: string;
  /**
   * Development builds and the Simulator (`npm run worker:rotate-dev-key`): Sandbox only, so the
   * key that can reach real banks never has to sit on the development Mac.
   */
  ANNUM_DEV_KEY?: string;
  COUNT: CountStore;
  PHONES_LIMIT?: RateLimit;
  REFUSED_LIMIT?: RateLimit;
}

export type PlaidEnv = 'sandbox' | 'production';
export type Fetch = (url: string, init: RequestInit) => Promise<Response>;

/** Plaid's Trial: 10 bank logins (Items) for life, shared by both phones. */
export const CONNECTION_LIMIT = 10;
export const COUNT_KEY = 'connections-used';
export const ORIGIN = 'https://annum.highdesert.workers.dev';
export const REDIRECT_URI = `${ORIGIN}/plaid/oauth`;
const APP_ID = 'YHZESG76UG.com.highdesert.annum';

const HOSTS: Record<PlaidEnv, string> = {
  sandbox: 'https://sandbox.plaid.com',
  production: 'https://production.plaid.com',
};

/**
 * Fixed for the life of each connection: Plaid can't change these after the bank is linked,
 * and a Trial connection can't be redone. Transactions with the most history (730 days, so
 * last year's taxes are there from day one); card statements when the bank has them.
 */
export const NEW_CONNECTION = {
  products: ['transactions'],
  optional_products: ['liabilities'],
  transactions: { days_requested: 730 },
} as const;

/** Sandbox bank for tests without Link: First Platypus Bank, a user with lively transactions. */
const SANDBOX_INSTITUTION = 'ins_109508';
const SANDBOX_USER = 'user_transactions_dynamic';

/**
 * Plaid calls a phone may make with one of its access tokens, and the body fields each may
 * carry. `sandboxOnly` calls are refused for real banks.
 */
const FORWARD: Record<string, { fields: string[]; sandboxOnly?: boolean }> = {
  'transactions/sync': { fields: ['cursor', 'count', 'options'] },
  'accounts/get': { fields: ['options'] },
  'accounts/balance/get': { fields: ['options'] },
  'liabilities/get': { fields: ['options'] },
  'item/get': { fields: [] },
  /** Only when the person chooses "Also end my bank connections at Plaid". */
  'item/remove': { fields: [] },
  /** Tests: makes a Sandbox connection ask to sign in again, to exercise Reconnect. */
  'sandbox/item/reset_login': { fields: [], sandboxOnly: true },
};

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

const refuse = (status: number, problem: string, extra: Record<string, unknown> = {}) =>
  json(status, { problem, ...extra });

/** Compare without leaking how much matched through timing. */
export function sameKey(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

/** Which Plaid environment a token belongs to, from its prefix (access-sandbox-…). */
export function envOfToken(token: unknown): PlaidEnv | null {
  if (typeof token !== 'string') return null;
  const m = /^(?:access|public|link)-(sandbox|production)-/.exec(token);
  return m ? (m[1] as PlaidEnv) : null;
}

/** Secrets as pasted into `wrangler secret put`, without stray spaces or line breaks. */
const clean = (value: string | undefined) => value?.trim() || undefined;

const secretFor = (env: Env, plaidEnv: PlaidEnv) =>
  clean(plaidEnv === 'sandbox' ? env.PLAID_SECRET_SANDBOX : env.PLAID_SECRET_PRODUCTION);

async function readCount(env: Env): Promise<number> {
  const n = Number.parseInt((await env.COUNT.get(COUNT_KEY)) ?? '0', 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function appSiteAssociation() {
  return {
    applinks: {
      details: [{ appIDs: [APP_ID], components: [{ '/': '/plaid/oauth*' }] }],
    },
  };
}

const OAUTH_PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Annum</title></head>
<body><p>Your bank is connected to Annum. Open Annum on this iPhone to finish.</p></body></html>`;

/** The development key asked for something real: answered like an old key ("scan the code"). */
class DevKeyRefused extends Error {}

export async function handle(request: Request, env: Env, fetchPlaid: Fetch): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === 'GET' && url.pathname === '/.well-known/apple-app-site-association') {
    return json(200, appSiteAssociation());
  }
  if (request.method === 'GET' && url.pathname === '/plaid/oauth') {
    return new Response(OAUTH_PAGE, {
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
    });
  }
  if (!url.pathname.startsWith('/v1/')) return refuse(404, 'not-found');
  if (request.method !== 'POST') return refuse(405, 'post-only');

  // The access key: without it anyone could create link tokens and use up connections.
  const workerKey = clean(env.ANNUM_WORKER_KEY);
  const clientId = clean(env.PLAID_CLIENT_ID);
  if (!workerKey || !clientId) return refuse(503, 'not-configured');
  const key = request.headers.get('x-annum-key') ?? '';
  const devKey = clean(env.ANNUM_DEV_KEY);
  const main = sameKey(key, workerKey);
  const dev = !main && !!devKey && sameKey(key, devKey);
  if (!main && !dev) {
    const { success } = (await env.REFUSED_LIMIT?.limit({ key: 'refused' })) ?? { success: true };
    return success ? refuse(401, 'key-refused') : refuse(429, 'slow-down');
  }
  // Keyed on a constant, not an address: the Worker keeps nothing about who calls it.
  const { success } = (await env.PHONES_LIMIT?.limit({ key: 'phones' })) ?? { success: true };
  if (!success) return refuse(429, 'slow-down');

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    body = parsed as Record<string, unknown>;
  } catch {
    return refuse(400, 'bad-request');
  }

  const plaid = async (plaidEnv: PlaidEnv, path: string, payload: Record<string, unknown>) => {
    // Every Plaid call comes through here, so this is where the development key stops.
    if (dev && plaidEnv !== 'sandbox') throw new DevKeyRefused();
    const secret = secretFor(env, plaidEnv);
    if (!secret) return { off: true as const };
    const res = await fetchPlaid(`${HOSTS[plaidEnv]}/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, secret, ...payload }),
    });
    return { off: false as const, res };
  };
  /** Plaid's answer, passed through as-is (its errors carry no tokens). */
  const relay = async (res: Response) => json(res.status, await res.json());
  const off = (plaidEnv: PlaidEnv) => refuse(503, 'environment-off', { env: plaidEnv });

  const route = url.pathname.slice('/v1/'.length);
  try {
    return await respond();
  } catch (e) {
    if (e instanceof DevKeyRefused) return refuse(401, 'key-refused');
    throw e;
  }

  async function respond(): Promise<Response> {
    if (route === 'status') {
      // A release build says it's after real banks: the development key isn't for it.
      if (dev && body.env === 'production') throw new DevKeyRefused();
      const used = await readCount(env);
      return json(200, {
        used,
        limit: CONNECTION_LIMIT,
        left: Math.max(0, CONNECTION_LIMIT - used),
        sandbox: !!env.PLAID_SECRET_SANDBOX,
        production: !!env.PLAID_SECRET_PRODUCTION,
      });
    }

    if (route === 'link-token') {
      const accessToken = body.access_token;
      const userId = body.client_user_id;
      if (typeof userId !== 'string' || !/^[A-Za-z0-9-]{8,64}$/.test(userId)) {
        return refuse(400, 'bad-request');
      }
      const common = {
        client_name: 'Annum',
        country_codes: ['US'],
        language: 'en',
        user: { client_user_id: userId },
        redirect_uri: REDIRECT_URI,
      };
      if (accessToken !== undefined) {
        // Update mode: repairs a connection in place. Always allowed, even with none left.
        const plaidEnv = envOfToken(accessToken);
        if (!plaidEnv) return refuse(400, 'bad-request');
        const r = await plaid(plaidEnv, 'link/token/create', {
          ...common,
          access_token: accessToken,
        });
        return r.off ? off(plaidEnv) : relay(r.res);
      }
      const plaidEnv = body.env;
      if (plaidEnv !== 'sandbox' && plaidEnv !== 'production') return refuse(400, 'bad-request');
      if (plaidEnv === 'production') {
        const used = await readCount(env);
        if (used >= CONNECTION_LIMIT) return refuse(409, 'limit-reached', { used });
      }
      const r = await plaid(plaidEnv, 'link/token/create', { ...common, ...NEW_CONNECTION });
      return r.off ? off(plaidEnv) : relay(r.res);
    }

    if (route === 'exchange') {
      // Never refused for the limit: by now the bank login exists at Plaid.
      const plaidEnv = envOfToken(body.public_token);
      if (!plaidEnv) return refuse(400, 'bad-request');
      const r = await plaid(plaidEnv, 'item/public_token/exchange', {
        public_token: body.public_token,
      });
      if (r.off) return off(plaidEnv);
      if (!r.res.ok) return relay(r.res);
      const out = (await r.res.json()) as { access_token: string; item_id: string };
      // The access token must reach the phone whatever happens to the count (it's a courtesy
      // number; Plaid's Dashboard is the real one): a KV hiccup here would lose the connection.
      // Then the answer carries no count, and the phone keeps the one it shows.
      let used: number | undefined;
      try {
        const before = await readCount(env);
        if (plaidEnv === 'production') await env.COUNT.put(COUNT_KEY, String(before + 1));
        used = plaidEnv === 'production' ? before + 1 : before;
      } catch {
        used = undefined;
      }
      return json(200, {
        access_token: out.access_token,
        item_id: out.item_id,
        ...(used === undefined ? {} : { used }),
      });
    }

    if (route === 'sandbox/connect') {
      // Tests: a Sandbox connection without the Link screens. Real banks never come this way.
      const r = await plaid('sandbox', 'sandbox/public_token/create', {
        institution_id: SANDBOX_INSTITUTION,
        initial_products: NEW_CONNECTION.products,
        options: {
          override_username: SANDBOX_USER,
          override_password: 'pass_good',
          transactions: NEW_CONNECTION.transactions,
        },
      });
      return r.off ? off('sandbox') : relay(r.res);
    }

    // Own keys only: `/v1/constructor` or `/v1/__proto__` must not find Object's built-ins.
    const forward = Object.hasOwn(FORWARD, route) ? FORWARD[route] : undefined;
    if (forward) {
      const plaidEnv = envOfToken(body.access_token);
      if (!plaidEnv) return refuse(400, 'bad-request');
      if (forward.sandboxOnly && plaidEnv !== 'sandbox') return refuse(403, 'sandbox-only');
      const payload: Record<string, unknown> = { access_token: body.access_token };
      for (const field of forward.fields) if (field in body) payload[field] = body[field];
      const r = await plaid(plaidEnv, route, payload);
      return r.off ? off(plaidEnv) : relay(r.res);
    }

    return refuse(404, 'not-found');
  }
}
