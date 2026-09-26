import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { lockCapability, authenticate, type LockCapability } from '@/services/lock';
import { askForReminders } from '@/services/notifications';
import { setLock } from '@/state/session';
import { buildSettingsView } from '@/state/settings-views';
import { useAppStore } from '@/state/store';
import { space } from '@/theme';
import {
  GuardrailNote,
  LedgerRow,
  ScreenScroll,
  SettingsGroup,
  SettingsRow,
  Text,
} from '@/ui/components';

const LOCK_NAME: Record<LockCapability, string> = {
  'face-id': 'Face ID lock',
  'touch-id': 'Touch ID lock',
  passcode: 'Passcode lock',
  none: 'Face ID lock',
};

// S3 Settings (pushed from Today). Modules · Your numbers · Accounts · Reminders · Privacy. docs/05.
export default function SettingsScreen() {
  const data = useAppStore((s) => s.data);
  const prefs = useAppStore((s) => s.prefs);
  const mode = useAppStore((s) => s.mode);
  const lockEnabled = useAppStore((s) => s.lockEnabled);
  const setModules = useAppStore((s) => s.setModules);
  const setPrefs = useAppStore((s) => s.setPrefs);
  const [capability, setCapability] = useState<LockCapability>('face-id');
  const [note, setNote] = useState<string | null>(null);
  const v = buildSettingsView(data, prefs);
  useEffect(() => {
    void lockCapability().then(setCapability);
  }, []);

  const toggleLock = async (on: boolean) => {
    setNote(null);
    if (capability === 'none') {
      setNote('Set up Face ID or a passcode in iOS Settings first, then turn this on.');
      return;
    }
    // Turning the lock on or off both need the owner.
    let result = await authenticate(capability === 'passcode');
    if (result === 'use-passcode') result = await authenticate(true);
    if (result === 'unlocked') await setLock(on);
  };

  const reminder = async (change: Partial<typeof prefs.reminders>) => {
    const turningOn = Object.values(change).some(Boolean);
    if (turningOn && !(await askForReminders())) {
      setNote('Reminders are off for Annum in iOS Settings → Notifications.');
      return;
    }
    setPrefs({ reminders: { ...prefs.reminders, ...change } });
  };

  const number = (key: 'tax' | 'runway' | 'habit' | 'spend' | 'pay') =>
    router.push({ pathname: '/settings/number/[key]', params: { key } });

  return (
    <ScreenScroll testID="settings" gap={space[24]}>
      {mode === 'demo' ? (
        <GuardrailNote tone="info">
          Demo data: changes here last until you pick another scenario.
        </GuardrailNote>
      ) : null}
      {note ? (
        <GuardrailNote tone="heads-up" testID="settings-note">
          {note}
        </GuardrailNote>
      ) : null}

      <SettingsGroup title="Modules">
        {v.taxToggle ? (
          <SettingsRow
            variant="toggle"
            label="Taxes"
            value={data.settings.modules.tax}
            onValueChange={(tax) => setModules({ tax })}
            testID="module-tax"
          />
        ) : null}
        <SettingsRow
          variant="toggle"
          label="Invest"
          value={data.settings.modules.invest}
          onValueChange={(invest) => setModules({ invest })}
          testID="module-invest"
        />
        <SettingsRow variant="value" label="Debt" value="Coming later" last />
      </SettingsGroup>

      <SettingsGroup title="Your numbers">
        {v.showTax ? (
          <SettingsRow
            variant="value"
            label="Set aside for taxes"
            value={v.numbers.tax}
            onPress={() => number('tax')}
            testID="number-tax"
          />
        ) : null}
        {v.showPay ? (
          <SettingsRow
            variant="value"
            label="Paycheck"
            value={v.numbers.pay}
            onPress={() => number('pay')}
            testID="number-pay"
          />
        ) : null}
        <SettingsRow
          variant="value"
          label="Runway target"
          value={v.numbers.runway}
          onPress={() => number('runway')}
          testID="number-runway"
        />
        <SettingsRow
          variant="value"
          label="Usual transfer"
          value={v.numbers.habit}
          onPress={() => number('habit')}
          testID="number-habit"
        />
        <SettingsRow
          variant="value"
          label="Monthly spending"
          value={v.numbers.spend}
          onPress={() => number('spend')}
          testID="number-spend"
        />
        <SettingsRow
          variant="chevron"
          label="Bills"
          onPress={() => router.push('/bills')}
          testID="settings-bills"
        />
        <SettingsRow
          variant="chevron"
          label="Add expected income"
          onPress={() => router.push('/income/new')}
          testID="settings-add-income"
          last
        />
      </SettingsGroup>

      <View style={{ gap: space[8] }}>
        <View style={{ paddingHorizontal: space[16] }}>
          <Text variant="footnote" tone="secondary" accessibilityRole="header">
            Accounts
          </Text>
        </View>
        <View>
          {v.accounts.map((a, i) => (
            <LedgerRow
              key={a.id}
              surface="dark"
              title={a.title}
              subtitle={a.subtitle}
              value={a.value}
              onPress={
                a.editable
                  ? () => router.push({ pathname: '/account/[id]/balance', params: { id: a.id } })
                  : undefined
              }
              last={i === v.accounts.length - 1}
              testID={`settings-account-${a.id}`}
            />
          ))}
        </View>
        <SettingsGroup>
          <SettingsRow
            variant="chevron"
            label="Add an account by hand"
            onPress={() =>
              router.push({ pathname: '/account/[id]/balance', params: { id: 'new' } })
            }
            testID="settings-add-account"
          />
          <SettingsRow
            variant="chevron"
            label="Import a file"
            onPress={() => router.push('/import')}
            last
          />
        </SettingsGroup>
      </View>

      <SettingsGroup title="Reminders">
        <SettingsRow
          variant="value"
          label="Weekly review"
          value={v.weekly}
          onPress={() => router.push('/settings/reminders')}
          testID="reminder-weekly"
        />
        <SettingsRow
          variant="toggle"
          label="Card statements"
          value={prefs.reminders.cardStatements}
          onValueChange={(cardStatements) => void reminder({ cardStatements })}
          testID="reminder-cards"
        />
        {v.showTax ? (
          <SettingsRow
            variant="toggle"
            label="Quarterly taxes"
            value={prefs.reminders.quarterlyTaxes}
            onValueChange={(quarterlyTaxes) => void reminder({ quarterlyTaxes })}
            testID="reminder-taxes"
          />
        ) : null}
        <SettingsRow
          variant="toggle"
          label={data.settings.incomeType === 'salary' ? 'Paydays' : 'Deposits and late invoices'}
          value={prefs.reminders.deposits}
          onValueChange={(deposits) => void reminder({ deposits })}
          testID="reminder-deposits"
          last
        />
      </SettingsGroup>

      <SettingsGroup title="Privacy">
        <SettingsRow
          variant="toggle"
          label={LOCK_NAME[capability]}
          value={lockEnabled}
          onValueChange={(on) => void toggleLock(on)}
          testID="privacy-lock"
        />
        <SettingsRow
          variant="toggle"
          label="Show amounts on lock screen"
          value={prefs.showAmountsOnLockScreen}
          onValueChange={(showAmountsOnLockScreen) => setPrefs({ showAmountsOnLockScreen })}
          testID="privacy-amounts"
        />
        <SettingsRow variant="value" label="Connected banks" value={v.connected} />
        <SettingsRow
          variant="chevron"
          label="Export all data"
          onPress={() => router.push('/settings/export')}
          testID="privacy-export"
        />
        <SettingsRow
          variant="chevron"
          label="Import backup"
          onPress={() => router.push('/settings/import')}
          testID="privacy-import"
        />
        <SettingsRow
          variant="destructive"
          label="Delete everything"
          onPress={() => router.push('/settings/delete')}
          testID="privacy-delete"
          last
        />
      </SettingsGroup>

      <Text variant="footnote" tone="secondary" align="center">
        {`Annum ${Constants.expoConfig?.version ?? ''} · Your data stays on this phone.`}
      </Text>
    </ScreenScroll>
  );
}
