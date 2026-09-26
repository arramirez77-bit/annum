import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { addDays, formatDollars, localISODate, type Cadence, type Cents } from '@/domain';
import { targetMonths } from '@/state/settings-views';
import { useAppStore } from '@/state/store';
import { space } from '@/theme';
import {
  AmountInput,
  Button,
  DateField,
  GuardrailNote,
  ScreenScroll,
  SegmentedControl,
  Text,
} from '@/ui/components';

type Key = 'tax' | 'runway' | 'habit' | 'spend' | 'pay';
const TITLES: Record<Key, string> = {
  tax: 'Set aside for taxes',
  runway: 'Runway target',
  habit: 'Usual transfer',
  spend: 'Monthly spending',
  pay: 'Paycheck',
};

// S3 "Your numbers — tap to edit" (form sheet). docs/05.
export default function EditNumber() {
  const { key } = useLocalSearchParams<{ key: Key }>();
  const data = useAppStore((s) => s.data);
  const setNumbers = useAppStore((s) => s.setNumbers);
  const setHabit = useAppStore((s) => s.setHabit);
  const setPaySchedule = useAppStore((s) => s.setPaySchedule);
  const s = data.settings;
  const today = localISODate(new Date());

  const [rate, setRate] = useState<'0.25' | '0.3' | '0.35'>(
    (['0.25', '0.3', '0.35'].includes(String(s.taxRate)) ? String(s.taxRate) : '0.3') as
      '0.25' | '0.3' | '0.35',
  );
  const current = targetMonths(data);
  const [months, setMonths] = useState<'3' | '5' | '6'>(
    (['3', '5', '6'].includes(String(current)) ? String(current) : '5') as '3' | '5' | '6',
  );
  const [amount, setAmount] = useState<Cents | null>(
    key === 'habit'
      ? s.habitTransfer.amount || null
      : key === 'pay'
        ? (s.paySchedule?.amount ?? null)
        : s.monthlySpend || null,
  );
  const [cadence, setCadence] = useState<Cadence>(
    key === 'pay' ? (s.paySchedule?.cadence ?? 'biweekly') : s.habitTransfer.cadence,
  );
  const [payday, setPayday] = useState(
    s.paySchedule && s.paySchedule.next >= today ? s.paySchedule.next : addDays(today, 14),
  );

  const target = Number(months) * s.monthlySpend;
  const note: Record<Key, string> = {
    tax: `Each deposit sets aside ${Math.round(Number(rate) * 100)}% in Tax before anything else.`,
    runway:
      s.monthlySpend > 0
        ? `${formatDollars(target)}: ${months} months of spending at about ${formatDollars(s.monthlySpend)} a month. Invest unlocks once Runway reaches it.`
        : 'Add your monthly spending first; the target is months of it.',
    habit: 'Weekly review compares what the week needs with this, and says when it’s more.',
    spend:
      'A rough guess is fine. Runway months and the target are measured against it, and Annum learns it from your spending.',
    pay: 'After taxes. Annum plans your spending until the next payday, then rolls the date forward.',
  };

  const save = () => {
    if (key === 'tax') setNumbers({ taxRate: Number(rate) });
    if (key === 'runway' && s.monthlySpend > 0) setNumbers({ runwayTarget: target });
    if (key === 'habit' && amount) setHabit(amount, cadence);
    if (key === 'pay' && amount) setPaySchedule({ amount, cadence, next: payday });
    if (key === 'spend' && amount) {
      // Keep the Runway target at the same number of months.
      const keep = targetMonths(data) || 5;
      setNumbers({ monthlySpend: amount, runwayTarget: amount * keep });
    }
    router.back();
  };

  return (
    <ScreenScroll surface="surface" testID={`edit-number-${key}`}>
      <Text variant="title2" accessibilityRole="header">
        {TITLES[key]}
      </Text>
      {key === 'tax' ? (
        <SegmentedControl
          options={[
            { value: '0.25', label: '25%' },
            { value: '0.3', label: '30%' },
            { value: '0.35', label: '35%' },
          ]}
          value={rate}
          onChange={setRate}
          accessibilityLabel="Tax rate"
          testID="number-rate"
        />
      ) : null}
      {key === 'runway' ? (
        <SegmentedControl
          options={[
            { value: '3', label: '3 months' },
            { value: '5', label: '5 months' },
            { value: '6', label: '6 months' },
          ]}
          value={months}
          onChange={setMonths}
          accessibilityLabel="Runway target"
          testID="number-months"
        />
      ) : null}
      {key === 'habit' || key === 'spend' || key === 'pay' ? (
        <AmountInput
          label={
            key === 'habit'
              ? 'I usually move'
              : key === 'pay'
                ? 'Each paycheck, after taxes'
                : 'About what I spend in a month'
          }
          valueCents={amount}
          onChangeCents={setAmount}
          autoFocus
          testID="number-amount"
        />
      ) : null}
      {key === 'habit' || key === 'pay' ? (
        <SegmentedControl
          options={[
            { value: 'weekly', label: 'Weekly' },
            { value: 'biweekly', label: 'Every 2 weeks' },
            { value: 'monthly', label: 'Monthly' },
          ]}
          value={cadence}
          onChange={setCadence}
          accessibilityLabel="How often"
          testID="number-cadence"
        />
      ) : null}
      {key === 'pay' ? (
        <DateField label="Next payday" value={payday} minimum={today} onChange={setPayday} />
      ) : null}
      <GuardrailNote tone="info">{note[key]}</GuardrailNote>
      <View style={{ gap: space[8] }}>
        <Button
          variant="primary"
          label="Save"
          disabled={(key === 'habit' || key === 'spend' || key === 'pay') && !amount}
          onPress={save}
          testID="number-save"
        />
      </View>
    </ScreenScroll>
  );
}
