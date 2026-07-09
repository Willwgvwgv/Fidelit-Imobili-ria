import { FinancialAccount, FinancialCategory, FinancialTransaction } from '../../../../../../types';

export interface InvoiceDetailsModalProps {
  isOpen: boolean;
  card: FinancialAccount | null;
  onClose: () => void;
  period: Date;
  onPeriodChange: (date: Date) => void;

  data: {
    accounts: FinancialAccount[];
    categories: FinancialCategory[];
    transactions: FinancialTransaction[];
  };

  invoiceService: {
    getInvoicePeriodRangeStr: (card: FinancialAccount, period: Date) => string;
    getInvoiceTransactions: (cardId: string, period: Date) => FinancialTransaction[];
    getInvoiceTotalAmount: (cardId: string, period: Date) => number;
    getInvoiceStatus: (cardId: string, period: Date) => string;
  };

  formatters: {
    currency: (val: number) => string;
    formatDateBR: (date: string | null | undefined) => string;
  };

  onEditTransaction?: (tx: FinancialTransaction) => void;
  onDeleteTransaction?: (id: string) => void;
  onDuplicateTransaction?: (tx: FinancialTransaction) => void;
  onQuickLaunch?: (card: FinancialAccount) => void;
  onPayInvoice?: (card: FinancialAccount) => void;
  categoryGroups?: Record<string, string>;
}
