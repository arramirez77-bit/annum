import { readFileSync } from 'fs';

import { demoSeed } from '@/data/demo';
import {
  applyImport,
  currentDeposit,
  tidyMerchant,
  csvBalance,
  readBankFile,
  fileTransactions,
  csvTransactions,
  detectMapping,
  findHeader,
  headerKey,
  isOfx,
  matchIncome,
  mergeImport,
  parseAmount,
  parseCsv,
  parseDate,
  parseOfx,
  planReminders,
  proposeBills,
  proposedBills,
  rollBills,
  suggestCategory,
  type Bill,
  type Transaction,
} from '@/domain';

const fixture = (name: string) => readFileSync(`fixtures/bank-files/${name}`, 'utf8');
const seed = demoSeed();

describe('CSV bank exports', () => {
  test('quotes, commas inside quotes, doubled quotes, CRLF and a byte-order mark', () => {
    expect(parseCsv('﻿a,"b, c","say ""hi"""\r\n1,2,3\r\n\r\n')).toEqual([
      ['a', 'b, c', 'say "hi"'],
      ['1', '2', '3'],
    ]);
  });

  test('amounts: signs, parentheses, currency, thousands, DR/CR', () => {
    expect(parseAmount('-80.00')).toBe(-8000);
    expect(parseAmount('$1,234.5')).toBe(123450);
    expect(parseAmount('(15.00)')).toBe(-1500);
    expect(parseAmount('12.34-')).toBe(-1234);
    expect(parseAmount('20.00 DR')).toBe(-2000);
    expect(parseAmount('20.00 CR')).toBe(2000);
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('n/a')).toBeNull();
  });

  test('dates in the file’s order; impossible days are rejected', () => {
    expect(parseDate('09/23/2026', 'mdy')).toBe('2026-09-23');
    expect(parseDate('9/3/26', 'mdy')).toBe('2026-09-03');
    expect(parseDate('23.09.2026', 'dmy')).toBe('2026-09-23');
    expect(parseDate('2026-09-23', 'ymd')).toBe('2026-09-23');
    expect(parseDate('02/30/2026', 'mdy')).toBeNull();
    expect(parseDate('pending', 'mdy')).toBeNull();
  });

  test('the fixture maps itself: date, description, one signed amount', () => {
    const rows = parseCsv(fixture('woodgrove-checking.csv'));
    const h = findHeader(rows);
    expect(h).toBe(0);
    const mapping = detectMapping(rows[h], rows.slice(h + 1));
    expect(mapping).toEqual({
      date: 0,
      description: 1,
      amount: 2,
      outflowPositive: false,
      dateOrder: 'mdy',
    });
    const { transactions, skipped } = csvTransactions(rows.slice(h + 1), mapping!);
    expect(skipped).toBe(0);
    expect(transactions[3]).toEqual({
      date: '2026-09-22',
      merchant: 'CORNER MARKET #0412',
      amount: -8000,
    });
    expect(transactions[4].merchant).toBe('Green Bowl, Main St');
    expect(headerKey(rows[h])).toBe('transaction date|description|amount|balance');
  });

  test('separate debit and credit columns; money-out-positive files flip', () => {
    const rows = parseCsv(
      'Date,Payee,Withdrawals,Deposits\n2026-09-01,Rent,1600.00,\n2026-09-02,Client,,500.00',
    );
    const mapping = detectMapping(rows[0], rows.slice(1))!;
    expect(mapping).toMatchObject({
      date: 0,
      description: 1,
      debit: 2,
      credit: 3,
      dateOrder: 'ymd',
    });
    expect(csvTransactions(rows.slice(1), mapping).transactions.map((t) => t.amount)).toEqual([
      -160000, 50000,
    ]);
    const card = parseCsv('Date,Description,Amount\n09/01/2026,Coffee,4.50');
    const flipped = { ...detectMapping(card[0], card.slice(1))!, outflowPositive: true };
    expect(csvTransactions(card.slice(1), flipped).transactions[0].amount).toBe(-450);
  });

  test('a file with no date or amount column has no mapping', () => {
    expect(detectMapping(['Name', 'Note'], [])).toBeNull();
  });

  test('"Payment" is ambiguous (money out on checking, in on cards): the user picks', () => {
    expect(detectMapping(['Date', 'Payee', 'Payment', 'Deposit'], [])).toBeNull();
  });
});

describe('OFX / QFX', () => {
  test('a credit-card statement (SGML, unclosed tags): owed balance, transactions, bank ids', () => {
    const text = fixture('contoso-card.ofx');
    expect(isOfx(text)).toBe(true);
    const [statement] = parseOfx(text);
    expect(statement).toMatchObject({
      type: 'card',
      last4: '9876',
      balance: 57000,
      balanceDate: '2026-09-25',
    });
    expect(statement.transactions).toEqual([
      { date: '2026-09-23', merchant: 'LITWARE SOFTWARE', amount: -2000, externalId: 'C-1001' },
      { date: '2026-09-24', merchant: 'FUEL STOP 118', amount: -5000, externalId: 'C-1002' },
      { date: '2026-09-15', merchant: 'PAYMENT THANK YOU', amount: 50000, externalId: 'C-1003' },
    ]);
  });

  test('one file, two accounts: each statement with its own type, last 4, balance', () => {
    const statements = parseOfx(fixture('woodgrove-both.ofx'));
    expect(statements.map((st) => [st.type, st.last4, st.balance, st.transactions.length])).toEqual(
      [
        ['checking', '1234', 380000, 2],
        ['savings', '5678', 1910000, 1],
      ],
    );
  });

  test('a checking statement in OFX 2 (XML) with a closed-tag balance', () => {
    const xml = `<?xml version="1.0"?><OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><CURDEF>USD</CURDEF>
      <BANKACCTFROM><BANKID>1</BANKID><ACCTID>000111222333</ACCTID><ACCTTYPE>SAVINGS</ACCTTYPE></BANKACCTFROM>
      <BANKTRANLIST><STMTTRN><TRNTYPE>CREDIT</TRNTYPE><DTPOSTED>20260923</DTPOSTED><TRNAMT>10000.00</TRNAMT>
      <FITID>S-1</FITID><NAME>NORTHWIND STUDIO</NAME></STMTTRN></BANKTRANLIST>
      <LEDGERBAL><BALAMT>29100.00</BALAMT><DTASOF>20260923</DTASOF></LEDGERBAL></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
    expect(parseOfx(xml)[0]).toMatchObject({
      type: 'savings',
      last4: '2333',
      balance: 2910000,
      transactions: [{ date: '2026-09-23', amount: 1000000, externalId: 'S-1' }],
    });
  });
});

describe('merging an import', () => {
  let n = 0;
  const id = () => `new-${++n}`;
  const existing: Transaction[] = [
    {
      id: 'a',
      accountId: 'chk',
      date: '2026-09-22',
      merchant: 'Corner Market',
      amount: -8000,
      tax: false,
      reviewed: true,
    },
  ];

  test('skips what’s already there (by date, amount and merchant), keeps two identical coffees', () => {
    const r = mergeImport(
      existing,
      [
        { date: '2026-09-22', merchant: 'CORNER MARKET #0412', amount: -8000 },
        { date: '2026-09-23', merchant: 'Cafe', amount: -450 },
        { date: '2026-09-23', merchant: 'Cafe', amount: -450 },
      ],
      'chk',
      [],
      id,
    );
    expect(r.duplicates).toBe(1);
    expect(r.added.map((t) => t.merchant)).toEqual(['Cafe', 'Cafe']);
    expect(r.range).toEqual({ from: '2026-09-22', to: '2026-09-23' });
    // Importing the same file again adds nothing.
    const again = mergeImport(
      r.transactions,
      [
        { date: '2026-09-23', merchant: 'Cafe', amount: -450 },
        { date: '2026-09-23', merchant: 'Cafe', amount: -450 },
      ],
      'chk',
      [],
      id,
    );
    expect(again.added).toEqual([]);
    expect(again.duplicates).toBe(2);
  });

  test('bank ids: the same id is a duplicate; a different id is a new transaction', () => {
    const first = mergeImport(
      [],
      [{ date: '2026-09-23', merchant: 'Cafe', amount: -450, externalId: 'x1' }],
      'card',
      [],
      id,
    );
    const second = mergeImport(
      first.transactions,
      [
        { date: '2026-09-23', merchant: 'Cafe', amount: -450, externalId: 'x1' },
        { date: '2026-09-23', merchant: 'Cafe', amount: -450, externalId: 'x2' },
      ],
      'card',
      [],
      id,
    );
    expect(second.added.map((t) => t.externalId)).toEqual(['x2']);
  });

  test('other accounts don’t count as duplicates', () => {
    expect(
      mergeImport(
        existing,
        [{ date: '2026-09-22', merchant: 'Corner Market', amount: -8000 }],
        'sav',
        [],
        id,
      ).added,
    ).toHaveLength(1);
  });

  test('new transactions need a look; rules beat keyword guesses', () => {
    const r = mergeImport(
      [],
      [
        { date: '2026-09-22', merchant: 'CORNER MARKET #0412', amount: -8000 },
        { date: '2026-09-23', merchant: 'Litware', amount: -2000 },
      ],
      'chk',
      [{ merchant: 'litware', category: 'Software', tax: true, taxCategory: 'Software' }],
      id,
    );
    expect(r.added[0]).toMatchObject({
      reviewed: false,
      suggestedCategory: 'Groceries',
      tax: false,
    });
    expect(r.added[1]).toMatchObject({
      suggestedCategory: 'Software',
      tax: true,
      taxCategory: 'Software',
    });
  });
});

describe('tidy names', () => {
  test('all-caps bank names become title case; mixed case and codes are kept', () => {
    expect(tidyMerchant('RENT PAYMENT - CITY HOMES')).toBe('Rent Payment - City Homes');
    expect(tidyMerchant('CORNER MARKET #0412')).toBe('Corner Market #0412');
    expect(tidyMerchant('Green Bowl, Main St')).toBe('Green Bowl, Main St');
    expect(tidyMerchant('1234')).toBe('1234');
  });
});

describe('category guesses', () => {
  test('keywords; money in is only ever Income, a transfer, or a card payment', () => {
    expect(suggestCategory('FUEL STOP 118', -5000)).toBe('Gas');
    expect(suggestCategory('CITY GAS & ELECTRIC', -12000)).toBe('Bills');
    expect(suggestCategory('Green Bowl', -1500)).toBe('Dining');
    expect(suggestCategory('ONLINE TRANSFER TO SAVINGS', -100000)).toBe('Transfer');
    expect(suggestCategory('PAYMENT THANK YOU', 50000)).toBe('Card payment');
    expect(suggestCategory('ACME PAYROLL', 250000)).toBe('Income');
    expect(suggestCategory('Corner Market', 8000)).toBeUndefined(); // a refund isn't income
    expect(suggestCategory('Something', -100)).toBeUndefined();
  });
});

describe('expected income that arrived', () => {
  const invoice = { id: 'i1', source: 'Northwind Studio', amount: 500000, date: '2026-10-13' };
  const txn = (id: string, date: string, amount: number, accountId = 'sav'): Transaction => ({
    id,
    accountId,
    date,
    merchant: 'NORTHWIND',
    amount,
    tax: false,
    reviewed: false,
  });

  test('money in, within 10% of the amount, from 10 days early to 45 days late', () => {
    expect(matchIncome([invoice], [txn('t', '2026-10-05', 495000)])).toHaveLength(1);
    expect(matchIncome([invoice], [txn('t', '2026-10-02', 500000)])).toHaveLength(0); // too early
    expect(matchIncome([invoice], [txn('t', '2026-10-14', 300000)])).toHaveLength(0); // wrong amount
    expect(matchIncome([invoice], [txn('t', '2026-10-14', -500000)])).toHaveLength(0); // money out
    expect(
      matchIncome([{ ...invoice, received: true }], [txn('t', '2026-10-13', 500000)]),
    ).toHaveLength(0);
  });

  test('landing in savings marks it received and makes a deposit to split', () => {
    const data = { ...seed, expectedIncome: [invoice], pendingDeposit: undefined };
    const merge = mergeImport(
      data.transactions,
      [{ date: '2026-10-13', merchant: 'NORTHWIND STUDIO', amount: 500000 }],
      'sav',
      [],
      () => 'n1',
    );
    const r = applyImport(data, merge);
    expect(r.data.expectedIncome[0].received).toBe(true);
    expect(r.deposits).toEqual([
      {
        id: 'deposit-n1',
        date: '2026-10-13',
        amount: 500000,
        source: 'Northwind Studio',
        confirmed: false,
        inBalance: true,
      },
    ]);
    expect(r.data.pendingDeposit).toEqual(r.deposits[0]);
    expect(r.data.transactions.find((t) => t.id === 'n1')?.suggestedCategory).toBe('Income');
  });

  test('landing in checking marks it received without a split', () => {
    const data = { ...seed, expectedIncome: [invoice], pendingDeposit: undefined };
    const merge = mergeImport(
      data.transactions,
      [{ date: '2026-10-13', merchant: 'NORTHWIND', amount: 500000 }],
      'chk',
      [],
      () => 'n2',
    );
    const r = applyImport(data, merge);
    expect(r.received).toHaveLength(1);
    expect(r.deposits).toEqual([]);
  });

  test('a deposit still waiting to be split is never replaced; new ones queue behind it', () => {
    const waiting = {
      id: 'd-old',
      date: '2026-09-23',
      amount: 1000000,
      source: 'Northwind Studio',
      confirmed: false,
    };
    const second = { id: 'i2', source: 'Fabrikam Design', amount: 300000, date: '2026-10-20' };
    const data = { ...seed, expectedIncome: [invoice, second], pendingDeposit: waiting };
    const merge = mergeImport(
      data.transactions,
      [
        { date: '2026-10-13', merchant: 'NORTHWIND STUDIO', amount: 500000 },
        { date: '2026-10-20', merchant: 'FABRIKAM DESIGN', amount: 300000 },
      ],
      'sav',
      [],
      (() => {
        let k = 0;
        return () => `q${++k}`;
      })(),
    );
    const r = applyImport(data, merge);
    expect(r.deposits.map((d) => d.id)).toEqual(['deposit-q1', 'deposit-q2']);
    expect(r.data.pendingDeposit).toBe(waiting);
    expect(currentDeposit([{ ...waiting, confirmed: true }, ...r.deposits])?.id).toBe('deposit-q1');
    expect(currentDeposit([{ ...waiting, confirmed: true }])?.id).toBe('d-old');
  });
});

describe('bills', () => {
  const rent: Bill = {
    id: 'rent',
    name: 'Rent',
    amount: 160000,
    due: '2026-09-01',
    cadence: 'monthly',
    confirmed: true,
    payFrom: 'checking',
  };

  test('a passed due date rolls to the next one; future ones stay', () => {
    expect(rollBills([rent], '2026-09-25')[0].due).toBe('2026-10-01');
    expect(
      rollBills([{ ...rent, due: '2026-09-20', cadence: 'weekly' }], '2026-09-25')[0].due,
    ).toBe('2026-09-27');
    const later = { ...rent, due: '2026-10-01' };
    expect(rollBills([later], '2026-09-25')[0]).toBe(later);
  });

  test('repeated payments from checking become proposals; card charges and known bills don’t', () => {
    const pay = (
      id: string,
      date: string,
      accountId = 'chk',
      merchant = 'CITY HOMES RENT',
    ): Transaction => ({
      id,
      accountId,
      date,
      merchant,
      amount: -160000,
      tax: false,
      reviewed: true,
    });
    const data = {
      ...seed,
      today: '2026-09-25',
      bills: [],
      transactions: [
        pay('1', '2026-07-01'),
        pay('2', '2026-08-01'),
        pay('3', '2026-09-01'),
        pay('4', '2026-07-03', 'card', 'STREAMING'),
        pay('5', '2026-08-03', 'card', 'STREAMING'),
        pay('6', '2026-09-03', 'card', 'STREAMING'),
      ],
    };
    const proposed = proposeBills(data);
    expect(proposed).toEqual([
      {
        id: 'bill-city-homes-rent',
        name: 'CITY HOMES RENT',
        amount: 160000,
        due: '2026-10-01',
        cadence: 'monthly',
        confirmed: false,
        payFrom: 'checking',
      },
    ]);
    expect(proposeBills({ ...data, bills: [{ ...proposed[0], dismissed: true }] })).toEqual([]);
    expect(proposedBills([{ ...proposed[0], dismissed: true }, proposed[0], rent])).toEqual([
      proposed[0],
    ]);
  });
});

describe('reminders to schedule', () => {
  const prefs = {
    weekly: { weekday: 0, hour: 10, minute: 0 },
    cardStatements: true,
    quarterlyTaxes: true,
    deposits: true,
  };
  const now = { date: '2026-09-23', hour: 8, minute: 0 };

  test('the seed: weekly review, the card statement 2 days early, the invoice the morning after', () => {
    const plan = planReminders(seed, prefs, true, now);
    expect(plan.map((p) => p.id)).toEqual([
      'weekly-review',
      'statement-card',
      'quarterly-2027-01-15',
      'late-i1',
    ]);
    expect(plan[1]).toEqual({
      id: 'statement-card',
      title: 'Contoso Card statement',
      body: 'Contoso Card statement ($500) is due Monday. You’re covered.',
      url: '/',
      at: { date: '2026-09-26', hour: 9, minute: 0 },
    });
    expect(plan[2].at).toEqual({ date: '2027-01-08', hour: 9, minute: 0 });
    expect(plan[3].at?.date).toBe('2026-10-14');
  });

  test('amounts hidden on the lock screen: no dollar amounts in any reminder', () => {
    const plan = planReminders(seed, prefs, false, now);
    expect(plan.every((p) => !p.body.includes('$'))).toBe(true);
  });

  test('turned off, past, or salary: only what applies', () => {
    expect(
      planReminders(
        seed,
        { weekly: null, cardStatements: false, quarterlyTaxes: false, deposits: false },
        true,
        now,
      ),
    ).toEqual([]);
    // After 9 AM on the reminder day, it's too late to schedule it.
    expect(
      planReminders(seed, prefs, true, { date: '2026-09-26', hour: 10, minute: 0 }).some(
        (p) => p.id === 'statement-card',
      ),
    ).toBe(false);
    const salary = {
      ...seed,
      expectedIncome: [],
      settings: {
        ...seed.settings,
        incomeType: 'salary' as const,
        modules: { ...seed.settings.modules, tax: false },
        paySchedule: { amount: 250000, cadence: 'biweekly' as const, next: '2026-10-05' },
      },
    };
    const plan = planReminders(salary, prefs, true, now);
    expect(plan.map((p) => p.id)).toEqual(['weekly-review', 'statement-card', 'payday-2026-10-05']);
  });
});

describe('reading a bank file', () => {
  test('OFX is recognised and read as-is', () => {
    const file = readBankFile(fixture('contoso-card.ofx'), {});
    expect(file.kind).toBe('ofx');
    expect(fileTransactions(file, null)).toHaveLength(3);
  });

  test('CSV: guessed mapping, the newest balance, and a remembered mapping wins', () => {
    const file = readBankFile(fixture('woodgrove-checking.csv'), {});
    if (file.kind !== 'csv') throw new Error('expected CSV');
    expect(file.remembered).toBe(false);
    expect(csvBalance(file, file.mapping!)).toEqual({ amount: 430500, date: '2026-09-25' }); // oldest-first: the last row
    const flipped = { ...file.mapping!, outflowPositive: true };
    const again = readBankFile(fixture('woodgrove-checking.csv'), { [file.key]: flipped });
    expect(again.kind === 'csv' && again.remembered && again.mapping).toEqual(flipped);
  });

  test('newest-first CSV takes the first row’s balance', () => {
    const file = readBankFile(
      'Date,Description,Amount,Balance\n09/25/2026,B,-5.00,95.00\n09/24/2026,A,-10.00,100.00',
      {},
    );
    expect(file.kind === 'csv' && csvBalance(file, file.mapping!)).toEqual({
      amount: 9500,
      date: '2026-09-25',
    });
  });

  test('not a bank file, or nothing in it', () => {
    expect(readBankFile('hello\nworld', {}).kind).toBe('unreadable');
    expect(readBankFile('', {}).kind).toBe('empty');
    expect(readBankFile('Date,Description,Amount', {}).kind).toBe('empty');
  });
});
