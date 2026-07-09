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
      setTransactions(data);
      return data;
    } catch (err) {
      console.error('Error loading transactions:', err);
      return [];
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
