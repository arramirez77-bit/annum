import type { BankConnection } from '@/data/repo';

import {
  confirmMessage,
  connectedMessage,
  connectionRows,
  countLabel,
  DIDNT_CONNECT,
  finishLaterMessage,
  notFinishedMessage,
  notEndedNote,
  problemMessage,
  repairMessage,
  todayBankFootnote,
  todayBankNote,
} from '../bank-views';

const status = { used: 3, limit: 10, left: 7, sandbox: true, production: true };
const conn: BankConnection = {
  itemId: 'item-1',
  institution: 'Bank A',
  env: 'production',
  status: 'ok',
  accessToken: 'access-production-x',
  cursor: 'c',
  createdAt: '2026-09-20T09:00:00',
  lastSynced: '2026-09-27T07:02:00',
};
const now = new Date('2026-09-27T09:00:00');

describe('bank words', () => {
  it('names the cost before every new connection', () => {
    expect(confirmMessage(status, false).body).toBe(
      'This uses 1 of your 10 bank connections. 7 left for both phones. If it ever needs you to sign in again, Annum repairs it without using another.',
    );
    expect(confirmMessage({ ...status, left: 0, used: 10 }, false)).toMatchObject({
      title: 'All 10 bank connections are used',
      action: 'import',
    });
    expect(confirmMessage(status, true).body).toContain('doesn’t use any of your 10');
  });

  it('repairs say they use nothing', () => {
    expect(repairMessage('Bank A').body).toBe(
      'This repairs your connection in place. It doesn’t use a new one.',
    );
  });

  it('names the laptop command for this build (development: test banks only)', () => {
    expect(problemMessage('not-paired').body).toContain('“npm run worker:rotate-dev-key”');
  });

  it('a connection Plaid wouldn’t hand over may count: it says so and offers a file instead', () => {
    const m = notFinishedMessage('Bank A');
    expect(m.title).toBe('Bank A didn’t finish connecting');
    expect(m.body).toContain('It may still count as one of your 10');
    expect(m.body).not.toMatch(/no connection was used/);
    expect(m.action).toBe('import');
  });

  it('E4 says nothing was saved or used', () => {
    expect(DIDNT_CONNECT).toEqual({
      title: 'That bank didn’t connect',
      body: 'Nothing was saved and no connection was used.',
      action: 'retry',
    });
  });

  it('never uses alarming words', () => {
    const all = [
      confirmMessage(status, false),
      confirmMessage({ ...status, left: 0 }, false),
      repairMessage('Bank A'),
      DIDNT_CONNECT,
      finishLaterMessage('Bank A'),
      notFinishedMessage('Bank A'),
      connectedMessage('Bank A', 0),
      ...(
        [
          'not-paired',
          'key-refused',
          'offline',
          'limit-reached',
          'environment-off',
          'slow-down',
          'unavailable',
          'plaid',
          'unknown',
        ] as const
      ).map(problemMessage),
    ];
    for (const m of all) {
      expect(`${m.title} ${m.body}`).not.toMatch(/error|fail|warning|invalid/i);
    }
    expect(notEndedNote(2)).not.toMatch(/error|fail|warning|invalid/i);
  });

  it('says nothing was deleted when Plaid didn’t end every connection', () => {
    expect(notEndedNote(1)).toBe(
      'Plaid didn’t end one of your bank connections, so nothing was deleted. Try again in a moment, or turn off “Also end my bank connections at Plaid” to delete anyway.',
    );
    expect(notEndedNote(2)).toMatch(/^Plaid didn’t end 2 of your bank connections/);
  });

  it('counts and lists connections', () => {
    expect(countLabel(status)).toBe('7 of 10 left');
    expect(countLabel(null)).toBe('Not checked yet');
    expect(connectedMessage('Bank A', 1234).body).toBe('Annum brought in 1,234 transactions.');
    expect(
      connectionRows(
        [
          conn,
          { ...conn, itemId: 'i2', status: 'needs-reauth' },
          { ...conn, itemId: 'i3', lastSynced: '2026-09-20T07:00:00', env: 'sandbox' },
        ],
        now,
      ),
    ).toEqual([
      { id: 'item-1', title: 'Bank A', subtitle: 'Updated 7:02 AM', reconnect: false },
      { id: 'i2', title: 'Bank A', subtitle: 'Needs you to sign in again', reconnect: true },
      { id: 'i3', title: 'Bank A (test)', subtitle: 'Updated Sep 20', reconnect: false },
    ]);
  });

  it('puts a replaced key or a bank that needs signing in on Today', () => {
    expect(todayBankNote('paired', [conn])).toBeUndefined();
    expect(todayBankNote('key-refused', [conn])).toContain('Scan the new code');
    expect(todayBankNote('key-refused', [])).toBeUndefined();
    expect(todayBankNote('paired', [{ ...conn, status: 'needs-reauth' }])).toBe(
      'Bank A needs you to sign in again. Reconnect it in Settings; it won’t use a new connection.',
    );
    expect(todayBankFootnote(true, false, [conn])).toBe('Updating…');
    expect(todayBankFootnote(false, true, [conn])).toBe('Offline — showing what’s on this phone.');
    expect(todayBankFootnote(false, true, [])).toBeUndefined();
  });
});
