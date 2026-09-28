import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, RefreshControl, ScrollView, useWindowDimensions, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { formatDollars } from '@/domain';
import { syncAll, useBank } from '@/state/bank';
import { todayBankFootnote, todayBankNote } from '@/state/bank-views';
import { useTodayView } from '@/state/hooks';
import { useAppStore } from '@/state/store';
import { color, layout, motion, opacity, radius, space, symbols } from '@/theme';
import { Button, GuardrailNote, Icon, LedgerRow, StatusPill, Text } from '@/ui/components';
import { useCountUp } from '@/ui/motion';

// 01 Today (+02 heads-up, O5 estimate, E1 stale, E2 late, P2 salary, 01c compact). docs/05.
export default function TodayScreen() {
  const v = useTodayView();
  const demo = useAppStore((s) => s.mode === 'demo');
  const saveProblem = useAppStore((s) => s.saveProblem);
  const connections = useAppStore((s) => s.connections);
  const { access, syncing, offline } = useBank();
  const bankNote = todayBankNote(access, connections);
  const bankFootnote = todayBankFootnote(syncing, offline, connections);
  // Pull to refresh asks the bank for live balances (docs/02).
  const refresh =
    connections.length && !demo ? (
      <RefreshControl
        refreshing={syncing}
        onRefresh={() => void syncAll({ live: true, force: true })}
        tintColor={color.textPrimary}
      />
    ) : undefined;
  // 01c: short screens (iPhone SE) get the Display hero and a one-line sentence. docs/04.
  const compact = useWindowDimensions().height < layout.compactHeight;
  const reduceMotion = useReducedMotion();
  const shown = useCountUp(v.amount);

  // Field cross-fades between on-track green and heads-up umber (600ms; 150ms with Reduce Motion).
  const caution = useSharedValue(v.caution ? 1 : 0);
  useEffect(() => {
    caution.value = withTiming(v.caution ? 1 : 0, {
      duration: reduceMotion ? motion.fade : motion.field,
    });
  }, [v.caution, reduceMotion, caution]);
  const fieldStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(caution.value, [0, 1], [color.bgField, color.bgFieldCaution]),
  }));

  const secondary = v.caution ? 'onCautionSecondary' : 'secondary';

  return (
    <Animated.View style={[{ flex: 1 }, fieldStyle]} testID="today">
      {/* Behind the scroll view: the sheet color fills the lower half, so the area under the
          floating tab bar stays light when the sheet is scrolled to its end. */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          top: '50%',
          backgroundColor: color.bgSheet,
        }}
      />
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        refreshControl={refresh}
      >
        <Animated.View
          style={[
            {
              paddingTop: space[8],
              paddingBottom: space[40],
              paddingHorizontal: layout.todayMargin,
            },
            fieldStyle,
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[8] }}>
            <View style={{ flex: 1 }}>
              <Text variant="footnote" tone={secondary} testID="today-updated">
                {`${v.dateLabel} · ${syncing && !demo ? 'Updating…' : v.updatedLabel}`}
              </Text>
            </View>
            <StatusPill
              status={v.status}
              testID="status-pill"
              onLongPress={demo || __DEV__ ? () => router.push('/dev/scenarios') : undefined}
            />
            <Pressable
              onPress={() => router.push('/settings')}
              accessibilityRole="button"
              accessibilityLabel="Settings"
              testID="open-settings"
              style={({ pressed }) => [
                {
                  width: layout.touchTarget,
                  height: layout.touchTarget,
                  alignItems: 'center',
                  justifyContent: 'center',
                },
                pressed && { opacity: opacity.pressed },
              ]}
            >
              <Icon name={symbols.settings} />
            </Pressable>
          </View>

          <View
            accessible
            accessibilityRole="header"
            accessibilityLabel={v.heroLabel}
            testID="today-hero"
            style={{ marginTop: compact ? layout.todayTopCompact : space[48], gap: space[4] }}
          >
            <Text variant="sentence">{v.lead}</Text>
            <Text variant={compact ? 'display' : 'hero'} money testID="today-amount">
              {formatDollars(shown)}
            </Text>
            <Text
              variant="sentence"
              numberOfLines={compact ? 1 : undefined}
              adjustsFontSizeToFit={compact}
            >
              {compact ? v.compactSentence : v.sentence}
            </Text>
            {v.cause ? (
              <View style={{ marginTop: space[8] }}>
                <Text variant="sentence" tone={secondary} testID="today-cause">
                  {v.cause}
                </Text>
              </View>
            ) : null}
          </View>
        </Animated.View>

        {/* Field color behind the sheet's rounded corners. */}
        <Animated.View style={[{ flexGrow: 1 }, fieldStyle]}>
          <View
            style={{
              flexGrow: 1,
              paddingHorizontal: layout.screenMargin,
              paddingTop: space[16],
              paddingBottom: space[24],
              gap: space[16],
              borderTopLeftRadius: radius.sheet,
              borderTopRightRadius: radius.sheet,
              backgroundColor: color.bgSheet,
            }}
          >
            {saveProblem ? (
              <GuardrailNote tone="heads-up" surface="light" testID="save-note">
                Annum couldn’t save your last change on this phone. It will try again with your next
                one.
              </GuardrailNote>
            ) : null}
            {v.emptyNote ? (
              <GuardrailNote tone="info" surface="light" testID="empty-note">
                {v.emptyNote}
              </GuardrailNote>
            ) : null}
            {bankNote && !demo ? (
              <GuardrailNote tone="heads-up" surface="light" testID="bank-note">
                {bankNote}
              </GuardrailNote>
            ) : null}
            {v.staleNote ? (
              <GuardrailNote tone="heads-up" surface="light" testID="stale-note">
                {v.staleNote}
              </GuardrailNote>
            ) : null}
            <View>
              {v.rows.map((row, i) => (
                <LedgerRow
                  key={row.id}
                  surface="light"
                  title={row.title}
                  subtitle={row.subtitle}
                  value={row.value}
                  bucket={row.bucket}
                  last={i === v.rows.length - 1}
                  testID={`today-row-${row.id}`}
                  onPress={row.route ? () => router.push(row.route!) : undefined}
                />
              ))}
            </View>
            {bankFootnote && !demo && bankFootnote !== 'Updating…' ? (
              <Text variant="footnote" tone="onLightSecondary" testID="bank-footnote">
                {bankFootnote}
              </Text>
            ) : null}
            <Button
              variant={v.button.variant}
              surface="light"
              label={v.button.label}
              onPress={() => router.navigate('/review')}
              testID="today-button"
            />
          </View>
        </Animated.View>
      </ScrollView>
    </Animated.View>
  );
}
