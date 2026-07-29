import { FinancialAccount } from '../../../types';

export interface PayInvoiceModalProps {
  isOpen: boolean;
  card: FinancialAccount | null;
  onClose: () => void;
  loading: boolean;
  
  // State and Handlers
  sourceAccountId: string;
  onSourceAccountIdChange: (id: string) => void;
  amountStr: string;
  onAmountStrChange: (amount: string) => void;
  paymentDate: string;
  onPaymentDateChange: (date: string) => void;
  onConfirm: () => void;

  // External functions and data
  data: {
    accounts: FinancialAccount[];
    currentPeriod: Date;
  };
  invoiceService: {
    getInvoicePeriodRangeStr: (card: FinancialAccount, period: Date) => string;
    getAccountLiveBalance: (account: FinancialAccount) => number;
  };
  formatters: {
    currency: (val: number) => string;
    formatBRL: (val: string | number | undefined | null) => string;
  };
}
