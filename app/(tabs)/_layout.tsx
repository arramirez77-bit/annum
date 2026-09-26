import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { color, symbols } from '@/theme';

// Native iOS tab bar (Liquid Glass on iOS 26+). SDK 57 import path; SDK 58 moves it to 'expo-router/native-tabs'.
export default function TabsLayout() {
  return (
    <NativeTabs tintColor={color.textPrimary}>
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
