import {
  accountType,
  categoryHint,
  mapAccount,
  mapTransaction,
  problemOf,
  statementFrom,
  toCents,
  type PlaidAccount,
} from '../map';

const account = (over: Partial<PlaidAccount> = {}): PlaidAccount => ({
  account_id: 'pa-1',
  name: 'TOTAL CHECKING',
  mask: '0000',
  type: 'depository',
  subtype: 'checking',
  balances: { current: 1210.5, available: 1100.25 },
  ...over,
});

describe('Plaid → Annum', () => {
  it('turns dollars into whole cents without float drift', () => {
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(toCents(19.99)).toBe(1999);
    expect(toCents(-1234.565)).toBe(-123456);
  });

  it('maps account kinds, and leaves out ones Annum does not track', () => {
    expect(accountType('depository', 'checking')).toBe('checking');
    expect(accountType('depository', 'savings')).toBe('savings');
    expect(accountType('depository', 'money market')).toBe('savings');
    expect(accountType('depository', 'paypal')).toBe('checking');
    expect(accountType('credit', 'credit card')).toBe('card');
    expect(accountType('investment', 'brokerage')).toBe('brokerage');
    expect(accountType('loan', 'student')).toBe('loan');
    expect(accountType('other', null)).toBeNull();
  });

  it('uses the available balance for checking and the current one elsewhere', () => {
    expect(mapAccount(account(), 'item-1', '2026-09-27T07:02:00')).toEqual({
      name: 'Total Checking',
      type: 'checking',
      balance: 110025,
      lastSynced: '2026-09-27T07:02:00',
      last4: '0000',
      source: 'plaid',
      plaidAccountId: 'pa-1',
      itemId: 'item-1',
      status: 'ok',
    });
    const savings = account({ subtype: 'savings', balances: { current: 500, available: 400 } });
    expect(mapAccount(savings, 'item-1', 'x')?.balance).toBe(50000);
    const noAvailable = account({ balances: { current: 12, available: null } });
    expect(mapAccount(noAvailable, 'item-1', 'x')?.balance).toBe(1200);
    expect(mapAccount(account({ type: 'other' }), 'item-1', 'x')).toBeNull();
  });

  it('reads a card statement, and treats a paid one as $0', () => {
    const base = {
      account_id: 'pa-2',
      last_statement_balance: 500,
      last_statement_issue_date: '2026-09-10',
      last_payment_amount: 120,
      last_payment_date: '2026-09-01',
      next_payment_due_date: '2026-10-05',
    };
    expect(statementFrom(base)).toEqual({ statementBalance: 50000, statementDue: '2026-10-05' });
    const paid = { ...base, last_payment_amount: 500, last_payment_date: '2026-09-15' };
    expect(statementFrom(paid)).toEqual({ statementBalance: 0, statementDue: '2026-10-05' });
    expect(statementFrom(undefined)).toEqual({});
    const card = account({
      type: 'credit',
      subtype: 'credit card',
      balances: { current: 640, available: 4360 },
    });
    expect(mapAccount(card, 'item-1', 'x', base)).toMatchObject({
      type: 'card',
      balance: 64000,
      statementBalance: 50000,
      statementDue: '2026-10-05',
    });
  });

  it('flips the sign of transactions (Plaid: money out is positive)', () => {
    expect(
      mapTransaction({
        transaction_id: 't1',
        account_id: 'pa-1',
        amount: 42.5,
        date: '2026-09-20',
        name: 'CORNER MARKET #0412',
        merchant_name: 'Corner Market',
        pending: false,
        pending_transaction_id: 'p1',
        personal_finance_category: {
          primary: 'FOOD_AND_DRINK',
          detailed: 'FOOD_AND_DRINK_GROCERIES',
        },
      }),
    ).toEqual({
      externalId: 't1',
      accountExternalId: 'pa-1',
      date: '2026-09-20',
      merchant: 'Corner Market',
      amount: -4250,
      pending: false,
      replaces: 'p1',
      categoryHint: 'Groceries',
    });
    const refund = mapTransaction({
      transaction_id: 't2',
      account_id: 'pa-1',
      amount: -12,
      date: '2026-09-21',
      name: 'Refund',
      pending: true,
    });
    expect(refund).toMatchObject({ amount: 1200, merchant: 'Refund', pending: true });
    expect(refund).not.toHaveProperty('replaces');
  });

  it("maps Plaid's categories where the match is clear", () => {
    const c = (primary: string, detailed = `${primary}_OTHER`) =>
      categoryHint({ primary, detailed });
    expect(c('INCOME')).toBe('Income');
    expect(c('TRANSFER_OUT')).toBe('Transfer');
    expect(c('LOAN_PAYMENTS', 'LOAN_PAYMENTS_CREDIT_CARD_PAYMENT')).toBe('Card payment');
    expect(c('RENT_AND_UTILITIES')).toBe('Bills');
    expect(c('FOOD_AND_DRINK', 'FOOD_AND_DRINK_COFFEE')).toBe('Dining');
    expect(c('TRANSPORTATION', 'TRANSPORTATION_GAS')).toBe('Gas');
    expect(c('ENTERTAINMENT')).toBeUndefined();
    expect(categoryHint(null)).toBeUndefined();
  });

  it('tells "sign in again" apart from problems that pass', () => {
    expect(problemOf({ error_type: 'ITEM_ERROR', error_code: 'ITEM_LOGIN_REQUIRED' })).toBe(
      'needs-reauth',
    );
    expect(problemOf({ error_type: 'ITEM_ERROR', error_code: 'PENDING_EXPIRATION' })).toBe(
      'needs-reauth',
    );
    expect(problemOf({ error_type: 'INSTITUTION_ERROR', error_code: 'INSTITUTION_DOWN' })).toBe(
      'provider-unavailable',
    );
    expect(problemOf({ error_type: 'ITEM_ERROR', error_code: 'PRODUCT_NOT_READY' })).toBe(
      'provider-unavailable',
    );
    expect(problemOf({ error_type: 'API_ERROR', error_code: 'INTERNAL_SERVER_ERROR' })).toBe(
      'unknown',
    );
  });
});
