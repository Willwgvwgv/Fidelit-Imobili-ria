import React, { useState, useEffect, useMemo } from 'react';
import { CreditCard, Calendar, DollarSign, Loader2, RefreshCw, CheckCircle2, ShieldCheck } from 'lucide-react';
import { supabase } from '../../../../supabase';
import { User, FinancialAccount, FinancialTransaction } from '../../../../types';
import { useAccountTransfers } from '../../../hooks/useAccountTransfers';
import { HeaderTooltip } from './HeaderTooltip';
import { FinancialKpiHeaderCards } from './FinancialKpiHeaderCards';

interface CartoesProps {
  currentUser: User;
  accounts: FinancialAccount[];
  transactions?: FinancialTransaction[];
  showToast?: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  onRefreshData?: () => void;
}

export const Cartoes: React.FC<CartoesProps> = ({
  currentUser,
  accounts,
  transactions = [],
  showToast,
  onRefreshData,
}) => {
  const { payCreditCardBill } = useAccountTransfers();

  const [cardInvoices, setCardInvoices] = useState<Record<string, { pendingAmount: number; pendingCount: number }>>({});
  const [loadingCards, setLoadingCards] = useState(false);

  // Modal State for Pagar Fatura
  const [selectedCard, setSelectedCard] = useState<FinancialAccount | null>(null);
  const [sourceAccountId, setSourceAccountId] = useState<string>('');
  const [paymentAmount, setPaymentAmount] = useState<string>('0,00');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentDescription, setPaymentDescription] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Filter credit card accounts
  const creditCards = useMemo(() => {
    return accounts.filter(
      (a) => a.type === 'credit_card' || (a as any).account_type === 'credit_card' || a.type === 'CREDIT'
    );
  }, [accounts]);

  // Source accounts (checking, savings, cash)
  const sourceAccounts = useMemo(() => {
    return accounts.filter(
      (a) => a.type !== 'credit_card' && (a as any).account_type !== 'credit_card' && a.type !== 'CREDIT'
    );
  }, [accounts]);

  // Load pending invoice amounts for each credit card
  const loadCardPendingInvoices = async () => {
    if (!supabase || creditCards.length === 0) return;
    setLoadingCards(true);

    try {
      const cardIds = creditCards.map((c) => c.id);

      // Query pending bank_transactions for card accounts
      const { data: bankTxData, error: bankErr } = await supabase
        .from('bank_transactions')
        .select('account_id, amount, status, type')
        .in('account_id', cardIds)
        .neq('status', 'ignored');

      // Query pending financial_transactions for card accounts
      const { data: finTxData, error: finErr } = await supabase
        .from('financial_transactions')
        .select('account_id, amount, status, type')
        .in('account_id', cardIds)
        .eq('status', 'PENDING');

      const invoicesMap: Record<string, { pendingAmount: number; pendingCount: number }> = {};

      cardIds.forEach((id) => {
        invoicesMap[id] = { pendingAmount: 0, pendingCount: 0 };
      });

      if (!bankErr && bankTxData) {
        bankTxData.forEach((bt) => {
          if (invoicesMap[bt.account_id]) {
            const amt = Math.abs(Number(bt.amount || 0));
            if (bt.status === 'pending') {
              invoicesMap[bt.account_id].pendingAmount += bt.type === 'debit' ? amt : -amt;
              invoicesMap[bt.account_id].pendingCount += 1;
            }
          }
        });
      }

      if (!finErr && finTxData) {
        finTxData.forEach((ft) => {
          if (invoicesMap[ft.account_id]) {
            const amt = Math.abs(Number(ft.amount || 0));
            invoicesMap[ft.account_id].pendingAmount += amt;
            invoicesMap[ft.account_id].pendingCount += 1;
          }
        });
      }

      setCardInvoices(invoicesMap);
    } catch (err) {
      console.error('Erro ao carregar faturas dos cartões:', err);
    } finally {
      setLoadingCards(false);
    }
  };

  useEffect(() => {
    loadCardPendingInvoices();
  }, [creditCards]);

  const handleOpenPayModal = (card: FinancialAccount) => {
    setSelectedCard(card);
    const invInfo = cardInvoices[card.id];
    const initialAmt = invInfo && invInfo.pendingAmount > 0 ? invInfo.pendingAmount : 0;

    setPaymentAmount(initialAmt.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentDescription(`Pagamento fatura ${card.name}`);

    if (sourceAccounts.length > 0) {
      setSourceAccountId(sourceAccounts[0].id);
    } else {
      setSourceAccountId('');
    }

    setIsModalOpen(true);
  };

  const handleConfirmPayInvoice = async () => {
    if (!selectedCard) return;
    if (!sourceAccountId) {
      if (showToast) showToast('Selecione a conta de origem.', 'warning');
      return;
    }

    let rawStr = paymentAmount.replace(/[R$\s]/gi, '');
    if (/\d+\.\d+,\d+/.test(rawStr)) {
      rawStr = rawStr.replace(/\./g, '').replace(',', '.');
    } else if (rawStr.includes(',') && !rawStr.includes('.')) {
      rawStr = rawStr.replace(',', '.');
    }
    const numAmount = parseFloat(rawStr);

    if (isNaN(numAmount) || numAmount <= 0) {
      if (showToast) showToast('Informe um valor válido maior que zero.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      await payCreditCardBill(
        sourceAccountId,
        selectedCard.id,
        numAmount,
        paymentDate,
        paymentDescription || `Pagamento fatura ${selectedCard.name}`
      );

      if (showToast) showToast('Fatura paga com sucesso!', 'success');
      setIsModalOpen(false);
      loadCardPendingInvoices();
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      console.error('Erro ao pagar fatura:', err);
      if (showToast) showToast(err.message || 'Erro ao processar pagamento da fatura.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <FinancialKpiHeaderCards transactions={transactions} />

      {/* Header */}
      <div className="flex items-center justify-between bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <CreditCard className="text-blue-600" size={20} />
            Cartões Corporativos
            <HeaderTooltip text="Controle de cartões de crédito corporativos, limites disponíveis, faturas abertas e liquidação de faturas." />
          </h2>
          <p className="text-xs font-normal text-slate-500 mt-0.5">
            Visualize faturas pendentes e realize liquidação de faturas com transferência automática entre contas.
          </p>
        </div>

        <button
          onClick={() => loadCardPendingInvoices()}
          className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl transition-all flex items-center gap-1.5 text-xs font-semibold cursor-pointer shadow-2xs"
        >
          <RefreshCw size={14} className={loadingCards ? 'animate-spin' : ''} />
          <span>Atualizar</span>
        </button>
      </div>

      {/* Lista de Cartões */}
      {creditCards.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
          <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
            <CreditCard size={24} />
          </div>
          <h3 className="text-sm font-semibold text-slate-700">Nenhum cartão de crédito cadastrado</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Ao cadastrar uma conta bancária com o tipo "Cartão de Crédito", ela aparecerá nesta página.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {creditCards.map((card) => {
            const invInfo = cardInvoices[card.id] || { pendingAmount: 0, pendingCount: 0 };

            return (
              <div
                key={card.id}
                className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs flex flex-col justify-between space-y-5"
              >
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                    <span className="font-bold text-slate-900 text-base">{card.name}</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-[#f1f5f9] text-[#475569] text-[11px] font-semibold">
                      Cartão de Crédito
                    </span>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-1.5">
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                      Fatura Pendente Estimada
                    </span>
                    <p className="text-[24px] font-bold text-slate-900 tracking-tight leading-none">
                      R$ {invInfo.pendingAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs font-normal text-slate-400 mt-1">
                      {invInfo.pendingCount} {invInfo.pendingCount === 1 ? 'lançamento pendente' : 'lançamentos pendentes'}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <button
                    onClick={() => handleOpenPayModal(card)}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl transition-all shadow-2xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <DollarSign size={14} />
                    <span>Liquidar Fatura</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Liquidar Fatura */}
      {isModalOpen && selectedCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5 relative border border-slate-200">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <CreditCard className="text-blue-600" size={20} />
              <h3 className="text-base font-bold text-slate-900">
                Liquidar Fatura - {selectedCard.name}
              </h3>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Conta Origem (Débito)*</label>
                <select
                  value={sourceAccountId}
                  onChange={(e) => setSourceAccountId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-medium text-slate-800 outline-none"
                >
                  <option value="">Selecione a conta bancária...</option>
                  {sourceAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.type || 'corrente'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Valor do Pagamento (R$)*</label>
                <input
                  type="text"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-slate-900 outline-none text-base"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Data do Pagamento*</label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-medium text-slate-800 outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Descrição</label>
                <input
                  type="text"
                  value={paymentDescription}
                  onChange={(e) => setPaymentDescription(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-medium text-slate-800 outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                disabled={submitting}
                className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleConfirmPayInvoice}
                disabled={submitting || !sourceAccountId}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl transition-all shadow-2xs flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="animate-spin" size={14} />
                    <span>Processando...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={14} />
                    <span>Confirmar Pagamento</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
