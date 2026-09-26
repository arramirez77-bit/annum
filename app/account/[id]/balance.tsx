import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { addDays, formatShortDate, localISODate, type Account, type Cents } from '@/domain';
import { ACCOUNT_TYPES, owes } from '@/state/account-views';
import { useOnboarding } from '@/state/onboarding';
import { newRecordId, useAppStore } from '@/state/store';
import { space } from '@/theme';
import {
  AmountInput,
  Button,
  Chip,
  DateField,
  ScreenScroll,
  Text,
  TextField,
} from '@/ui/components';

/**
 * S10 Edit balance (form sheet) for accounts entered by hand. `id=new` adds one; `draft=1`
 * edits onboarding's accounts before they're saved. docs/05.
 */
export default function EditBalance() {
  const { id, draft } = useLocalSearchParams<{ id: string; draft?: string }>();
  const onboarding = draft === '1';
  const appAccounts = useAppStore((s) => s.data.accounts);
  const draftAccounts = useOnboarding((s) => s.accounts);
  const store = useAppStore.getState();
  const o = useOnboarding.getState();
  const existing = (onboarding ? draftAccounts : appAccounts).find((a) => a.id === id);
  const today = localISODate(new Date());

  const [name, setName] = useState(existing?.name ?? '');
  const [type, setType] = useState<Account['type']>(existing?.type ?? 'brokerage');
  const [balance, setBalance] = useState<Cents | null>(
    existing && existing.balance !== 0 ? existing.balance : null,
  );
  const [statement, setStatement] = useState<Cents | null>(existing?.statementBalance ?? null);
  const [due, setDue] = useState(existing?.statementDue ?? addDays(today, 14));

  const save = () => {
    const account: Account = {
      ...(existing ?? {
        id: newRecordId('account'),
        source: 'manual' as const,
        status: 'ok' as const,
      }),
      name: name.trim() || ACCOUNT_TYPES.find((t) => t.value === type)!.label,
      type,
      balance: balance ?? 0,
      enteredOn: today,
      ...(type === 'card'
        ? { statementBalance: statement ?? 0, statementDue: statement ? due : null }
        : {}),
    };
    if (onboarding) o.setAccount(account);
    else store.saveAccount(account);
    router.back();
  };

  const stop = () => {
    if (!existing) return;
    if (onboarding) o.removeAccount(existing.id);
    else store.stopTracking(existing.id);
    router.back();
  };

  return (
    <ScreenScroll surface="surface" testID="edit-balance">
      <Text variant="title2" accessibilityRole="header">
        {existing ? existing.name : 'Add an account'}
      </Text>
      {!existing ? (
        <>
          <TextField
            label="Name"
            value={name}
            onChangeText={setName}
            placeholder="Retirement account"
            autoCapitalize="words"
            testID="account-name"
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[8] }}>
            {ACCOUNT_TYPES.map((t) => (
              <Chip
                key={t.value}
                kind="category"
                label={t.label}
                selected={type === t.value}
                onPress={() => setType(t.value)}
                testID={`account-type-${t.value}`}
              />
            ))}
          </View>
        </>
      ) : null}
      <AmountInput
        label={owes({ type } as Account) ? 'Owed today' : 'Balance today'}
        valueCents={balance}
        onChangeCents={setBalance}
        helper={
          existing?.enteredOn
            ? `Last updated ${existing.enteredOn === today ? 'today' : formatShortDate(existing.enteredOn)}`
            : undefined
        }
        testID="balance-amount"
      />
      {type === 'card' ? (
        <>
          <AmountInput
            label="Statement balance"
            valueCents={statement}
            onChangeCents={setStatement}
            helper="Annum sets this aside before it lands."
            testID="statement-amount"
          />
          <DateField label="Statement due" value={due} minimum={today} onChange={setDue} />
        </>
      ) : null}
      <View style={{ gap: space[8] }}>
        <Button variant="primary" label="Save" onPress={save} testID="balance-save" />
        {existing ? (
          <Button
            variant="quiet"
            label="Stop tracking this account"
            onPress={stop}
            testID="balance-stop"
          />
        ) : null}
      </View>
    </ScreenScroll>
  );
}
