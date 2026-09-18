import React from 'react';
import { X, ArrowUpCircle, ArrowDownCircle, ArrowLeftRight } from 'lucide-react';
import { FinancialTransaction, FinancialCategory } from '../../../../../types';
import { formatCurrency } from '../../utils/currency';
import { formatDateBR } from '../../utils/dates';
import { isPaid, isOverdue, getTodayStr, isTransfer } from '../calculations';

interface DetalheModalProps {
  titulo: string;
  transactions: FinancialTransaction[];
  categoriesById: Map<string, FinancialCategory>;
  onClose: () => void;
}

const statusBadge = (tx: FinancialTransaction, today: string, categoriesById: Map<string, FinancialCategory>) => {
  if (isTransfer(tx, categoriesById)) {
    return <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">Transferência</span>;
  }
  if (isPaid(tx)) {
    return (
      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
        {tx.type === 'INCOME' ? 'Recebido' : 'Pago'}
      </span>
    );
  }
  if (isOverdue(tx, today)) {
    return <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-600">Atrasado</span>;
  }
  return <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">Em aberto</span>;
};

/**
 * Modal genérico de drill-down: usado por qualquer número consolidado do BI
 * (card, categoria, fatia de gráfico, linha de tabela) para mostrar os
 * lançamentos reais que compõem aquele valor. Garante o princípio de que
 * "nenhum número do BI é uma caixa preta".
 */
export const DetalheModal: React.FC<DetalheModalProps> = ({ titulo, transactions, categoriesById, onClose }) => {
  const today = getTodayStr();
  const total = transactions.reduce((a, t) => a + Number(t.amount || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-800">{titulo}</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {transactions.length} lançamento{transactions.length === 1 ? '' : 's'} · Total {formatCurrency(total)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {transactions.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">Nenhum lançamento encontrado.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                  <th className="px-4 py-2">Vencimento</th>
                  <th className="px-4 py-2">Descrição</th>
                  <th className="px-4 py-2">Categoria</th>
                  <th className="px-4 py-2">Pessoa</th>
                  <th className="px-4 py-2 text-right">Valor</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions
                  .slice()
                  .sort((a, b) => (a.due_date < b.due_date ? 1 : -1))
                  .map((t) => {
                    const cat = t.category_id ? categoriesById.get(t.category_id) : undefined;
                    return (
                      <tr key={t.id} className="border-t border-slate-50 hover:bg-slate-50/60">
                        <td className="px-4 py-2 text-slate-500 whitespace-nowrap">{formatDateBR(t.due_date)}</td>
                        <td className="px-4 py-2 text-slate-700">{t.description}</td>
                        <td className="px-4 py-2 text-slate-500">{cat?.name || '—'}</td>
                        <td className="px-4 py-2 text-slate-500">{t.contact_name || '—'}</td>
                        <td
                          className={`px-4 py-2 text-right font-semibold whitespace-nowrap ${
                            t.type === 'INCOME' ? 'text-emerald-700' : 'text-red-600'
                          }`}
                        >
                          {t.type === 'INCOME' ? '+' : '-'} {formatCurrency(Number(t.amount))}
                        </td>
                        <td className="px-4 py-2">{statusBadge(t, today, categoriesById)}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export const iconForType = (type: 'INCOME' | 'EXPENSE') =>
  type === 'INCOME' ? <ArrowUpCircle size={14} className="text-emerald-600" /> : <ArrowDownCircle size={14} className="text-red-500" />;

export const transferIcon = <ArrowLeftRight size={14} className="text-slate-400" />;
