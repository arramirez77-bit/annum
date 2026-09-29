import { demoScenario } from '@/data/demo';
import { confirmSplit, markInvestMoved, proposeSplit, type AppData } from '@/domain';

import {
  buildDeferredView,
  buildInvestView,
  buildMovedView,
  investAccounts,
  investDestination,
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

  test('one investment account: no question, the note and reminder name it', () => {
    const v = buildInvestView(afterDeposit(), true);
    expect(v.choose).toBeUndefined();
    expect(v.destination).toEqual({
      name: 'Fabrikam Invest',
      accountId: 'brokerage',
      byHand: true,
    });
    expect(v.reminder).toBe('Move it in Fabrikam Invest, then mark it in Annum.');
  });

  test('two or more investment accounts: S6 asks, and everything follows the choice (Andy, 2026-09-29)', () => {
    const d = afterDeposit();
    const two: AppData = {
      ...d,
      accounts: [
        ...d.accounts,
        {
          id: 'broker-b',
          source: 'plaid',
          status: 'ok',
          name: 'Brokerage B',
          type: 'brokerage',
          balance: 500000,
          itemId: 'i2',
        },
      ],
    };
    const bank = {
      itemId: 'i2',
      institution: 'Bank B',
      env: 'production' as const,
      status: 'ok' as const,
      cursor: null,
      createdAt: '2026-09-01T08:00:00',
    };
    expect(investAccounts(two, [bank])).toEqual([
      { id: 'brokerage', name: 'Fabrikam Invest', detail: 'Entered by hand' },
      { id: 'broker-b', name: 'Brokerage B', detail: 'Connected · Bank B' },
    ]);
    // Nothing picked yet: the first one, as before.
    const start = buildInvestView(two, true);
    expect(start.choose).toBe('Where did you move it?');
    expect(start.destination.accountId).toBe('brokerage');
    expect(start.reminder).toBe('Move it in your investment account, then mark it in Annum.');
    // The second one picked: the note and the logged move name it, with no one-tap add.
    const v = buildInvestView(two, true, 'broker-b');
    expect(v.note).toBe(
      'Annum doesn’t pick investments. Move it in Brokerage B, then mark it here so your buckets stay accurate.',
    );
    expect(v.destination).toEqual({ name: 'Brokerage B', accountId: 'broker-b', byHand: false });
    const { data, move } = markInvestMoved(two, {
      id: 'm2',
      to: v.destination.name,
      toAccountId: v.destination.accountId,
      from: savingsSource(two, []),
    })!;
    expect(move).toMatchObject({ to: 'Brokerage B', toAccountId: 'broker-b' });
    expect(buildMovedView(data, move).add).toBeUndefined();
    // An id that no longer exists falls back to the first.
    expect(investDestination(two, 'gone').accountId).toBe('brokerage');
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
