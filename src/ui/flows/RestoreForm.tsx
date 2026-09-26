import * as DocumentPicker from 'expo-document-picker';
import { useState } from 'react';
import { View } from 'react-native';

import { restoreFrom, type RestoreOutcome } from '@/state/session';
import { space } from '@/theme';
import { Button, GuardrailNote, Text, TextField } from '@/ui/components';

const OUTCOME: Record<Exclude<RestoreOutcome, 'ok'>, string> = {
  'wrong-passphrase': 'That passphrase didn’t open this file. Nothing was changed.',
  newer: 'This backup is from a newer version of Annum. Update Annum, then try again.',
  'not-a-backup': 'This file isn’t an Annum backup. Nothing was changed.',
};

/**
 * Import backup: choose the file (Files, AirDrop, iCloud Drive), type its passphrase, restore.
 * Used from Welcome (new phone), Settings, and the can't-open screen.
 */
export function RestoreForm({ replaces, onDone }: { replaces: boolean; onDone: () => void }) {
  const [file, setFile] = useState<{ uri: string; name: string } | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const choose = async () => {
    const picked = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
    });
    if (picked.canceled) return;
    setFile({ uri: picked.assets[0].uri, name: picked.assets[0].name });
    setProblem(null);
  };

  const restore = async () => {
    if (!file) return;
    setBusy(true);
    setProblem(null);
    try {
      const outcome = await restoreFrom(file.uri, passphrase);
      if (outcome === 'ok') onDone();
      else setProblem(OUTCOME[outcome]);
    } catch {
      setProblem('Annum couldn’t read that file. Nothing was changed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: space[20] }}>
      {replaces ? (
        <GuardrailNote tone="heads-up">
          Restoring replaces everything Annum has on this phone with what’s in the backup.
        </GuardrailNote>
      ) : null}
      <View style={{ gap: space[8] }}>
        <Button
          variant="secondary"
          label={file ? 'Choose a different file' : 'Choose backup file'}
          onPress={() => void choose()}
          testID="restore-choose"
        />
        {file ? (
          <Text variant="footnote" tone="secondary" testID="restore-file">
            {file.name}
          </Text>
        ) : null}
      </View>
      {file ? (
        <TextField
          label="Passphrase for this file"
          value={passphrase}
          onChangeText={setPassphrase}
          secure
          autoFocus
          onSubmitEditing={() => void restore()}
          testID="restore-passphrase"
        />
      ) : null}
      {problem ? (
        <GuardrailNote tone="heads-up" testID="restore-problem">
          {problem}
        </GuardrailNote>
      ) : null}
      <Button
        variant="primary"
        label={busy ? 'Restoring…' : 'Restore'}
        disabled={!file || !passphrase || busy}
        onPress={() => void restore()}
        testID="restore-confirm"
      />
    </View>
  );
}
