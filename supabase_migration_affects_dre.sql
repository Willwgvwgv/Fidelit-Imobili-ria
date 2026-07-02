-- Migration: Add affects_dre column to financial_categories
-- This flag determines if transactions in a given category compose the DRE (Income Statement).
-- By default, all categories affect the DRE (affects_dre = TRUE).
-- Third-party transiting flows (like Rent Collection and Rent Transfer to Owner) should be marked as FALSE.

ALTER TABLE financial_categories ADD COLUMN IF NOT EXISTS affects_dre BOOLEAN NOT NULL DEFAULT TRUE;

-- Update existing third-party categories to not affect DRE
UPDATE financial_categories
SET affects_dre = FALSE
WHERE name = 'Repasse de Aluguel ao Proprietário' OR name = 'Locações / Administração de Imóveis';
