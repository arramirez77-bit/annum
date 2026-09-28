import { takeKeyFromLink } from '@/state/pairing';

/**
 * Links from outside Annum:
 * - A bank file opened with "Open in Annum" (Files, Mail) arrives as a file:// URL → S11 Import.
 * - A pairing QR code (`annum://pair?key=…`) → Pair this phone; the key is taken out here so it
 *   never becomes part of a route.
 * - Plaid's OAuth return (https://annum.…workers.dev/plaid/oauth…) belongs to Plaid Link, which
 *   is already open: go nowhere.
 * Everything else (annum://review/1, …) goes where it points.
 */
export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }) {
  if (path.startsWith('file://')) return `/import?file=${encodeURIComponent(path)}`;
  if (takeKeyFromLink(path)) return '/pair';
  if (/\/plaid\/oauth/.test(path)) return initial ? '/' : null;
  return path;
}
