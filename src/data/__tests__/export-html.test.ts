import { demoSeed } from '@/data/demo';

import { taxReportHtml } from '../export-html';

describe('PDF summary', () => {
  const html = taxReportHtml(demoSeed(), 2026);

  test('totals, categories and the tagged transactions', () => {
    expect(html).toContain('<h1>Work expenses · 2026</h1>');
    expect(html).toContain('$3,800 tagged across 21 items. Tax reserve set aside: $3,000.');
    expect(html).toContain('<td>Equipment</td><td class="n">3</td><td class="n">$2,000</td>');
    expect(html).toContain(
      '<td>Litware</td><td>Software</td><td>Contoso Card</td><td class="n">$20.00</td>',
    );
  });

  test('escapes merchant names', () => {
    const data = demoSeed();
    data.transactions[0] = { ...data.transactions[0], merchant: '<b>Tools & Co</b>' };
    expect(taxReportHtml(data, 2026)).toContain('&lt;b&gt;Tools &amp; Co&lt;/b&gt;');
  });

  test('no colors in the printed document', () => {
    expect(html).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
  });
});
