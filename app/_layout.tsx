import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { color } from '@/theme';
import { formSheet, modalScreen } from '@/ui/navigation';

// Dark only (v1). Navigation chrome uses theme tokens so there is never a white flash.
const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: color.textPrimary,
    background: color.bgBase,
    card: color.bgSurface,
    text: color.textPrimary,
    border: color.borderSubtle,
    notification: color.statusHeadsUp,
  },
};

export default function RootLayout() {
  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="what-if" options={modalScreen} />
        <Stack.Screen name="deposit/[id]/index" options={formSheet([1])} />
        <Stack.Screen name="deposit/[id]/setup" options={formSheet([1])} />
      </Stack>
    </ThemeProvider>
  );
}
