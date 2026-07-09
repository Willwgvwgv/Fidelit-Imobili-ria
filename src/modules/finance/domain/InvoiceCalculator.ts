import { FinancialAccount, FinancialTransaction } from '../../../../types';
import { TransactionStatus, TransactionType, InvoiceStatus } from '../constants';

/**
 * Domain-level calculations and logic for Credit Card Invoices.
 */

export const isTxInCardInvoicePeriod = (
  dueDateStr: string,
  card: FinancialAccount,
  targetPeriod: Date
): boolean => {
  const closingDay = card.closing_day;
  if (!closingDay || closingDay < 1 || closingDay > 31) {
    const parts = dueDateStr.split('-');
    if (parts.length < 2) return false;
    const txYear = parseInt(parts[0], 10);
    const txMonth = parseInt(parts[1], 10) - 1;
    return txYear === targetPeriod.getFullYear() && txMonth === targetPeriod.getMonth();
  }

  const targetYear = targetPeriod.getFullYear();
  const targetMonth = targetPeriod.getMonth();

  let prevYear = targetYear;
  let prevMonth = targetMonth - 1;
  if (prevMonth < 0) {
    prevMonth = 11;
    prevYear = targetYear - 1;
  }

  const daysInPrevMonth = new Date(prevYear, prevMonth + 1, 0).getDate();
  const safePrevDay = Math.min(closingDay, daysInPrevMonth);
  const startDateObj = new Date(prevYear, prevMonth, safePrevDay);
  startDateObj.setDate(startDateObj.getDate() + 1);

  const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  const safeTargetDay = Math.min(closingDay, daysInTargetMonth);
  const endDateObj = new Date(targetYear, targetMonth, safeTargetDay);

  const formatLocalYYYYMMDD = (d: Date) => {
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const dy = String(d.getDate()).padStart(2, '0');
    return `${yr}-${mo}-${dy}`;
  };

  const startDateStr = formatLocalYYYYMMDD(startDateObj);
  const endDateStr = formatLocalYYYYMMDD(endDateObj);

  return dueDateStr >= startDateStr && dueDateStr <= endDateStr;
};

export const getInvoiceTransactions = (
  cardId: string,
  card: FinancialAccount | undefined,
  transactions: FinancialTransaction[],
  period: Date
): FinancialTransaction[] => {
  if (!card) return [];
  return transactions.filter(t => {
    if (t.account_id !== cardId) return false;
    return isTxInCardInvoicePeriod(t.due_date, card, period);
  });
};

export const getInvoiceTotalAmount = (
  cardId: string,
  card: FinancialAccount | undefined,
  transactions: FinancialTransaction[],
  period: Date
): number => {
  if (!card) return 0;
  return transactions
    .filter(t => {
      if (t.account_id !== cardId) return false;
      if (t.type === TransactionType.TRANSFER) return false;
      return isTxInCardInvoicePeriod(t.due_date, card, period);
    })
    .reduce((sum, t) => sum + (t.amount || 0), 0);
};

export const getInvoiceStatus = (
  cardId: string,
  card: FinancialAccount | undefined,
  transactions: FinancialTransaction[],
  period: Date
): InvoiceStatus => {
  if (!card) return InvoiceStatus.ABERTA;
  
  const cardTxs = transactions.filter(t => {
    if (t.account_id !== cardId) return false;
    return isTxInCardInvoicePeriod(t.due_date, card, period);
  });

  if (cardTxs.length === 0) {
    return InvoiceStatus.ABERTA;
  }

  const allPaid = cardTxs.every(tx => 
    tx.status === TransactionStatus.PAID || 
    (tx.settled_by_transaction_id && tx.settled_by_transaction_id.trim() !== '')
  );

  if (allPaid) {
    return InvoiceStatus.PAGA;
  }

  const closingDay = card.closing_day || 10;
  const dueDay = card.due_day || 15;
  
  const targetYear = period.getFullYear();
  const targetMonth = period.getMonth();
  const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  
  const safeDueDay = Math.min(dueDay, daysInTargetMonth);
  const dueDate = new Date(targetYear, targetMonth, safeDueDay);
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);

  if (today > dueDate) {
    return InvoiceStatus.VENCIDA;
  }

  const safeClosingDay = Math.min(closingDay, daysInTargetMonth);
  const closingDate = new Date(targetYear, targetMonth, safeClosingDay);
  closingDate.setHours(0, 0, 0, 0);
  if (today > closingDate) {
    return InvoiceStatus.FECHADA;
  }

  return InvoiceStatus.ABERTA;
};

export const getInvoicePeriodRangeStr = (
  card: FinancialAccount,
  targetPeriod: Date
): string => {
  const closingDay = card.closing_day;
  if (!closingDay || closingDay < 1 || closingDay > 31) {
    const startOfMonth = new Date(targetPeriod.getFullYear(), targetPeriod.getMonth(), 1);
    const endOfMonth = new Date(targetPeriod.getFullYear(), targetPeriod.getMonth() + 1, 0);
    
    const formatBR = (d: Date) => {
      const dy = String(d.getDate()).padStart(2, '0');
      const mo = String(d.getMonth() + 1).padStart(2, '0');
      const yr = d.getFullYear();
      return `${dy}/${mo}/${yr}`;
    };
    return `${formatBR(startOfMonth)} a ${formatBR(endOfMonth)}`;
  }

  const targetYear = targetPeriod.getFullYear();
  const targetMonth = targetPeriod.getMonth();

  let prevYear = targetYear;
  let prevMonth = targetMonth - 1;
  if (prevMonth < 0) {
    prevMonth = 11;
    prevYear = targetYear - 1;
  }

  const daysInPrevMonth = new Date(prevYear, prevMonth + 1, 0).getDate();
  const safePrevDay = Math.min(closingDay, daysInPrevMonth);
  const startDateObj = new Date(prevYear, prevMonth, safePrevDay);
  startDateObj.setDate(startDateObj.getDate() + 1);

  const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  const safeTargetDay = Math.min(closingDay, daysInTargetMonth);
  const endDateObj = new Date(targetYear, targetMonth, safeTargetDay);

  const formatBR = (d: Date) => {
    const dy = String(d.getDate()).padStart(2, '0');
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const yr = d.getFullYear();
    return `${dy}/${mo}/${yr}`;
  };

  return `${formatBR(startDateObj)} a ${formatBR(endDateObj)}`;
};

export const getPurchaseInvoicePeriodStr = (
  dueDateStr: string,
  card: FinancialAccount,
  currentPeriod: Date
): string => {
  const testPeriods = [
    new Date(currentPeriod.getFullYear(), currentPeriod.getMonth() - 1, 1),
    new Date(currentPeriod.getFullYear(), currentPeriod.getMonth(), 1),
    new Date(currentPeriod.getFullYear(), currentPeriod.getMonth() + 1, 1),
  ];
  
  for (const period of testPeriods) {
    if (isTxInCardInvoicePeriod(dueDateStr, card, period)) {
      const monthNames = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
      ];
      return `${monthNames[period.getMonth()]} de ${period.getFullYear()}`;
    }
  }
  
  const parts = dueDateStr.split('-');
  if (parts.length >= 2) {
    const monthNames = [
      "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];
    const mIdx = parseInt(parts[1], 10) - 1;
    if (mIdx >= 0 && mIdx < 12) {
      return `${monthNames[mIdx]} de ${parts[0]}`;
    }
  }
  
  return dueDateStr;
};

export const getPendingInvoiceAmount = (
  cardId: string,
  card: FinancialAccount | undefined,
  transactions: FinancialTransaction[],
  currentPeriod: Date
): number => {
  if (!card) return 0;
  return transactions
    .filter(t => {
      if (t.account_id !== cardId) return false;
      if (t.status !== TransactionStatus.PENDING) return false;
      return isTxInCardInvoicePeriod(t.due_date, card, currentPeriod);
    })
    .reduce((sum, t) => sum + t.amount, 0);
};
