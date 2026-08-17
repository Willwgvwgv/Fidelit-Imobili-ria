import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../../supabase';
import { parseOFX, parseCSV, ParsedBankTransaction } from '../utils/ofxParser';
import { logAuditEvent } from '../utils/auditLogger';

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
  import_batch_id?: string | null;
}

export interface ImportBatchInfo {
  id: string;
  batch_id: string;
  account_id: string;
  file_type: 'ofx' | 'csv';
  tx_count: number;
  total_amount: number;
  first_date: string;
  last_date: string;
  imported_at: string;
  has_reconciled: boolean;
  has_matched: boolean;
  reconciled_count: number;
  bank_name?: string;
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
    batchId?: string,
    options?: { signal?: AbortSignal }
  ): Promise<{ inserted: number; skipped: number; batchId?: string }> => {
    if (!supabase) throw new Error('Supabase client não configurado');
    if (!parsedList || !parsedList.length) return { inserted: 0, skipped: 0 };

    const activeBatchId =
      batchId ||
      (typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `batch-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);

    // 1. Query existing fitids for this account to prevent duplicate inserts
    const fitids = parsedList.map(p => p.ofx_fitid).filter(Boolean);
    const existingFitidsSet = new Set<string>();

    if (fitids.length > 0) {
      try {
        const { data: existingData, error: checkErr } = await supabase
          .from('bank_transactions')
          .select('ofx_fitid')
          .eq('account_id', accountId)
          .in('ofx_fitid', fitids);

        if (checkErr) {
          console.warn('Could not query existing fitids:', checkErr);
        } else if (existingData) {
          existingData.forEach((row: any) => {
            if (row.ofx_fitid) {
              existingFitidsSet.add(row.ofx_fitid);
            }
          });
        }
      } catch (e) {
        console.warn('Error querying existing fitids:', e);
      }
    }

    // 2. Filter list into new items to insert vs skipped duplicates
    const itemsToInsert: any[] = [];
    let skipped = 0;

    parsedList.forEach((item, index) => {
      if (options?.signal?.aborted) return;

      if (item.ofx_fitid && existingFitidsSet.has(item.ofx_fitid)) {
        skipped++;
      } else {
        const fitid = item.ofx_fitid || `${activeBatchId}-${index}-${Date.now()}`;
        itemsToInsert.push({
          agency_id: currentAgencyId || null,
          account_id: accountId,
          date: item.date,
          amount: item.amount,
          description: item.description,
          type: item.type,
          ofx_fitid: fitid,
          status: 'pending',
          raw_data: item.raw_data || {},
          import_batch_id: activeBatchId,
        });
      }
    });

    if (options?.signal?.aborted) {
      return { inserted: 0, skipped, batchId: activeBatchId };
    }

    let inserted = 0;

    // 3. Bulk insert new items
    if (itemsToInsert.length > 0) {
      const { data: insertedData, error: insertErr } = await supabase
        .from('bank_transactions')
        .insert(itemsToInsert)
        .select();

      if (insertErr) {
        console.error('CRITICAL: Bulk insert error in saveParsedTransactions:', insertErr);
        throw new Error(insertErr.message || 'Erro ao salvar transações no Supabase');
      }

      inserted = insertedData ? insertedData.length : itemsToInsert.length;
    }

    await fetchTransactions(accountId);
    return { inserted, skipped, batchId: activeBatchId };
  };

  const importFromOFX = async (
    fileContent: string,
    accountId: string,
    currentAgencyId: string,
    options?: { signal?: AbortSignal }
  ): Promise<{ inserted: number; skipped: number; batchId?: string }> => {
    const batchId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `batch-${Date.now()}`;
    const parsed = await parseOFX(fileContent);
    return saveParsedTransactions(parsed, accountId, currentAgencyId, batchId, options);
  };

  const importFromCSV = async (
    fileContent: string,
    accountId: string,
    currentAgencyId: string,
    options?: { signal?: AbortSignal }
  ): Promise<{ inserted: number; skipped: number; batchId?: string }> => {
    const batchId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `batch-${Date.now()}`;
    const parsed = parseCSV(fileContent, accountId);
    return saveParsedTransactions(parsed, accountId, currentAgencyId, batchId, options);
  };

  const removeImportBatch = async (
    batchId: string,
    targetAccountId?: string,
    userId?: string,
    currentAgencyId?: string
  ): Promise<{ success: boolean; count: number; error?: string }> => {
    if (!supabase || !batchId) return { success: false, count: 0, error: 'Supabase indisponível ou batchId ausente' };

    try {
      let selectQuery = supabase
        .from('bank_transactions')
        .select('id, status, match_id')
        .eq('import_batch_id', batchId);

      if (targetAccountId) {
        selectQuery = selectQuery.eq('account_id', targetAccountId);
      }

      const { data: batchTxs, error: selectErr } = await selectQuery;
      if (selectErr) throw selectErr;

      const count = batchTxs ? batchTxs.length : 0;
      if (count === 0) {
        return { success: true, count: 0 };
      }

      // Reset any rent installments associated with these transactions
      const txIds = batchTxs.map(t => t.id);
      if (txIds.length > 0) {
        try {
          await supabase
            .from('rent_installments')
            .update({ bank_tx_id: null, status: 'pending' })
            .in('bank_tx_id', txIds);
        } catch (e) {
          console.warn('Could not reset rent_installments linked to batch:', e);
        }
      }

      let deleteQuery = supabase
        .from('bank_transactions')
        .delete()
        .eq('import_batch_id', batchId);

      if (targetAccountId) {
        deleteQuery = deleteQuery.eq('account_id', targetAccountId);
      }

      const { error: deleteErr } = await deleteQuery;
      if (deleteErr) throw deleteErr;

      // Register audit log
      await logAuditEvent({
        action: 'remove_import',
        entity_type: 'bank_transactions',
        entity_id: batchId,
        user_id: userId || null,
        agency_id: currentAgencyId || agencyId || null,
        details: {
          batch_id: batchId,
          account_id: targetAccountId,
          removed_count: count,
          timestamp: new Date().toISOString()
        }
      });

      await fetchTransactions(targetAccountId || selectedAccountId);
      return { success: true, count };
    } catch (err: any) {
      console.error('Error removing import batch:', err);
      return { success: false, count: 0, error: err.message || 'Erro ao remover importação' };
    }
  };

  const listImportBatches = useCallback(async (targetAccountId?: string): Promise<ImportBatchInfo[]> => {
    if (!supabase) return [];
    const accId = targetAccountId || selectedAccountId;
    if (!accId || accId === 'ALL') return [];

    try {
      const { data, error: err } = await supabase
        .from('bank_transactions')
        .select('*')
        .eq('account_id', accId)
        .not('import_batch_id', 'is', null)
        .order('created_at', { ascending: false });

      if (err) throw err;
      if (!data || data.length === 0) return [];

      const batchMap = new Map<string, BankTransaction[]>();
      for (const tx of data) {
        if (!tx.import_batch_id) continue;
        const existing = batchMap.get(tx.import_batch_id) || [];
        existing.push(tx);
        batchMap.set(tx.import_batch_id, existing);
      }

      const batchList: ImportBatchInfo[] = [];
      batchMap.forEach((txs, bId) => {
        let totalAmount = 0;
        let reconciledCount = 0;
        let hasReconciled = false;
        let hasMatched = false;
        let fileType: 'ofx' | 'csv' = 'ofx';
        let bankName: string | undefined = undefined;

        let firstDate = txs[0].date;
        let lastDate = txs[0].date;
        let importedAt = (txs[0] as any).created_at || (txs[0] as any).imported_at || new Date().toISOString();

        for (const tx of txs) {
          const amt = Number(tx.amount) || 0;
          if (tx.type === 'debit') {
            totalAmount -= Math.abs(amt);
          } else {
            totalAmount += Math.abs(amt);
          }

          if (tx.status === 'reconciled' || (tx.status as any) === 'RECONCILED') {
            hasReconciled = true;
            reconciledCount++;
          }
          if (tx.status === 'matched' || (tx.status as any) === 'MATCHED') {
            hasMatched = true;
            reconciledCount++;
          }

          if (tx.date < firstDate) firstDate = tx.date;
          if (tx.date > lastDate) lastDate = tx.date;

          if (tx.ofx_fitid && tx.ofx_fitid.startsWith('CSV-')) {
            fileType = 'csv';
          }
          if (tx.raw_data && tx.raw_data.bank_name) {
            bankName = tx.raw_data.bank_name;
          }
        }

        batchList.push({
          id: bId,
          batch_id: bId,
          account_id: accId,
          file_type: fileType,
          tx_count: txs.length,
          total_amount: totalAmount,
          first_date: firstDate,
          last_date: lastDate,
          imported_at: importedAt,
          has_reconciled: hasReconciled,
          has_matched: hasMatched,
          reconciled_count: reconciledCount,
          bank_name: bankName
        });
      });

      batchList.sort((a, b) => new Date(b.imported_at).getTime() - new Date(a.imported_at).getTime());
      return batchList.slice(0, 50);
    } catch (err) {
      console.error('Error listing import batches:', err);
      return [];
    }
  }, [selectedAccountId]);

  const countPendingInBatch = async (batchId: string): Promise<{ total: number; pending: number; reconciled: number }> => {
    if (!supabase || !batchId) return { total: 0, pending: 0, reconciled: 0 };
    try {
      const { data, error: err } = await supabase
        .from('bank_transactions')
        .select('status')
        .eq('import_batch_id', batchId);

      if (err || !data) return { total: 0, pending: 0, reconciled: 0 };
      let pending = 0;
      let reconciled = 0;
      for (const item of data) {
        if (item.status === 'reconciled' || item.status === 'matched') {
          reconciled++;
        } else {
          pending++;
        }
      }
      return { total: data.length, pending, reconciled };
    } catch (e) {
      return { total: 0, pending: 0, reconciled: 0 };
    }
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

      // If matching with a broker split (comissão), update split status to 'PAID'
      if (cleanMatchType === 'broker_split' && cleanMatchId) {
        try {
          await supabase
            .from('broker_splits')
            .update({
              status: 'PAID',
              payment_date: new Date().toISOString().split('T')[0],
            })
            .eq('id', cleanMatchId);
        } catch (splitErr) {
          console.warn('Could not update broker_splits:', splitErr);
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

  const undoReconciliation = async (
    bankTxId: string,
    userId?: string,
    currentAgencyId?: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!supabase || !bankTxId) return { success: false, error: 'Supabase ou ID ausente' };

    try {
      const { data: tx, error: fetchErr } = await supabase
        .from('bank_transactions')
        .select('*')
        .eq('id', bankTxId)
        .single();

      if (fetchErr || !tx) {
        return { success: false, error: 'Transação bancária não encontrada' };
      }

      if (tx.status !== 'reconciled' && tx.status !== 'RECONCILED' && tx.status !== 'matched' && tx.status !== 'MATCHED') {
        return { success: false, error: 'Esta transação não está conciliada' };
      }

      const matchId = tx.match_id;
      const matchType = tx.match_type;

      // Unlink broker split or rent installment if present
      if (matchId && matchType) {
        if (matchType === 'broker_split') {
          try {
            await supabase
              .from('broker_splits')
              .update({
                status: 'pending',
                payment_date: null,
                method: null,
                receipt_data: null,
                updated_at: new Date().toISOString(),
              })
              .eq('id', matchId);
          } catch (e) {
            console.warn('Could not reset broker_splits:', e);
          }
        } else if (matchType === 'rent') {
          try {
            await supabase
              .from('rent_installments')
              .update({
                status: 'pending',
                received_amount: null,
                received_at: null,
                bank_tx_id: null,
                updated_at: new Date().toISOString(),
              })
              .eq('id', matchId);
          } catch (e) {
            console.warn('Could not reset rent_installments:', e);
          }
        }
      }

      // Reset bank transaction to pending
      const { error: updateErr } = await supabase
        .from('bank_transactions')
        .update({
          status: 'pending',
          match_id: null,
          match_type: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', bankTxId);

      if (updateErr) throw updateErr;

      // Log in audit_log
      await logAuditEvent({
        action: 'undo_reconciliation',
        entity_type: 'bank_transactions',
        entity_id: bankTxId,
        user_id: userId || null,
        agency_id: currentAgencyId || agencyId || null,
        details: {
          match_type: matchType || null,
          match_id: matchId || null,
          description: tx.description,
          amount: tx.amount,
          timestamp: new Date().toISOString()
        }
      });

      await fetchTransactions();
      return { success: true };
    } catch (err: any) {
      console.error('Error undoing reconciliation:', err);
      return { success: false, error: err.message || 'Erro ao desfazer conciliação' };
    }
  };

  const deleteBankTransaction = async (
    bankTxId: string,
    userId?: string,
    currentAgencyId?: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!supabase || !bankTxId) return { success: false, error: 'Supabase ou ID ausente' };

    try {
      const { data: tx, error: fetchErr } = await supabase
        .from('bank_transactions')
        .select('*')
        .eq('id', bankTxId)
        .single();

      if (fetchErr || !tx) {
        return { success: false, error: 'Transação bancária não encontrada' };
      }

      const matchId = tx.match_id;
      const matchType = tx.match_type;

      // Unlink broker split or rent installment if present
      if (matchId && matchType) {
        if (matchType === 'broker_split') {
          try {
            await supabase
              .from('broker_splits')
              .update({
                status: 'pending',
                payment_date: null,
                method: null,
                receipt_data: null,
                updated_at: new Date().toISOString(),
              })
              .eq('id', matchId);
          } catch (e) {
            console.warn('Could not reset broker_splits:', e);
          }
        } else if (matchType === 'rent') {
          try {
            await supabase
              .from('rent_installments')
              .update({
                status: 'pending',
                received_amount: null,
                received_at: null,
                bank_tx_id: null,
                updated_at: new Date().toISOString(),
              })
              .eq('id', matchId);
          } catch (e) {
            console.warn('Could not reset rent_installments:', e);
          }
        }
      }

      // Delete bank transaction
      const { error: deleteErr } = await supabase
        .from('bank_transactions')
        .delete()
        .eq('id', bankTxId);

      if (deleteErr) throw deleteErr;

      // Log in audit_log
      await logAuditEvent({
        action: 'delete_bank_transaction',
        entity_type: 'bank_transactions',
        entity_id: bankTxId,
        user_id: userId || null,
        agency_id: currentAgencyId || agencyId || null,
        details: {
          match_type: matchType || null,
          match_id: matchId || null,
          description: tx.description,
          amount: tx.amount,
          timestamp: new Date().toISOString()
        }
      });

      await fetchTransactions();
      return { success: true };
    } catch (err: any) {
      console.error('Error deleting bank transaction:', err);
      return { success: false, error: err.message || 'Erro ao excluir transação bancária' };
    }
  };

  const bulkIgnoreTransactions = async (
    bankTxIds: string[],
    userId?: string,
    currentAgencyId?: string
  ): Promise<{ success: boolean; count: number; error?: string }> => {
    if (!supabase || !bankTxIds || bankTxIds.length === 0) {
      return { success: false, count: 0, error: 'Supabase indisponível ou nenhuma transação selecionada' };
    }

    try {
      // 1. Fetch transactions to check for match_id / match_type and perform unlinking
      const { data: txs, error: fetchErr } = await supabase
        .from('bank_transactions')
        .select('id, match_id, match_type, description, amount')
        .in('id', bankTxIds);

      if (fetchErr) throw fetchErr;

      if (txs && txs.length > 0) {
        const brokerSplitIds = txs.filter(t => t.match_type === 'broker_split' && t.match_id).map(t => t.match_id as string);
        const rentIds = txs.filter(t => t.match_type === 'rent' && t.match_id).map(t => t.match_id as string);

        if (brokerSplitIds.length > 0) {
          try {
            await supabase
              .from('broker_splits')
              .update({
                status: 'pending',
                payment_date: null,
                method: null,
                receipt_data: null,
                updated_at: new Date().toISOString(),
              })
              .in('id', brokerSplitIds);
          } catch (e) {
            console.warn('Could not reset broker_splits for bulk ignore:', e);
          }
        }

        if (rentIds.length > 0) {
          try {
            await supabase
              .from('rent_installments')
              .update({
                status: 'pending',
                received_amount: null,
                received_at: null,
                bank_tx_id: null,
                updated_at: new Date().toISOString(),
              })
              .in('id', rentIds);
          } catch (e) {
            console.warn('Could not reset rent_installments for bulk ignore:', e);
          }
        }
      }

      // 2. Update bank_transactions to status 'ignored'
      const { error: updateErr } = await supabase
        .from('bank_transactions')
        .update({
          status: 'ignored',
          match_id: null,
          match_type: null,
          updated_at: new Date().toISOString(),
        })
        .in('id', bankTxIds);

      if (updateErr) throw updateErr;

      // 3. Insert audit log
      await logAuditEvent({
        action: 'bulk_ignore',
        entity_type: 'bank_transactions',
        entity_id: bankTxIds.length === 1 ? bankTxIds[0] : null,
        user_id: userId || null,
        agency_id: currentAgencyId || agencyId || null,
        details: {
          count: bankTxIds.length,
          tx_ids: bankTxIds,
          timestamp: new Date().toISOString(),
        }
      });

      await fetchTransactions();
      return { success: true, count: bankTxIds.length };
    } catch (err: any) {
      console.error('Error in bulkIgnoreTransactions:', err);
      return { success: false, count: 0, error: err.message || 'Erro ao ignorar transações' };
    }
  };

  const bulkDeleteTransactions = async (
    bankTxIds: string[],
    userId?: string,
    currentAgencyId?: string
  ): Promise<{ success: boolean; count: number; error?: string }> => {
    if (!supabase || !bankTxIds || bankTxIds.length === 0) {
      return { success: false, count: 0, error: 'Supabase indisponível ou nenhuma transação selecionada' };
    }

    try {
      // 1. Fetch transactions to check for match_id / match_type and perform unlinking
      const { data: txs, error: fetchErr } = await supabase
        .from('bank_transactions')
        .select('id, match_id, match_type, description, amount')
        .in('id', bankTxIds);

      if (fetchErr) throw fetchErr;

      if (txs && txs.length > 0) {
        const brokerSplitIds = txs.filter(t => t.match_type === 'broker_split' && t.match_id).map(t => t.match_id as string);
        const rentIds = txs.filter(t => t.match_type === 'rent' && t.match_id).map(t => t.match_id as string);

        if (brokerSplitIds.length > 0) {
          try {
            await supabase
              .from('broker_splits')
              .update({
                status: 'pending',
                payment_date: null,
                method: null,
                receipt_data: null,
                updated_at: new Date().toISOString(),
              })
              .in('id', brokerSplitIds);
          } catch (e) {
            console.warn('Could not reset broker_splits for bulk delete:', e);
          }
        }

        if (rentIds.length > 0) {
          try {
            await supabase
              .from('rent_installments')
              .update({
                status: 'pending',
                received_amount: null,
                received_at: null,
                bank_tx_id: null,
                updated_at: new Date().toISOString(),
              })
              .in('id', rentIds);
          } catch (e) {
            console.warn('Could not reset rent_installments for bulk delete:', e);
          }
        }
      }

      // 2. Delete bank_transactions
      const { error: deleteErr } = await supabase
        .from('bank_transactions')
        .delete()
        .in('id', bankTxIds);

      if (deleteErr) throw deleteErr;

      // 3. Insert audit log
      await logAuditEvent({
        action: 'bulk_delete',
        entity_type: 'bank_transactions',
        entity_id: bankTxIds.length === 1 ? bankTxIds[0] : null,
        user_id: userId || null,
        agency_id: currentAgencyId || agencyId || null,
        details: {
          count: bankTxIds.length,
          tx_ids: bankTxIds,
          timestamp: new Date().toISOString(),
        }
      });

      await fetchTransactions();
      return { success: true, count: bankTxIds.length };
    } catch (err: any) {
      console.error('Error in bulkDeleteTransactions:', err);
      return { success: false, count: 0, error: err.message || 'Erro ao excluir transações' };
    }
  };

  return {
    bankTransactions,
    loading,
    error,
    fetchTransactions,
    importFromOFX,
    importFromCSV,
    removeImportBatch,
    listImportBatches,
    countPendingInBatch,
    listUnmatched,
    matchTransaction,
    ignoreTransaction,
    reconcileTransaction,
    undoReconciliation,
    deleteBankTransaction,
    bulkIgnoreTransactions,
    bulkDeleteTransactions,
  };
}
