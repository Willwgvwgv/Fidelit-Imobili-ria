import React, { useState, useEffect } from 'react';
import { Plus, ArrowRightLeft, Wallet, Check, Pencil, Trash2, X, DollarSign, Calendar, FileText } from 'lucide-react';
import { FinancialAccount, User, FinancialCategory, FinancialTransaction } from '../../../../types';
import { formatCurrency } from '../utils/currency';
import { supabase } from '../../../../supabase';
import { HeaderTooltip } from './HeaderTooltip';
import { FinancialKpiHeaderCards } from './FinancialKpiHeaderCards';

export const BANKS = [
  { code: '001', name: 'Banco do Brasil', initials: 'BB', color: '#fcf800' },
  { code: '033', name: 'Santander', initials: 'SAN', color: '#ec0000' },
  { code: '104', name: 'Caixa Econômica', initials: 'CEF', color: '#005ca9' },
  { code: '237', name: 'Bradesco', initials: 'BRA', color: '#cc092f' },
  { code: '341', name: 'Itaú Unibanco', initials: 'ITAU', color: '#ec7000' },
  { code: '756', name: 'Sicoob', initials: 'SIC', color: '#003641' },
  { code: '748', name: 'Sicredi', initials: 'SICR', color: '#00af3f' },
  { code: '260', name: 'Nubank', initials: 'NU', color: '#820ad1' },
  { code: '077', name: 'Banco Inter', initials: 'INT', color: '#ff7a00' },
  { code: '212', name: 'Banco Original', initials: 'ORI', color: '#000000' },
  { code: '655', name: 'Neon', initials: 'NEO', color: '#00e5ff' },
  { code: '290', name: 'PagBank', initials: 'PAG', color: '#00b140' },
  { code: '380', name: 'PicPay', initials: 'PIC', color: '#21c25e' },
  { code: '000', name: 'Outro Banco / Carteira', initials: 'OU', color: '#64748b' }
];

interface ContasBancariasProps {
  currentUser?: User | null;
  accounts: FinancialAccount[];
  categories?: FinancialCategory[];
  transactions?: FinancialTransaction[];
  getAccountLiveBalance: (account: FinancialAccount) => number;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onRefreshData: () => void;
  onAddAccount: () => void;
  onEditAccount: (account: FinancialAccount) => void;
  onDeleteAccount: (id: string) => void;
}

export const ContasBancarias: React.FC<ContasBancariasProps> = ({
  accounts,
  categories = [],
  transactions = [],
  getAccountLiveBalance,
  showToast,
  onRefreshData,
  onAddAccount,
  onEditAccount,
  onDeleteAccount,
}) => {
  const [accountTypeFilter, setAccountTypeFilter] = useState<'all' | 'bank' | 'card'>('all');
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form states for Nova Transferência
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('Transferência entre contas');
  const [costCenterId, setCostCenterId] = useState('');

  // Fallback category state if categories prop not provided
  const [fetchedCategories, setFetchedCategories] = useState<FinancialCategory[]>([]);
  const availableCategories = (categories && categories.length > 0) ? categories : fetchedCategories;

  useEffect(() => {
    if (!categories || categories.length === 0) {
      if (supabase) {
        supabase
          .from('financial_categories')
          .select('*')
          .order('name', { ascending: true })
          .then(({ data }) => {
            if (data) setFetchedCategories(data as FinancialCategory[]);
          })
          .catch(console.error);
      }
    }
  }, [categories]);

  const formatAccountTypeLabel = (typeStr?: string) => {
    if (!typeStr) return 'Conta Corrente';
    const t = typeStr.toLowerCase();
    if (t === 'checking' || t === 'corrente') return 'Conta Corrente';
    if (t === 'savings' || t === 'poupança') return 'Poupança';
    if (t === 'credit_card' || t === 'credit' || t === 'cartão') return 'Cartão de Crédito';
    if (t === 'cash' || t === 'caixa' || t === 'dinheiro') return 'Caixa';
    return typeStr;
  };

  const filteredAccounts = accounts.filter(a => {
    const isCard = a.type === 'credit_card' || (a as any).account_type === 'credit_card' || a.type === 'CREDIT';
    if (accountTypeFilter === 'bank') return !isCard;
    if (accountTypeFilter === 'card') return isCard;
    return true;
  });

  // Filter accounts for transfers: EXCLUDE credit cards
  const transferAccounts = accounts.filter(a => {
    const type = (a.type || (a as any).account_type || '').toLowerCase();
    const isCard = type === 'credit_card' || type === 'credit' || type === 'cartão';
    return !isCard;
  });

  const selectedFromAccount = accounts.find(a => a.id === fromAccountId);
  const fromAccountBalance = selectedFromAccount ? getAccountLiveBalance(selectedFromAccount) : 0;
  const numericAmount = parseFloat(amount.replace(',', '.'));
  const isInsufficientBalance = !isNaN(numericAmount) && numericAmount > 0 && selectedFromAccount ? numericAmount > fromAccountBalance : false;

  const handleOpenTransferModal = () => {
    if (transferAccounts.length < 2) {
      showToast('É necessário ter pelo menos 2 contas bancárias para realizar uma transferência', 'error');
      return;
    }
    setFromAccountId(transferAccounts[0]?.id || '');
    setToAccountId(transferAccounts[1]?.id || '');
    setAmount('');
    setDate(new Date().toISOString().split('T')[0]);
    setDescription('Transferência entre contas');
    setCostCenterId('');
    setIsTransferModalOpen(true);
  };

  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromAccountId || !toAccountId) {
      showToast('Selecione as contas de origem e destino', 'error');
      return;
    }
    if (fromAccountId === toAccountId) {
      showToast('A conta de origem e destino não podem ser iguais', 'error');
      return;
    }
    const val = parseFloat(amount.replace(',', '.'));
    if (isNaN(val) || val <= 0) {
      showToast('Informe um valor válido maior que zero', 'error');
      return;
    }
    if (isInsufficientBalance) {
      showToast('Saldo insuficiente', 'error');
      return;
    }

    setSubmitting(true);
    try {
      if (!supabase) throw new Error('Supabase não inicializado');

      const { data: rpcData, error: rpcError } = await supabase.rpc('create_account_transfer', {
        p_from_account_id: fromAccountId,
        p_to_account_id: toAccountId,
        p_amount: val,
        p_date: date,
        p_description: description,
        p_cost_center_id: costCenterId || null,
      });

      if (rpcError) {
        console.error('Error in create_account_transfer RPC:', rpcError);
        throw rpcError;
      }

      if (costCenterId) {
        const transferId = typeof rpcData === 'string' ? rpcData : (rpcData as any)?.id;
        if (transferId) {
          try {
            const { error: updateErr } = await supabase
              .from('bank_transactions')
              .update({ cost_center_id: costCenterId, category_id: costCenterId })
              .eq('transfer_id', transferId);
            if (updateErr) {
              await supabase
                .from('bank_transactions')
                .update({ category_id: costCenterId })
                .eq('transfer_id', transferId);
            }
          } catch (e) {
            console.warn('Could not update cost_center_id on bank_transactions:', e);
          }
        }
      }

      showToast('Transferência realizada com sucesso!', 'success');
      setIsTransferModalOpen(false);
      onRefreshData();
    } catch (err: any) {
      console.error('Falha ao realizar transferência:', err);
      showToast(err.message || 'Erro ao processar transferência', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <FinancialKpiHeaderCards transactions={transactions} />

      {/* Action Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex gap-2 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setAccountTypeFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              accountTypeFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Todos ({accounts.length})
          </button>
          <button
            onClick={() => setAccountTypeFilter('bank')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              accountTypeFilter === 'bank' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Contas ({accounts.filter(a => a.type !== 'credit_card' && (a as any).account_type !== 'credit_card').length})
          </button>
          <button
            onClick={() => setAccountTypeFilter('card')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              accountTypeFilter === 'card' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Cartões ({accounts.filter(a => a.type === 'credit_card' || (a as any).account_type === 'credit_card').length})
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenTransferModal}
            className="flex items-center gap-2 bg-indigo-600 text-white rounded-xl px-4 py-2 text-xs font-bold hover:bg-indigo-700 transition-all shadow-xs cursor-pointer"
          >
            <ArrowRightLeft size={14} /> Nova Transferência
          </button>

          <button
            onClick={onAddAccount}
            className="flex items-center gap-2 bg-slate-900 text-white rounded-xl px-4 py-2 text-xs font-bold hover:bg-slate-800 transition-all shadow-xs cursor-pointer"
          >
            <Plus size={14} /> Nova Conta
          </button>
        </div>
      </div>

      {/* Account Grid */}
      {filteredAccounts.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-100 p-12 shadow-sm text-center flex flex-col items-center justify-center space-y-4">
          <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center shadow-inner">
            <Wallet size={32} />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-black text-slate-800">Nenhuma conta bancária cadastrada</h3>
            <p className="text-sm text-slate-400 font-medium">Cadastre contas para realizar e controlar os lançamentos financeiros.</p>
          </div>
          <button 
            onClick={onAddAccount}
            className="flex items-center gap-2 bg-slate-900 text-white rounded-xl px-5 py-2.5 text-sm font-bold hover:bg-slate-800 transition-all shadow-md cursor-pointer"
          >
            <Plus size={16} /> Adicionar Conta
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
          {filteredAccounts.map(account => {
            const liveBalance = getAccountLiveBalance(account);
            const bank = BANKS.find(b => b.code === (account as any).bank_code);
            const initials = bank ? bank.initials : 'BC';
            const bankName = bank ? bank.name : 'Banco';
            const bankColor = bank ? bank.color : '#64748b';

            return (
              <div key={account.id} className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-50 mb-4">
                    <div className="flex items-center gap-2.5">
                      <div 
                        className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black text-white shadow-sm shrink-0"
                        style={{ backgroundColor: bankColor }}
                      >
                        {initials}
                      </div>
                      <span className="text-xs font-extrabold text-slate-700 tracking-tight">
                        {bankName}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-slate-50 border border-slate-100 text-[9px] font-extrabold uppercase text-slate-500 tracking-wider">
                      {formatAccountTypeLabel(account.type || (account as any).account_type)}
                    </span>
                  </div>

                  <div className="mb-4">
                    <h4 className="text-base font-black text-slate-800 leading-tight">{account.name}</h4>
                  </div>
                </div>

                <div>
                  <div className="bg-slate-50/50 rounded-xl p-3 border border-slate-100/50 mb-4">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">
                      Saldo da Conta
                    </span>
                    <p className="text-xl font-black text-slate-900 mt-0.5">{formatCurrency(liveBalance)}</p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="flex items-center gap-1 text-[9px] font-extrabold text-emerald-600 uppercase tracking-wider bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100/80">
                      <Check size={10} /> Conciliada
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button 
                        onClick={() => onEditAccount(account)}
                        className="flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors p-1.5 rounded-lg cursor-pointer"
                        title="Editar Conta"
                      >
                        <Pencil size={11} /> <span className="sr-only sm:not-sr-only">Editar</span>
                      </button>
                      <button 
                        onClick={() => onDeleteAccount(account.id)}
                        className="flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors p-1.5 rounded-lg cursor-pointer"
                        title="Excluir Conta"
                      >
                        <Trash2 size={11} /> <span className="sr-only sm:not-sr-only">Excluir</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Nova Transferência */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 relative">
            <button
              onClick={() => setIsTransferModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg cursor-pointer"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-6 pb-3 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <ArrowRightLeft size={20} />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-800 leading-tight">Nova Transferência</h3>
                <p className="text-xs text-slate-500 font-medium">Transferir saldo entre contas</p>
              </div>
            </div>

            <form onSubmit={handleCreateTransfer} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Conta Origem (Sai saldo)
                </label>
                <select
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  value={fromAccountId}
                  onChange={(e) => setFromAccountId(e.target.value)}
                  required
                >
                  {transferAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({formatCurrency(getAccountLiveBalance(acc))})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Conta Destino (Entra saldo)
                </label>
                <select
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  value={toAccountId}
                  onChange={(e) => setToAccountId(e.target.value)}
                  required
                >
                  {transferAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({formatCurrency(getAccountLiveBalance(acc))})
                    </option>
                  ))}
                </select>
                {fromAccountId === toAccountId && (
                  <p className="text-xs text-rose-600 font-semibold mt-1">
                    A conta de origem e destino devem ser diferentes.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Valor (R$)
                    </label>
                    {isInsufficientBalance && (
                      <span className="text-[11px] font-bold text-rose-600 animate-pulse">
                        Saldo insuficiente
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <DollarSign size={16} className="absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0,00"
                      className={`w-full bg-slate-50 border rounded-xl pl-9 pr-3 py-2 text-sm text-slate-800 font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden ${
                        isInsufficientBalance ? 'border-rose-400 bg-rose-50/30 text-rose-900 focus:ring-rose-400' : 'border-slate-200'
                      }`}
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Data
                  </label>
                  <div className="relative">
                    <Calendar size={16} className="absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="date"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Descrição
                </label>
                <div className="relative">
                  <FileText size={16} className="absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Ex: Transferência entre contas"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Centro de Custo (opcional)
                </label>
                <select
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  value={costCenterId}
                  onChange={(e) => setCostCenterId(e.target.value)}
                >
                  <option value="">Nenhum (Sem centro de custo)</option>
                  {availableCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting || fromAccountId === toAccountId || isInsufficientBalance}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Processando...' : 'Confirmar Transferência'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

