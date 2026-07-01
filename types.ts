
export enum UserRole {
  ADMIN = 'ADMIN',
  BROKER = 'BROKER'
}

export enum CommissionStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE'
}

export enum SplitRole {
  BROKER = 'Corretor',
  CAPTURER = 'Captador',
  PARTNER = 'Sócio',
  AGENCY = 'Agência',
  MANAGER = 'Gerente'
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  agencyId: string;
  phone?: string;
  created_at?: string;
}

export interface BrokerSplit {
  id?: string;
  sale_id?: string;
  brokerId: string; // Map to broker_id
  brokerName: string; // Map to broker_name
  percentage: number;
  calculatedValue: number; // Map to calculated_value
  status: CommissionStatus;
  role?: SplitRole;
  paymentDate?: string; // Map to payment_date
  paymentMethod?: string; // Map to payment_method
  forecastDate?: string; // Map to forecast_date
  receiptData?: string; // Map to receipt_data
  installment_number?: number;
  total_installments?: number;
  notes?: string;
  discount_value?: number;
}

export interface Sale {
  id: string;
  agencyId: string; // Map to agency_id
  saleDate: string; // Map to sale_date
  propertyAddress: string; // Map to property_address
  propertyCity: string;
  propertyCep: string;
  propertyUf: string;
  propertyType: 'urbano' | 'rural';
  buyerName: string; // Map to buyer_name
  sellerName: string; // Map to seller_name
  vgv: number;
  commissionPercentage: number; // Map to commission_percentage
  totalCommissionValue: number; // Map to total_commission_value
  invoiceIssued: boolean; // Map to invoice_issued
  invoiceNumber?: string; // Map to invoice_number
  notes?: string;
  status?: string;
  buyer_cpf?: string;
  seller_cpf?: string;
  is_installment?: boolean;
  installments?: any;
  splits: BrokerSplit[];
  created_at?: string;
}

export enum TransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
  TRANSFER = 'TRANSFER'
}

export enum TransactionStatus {
  PAID = 'PAID',
  PENDING = 'PENDING'
}

export interface FinancialAccount {
  id: string;
  agency_id: string;
  name: string;
  initial_balance: number;
  current_balance: number;
  color?: string;
  is_default: boolean;
  type?: string;
  credit_limit?: number;
  is_active: boolean;
}

export interface FinancialCategory {
  id: string;
  agency_id: string;
  name: string;
  type: TransactionType;
  color?: string;
}

export interface FinancialTransaction {
  id: string;
  agency_id: string;
  description: string;
  amount: number;
  type: TransactionType;
  category_id?: string;
  account_id?: string;
  financial_account_id?: string | null;
  status: TransactionStatus;
  due_date: string;
  payment_date?: string;
  notes?: string;
  attachment_url?: string;
  paid_amount?: number;
  is_transfer?: boolean;
  transfer_group_id?: string;
  installment_number?: number;
  total_installments?: number;
  contact_name?: string | null;
}

export interface Agency {
  id: string;
  name: string;
  slug: string;
  logo_url?: string;
  created_at?: string;
}

export interface DashboardStats {
  totalVGV: number;
  totalCommission: number;
  paidCommission: number;
  pendingCommission: number;
  overdueCommission: number;
  brokerPerformance: { name: string; vgv: number; commissions: number }[];
}

export type BrokerEntryType = 'COMMISSION' | 'CREDIT' | 'DEBIT' | 'PAYMENT';

export interface BrokerEntry {
  id: string;
  agency_id: string;
  broker_id: string;
  broker_name: string;
  type: BrokerEntryType;
  description: string;
  amount: number; // sempre positivo — o tipo define se é crédito ou débito
  date: string;
  created_at: string;
  sale_id?: string | null; // referência à venda se for COMMISSION
}
