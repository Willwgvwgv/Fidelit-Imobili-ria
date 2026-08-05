/**
 * Centralized currency parsing and formatting utilities for Brazilian Real (BRL).
 */

/**
 * Robust Brazilian Real format to float number converter.
 * Converts strings like "R$ 1.500,50" or "1500,50" to 1500.50.
 */
export const parseBrlValue = (valueStr: string): number => {
  if (!valueStr) return 0;
  let clean = valueStr.replace(/[R$\s]/gi, '');
  if (!clean) return 0;
  
  // If there is a comma, it is the decimal separator (BRL standard)
  if (clean.includes(',')) {
    clean = clean.replace(/\./g, '').replace(',', '.');
  } else {
    // No comma. If there is a dot:
    // A single dot followed by exactly 3 digits is assumed to be a thousands separator (e.g., "1.500" -> 1500, but "1500.50" -> 1500.50)
    // Multiple dots (e.g. "1.500.000") are also treated as thousands separators and removed.
    const dotCount = (clean.match(/\./g) || []).length;
    if (dotCount > 1) {
      clean = clean.replace(/\./g, '');
    } else if (dotCount === 1) {
      const parts = clean.split('.');
      if (parts[1].length === 3) {
        clean = clean.replace(/\./g, '');
      }
    }
  }
  
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : parsed;
};

/**
 * Simplified parse BRL function.
 */
export const parseBRL = (value: string): number => {
  if (!value) return 0;
  const clean = value.replace(/[R$\s]/gi, '').trim();
  if (!clean) return 0;
  return Number(
    clean
      .replace(/\./g, '')
      .replace(',', '.')
  );
};

/**
 * Formats a raw number or digit string to a BRL formatted input string (e.g., for inputs).
 */
export const formatBRL = (value: string | number | undefined | null): string => {
  if (value === undefined || value === null || value === '') return '';
  const valueStr = typeof value === 'number' ? value.toFixed(2).replace('.', '') : String(value);
  const digits = valueStr.replace(/\D/g, '');
  if (!digits) return '';
  const numberValue = parseFloat(digits) / 100;
  return numberValue.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

/**
 * Standard utility to format number to currency display (e.g., R$ 1.500,50).
 */
export const formatCurrency = (val: number): string => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
};

/**
 * Determines whether a transaction is a credit (receita/income) or debit (despesa/expense).
 * Handles type fields ('credit', 'debit', 'INCOME', 'EXPENSE'), description overrides, and category checks.
 */
export const isCreditTransaction = (tx: any, category?: any): boolean => {
  if (!tx) return false;

  // 1. Direct type string checks (case-insensitive)
  const typeStr = String(tx.type || '').toLowerCase();
  if (typeStr === 'credit' || typeStr === 'income' || typeStr === 'receita' || typeStr === 'entrada') {
    return true;
  }
  if (typeStr === 'debit' || typeStr === 'expense' || typeStr === 'despesa' || typeStr === 'saida') {
    return false;
  }

  // 2. Specific description overrides from domain requirements
  const desc = String(tx.description || '').toLowerCase();
  if (
    desc.includes('comissões recebidas') ||
    desc.includes('comissão recebida') ||
    desc.includes('comissoes recebidas') ||
    desc.includes('recebido') ||
    desc.includes('recebimento')
  ) {
    return true;
  }
  if (
    desc.includes('pagamento de comissões') ||
    desc.includes('pagamento de comissao') ||
    desc.includes('parcela empréstimo') ||
    desc.includes('parcela emprestimo') ||
    desc.includes('zap+') ||
    desc.includes('pagamento')
  ) {
    return false;
  }

  // 3. Category type or name check
  if (category) {
    const catTypeStr = String(category.type || '').toLowerCase();
    if (catTypeStr === 'income' || catTypeStr === 'credit' || catTypeStr === 'receita') return true;
    if (catTypeStr === 'expense' || catTypeStr === 'debit' || catTypeStr === 'despesa') return false;

    const catName = String(category.name || '').toLowerCase();
    if (catName.includes('receita') || catName.includes('recebimento') || catName.includes('comissão') || catName.includes('comissao')) {
      return true;
    }
    if (catName.includes('despesa') || catName.includes('custo') || catName.includes('pagamento') || catName.includes('imposto')) {
      return false;
    }
  }

  return false;
};

