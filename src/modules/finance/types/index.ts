import { 
  FinancialAccount as GlobalFinancialAccount, 
  FinancialCategory as GlobalFinancialCategory, 
  FinancialTransaction as GlobalFinancialTransaction 
} from '../../../../types';

export type FinancialAccount = GlobalFinancialAccount;
export type FinancialCategory = GlobalFinancialCategory;
export type FinancialTransaction = GlobalFinancialTransaction;

export interface InvoiceItem {
  id: string;
  description: string;
  amount: number;
  dueDate: string;
  categoryName?: string;
  status: string;
}
