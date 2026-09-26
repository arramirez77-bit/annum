import { Redirect, Stack } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import type { SpikeStep } from '@/data/spikes/sqlcipher';
import { color, layout, space } from '@/theme';
import { Button, GuardrailNote, LedgerRow, Text } from '@/ui/components';
import { pushedHeader } from '@/ui/navigation';

/** M0.5 spike diagnostics (development builds only). See SPIKES.md. */
function Spikes() {
  const [steps, setSteps] = useState<SpikeStep[] | null>(null);
  const [path, setPath] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  const run = async () => {
    setProblem(null);
    try {
      const { runSqlcipherSpike } = await import('@/data/spikes/sqlcipher');
      const result = await runSqlcipherSpike();
      setSteps(result.steps);
      setPath(result.path);
    } catch (e) {
      setProblem(e instanceof Error ? e.message : String(e));
    }
  };

  const [backup, setBackup] = useState<SpikeStep[] | null>(null);
  const runBackup = async () => {
    setProblem(null);
    try {
      const { runBackupCheck } = await import('@/state/checks/backup');
      setBackup(await runBackupCheck());
    } catch (e) {
      setProblem(e instanceof Error ? e.message : String(e));
    }
  };

  const passed = steps?.every((s) => s.pass) ?? false;
  return (
    <ScrollView
      style={{ backgroundColor: color.bgBase }}
      contentContainerStyle={{ padding: layout.screenMargin, gap: space[16] }}
      testID="spikes"
    >
      <Text tone="secondary">Checks that the local database is encrypted with SQLCipher.</Text>
      <Button variant="primary" label="Run SQLCipher check" onPress={run} testID="run-sqlcipher" />
      {problem ? (
        <GuardrailNote tone="heads-up">{`That didn't work: ${problem}`}</GuardrailNote>
      ) : null}
      {steps ? (
        <View>
          {steps.map((s, i) => (
            <LedgerRow
              key={s.name}
              surface="dark"
              title={s.name}
              subtitle={s.detail}
              value={s.pass ? 'Pass' : 'Fail'}
              last={i === steps.length - 1}
            />
          ))}
        </View>
      ) : null}
      {steps ? (
        <Text testID="sqlcipher-result">
          {passed ? 'SQLCipher: all checks pass' : 'SQLCipher: a check failed'}
        </Text>
      ) : null}
      {path ? (
        <Text variant="footnote" tone="secondary" selectable testID="sqlcipher-path">
          {path}
        </Text>
      ) : null}
      <Text tone="secondary">
        M5: exports your data to an encrypted file and restores it (your own data, not demo).
      </Text>
      <Button
        variant="secondary"
        label="Run backup round trip"
        onPress={runBackup}
        testID="run-backup"
      />
      {backup ? (
        <View>
          {backup.map((s, i) => (
            <LedgerRow
              key={s.name}
              surface="dark"
              title={s.name}
              subtitle={s.detail}
              value={s.pass ? 'Pass' : 'Fail'}
              last={i === backup.length - 1}
            />
          ))}
        </View>
      ) : null}
      {backup ? (
        <Text testID="backup-result">
          {backup.every((s) => s.pass) ? 'Backup: all checks pass' : 'Backup: a check failed'}
        </Text>
      ) : null}
    </ScrollView>
  );
}

export default function SpikesScreen() {
  if (!__DEV__) return <Redirect href="/" />;
  return (
    <>
      <Stack.Screen options={pushedHeader('Spikes', 'Scenarios')} />
      <Spikes />
    </>
  );
}
