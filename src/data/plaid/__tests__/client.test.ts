import { workerClient, WorkerError } from '../client';

type Reply = { status: number; body: unknown } | 'network-down';

function fakeWorker(replies: Reply[], key: string | null = 'phone-key') {
  const calls: { url: string; headers: Record<string, string>; body: Record<string, unknown> }[] =
    [];
  const client = workerClient({
    baseUrl: 'https://worker.example',
    getKey: async () => key,
    fetch: async (url, init) => {
      calls.push({
        url,
        headers: init.headers as Record<string, string>,
        body: JSON.parse(String(init.body)) as Record<string, unknown>,
      });
      const reply = replies.shift();
      if (!reply || reply === 'network-down') throw new TypeError('Network request failed');
      return new Response(JSON.stringify(reply.body), { status: reply.status });
    },
  });
  return { client, calls };
}

const page = (over: Record<string, unknown>) => ({
  status: 200,
  body: { added: [], modified: [], removed: [], next_cursor: 'c', has_more: false, ...over },
});

const txn = (id: string) => ({
  transaction_id: id,
  account_id: 'pa-1',
  amount: 5,
  date: '2026-09-20',
  name: 'Cafe',
  pending: false,
});

const problem = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return e instanceof WorkerError ? e.problem : 'other';
  }
  return 'none';
};

describe('Worker client', () => {
  it('says which environment it is with the status check (for the development key)', async () => {
    const bodies: unknown[] = [];
    const client = workerClient({
      baseUrl: 'https://worker.example',
      getKey: async () => 'phone-key',
      env: 'production',
      fetch: async (_url, init) => {
        bodies.push(JSON.parse(String(init.body)));
        const status = { used: 0, limit: 10, left: 10, sandbox: true, production: true };
        return new Response(JSON.stringify(status), { status: 200 });
      },
    });
    await client.status();
    await client.statusWith('scanned-key');
    expect(bodies).toEqual([{ env: 'production' }, { env: 'production' }]);
  });

  it('sends the access key in a header and tokens only in the body', async () => {
    const { client, calls } = fakeWorker([{ status: 200, body: { accounts: [] } }]);
    await client.accounts('access-sandbox-1');
    expect(calls[0].url).toBe('https://worker.example/v1/accounts/get');
    expect(calls[0].headers['x-annum-key']).toBe('phone-key');
    expect(calls[0].body).toEqual({ access_token: 'access-sandbox-1' });
    expect(calls[0].url).not.toContain('access-');
  });

  it('asks for live balances on pull-to-refresh', async () => {
    const { client, calls } = fakeWorker([{ status: 200, body: { accounts: [] } }]);
    await client.accounts('access-sandbox-1', true);
    expect(calls[0].url).toBe('https://worker.example/v1/accounts/balance/get');
  });

  it("doesn't call anyone before the phone is paired", async () => {
    const { client, calls } = fakeWorker([], null);
    expect(await problem(client.status())).toBe('not-paired');
    expect(calls).toHaveLength(0);
  });

  it('names each problem', async () => {
    const cases: [Reply, string][] = [
      ['network-down', 'offline'],
      [{ status: 401, body: { problem: 'key-refused' } }, 'key-refused'],
      [{ status: 409, body: { problem: 'limit-reached', used: 10 } }, 'limit-reached'],
      [{ status: 503, body: { problem: 'environment-off' } }, 'environment-off'],
      [{ status: 429, body: { problem: 'slow-down' } }, 'slow-down'],
      [{ status: 503, body: { problem: 'not-configured' } }, 'unavailable'],
      [
        { status: 400, body: { error_type: 'ITEM_ERROR', error_code: 'ITEM_LOGIN_REQUIRED' } },
        'plaid',
      ],
    ];
    for (const [reply, expected] of cases) {
      const { client } = fakeWorker([reply]);
      expect(await problem(client.status())).toBe(expected);
    }
  });

  it('pages through a sync and returns the last cursor', async () => {
    const { client, calls } = fakeWorker([
      page({ added: [txn('a')], next_cursor: 'c1', has_more: true }),
      page({ added: [txn('b')], removed: [{ transaction_id: 'z' }], next_cursor: 'c2' }),
    ]);
    const r = await client.sync('access-sandbox-1', null);
    expect(r.added.map((t) => t.externalId)).toEqual(['a', 'b']);
    expect(r.added[0].amount).toBe(-500);
    expect(r.removed).toEqual(['z']);
    expect(r.cursor).toBe('c2');
    expect(calls[0].body).not.toHaveProperty('cursor');
    expect(calls[1].body.cursor).toBe('c1');
  });

  it('starts again from the same cursor if the data changed mid-sync', async () => {
    const { client, calls } = fakeWorker([
      page({ added: [txn('a')], next_cursor: 'c1', has_more: true }),
      {
        status: 400,
        body: {
          error_type: 'TRANSACTIONS_ERROR',
          error_code: 'TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION',
        },
      },
      page({ added: [txn('a'), txn('b')], next_cursor: 'c9' }),
    ]);
    const r = await client.sync('access-sandbox-1', 'c0');
    expect(r.added.map((t) => t.externalId)).toEqual(['a', 'b']);
    expect(calls.map((c) => c.body.cursor)).toEqual(['c0', 'c1', 'c0']);
  });

  it('treats a bank without card statements as having none', async () => {
    const { client } = fakeWorker([
      { status: 400, body: { error_type: 'ITEM_ERROR', error_code: 'PRODUCTS_NOT_SUPPORTED' } },
    ]);
    expect(await client.liabilities('access-sandbox-1')).toEqual([]);
  });
});
