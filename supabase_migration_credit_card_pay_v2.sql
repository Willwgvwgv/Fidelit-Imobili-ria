-- Migration: Add fields for credit card invoice billing cycle and payment transaction linkage
-- Adds closing_day and due_day to financial_accounts
-- Adds settled_by_transaction_id to financial_transactions

ALTER TABLE financial_accounts ADD COLUMN IF NOT EXISTS closing_day INTEGER NULL;
ALTER TABLE financial_accounts ADD COLUMN IF NOT EXISTS due_day INTEGER NULL;

ALTER TABLE financial_transactions ADD COLUMN IF NOT EXISTS settled_by_transaction_id TEXT NULL;

-- Optionally add a foreign key constraint from settled_by_transaction_id to financial_transactions(id) if needed,
-- but a simple TEXT column is robust enough and matches requirements.
