/**
 * The access key from a QR code (`annum://pair?key=…`), held in memory between the link
 * arriving and the Pair screen saving it to the Keychain. It never goes into a route, so it
 * never lands in navigation history.
 */
let waiting: string | null = null;

/** Links from outside: take the key out of a pairing link; true if it was one. */
export function takeKeyFromLink(url: string): boolean {
  const m = /^(?:annum:\/\/|\/)pair(?:\/)?\?(.*)$/.exec(url);
  if (!m) return false;
  waiting = new URLSearchParams(m[1]).get('key');
  return true;
}

/** The Pair screen takes the key once. */
export function takeWaitingKey(): string | null {
  const key = waiting;
  waiting = null;
  return key;
}
