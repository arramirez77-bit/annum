import { ScreenScroll, Text } from '@/ui/components';
import { RestoreForm } from '@/ui/flows/RestoreForm';

// Restore from a backup (new phone): opens straight into Today once the file is read.
export default function Restore() {
  return (
    <ScreenScroll testID="onboarding-restore">
      <Text variant="title1" accessibilityRole="header">
        Restore from a backup
      </Text>
      <Text tone="secondary">
        Choose the Annum backup file you exported from your other phone, then type the passphrase
        you gave it.
      </Text>
      <RestoreForm replaces={false} onDone={() => undefined} />
    </ScreenScroll>
  );
}
