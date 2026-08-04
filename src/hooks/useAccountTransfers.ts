import { useState, useCallback } from 'react';
import { supabase } from '../../supabase';

export interface AccountTransfer {
  id: string;
  from_account_id: string;
  to_account_id: string;
  amount: number;
  transfer_date: string;
  description: string;
  created_at?: string;
}

export function useAccountTransfers() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const payCreditCardBill = useCallback(
    async (
      fromAccountId: string,
      toAccountId: string,
      amount: number,
      date: string,
      description: string
    ) => {
      if (!supabase) {
        throw new Error('Supabase client não inicializado.');
      }
      setLoading(true);
      setError(null);

      try {
        // Execute create_account_transfer RPC function in Supabase
        const { data, error: rpcErr } = await supabase.rpc('create_account_transfer', {
          from_account_id: fromAccountId,
          to_account_id: toAccountId,
          amount: amount,
          date: date,
          description: description,
        });

        if (rpcErr) {
          console.error('Error invoking create_account_transfer RPC:', rpcErr);
          throw rpcErr;
        }

        return data;
      } catch (err: any) {
        console.error('Error executing payCreditCardBill:', err);
        setError(err.message || 'Erro ao realizar transferência de fatura de cartão');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const listTransfers = useCallback(async (_agencyId?: string) => {
    if (!supabase) return [];
    try {
      const { data, error: err } = await supabase
        .from('account_transfers')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (err) throw err;
      return (data || []) as AccountTransfer[];
    } catch (err: any) {
      console.warn('Error listing account_transfers:', err);
      return [];
    }
  }, []);

  const isTransferTransaction = useCallback((bankTx: { transfer_id?: string | null }) => {
    return Boolean(bankTx && bankTx.transfer_id);
  }, []);

  return {
    loading,
    error,
    payCreditCardBill,
    listTransfers,
    isTransferTransaction,
  };
}
