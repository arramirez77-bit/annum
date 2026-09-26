import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Linking, Pressable, ScrollView, View } from 'react-native';

import { formatDollars, type Cadence, type Cents } from '@/domain';
import {
  buildBalancesView,
  buildChangesView,
  buildDoneView,
  buildHabitView,
  buildMoveView,
  buildTagView,
  reviewSteps,
} from '@/state/review-views';
import { clockFor, useAppStore } from '@/state/store';
import { layout, opacity, space, color } from '@/theme';
import {
  AmountInput,
  Button,
  DeltaCard,
  GuardrailNote,
  LedgerRow,
  SegmentedControl,
  SpendBar,
  StepIndicator,
  Text,
  TransactionCard,
} from '@/ui/components';

function HeaderButton({
  label,
  onPress,
  testID,
}: {
  label: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={space[8]}
      testID={testID}
      style={({ pressed }) => pressed && { opacity: opacity.pressed }}
    >
      <Text>{label}</Text>
    </Pressable>
  );
}

function StepScroll({ children, testID }: { children: ReactNode; testID: string }) {
  return (
    <ScrollView
      style={{ backgroundColor: color.bgBase }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        padding: layout.screenMargin,
        gap: space[20],
        paddingBottom: space[40],
      }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets
      testID={testID}
    >
      {children}
    </ScrollView>
  );
}

function Title({ children, subtitle }: { children: string; subtitle?: string }) {
  return (
    <View style={{ gap: space[4] }}>
      <Text variant="title2" accessibilityRole="header">
        {children}
      </Text>
      {subtitle ? <Text tone="secondary">{subtitle}</Text> : null}
    </View>
  );
}

// 04 Balances · 05 Tag · 06 What changed · 07b Habit · 07 Move money · 08 Week reviewed. docs/05.
export default function ReviewStep() {
  const params = useLocalSearchParams<{ step: string }>();
  const store = useAppStore();
  const { data } = store;
  const steps = reviewSteps(data);
  const n = Math.min(Math.max(Number(params.step) || 1, 1), steps.length);
  const id = steps[n - 1];

  const next = () => {
    store.saveReviewStep(n + 1);
    router.push(`/review/${n + 1}`);
  };
  const back = () => {
    store.saveReviewStep(n - 1);
    if (router.canGoBack()) router.back();
    else router.replace(`/review/${n - 1}`);
  };
  const finishLater = () => {
    store.saveReviewStep(n);
    router.navigate('/');
  };

  const header = (
    <Stack.Screen
      options={{
        headerTitle: () => <StepIndicator step={n} total={steps.length} />,
        headerBackVisible: false,
        headerLeft:
          n > 1
            ? () => <HeaderButton label="Back" onPress={back} testID="review-back" />
            : () => null,
        headerRight: () => (
          <HeaderButton label="Finish later" onPress={finishLater} testID="review-finish-later" />
        ),
      }}
    />
  );

  let body: ReactNode = null;
  if (id === 'balances') body = <Balances onNext={next} />;
  if (id === 'tag') body = <Tag onNext={next} />;
  if (id === 'changes') body = <Changes onNext={next} />;
  if (id === 'habit') body = <Habit onNext={next} />;
  if (id === 'move') body = <Move onNext={next} />;
  if (id === 'done') body = <Done />;

  return (
    <>
      {header}
      <View style={{ flex: 1 }} testID={`review-step-${id}`}>
        {body}
      </View>
    </>
  );
}

function Balances({ onNext }: { onNext: () => void }) {
  const data = useAppStore((s) => s.data);
  const mode = useAppStore((s) => s.mode);
  const v = buildBalancesView(data, clockFor({ mode, data }));
  return (
    <StepScroll testID="review-balances">
      <Title>{v.title}</Title>
      <View>
        {v.rows.map((r, i) => (
          <LedgerRow
            key={r.id}
            surface="dark"
            title={r.title}
            subtitle={r.subtitle}
            value={r.value}
            last={i === v.rows.length - 1}
            onPress={
              r.editable
                ? () => router.push({ pathname: '/account/[id]/balance', params: { id: r.id } })
                : undefined
            }
            testID={`balance-${r.id}`}
          />
        ))}
      </View>
      {v.manualNote ? <GuardrailNote tone="heads-up">{v.manualNote}</GuardrailNote> : null}
      {v.importNote ? <Text tone="secondary">{v.importNote}</Text> : null}
      <View style={{ gap: space[8] }}>
        {v.importNote ? (
          <Button
            variant="secondary"
            label="Import this week’s file"
            onPress={() => router.push('/import')}
            testID="review-import"
          />
        ) : null}
        <Button variant="primary" label={v.primary} onPress={onNext} testID="review-primary" />
      </View>
    </StepScroll>
  );
}

function Tag({ onNext }: { onNext: () => void }) {
  const data = useAppStore((s) => s.data);
  const chooseCategory = useAppStore((s) => s.chooseCategory);
  const toggleTax = useAppStore((s) => s.toggleTax);
  const finishTagging = useAppStore((s) => s.finishTagging);
  const v = buildTagView(data);
  return (
    <StepScroll testID="review-tag">
      <Title subtitle={v.subtitle}>{v.title}</Title>
      {v.items.map((t) => (
        <TransactionCard
          key={t.id}
          testID={`tag-${t.id}`}
          merchant={t.merchant}
          dateLabel={t.dateLabel}
          accountName={t.accountName}
          amount={t.amount}
          suggestions={t.suggestions}
          selectedCategory={t.selected}
          tax={t.tax}
          onSelectCategory={(c) => chooseCategory(t.id, c)}
          onToggleTax={v.showTax ? () => toggleTax(t.id) : undefined}
        />
      ))}
      <Button
        variant="primary"
        label={v.primary}
        onPress={() => {
          finishTagging();
          onNext();
        }}
        testID="review-primary"
      />
    </StepScroll>
  );
}

function Changes({ onNext }: { onNext: () => void }) {
  const data = useAppStore((s) => s.data);
  const v = buildChangesView(data);
  return (
    <StepScroll testID="review-changes">
      <Title>{v.title}</Title>
      {v.cards.map((c) => (
        <DeltaCard
          key={c.bucket}
          bucket={c.bucket}
          title={c.title}
          value={c.value}
          line={c.line}
          testID={`delta-${c.bucket}`}
        />
      ))}
      {v.note ? <GuardrailNote tone="info">{v.note}</GuardrailNote> : null}
      <Button variant="primary" label={v.primary} onPress={onNext} testID="review-primary" />
    </StepScroll>
  );
}

function Habit({ onNext }: { onNext: () => void }) {
  const data = useAppStore((s) => s.data);
  const setHabit = useAppStore((s) => s.setHabit);
  const [amount, setAmount] = useState<Cents | null>(data.settings.habitTransfer.amount);
  const [cadence, setCadence] = useState<Cadence>(data.settings.habitTransfer.cadence);
  const v = buildHabitView(data, amount ?? 0);
  return (
    <StepScroll testID="review-habit">
      <Title>{v.title}</Title>
      <AmountInput
        label="I usually move"
        valueCents={amount}
        onChangeCents={setAmount}
        testID="habit-amount"
      />
      <SegmentedControl
        options={[
          { value: 'weekly', label: 'Weekly' },
          { value: 'biweekly', label: 'Every 2 weeks' },
          { value: 'monthly', label: 'Monthly' },
        ]}
        value={cadence}
        onChange={setCadence}
        accessibilityLabel="How often"
        testID="habit-cadence"
      />
      <GuardrailNote tone="info">{v.note}</GuardrailNote>
      <Button
        variant="primary"
        label={v.primary}
        disabled={!amount}
        onPress={() => {
          if (amount) setHabit(amount, cadence);
          onNext();
        }}
        testID="review-primary"
      />
    </StepScroll>
  );
}

function Move({ onNext }: { onNext: () => void }) {
  const data = useAppStore((s) => s.data);
  const markTransferMoved = useAppStore((s) => s.markTransferMoved);
  const [override, setOverride] = useState<Cents | null>(null);
  const [editing, setEditing] = useState(false);
  const v = buildMoveView(data, override ?? undefined);
  const moved = () => {
    markTransferMoved(v.amount);
    onNext();
  };
  return (
    <StepScroll testID="review-move">
      <View
        accessible
        accessibilityLabel={`Move ${formatDollars(v.amount)} from savings to checking.`}
        style={{ gap: space[4] }}
      >
        <Text variant="sentence">Move</Text>
        <Text variant="display" money testID="move-amount">
          {formatDollars(v.amount)}
        </Text>
        <Text variant="sentence">from savings to checking.</Text>
      </View>
      {editing ? (
        <AmountInput
          label="Move this much"
          valueCents={override ?? v.amount}
          onChangeCents={setOverride}
          autoFocus
          testID="move-override"
        />
      ) : (
        <Button
          variant="quiet"
          label="Change amount"
          onPress={() => setEditing(true)}
          testID="move-change"
        />
      )}
      <Text tone="secondary">{v.comparison}</Text>
      <View>
        {v.rows.map((r, i) => (
          <LedgerRow
            key={r.title}
            surface="dark"
            title={r.title}
            subtitle={r.subtitle}
            value={r.value}
            last={i === v.rows.length - 1}
          />
        ))}
      </View>
      {v.aboveHabit ? <GuardrailNote tone="heads-up">{v.aboveHabit}</GuardrailNote> : null}
      {v.openLabel && v.bank.url ? (
        <View style={{ gap: space[8] }}>
          <Button
            variant="primary"
            label={v.openLabel}
            onPress={() => Linking.openURL(v.bank.url!)}
            testID="move-open-bank"
          />
          <Button variant="secondary" label={v.movedLabel} onPress={moved} testID="move-moved" />
        </View>
      ) : (
        <View style={{ gap: space[12] }}>
          {v.howTo ? <Text tone="secondary">{v.howTo}</Text> : null}
          <Button variant="primary" label={v.movedLabel} onPress={moved} testID="move-moved" />
        </View>
      )}
    </StepScroll>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: space[4] }}>
      <Text variant="headline" accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

function Done() {
  const data = useAppStore((s) => s.data);
  const pending = useAppStore((s) => s.pendingTransfer);
  const completeReview = useAppStore((s) => s.completeReview);
  const v = buildDoneView(data, pending);
  return (
    <StepScroll testID="review-done">
      <Text variant="display" money accessibilityRole="header">
        {v.title}
      </Text>
      <View style={{ gap: space[8] }}>
        <SpendBar
          within={v.bar.within}
          over={v.bar.over}
          left={v.bar.left}
          accessibilityLabel={v.barLabel}
        />
        <Text variant="footnote" tone="secondary">
          {v.barLabel}
        </Text>
      </View>
      <Section title="Where it went">
        {v.categories.map((c, i) => (
          <LedgerRow
            key={c.title}
            surface="dark"
            title={c.title}
            subtitle={c.subtitle}
            value={c.value}
            last={i === v.categories.length - 1}
          />
        ))}
      </Section>
      <Section title="What's left">
        {v.left.map((r, i) => (
          <LedgerRow
            key={r.title}
            surface="dark"
            title={r.title}
            subtitle={r.subtitle}
            value={r.value}
            last={i === v.left.length - 1}
          />
        ))}
      </Section>
      <Text tone="secondary">{v.nextReview}</Text>
      <Button
        variant="primary"
        label={v.primary}
        onPress={() => {
          completeReview();
          router.dismissAll();
          router.navigate('/');
        }}
        testID="review-done-button"
      />
    </StepScroll>
  );
}
