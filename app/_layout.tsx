import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { color } from '@/theme';

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
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeProvider>
  );
}
