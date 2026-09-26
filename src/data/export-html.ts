/** The PDF summary for the accountant (S2 "Export as PDF"). Pure: returns HTML for expo-print. */
import {
  formatCents,
  formatDollars,
  formatShortDate,
  taxCategoryOf,
  taxSummary,
  type AppData,
} from '@/domain';

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Plain, printable HTML (system font, black on white — no app colors in a printed document). */
export function taxReportHtml(data: AppData, year: number): string {
  const summary = taxSummary(data);
  const accounts = new Map(data.accounts.map((a) => [a.id, a.name]));
  const categories = summary.categories
    .map(
      (c) =>
        `<tr><td>${escape(c.name)}</td><td class="n">${c.items}</td><td class="n">${escape(formatDollars(c.total))}</td></tr>`,
    )
    .join('');
  const items = data.transactions
    .filter((t) => t.tax && t.date.startsWith(String(year)))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(
      (t) =>
        `<tr><td>${escape(formatShortDate(t.date))}</td><td>${escape(t.merchant)}</td><td>${escape(taxCategoryOf(t))}</td><td>${escape(accounts.get(t.accountId) ?? '')}</td><td class="n">${escape(formatCents(Math.abs(t.amount)))}</td></tr>`,
    )
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
body{font-family:-apple-system,system-ui,sans-serif;margin:40px;}
h1{font-size:22px;margin:0 0 4px}p{margin:4px 0 16px}
table{border-collapse:collapse;width:100%;margin:8px 0 24px}
td,th{text-align:left;padding:6px 8px;border-bottom:1px solid;font-size:12px}
.n{text-align:right;font-variant-numeric:tabular-nums}
</style></head><body>
<h1>Work expenses · ${year}</h1>
<p>${escape(`${formatDollars(summary.total)} tagged across ${summary.items} items. Tax reserve set aside: ${formatDollars(data.buckets.tax)}.`)}</p>
<table><tr><th>Category</th><th class="n">Items</th><th class="n">Total</th></tr>${categories}</table>
${items ? `<h1>Tagged transactions</h1><table><tr><th>Date</th><th>Merchant</th><th>Category</th><th>Account</th><th class="n">Amount</th></tr>${items}</table>` : ''}
<p>Prepared with Annum on ${escape(formatShortDate(data.today))}.</p>
</body></html>`;
}
