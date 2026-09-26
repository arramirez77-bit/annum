import { router, Stack } from 'expo-router';
import { View } from 'react-native';

import { addDays, localISODate, type Cadence, type IncomeType } from '@/domain';
import { useOnboarding } from '@/state/onboarding';
import { space } from '@/theme';
import {
  AmountInput,
  Button,
  DateField,
  HeaderButton,
  OptionCard,
  ScreenScroll,
  SegmentedControl,
  StepIndicator,
  Text,
  TextField,
} from '@/ui/components';

const TYPES: { value: IncomeType; title: string; description: string }[] = [
  { value: 'freelance', title: 'Freelance', description: 'Invoices that land when they land' },
  { value: 'salary', title: 'Salary', description: 'A paycheck on a schedule' },
  { value: 'both', title: 'Both', description: 'A paycheck plus freelance work' },
];

const CADENCES: { value: Cadence; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Monthly' },
];

// O2 Income type (Step 1 of 2) → sets incomeType and modules. docs/05.
export default function Income() {
  const o = useOnboarding();
  const today = localISODate(new Date());
  const paid = o.incomeType === 'salary' || o.incomeType === 'both';
  const invoices = o.incomeType === 'freelance' || o.incomeType === 'both';
  const pay = o.paySchedule ?? {
    amount: 0,
    cadence: 'biweekly' as Cadence,
    next: addDays(today, 14),
  };
  const invoice = o.invoice ?? {
    id: 'income-first',
    source: '',
    amount: 0,
    date: addDays(today, 14),
  };

  const next = () => router.push('/connect');
  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => <StepIndicator step={1} total={2} />,
          headerRight: () => (
            <HeaderButton
              label="Skip"
              onPress={() => {
                if (!o.incomeType) o.setIncomeType('freelance');
                next();
              }}
              testID="onboarding-skip"
            />
          ),
        }}
      />
      <ScreenScroll testID="onboarding-income">
        <Text variant="title2" accessibilityRole="header">
          How do you get paid?
        </Text>
        <View style={{ gap: space[8] }} accessibilityRole="radiogroup">
          {TYPES.map((t) => (
            <OptionCard
              key={t.value}
              title={t.title}
              description={t.description}
              selected={o.incomeType === t.value}
              onPress={() => o.setIncomeType(t.value)}
              testID={`income-${t.value}`}
            />
          ))}
        </View>
        {paid ? (
          <View style={{ gap: space[16] }}>
            <Text variant="headline" accessibilityRole="header">
              Your paycheck
            </Text>
            <AmountInput
              label="Each paycheck, after taxes"
              valueCents={pay.amount || null}
              onChangeCents={(amount) => o.setPaySchedule({ ...pay, amount: amount ?? 0 })}
              testID="pay-amount"
            />
            <SegmentedControl
              options={CADENCES}
              value={pay.cadence}
              onChange={(cadence) => o.setPaySchedule({ ...pay, cadence })}
              accessibilityLabel="How often you're paid"
              testID="pay-cadence"
            />
            <DateField
              label="Next payday"
              value={pay.next}
              minimum={today}
              onChange={(date) => o.setPaySchedule({ ...pay, next: date })}
              testID="pay-next"
            />
          </View>
        ) : null}
        {invoices ? (
          <View style={{ gap: space[16] }}>
            <View style={{ gap: space[4] }}>
              <Text variant="headline" accessibilityRole="header">
                Your next invoice
              </Text>
              <Text variant="callout" tone="secondary">
                Optional. Annum plans your spending until it lands.
              </Text>
            </View>
            <AmountInput
              label="Amount"
              valueCents={invoice.amount || null}
              onChangeCents={(amount) => o.setInvoice({ ...invoice, amount: amount ?? 0 })}
              testID="invoice-amount"
            />
            <TextField
              label="From"
              value={invoice.source}
              onChangeText={(source) => o.setInvoice({ ...invoice, source })}
              placeholder="Client name"
              autoCapitalize="words"
              testID="invoice-source"
            />
            <DateField
              label="Expected on"
              value={invoice.date}
              minimum={today}
              onChange={(date) => o.setInvoice({ ...invoice, date })}
              testID="invoice-date"
            />
          </View>
        ) : null}
        <Button
          variant="primary"
          label="Continue"
          disabled={!o.incomeType}
          onPress={() => {
            if (!paid || !pay.amount) o.setPaySchedule(paid && pay.amount ? pay : null);
            if (!invoices || !invoice.amount) o.setInvoice(null);
            else o.setInvoice({ ...invoice, source: invoice.source.trim() || 'Client' });
            next();
          }}
          testID="onboarding-continue"
        />
      </ScreenScroll>
    </>
  );
}
