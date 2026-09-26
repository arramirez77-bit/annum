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

  test('04 balances: every account, manual ones named in the note', () => {
    const v = buildBalancesView(data(), now());
    expect(v.rows.map((r) => [r.title, r.value, r.subtitle.replace(/\s/g, ' ')])).toEqual([
      ['Woodgrove checking', '$2,000', 'Updated 7:02 AM'],
      ['Savings', '$19,100', 'Updated 7:02 AM'],
      ['Contoso Card', '$500 owed', 'Updated 7:02 AM'],
      ['Fabrikam Invest', '$10,000', 'Entered by hand'],
      ['Student loan', '$8,000 owed', 'Entered by hand'],
    ]);
    expect(v.manualNote).toBe(
      'Fabrikam Invest and Student loan are entered by hand, so they show your last update. Tap one to change it.',
    );
  });

  test('05 tag: three new, suggestion pre-selected, Tax chip last', () => {
    const v = buildTagView(data());
    expect(v.title).toBe('3 new this week.');
    expect(v.items.map((i) => [i.merchant, i.suggestions, i.selected, i.tax])).toEqual([
      ['Litware', ['Software', 'Other'], 'Software', true],
      ['Corner Market', ['Groceries', 'Other'], 'Groceries', false],
      ['Fuel Stop', ['Gas', 'Other'], 'Gas', false],
    ]);
  });

  test('06 what changed: Free to spend, Runway, Tax reserve, and the notable category', () => {
    const v = buildChangesView(data());
    expect(v.cards).toEqual([
      {
        bucket: 'free',
        title: 'Free to spend',
        value: '$1,000',
        line: 'Down $400 — what you spent this week',
      },
      { bucket: 'runway', title: 'Runway', value: '4.2 months', line: 'Up 0.2 months' },
      { bucket: 'tax', title: 'Tax reserve', value: '$3,000', line: 'Next quarterly date Jan 15' },
    ]);
    expect(v.note).toBe('Dining was $150 this week, more than usual (4-week average $100).');
    expect(buildChangesView(data('salary')).cards.map((c) => c.title)).toEqual([
      'Free to spend',
      'Runway',
    ]);
  });

  test('07b habit: previews this week against the usual amount', () => {
    expect(buildHabitView(data(), 100000).note).toBe(
      'This week needs $1,050 — $50 more than usual.',
    );
    expect(buildHabitView(data(), 105000).note).toBe('This week needs $1,050, the same as usual.');
  });

  test('07 move money: $1,050, the breakdown, why it is above the habit', () => {
    const v = buildMoveView(data());
    expect(v.amount).toBe(105000);
    expect(v.comparison).toBe('You usually move $1,000. This week needs $1,050.');
    expect(v.rows).toEqual([
      { title: 'Contoso Card statement', subtitle: 'Due Sep 28', value: '$500' },
      { title: 'Car insurance', subtitle: 'Due Sep 29', value: '$150' },
      { title: 'Phone', subtitle: 'Due Sep 30', value: '$50' },
      { title: 'Spending for 7 days', subtitle: '$50 × 7', value: '$350' },
    ]);
    expect(v.aboveHabit).toBe(
      "That's $50 more than usual — the Contoso Card statement ($500) is due Sep 28.",
    );
    // Woodgrove is fictional: no link, so the flow offers "I already moved it" with a how-to line.
    expect(v.openLabel).toBeUndefined();
    expect(v.howTo).toBe(
      'Move it in Woodgrove\'s app, then come back and tap "I already moved it".',
    );
  });

  test('known banks get an "Open {bank}" link', () => {
    expect(bankFor('Chase checking')).toEqual({ name: 'Chase', url: 'https://www.chase.com' });
    expect(bankFor('Woodgrove checking')).toEqual({ name: 'Woodgrove' });
  });

  test('08 week reviewed: $400 spent, $29 over, top 3, pending transfer, next Sunday', () => {
    const v = buildDoneView(data(), { amount: 105000, markedOn: '2026-09-23' });
    expect(v.title).toBe('You spent $400');
    expect(v.bar).toEqual({ within: 37100, over: 2900, left: 0 });
    expect(v.barLabel).toBe('$29 over your $371 allowance');
    expect(v.categories.map((c) => [c.title, c.value, c.subtitle])).toEqual([
      ['Dining', '$150', 'more than usual · usually $100'],
      ['Groceries', '$120', 'about usual · usually $120'],
      ['Gas', '$40', 'less than usual · usually $60'],
    ]);
    expect(v.left.map((r) => [r.title, r.value])).toEqual([
      ['Free to spend', '$1,000'],
      ['Moving to checking', '$1,050'],
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
    expect(v.subtitle).toBe('From Northwind Studio.');
    expect(v.rows.map((r) => [r.name, r.amount, r.note])).toEqual([
      ['Tax', 300000, '30% of this deposit'],
      ['Bills', 0, '$2,000 due in the next 30 days'],
      ['Runway', 240000, 'Reaches the $15k target'],
      ['Invest', 230000, 'Runway is full, so 50% of what’s left'],
      ['Free', 230000, 'Yours to spend'],
    ]);
  });

  test('E3 → split: the first split of unsplit savings', () => {
    const d = data('first-run');
    const v = buildSplitView(d, 'unsplit', initialSplit(d, 'unsplit')!);
    expect(v.title).toBe('Split your $19,100 savings');
    expect(v.rows.map((r) => [r.name, r.amount])).toEqual([
      ['Tax', 450000],
      ['Bills', 200000],
      ['Runway', 1260000],
      ['Invest', 0],
      ['Free', 0],
    ]);
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
    expect(v.groups.map((g) => [g.label, g.rows.map((r) => r.title)])).toEqual([
      ['Sep 22', ['Corner Market', 'Fuel Stop']],
      ['Sep 21', ['Green Bowl', 'Litware', 'Northwind Studio']],
    ]);
    expect(v.groups[1].rows[1]).toEqual({
      id: 't1',
      title: 'Litware',
      subtitle: 'Software · Tax · Contoso Card',
      value: '−$20.00',
    });
    expect(
      buildTransactionsView(data(), 'tax').groups.flatMap((g) => g.rows.map((r) => r.title)),
    ).toEqual(['Litware']);
    expect(
      buildTransactionsView(data(), 'untagged').groups.flatMap((g) => g.rows.map((r) => r.title)),
    ).toEqual(['Corner Market', 'Fuel Stop', 'Litware']);
  });

  test('E5: no transactions yet', () => {
    expect(buildTransactionsView({ ...data(), transactions: [] }, 'all').empty).toBe(
      'No transactions yet. They appear once a bank is connected or a file from your bank is imported.',
    );
  });

  test('S2: tagged total sentence, categories with item counts, Tax reserve', () => {
    const v = buildTaxesView(data());
    expect(v.sentence).toBe("You've tagged $3,800 in work expenses across 21 items this year.");
    expect(v.categories).toEqual([
      { title: 'Equipment', subtitle: '3 items', value: '$2,000' },
      { title: 'Software', subtitle: '12 items', value: '$1,000' },
      { title: 'Home office', subtitle: '4 items', value: '$500' },
      { title: 'Travel', subtitle: '2 items', value: '$300' },
    ]);
    expect(v.reserve).toEqual({
      title: 'Tax reserve',
      subtitle: 'Next quarterly date Jan 15',
      value: '$3,000',
    });
  });
});
