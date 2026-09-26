/**
 * OFX / QFX bank downloads (S11). Handles both OFX 1.x (SGML: leaf tags aren't closed) and
 * OFX 2.x (XML). Only what Annum needs: the account, its balance, and transactions.
 */
import type { ImportedTransaction } from './csv';
import type { Account, Cents, ISODate } from './types';

export interface OfxStatement {
  /** checking / savings / card, from ACCTTYPE or a credit-card statement. */
  type: Account['type'];
  /** Last 4 of the account number, to recognise the same account next time. */
  last4: string;
  /** Checking/savings: the balance. Cards: the amount owed (positive). */
  balance?: Cents;
  balanceDate?: ISODate;
  transactions: ImportedTransaction[];
}

const tag = (block: string, name: string): string | undefined => {
  const m = new RegExp(`<${name}>([^<\\r\\n]*)`, 'i').exec(block);
  return m ? m[1].trim() : undefined;
};

const blocks = (text: string, name: string): string[] => {
  const out: string[] = [];
  const re = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, 'gi');
  for (let m = re.exec(text); m; m = re.exec(text)) out.push(m[1]);
  return out;
};

/** OFX dates: YYYYMMDD[HHMMSS[.XXX]][[+-]TZ] → the calendar date as written. */
export const ofxDate = (value: string | undefined): ISODate | undefined =>
  value && /^\d{8}/.test(value)
    ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`
    : undefined;

/** "-80.00", "1,234.5", "80" → cents. */
export const ofxAmount = (value: string | undefined): Cents | undefined => {
  if (!value) return undefined;
  const t = value.replace(/,/g, '').trim();
  if (!/^[-+]?\d+(\.\d+)?$/.test(t)) return undefined;
  return Math.round(Number(t) * 100);
};

const TYPES: Record<string, Account['type']> = {
  CHECKING: 'checking',
  SAVINGS: 'savings',
  MONEYMRKT: 'savings',
  CREDITLINE: 'card',
};

export function isOfx(text: string): boolean {
  return /<OFX>/i.test(text) || /^\s*OFXHEADER:/i.test(text);
}

/** Every statement in the file (usually one). */
export function parseOfx(text: string): OfxStatement[] {
  const bank = blocks(text, 'STMTRS').map((b) => ({ b, card: false }));
  const card = blocks(text, 'CCSTMTRS').map((b) => ({ b, card: true }));
  return [...bank, ...card].map(({ b, card: isCard }) => {
    const from = blocks(b, isCard ? 'CCACCTFROM' : 'BANKACCTFROM')[0] ?? b;
    const acctId = tag(from, 'ACCTID') ?? '';
    const type: Account['type'] = isCard
      ? 'card'
      : (TYPES[(tag(from, 'ACCTTYPE') ?? '').toUpperCase()] ?? 'checking');
    const ledger = blocks(b, 'LEDGERBAL')[0];
    const amount = ofxAmount(ledger ? tag(ledger, 'BALAMT') : undefined);
    const transactions: ImportedTransaction[] = [];
    for (const t of blocks(b, 'STMTTRN')) {
      const date = ofxDate(tag(t, 'DTPOSTED'));
      const cents = ofxAmount(tag(t, 'TRNAMT'));
      const payee = blocks(t, 'PAYEE')[0];
      const merchant = (
        tag(t, 'NAME') ??
        (payee ? tag(payee, 'NAME') : undefined) ??
        tag(t, 'MEMO') ??
        ''
      )
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
        .trim();
      if (!date || cents === undefined || !merchant) continue;
      const fitId = tag(t, 'FITID');
      transactions.push({ date, merchant, amount: cents, ...(fitId ? { externalId: fitId } : {}) });
    }
    return {
      type,
      last4: acctId.replace(/\D/g, '').slice(-4),
      // Card balances are negative when money is owed; Annum stores what's owed as positive.
      ...(amount !== undefined ? { balance: isCard ? Math.max(-amount, 0) : amount } : {}),
      ...(ledger && ofxDate(tag(ledger, 'DTASOF'))
        ? { balanceDate: ofxDate(tag(ledger, 'DTASOF')) }
        : {}),
      transactions,
    };
  });
}
