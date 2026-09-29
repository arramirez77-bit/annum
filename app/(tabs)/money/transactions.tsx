import { TransactionsList } from '@/ui/flows/TransactionsList';

// S1 Transactions from Money.
export default function TransactionsScreen() {
  return <TransactionsList parentTitle="Money" detailPath="/money/transaction/[id]" />;
}
