/**
 * S11: choose a bank file (Files, iCloud Drive, Mail attachments) and read its text. Nothing is
 * kept: the picker's copy lives in the cache, which Delete everything clears.
 */
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';

export interface PickedFile {
  uri: string;
  name: string;
}

export async function pickBankFile(): Promise<PickedFile | null> {
  const picked = await DocumentPicker.getDocumentAsync({
    // CSV, plain text, and anything else (OFX/QFX have no standard iOS type).
    type: ['public.comma-separated-values-text', 'public.plain-text', 'public.data'],
    copyToCacheDirectory: true,
  });
  if (picked.canceled) return null;
  return { uri: picked.assets[0].uri, name: picked.assets[0].name };
}

/**
 * Read the file. Files opened with "Open in Annum" are copied into Annum's Inbox by iOS; that
 * copy is removed once read, so bank downloads don't pile up on the phone.
 */
export async function readFileText(uri: string): Promise<string> {
  const file = new File(uri);
  const text = await file.text();
  if (uri.includes('/Inbox/') && file.exists) file.delete();
  return text;
}

/** The file name from a URI ("…/Inbox/Checking%20Sep.csv" → "Checking Sep.csv"). */
export const fileName = (uri: string): string => decodeURIComponent(uri.split('/').pop() ?? 'file');
