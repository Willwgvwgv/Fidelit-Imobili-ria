import { useState, useCallback } from 'react';
import { FinancialTransaction } from '../../../../types';
import { supabaseService } from '../../../../services/supabaseService';
import { supabase } from '../../../../supabase';
import { RecurrenceType } from '../constants';

export const useRecurringTransactions = (onSuccess: () => Promise<void>) => {
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>(RecurrenceType.NONE);
  const [recurrencePeriods, setRecurrencePeriods] = useState<number>(1);
  const [isRecurrenceEditModalOpen, setIsRecurrenceEditModalOpen] = useState(false);
  const [recurrenceEditOption, setRecurrenceEditOption] = useState<'single' | 'following' | 'all'>('single');
  const [recurrenceEditPayload, setRecurrenceEditPayload] = useState<any>(null);

  const handleConfirmRecurrenceEdit = useCallback(async (
    editingTransaction: FinancialTransaction | null,
    onCloseModal: () => void,
    setEditingTransaction: (tx: FinancialTransaction | null) => void
  ) => {
    if (!supabase || !editingTransaction || !recurrenceEditPayload) return;
    
    let success = false;
    if (recurrenceEditOption === 'single') {
      success = await supabaseService.updateFinancialTransaction(editingTransaction.id, recurrenceEditPayload);
    } else if (recurrenceEditOption === 'following') {
      success = await supabaseService.updateRecurrenceGroup(
        editingTransaction.recurrence_group_id!,
        editingTransaction.due_date,
        recurrenceEditPayload
      );
    } else if (recurrenceEditOption === 'all') {
      success = await supabaseService.updateRecurrenceGroup(
        editingTransaction.recurrence_group_id!,
        '2000-01-01',
        recurrenceEditPayload
      );
    }
    
    if (success) {
      setIsRecurrenceEditModalOpen(false);
      onCloseModal();
      setEditingTransaction(null);
      setRecurrenceEditPayload(null);
      await onSuccess();
    } else {
      alert('Erro ao atualizar lançamento(s) recorrente(s).');
    }
  }, [recurrenceEditOption, recurrenceEditPayload, onSuccess]);

  return {
    recurrenceType,
    setRecurrenceType,
    recurrencePeriods,
    setRecurrencePeriods,
    isRecurrenceEditModalOpen,
    setIsRecurrenceEditModalOpen,
    recurrenceEditOption,
    setRecurrenceEditOption,
    recurrenceEditPayload,
    setRecurrenceEditPayload,
    handleConfirmRecurrenceEdit
  };
};
