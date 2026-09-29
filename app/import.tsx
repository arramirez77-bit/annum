import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';

import { fileName, pickBankFile, readFileText } from '@/data/bank-file';
import {
  csvBalance,
  fileTransactions,
  formatShortDate,
  guessDateOrder,
  readBankFile,
  type Account,
  type BankFile,
  type Cents,
  type CsvMapping,
} from '@/domain';
import { ACCOUNT_TYPES, owes } from '@/state/account-views';
import { buildImportPreview, buildImportResult, lastImportRow } from '@/state/import-views';
import { useOnboarding } from '@/state/onboarding';
import { newRecordId, useAppStore, type ImportOutcome } from '@/state/store';
import { space } from '@/theme';
import {
  AmountInput,
  Button,
  Chip,
  GuardrailNote,
  LedgerRow,
  NumberedSteps,
  ScreenScroll,
  SettingsGroup,
  SettingsRow,
  Text,
  TextField,
} from '@/ui/components';

const STEPS = [
  { title: 'Download transactions', detail: 'On your bank’s website, choose CSV or OFX' },
  { title: 'Choose the file', detail: 'Or share it to Annum from Files or Mail' },
  { title: 'Check what we found', detail: 'Annum skips anything you already imported' },
];

const UNREADABLE =
  'Annum couldn’t read that file. It needs to be a CSV or OFX/QFX download from your bank. Nothing was changed.';

type Loaded = { name: string; file: BankFile };

function ColumnPicker({
  label,
  header,
  value,
  onChange,
  testID,
}: {
  label: string;
  header: string[];
  value: number | undefined;
  onChange: (i: number) => void;
  testID: string;
}) {
  return (
    <View style={{ gap: space[8] }}>
      <Text variant="subhead" tone="secondary">
        {label}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[8] }}>
        {header.map((h, i) => (
          <Chip
            key={`${h}-${i}`}
            kind="category"
            label={h || `Column ${i + 1}`}
            selected={value === i}
            onPress={() => onChange(i)}
            testID={`${testID}-${i}`}
          />
        ))}
      </View>
    </View>
  );
}

// S11 Import a file (CSV / OFX / QFX). docs/05, docs/02 "Fallbacks".
export default function ImportFile() {
  const params = useLocalSearchParams<{ file?: string }>();
  const onboarding = useAppStore((s) => s.phase === 'onboarding');
  const data = useAppStore((s) => s.data);
  const prefs = useAppStore((s) => s.prefs);
  const draftAccounts = useOnboarding((s) => s.accounts);
  const accounts = onboarding ? draftAccounts : data.accounts;
  /** Connected banks (and the sample bank) update themselves: files go to the other accounts. */
  const importable = useMemo(
    () => accounts.filter((a) => a.source !== 'demo' && a.source !== 'plaid'),
    [accounts],
  );

  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [mapping, setMapping] = useState<CsvMapping | null>(null);
  const [editColumns, setEditColumns] = useState(false);
  const [target, setTarget] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<Account['type']>('checking');
  const [balance, setBalance] = useState<Cents | null>(null);
  /** When the prefilled balance came from the file, the day it's from. */
  const [balanceFrom, setBalanceFrom] = useState<string | null>(null);
  const [howTo, setHowTo] = useState(false);
  const [done, setDone] = useState<{ outcome: ImportOutcome; account: Account } | null>(null);
  /** OFX files can hold several accounts (checking and savings together): which one now. */
  const [statement, setStatement] = useState(0);

  /** OFX: point the review at one of the file's accounts, matching an account Annum knows. */
  const pickStatement = useCallback(
    (file: Extract<BankFile, { kind: 'ofx' }>, i: number) => {
      const s = file.statements[i];
      const match =
        importable.find((a) => s.last4 && a.last4 === s.last4) ??
        importable.find((a) => a.type === s.type);
      setStatement(i);
      setTarget(match?.id ?? 'new');
      setNewType(s.type);
      setNewName('');
      setBalance(s.balance ?? match?.balance ?? null);
      setBalanceFrom(s.balance !== undefined ? (s.balanceDate ?? null) : null);
    },
    [importable],
  );

  /** Read a file's text into the review step. */
  const load = useCallback(
    (text: string, name: string) => {
      setProblem(null);
      setDone(null);
      const file = readBankFile(text, prefs.importMappings);
      if (file.kind === 'unreadable' || file.kind === 'empty') {
        setProblem(file.kind === 'empty' ? 'That file has no transactions in it.' : UNREADABLE);
        return;
      }
      setLoaded({ name, file });
      setEditColumns(file.kind === 'csv' && !file.mapping);
      setMapping(file.kind === 'csv' ? file.mapping : null);
      setStatement(0);
      if (file.kind === 'ofx') {
        pickStatement(file, 0);
      } else {
        setTarget(null);
        const fromFile = file.mapping ? csvBalance(file, file.mapping) : undefined;
        setBalance(fromFile?.amount ?? null);
        setBalanceFrom(fromFile?.date ?? null);
      }
    },
    [pickStatement, prefs.importMappings],
  );

  const open = useCallback(
    (uri: string, name: string) =>
      readFileText(uri).then(
        (text) => load(text, name),
        () => setProblem(UNREADABLE),
      ),
    [load],
  );

  // "Open in Annum" from Files or Mail arrives with the file; read it once.
  const opened = useRef<string | null>(null);
  useEffect(() => {
    if (!params.file || opened.current === params.file) return;
    opened.current = params.file;
    void open(params.file, fileName(params.file));
  }, [params.file, open]);

  const choose = async () => {
    const picked = await pickBankFile().catch(() => null);
    if (picked) await open(picked.uri, picked.name);
  };

  const file = loaded?.file;
  const incoming = useMemo(
    () => (file ? fileTransactions(file, mapping, statement) : []),
    [file, mapping, statement],
  );
  const existing = accounts.find((a) => a.id === target);
  const preview = buildImportPreview(data, incoming, existing ? existing.id : null);
  const accountType = existing?.type ?? newType;
  const last = lastImportRow(prefs.lastImport);

  const importNow = () => {
    if (!file || !target) return;
    const current = file.kind === 'ofx' ? file.statements[statement] : undefined;
    const defaultName = ACCOUNT_TYPES.find((t) => t.value === newType)?.label ?? 'Account';
    const account: Account = existing
      ? {
          ...existing,
          balance: balance ?? existing.balance,
          ...(current?.last4 ? { last4: current.last4 } : {}),
        }
      : {
          id: newRecordId('account'),
          name: newName.trim() || defaultName,
          type: newType,
          balance: balance ?? 0,
          source: 'import',
          status: 'ok',
          ...(current?.last4 ? { last4: current.last4 } : {}),
        };
    if (file.kind === 'csv' && mapping) useAppStore.getState().rememberMapping(file.key, mapping);
    const plan = { account, transactions: incoming };
    const outcome = onboarding
      ? useOnboarding.getState().importStatement(plan)
      : useAppStore.getState().importStatement(plan);
    setDone({ outcome, account });
  };

  // Result ---------------------------------------------------------------------
  if (done) {
    const r = buildImportResult(done.outcome, done.account);
    return (
      <ScreenScroll testID="import-result">
        <Text variant="title2" accessibilityRole="header">
          {r.title}
        </Text>
        <View style={{ gap: space[8] }}>
          {r.lines.map((line) => (
            <Text key={line} tone="secondary">
              {line}
            </Text>
          ))}
        </View>
        <View style={{ gap: space[8] }}>
          {r.splitDepositId ? (
            <Button
              variant="secondary"
              label="Split it"
              onPress={() =>
                router.push({ pathname: '/deposit/[id]', params: { id: r.splitDepositId! } })
              }
              testID="import-split"
            />
          ) : null}
          {r.showBills && !onboarding ? (
            <Button
              variant="secondary"
              label="Review bills"
              onPress={() => router.push('/bills')}
              testID="import-bills"
            />
          ) : null}
          <Button
            variant="primary"
            label={onboarding ? 'Continue' : 'Done'}
            onPress={() => (onboarding ? router.replace('/accounts') : router.back())}
            testID="import-done"
          />
          {loaded?.file.kind === 'ofx' && statement + 1 < loaded.file.statements.length ? (
            <Button
              variant="secondary"
              label="Next account in this file"
              onPress={() => {
                if (loaded.file.kind === 'ofx') pickStatement(loaded.file, statement + 1);
                setDone(null);
              }}
              testID="import-next-account"
            />
          ) : null}
          <Button
            variant="quiet"
            label="Import another file"
            onPress={() => {
              setDone(null);
              setLoaded(null);
            }}
            testID="import-another"
          />
        </View>
      </ScreenScroll>
    );
  }

  // Start ----------------------------------------------------------------------
  if (!file) {
    return (
      <ScreenScroll testID="import" fill>
        <Text variant="title1" accessibilityRole="header">
          Import from your bank
        </Text>
        <Text variant="callout" tone="secondary">
          For banks that don’t connect. Works with the CSV or OFX file most banks let you download.
        </Text>
        <NumberedSteps steps={STEPS} />
        {last ? (
          <>
            <Text variant="footnote" tone="secondary" accessibilityRole="header">
              Last import
            </Text>
            <LedgerRow
              surface="dark"
              title={last.title}
              subtitle={last.subtitle}
              value={last.value}
              testID="import-last"
            />
          </>
        ) : null}
        {problem ? (
          <GuardrailNote tone="heads-up" testID="import-problem">
            {problem}
          </GuardrailNote>
        ) : null}
        {howTo ? (
          <GuardrailNote tone="info">
            Sign in on your bank’s website, open the account, and look for “Download” or “Export”
            near the transactions. Choose CSV (spreadsheet) or OFX/QFX (Quicken), and the dates
            since your last import. Save it to Files, or email it to yourself.
          </GuardrailNote>
        ) : null}
        <View style={{ flex: 1 }} />
        <Button
          variant="primary"
          label="Choose file"
          onPress={() => void choose()}
          testID="import-choose"
        />
        <Button
          variant="quiet"
          label={howTo ? 'Hide the steps' : 'How to download from your bank'}
          onPress={() => setHowTo((v) => !v)}
          testID="import-howto"
        />
      </ScreenScroll>
    );
  }

  // Review ---------------------------------------------------------------------
  const csv = file.kind === 'csv' ? file : undefined;
  return (
    <ScreenScroll testID="import-review">
      <View style={{ gap: space[4] }}>
        <Text variant="title2" accessibilityRole="header">
          {loaded?.name}
        </Text>
        <Text tone="secondary" testID="import-sentence">
          {preview.sentence}
        </Text>
      </View>

      {file.kind === 'ofx' && file.statements.length > 1 ? (
        <View style={{ gap: space[8] }}>
          <Text variant="subhead" tone="secondary">
            {`This file has ${file.statements.length} accounts`}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[8] }}>
            {file.statements.map((st, i) => (
              <Chip
                key={`${st.type}-${st.last4}-${i}`}
                kind="category"
                label={`${ACCOUNT_TYPES.find((t) => t.value === st.type)?.label ?? 'Account'}${st.last4 ? ` ··${st.last4}` : ''}`}
                selected={statement === i}
                onPress={() => pickStatement(file, i)}
                testID={`import-statement-${i}`}
              />
            ))}
          </View>
        </View>
      ) : null}

      {csv && (editColumns || !mapping) ? (
        <View style={{ gap: space[16] }}>
          <Text variant="headline" accessibilityRole="header">
            Which column is which?
          </Text>
          <ColumnPicker
            label="Date"
            header={csv.header}
            value={mapping?.date}
            onChange={(date) =>
              setMapping((m) => ({
                description: 0,
                outflowPositive: false,
                ...m,
                date,
                dateOrder: guessDateOrder(csv.rows.map((r) => r[date] ?? '')),
              }))
            }
            testID="column-date"
          />
          <ColumnPicker
            label="Description"
            header={csv.header}
            value={mapping?.description}
            onChange={(description) =>
              setMapping((m) => ({
                date: 0,
                outflowPositive: false,
                dateOrder: 'mdy',
                ...m,
                description,
              }))
            }
            testID="column-description"
          />
          <ColumnPicker
            label="Amount"
            header={csv.header}
            value={mapping?.amount}
            onChange={(amount) =>
              setMapping((m) => {
                const base = {
                  date: 0,
                  description: 0,
                  outflowPositive: false,
                  dateOrder: 'mdy' as const,
                  ...m,
                  amount,
                };
                delete base.debit;
                delete base.credit;
                return base;
              })
            }
            testID="column-amount"
          />
        </View>
      ) : null}

      {preview.samples.length ? (
        <View>
          {preview.samples.map((t, i) => (
            <LedgerRow
              key={`${t.title}-${i}`}
              surface="dark"
              title={t.title}
              subtitle={t.subtitle}
              value={t.value}
              last={i === preview.samples.length - 1}
            />
          ))}
        </View>
      ) : null}

      {csv && mapping ? (
        <SettingsGroup>
          <SettingsRow
            variant="toggle"
            label="Money out shows as positive in this file"
            value={mapping.outflowPositive}
            onValueChange={(outflowPositive) => setMapping({ ...mapping, outflowPositive })}
            testID="import-flip"
          />
          <SettingsRow
            variant="chevron"
            label={editColumns ? 'Done choosing columns' : 'Change columns'}
            onPress={() => setEditColumns((v) => !v)}
            testID="import-columns"
            last
          />
        </SettingsGroup>
      ) : null}

      <View style={{ gap: space[8] }}>
        <Text variant="headline" accessibilityRole="header">
          Which account is this?
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[8] }}>
          {importable.map((a) => (
            <Chip
              key={a.id}
              kind="category"
              label={a.name}
              selected={target === a.id}
              onPress={() => {
                setTarget(a.id);
                if (file.kind !== 'ofx' || file.statements[statement].balance === undefined) {
                  const fromFile = csv && mapping ? csvBalance(csv, mapping) : undefined;
                  setBalance(fromFile?.amount ?? a.balance);
                  setBalanceFrom(fromFile?.date ?? null);
                }
              }}
              testID={`import-account-${a.id}`}
            />
          ))}
          <Chip
            kind="category"
            label="A new account"
            selected={target === 'new'}
            onPress={() => setTarget('new')}
            testID="import-account-new"
          />
        </View>
      </View>

      {target === 'new' ? (
        <View style={{ gap: space[16] }}>
          <TextField
            label="Name"
            value={newName}
            onChangeText={setNewName}
            placeholder="Checking"
            autoCapitalize="words"
            testID="import-new-name"
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[8] }}>
            {ACCOUNT_TYPES.filter((t) => t.value !== 'brokerage' && t.value !== 'loan').map((t) => (
              <Chip
                key={t.value}
                kind="category"
                label={t.label}
                selected={newType === t.value}
                onPress={() => setNewType(t.value)}
                testID={`import-new-type-${t.value}`}
              />
            ))}
          </View>
        </View>
      ) : null}

      {target ? (
        <AmountInput
          label={owes({ type: accountType } as Account) ? 'Owed today' : 'Balance today'}
          valueCents={balance}
          onChangeCents={(cents) => {
            setBalance(cents);
            setBalanceFrom(null);
          }}
          helper={
            balanceFrom
              ? `From the file, as of ${formatShortDate(balanceFrom)}. If your bank shows a newer number, use that; every number in Annum starts from it.`
              : 'What your bank shows right now. Every number in Annum starts from it.'
          }
          testID="import-balance"
        />
      ) : null}

      <View style={{ gap: space[8] }}>
        <Button
          variant="primary"
          label={preview.primary}
          disabled={!target || !preview.canImport || (csv !== undefined && !mapping)}
          onPress={importNow}
          testID="import-confirm"
        />
        <Button
          variant="quiet"
          label="Choose a different file"
          onPress={() => setLoaded(null)}
          testID="import-other"
        />
      </View>
    </ScreenScroll>
  );
}
