/**
 * M7 spike: does Plaid's React Native SDK (v13, Expo Modules) load and answer from native code
 * on Expo 57 / iOS 27? Starts a Link session with a made-up token: a native exit with an
 * "invalid token" error proves the JS ↔ native round trip without a Worker or a Plaid account.
 */
import { createPlaidLinkSession, sdkVersion } from 'react-native-plaid-link-sdk';

import type { SpikeStep } from './sqlcipher';

export async function runPlaidSpike(): Promise<SpikeStep[]> {
  const steps: SpikeStep[] = [
    { name: 'SDK loaded', detail: `react-native-plaid-link-sdk ${sdkVersion}`, pass: !!sdkVersion },
  ];
  const exit = await new Promise<string>((resolve) => {
    const timer = setTimeout(() => resolve('no answer in 20 s'), 20_000);
    const done = (why: string) => {
      clearTimeout(timer);
      resolve(why);
    };
    createPlaidLinkSession({
      token: 'link-sandbox-00000000-0000-0000-0000-000000000000',
      onSuccess: () => done('success (unexpected)'),
      onExit: (e) => done(`exit: ${e.error?.errorCode ?? 'no error'}`),
      onEvent: () => undefined,
    })
      .then((session) => session.open())
      .catch((e: unknown) => done(`threw: ${e instanceof Error ? e.message : String(e)}`));
  });
  steps.push({
    name: 'Native answer to a made-up token',
    detail: exit,
    pass: exit.startsWith('exit'),
  });
  return steps;
}
