import { Redirect, Stack } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';

import { demoSeed } from '@/data/demo';
import {
  BUCKET_KEYS,
  editSplit,
  formatDollars,
  formatShortDate,
  proposeSplit,
  type BucketKey,
  type Cents,
  type EditableBucket,
} from '@/domain';
import { color, layout, radius, size, space, type as typeScale } from '@/theme';
import {
  AmountInput,
  BucketBar,
  BucketDot,
  BucketRow,
  Button,
  Chip,
  GuardrailNote,
  LedgerRow,
  Mark,
  OptionCard,
  SegmentedControl,
  SettingsGroup,
  SettingsRow,
  ProfileButton,
  StatusPill,
  StepIndicator,
  Text,
  Toggle,
  TransactionCard,
  Wordmark,
  type ButtonVariant,
  type TextVariant,
} from '@/ui/components';
import { pushedHeader } from '@/ui/navigation';

const seed = demoSeed();
const NAMES: Record<BucketKey, string> = {
  tax: 'Tax',
  bills: 'Bills',
  runway: 'Runway',
  invest: 'Invest',
  free: 'Free',
};
const noop = () => undefined;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: space[12] }} testID={`section-${title}`}>
      <Text variant="title2" accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

function LightSurface({ children }: { children: ReactNode }) {
  return (
    <View
      style={{
        gap: space[12],
        padding: space[20],
        borderRadius: radius.sheet,
        backgroundColor: color.bgSheet,
      }}
    >
      {children}
    </View>
  );
}

function Gallery() {
  const [chip, setChip] = useState('Groceries');
  const [tax, setTax] = useState(false);
  const [toggle, setToggle] = useState(true);
  const [rate, setRate] = useState<'25' | '30' | '35'>('30');
  const [income, setIncome] = useState<'freelance' | 'salary' | 'both'>('freelance');
  const [amount, setAmount] = useState<Cents | null>(24000);
  const [split, setSplit] = useState(() => proposeSplit(seed, seed.pendingDeposit!.amount));
  const [capped, setCapped] = useState(false);
  const [barAlt, setBarAlt] = useState(false);
  const [txs, setTxs] = useState(() =>
    seed.transactions
      .filter((t) => t.amount < 0)
      .map((t) => ({ ...t, selected: t.category ?? t.suggestedCategory })),
  );

  const barSegments = BUCKET_KEYS.map((bucket) => ({
    bucket,
    amount: barAlt ? split[bucket] : seed.buckets[bucket],
  }));
  const barLabel = `Savings: ${barSegments.map((s) => `${NAMES[s.bucket]} ${formatDollars(s.amount)}`).join(', ')}`;

  return (
    <ScrollView
      style={{ backgroundColor: color.bgBase }}
      contentContainerStyle={{
        padding: layout.screenMargin,
        gap: space[40],
        paddingBottom: space[72],
      }}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      keyboardDismissMode="on-drag"
      testID="gallery"
    >
      <Section title="Mark">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[16] }}>
          <Mark size={size.markMin} />
          <Mark size={size.markLockup} decorative />
          <Wordmark />
        </View>
        <LightSurface>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[12] }}>
            <Mark size={size.markLockup} surface="light" decorative />
            <Wordmark surface="light" />
          </View>
        </LightSurface>
      </Section>

      <Section title="Type">
        {(Object.keys(typeScale) as TextVariant[])
          .filter((v) => v !== 'tabLabel' && v !== 'hero')
          .map((v) => (
            <Text key={v} variant={v} money={v === 'display'}>
              {v === 'display' ? '$1,000' : v}
            </Text>
          ))}
      </Section>

      <Section title="BucketDot">
        <View style={{ flexDirection: 'row', gap: space[12], alignItems: 'center' }}>
          {BUCKET_KEYS.map((b) => (
            <BucketDot key={b} bucket={b} />
          ))}
          <BucketDot bucket="none" />
          <BucketDot bucket="tax" muted />
        </View>
      </Section>

      <Section title="BucketBar">
        <BucketBar segments={barSegments} accessibilityLabel={barLabel} />
        <BucketBar segments={barSegments} muted accessibilityLabel="Savings not split yet" />
        <BucketBar segments={[]} accessibilityLabel="Nothing in savings yet" />
        <Button
          variant="secondary"
          label={barAlt ? 'Show current buckets' : 'Show the $10,000 split'}
          onPress={() => setBarAlt((v) => !v)}
          testID="toggle-bar"
        />
      </Section>

      <Section title="Button">
        {(['primary', 'caution', 'secondary', 'destructive', 'quiet'] as ButtonVariant[]).map(
          (v) => (
            <Button
              key={v}
              variant={v}
              label={`${v[0].toUpperCase()}${v.slice(1)}`}
              onPress={noop}
            />
          ),
        )}
        <Button variant="destructive" label="Delete everything" onPress={noop} disabled />
        <LightSurface>
          <Button variant="field" label="Start weekly review" onPress={noop} surface="light" />
          <Button variant="secondary" label="Secondary on light" onPress={noop} surface="light" />
          <Button variant="quiet" label="Quiet on light" onPress={noop} surface="light" />
        </LightSurface>
      </Section>

      <Section title="Chip">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[8] }}>
          {['Groceries', 'Dining'].map((c) => (
            <Chip
              key={c}
              kind="category"
              label={c}
              selected={chip === c}
              onPress={() => setChip(c)}
            />
          ))}
          <Chip
            kind="tax"
            label="Tax"
            selected={tax}
            onPress={() => setTax((v) => !v)}
            testID="chip-tax"
          />
        </View>
      </Section>

      <Section title="Toggle · StatusPill · ProfileButton · StepIndicator">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[16] }}>
          <Toggle value={toggle} onValueChange={setToggle} accessibilityLabel="Example toggle" />
          <Toggle
            value={!toggle}
            onValueChange={(v) => setToggle(!v)}
            accessibilityLabel="Example toggle, opposite"
          />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[8] }}>
          <StatusPill status="on-track" />
          <StatusPill status="heads-up" />
          <StatusPill status="estimate" onLongPress={noop} />
          <ProfileButton onPress={noop} testID="gallery-profile" />
        </View>
        <StepIndicator step={1} total={5} />
        <StepIndicator step={3} total={5} />
      </Section>

      <Section title="GuardrailNote">
        <GuardrailNote tone="info">
          Annum doesn’t pick investments. You decide where this goes.
        </GuardrailNote>
        <GuardrailNote tone="heads-up">
          Buying this now dips into Runway. Waiting until Oct 13 keeps it whole.
        </GuardrailNote>
        <LightSurface>
          <GuardrailNote tone="info" surface="light">
            You’re covered through Oct 13.
          </GuardrailNote>
          <GuardrailNote tone="heads-up" surface="light">
            Woodgrove hasn’t synced since Sep 20, so this may be off by a few purchases.
          </GuardrailNote>
        </LightSurface>
      </Section>

      <Section title="BucketRow · card">
        {BUCKET_KEYS.map((b) => (
          <BucketRow
            key={b}
            variant="card"
            bucket={b}
            name={NAMES[b]}
            note="One-line note"
            amount={seed.buckets[b]}
          />
        ))}
      </Section>

      <Section title="BucketRow · split">
        <Text tone="secondary">{`Total ${formatDollars(Object.values(split).reduce((a, b) => a + b, 0))} — Free absorbs every edit.`}</Text>
        {BUCKET_KEYS.map((b) => (
          <BucketRow
            key={b}
            variant="split"
            bucket={b}
            name={NAMES[b]}
            note={b === 'free' ? 'Absorbs changes' : 'Tap to edit'}
            amount={split[b]}
            testID={`split-${b}`}
            onChangeAmount={
              b === 'free'
                ? undefined
                : (cents) => {
                    const edit = editSplit(split, b as EditableBucket, cents);
                    setSplit(edit.split);
                    setCapped(edit.capped);
                  }
            }
          />
        ))}
        {capped && (
          <GuardrailNote tone="heads-up">
            That’s more than the deposit has left, so it stops at what fits.
          </GuardrailNote>
        )}
      </Section>

      <Section title="LedgerRow">
        <LightSurface>
          <LedgerRow
            surface="light"
            bucket="runway"
            title="Runway"
            subtitle="Up 0.2 this week · $15k target"
            value="4.2 mo"
          />
          <LedgerRow
            surface="light"
            bucket="tax"
            title="Tax reserve"
            subtitle="Next quarterly date Jan 15"
            value="$3,000"
          />
          <LedgerRow
            surface="light"
            bucket="none"
            title="What would this do?"
            onPress={noop}
            last
          />
        </LightSurface>
        <View>
          {seed.accounts.map((a, i) => (
            <LedgerRow
              key={a.id}
              surface="dark"
              title={a.name}
              subtitle={a.source === 'manual' ? 'Entered by hand' : 'Updated 7:02 AM'}
              value={formatDollars(a.balance)}
              last={i === seed.accounts.length - 1}
            />
          ))}
        </View>
      </Section>

      <Section title="TransactionCard">
        {txs.map((t) => (
          <TransactionCard
            key={t.id}
            merchant={t.merchant}
            dateLabel={formatShortDate(t.date)}
            accountName={seed.accounts.find((a) => a.id === t.accountId)?.name ?? ''}
            amount={t.amount}
            suggestions={[t.suggestedCategory ?? 'Other', 'Other'].filter(
              (c, i, all) => all.indexOf(c) === i,
            )}
            selectedCategory={t.selected}
            tax={t.tax}
            onSelectCategory={(c) =>
              setTxs((all) => all.map((x) => (x.id === t.id ? { ...x, selected: c } : x)))
            }
            onToggleTax={() =>
              setTxs((all) => all.map((x) => (x.id === t.id ? { ...x, tax: !x.tax } : x)))
            }
          />
        ))}
      </Section>

      <Section title="AmountInput">
        <AmountInput
          label="If I spend"
          valueCents={amount}
          onChangeCents={setAmount}
          helper={
            amount === null
              ? 'Type an amount to see what it would do.'
              : `That's ${formatDollars(amount)}.`
          }
          testID="amount-input"
        />
        <AmountInput label="Balance today" valueCents={null} onChangeCents={noop} />
      </Section>

      <Section title="OptionCard">
        {(
          [
            ['freelance', 'Freelance', 'Invoices that arrive when they arrive'],
            ['salary', 'Salary', 'A paycheck on a schedule'],
            ['both', 'Both', 'A paycheck plus side work'],
          ] as const
        ).map(([value, title, description]) => (
          <OptionCard
            key={value}
            title={title}
            description={description}
            selected={income === value}
            onPress={() => setIncome(value)}
          />
        ))}
      </Section>

      <Section title="SegmentedControl">
        <SegmentedControl
          options={[
            { value: '25', label: '25%' },
            { value: '30', label: '30%' },
            { value: '35', label: '35%' },
          ]}
          value={rate}
          onChange={setRate}
          accessibilityLabel="Tax rate"
          testID="rate"
        />
      </Section>

      <Section title="SettingsRow">
        <SettingsGroup title="Modules">
          <SettingsRow variant="toggle" label="Taxes" value={toggle} onValueChange={setToggle} />
          <SettingsRow variant="value" label="Runway target" value="$15k" onPress={noop} />
          <SettingsRow variant="chevron" label="Connected banks" onPress={noop} last />
        </SettingsGroup>
        <SettingsGroup>
          <SettingsRow variant="destructive" label="Delete everything" onPress={noop} last />
        </SettingsGroup>
      </Section>
    </ScrollView>
  );
}

/** Dev-only component gallery (docs/06 M2). Not reachable in release builds. */
export default function ComponentsScreen() {
  if (!__DEV__) return <Redirect href="/" />;
  return (
    <>
      <Stack.Screen options={pushedHeader('Components', 'Today')} />
      <Gallery />
    </>
  );
}
