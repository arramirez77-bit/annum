import { Stack } from 'expo-router';

import { flowHeader } from '@/ui/navigation';

// Weekly Review stack: Back · StepIndicator · Finish later (set per step). docs/05.
export default function ReviewLayout() {
  return (
    <Stack screenOptions={flowHeader}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}
