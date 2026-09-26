/**
 * TopBar and Sheet (docs/04) use the native header and native sheets, so iOS supplies
 * the metrics, back chevron, and Liquid Glass. These presets keep them on theme.
 * Use as Expo Router <Stack.Screen options={...} />.
 */
import { color, radius } from '@/theme';

const base = {
  headerTintColor: color.textPrimary,
  headerStyle: { backgroundColor: color.bgBase },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: color.bgBase },
} as const;

/** Pushed screen: back chevron + parent title ("‹ Money"). */
export const pushedHeader = (title: string, parentTitle: string) =>
  ({
    ...base,
    headerShown: true,
    title,
    headerBackTitle: parentTitle,
  }) as const;

/** Flow step (Weekly Review): Back · StepIndicator · Finish later — title and right set per step. */
export const flowHeader = {
  ...base,
  headerShown: true,
  headerBackTitle: 'Back',
  headerBackButtonDisplayMode: 'minimal',
} as const;

/** Modal: "Cancel" on the left, set per screen via headerLeft. */
export const modalScreen = {
  ...base,
  presentation: 'modal',
  headerShown: true,
} as const;

/** Native form sheet with a grabber and detents; content sits on the surface color over dimmed bgDeep. */
export const formSheet = (detents: number[] | 'fitToContents' = [0.6, 1]) =>
  ({
    presentation: 'formSheet',
    headerShown: false,
    sheetGrabberVisible: true,
    sheetAllowedDetents: detents,
    sheetCornerRadius: radius.sheet,
    contentStyle: { backgroundColor: color.bgSurface },
  }) as const;
