/**
 * Plaid Link (react-native-plaid-link-sdk v13), behind one promise so the connect flow can be
 * tested without the native sheet. Plaid's own sheet runs the bank sign-in; Annum never sees
 * the person's bank password.
 */
import { createPlaidLinkSession } from 'react-native-plaid-link-sdk';

export type LinkResult =
  | { kind: 'success'; publicToken: string; institution: string }
  /** Closed or failed: `errorCode` is Plaid's, when there was an error. */
  | { kind: 'exit'; errorCode?: string };

export function openPlaidLink(token: string): Promise<LinkResult> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (r: LinkResult) => {
      if (settled) return;
      settled = true;
      resolve(r);
    };
    createPlaidLinkSession({
      token,
      onSuccess: (s) =>
        done({
          kind: 'success',
          publicToken: s.publicToken,
          institution: s.metadata.institution?.name ?? 'Your bank',
        }),
      onExit: (e) => done({ kind: 'exit', ...(e.error ? { errorCode: e.error.errorCode } : {}) }),
      onEvent: () => undefined,
    })
      .then((session) => session.open())
      .catch(() => done({ kind: 'exit', errorCode: 'LINK_DID_NOT_OPEN' }));
  });
}
