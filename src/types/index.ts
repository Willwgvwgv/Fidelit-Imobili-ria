export type ExpenseType = 'FIXA' | 'VARIAVEL';
export type ExpenseStatus = 'PAGO' | 'PENDENTE';

export interface CompanySettings {
  name: string;
  cnpj: string;
  responsible: string;
  logoBase64?: string;
  city: string;
  state: string;
  email?: string;
  phone?: string;
  accountantName?: string;
  accountantEmail?: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  iconName?: string;
  description?: string;
}

export interface FixedExpense {
  id: string;
  name: string;
  categoryId: string;
  supplier: string;
  defaultAmount: number;
  dueDay: number; // 1-31
  costCenter?: string;
  observation?: string;
  active: boolean;
  monthlyRecurrence: boolean;
  createdAt: string;
}

export interface ReceiptAttachment {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  dataBase64: string;
  uploadedAt: string;
}

export interface ExpenseItem {
  id: string;
  competenceId: string; // e.g., "2026-07"
  type: ExpenseType;
  fixedExpenseId?: string;
  description: string;
  categoryId: string;
  supplier: string;
  amount: number;
  dueDate: string; // YYYY-MM-DD
  paymentDate?: string;
  status: ExpenseStatus;
  costCenter?: string;
  observation?: string;
  receipts?: ReceiptAttachment[];
  createdAt: string;
  updatedAt: string;
}

export interface Competence {
  id: string; // "YYYY-MM"
  year: number;
  month: number; // 1-12
  label: string; // e.g. "Julho/2026"
  createdAt: string;
  closed: boolean;
  notes?: string;
}

export interface FilterOptions {
  search: string;
  categoryId: string;
  supplier: string;
  type: 'TODAS' | 'FIXA' | 'VARIAVEL';
  status: 'TODAS' | 'PAGO' | 'PENDENTE';
  minAmount?: number;
  maxAmount?: number;
  startDate?: string;
  endDate?: string;
}
