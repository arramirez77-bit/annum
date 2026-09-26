/**
 * First-guess categories for imported transactions, from words in the merchant name. A rule
 * the user set (categorize.ts) always wins over these; these only fill the gaps.
 */
import type { Cents } from './types';

const KEYWORDS: [RegExp, string][] = [
  [/\b(transfer|xfer|to savings|from savings|to checking|from checking|zelle to)\b/, 'Transfer'],
  [/\b(payment thank you|autopay|card payment|credit card pmt|payment - thank)\b/, 'Card payment'],
  [/\b(payroll|direct dep|salary|invoice|deposit from)\b/, 'Income'],
  // Bills before Gas: "Gas & Electric" is a utility bill, not fuel.
  [
    /\b(rent|mortgage|electric|utility|utilities|water|internet|phone|insurance|wireless)\b/,
    'Bills',
  ],
  [/\b(market|grocer|grocery|foods?|supermarket|trader|whole foods|safeway|kroger)\b/, 'Groceries'],
  [/\b(fuel|gas|shell|chevron|exxon|mobil|arco|texaco|valero)\b/, 'Gas'],
  [
    /\b(cafe|coffee|restaurant|bistro|grill|pizza|taco|burger|bowl|kitchen|bar|diner|sushi)\b/,
    'Dining',
  ],
  [
    /\b(software|app store|apple\.com|google|adobe|figma|github|litware|subscription|cloud)\b/,
    'Software',
  ],
  [/\b(airline|airlines|air|hotel|airbnb|uber|lyft|taxi|rail|parking)\b/, 'Travel'],
  [/\b(pharmacy|clinic|dental|doctor|health|medical)\b/, 'Health'],
  [/\b(amazon|target|walmart|store|shop|mall)\b/, 'Shopping'],
];

/** A category guess, or undefined. Money in with no clue is left for the review. */
export function suggestCategory(merchant: string, amount: Cents): string | undefined {
  const m = merchant.toLowerCase();
  for (const [pattern, category] of KEYWORDS) {
    if (!pattern.test(m)) continue;
    // Money in can only be Income, a transfer, or a card payment; money out can't be Income.
    if (amount > 0 && !['Income', 'Transfer', 'Card payment'].includes(category)) continue;
    if (amount < 0 && category === 'Income') continue;
    return category;
  }
  return undefined;
}
