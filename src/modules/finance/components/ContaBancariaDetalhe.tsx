import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft, 
  Upload, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  FileText, 
  Search, 
  Filter, 
  ArrowUpRight, 
  ArrowDownLeft,
  SlidersHorizontal,
  Building2
} from 'lucide-react';
import { FinancialAccount, User, FinancialCategory, FinancialTransaction } from '../../../../types';
import { BankLogo, getNormalizedBankCode } from '../../../components/BankLogo';
import { formatCurrency } from '../utils/currency';
import { Conciliacao } from './Conciliacao';
import { ImportarExtrato } from './ImportarExtrato';
import { BANKS, formatAccountTypeLabel } from './ContasBancarias';

interface ContaBancariaDetalheProps {
  accountId: string;
  currentUser: User;
  accounts: FinancialAccount[];
  categories?: FinancialCategory[];
  transactions?: FinancialTransaction[];
  getAccountLiveBalance: (account: FinancialAccount) => number;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  onBack: () => void;
  onRefreshData: () => void;
  onOpenNewExpenseModal?: (data: any) => void;
  initialTab?: 'visao_geral' | 'transacoes' | 'conciliacao' | 'importar';
}

export const ContaBancariaDetalhe: React.FC<ContaBancariaDetalheProps> = ({
  accountId,
  currentUser,
  accounts,
  categories = [],
  transactions = [],
  getAccountLiveBalance,
  showToast,
  onBack,
  onRefreshData,
  onOpenNewExpenseModal,
  initialTab = 'visao_geral',
}) => {
  const [activeTab, setActiveTab] = useState<'visao_geral' | 'transacoes' | 'conciliacao' | 'importar'>(initialTab);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');

  const account = useMemo(() => {
    return accounts.find((a) => a.id === accountId);
  }, [accounts, accountId]);

  const liveBalance = useMemo(() => {
    return account ? getAccountLiveBalance(account) : 0;
  }, [account, getAccountLiveBalance]);

  const rawBankCode = (account as any)?.bank_code;
  const normBankCode = getNormalizedBankCode(rawBankCode);
  const bankObj = BANKS.find((b) => b.code === rawBankCode || b.code === normBankCode);
  const bankName = bankObj ? bankObj.name : normBankCode !== 'outros' ? normBankCode.toUpperCase() : 'Banco';

  // Filter transactions for this account
  const accountTransactions = useMemo(() => {
    return transactions.filter(
      (t) => t.account_id === accountId || (t as any).financial_account_id === accountId
    );
  }, [transactions, accountId]);

  // Filtered transactions for the "Transações" tab
  const filteredTransactions = useMemo(() => {
    return accountTransactions.filter((t) => {
      const matchSearch =
        !searchTerm ||
        t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.category_name && t.category_name.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchType =
        typeFilter === 'all' ||
        (typeFilter === 'income' && t.type === 'INCOME') ||
        (typeFilter === 'expense' && t.type === 'EXPENSE');

      return matchSearch && matchType;
    });
  }, [accountTransactions, searchTerm, typeFilter]);

  // Totals for Visão Geral
  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    accountTransactions.forEach((t) => {
      if (t.type === 'INCOME') income += t.amount || 0;
      else if (t.type === 'EXPENSE') expense += t.amount || 0;
    });
    return { income, expense, count: accountTransactions.length };
  }, [accountTransactions]);

  if (!account) {
    return (
      <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center space-y-4">
        <AlertCircle size={40} className="mx-auto text-amber-500" />
        <h3 className="text-lg font-bold text-slate-800">Conta bancária não encontrada</h3>
        <p className="text-sm text-slate-500">A conta solicitada pode ter sido removida ou não existe.</p>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors inline-flex items-center gap-2"
        >
          <ArrowLeft size={16} /> Voltar para Contas Bancárias
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header / Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
        <div className="space-y-1">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer mb-1"
          >
            <ArrowLeft size={14} /> Voltar para Contas Bancárias
          </button>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center p-1.5 shrink-0 shadow-xs">
              <BankLogo code={normBankCode} size={28} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900">{account.name}</h2>
                <span className="px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-[10px] font-bold uppercase text-slate-600 tracking-wider">
                  {formatAccountTypeLabel(account.type || (account as any).account_type)}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                {bankName} • Gerenciamento centralizado de extratos e conciliações
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setActiveTab('importar')}
            className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/60 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Upload size={15} /> Importar Extrato
          </button>
          <button
            onClick={() => setActiveTab('conciliacao')}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <RefreshCw size={15} /> Conciliar
          </button>
        </div>
      </div>

      {/* 4 KPI Cards Header */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Saldo */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Saldo Atual</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <DollarSign size={18} />
            </div>
          </div>
          <p className={`text-2xl font-black ${liveBalance >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
            {formatCurrency(liveBalance)}
          </p>
          <span className="text-[11px] text-slate-400 font-medium block">
            Saldo acumulado da conta
          </span>
        </div>

        {/* Card 2: Tipo de Conta */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Tipo de Conta</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Building2 size={18} />
            </div>
          </div>
          <p className="text-lg font-bold text-slate-900">
            {formatAccountTypeLabel(account.type || (account as any).account_type)}
          </p>
          <span className="text-[11px] text-slate-400 font-medium block">
            {account.is_default ? 'Conta Principal (Padrão)' : 'Conta Auxiliar'}
          </span>
        </div>

        {/* Card 3: Banco */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Banco</span>
            <BankLogo code={normBankCode} size={22} />
          </div>
          <p className="text-lg font-bold text-slate-900 truncate">{bankName}</p>
          <span className="text-[11px] text-slate-400 font-medium block">
            Código: {rawBankCode || '—'}
          </span>
        </div>

        {/* Card 4: Status da Conciliação */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Status</span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
              <CheckCircle2 size={12} /> Ativa
            </span>
          </div>
          <span className="text-[11px] text-slate-400 font-medium block">
            {totals.count} lançamentos vinculados
          </span>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="bg-slate-100 p-1.5 rounded-2xl flex items-center gap-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab('visao_geral')}
          className={`flex-1 min-w-[120px] py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer text-center ${
            activeTab === 'visao_geral'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          Visão Geral
        </button>
        <button
          onClick={() => setActiveTab('transacoes')}
          className={`flex-1 min-w-[120px] py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer text-center ${
            activeTab === 'transacoes'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          Transações ({totals.count})
        </button>
        <button
          onClick={() => setActiveTab('conciliacao')}
          className={`flex-1 min-w-[120px] py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer text-center ${
            activeTab === 'conciliacao'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          Conciliação
        </button>
        <button
          onClick={() => setActiveTab('importar')}
          className={`flex-1 min-w-[120px] py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer text-center ${
            activeTab === 'importar'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          Importar Extrato
        </button>
      </div>

      {/* Tab Content */}
      <div>
        {/* TAB 1: VISÃO GERAL */}
        {activeTab === 'visao_geral' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Receitas vs Despesas da Conta */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                  Resumo de Entradas e Saídas
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-emerald-50/60 border border-emerald-100 rounded-xl space-y-1">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 block">
                      Total de Entradas
                    </span>
                    <p className="text-xl font-bold text-emerald-700">
                      {formatCurrency(totals.income)}
                    </p>
                  </div>
                  <div className="p-4 bg-rose-50/60 border border-rose-100 rounded-xl space-y-1">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-700 block">
                      Total de Saídas
                    </span>
                    <p className="text-xl font-bold text-rose-700">
                      {formatCurrency(totals.expense)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Ações Rápidas */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                  Ações da Conta
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => setActiveTab('importar')}
                    className="p-4 border border-slate-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50/50 transition-all text-left space-y-2 group cursor-pointer"
                  >
                    <Upload size={20} className="text-indigo-600 group-hover:scale-110 transition-transform" />
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">Importar OFX/CSV</h4>
                      <p className="text-[11px] text-slate-500">Enviar extrato bancário</p>
                    </div>
                  </button>

                  <button
                    onClick={() => setActiveTab('conciliacao')}
                    className="p-4 border border-slate-200 rounded-xl hover:border-slate-400 hover:bg-slate-50 transition-all text-left space-y-2 group cursor-pointer"
                  >
                    <RefreshCw size={20} className="text-slate-700 group-hover:scale-110 transition-transform" />
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">Conciliar Extrato</h4>
                      <p className="text-[11px] text-slate-500">Vincular transações pendentes</p>
                    </div>
                  </button>
                </div>
              </div>
            </div>

            {/* Últimas Transações Preview */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                  Últimas Transações da Conta
                </h3>
                <button
                  onClick={() => setActiveTab('transacoes')}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors cursor-pointer"
                >
                  Ver Todas →
                </button>
              </div>

              {accountTransactions.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">
                  Nenhuma transação registrada nesta conta ainda.
                </p>
              ) : (
                <div className="space-y-2">
                  {accountTransactions.slice(0, 5).map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-50/60 hover:bg-slate-100/60 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            t.type === 'INCOME'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-rose-100 text-rose-700'
                          }`}
                        >
                          {t.type === 'INCOME' ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800">{t.description}</p>
                          <span className="text-[10px] text-slate-500 font-medium">
                            {t.date} • {t.category_name || 'Geral'}
                          </span>
                        </div>
                      </div>
                      <span
                        className={`text-xs font-bold ${
                          t.type === 'INCOME' ? 'text-emerald-600' : 'text-slate-800'
                        }`}
                      >
                        {t.type === 'INCOME' ? '+' : '-'} {formatCurrency(t.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: TRANSAÇÕES */}
        {activeTab === 'transacoes' && (
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="relative w-full sm:w-72">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar transação..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={() => setTypeFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                    typeFilter === 'all'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Todas
                </button>
                <button
                  onClick={() => setTypeFilter('income')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                    typeFilter === 'income'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  }`}
                >
                  Entradas
                </button>
                <button
                  onClick={() => setTypeFilter('expense')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                    typeFilter === 'expense'
                      ? 'bg-rose-600 text-white'
                      : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                  }`}
                >
                  Saídas
                </button>
              </div>
            </div>

            {/* Transactions Table */}
            {filteredTransactions.length === 0 ? (
              <p className="text-xs text-slate-500 py-12 text-center">
                Nenhuma transação encontrada com os filtros selecionados.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 uppercase text-[10px] font-bold">
                      <th className="pb-3 font-semibold">Data</th>
                      <th className="pb-3 font-semibold">Descrição</th>
                      <th className="pb-3 font-semibold">Categoria</th>
                      <th className="pb-3 font-semibold">Tipo</th>
                      <th className="pb-3 font-semibold text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredTransactions.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 font-medium text-slate-600 whitespace-nowrap">{t.date}</td>
                        <td className="py-3 font-bold text-slate-800">{t.description}</td>
                        <td className="py-3 text-slate-500 font-medium">
                          {t.category_name || 'Geral'}
                        </td>
                        <td className="py-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              t.type === 'INCOME'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-rose-50 text-rose-700'
                            }`}
                          >
                            {t.type === 'INCOME' ? 'Entrada' : 'Saída'}
                          </span>
                        </td>
                        <td
                          className={`py-3 text-right font-bold whitespace-nowrap ${
                            t.type === 'INCOME' ? 'text-emerald-600' : 'text-slate-800'
                          }`}
                        >
                          {t.type === 'INCOME' ? '+' : '-'} {formatCurrency(t.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: CONCILIAÇÃO */}
        {activeTab === 'conciliacao' && (
          <Conciliacao
            currentUser={currentUser}
            accounts={accounts}
            transactions={transactions}
            showToast={showToast}
            onOpenNewExpenseModal={onOpenNewExpenseModal}
            categories={categories}
            accountId={accountId}
          />
        )}

        {/* TAB 4: IMPORTAR EXTRATO */}
        {activeTab === 'importar' && (
          <ImportarExtrato
            accounts={accounts}
            agencyId={currentUser.agencyId}
            currentUser={currentUser}
            onGoToReconcile={() => setActiveTab('conciliacao')}
            onImportDone={() => {
              onRefreshData();
              if (showToast) {
                showToast('Ação concluída com sucesso.', 'success');
              }
            }}
            showToast={showToast}
            accountId={accountId}
          />
        )}
      </div>
    </div>
  );
};
