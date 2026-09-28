import { readFileSync } from 'fs';

import { demoSeed } from '@/data/demo';
import { DEFAULT_PREFS } from '@/data/repo';
import {
  bucketsMatchSavings,
  fileTransactions,
  proposeSplit,
  readBankFile,
  savingsBalance,
} from '@/domain';

import { buildBillsView } from '../bills-views';
import { buildImportPreview, buildImportResult, lastImportRow } from '../import-views';
import { useOnboarding } from '../onboarding';
import { useAppStore } from '../store';
import { buildTodayView, updatedLabel } from '../views';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light' },
}));

const s = () => useAppStore.getState();
const fixture = (name: string) => readFileSync(`fixtures/bank-files/${name}`, 'utf8');
const seed = demoSeed();

/** Real mode on the seed data (imports recompute derived values like real use). */
function realSeed() {
  s().hydrate(
    {
      data: seed,
      prefs: DEFAULT_PREFS,
      deposits: seed.pendingDeposit ? [seed.pendingDeposit] : [],
      splits: [],
      reviews: [],
      rules: [],
      deferred: [],
      connections: [],
      reviewStep: 1,
      pendingTransfer: null,
      startedOn: '2026-09-01',
    },
    false,
  );
}

beforeEach(realSeed);

describe('importing into Annum', () => {
  test('a CSV into checking: new transactions, a remembered mapping, the last-import row', () => {
    const file = readBankFile(fixture('woodgrove-checking.csv'), {});
    if (file.kind !== 'csv' || !file.mapping) throw new Error('expected a mapped CSV');
    const incoming = fileTransactions(file, file.mapping);
    const account = { ...seed.accounts[0], source: 'manual' as const, balance: 430500 };
    const preview = buildImportPreview(s().data, incoming, account.id);
    expect(preview.sentence).toBe(
      '7 transactions from Jul 25 – Sep 25. 1 is already in Annum and will be skipped.',
    );
    expect(preview.primary).toBe('Import 6 transactions');

    s().rememberMapping(file.key, file.mapping);
    const outcome = s().importStatement({ account, transactions: incoming });
    expect(outcome).toMatchObject({ added: 6, duplicates: 1, received: [], proposals: 1 });
    const chk = s().data.accounts.find((a) => a.id === 'chk')!;
    expect(chk).toMatchObject({ balance: 430500, source: 'import' });
    expect(s().prefs.importMappings[file.key]).toEqual(file.mapping);
    expect(lastImportRow(s().prefs.lastImport)).toEqual({
      title: 'Woodgrove checking · Jul 25 – Sep 25',
      subtitle: 'Imported Sep 23 · 6 new · 1 already here',
    });
    const onlyImported = { ...s().data, accounts: s().data.accounts.filter((a) => a.id === 'chk') };
    expect(updatedLabel(onlyImported, new Date())).toMatch(/^Imported /);
    // The same file again adds nothing.
    expect(s().importStatement({ account: chk, transactions: incoming })).toMatchObject({
      added: 0,
      duplicates: 7,
    });
  });

  test('the expected invoice landing in savings: marked received, a deposit to split, no double count', () => {
    const savings = seed.accounts.find((a) => a.type === 'savings')!;
    const before = savingsBalance(s().data);
    const outcome = s().importStatement({
      account: { ...savings, balance: before + 500000 },
      transactions: [
        { date: '2026-10-13', merchant: 'NORTHWIND STUDIO', amount: 500000, externalId: 'S-9' },
      ],
    });
    expect(outcome.received).toEqual([{ source: 'Northwind Studio', amount: 500000 }]);
    const r = buildImportResult(outcome, savings);
    expect(r.lines).toContain(
      'Northwind Studio’s $5,000 arrived, so Annum stopped waiting for it.',
    );
    // The seed's $10,000 is still waiting to be split, so it comes first; the $5,000 queues.
    const waiting = seed.pendingDeposit!;
    expect(outcome.depositId).toBe(waiting.id);
    expect(r.splitDepositId).toBe(waiting.id);
    expect(s().deposits.map((d) => [d.amount, d.confirmed])).toEqual([
      [1000000, false],
      [500000, false],
    ]);
    // Split the first (it lands now) — then the imported one is offered, already in the balance.
    s().confirmDeposit(proposeSplit(s().data, waiting.amount), true);
    expect(s().data.pendingDeposit).toMatchObject({
      amount: 500000,
      inBalance: true,
      confirmed: false,
    });
    const afterFirst = savingsBalance(s().data);
    s().confirmDeposit(proposeSplit(s().data, 500000), true);
    expect(savingsBalance(s().data)).toBe(afterFirst); // not added twice
    expect(bucketsMatchSavings(s().data)).toBe(true);
    expect(s().deposits.every((d) => d.confirmed)).toBe(true);
  });

  test('repeated rent from checking becomes a proposal to confirm or dismiss', () => {
    const chk = seed.accounts[0];
    const rent = (date: string, id: string) => ({
      date,
      merchant: 'CITY HOMES RENT',
      amount: -160000,
      externalId: id,
    });
    const outcome = s().importStatement({
      account: chk,
      transactions: [rent('2026-07-01', 'r1'), rent('2026-08-01', 'r2'), rent('2026-09-01', 'r3')],
    });
    expect(outcome.proposals).toBe(1);
    expect(buildBillsView(s().data).proposals).toEqual([
      {
        id: 'bill-city-homes-rent',
        title: 'City Homes Rent',
        subtitle: 'About $1,600 monthly · next Oct 1',
      },
    ]);
    s().confirmBill('bill-city-homes-rent');
    expect(buildBillsView(s().data).proposals).toEqual([]);
    expect(s().data.bills.find((b) => b.id === 'bill-city-homes-rent')?.confirmed).toBe(true);
  });

  test('an imported account over a week old shows the calm "last imported" note', () => {
    const chk = { ...seed.accounts[0], source: 'manual' as const };
    // Only the imported account is out of date in this test.
    useAppStore.setState((st) => ({
      data: { ...st.data, accounts: st.data.accounts.filter((a) => a.id === 'chk') },
    }));
    s().importStatement({ account: chk, transactions: [] });
    const later = new Date(Date.now() + 8 * 24 * 3600 * 1000);
    expect(buildTodayView(s().data, later).staleNote).toMatch(
      /Woodgrove checking was last imported .*, so this may be off by a few purchases\. Import this week’s file to catch up\./,
    );
    expect(buildTodayView(s().data, new Date()).staleNote).toBeUndefined();
  });

  test('bills: add, edit, remove; manual transactions', () => {
    s().saveBill({
      id: 'b1',
      name: 'Gym',
      amount: 4000,
      due: '2026-10-02',
      cadence: 'monthly',
      confirmed: true,
      payFrom: 'checking',
    });
    expect(buildBillsView(s().data).confirmed.find((b) => b.id === 'b1')).toMatchObject({
      value: '$40',
      subtitle: 'Due Oct 2 · monthly',
    });
    s().removeBill('b1');
    expect(s().data.bills.some((b) => b.id === 'b1')).toBe(false);
    s().addTransaction({
      id: 'm1',
      accountId: 'chk',
      date: '2026-09-23',
      merchant: 'Cash',
      amount: -1000,
      category: 'Dining',
      tax: false,
      reviewed: true,
    });
    expect(s().data.transactions.some((t) => t.id === 'm1')).toBe(true);
  });
});

describe('importing during setup', () => {
  test('the file’s account joins the draft; empty placeholders go', () => {
    useOnboarding.getState().clear();
    useOnboarding.getState().enterByHand();
    const file = readBankFile(fixture('contoso-card.ofx'), {});
    const outcome = useOnboarding.getState().importStatement({
      account: {
        id: 'card-new',
        name: 'Contoso Card',
        type: 'card',
        balance: 57000,
        source: 'import',
        status: 'ok',
        last4: '9876',
      },
      transactions: fileTransactions(file, null),
    });
    expect(outcome).toMatchObject({ added: 3, duplicates: 0 });
    const o = useOnboarding.getState();
    expect(o.path).toBe('import');
    expect(o.accounts.map((a) => a.id)).toEqual(['card-new']);
    expect(o.transactions).toHaveLength(3);
  });
});
