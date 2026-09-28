/**
 * The access key from a QR code (`annum://pair?key=…`), held in memory between the link
 * arriving and the Pair screen saving it to the Keychain. It never goes into a route, so it
 * never lands in navigation history.
 */
let waiting: string | null = null;
const listeners = new Set<() => void>();

/** Links from outside: take the key out of a pairing link; true if it was one. */
export function takeKeyFromLink(url: string): boolean {
  const m = /^(?:annum:\/\/|\/)pair(?:\/)?\?(.*)$/.exec(url);
  if (!m) return false;
  waiting = new URLSearchParams(m[1]).get('key');
  for (const listener of listeners) listener();
  return true;
}

/**
 * The Pair screen listens while it's open: a code scanned then arrives on the screen that's
 * already showing (navigating to it again doesn't open a new one). Returns "stop listening".
 */
export function onKeyWaiting(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The Pair screen takes the key once. */
export function takeWaitingKey(): string | null {
  const key = waiting;
  waiting = null;
  return key;
}
