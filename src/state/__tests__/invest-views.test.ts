import { demoScenario } from '@/data/demo';
import { confirmSplit, markInvestMoved, proposeSplit, type AppData } from '@/domain';

import {
  buildDeferredView,
  buildInvestView,
  buildMovedView,
  movingRows,
  savingsSource,
} from '../invest-views';

/** On track, after the $10,000 deposit is split: Runway full, $2,300 in Invest. */
const afterDeposit = (): AppData => {
  const d = demoScenario('on-track');
  return confirmSplit(d, proposeSplit(d, 1000000), true);
};

describe('S6 Invest handoff', () => {
  test('Runway is full: the amount, the rows, and the note (Figma 65:829)', () => {
    const v = buildInvestView(afterDeposit(), true);
    expect(v).toMatchObject({
      empty: false,
      label: 'Runway is full',
      amount: '$2,300',
      sentence: 'is ready to invest. Your savings now cover 5 months, which was your target.',
      note: 'Annum doesn’t pick investments. Move it in Fabrikam Invest, then mark it here so your buckets stay accurate.',
      primary: 'I moved it',
      quiet: 'Remind me tomorrow',
    });
    expect(v.rows.map((r) => [r.title, r.subtitle, r.value])).toEqual([
      ['Runway', 'Hit its target with this deposit', '$15,000'],
      ['Invest', 'Waiting to be moved', '$2,300'],
    ]);
  });

  test('after "I moved it": the log line, pending until it leaves savings, one tap for a by-hand account', () => {
    const d = afterDeposit();
    const { data, move } = markInvestMoved(d, {
      id: 'm1',
      to: 'Fabrikam Invest',
      toAccountId: 'brokerage',
      from: savingsSource(d, []),
    })!;
    expect(buildMovedView(data, move)).toMatchObject({
      title: 'Moved $2,300 to Fabrikam Invest',
      line: 'Pending until it leaves Savings. Annum marks it done when your savings balance shows it gone.',
      add: 'Add $2,300 to Fabrikam Invest',
    });
    expect(movingRows([move])).toEqual([
      {
        id: 'm1',
        title: 'Moved $2,300 to Fabrikam Invest',
        subtitle: 'Sep 23 · Pending until it leaves Savings',
        value: '$2,300',
      },
    ]);
    expect(movingRows([{ ...move, status: 'moved' }])).toEqual([]);
  });

  test('the savings bank’s name when the account is connected', () => {
    const d = demoScenario('on-track');
    const linked = {
      ...d,
      accounts: d.accounts.map((a) => (a.type === 'savings' ? { ...a, itemId: 'i1' } : a)),
    };
    const bank = {
      itemId: 'i1',
      institution: 'Woodgrove',
      env: 'production' as const,
      status: 'ok' as const,
      cursor: null,
      createdAt: '2026-09-01T08:00:00',
    };
    expect(savingsSource(linked, [bank])).toBe('Woodgrove');
  });
});

describe('S7 waited-on purchase', () => {
  const purchase = {
    id: 'p1',
    label: 'Purchase',
    amount: 200000,
    waitUntil: '2026-10-13',
    status: 'waiting' as const,
    createdOn: '2026-09-23',
  };

  test('the invoice landed and it fits now (Figma 65:864)', () => {
    const v = buildDeferredView(afterDeposit(), purchase);
    expect(v.title).toBe('Your invoice landed');
    expect(v.sentence).toBe('On Sep 23 you waited on a $2,000 purchase. It fits now.');
    expect(v.rows.map((r) => [r.title, r.subtitle, r.value])).toEqual([
      ['If you buy it now', 'Comes out of Free', '$2,000'],
      ['Runway after', 'Unchanged', '5.0 months'],
    ]);
    expect([v.primary, v.secondary, v.quiet]).toEqual(['Buy it', 'Wait again', 'I don’t need it']);
  });

  test('older waits without a date, and one that would still dip into Runway', () => {
    const { createdOn: _, ...older } = purchase;
    const v = buildDeferredView(demoScenario('on-track'), older);
    expect(v.sentence).toBe(
      'Earlier you waited on a $2,000 purchase. It would still dip into Runway.',
    );
    expect(v.rows[0].subtitle).toBe('$1,000 of it comes out of Runway');
  });
});
