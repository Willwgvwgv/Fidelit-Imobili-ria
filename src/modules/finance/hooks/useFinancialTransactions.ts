import { useState, useCallback } from 'react';
import { FinancialTransaction } from '../../../../types';
import { supabaseService } from '../../../../services/supabaseService';

export const useFinancialTransactions = () => {
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await supabaseService.getFinancialTransactions();
      // Deduplicate by id so the same transaction can never render twice
      // (which would otherwise cause "delete one, two disappear").
      const unique = Array.from(
        new Map((data || []).map((t) => [t.id, t])).values()
      );
      setTransactions(unique);
      return unique;
    } catch (err) {
      // On a transient fetch error, keep the currently displayed list instead of
      // wiping it (previous behavior made lançamentos "desaparecerem").
      console.error('Error loading transactions:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    transactions,
    setTransactions,
    loading,
    setLoading,
    loadTransactions
  };
};
