import { router } from 'expo-router';

import { useAppStore } from '@/state/store';
import { GuardrailNote, ScreenScroll, Text } from '@/ui/components';
import { RestoreForm } from '@/ui/flows/RestoreForm';

// Restore from a backup (Settings → Privacy): replaces this phone's data with the file's.
export default function ImportBackup() {
  const demo = useAppStore((s) => s.mode === 'demo');
  return (
    <ScreenScroll testID="import-backup">
      <Text variant="title1" accessibilityRole="header">
        Restore from a backup
      </Text>
      {demo ? (
        <GuardrailNote tone="info">
          You’re looking at demo data. Pick “Use my data” in Scenarios before restoring a backup.
        </GuardrailNote>
      ) : (
        <RestoreForm
          replaces
          onDone={() => {
            router.dismissAll();
            router.navigate('/');
          }}
        />
      )}
    </ScreenScroll>
  );
}
