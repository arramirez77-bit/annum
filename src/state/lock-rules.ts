/** When the Face ID lock comes back (docs/02 "Lock"). Pure, so the timing is unit-tested. */

/** Lock again after this long in the background. */
export const LOCK_AFTER_MS = 5 * 60 * 1000;

/** Measured from the moment the app went to the background, not with a timer. */
export function shouldRelock(
  lockEnabled: boolean,
  backgroundedAt: number | null,
  now: number,
  after: number = LOCK_AFTER_MS,
): boolean {
  return lockEnabled && backgroundedAt !== null && now - backgroundedAt >= after;
}

let relockAfter = LOCK_AFTER_MS;

/** The wait in use: 5 minutes, unless a development build shortened it for a test. */
export const relockAfterMs = (): number => relockAfter;

/** Development builds only (Scenarios screen): lock after a few seconds, to test re-locking. */
export function setRelockAfterForTesting(ms: number): void {
  if (__DEV__) relockAfter = ms;
}
