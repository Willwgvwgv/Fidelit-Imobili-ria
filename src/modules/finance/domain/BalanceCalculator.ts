import { FinancialAccount, FinancialTransaction } from '../../../../types';
import { TransactionStatus, TransactionType } from '../constants';

/**
 * Calculates the current real-time balance of a bank account, starting from its
 * initial balance and applying all settled (PAID) income, expense, and transfer transactions.
 */
export const getAccountLiveBalance = (
  account: FinancialAccount,
  transactions: FinancialTransaction[]
): number => {
  const sumTransactions = transactions
    .filter(t => t.account_id === account.id && t.status === TransactionStatus.PAID)
    .reduce((acc, curr) => {
      if (curr.type === TransactionType.INCOME) {
        return acc + (curr.amount || 0);
      } else if (curr.type === TransactionType.EXPENSE) {
        return acc - (curr.amount || 0);
      } else if (curr.type === TransactionType.TRANSFER) {
        return acc - (curr.amount || 0);
      }
      return acc;
    }, 0);
  return Number(account.initial_balance || 0) + sumTransactions;
};
