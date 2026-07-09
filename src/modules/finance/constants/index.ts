export enum TransactionStatus {
  PAID = 'PAID',
  PENDING = 'PENDING'
}

export enum TransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
  TRANSFER = 'TRANSFER'
}

export enum InvoiceStatus {
  ABERTA = 'ABERTA',
  FECHADA = 'FECHADA',
  PAGA = 'PAGA',
  VENCIDA = 'VENCIDA'
}

export enum RecurrenceType {
  NONE = 'NONE',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY'
}

export enum AccountType {
  CHECKING = 'Corrente',
  SAVINGS = 'Poupança',
  INVESTMENT = 'Investimentos',
  CREDIT_CARD = 'credit_card'
}
