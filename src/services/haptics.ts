/**
 * Haptics (docs/04): light impact on confirmations, selection on chips/segments.
 * Never on heads-up states — there is deliberately no "warning" haptic here.
 */
import * as Haptics from 'expo-haptics';

import { haptics as tokens } from '@/theme';

type HapticName = keyof typeof tokens;

const play: Record<(typeof tokens)[HapticName], () => Promise<void>> = {
  impactLight: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  selection: () => Haptics.selectionAsync(),
};

/** Fire and forget: a haptic that fails (e.g. Simulator) must never break a tap. */
export function haptic(name: HapticName): void {
  play[tokens[name]]().catch(() => undefined);
}
