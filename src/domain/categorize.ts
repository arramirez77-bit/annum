/**
 * Categorization rules. A rule maps a merchant to a category (and optionally a tax tag).
 * Corrections in the weekly review write rules; rules pre-select suggestions next time.
 */
import type { Transaction } from './types';

export interface CategoryRule {
  /** Normalized merchant (see normalizeMerchant). */
  merchant: string;
  category: string;
  tax?: boolean;
  taxCategory?: string;
}

/**
 * Lowercase, drop store numbers and reference codes, punctuation, and legal suffixes,
 * so "CORNER MARKET #0412" and "Corner Market" are the same merchant.
 */
export function normalizeMerchant(name: string): string {
  return name
    .toLowerCase()
    .replace(/[#*]\s*\w*\d\w*/g, ' ')
    .replace(/\b\d{3,}\b/g, ' ')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(inc|llc|ltd|co|corp)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The rule for a merchant: exact match first, then the longest rule that prefixes it. */
export function findRule(
  merchant: string,
  rules: readonly CategoryRule[],
): CategoryRule | undefined {
  const m = normalizeMerchant(merchant);
  const exact = rules.find((r) => r.merchant === m);
  if (exact) return exact;
  return rules
    .filter((r) => r.merchant.length > 0 && m.startsWith(`${r.merchant} `))
    .sort((a, b) => b.merchant.length - a.merchant.length)[0];
}

/** Fill suggestions on unreviewed, uncategorized transactions. Reviewed ones are never touched. */
export function applyRules(
  transactions: readonly Transaction[],
  rules: readonly CategoryRule[],
): Transaction[] {
  return transactions.map((t) => {
    if (t.reviewed || t.category) return t;
    const rule = findRule(t.merchant, rules);
    if (!rule) return t;
    return {
      ...t,
      suggestedCategory: rule.category,
      tax: rule.tax ?? t.tax,
      taxCategory: rule.tax ? (rule.taxCategory ?? t.taxCategory) : t.taxCategory,
    };
  });
}

/** Add or replace the rule for this merchant (latest correction wins). */
export function upsertRule(rules: readonly CategoryRule[], rule: CategoryRule): CategoryRule[] {
  return [...rules.filter((r) => r.merchant !== rule.merchant), rule];
}

/** The rule a correction writes: "Always treat {merchant} this way". */
export function ruleFromCorrection(
  t: Transaction,
  category: string,
  tax: boolean,
  taxCategory?: string,
): CategoryRule {
  return {
    merchant: normalizeMerchant(t.merchant),
    category,
    tax,
    taxCategory: tax ? taxCategory : undefined,
  };
}

/** Spending categories offered on S9 (a transaction's own suggestion is always offered too). */
export const CATEGORIES = [
  'Groceries',
  'Dining',
  'Gas',
  'Shopping',
  'Software',
  'Bills',
  'Travel',
  'Health',
  'Other',
] as const;

/** Work-expense groups on S9 and S2, in plain words. */
export const TAX_CATEGORIES = [
  'Equipment',
  'Software',
  'Home office',
  'Travel',
  'Meals',
  'Other',
] as const;
