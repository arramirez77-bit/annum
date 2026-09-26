import { Stack } from 'expo-router';

import { flowHeader, pushedHeader } from '@/ui/navigation';

export const unstable_settings = { initialRouteName: 'welcome' };

// First run: O1 → O2 → O3 → O4 → O4b → O4c → Today (estimate). docs/05 "Onboarding".
export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ ...flowHeader, title: '' }}>
      <Stack.Screen name="welcome" options={{ headerShown: false }} />
      <Stack.Screen name="privacy" options={pushedHeader('Your data', 'Welcome')} />
      <Stack.Screen name="restore" options={pushedHeader('Restore from a backup', 'Welcome')} />
    </Stack>
  );
}
