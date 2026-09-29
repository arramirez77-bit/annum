import { demoScenario, type ScenarioName } from '@/data/demo';
import { proposeSplit } from '@/domain';

import {
  bankFor,
  buildBalancesView,
  buildChangesView,
  buildDoneView,
  buildHabitView,
  buildMoveView,
  buildSetupView,
  buildSplitView,
  buildTagView,
  buildTaxesView,
  buildTransactionsView,
  initialSplit,
  reviewSteps,
} from '../review-views';
import { clockFor } from '../store';

const data = (name: ScenarioName = 'on-track') => demoScenario(name);
const now = (d = data()) => clockFor({ mode: 'demo', data: d });

describe('Weekly Review views', () => {
  test('steps: the habit step only on the first review', () => {
    expect(reviewSteps(data())).toEqual(['balances', 'tag', 'changes', 'move', 'done']);
    expect(reviewSteps(data('first-run'))).toEqual([
      'balances',
      'tag',
      'changes',
      'habit',
      'move',
      'done',
    ]);
  });

  test('04 balances (Figma 59:167): synced times, statement due, entered by hand', () => {
    const v = buildBalancesView(data(), now());
    expect(v.title).toBe('Check your balances');
    expect(v.subtitle).toBe('Synced this morning at 7:02. Anything that didn’t connect is marked.');
    expect(v.rows.map((r) => [r.title, r.value, r.subtitle.replace(/\s/g, ' ')])).toEqual([
      ['Woodgrove checking', '$2,000', 'Synced 7:02 AM'],
      ['Savings', '$19,100', 'Synced 7:02 AM · split into buckets'],
      ['Contoso Card', '$500', 'Statement due Sep 28'],
      ['Fabrikam Invest', '$10,000', 'Entered by hand'],
      ['Student loan', '$8,000', 'Entered by hand'],
    ]);
    expect(v.manualNote).toBe(
      'Fabrikam Invest and Student loan are entered by hand. Tap one to update it if the balance changed.',
    );
    expect(v.primary).toBe('Looks right');
  });

  test('05 tag (59:224): what were these, weekday dates, the bank, Work expense last', () => {
    const v = buildTagView(data());
    expect(v.title).toBe('What were these?');
    expect(v.subtitle).toBe(
      '3 new this week. We guessed a category for each one. Fix any that are wrong, and tap Work expense for anything you bought for work.',
    );
    expect(v.items.map((i) => [i.merchant, i.dateLabel, i.accountName])).toEqual([
      ['Litware', 'Mon Sep 21', 'Contoso'],
      ['Corner Market', 'Tue Sep 22', 'Woodgrove'],
      ['Fuel Stop', 'Tue Sep 22', 'Contoso'],
    ]);
    expect(v.items.map((i) => [i.merchant, i.suggestions, i.selected, i.tax])).toEqual([
      ['Litware', ['Software', 'Other'], 'Software', true],
      ['Corner Market', ['Groceries', 'Other'], 'Groceries', false],
      ['Fuel Stop', ['Gas', 'Other'], 'Gas', false],
    ]);
    expect(v.primary).toBe('Looks right');
  });

  test('06 your week (60:263): Free to spend, Runway, Taxes, and the dining note', () => {
    const v = buildChangesView(data());
    expect([v.title, v.subtitle]).toEqual(['Your week', 'What changed since last Sunday.']);
    expect(v.cards).toEqual([
      { bucket: 'free', title: 'Free to spend', value: '$1,000', line: 'Down $400 this week' },
      { bucket: 'runway', title: 'Runway', value: '4.2 months', line: 'Up 0.2 months' },
      { bucket: 'tax', title: 'Taxes', value: '$3,000', line: 'On track for Jan 15' },
    ]);
    expect(v.note).toBe(
      'You spent $50 more on dining than your 4-week average. That came out of Free, not savings, so there’s nothing to fix.',
    );
    expect(buildChangesView(data('salary')).cards.map((c) => c.title)).toEqual([
      'Free to spend',
      'Runway',
    ]);
  });

  test('07b habit (73:1293): what lands this week, and about how much', () => {
    const v = buildHabitView(data());
    expect(v.title).toBe('How much do you usually move?');
    expect(v.note).toBe(
      'Next, we’ll check it against this week: the Contoso statement and two bills land, so you’ll likely need about $1,050.',
    );
    expect(v.primary).toBe('Continue');
  });

  test('07 move money (60:310): about the same, bills together, weekly spending', () => {
    const v = buildMoveView(data());
    expect(v.title).toBe('Move money to checking');
    expect(v.amount).toBe(105000);
    expect(v.comparison).toBe('You usually move $1,000. This week needs about the same.');
    expect(v.rows).toEqual([
      {
        title: 'Bills due this week',
        subtitle: 'Car insurance, Phone, Contoso statement',
        value: '$700',
      },
      { title: 'Weekly spending', subtitle: 'About $50 a day for a week', value: '$350' },
    ]);
    expect(v.note).toBe(
      'Move it in Woodgrove, then come back. We’ll show it as pending until it arrives.',
    );
    // Woodgrove is fictional: no link, so "I already moved it" is the button.
    expect(v.openLabel).toBeUndefined();
  });

  test('known banks get an "Open {bank}" link', () => {
    expect(bankFor('Chase checking')).toEqual({ name: 'Chase', url: 'https://www.chase.com' });
    expect(bankFor('Woodgrove checking')).toEqual({ name: 'Woodgrove' });
  });

  test('08 week reviewed (60:360): you spent, over the weekly amount, usual lines, what’s left', () => {
    const v = buildDoneView(data(), { amount: 105000, markedOn: '2026-09-23' });
    expect([v.title, v.spentLabel, v.spent]).toEqual(['Week reviewed', 'You spent', '$400']);
    expect(v.bar).toEqual({ within: 37100, over: 2900, left: 0 });
    expect(v.barLabel).toBe(
      '$29 over your $371 weekly amount. Free covered it, so your savings weren’t touched.',
    );
    expect(v.categories.map((c) => [c.title, c.value, c.subtitle])).toEqual([
      ['Dining', '$150', '$50 more than usual'],
      ['Groceries', '$120', 'About the same as usual'],
      ['Gas', '$40', '$20 less than usual'],
    ]);
    expect(v.left.map((r) => [r.title, r.subtitle, r.value])).toEqual([
      ['Free to spend', '20 days until your Oct 13 invoice', '$1,000'],
      ['Move to checking', 'Pending until it shows up in Woodgrove', '$1,050'],
    ]);
    expect(v.nextReview).toBe("Next review Sunday, Sep 27. We'll remind you.");
  });
});

describe('Deposit split views', () => {
  test('09: the landed $10,000 deposit, split by the waterfall', () => {
    const d = data();
    const split = initialSplit(d, 'd1')!;
    expect(split).toEqual(proposeSplit(d, 1000000));
    const v = buildSplitView(d, 'd1', split);
    expect(v.title).toBe('$10,000 just landed');
    expect(v.subtitle).toBe('Here’s where it goes. Change anything before you confirm.');
    expect(v.rows.map((r) => [r.name, r.amount, r.note])).toEqual([
      ['Taxes', 300000, '30% of every deposit'],
      ['Bills', 0, 'Already covered this month'],
      ['Runway', 240000, 'Reaches your 5-month target'],
      ['Invest', 230000, 'Starts now that Runway is full'],
      ['Free', 230000, 'Yours to spend'],
    ]);
    expect(v.note).toBe(
      'This deposit fills Runway. From now on, what’s left after taxes, bills and Free goes to Invest.',
    );
    expect(v.quiet).toBe('Edit amounts');
  });

  test('E3 → split: the first split of unsplit savings', () => {
    const d = data('first-run');
    const v = buildSplitView(d, 'unsplit', initialSplit(d, 'unsplit')!);
    expect(v.title).toBe('$19,100 in savings');
    expect(v.subtitle).toBe('Here’s a starting split. Change anything before you confirm.');
    expect(v.rows.map((r) => [r.name, r.amount, r.note])).toEqual([
      ['Taxes', 450000, 'Set aside for Jan 15'],
      ['Bills', 200000, 'Covers the next 30 days'],
      ['Runway', 1260000, '4.2 months · target 5 months'],
      ['Invest', 0, 'Starts when Runway is full'],
      ['Free', 0, 'Yours to spend'],
    ]);
    expect(v.note).toBe(
      'Runway is $2,400 short of your 5-month target. Your next deposits fill it first.',
    );
    expect(v.quiet).toBe('Not now');
  });

  test('unknown or already-confirmed deposits have no split', () => {
    expect(initialSplit(data(), 'nope')).toBeUndefined();
  });

  test('O6 setup: live consequence sentence', () => {
    const v = buildSetupView(data('first-run'), 0.3, 5);
    expect(v.note).toBe(
      '30% goes to Tax, and Runway fills to $15k (5 months of spending) before anything goes to Invest.',
    );
    expect(v.target).toBe(1500000);
    expect(buildSetupView(data('salary'), 0, 6).showTax).toBe(false);
  });
});

describe('Transactions and Taxes', () => {
  test('S1: grouped by day, newest first, with filters', () => {
    const v = buildTransactionsView(data(), 'all');
    expect(v.title).toBe('Transactions');
    expect(v.groups.map((g) => [g.label, g.rows.map((r) => r.title)])).toEqual([
      ['Yesterday', ['Corner Market', 'Fuel Stop']],
      ['Monday', ['Green Bowl', 'Litware', 'Northwind Studio']],
    ]);
    expect(v.groups[1].rows[1]).toEqual({
      id: 't1',
      title: 'Litware',
      subtitle: 'Software · Work expense · Contoso Card',
      value: '$20.00',
    });
    expect(v.filters.map((f) => f.label)).toEqual(['All', 'Needs a tag · 3', 'Work expense']);
    expect(
      buildTransactionsView(data(), 'tax').groups.flatMap((g) => g.rows.map((r) => r.title)),
    ).toEqual(['Litware']);
    expect(
      buildTransactionsView(data(), 'untagged').groups.flatMap((g) => g.rows.map((r) => r.title)),
    ).toEqual(['Corner Market', 'Fuel Stop', 'Litware']);
  });

  test('S1 for one account: its transactions only, no account name on rows', () => {
    const d = data();
    const account = d.transactions[0].accountId;
    const v = buildTransactionsView(d, 'all', account);
    expect(v.title).toBe(d.accounts.find((a) => a.id === account)?.name);
    const rows = v.groups.flatMap((g) => g.rows);
    expect(rows.length).toBe(d.transactions.filter((t) => t.accountId === account).length);
    expect(rows.every((r) => !r.subtitle.includes(v.title))).toBe(true);
    expect(buildTransactionsView({ ...d, transactions: [] }, 'all', account).empty).toBe(
      'No transactions from this account yet.',
    );
  });

  test('E5: no transactions yet', () => {
    expect(buildTransactionsView({ ...data(), transactions: [] }, 'all').empty).toBe(
      'No transactions yet. They show up after your first sync, usually within an hour of connecting a bank.',
    );
  });

  test('S2: tagged total sentence, categories with item counts, Tax reserve', () => {
    const v = buildTaxesView(data());
    expect(v.sentence).toBe(
      '$3,800 in work expenses tagged this year. Your accountant gets this list, sorted.',
    );
    expect(v.categories).toEqual([
      { title: 'Equipment', subtitle: '3 items', value: '$2,000' },
      { title: 'Software', subtitle: '12 items', value: '$1,000' },
      { title: 'Home office', subtitle: '4 items', value: '$500' },
      { title: 'Travel', subtitle: '2 items', value: '$300' },
    ]);
    expect(v.reserve).toEqual({
      title: 'Taxes',
      subtitle: 'Next quarterly payment Jan 15',
      value: '$3,000',
    });
  });
});
