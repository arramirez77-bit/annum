import { useLocalSearchParams } from 'expo-router';

import { TransactionsList } from '@/ui/flows/TransactionsList';

// One account's Transactions, from a Settings account row (Andy, 2026-09-28).
export default function AccountTransactions() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <TransactionsList accountId={id} parentTitle="Settings" detailPath="/transaction/[id]" />;
}
