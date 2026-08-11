import React, { useState, useEffect, useCallback } from 'react';
import { 
  FileText, 
  FileSpreadsheet, 
  Trash2, 
  AlertTriangle, 
  CheckCircle2, 
  Loader2, 
  RefreshCw, 
  Clock, 
  Calendar,
  Layers
} from 'lucide-react';
import { useBankTransactions, ImportBatchInfo } from '../../../hooks/useBankTransactions';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';
import { formatCurrency } from '../utils/currency';

interface ImportHistoryListProps {
  accountId: string;
  agencyId: string;
  currentUserId?: string;
  onGoToReconcile?: () => void;
  onBatchDeleted?: () => void;
  showToast?: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const ImportHistoryList: React.FC<ImportHistoryListProps> = ({
  accountId,
  agencyId,
  currentUserId,
  onGoToReconcile,
  onBatchDeleted,
  showToast,
}) => {
  const { listImportBatches, removeImportBatch } = useBankTransactions(agencyId, accountId);
  const [batches, setBatches] = useState<ImportBatchInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingBatchId, setDeletingBatchId] = useState<string | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<ImportBatchInfo | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadBatches = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const data = await listImportBatches(accountId);
      setBatches(data);
    } catch (err) {
      console.error('Error loading import history:', err);
    } finally {
      setLoading(false);
    }
  }, [accountId, listImportBatches]);

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  const handleOpenDeleteModal = (batch: ImportBatchInfo) => {
    setSelectedBatch(batch);
    setIsModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedBatch) return;
    setDeletingBatchId(selectedBatch.batch_id);
    setIsModalOpen(false);

    try {
      const res = await removeImportBatch(
        selectedBatch.batch_id,
        accountId,
        currentUserId,
        agencyId
      );

      if (res.success) {
        if (showToast) {
          showToast(`Importação removida (${res.count} transações)`, 'success');
        }
        await loadBatches();
        if (onBatchDeleted) {
          onBatchDeleted();
        }
      } else {
        if (showToast) {
          showToast(res.error || 'Erro ao remover importação.', 'error');
        }
      }
    } catch (err: any) {
      console.error('Error deleting import batch:', err);
      if (showToast) {
        showToast('Erro inesperado ao remover a importação.', 'error');
      }
    } finally {
      setDeletingBatchId(null);
      setSelectedBatch(null);
    }
  };

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }) + ' às ' + d.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    try {
      const [year, month, day] = dateStr.split('-');
      if (year && month && day) return `${day}/${month}/${year}`;
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <Layers size={18} className="text-indigo-600" />
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
            Histórico de Importações ({batches.length})
          </h3>
        </div>

        <button
          onClick={loadBatches}
          disabled={loading}
          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
          title="Atualizar Histórico"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 text-xs text-slate-500 gap-2">
          <Loader2 size={16} className="animate-spin text-indigo-600" />
          <span>Carregando histórico de extratos...</span>
        </div>
      ) : batches.length === 0 ? (
        <div className="text-center py-8 px-4 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 space-y-2">
          <Clock size={28} className="mx-auto text-slate-400" />
          <p className="text-xs font-semibold text-slate-700">Nenhuma importação registrada ainda</p>
          <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
            Importe um extrato bancário em formato OFX ou CSV acima para registrar novos lotes de lançamentos nesta conta.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {batches.map((batch) => {
            const isDeleting = deletingBatchId === batch.batch_id;
            const isCsv = batch.file_type === 'csv';

            return (
              <div
                key={batch.batch_id}
                className="p-4 rounded-xl border border-slate-200/80 bg-white hover:border-slate-300 transition-all space-y-3 shadow-2xs"
              >
                {/* Header Row */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                      {isCsv ? <FileSpreadsheet size={16} /> : <FileText size={16} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-[10px] uppercase tracking-wider">
                          {batch.file_type.toUpperCase()}
                        </span>
                        <span className="text-xs font-bold text-slate-800">
                          {formatDateTime(batch.imported_at)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {batch.reconciled_count === 0 ? (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80 flex items-center gap-1">
                        <CheckCircle2 size={12} /> OK
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200/80 flex items-center gap-1">
                        <AlertTriangle size={12} /> {batch.reconciled_count} conciliada(s)
                      </span>
                    )}
                  </div>
                </div>

                {/* Details Row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-600">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">
                      Quantidade
                    </span>
                    <span className="font-bold text-slate-800">
                      {batch.tx_count} transação(ões)
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">
                      Período do Extrato
                    </span>
                    <span className="font-medium text-slate-700 flex items-center gap-1">
                      <Calendar size={12} className="text-slate-400" />
                      {formatDate(batch.first_date)} a {formatDate(batch.last_date)}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">
                      Líquido Importado
                    </span>
                    <span
                      className={`font-bold ${
                        batch.total_amount >= 0 ? 'text-emerald-600' : 'text-slate-800'
                      }`}
                    >
                      {formatCurrency(batch.total_amount)}
                    </span>
                  </div>
                </div>

                {/* Actions Row */}
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                  {onGoToReconcile && (
                    <button
                      onClick={onGoToReconcile}
                      className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw size={13} />
                      <span>Ver Conciliação</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleOpenDeleteModal(batch)}
                    disabled={isDeleting}
                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isDeleting ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Trash2 size={13} />
                    )}
                    <span>Remover Importação</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Remover importação?"
        variant="danger"
        confirmText="Remover Importação"
        cancelText="Cancelar"
        description={
          selectedBatch ? (
            <div className="space-y-3 pt-1">
              <p>
                Isso vai remover <strong>{selectedBatch.tx_count} transação(ões)</strong> importada(s) em{' '}
                <strong>{formatDateTime(selectedBatch.imported_at)}</strong>.
              </p>
              <p className="text-slate-500 text-[11px]">
                A conta bancária e os lançamentos manuais NÃO serão afetados.
              </p>

              {selectedBatch.reconciled_count > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-semibold flex items-start gap-2">
                  <AlertTriangle size={18} className="shrink-0 text-amber-600 mt-0.5" />
                  <div>
                    ⚠️ <strong>{selectedBatch.reconciled_count} transação(ões)</strong> já foram conciliadas.
                    Remover esta importação também irá DESFAZER essas conciliações. Continuar mesmo assim?
                  </div>
                </div>
              )}
            </div>
          ) : null
        }
      />
    </div>
  );
};
