import { demoScenario, type ScenarioName } from '@/data/demo';

import { clockFor, useAppStore } from '../store';
import { buildMoneyView, buildTodayView, buildWhatIfView } from '../views';

const today = (name: ScenarioName) => {
  const data = demoScenario(name);
  return buildTodayView(data, clockFor({ mode: 'demo', data }));
};
const ws = (s: string) => s.replace(/\s/g, ' '); // Intl may use a narrow no-break space before AM/PM

describe('Today, per scenario', () => {
  test('on track: $1,000 until Oct 13, $50 a day, green field, weekly review', () => {
    const v = today('on-track');
    expect(v).toMatchObject({
      status: 'on-track',
      caution: false,
      dateLabel: 'Sep 23',
      lead: 'You can spend',
      amount: 100000,
      sentence: 'until your next invoice on Oct 13. About $50 a day.',
      button: { variant: 'field', label: 'Start weekly review' },
    });
    expect(ws(v.updatedLabel)).toBe('Updated 7:02 AM');
    expect(v.cause).toBeUndefined();
    expect(v.staleNote).toBeUndefined();
    expect(v.rows).toEqual([
      {
        id: 'runway',
        title: 'Runway',
        bucket: 'runway',
        value: '4.2 mo',
        subtitle: 'Up 0.2 this week · $15k target',
      },
      {
        id: 'tax',
        title: 'Tax reserve',
        bucket: 'tax',
        value: '$3,000',
        subtitle: 'Next quarterly date Jan 15',
        route: '/money/taxes',
      },
      { id: 'what-if', title: 'What would this do?', bucket: 'none', route: '/what-if' },
    ]);
    expect(v.heroLabel).toBe(
      'You can spend $1,000 until your next invoice on Oct 13. About $50 a day.',
    );
  });

  test('heads up: $200, umber, names the card statement, Caution button', () => {
    expect(today('heads-up')).toMatchObject({
      status: 'heads-up',
      caution: true,
      amount: 20000,
      sentence: 'until your next invoice on Oct 13. About $10 a day.',
      cause: 'The Contoso Card statement ($500) lands before your invoice does.',
      button: { variant: 'caution', label: 'See what I can move' },
    });
  });

  test('stale: "about", "Updated Sep 20", and the stale note; status unchanged', () => {
    const v = today('stale-sync');
    expect(v).toMatchObject({
      status: 'on-track',
      lead: 'You can spend about',
      updatedLabel: 'Updated Sep 20',
      staleNote:
        "Woodgrove checking hasn't synced since Sep 20, so this may be off by a few purchases.",
    });
  });

  test('late invoice: $175 until Oct 22, $35 a day, names the late invoice', () => {
    const v = today('late-invoice');
    expect(v).toMatchObject({
      status: 'heads-up',
      caution: true,
      dateLabel: 'Oct 17',
      lead: 'You can spend',
      amount: 17500,
      sentence: 'until Oct 22, when we expect the late invoice. About $35 a day.',
      cause: 'The Northwind Studio invoice is 4 days late.',
      button: { variant: 'caution', label: 'See my options' },
    });
    expect(v.rows[0].subtitle).toBe('$15k target');
  });

  test('first run: estimate — about $1,300, $65 a day, ~6 months', () => {
    const v = today('first-run');
    expect(v).toMatchObject({
      status: 'estimate',
      caution: false,
      lead: 'You can spend about',
      amount: 130000,
      sentence: 'until your next invoice on Oct 13. About $65 a day.',
      button: { variant: 'field', label: 'Do my first weekly review' },
    });
    expect(v.rows[0]).toMatchObject({
      value: '~6 mo',
      subtitle: 'Estimated from savings · $15k target',
    });
    expect(v.rows[1]).toMatchObject({ id: 'tax', value: 'Not set aside yet' });
  });

  test('salary: payday wording, $91 a day, no tax row, nothing freelance', () => {
    const v = today('salary');
    expect(v).toMatchObject({
      status: 'on-track',
      amount: 110000,
      sentence: 'until payday on Oct 5. About $91 a day.',
    });
    expect(v.rows.map((r) => r.id)).toEqual(['runway', 'what-if']);
    expect(v.rows[0]).toMatchObject({ value: '2.0 mo', subtitle: '$15k target' });
    expect(JSON.stringify(v)).not.toMatch(/invoice|tax|freelanc/i);
  });
});

describe('Money', () => {
  test('five buckets in fixed order with one-line notes', () => {
    const v = buildMoneyView(demoScenario('on-track'));
    expect(v.savings).toBe(1910000);
    expect(v.rows.map((r) => [r.name, r.amount, r.note])).toEqual([
      ['Tax', 300000, 'Set aside for taxes · next quarterly date Jan 15'],
      ['Bills', 200000, '$2,000 in bills due in the next 30 days'],
      ['Runway', 1260000, '4.2 months · $15k target'],
      ['Invest', 0, 'Unlocks once Runway reaches $15k'],
      ['Free', 150000, 'Yours to spend'],
    ]);
    expect(v.showTaxes).toBe(true);
    expect(v.taxYearLabel).toBe('Taxes · 2026');
  });

  test('salary hides Tax everywhere', () => {
    const v = buildMoneyView(demoScenario('salary'));
    expect(v.rows.map((r) => r.name)).toEqual(['Bills', 'Runway', 'Invest', 'Free']);
    expect(v.showTaxes).toBe(false);
  });

  test('not split yet (E3): muted rows and the first-split preview', () => {
    const v = buildMoneyView(demoScenario('first-run'));
    expect(v.unsplit).toBe(true);
    expect(v.rows.every((r) => r.amount === 0 && r.note === 'Not split yet')).toBe(true);
    expect(v.previewNote).toBe(
      'A first split would set aside Tax $4,500 · Bills $2,000 · Runway $12,600, leaving Free $0.',
    );
  });
});

describe('What would this do?', () => {
  const data = demoScenario('on-track');

  test('$200 fits: $800, $40 a day, Runway unchanged', () => {
    const v = buildWhatIfView(data, 20000);
    expect(v.rows.map((r) => r.value)).toEqual(['$800', '$40', '4.2 mo']);
    expect(v).toMatchObject({
      guardrail: false,
      note: "That fits. You'd still have about $40 a day until Oct 13.",
      primary: 'Got it',
      quiet: 'Try another amount',
    });
  });

  test('$2,000 dips into Runway: 3.9 months, guardrail, wait until Oct 13', () => {
    const v = buildWhatIfView(data, 200000);
    expect(v.rows.map((r) => r.value)).toEqual(['$0', '$0', '3.9 mo']);
    expect(v).toMatchObject({
      guardrail: true,
      note: 'This would dip $1,000 into Runway (4.2 → 3.9 months). Waiting until Oct 13, when your invoice arrives, keeps Runway whole.',
      primary: 'Wait until Oct 13',
      quiet: 'Buy anyway',
      waitUntil: '2026-10-13',
    });
  });

  test('more than Runway holds: 0.0 months and a plain explanation', () => {
    const v = buildWhatIfView(data, 2000200);
    expect(v.rows.map((r) => r.value)).toEqual(['$0', '$0', '0.0 mo']);
    expect(v.note).toBe(
      "That's $6,402 more than Free to spend and all of Runway together. Waiting until Oct 13, when your invoice arrives, keeps Runway whole.",
    );
  });

  test('empty: shows today’s numbers and a prompt', () => {
    const v = buildWhatIfView(data, null);
    expect(v.empty).toBe(true);
    expect(v.rows.map((r) => r.value)).toEqual(['$1,000', '$50', '4.2 mo']);
    expect(v.note).toBe('Type an amount to see what it would do.');
  });
});

describe('store', () => {
  test('switching scenarios swaps the data; deferring records the purchase', () => {
    useAppStore.getState().setScenario('heads-up');
    expect(useAppStore.getState().data.accounts.find((a) => a.id === 'chk')?.balance).toBe(120000);
    const p = useAppStore.getState().deferPurchase(200000, '2026-10-13');
    expect(useAppStore.getState().deferred).toContainEqual(p);
    expect(p).toMatchObject({ amount: 200000, waitUntil: '2026-10-13', status: 'waiting' });
    useAppStore.getState().setScenario('on-track');
  });
});
