import { Redirect, router } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { formatWeekdayDate, nextReviewDate } from '@/domain';
import { useAppStore } from '@/state/store';
import { color, layout, space } from '@/theme';
import { Button, Text } from '@/ui/components';

// Review tab: resume the weekly review, or show that this week is done.
export default function ReviewHome() {
  const step = useAppStore((s) => s.reviewStep);
  const today = useAppStore((s) => s.data.today);
  const lastReview = useAppStore((s) => s.lastReviewDate);
  const saveStep = useAppStore((s) => s.saveReviewStep);

  if (lastReview !== today) return <Redirect href={`/review/${step}`} />;

  return (
    <ScrollView
      style={{ backgroundColor: color.bgBase }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: layout.screenMargin, gap: space[16] }}
      testID="review-home"
    >
      <View style={{ gap: space[8], paddingTop: space[24] }}>
        <Text variant="title1" accessibilityRole="header">
          This week is reviewed
        </Text>
        <Text tone="secondary">{`Next review ${formatWeekdayDate(nextReviewDate(today))}. We’ll remind you.`}</Text>
      </View>
      <Button
        variant="secondary"
        label="Review again"
        onPress={() => {
          saveStep(1);
          router.push('/review/1');
        }}
        testID="review-again"
      />
    </ScrollView>
  );
}
