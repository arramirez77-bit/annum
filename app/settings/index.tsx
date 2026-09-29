import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { lockCapability, authenticate, type LockCapability } from '@/services/lock';
import { askForReminders } from '@/services/notifications';
import { checkCount, PLAID_ENV, useBank } from '@/state/bank';
import { loginsLeft } from '@/state/bank-views';
import { setLock } from '@/state/session';
import { accountSources, buildSettingsView, type AccountSource } from '@/state/settings-views';
import { useAppStore } from '@/state/store';
import { space, symbols } from '@/theme';
import {
  AccountSourceCard,
  AddAccountCard,
  GuardrailNote,
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

const SOURCE_ICON = {
  bank: symbols.bank,
  files: symbols.importFile,
  hand: symbols.byHand,
} as const;

// S3 Settings (pushed from Today, Figma 64:765). Features · Your numbers · Accounts · Reminders ·
// Privacy. docs/05.
export default function SettingsScreen() {
  const data = useAppStore((s) => s.data);
  const prefs = useAppStore((s) => s.prefs);
  const mode = useAppStore((s) => s.mode);
  const lockEnabled = useAppStore((s) => s.lockEnabled);
  const connections = useAppStore((s) => s.connections);
  const count = useBank((s) => s.count);
  const setModules = useAppStore((s) => s.setModules);
  const setPrefs = useAppStore((s) => s.setPrefs);
  const [capability, setCapability] = useState<LockCapability>('face-id');
  const [note, setNote] = useState<string | null>(null);
  const v = buildSettingsView(data, prefs);
  useEffect(() => {
    void lockCapability().then(setCapability);
  }, []);
  useEffect(() => {
    // The shared count ("7 of 10 left"), fresh each visit: the other phone may have used one.
    if (mode === 'real') void checkCount();
  }, [mode]);
  const sources = accountSources(data, connections, new Date());
  const logins = loginsLeft(count, PLAID_ENV === 'sandbox', true);

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

  const openAccount = (a: AccountSource['accounts'][number]) =>
    a.opens === 'balance'
      ? router.push({ pathname: '/account/[id]/balance', params: { id: a.id } })
      : router.push({ pathname: '/account/[id]', params: { id: a.id } });
  let bankIndex = 0;

  return (
    <ScreenScroll testID="settings">
      <Text variant="title1" accessibilityRole="header">
        Settings
      </Text>
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

      <SettingsGroup title="Turn off features you don’t use">
        {v.taxToggle ? (
          <SettingsRow
            variant="toggle"
            label="Taxes"
            value={data.settings.modules.tax}
            onValueChange={(tax) => setModules({ tax })}
            testID="module-tax"
          />
        ) : null}
        {/* Debt isn't built yet (Andy, 2026-09-28). */}
        <SettingsRow variant="value" label="Debt" value="Coming later" />
        <SettingsRow
          variant="toggle"
          label="Invest"
          value={data.settings.modules.invest}
          onValueChange={(invest) => setModules({ invest })}
          testID="module-invest"
          last
        />
      </SettingsGroup>

      <SettingsGroup title="Your numbers">
        <SettingsRow
          variant="value"
          label="Monthly spending"
          value={v.numbers.spend}
          onPress={() => number('spend')}
          testID="number-spend"
        />
        <SettingsRow
          variant="value"
          label="Bills"
          value={v.bills ?? ''}
          onPress={() => router.push('/bills')}
          testID="settings-bills"
        />
        <SettingsRow
          variant="value"
          label="Expected income"
          value="Add"
          onPress={() => router.push('/income/new')}
          testID="settings-add-income"
        />
        {/* No frame: the rest of the numbers stay here (Andy, 2026-09-28). */}
        {v.showTax ? (
          <SettingsRow
            variant="value"
            label="Set aside for taxes"
            value={v.numbers.tax}
            onPress={() => number('tax')}
            testID="number-tax"
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
          last={!v.showPay}
        />
        {v.showPay ? (
          <SettingsRow
            variant="value"
            label="Paycheck"
            value={v.numbers.pay}
            onPress={() => number('pay')}
            testID="number-pay"
            last
          />
        ) : null}
      </SettingsGroup>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space[8] }}>
        <Text variant="footnote" tone="secondary" accessibilityRole="header">
          Accounts
        </Text>
        <Text variant="footnote" tone="secondary">
          {v.accountCount}
        </Text>
      </View>
      <View style={{ gap: space[12] }}>
        {sources.map((src) => {
          const bank = src.kind === 'bank' ? bankIndex++ : undefined;
          const reconnect = src.reconnect;
          return (
            <AccountSourceCard
              key={src.key}
              icon={SOURCE_ICON[src.kind]}
              title={src.title}
              subtitle={src.subtitle}
              action={reconnect ? 'Reconnect' : undefined}
              onPress={
                reconnect
                  ? () => router.push({ pathname: '/bank/connect', params: { item: reconnect } })
                  : undefined
              }
              testID={bank === undefined ? `settings-source-${src.key}` : `settings-bank-${bank}`}
              accounts={src.accounts.map((a) => ({
                ...a,
                onPress: () => openAccount(a),
                testID: `settings-account-${a.id}`,
              }))}
            />
          );
        })}
        <AddAccountCard onPress={() => router.push('/add-account')} testID="settings-add-account" />
        {logins ? (
          <Text variant="footnote" tone="secondary" testID="settings-bank-count">
            {logins}
          </Text>
        ) : null}
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
        <SettingsRow
          variant="chevron"
          label="Export all data"
          onPress={() => router.push('/settings/export')}
          testID="privacy-export"
        />
        <SettingsRow
          variant="chevron"
          label="Restore from a backup"
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

      {/* No frame: the version, for TestFlight reports. */}
      <Text variant="footnote" tone="secondary" align="center">
        {`Annum ${Constants.expoConfig?.version ?? ''}`}
      </Text>
    </ScreenScroll>
  );
}
