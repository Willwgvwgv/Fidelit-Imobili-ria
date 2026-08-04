import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../../supabase';

export interface CashFlowReal {
  account_id: string;
  account_name: string;
  agency_id: string;
  total_credits: number;
  total_debits: number;
  current_balance: number;
}

export interface CashFlowProjected {
  account_id: string;
  account_name: string;
  agency_id: string;
  current_balance: number;
  receivable_30d: number;
  payable_30d: number;
  projected_balance_30d: number;
}

export interface DREMonthly {
  month: string;
  agency_id: string;
  rent_received: number;
  brokerage_fee_received: number;
}

export function useCashFlow(agencyId?: string) {
  const [realBalances, setRealBalances] = useState<CashFlowReal[]>([]);
  const [projectedBalances, setProjectedBalances] = useState<CashFlowProjected[]>([]);
  const [dreMonthly, setDreMonthly] = useState<DREMonthly[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRealBalance = useCallback(async () => {
    if (!supabase) return [];
    try {
      const { data, error: err } = await supabase.from('v_cash_flow_real').select('*');
      if (err) throw err;
      const formatted = (data || []).map((item: any) => ({
        ...item,
        total_credits: Number(item.total_credits || 0),
        total_debits: Number(item.total_debits || 0),
        current_balance: Number(item.current_balance || 0),
      }));
      setRealBalances(formatted);
      return formatted;
    } catch (err: any) {
      console.warn('v_cash_flow_real view query error or fallback:', err);
      return [];
    }
  }, []);

  const fetchProjectedBalance = useCallback(async () => {
    if (!supabase) return [];
    try {
      const { data, error: err } = await supabase.from('v_cash_flow_projected').select('*');
      if (err) throw err;
      const formatted = (data || []).map((item: any) => ({
        ...item,
        current_balance: Number(item.current_balance || 0),
        receivable_30d: Number(item.receivable_30d || 0),
        payable_30d: Number(item.payable_30d || 0),
        projected_balance_30d: Number(item.projected_balance_30d || 0),
      }));
      setProjectedBalances(formatted);
      return formatted;
    } catch (err: any) {
      console.warn('v_cash_flow_projected view query error or fallback:', err);
      return [];
    }
  }, []);

  const fetchDRE = useCallback(async (_monthFrom?: string, _monthTo?: string) => {
    if (!supabase) return [];
    try {
      const { data, error: err } = await supabase.from('v_dre_monthly').select('*').order('month', { ascending: false });
      if (err) throw err;
      const formatted = (data || []).map((item: any) => ({
        ...item,
        rent_received: Number(item.rent_received || 0),
        brokerage_fee_received: Number(item.brokerage_fee_received || 0),
      }));
      setDreMonthly(formatted);
      return formatted;
    } catch (err: any) {
      console.warn('v_dre_monthly view query error or fallback:', err);
      return [];
    }
  }, []);

  const fetchAllCashFlowData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([fetchRealBalance(), fetchProjectedBalance(), fetchDRE()]);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar dados do fluxo de caixa');
    } finally {
      setLoading(false);
    }
  }, [fetchRealBalance, fetchProjectedBalance, fetchDRE]);

  useEffect(() => {
    fetchAllCashFlowData();
  }, [fetchAllCashFlowData]);

  return {
    realBalances,
    projectedBalances,
    dreMonthly,
    loading,
    error,
    fetchAllCashFlowData,
    fetchRealBalance,
    fetchProjectedBalance,
    fetchDRE,
  };
}
