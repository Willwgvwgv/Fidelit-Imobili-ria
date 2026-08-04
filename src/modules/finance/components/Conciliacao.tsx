import React, { useState, useEffect, useMemo } from 'react';
import { 
  RefreshCw, 
  Check, 
  XCircle, 
  PlusCircle, 
  Link2, 
  Sparkles, 
  Building2, 
  Users, 
  AlertCircle, 
  CheckCircle2, 
  Search, 
  Filter,
  DollarSign
} from 'lucide-react';
import { FinancialAccount, User, FinancialTransaction } from '../../../../types';
import { useBankTransactions, BankTransaction } from '../../../hooks/useBankTransactions';
import { supabase } from '../../../../supabase';
import { TransferBadge } from '../../../components/TransferBadge';
import { HeaderTooltip } from './HeaderTooltip';
import { FinancialKpiHeaderCards } from './FinancialKpiHeaderCards';

interface RentInstallmentItem {
  id: string;
  contract_id: string;
  due_date: string;
  expected_amount: number;
  expected_fee: number;
  status: string;
  tenant_name?: string;
  property_address?: string;
}

interface BrokerSplitItem {
  id: string;
  sale_id: string;
  broker_name: string;
  calculated_value: number;
  due_date?: string;
  status: string;
}

interface ConciliacaoProps {
  currentUser: User;
  accounts: FinancialAccount[];
  transactions?: FinancialTransaction[];
  showToast?: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  onOpenNewExpenseModal?: (data: { description: string; amount: number; date: string }) => void;
}

// Conciliação bancária de bank_transactions (Sicoob/OFX/CSV)
export const Conciliacao: React.FC<ConciliacaoProps> = ({
  currentUser,
  accounts,
  transactions = [],
  showToast,
  onOpenNewExpenseModal,
}) => {
  const [selectedAccountId, setSelectedAccountId] = useState<string>('ALL');
  const {
    bankTransactions,
    loading,
    fetchTransactions,
    matchTransaction,
    ignoreTransaction,
    reconcileTransaction,
  } = useBankTransactions(currentUser.agencyId, selectedAccountId);

  const [rentInstallments, setRentInstallments] = useState<RentInstallmentItem[]>([]);
  const [brokerSplits, setBrokerSplits] = useState<BrokerSplitItem[]>([]);
  const [loadingPendingItems, setLoadingPendingItems] = useState(false);

  // Modal de Vínculo
  const [linkingBankTx, setLinkingBankTx] = useState<BankTransaction | null>(null);
  const [selectedMatchTarget, setSelectedMatchTarget] = useState<{ type: 'rent' | 'broker_split'; id: string } | null>(null);

  // Fetch pending rent installments and broker splits
  const loadPendingItems = async () => {
    if (!supabase) return;
    setLoadingPendingItems(true);

    try {
      // 1. Fetch pending rent installments with contract details
      const { data: instData } = await supabase
        .from('rent_installments')
        .select(`
          id,
          contract_id,
          due_date,
          expected_amount,
          expected_fee,
          status,
          rent_contracts (
            tenant_name,
            property_address
          )
        `)
        .in('status', ['pending', 'overdue']);

      const formattedInst: RentInstallmentItem[] = (instData || []).map((item: any) => ({
        id: item.id,
        contract_id: item.contract_id,
        due_date: item.due_date,
        expected_amount: Number(item.expected_amount),
        expected_fee: Number(item.expected_fee),
        status: item.status,
        tenant_name: item.rent_contracts?.tenant_name || 'Inquilino',
        property_address: item.rent_contracts?.property_address || 'Imóvel',
      }));
      setRentInstallments(formattedInst);

      // 2. Fetch pending broker splits
      const { data: splitData } = await supabase
        .from('broker_splits')
        .select(`
          id,
          sale_id,
          calculated_value,
          status,
          forecast_date,
          due_date,
          broker_name,
          users (
            name
          )
        `)
        .in('status', ['PENDING', 'OVERDUE', 'pending', 'overdue']);

      const formattedSplits: BrokerSplitItem[] = (splitData || []).map((item: any) => ({
        id: item.id,
        sale_id: item.sale_id,
        broker_name: item.users?.name || item.broker_name || 'Corretor',
        calculated_value: Number(item.calculated_value || 0),
        due_date: item.due_date || item.forecast_date || new Date().toISOString().split('T')[0],
        status: item.status,
      }));
      setBrokerSplits(formattedSplits);
    } catch (err) {
      console.error('Erro ao carregar itens pendentes para conciliação:', err);
    } finally {
      setLoadingPendingItems(false);
    }
  };

  useEffect(() => {
    loadPendingItems();
  }, []);

  // Filter bank transactions that are pending
  const pendingBankTxs = useMemo(() => {
    return bankTransactions.filter(tx => tx.status === 'pending');
  }, [bankTransactions]);

  // Auto-match calculation:
  // For each pending bank_tx, check if there's an exact match in amount and due_date ± 3 days
  const suggestedMatches = useMemo(() => {
    const map = new Map<string, { type: 'rent' | 'broker_split'; id: string; label: string }>();

    for (const tx of pendingBankTxs) {
      const txDate = new Date(tx.date).getTime();

      if (tx.type === 'credit') {
        // Look for rent installment with exact expected_amount and date ± 3 days
        const candidate = rentInstallments.filter(inst => {
          if (Math.abs(inst.expected_amount - tx.amount) > 0.01) return false;
          const instDate = new Date(inst.due_date).getTime();
          const diffDays = Math.abs(txDate - instDate) / (1000 * 3600 * 24);
          return diffDays <= 3;
        });

        if (candidate.length === 1) {
          map.set(tx.id, {
            type: 'rent',
            id: candidate[0].id,
            label: `Aluguel: ${candidate[0].tenant_name} (R$ ${candidate[0].expected_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`,
          });
        }
      } else if (tx.type === 'debit') {
        // Look for broker split with exact calculated_value and date ± 3 days
        const candidate = brokerSplits.filter(split => {
          if (Math.abs(split.calculated_value - tx.amount) > 0.01) return false;
          if (!split.due_date) return true;
          const splitDate = new Date(split.due_date).getTime();
          const diffDays = Math.abs(txDate - splitDate) / (1000 * 3600 * 24);
          return diffDays <= 3;
        });

        if (candidate.length === 1) {
          map.set(tx.id, {
            type: 'broker_split',
            id: candidate[0].id,
            label: `Comissão: ${candidate[0].broker_name} (R$ ${candidate[0].calculated_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`,
          });
        }
      }
    }

    return map;
  }, [pendingBankTxs, rentInstallments, brokerSplits]);

  const handleLinkClick = (tx: BankTransaction) => {
    const suggested = suggestedMatches.get(tx.id);
    setLinkingBankTx(tx);
    if (suggested) {
      setSelectedMatchTarget({ type: suggested.type, id: suggested.id });
    } else {
      setSelectedMatchTarget(null);
    }
  };

  const handleConfirmLink = async () => {
    if (!linkingBankTx || !selectedMatchTarget) return;

    const ok = await matchTransaction(linkingBankTx.id, selectedMatchTarget.type, selectedMatchTarget.id);
    if (ok) {
      if (showToast) showToast('Transação conciliada com sucesso!', 'success');
      setLinkingBankTx(null);
      setSelectedMatchTarget(null);
      loadPendingItems();
    } else {
      if (showToast) showToast('Erro ao conciliar transação.', 'error');
    }
  };

  const handleDirectReconcile = async (txId: string) => {
    const ok = await reconcileTransaction(txId);
    if (ok) {
      if (showToast) showToast('Transação marcada como reconciliada sem vínculo.', 'info');
      loadPendingItems();
    }
  };

  const handleIgnore = async (txId: string) => {
    const ok = await ignoreTransaction(txId);
    if (ok) {
      if (showToast) showToast('Transação ignorada.', 'info');
      loadPendingItems();
    }
  };

  return (
    <div className="space-y-6">
      <FinancialKpiHeaderCards transactions={transactions} />

      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <RefreshCw className="text-indigo-600" size={22} />
            Conciliação Bancária
            <HeaderTooltip text="Comparativo e cruzamento automático de extratos bancários importados (OFX/CSV) com lançamentos do sistema." />
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Vincule extratos importados do Sicoob aos recebimentos de aluguel e pagamentos de comissão.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className="h-10 px-3 border border-slate-200 rounded-xl text-xs font-semibold bg-white focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">Todas as Contas Bancárias</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name}
              </option>
            ))}
          </select>

          <button
            onClick={() => fetchTransactions()}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all"
            title="Atualizar dados"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Main Grid: 60% Left (Bank Txs) + 40% Right (System Pendings) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Bank Transactions (7 cols ~60%) */}
        <div className="lg:col-span-7 bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-800 text-sm">Extrato Bancário Pendente</h3>
              <span className="px-2 py-0.5 bg-amber-50 text-amber-700 font-bold text-xs rounded-full border border-amber-200/60">
                {pendingBankTxs.length} para conciliar
              </span>
            </div>
            {suggestedMatches.size > 0 && (
              <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg flex items-center gap-1 animate-pulse">
                <Sparkles size={13} />
                {suggestedMatches.size} sugestões automáticas
              </span>
            )}
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-400 text-xs font-medium">
              Carregando transações do banco...
            </div>
          ) : pendingBankTxs.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <CheckCircle2 size={36} className="text-emerald-500 mx-auto" />
              <p className="text-sm font-bold text-slate-700">Tudo Conciliado!</p>
              <p className="text-xs text-slate-400">
                Não há transações pendentes de conciliação no momento. Importe um novo extrato OFX/CSV.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingBankTxs.map((tx) => {
                const suggested = suggestedMatches.get(tx.id);
                const isTransfer = Boolean(tx.transfer_id);

                return (
                  <div
                    key={tx.id}
                    className={`p-3.5 rounded-xl border transition-all space-y-2.5 ${
                      isTransfer
                        ? 'bg-slate-50/80 border-slate-200 opacity-90'
                        : suggested
                        ? 'bg-amber-50/40 border-amber-200/80 shadow-2xs'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-mono text-slate-500 font-semibold">{tx.date}</span>
                          <span
                            className={`px-2 py-0.5 text-[10px] font-bold rounded-md uppercase ${
                              tx.type === 'credit'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {tx.type === 'credit' ? 'Crédito' : 'Débito'}
                          </span>
                          <TransferBadge transferId={tx.transfer_id} />
                          {tx.ofx_fitid?.startsWith('MANUAL-') && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-amber-100 text-amber-800 border border-amber-300/60 inline-flex items-center gap-1">
                              ✎ Lançamento manual
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-bold text-slate-800 mt-1 leading-snug">{tx.description}</p>
                      </div>

                      <div className="text-right shrink-0">
                        <span
                          className={`text-base font-bold ${
                            tx.type === 'credit' ? 'text-emerald-600' : 'text-rose-600'
                          }`}
                        >
                          {tx.type === 'credit' ? '+' : '-'} R${' '}
                          {tx.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    {/* Auto-match highlight badge */}
                    {suggested && !isTransfer && (
                      <div className="p-2 bg-amber-100/70 border border-amber-300/60 rounded-lg text-xs text-amber-900 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Sparkles size={14} className="text-amber-600 shrink-0" />
                          <span className="font-semibold text-[11px] truncate">{suggested.label}</span>
                        </div>
                        <button
                          onClick={() => handleLinkClick(tx)}
                          className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] rounded-md transition-all shrink-0 cursor-pointer"
                        >
                          Confirmar Match
                        </button>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100/80">
                      {!isTransfer ? (
                        <>
                          <button
                            onClick={() => handleLinkClick(tx)}
                            className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                          >
                            <Link2 size={13} />
                            Vincular
                          </button>

                          <button
                            onClick={() => handleDirectReconcile(tx.id)}
                            className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                            title="Marcar como concilado direto (sem vincular)"
                          >
                            <Check size={13} />
                            Reconciliar
                          </button>

                          {onOpenNewExpenseModal && (
                            <button
                              onClick={() =>
                                onOpenNewExpenseModal({
                                  description: tx.description,
                                  amount: tx.amount,
                                  date: tx.date,
                                })
                              }
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                            >
                              <PlusCircle size={13} />
                              Lançar
                            </button>
                          )}
                        </>
                      ) : null}

                      <button
                        onClick={() => handleIgnore(tx.id)}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 font-bold text-xs rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                        title="Transferência entre contas, sem impacto em receita/despesa"
                      >
                        <XCircle size={14} />
                        Ignorar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: System Pending Items (5 cols ~40%) */}
        <div className="lg:col-span-5 bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-800 text-sm">Registros Pendentes no Sistema</h3>
            <p className="text-xs text-slate-400 mt-0.5">Aluguéis a receber e comissões a pagar</p>
          </div>

          {loadingPendingItems ? (
            <div className="p-8 text-center text-slate-400 text-xs font-medium">Carregando pendências...</div>
          ) : (
            <div className="space-y-5">
              {/* Rent Installments */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 uppercase tracking-wider">
                  <span className="flex items-center gap-1.5 text-indigo-700">
                    <Building2 size={15} />
                    Aluguéis (imobia.app)
                  </span>
                  <span className="text-slate-400 font-normal">{rentInstallments.length} itens</span>
                </div>

                {rentInstallments.length === 0 ? (
                  <p className="text-xs text-slate-400 italic p-3 bg-slate-50 rounded-xl">
                    Nenhum aluguel pendente de recebimento.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                    {rentInstallments.map((inst) => (
                      <div key={inst.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800 truncate">{inst.tenant_name}</span>
                          <span className="font-mono text-emerald-600 font-bold">
                            R$ {inst.expected_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span className="truncate max-w-[180px]">{inst.property_address}</span>
                          <span>Venc: {inst.due_date}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Broker Splits */}
              <div className="space-y-2.5 pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 uppercase tracking-wider">
                  <span className="flex items-center gap-1.5 text-purple-700">
                    <Users size={15} />
                    Comissões Corretores
                  </span>
                  <span className="text-slate-400 font-normal">{brokerSplits.length} itens</span>
                </div>

                {brokerSplits.length === 0 ? (
                  <p className="text-xs text-slate-400 italic p-3 bg-slate-50 rounded-xl">
                    Nenhuma comissão pendente de pagamento.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                    {brokerSplits.map((split) => (
                      <div key={split.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800">{split.broker_name}</span>
                          <span className="font-mono text-rose-600 font-bold">
                            R$ {split.calculated_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 text-right">
                          Data prevista: {split.due_date || 'N/A'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Vínculo Manual */}
      {linkingBankTx && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Link2 size={18} className="text-indigo-600" />
                Vincular Transação Bancária
              </h3>
              <button
                onClick={() => setLinkingBankTx(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs text-indigo-900 space-y-1">
              <span className="font-bold block uppercase tracking-wider text-[10px] text-indigo-600">Extrato Bancário:</span>
              <p className="font-bold text-sm">{linkingBankTx.description}</p>
              <p className="font-mono">
                {linkingBankTx.date} |{' '}
                <strong className={linkingBankTx.type === 'credit' ? 'text-emerald-700' : 'text-rose-700'}>
                  R$ {linkingBankTx.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </strong>
              </p>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Selecione o registro do sistema para vincular:
              </label>

              {linkingBankTx.type === 'credit' ? (
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  <p className="text-xs text-slate-500 font-semibold">Aluguéis a Receber:</p>
                  {rentInstallments.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">Nenhum contrato com aluguel pendente.</p>
                  ) : (
                    rentInstallments.map((inst) => {
                      const isSelected = selectedMatchTarget?.type === 'rent' && selectedMatchTarget?.id === inst.id;
                      return (
                        <div
                          key={inst.id}
                          onClick={() => setSelectedMatchTarget({ type: 'rent', id: inst.id })}
                          className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-200 font-semibold'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex justify-between font-bold text-slate-800">
                            <span>{inst.tenant_name}</span>
                            <span>R$ {inst.expected_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">{inst.property_address} (Venc: {inst.due_date})</div>
                        </div>
                      );
                    })
                  )}
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  <p className="text-xs text-slate-500 font-semibold">Comissões a Pagar:</p>
                  {brokerSplits.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">Nenhuma comissão pendente.</p>
                  ) : (
                    brokerSplits.map((split) => {
                      const isSelected = selectedMatchTarget?.type === 'broker_split' && selectedMatchTarget?.id === split.id;
                      return (
                        <div
                          key={split.id}
                          onClick={() => setSelectedMatchTarget({ type: 'broker_split', id: split.id })}
                          className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-200 font-semibold'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex justify-between font-bold text-slate-800">
                            <span>{split.broker_name}</span>
                            <span>R$ {split.calculated_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">Previsto: {split.due_date || 'N/A'}</div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setLinkingBankTx(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 font-semibold text-xs rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmLink}
                disabled={!selectedMatchTarget}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs disabled:opacity-50 cursor-pointer"
              >
                Confirmar Vínculo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
