import { router } from 'expo-router';

import { Button, ScreenPlaceholder } from '@/ui/components';

// 01 Today — placeholder until M3.
export default function TodayScreen() {
  return (
    <ScreenPlaceholder title="Annum" line="Money, by the year.">
      {__DEV__ && (
        <Button
          variant="quiet"
          label="Component gallery"
          onPress={() => router.push('/dev/components')}
          testID="open-gallery"
        />
      )}
    </ScreenPlaceholder>
  );
}
