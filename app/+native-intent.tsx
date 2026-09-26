/**
 * Links from outside Annum. A bank file opened with "Open in Annum" (Files, Mail) arrives as a
 * file:// URL; send it to S11 Import. Everything else (annum://review/1, …) goes where it points.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  if (path.startsWith('file://')) return `/import?file=${encodeURIComponent(path)}`;
  return path;
}
