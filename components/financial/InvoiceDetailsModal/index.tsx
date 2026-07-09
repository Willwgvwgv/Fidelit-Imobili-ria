import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CreditCard, X, ChevronLeft, ChevronRight, FileText, Tag } from 'lucide-react';
import { TransactionStatus } from '../../../types';
import { InvoiceDetailsModalProps } from './types';

export const InvoiceDetailsModal: React.FC<InvoiceDetailsModalProps> = ({
  isOpen,
  card,
  onClose,
  period,
  onPeriodChange,
  data: { categories },
  invoiceService: {
    getInvoicePeriodRangeStr,
    getInvoiceTransactions,
    getInvoiceTotalAmount,
    getInvoiceStatus
  },
  formatters: { currency, formatDateBR }
}) => {
  return (
    <AnimatePresence>
      {isOpen && card && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
            onClick={onClose}
          />
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }} 
            animate={{ scale: 1, opacity: 1 }} 
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl relative z-10 p-8 overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
              <div className="flex items-center gap-3">
                <CreditCard className="text-blue-500" size={24} />
                <div>
                  <h2 className="text-xl font-black text-slate-900">
                    Detalhes da Fatura — {card.name}
                  </h2>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                    Consulta e conciliação de lançamentos
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={onClose}
                className="p-1.5 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
              >
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            {/* Seletor de Mês e Resumo */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              {/* Seletor de Mês */}
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col justify-between">
                <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase mb-2">Mês de Referência</span>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      const prev = new Date(period.getFullYear(), period.getMonth() - 1, 1);
                      onPeriodChange(prev);
                    }}
                    className="p-1.5 hover:bg-slate-200/80 rounded-lg text-slate-500 hover:text-slate-700 transition-all cursor-pointer"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <span className="text-sm font-black text-slate-800 uppercase tracking-wide">
                    {period.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const next = new Date(period.getFullYear(), period.getMonth() + 1, 1);
                      onPeriodChange(next);
                    }}
                    className="p-1.5 hover:bg-slate-200/80 rounded-lg text-slate-500 hover:text-slate-700 transition-all cursor-pointer"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>

              {/* Período de Fechamento */}
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col justify-center">
                <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase mb-1">Período da Fatura</span>
                <span className="text-sm font-bold text-slate-700">
                  {getInvoicePeriodRangeStr(card, period)}
                </span>
                {!card.closing_day && (
                  <span className="text-[9px] text-slate-400 mt-1 font-medium">
                    * Usando o mês calendário cheio.
                  </span>
                )}
              </div>

              {/* Resumo Financeiro e Status */}
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase block mb-1">Total da Fatura</span>
                  <span className="text-xl font-black text-slate-900">
                    {currency(getInvoiceTotalAmount(card.id, period))}
                  </span>
                </div>
                <div>
                  {(() => {
                    const status = getInvoiceStatus(card.id, period);
                    let badgeClass = "";
                    let statusText = "";
                    if (status === 'PAGA') {
                      badgeClass = "bg-emerald-50 text-emerald-700 border-emerald-100";
                      statusText = "Paga";
                    } else if (status === 'FECHADA') {
                      badgeClass = "bg-amber-50 text-amber-700 border-amber-100";
                      statusText = "Fechada";
                    } else if (status === 'VENCIDA') {
                      badgeClass = "bg-rose-50 text-rose-700 border-rose-100";
                      statusText = "Vencida";
                    } else {
                      badgeClass = "bg-blue-50 text-blue-700 border-blue-100";
                      statusText = "Aberta";
                    }
                    return (
                      <span className={`px-3 py-1.5 rounded-full border text-xs font-black uppercase tracking-wider ${badgeClass}`}>
                        {statusText}
                      </span>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Tabela de Lançamentos */}
            <div className="flex-1 overflow-y-auto min-h-[250px] border border-slate-100 rounded-2xl">
              {(() => {
                const txs = getInvoiceTransactions(card.id, period);
                if (txs.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
                      <FileText size={32} className="mb-2 text-slate-300" />
                      <p className="font-bold text-xs uppercase tracking-wider">Nenhum lançamento neste período.</p>
                    </div>
                  );
                }
                return (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="px-6 py-3 text-[10px] font-black tracking-widest text-slate-400 uppercase">Vencimento</th>
                        <th className="px-6 py-3 text-[10px] font-black tracking-widest text-slate-400 uppercase">Descrição</th>
                        <th className="px-6 py-3 text-[10px] font-black tracking-widest text-slate-400 uppercase">Categoria</th>
                        <th className="px-6 py-3 text-[10px] font-black tracking-widest text-slate-400 uppercase">Status</th>
                        <th className="px-6 py-3 text-[10px] font-black tracking-widest text-slate-400 uppercase text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {txs.map((tx) => {
                        const cat = categories.find(c => c.id === tx.category_id);
                        const isPaid = tx.status === TransactionStatus.PAID || (tx.settled_by_transaction_id && tx.settled_by_transaction_id.trim() !== '');
                        return (
                          <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4 text-sm font-bold text-slate-600">
                              {tx.due_date ? formatDateBR(tx.due_date) : '-'}
                            </td>
                            <td className="px-6 py-4 text-sm font-bold text-slate-800">
                              {tx.description}
                            </td>
                            <td className="px-6 py-4 text-sm">
                              {cat ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-700">
                                  <Tag size={11} className="text-slate-400" />
                                  {cat.name}
                                </span>
                              ) : (
                                <span className="text-slate-400 text-xs font-bold">—</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-sm">
                              {isPaid ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-100 uppercase tracking-wide">
                                  Paga
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-100 uppercase tracking-wide">
                                  Pendente
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-sm font-black text-right text-rose-600">
                              {currency(tx.amount)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                );
              })()}
            </div>

            {/* Rodapé / Botão de Fechar */}
            <div className="flex gap-4 mt-6 pt-4 border-t border-slate-100">
              <button 
                type="button"
                onClick={onClose} 
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-3 rounded-xl shadow-lg text-sm transition-all cursor-pointer flex items-center justify-center"
              >
                Fechar Detalhes
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
