import { useState, useCallback } from 'react';
import { FinancialAccount } from '../../../../types';
import { supabaseService } from '../../../../services/supabaseService';

export const useAccounts = () => {
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await supabaseService.getFinancialAccounts();
      setAccounts(data);
      return data;
    } catch (err) {
      console.error('Error loading accounts:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    accounts,
    setAccounts,
    loading,
    setLoading,
    loadAccounts
  };
};
