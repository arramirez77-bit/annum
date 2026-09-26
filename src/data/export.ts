/**
 * Exports for the accountant (S2): CSV and PDF through the iOS share sheet.
 * Files go to the app's cache folder; "Delete everything" (M5) clears it.
 * Load with a dynamic import so older development builds don't need these native modules at startup.
 */
import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { taxCsv, type AppData } from '@/domain';

import { taxReportHtml } from './export-html';

export async function shareTaxCsv(data: AppData, year: number): Promise<void> {
  const file = new File(Paths.cache, `annum-work-expenses-${year}.csv`);
  file.create({ overwrite: true });
  file.write(taxCsv(data, year));
  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/csv',
    UTI: 'public.comma-separated-values-text',
    dialogTitle: 'Export for my accountant',
  });
}

export async function shareTaxPdf(data: AppData, year: number): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html: taxReportHtml(data, year) });
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: 'Export as PDF',
  });
}
