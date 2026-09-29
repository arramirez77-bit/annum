import { useLocalSearchParams } from 'expo-router';

import { useAppStore } from '@/state/store';
import { TransactionDetail } from '@/ui/flows/TransactionDetail';

// S9 from one account's Transactions (root stack, above Settings).
export default function AccountTransactionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const accountName = useAppStore((s) => {
    const t = s.data.transactions.find((x) => x.id === id);
    return s.data.accounts.find((a) => a.id === t?.accountId)?.name;
  });
  return <TransactionDetail id={id} parentTitle={accountName ?? 'Back'} />;
}
