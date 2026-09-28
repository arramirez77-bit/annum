import { DarkTheme, Stack, ThemeProvider, useNavigationContainerRef } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { setPrivacyCoverColor } from '../modules/privacy-cover';
import { configureNotifications } from '@/services/notifications';
import { startBankSync } from '@/state/bank';
import {
  boot,
  startAutosave,
  startLifecycle,
  startReminderLinks,
  startReminders,
  watchNavigation,
} from '@/state/session';
import { useAppStore } from '@/state/store';
import { color } from '@/theme';
import { Gate } from '@/ui/flows/Gate';
import { formSheet, modalScreen, pushedHeader } from '@/ui/navigation';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);
configureNotifications();

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

/**
 * Root: decides the first screen (onboarding, the Face ID lock, or the app), saves every change
 * to the encrypted database, and covers the app in the App Switcher. docs/02, docs/05.
 */
export default function RootLayout() {
  const phase = useAppStore((s) => s.phase);
  const navigation = useNavigationContainerRef();

  useEffect(() => {
    watchNavigation(() => (navigation.isReady() ? navigation.getRootState() : undefined));
  }, [navigation]);

  useEffect(() => {
    setPrivacyCoverColor(color.bgBase);
    const stops = [
      startAutosave(),
      startLifecycle(),
      startReminders(),
      startReminderLinks(),
      startBankSync(),
    ];
    void boot();
    return () => stops.forEach((stop) => stop());
  }, []);

  useEffect(() => {
    if (phase !== 'booting') SplashScreen.hide();
  }, [phase]);

  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={phase !== 'onboarding'}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="what-if" options={modalScreen} />
          <Stack.Screen name="deposit/[id]/index" options={formSheet([1])} />
          <Stack.Screen name="deposit/[id]/setup" options={formSheet('fitToContents')} />
          <Stack.Screen name="income/new" options={modalScreen} />
          <Stack.Screen name="settings/index" options={pushedHeader('Settings', 'Today')} />
          <Stack.Screen name="settings/number/[key]" options={formSheet([0.6, 1])} />
          <Stack.Screen name="settings/reminders" options={pushedHeader('Reminders', 'Settings')} />
          <Stack.Screen name="settings/export" options={formSheet([0.7, 1])} />
          <Stack.Screen
            name="settings/import"
            options={pushedHeader('Import backup', 'Settings')}
          />
          <Stack.Screen name="settings/delete" options={modalScreen} />
          <Stack.Screen name="bills" options={pushedHeader('Bills', 'Back')} />
          <Stack.Screen name="bill/[id]" options={formSheet([0.8, 1])} />
          <Stack.Screen name="transaction/new" options={modalScreen} />
        </Stack.Protected>
        <Stack.Protected guard={phase === 'onboarding'}>
          <Stack.Screen name="(onboarding)" />
        </Stack.Protected>
        <Stack.Screen name="account/[id]/balance" options={formSheet('fitToContents')} />
        <Stack.Screen name="import" options={pushedHeader('Import a file', 'Back')} />
        <Stack.Screen name="bank/connect" options={formSheet([0.7, 1])} />
        <Stack.Screen name="pair" options={modalScreen} />
      </Stack>
      <Gate />
    </ThemeProvider>
  );
}
