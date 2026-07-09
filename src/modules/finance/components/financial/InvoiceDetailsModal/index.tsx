import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CreditCard, X, ChevronLeft, ChevronRight, FileText, Tag } from 'lucide-react';
import { TransactionStatus } from '../../../constants';
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
            {(() => {
              const txs = getInvoiceTransactions(card.id, period);
              const countStr = `${txs.length} ${txs.length === 1 ? 'lançamento' : 'lançamentos'}`;
              const totalAmount = getInvoiceTotalAmount(card.id, period);
              const formattedTotal = currency(totalAmount);

              // Calculate short Closing and Due dates based on card and period month/year
              const closingDay = card.closing_day || 10;
              const dueDay = card.due_day || 15;
              const targetYear = period.getFullYear();
              const targetMonth = period.getMonth();
              const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
              const safeClosingDay = Math.min(closingDay, daysInTargetMonth);
              const safeDueDay = Math.min(dueDay, daysInTargetMonth);

              const formatShortDate = (day: number, month: number) => {
                const dy = String(day).padStart(2, '0');
                const mo = String(month + 1).padStart(2, '0');
                return `${dy}/${mo}`;
              };

              const closingDateStr = formatShortDate(safeClosingDay, targetMonth);
              const dueDateStr = formatShortDate(safeDueDay, targetMonth);

              const capitalizedMonth = period.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
              const monthYearStr = `${capitalizedMonth.charAt(0).toUpperCase() + capitalizedMonth.slice(1)}/${period.getFullYear()}`;

              return (
                <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6 mb-6 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
                  {/* Left Column: Month Selector with Navigation & Item Count */}
                  <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-start">
                    <button
                      type="button"
                      onClick={() => {
                        const prev = new Date(period.getFullYear(), period.getMonth() - 1, 1);
                        onPeriodChange(prev);
                      }}
                      className="p-3 bg-white hover:bg-slate-100 border border-slate-100 hover:border-slate-200 text-slate-600 hover:text-slate-800 rounded-2xl shadow-sm transition-all cursor-pointer hover:scale-105 active:scale-95 shrink-0 flex items-center justify-center"
                    >
                      <ChevronLeft size={20} />
                    </button>

                    <div className="text-center md:text-left min-w-[120px]">
                      <h3 className="text-lg font-black text-slate-800 capitalize tracking-tight leading-none">
                        {monthYearStr}
                      </h3>
                      <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-black text-slate-400 uppercase tracking-wider bg-slate-200/50 px-2 py-0.5 rounded-full">
                        {countStr}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const next = new Date(period.getFullYear(), period.getMonth() + 1, 1);
                        onPeriodChange(next);
                      }}
                      className="p-3 bg-white hover:bg-slate-100 border border-slate-100 hover:border-slate-200 text-slate-600 hover:text-slate-800 rounded-2xl shadow-sm transition-all cursor-pointer hover:scale-105 active:scale-95 shrink-0 flex items-center justify-center"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </div>

                  {/* Middle Column: Big Invoice Total and Dates Info */}
                  <div className="flex flex-col items-center text-center gap-1">
                    <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Valor Total</span>
                    <span className="text-3xl font-black text-slate-900 tracking-tight leading-none">
                      {formattedTotal}
                    </span>
                    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs font-bold text-slate-500 mt-2">
                      <span className="bg-white px-2.5 py-1 rounded-xl border border-slate-100 shadow-sm">
                        Fechamento: <strong className="text-slate-800 font-extrabold">{closingDateStr}</strong>
                      </span>
                      <span className="bg-white px-2.5 py-1 rounded-xl border border-slate-100 shadow-sm">
                        Vencimento: <strong className="text-slate-800 font-extrabold">{dueDateStr}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Right Column: Status Indicator */}
                  <div className="flex flex-col items-center justify-center shrink-0 w-full md:w-auto">
                    {(() => {
                      const status = getInvoiceStatus(card.id, period);
                      let badgeClass = "";
                      let statusText = "";
                      let dotClass = "";
                      if (status === 'PAGA') {
                        badgeClass = "bg-emerald-50 text-emerald-700 border-emerald-100";
                        statusText = "Paga";
                        dotClass = "bg-emerald-500";
                      } else if (status === 'FECHADA') {
                        badgeClass = "bg-amber-50 text-amber-700 border-amber-100";
                        statusText = "Fechada";
                        dotClass = "bg-amber-500";
                      } else if (status === 'VENCIDA') {
                        badgeClass = "bg-rose-50 text-rose-700 border-rose-100";
                        statusText = "Vencida";
                        dotClass = "bg-rose-500";
                      } else {
                        badgeClass = "bg-blue-50 text-blue-700 border-blue-100";
                        statusText = "Aberta";
                        dotClass = "bg-blue-500";
                      }
                      return (
                        <span className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl border text-xs font-black uppercase tracking-wider shadow-sm ${badgeClass}`}>
                          <span className={`w-2 h-2 rounded-full ${dotClass}`} />
                          {statusText}
                        </span>
                      );
                    })()}
                  </div>
                </div>
              );
            })()}

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
