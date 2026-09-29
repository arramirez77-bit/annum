import { useLocalSearchParams } from 'expo-router';

import { TransactionDetail } from '@/ui/flows/TransactionDetail';

// S9 from the Money tab's Transactions.
export default function MoneyTransactionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <TransactionDetail id={id} parentTitle="Transactions" />;
}
