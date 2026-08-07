-- Migration: Add bank_transaction_id to financial_transactions
-- Description: Link financial_transactions with bank_transactions for reconciliation

ALTER TABLE financial_transactions 
ADD COLUMN IF NOT EXISTS bank_transaction_id uuid 
REFERENCES bank_transactions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_financial_transactions_bank_tx 
ON financial_transactions(bank_transaction_id);
