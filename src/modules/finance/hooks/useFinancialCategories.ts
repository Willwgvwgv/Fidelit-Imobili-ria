import { useState, useCallback } from 'react';
import { FinancialCategory } from '../../../../types';
import { supabaseService } from '../../../../services/supabaseService';

export const useFinancialCategories = () => {
  const [categories, setCategories] = useState<FinancialCategory[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const loadCategories = useCallback(async () => {
    setLoading(true);
    try {
      const data = await supabaseService.getFinancialCategories();
      setCategories(data);
      return data;
    } catch (err) {
      console.error('Error loading categories:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    categories,
    setCategories,
    loading,
    setLoading,
    loadCategories
  };
};
