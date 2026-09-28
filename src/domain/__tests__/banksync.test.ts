import { mergeBankAccounts, mergeBankChanges, type BankTransaction } from '../banksync';
import type { Account, Transaction } from '../types';

const checking: Account = {
  id: 'acct-1',
  name: 'Bank A checking',
  type: 'checking',
  balance: 100000,
  source: 'plaid',
  plaidAccountId: 'pa-1',
  itemId: 'item-1',
  status: 'ok',
};

let n = 0;
const newId = () => `t${++n}`;
beforeEach(() => {
  n = 0;
});

const bank = (over: Partial<BankTransaction> = {}): BankTransaction => ({
  externalId: 'x1',
  accountExternalId: 'pa-1',
  date: '2026-09-20',
  merchant: 'CORNER MARKET',
  amount: -4250,
  pending: false,
  ...over,
});

const none = { added: [], modified: [], removed: [] };

describe('mergeBankChanges', () => {
  it('adds new transactions with a suggestion, title-cased, unreviewed', () => {
    const r = mergeBankChanges([], { ...none, added: [bank()] }, [checking], [], newId);
    expect(r.transactions).toEqual([
      {
        id: 't1',
        accountId: 'acct-1',
        date: '2026-09-20',
        merchant: 'Corner Market',
        amount: -4250,
        externalId: 'x1',
        tax: false,
        reviewed: false,
        suggestedCategory: 'Groceries',
      },
    ]);
    expect(r.added).toHaveLength(1);
    expect(r.range).toEqual({ from: '2026-09-20', to: '2026-09-20' });
  });

  it("uses the bank's category when it fits, but a rule wins", () => {
    const hinted = bank({ merchant: 'Blue Door', categoryHint: 'Dining' });
    const r1 = mergeBankChanges([], { ...none, added: [hinted] }, [checking], [], newId);
    expect(r1.transactions[0].suggestedCategory).toBe('Dining');
    const rule = { merchant: 'blue door', category: 'Software', tax: true, taxCategory: 'Meals' };
    const r2 = mergeBankChanges([], { ...none, added: [hinted] }, [checking], [rule], newId);
    expect(r2.transactions[0]).toMatchObject({
      suggestedCategory: 'Software',
      tax: true,
      taxCategory: 'Meals',
    });
  });

  it('never suggests a spending category for money in', () => {
    const refund = bank({ merchant: 'Blue Door', amount: 1200, categoryHint: 'Dining' });
    const r = mergeBankChanges([], { ...none, added: [refund] }, [checking], [], newId);
    expect(r.transactions[0].suggestedCategory).toBeUndefined();
  });

  it('marks history before the review week as reviewed', () => {
    const r = mergeBankChanges(
      [],
      { ...none, added: [bank({ date: '2025-01-02' }), bank({ externalId: 'x2' })] },
      [checking],
      [],
      newId,
      { reviewedBefore: '2026-09-14' },
    );
    expect(r.transactions.map((t) => t.reviewed)).toEqual([true, false]);
  });

  it('keeps pending charges out of income matching and marks them', () => {
    const r = mergeBankChanges(
      [],
      { ...none, added: [bank({ pending: true })] },
      [checking],
      [],
      newId,
    );
    expect(r.transactions[0].pending).toBe(true);
    expect(r.added).toHaveLength(0);
  });

  it("replaces a pending charge with its posted one, keeping the person's choices", () => {
    const pending: Transaction = {
      id: 't9',
      accountId: 'acct-1',
      date: '2026-09-20',
      merchant: 'Corner Market',
      amount: -4000,
      externalId: 'p1',
      pending: true,
      category: 'Groceries',
      tax: true,
      taxCategory: 'Meals',
      reviewed: true,
    };
    const r = mergeBankChanges(
      [pending],
      {
        added: [bank({ externalId: 'x1', replaces: 'p1', date: '2026-09-21', amount: -4250 })],
        modified: [],
        removed: ['p1'],
      },
      [checking],
      [],
      newId,
    );
    expect(r.transactions).toEqual([
      {
        id: 't9',
        accountId: 'acct-1',
        date: '2026-09-21',
        merchant: 'Corner Market',
        amount: -4250,
        externalId: 'x1',
        category: 'Groceries',
        tax: true,
        taxCategory: 'Meals',
        reviewed: true,
      },
    ]);
    expect(r.removed).toBe(0);
    expect(r.added.map((t) => t.id)).toEqual(['t9']);
  });

  it('updates a changed transaction in place and never duplicates', () => {
    const first = mergeBankChanges([], { ...none, added: [bank()] }, [checking], [], newId);
    const again = mergeBankChanges(
      first.transactions,
      { added: [bank()], modified: [bank({ amount: -4300 })], removed: [] },
      [checking],
      [],
      newId,
    );
    expect(again.transactions).toHaveLength(1);
    expect(again.transactions[0].amount).toBe(-4300);
    expect(again.added).toHaveLength(0);
  });

  it('drops what the bank removed', () => {
    const first = mergeBankChanges(
      [],
      { ...none, added: [bank(), bank({ externalId: 'x2' })] },
      [checking],
      [],
      newId,
    );
    const r = mergeBankChanges(
      first.transactions,
      { ...none, removed: ['x1', 'unknown'] },
      [checking],
      [],
      newId,
    );
    expect(r.transactions.map((t) => t.externalId)).toEqual(['x2']);
    expect(r.removed).toBe(1);
  });

  it('ignores accounts Annum does not track, and leaves other transactions alone', () => {
    const other: Transaction = {
      id: 'o1',
      accountId: 'acct-imported',
      date: '2026-09-20',
      merchant: 'Corner Market',
      amount: -4250,
      tax: false,
      reviewed: false,
    };
    const r = mergeBankChanges(
      [other],
      { ...none, added: [bank({ accountExternalId: 'pa-unknown' })] },
      [checking],
      [],
      newId,
    );
    expect(r.transactions).toEqual([other]);
  });

  it('skips what files already brought in for an account that was imported before', () => {
    const wasImported = { ...checking, importedThrough: '2026-09-18' };
    const r = mergeBankChanges(
      [],
      {
        ...none,
        added: [bank({ date: '2026-09-18' }), bank({ externalId: 'x2', date: '2026-09-19' })],
      },
      [wasImported],
      [],
      newId,
    );
    expect(r.transactions.map((t) => t.externalId)).toEqual(['x2']);
    expect(r.duplicates).toBe(1);
  });
});

describe('mergeBankAccounts', () => {
  const incoming = {
    name: 'Total Checking',
    type: 'checking' as const,
    balance: 250000,
    last4: '0000',
    lastSynced: '2026-09-27T07:02:00',
    source: 'plaid' as const,
    plaidAccountId: 'pa-1',
    itemId: 'item-1',
    status: 'ok' as const,
  };

  it('adds a new bank account', () => {
    expect(mergeBankAccounts([], [incoming], [], () => 'a1')).toEqual([{ ...incoming, id: 'a1' }]);
  });

  it('updates the same bank account in place', () => {
    const first = mergeBankAccounts([], [incoming], [], () => 'a1');
    const next = mergeBankAccounts(first, [{ ...incoming, balance: 1 }], [], () => 'a2');
    expect(next).toEqual([{ ...incoming, id: 'a1', balance: 1 }]);
  });

  it('turns an imported account with the same last 4 into the connected one', () => {
    const imported: Account = {
      id: 'acct-file',
      name: 'Woodgrove checking',
      type: 'checking',
      balance: 100,
      last4: '0000',
      source: 'import',
      status: 'ok',
    };
    const txns: Transaction[] = ['2026-09-10', '2026-09-18', '2026-09-12'].map((date, i) => ({
      id: `f${i}`,
      accountId: 'acct-file',
      date,
      merchant: 'Cafe',
      amount: -100,
      tax: false,
      reviewed: true,
    }));
    const [merged] = mergeBankAccounts([imported], [incoming], txns, () => 'new');
    expect(merged).toMatchObject({
      id: 'acct-file',
      name: 'Woodgrove checking',
      source: 'plaid',
      plaidAccountId: 'pa-1',
      balance: 250000,
      importedThrough: '2026-09-18',
    });
  });

  it('never joins accounts of a different kind or without digits to compare', () => {
    const savings: Account = {
      id: 's',
      name: 'Savings',
      type: 'savings',
      balance: 1,
      last4: '0000',
      source: 'import',
      status: 'ok',
    };
    const noDigits = { ...incoming, last4: undefined };
    expect(mergeBankAccounts([savings], [incoming], [], () => 'n')).toHaveLength(2);
    expect(
      mergeBankAccounts([{ ...savings, type: 'checking' }], [noDigits], [], () => 'n'),
    ).toHaveLength(2);
  });
});
