/**
 * @jest-environment node
 */
// The Worker (worker/src/handler.ts) against a fake Plaid: the key check, the allowlist, the
// connection count, and that nothing is ever logged.
import {
  CONNECTION_LIMIT,
  COUNT_KEY,
  envOfToken,
  handle,
  REDIRECT_URI,
  sameKey,
  type Env,
} from '../worker/src/handler';

const KEY = 'k'.repeat(43);
const USER = 'phone-1234abcd';

interface Call {
  url: string;
  body: Record<string, unknown>;
}

function setup(over: Partial<Env> = {}, used = 0, plaidStatus = 200) {
  const kv = new Map<string, string>([[COUNT_KEY, String(used)]]);
  const calls: Call[] = [];
  const limits = { phones: true, refused: true };
  const env: Env = {
    PLAID_CLIENT_ID: 'client-id',
    PLAID_SECRET_SANDBOX: 'sandbox-secret',
    ANNUM_WORKER_KEY: KEY,
    COUNT: {
      get: async (k) => kv.get(k) ?? null,
      put: async (k, v) => void kv.set(k, v),
    },
    PHONES_LIMIT: { limit: async () => ({ success: limits.phones }) },
    REFUSED_LIMIT: { limit: async () => ({ success: limits.refused }) },
    ...over,
  };
  const fetchPlaid = async (url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    calls.push({ url, body });
    const answer = url.endsWith('/item/public_token/exchange')
      ? { access_token: 'access-production-abc', item_id: 'item-1' }
      : { ok: true, request_id: 'r1' };
    return new Response(
      JSON.stringify(plaidStatus === 200 ? answer : { error_code: 'INVALID_PUBLIC_TOKEN' }),
      { status: plaidStatus },
    );
  };
  const post = (path: string, body: unknown, key = KEY) =>
    handle(
      new Request(`https://annum.example/v1/${path}`, {
        method: 'POST',
        headers: { 'x-annum-key': key, 'content-type': 'application/json' },
        body: typeof body === 'string' ? body : JSON.stringify(body),
      }),
      env,
      fetchPlaid,
    );
  const get = (path: string) =>
    handle(new Request(`https://annum.example${path}`), env, fetchPlaid);
  return { env, kv, calls, limits, post, get };
}

const consoleSpies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
  jest.spyOn(console, m),
);
afterEach(() => {
  // The Worker must never log (tokens, balances, or anything else).
  for (const spy of consoleSpies) expect(spy).not.toHaveBeenCalled();
});

describe('public pages', () => {
  it('serves the app-site association for OAuth banks', async () => {
    const res = await setup().get('/.well-known/apple-app-site-association');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/json');
    expect(await res.json()).toEqual({
      applinks: {
        details: [
          {
            appIDs: ['YHZESG76UG.com.highdesert.annum'],
            components: [{ '/': '/plaid/oauth*' }],
          },
        ],
      },
    });
  });

  it('serves a plain page at the OAuth redirect', async () => {
    const res = await setup().get('/plaid/oauth?oauth_state_id=x');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('Open Annum');
  });

  it('refuses anything else', async () => {
    const s = setup();
    expect((await s.get('/')).status).toBe(404);
    expect((await s.get('/v1/status')).status).toBe(405);
  });
});

describe('access key', () => {
  it('refuses a wrong or missing key without calling Plaid', async () => {
    const s = setup();
    const res = await s.post('status', {}, 'old-key');
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ problem: 'key-refused' });
    expect((await s.post('link-token', { env: 'sandbox' }, '')).status).toBe(401);
    expect(s.calls).toHaveLength(0);
  });

  it('slows down repeated wrong keys, and busy phones', async () => {
    const s = setup();
    s.limits.refused = false;
    expect((await s.post('status', {}, 'nope')).status).toBe(429);
    s.limits.phones = false;
    expect((await s.post('status', {})).status).toBe(429);
  });

  it('is closed until its secrets are set', async () => {
    const s = setup({ ANNUM_WORKER_KEY: undefined });
    expect(await (await s.post('status', {})).json()).toEqual({ problem: 'not-configured' });
  });

  it('compares keys fully', () => {
    expect(sameKey(KEY, KEY)).toBe(true);
    expect(sameKey(KEY, KEY.slice(1))).toBe(false);
    expect(sameKey(KEY, `${KEY}x`)).toBe(false);
    expect(sameKey('', KEY)).toBe(false);
  });
});

describe('status', () => {
  it('reports the shared count and which environments are on', async () => {
    const res = await setup({}, 3).post('status', {});
    expect(await res.json()).toEqual({
      used: 3,
      limit: CONNECTION_LIMIT,
      left: 7,
      sandbox: true,
      production: false,
    });
  });
});

describe('link token', () => {
  it('asks Plaid for a new connection with the fixed settings', async () => {
    const s = setup();
    const res = await s.post('link-token', { env: 'sandbox', client_user_id: USER });
    expect(res.status).toBe(200);
    expect(s.calls).toHaveLength(1);
    expect(s.calls[0].url).toBe('https://sandbox.plaid.com/link/token/create');
    expect(s.calls[0].body).toEqual({
      client_id: 'client-id',
      secret: 'sandbox-secret',
      client_name: 'Annum',
      country_codes: ['US'],
      language: 'en',
      user: { client_user_id: USER },
      redirect_uri: REDIRECT_URI,
      products: ['transactions'],
      optional_products: ['liabilities'],
      transactions: { days_requested: 730 },
    });
  });

  it('makes real-bank connections impossible until the production secret is set', async () => {
    const s = setup();
    const res = await s.post('link-token', { env: 'production', client_user_id: USER });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ problem: 'environment-off', env: 'production' });
    expect(s.calls).toHaveLength(0);
  });

  it('refuses a new real connection at 10', async () => {
    const s = setup({ PLAID_SECRET_PRODUCTION: 'prod' }, 10);
    const res = await s.post('link-token', { env: 'production', client_user_id: USER });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ problem: 'limit-reached', used: 10 });
    expect(s.calls).toHaveLength(0);
  });

  it('allows new Sandbox connections at 10 (they are free)', async () => {
    const s = setup({}, 10);
    expect((await s.post('link-token', { env: 'sandbox', client_user_id: USER })).status).toBe(200);
  });

  it('always allows a repair (update mode), with no products', async () => {
    const s = setup({ PLAID_SECRET_PRODUCTION: 'prod' }, 10);
    const res = await s.post('link-token', {
      access_token: 'access-production-abc',
      client_user_id: USER,
    });
    expect(res.status).toBe(200);
    expect(s.calls[0].url).toBe('https://production.plaid.com/link/token/create');
    expect(s.calls[0].body.access_token).toBe('access-production-abc');
    expect(s.calls[0].body).not.toHaveProperty('products');
    expect(s.calls[0].body).not.toHaveProperty('optional_products');
  });

  it('refuses bad requests', async () => {
    const s = setup();
    expect((await s.post('link-token', { env: 'sandbox' })).status).toBe(400);
    expect((await s.post('link-token', { env: 'sandbox', client_user_id: 'a b' })).status).toBe(
      400,
    );
    expect((await s.post('link-token', { env: 'test', client_user_id: USER })).status).toBe(400);
    expect((await s.post('link-token', 'not json')).status).toBe(400);
    expect((await s.post('link-token', '[1]')).status).toBe(400);
    expect(s.calls).toHaveLength(0);
  });
});

describe('exchange', () => {
  it('counts a real connection', async () => {
    const s = setup({ PLAID_SECRET_PRODUCTION: 'prod' }, 3);
    const res = await s.post('exchange', { public_token: 'public-production-xyz' });
    expect(await res.json()).toEqual({
      access_token: 'access-production-abc',
      item_id: 'item-1',
      used: 4,
    });
    expect(s.kv.get(COUNT_KEY)).toBe('4');
    expect(s.calls[0].url).toBe('https://production.plaid.com/item/public_token/exchange');
  });

  it('exchanges even at 10: the bank login already exists', async () => {
    const s = setup({ PLAID_SECRET_PRODUCTION: 'prod' }, 10);
    expect((await s.post('exchange', { public_token: 'public-production-xyz' })).status).toBe(200);
    expect(s.kv.get(COUNT_KEY)).toBe('11');
  });

  it('does not count Sandbox', async () => {
    const s = setup({}, 3);
    await s.post('exchange', { public_token: 'public-sandbox-xyz' });
    expect(s.kv.get(COUNT_KEY)).toBe('3');
  });

  it('passes Plaid problems through and counts nothing', async () => {
    const s = setup({ PLAID_SECRET_PRODUCTION: 'prod' }, 3, 400);
    const res = await s.post('exchange', { public_token: 'public-production-xyz' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error_code: 'INVALID_PUBLIC_TOKEN' });
    expect(s.kv.get(COUNT_KEY)).toBe('3');
  });
});

describe('forwarded calls', () => {
  it('forwards only the allowed fields, to the token’s environment', async () => {
    const s = setup();
    await s.post('transactions/sync', {
      access_token: 'access-sandbox-1',
      cursor: 'c1',
      count: 500,
      secret: 'attacker',
      client_id: 'attacker',
      webhook: 'https://evil.example',
    });
    expect(s.calls[0]).toEqual({
      url: 'https://sandbox.plaid.com/transactions/sync',
      body: {
        client_id: 'client-id',
        secret: 'sandbox-secret',
        access_token: 'access-sandbox-1',
        cursor: 'c1',
        count: 500,
      },
    });
  });

  it('refuses calls outside the allowlist', async () => {
    const s = setup();
    for (const path of ['transfer/create', 'item/webhook/update', 'processor/token/create']) {
      expect((await s.post(path, { access_token: 'access-sandbox-1' })).status).toBe(404);
    }
    expect((await s.post('accounts/get', { access_token: 'nope' })).status).toBe(400);
    expect(s.calls).toHaveLength(0);
  });

  it('keeps test-only calls to Sandbox', async () => {
    const s = setup({ PLAID_SECRET_PRODUCTION: 'prod' });
    const res = await s.post('sandbox/item/reset_login', { access_token: 'access-production-1' });
    expect(res.status).toBe(403);
    await s.post('sandbox/item/reset_login', { access_token: 'access-sandbox-1' });
    expect(s.calls[0].url).toBe('https://sandbox.plaid.com/sandbox/item/reset_login');
  });

  it('makes Sandbox test connections without Link', async () => {
    const s = setup();
    await s.post('sandbox/connect', {});
    expect(s.calls[0].url).toBe('https://sandbox.plaid.com/sandbox/public_token/create');
    expect(s.calls[0].body.initial_products).toEqual(['transactions']);
  });
});

it('reads the environment from a token', () => {
  expect(envOfToken('access-sandbox-123')).toBe('sandbox');
  expect(envOfToken('public-production-123')).toBe('production');
  expect(envOfToken('access-development-123')).toBeNull();
  expect(envOfToken(42)).toBeNull();
});
