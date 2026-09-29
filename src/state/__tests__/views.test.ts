import { demoScenario, type ScenarioName } from '@/data/demo';

import { clockFor, useAppStore } from '../store';
import { buildMoneyView, buildTodayView, buildWhatIfView, incomeHelper } from '../views';

const today = (name: ScenarioName) => {
  const data = demoScenario(name);
  return buildTodayView(data, clockFor({ mode: 'demo', data }));
};
const ws = (s: string) => s.replace(/\s/g, ' '); // Intl may use a narrow no-break space before AM/PM

describe('Today, per scenario (Figma 01, 02, E1, E2, O5, P2)', () => {
  test('on track: $1,000 until Oct 13, $50 a day, green field, weekly review (01)', () => {
    const v = today('on-track');
    expect(v).toMatchObject({
      status: 'on-track',
      caution: false,
      dateLabel: 'Sep 23',
      lead: 'You can spend',
      amount: 100000,
      sentence: 'until your next invoice on Oct 13. About $50 a day.',
      button: { variant: 'field', label: 'Start weekly review', route: { pathname: '/review' } },
    });
    expect(ws(v.updatedLabel)).toBe('Updated 7:02 AM');
    expect(ws(v.headerLabel)).toBe('Sep 23 · Updated 7:02 AM');
    expect(v.staleNote).toBeUndefined();
    expect(v.rows).toEqual([
      {
        id: 'runway',
        title: 'Runway',
        bucket: 'runway',
        value: '4.2 months',
        subtitle: 'Up 0.2 months this week · target 5 months',
      },
      {
        id: 'tax',
        title: 'Taxes',
        bucket: 'tax',
        value: '$3,000',
        subtitle: 'Next payment Jan 15',
        route: '/money/taxes',
      },
      {
        id: 'what-if',
        title: 'What would this do?',
        subtitle: 'Try a purchase before you buy it',
        bucket: 'none',
        route: '/what-if',
      },
    ]);
    expect(v.heroLabel).toBe(
      'You can spend $1,000 until your next invoice on Oct 13. About $50 a day.',
    );
  });

  test('heads up (02): the statement is in the sentence; its row and "Runway stays"', () => {
    const v = today('heads-up');
    expect(v).toMatchObject({
      status: 'heads-up',
      caution: true,
      amount: 20000,
      sentence: 'until Oct 13. The Contoso statement lands before your invoice does.',
      button: { variant: 'caution', label: 'See what I can move' },
    });
    expect(v.rows.map((r) => [r.title, r.subtitle, r.value, r.bucket])).toEqual([
      ['Contoso statement', 'Due Sep 28 · paying in full avoids interest', '$500', 'none'],
      ['Runway stays', 'If you pay it from Free, not savings', '4.2 months', 'runway'],
      ['What would this do?', 'Try a purchase before you buy it', undefined, 'none'],
    ]);
  });

  test('stale (E1): "about", only "Updated Sep 20", the bank’s name, no What would this do?', () => {
    const v = today('stale-sync');
    expect(v).toMatchObject({
      status: 'on-track',
      lead: 'You can spend about',
      updatedLabel: 'Updated Sep 20',
      headerLabel: 'Updated Sep 20',
      staleNote:
        'Woodgrove hasn’t synced since Sep 20, so this may be off by a few purchases. Tap to reconnect.',
    });
    expect(v.rows.map((r) => r.id)).toEqual(['runway', 'tax']);
  });

  test('late invoice (E2): stretched to Oct 22; the invoice and per-day rows; change its date', () => {
    const d = demoScenario('late-invoice');
    const v = buildTodayView(d, clockFor({ mode: 'demo', data: d }));
    const income = d.expectedIncome.find((i) => !i.received)!;
    expect(v).toMatchObject({
      status: 'heads-up',
      caution: true,
      dateLabel: 'Oct 17',
      amount: 17500,
      sentence: 'until Oct 22. The Northwind Studio invoice is 4 days late, so we stretched it.',
      button: {
        variant: 'caution',
        label: 'Change the invoice date',
        route: { pathname: '/income/new', edit: income.id },
      },
    });
    expect(v.rows.map((r) => [r.title, r.subtitle, r.value, r.bucket])).toEqual([
      ['Northwind Studio invoice', 'Expected Oct 13 · 4 days late', '$5,000', undefined],
      ['Per day', 'Stretched to Oct 22', '$35', undefined],
      ['What would this do?', 'Try a purchase before you buy it', undefined, undefined],
    ]);
  });

  test('first run (O5): about $1,300, about 6 months, Taxes not yet, first review', () => {
    const v = today('first-run');
    expect(v).toMatchObject({
      status: 'estimate',
      caution: false,
      lead: 'You can spend about',
      amount: 130000,
      sentence: 'until your next invoice on Oct 13. About $65 a day.',
      button: { variant: 'field', label: 'Start my first review' },
    });
    expect(v.rows[0]).toMatchObject({
      value: 'About 6 months',
      subtitle: 'Estimated from your accounts',
    });
    expect(v.rows[1]).toMatchObject({
      id: 'tax',
      title: 'Taxes',
      value: 'Not yet',
      subtitle: 'You’ll set this when your first deposit lands',
    });
  });

  test('salary (P2): payday wording, the next paycheck row, no tax row, nothing freelance', () => {
    const v = today('salary');
    expect(v).toMatchObject({
      status: 'on-track',
      amount: 110000,
      sentence: 'until payday on Oct 5. About $91 a day.',
    });
    expect(v.rows.map((r) => r.id)).toEqual(['runway', 'paycheck', 'what-if']);
    expect(v.rows[0]).toMatchObject({
      value: '2.0 months',
      subtitle: 'Target 6 months ($15,000)',
    });
    expect(v.rows[1]).toMatchObject({
      title: 'Next paycheck',
      subtitle: 'Oct 5 · every 2 weeks',
      value: '$2,500',
    });
    expect(JSON.stringify(v)).not.toMatch(/invoice|tax|freelanc/i);
  });
});

describe('Money', () => {
  test('five buckets in fixed order with one-line notes', () => {
    const v = buildMoneyView(demoScenario('on-track'));
    expect(v.savings).toBe(1910000);
    expect(v.rows.map((r) => [r.name, r.amount, r.note])).toEqual([
      ['Taxes', 300000, 'Next payment Jan 15'],
      [
        'Bills',
        200000,
        `${demoScenario('on-track').bills.filter((b) => b.confirmed).length} due in 30 days`,
      ],
      ['Runway', 1260000, '4.2 months · target 5 months'],
      ['Invest', 0, 'Starts when Runway is full'],
      ['Free', 150000, 'Counts toward what you can spend'],
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
      'A split could look like this: $4,500 for taxes, $2,000 for bills, and the rest in Runway. That’s about 4.2 months.',
    );
  });
});

describe('Add expected income (S4)', () => {
  test('says what is left after the Tax bucket, only with the Tax module', () => {
    const data = demoScenario('on-track'); // 30% to Tax
    expect(incomeHelper(data, 500000)).toBe('After taxes, about $3,500 of this is yours to plan.');
    expect(incomeHelper(data, null)).toBeUndefined();
    expect(incomeHelper(demoScenario('salary'), 500000)).toBeUndefined();
  });
});

describe('What would this do? (Figma 10, 11)', () => {
  const data = demoScenario('on-track');

  test('$200 fits: $800 (was $1,000), $40 a day until Oct 13, Runway unchanged', () => {
    const v = buildWhatIfView(data, 20000);
    expect(v.rows.map((r) => [r.title, r.subtitle, r.value])).toEqual([
      ['Free to spend', 'Was $1,000', '$800'],
      ['Per day until Oct 13', 'Was $50', '$40'],
      ['Runway', 'Unchanged', '4.2 months'],
    ]);
    expect(v).toMatchObject({
      guardrail: false,
      helper: 'Nothing is saved. This is only a preview.',
      note: 'This fits. It comes out of Free, and your savings stay where they are.',
      primary: 'Got it',
      quiet: 'Try another amount',
    });
  });

  test('$2,000 dips into Runway: 3.9 months, the target, wait until Oct 13', () => {
    const v = buildWhatIfView(data, 200000);
    expect(v.rows.map((r) => [r.title, r.subtitle, r.value])).toEqual([
      ['Free to spend', 'Was $1,000', '$0'],
      ['Runway', 'The rest would come from savings', '3.9 months'],
      ['Your Runway target', '$15,000', '5 months'],
    ]);
    expect(v).toMatchObject({
      guardrail: true,
      note: 'This would take $1,000 out of Runway. Your invoice lands Oct 13, and if you wait until then, your savings stay whole. We’ll ask you again when it lands.',
      primary: 'Wait until Oct 13',
      quiet: 'Buy anyway',
      waitUntil: '2026-10-13',
    });
  });

  test('more than Runway holds: 0.0 months and a plain explanation', () => {
    const v = buildWhatIfView(data, 2000200);
    expect(v.rows[1].value).toBe('0.0 months');
    expect(v.note).toBe(
      'That’s $6,402 more than Free to spend and all of Runway together. Your invoice lands Oct 13, and if you wait until then, your savings stay whole. We’ll ask you again when it lands.',
    );
  });

  test('empty: shows today’s numbers and a prompt', () => {
    const v = buildWhatIfView(data, null);
    expect(v.empty).toBe(true);
    expect(v.rows.map((r) => r.value)).toEqual(['$1,000', '$50', '4.2 months']);
    expect(v.rows.every((r) => r.subtitle === undefined)).toBe(true);
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
