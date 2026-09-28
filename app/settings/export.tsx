import { router } from 'expo-router';
import { useState } from 'react';

import { shareBackup } from '@/state/session';
import { useAppStore } from '@/state/store';
import { Button, GuardrailNote, ScreenScroll, Text, TextField } from '@/ui/components';

/** Backups with bank connections can reach bank data, so they need a longer passphrase. */
const MIN_LENGTH = 8;
const MIN_WITH_BANKS = 12;

// Export all data (form sheet): one encrypted file through the share sheet. docs/02 "Backups".
export default function ExportData() {
  const demo = useAppStore((s) => s.mode === 'demo');
  const banks = useAppStore((s) => s.connections.length > 0);
  const min = banks ? MIN_WITH_BANKS : MIN_LENGTH;
  const [passphrase, setPassphrase] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const short = passphrase.length > 0 && passphrase.length < min;
  const mismatch = again.length > 0 && again !== passphrase;
  const ready = passphrase.length >= min && again === passphrase;

  const exportNow = async () => {
    setBusy(true);
    setProblem(null);
    try {
      await shareBackup(passphrase);
      router.back();
    } catch {
      setProblem('Annum couldn’t make the file. Nothing was changed; try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenScroll surface="surface" testID="export-data">
      <Text variant="title2" accessibilityRole="header">
        Export all data
      </Text>
      <Text tone="secondary">
        One encrypted file with everything Annum has. Save it to Files, or AirDrop it to your new
        phone and choose Restore from a backup there.
      </Text>
      {banks ? (
        <GuardrailNote tone="info" testID="export-banks-note">
          The file carries your bank connections, so restoring it reconnects your banks without
          using any of your 10. It needs a passphrase of at least 12 characters.
        </GuardrailNote>
      ) : null}
      <TextField
        label="Passphrase for the file"
        value={passphrase}
        onChangeText={setPassphrase}
        secure
        helper={
          short
            ? `At least ${min} characters${banks ? ', since the file holds your bank connections' : ''}.`
            : 'Annum can’t open the file without it, and can’t recover it for you.'
        }
        testID="export-passphrase"
      />
      <TextField
        label="Type it again"
        value={again}
        onChangeText={setAgain}
        secure
        helper={mismatch ? 'Those don’t match yet.' : undefined}
        onSubmitEditing={() => ready && void exportNow()}
        testID="export-again"
      />
      {demo ? (
        <GuardrailNote tone="info">
          Demo data isn’t saved, so there’s nothing to export.
        </GuardrailNote>
      ) : null}
      {problem ? <GuardrailNote tone="heads-up">{problem}</GuardrailNote> : null}
      <Button
        variant="primary"
        label={busy ? 'Making the file…' : 'Export'}
        disabled={demo || !ready || busy}
        onPress={() => void exportNow()}
        testID="export-confirm"
      />
    </ScreenScroll>
  );
}
