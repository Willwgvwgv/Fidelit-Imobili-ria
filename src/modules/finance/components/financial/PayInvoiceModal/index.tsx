import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CreditCard, Calendar } from 'lucide-react';
import { PayInvoiceModalProps } from './types';

export const PayInvoiceModal: React.FC<PayInvoiceModalProps> = ({
  isOpen,
  card,
  onClose,
  loading,
  sourceAccountId,
  onSourceAccountIdChange,
  amountStr,
  onAmountStrChange,
  paymentDate,
  onPaymentDateChange,
  onConfirm,
  data: { accounts, currentPeriod },
  invoiceService: { getInvoicePeriodRangeStr, getAccountLiveBalance },
  formatters: { currency, formatBRL }
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
            onClick={() => {
              if (!loading) {
                onClose();
              }
            }}
          />
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }} 
            animate={{ scale: 1, opacity: 1 }} 
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white rounded-3xl w-full max-w-md shadow-2xl relative z-10 p-8 overflow-hidden flex flex-col"
          >
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-6">
              <CreditCard className="text-blue-500 animate-pulse" size={24} />
              <h2 className="text-xl font-black text-slate-900">
                Pagar Fatura
              </h2>
            </div>

            <div className="space-y-4">
              <p className="text-xs font-semibold text-slate-500 mb-2">
                Lançamento de pagamento da fatura do cartão <span className="font-extrabold text-slate-700">{card.name}</span>.
              </p>

              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-slate-700 text-xs font-semibold leading-relaxed mb-4 flex flex-col gap-1.5 shadow-sm">
                <div className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Período de Referência da Fatura</div>
                <div className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                  <Calendar size={14} className="text-blue-500" />
                  {getInvoicePeriodRangeStr(card, currentPeriod)}
                </div>
                {!card.closing_day && (
                  <div className="text-[10px] text-slate-400 font-medium mt-1">
                    * Fechamento da fatura não configurado. Utilizando o mês calendário.
                  </div>
                )}
              </div>

              <div>
                <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Conta de Origem (Débito)*</label>
                <select
                  value={sourceAccountId}
                  onChange={(e) => onSourceAccountIdChange(e.target.value)}
                  disabled={loading}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 outline-none text-slate-800 font-bold disabled:opacity-50"
                >
                  <option value="">Selecione uma conta...</option>
                  {accounts
                    .filter(a => a.type !== 'credit_card' && a.account_type !== 'credit_card')
                    .map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({currency(getAccountLiveBalance(acc))})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Valor do Pagamento (R$)*</label>
                <input 
                  type="text" 
                  placeholder="0,00" 
                  disabled={loading}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 outline-none font-bold text-slate-800 text-lg disabled:opacity-50"
                  value={amountStr} 
                  onChange={(e) => {
                    const val = e.target.value;
                    onAmountStrChange(formatBRL ? formatBRL(val) : val);
                  }}
                />
              </div>

              <div>
                <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Data do Pagamento*</label>
                <input 
                  type="date" 
                  disabled={loading}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 outline-none text-slate-800 font-bold disabled:opacity-50"
                  value={paymentDate} 
                  onChange={(e) => onPaymentDateChange(e.target.value)}
                />
              </div>

              <div className="flex gap-4 mt-8 pt-4 border-t border-slate-100">
                <button 
                  type="button"
                  onClick={onClose} 
                  disabled={loading}
                  className="flex-1 font-bold text-slate-400 text-sm py-3 disabled:opacity-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="button"
                  onClick={onConfirm}
                  disabled={loading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-black py-3 rounded-xl shadow-lg shadow-blue-100 text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? 'Processando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
