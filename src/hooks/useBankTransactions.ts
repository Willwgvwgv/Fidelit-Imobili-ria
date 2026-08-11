import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../../supabase';
import { parseOFX, parseCSV, ParsedBankTransaction } from '../utils/ofxParser';

export interface BankTransaction {
  id: string;
  agency_id: string;
  account_id: string;
  date: string;
  amount: number;
  description: string;
  type: 'credit' | 'debit';
  ofx_fitid: string;
  status: 'pending' | 'matched' | 'reconciled' | 'ignored';
  match_type?: 'rent' | 'sale' | 'broker_split' | 'owner_payout' | 'expense' | 'other' | null;
  match_id?: string | null;
  transfer_id?: string | null;
  raw_data?: any;
  imported_at?: string;
}

export function useBankTransactions(agencyId?: string, selectedAccountId?: string) {
  const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = useCallback(async (accId?: string) => {
    if (!supabase) return;
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('bank_transactions')
        .select('*')
        .order('date', { ascending: false });

      const targetAccount = accId !== undefined ? accId : selectedAccountId;
      if (targetAccount && targetAccount !== 'ALL') {
        query = query.eq('account_id', targetAccount);
      }

      const { data, error: err } = await query;

      if (err) throw err;
      setBankTransactions(data || []);
    } catch (err: any) {
      console.error('Error fetching bank transactions:', err);
      setError(err.message || 'Erro ao buscar extrato bancário');
    } finally {
      setLoading(false);
    }
  }, [selectedAccountId]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const saveParsedTransactions = async (
    parsedList: ParsedBankTransaction[],
    accountId: string,
    currentAgencyId: string,
    options?: { signal?: AbortSignal }
  ): Promise<{ inserted: number; skipped: number }> => {
    if (!supabase) throw new Error('Supabase client não configurado');
    if (!parsedList.length) return { inserted: 0, skipped: 0 };

    let inserted = 0;
    let skipped = 0;

    for (const item of parsedList) {
      if (options?.signal?.aborted) {
        console.log('Import operation aborted by user signal');
        break;
      }
      const payload = {
        agency_id: currentAgencyId,
        account_id: accountId,
        date: item.date,
        amount: item.amount,
        description: item.description,
        type: item.type,
        ofx_fitid: item.ofx_fitid,
        status: 'pending',
        raw_data: item.raw_data || {},
      };

      const { error: insertErr } = await supabase
        .from('bank_transactions')
        .upsert(payload, { onConflict: 'ofx_fitid' });

      if (insertErr) {
        if (insertErr.code === '23505') {
          skipped++;
        } else {
          console.warn('Upsert warning for fitid:', item.ofx_fitid, insertErr);
          skipped++;
        }
      } else {
        inserted++;
      }
    }

    await fetchTransactions(accountId);
    return { inserted, skipped };
  };

  const importFromOFX = async (
    fileContent: string,
    accountId: string,
    currentAgencyId: string,
    options?: { signal?: AbortSignal }
  ): Promise<{ inserted: number; skipped: number }> => {
    const parsed = await parseOFX(fileContent);
    return saveParsedTransactions(parsed, accountId, currentAgencyId, options);
  };

  const importFromCSV = async (
    fileContent: string,
    accountId: string,
    currentAgencyId: string,
    options?: { signal?: AbortSignal }
  ): Promise<{ inserted: number; skipped: number }> => {
    const parsed = parseCSV(fileContent, accountId);
    return saveParsedTransactions(parsed, accountId, currentAgencyId, options);
  };

  const listUnmatched = (accId?: string) => {
    const targetAccount = accId !== undefined ? accId : selectedAccountId;
    return bankTransactions.filter(tx => {
      if (tx.status !== 'pending') return false;
      if (targetAccount && targetAccount !== 'ALL') return tx.account_id === targetAccount;
      return true;
    });
  };

  const matchTransaction = async (
    bankTxId: string,
    matchType: 'rent' | 'sale' | 'broker_split' | 'owner_payout' | 'expense' | 'other' | string,
    matchId: string
  ) => {
    if (!supabase || !bankTxId) return false;

    const cleanMatchId = (matchId && typeof matchId === 'string' && matchId.trim() !== '') ? matchId.trim() : null;
    const cleanMatchType = (matchType && typeof matchType === 'string' && matchType.trim() !== '') ? matchType.trim() : null;

    try {
      const payload: Record<string, any> = {
        status: 'reconciled',
        updated_at: new Date().toISOString(),
      };

      if (cleanMatchType) payload.match_type = cleanMatchType;
      if (cleanMatchId) payload.match_id = cleanMatchId;

      let { error: err } = await supabase
        .from('bank_transactions')
        .update(payload)
        .eq('id', bankTxId);

      if (err) {
        console.warn('First match attempt failed, retrying with fallback:', err.message);
        const retryPayload: Record<string, any> = {
          status: 'reconciled',
          updated_at: new Date().toISOString(),
        };
        if (cleanMatchId) retryPayload.matched_id = cleanMatchId;

        const { error: retryErr } = await supabase
          .from('bank_transactions')
          .update(retryPayload)
          .eq('id', bankTxId);

        if (retryErr) {
          console.error('Retry match also failed:', retryErr.message);
          return false;
        }
      }

      // If matching with a rent installment, update installment status to 'received'
      if (cleanMatchType === 'rent' && cleanMatchId) {
        try {
          await supabase
            .from('rent_installments')
            .update({
              status: 'received',
              bank_tx_id: bankTxId,
              received_at: new Date().toISOString().split('T')[0],
              updated_at: new Date().toISOString(),
            })
            .eq('id', cleanMatchId);
        } catch (rentErr) {
          console.warn('Could not update rent_installments:', rentErr);
        }
      }

      await fetchTransactions();
      return true;
    } catch (err) {
      console.error('Error matching transaction:', err);
      return false;
    }
  };

  const ignoreTransaction = async (bankTxId: string) => {
    if (!supabase || !bankTxId) return false;
    try {
      let { error: err } = await supabase
        .from('bank_transactions')
        .update({
          status: 'ignored',
          updated_at: new Date().toISOString(),
        })
        .eq('id', bankTxId);

      if (err) {
        const { error: retryErr } = await supabase
          .from('bank_transactions')
          .update({
            status: 'IGNORED',
            updated_at: new Date().toISOString(),
          })
          .eq('id', bankTxId);
        if (retryErr) throw retryErr;
      }
      await fetchTransactions();
      return true;
    } catch (err) {
      console.error('Error ignoring transaction:', err);
      return false;
    }
  };

  const reconcileTransaction = async (bankTxId: string) => {
    if (!supabase || !bankTxId) return false;
    try {
      let { error: err } = await supabase
        .from('bank_transactions')
        .update({
          status: 'reconciled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', bankTxId);

      if (err) {
        const { error: retryErr } = await supabase
          .from('bank_transactions')
          .update({
            status: 'RECONCILED',
            updated_at: new Date().toISOString(),
          })
          .eq('id', bankTxId);
        if (retryErr) throw retryErr;
      }
      await fetchTransactions();
      return true;
    } catch (err) {
      console.error('Error reconciling transaction:', err);
      return false;
    }
  };

  return {
    bankTransactions,
    loading,
    error,
    fetchTransactions,
    importFromOFX,
    importFromCSV,
    listUnmatched,
    matchTransaction,
    ignoreTransaction,
    reconcileTransaction,
  };
}
