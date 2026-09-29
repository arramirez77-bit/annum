import { useSegments } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { color, symbols } from '@/theme';

/**
 * Screens drawn without the tab bar (Figma 04–08, S2, S9): the Weekly Review is one flow, and
 * Taxes and a transaction's detail have their own actions. The tab roots and S1 keep it.
 */
const NO_TAB_BAR = new Set(['review/[step]', 'money/taxes', 'money/transaction/[id]']);

// Native iOS tab bar (Liquid Glass on iOS 26+). SDK 57 import path; SDK 58 moves it to 'expo-router/native-tabs'.
export default function TabsLayout() {
  const segments = useSegments();
  const hidden = NO_TAB_BAR.has(segments.slice(1).join('/'));
  return (
    <NativeTabs tintColor={color.textPrimary} hidden={hidden}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon
          sf={{ default: symbols.tabToday, selected: symbols.tabTodaySelected }}
        />
        <NativeTabs.Trigger.Label>Today</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="review">
        <NativeTabs.Trigger.Icon sf={symbols.tabReview} />
        <NativeTabs.Trigger.Label>Review</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="money">
        <NativeTabs.Trigger.Icon
          sf={{ default: symbols.tabMoney, selected: symbols.tabMoneySelected }}
        />
        <NativeTabs.Trigger.Label>Money</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
