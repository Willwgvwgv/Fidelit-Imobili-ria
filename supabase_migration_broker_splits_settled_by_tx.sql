-- Migration: Add settled_by_transaction_id to broker_splits
-- Description: Links broker_splits with financial_transactions for mandatory expense reconciliation and audit tracking.

-- 1. Add settled_by_transaction_id to broker_splits matching financial_transactions(id) (TEXT type)
ALTER TABLE broker_splits 
ADD COLUMN IF NOT EXISTS settled_by_transaction_id TEXT NULL;

-- 2. Add Foreign Key constraint referencing financial_transactions(id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_broker_splits_settled_tx'
  ) THEN
    ALTER TABLE broker_splits 
    ADD CONSTRAINT fk_broker_splits_settled_tx 
    FOREIGN KEY (settled_by_transaction_id) 
    REFERENCES financial_transactions(id) 
    ON DELETE SET NULL;
  END IF;
END $$;

-- 3. Create index for fast lookups on settled financial transactions
CREATE INDEX IF NOT EXISTS idx_broker_splits_settled_tx 
ON broker_splits(settled_by_transaction_id);

