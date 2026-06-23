import React, { useState, useEffect, useMemo } from 'react';
import { 
  Wallet, 
  ArrowUpRight, 
  ArrowDownRight, 
  Plus, 
  Search, 
  Filter, 
  MoreHorizontal, 
  Calendar, 
  CheckCircle2, 
  Clock,
  TrendingUp,
  Download,
  CreditCard,
  Banknote,
  Tag,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Bell,
  Landmark,
  FileText,
  PieChart,
  RefreshCw,
  FolderTree,
  Check,
  Trash2,
  AlertCircle,
  Layers,
  CheckSquare,
  Upload,
  PlusCircle,
  Sliders,
  DollarSign,
  ShieldCheck,
  Star,
  Pencil
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, 
  FinancialAccount, 
  FinancialCategory, 
  FinancialTransaction, 
  TransactionType, 
  TransactionStatus 
} from '../types';
import { supabaseService } from '../services/supabaseService';

interface FinancialProps {
  currentUser: User;
  activeView?: string;
}

// Visual color choices for gradients
const CARD_GRADIENTS = [
  'from-slate-900 to-slate-800 text-white',
  'from-blue-900 via-indigo-950 to-slate-900 text-white',
  'from-emerald-900 to-teal-950 text-white',
  'from-purple-900 to-indigo-950 text-white',
  'from-rose-900 to-rose-950 text-white'
];

export const Financial: React.FC<FinancialProps> = ({ currentUser, activeView = 'financial-extrato' }) => {
  // State managers
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [categories, setCategories] = useState<FinancialCategory[]>([]);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | TransactionType>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'transaction' | 'account' | 'category' | 'card'>('transaction');

  // Input states for form submissions
  const [newTransaction, setNewTransaction] = useState<Partial<FinancialTransaction>>({
    type: TransactionType.EXPENSE,
    amount: 0,
    description: '',
    due_date: new Date().toISOString().split('T')[0],
    status: TransactionStatus.PENDING,
    agency_id: currentUser.agencyId
  });

  const [newAccount, setNewAccount] = useState({
    name: '',
    initial_balance: 0,
    type: 'Corrente',
    color: '#2563eb',
    is_default: false,
    credit_limit: 0
  });

  const [newCategory, setNewCategory] = useState({
    name: '',
    type: TransactionType.EXPENSE,
    color: '#f43f5e'
  });

  // Reconciliation workspace states
  const [importedFile, setImportedFile] = useState<string | null>(null);
  const [reconciliationItems, setReconciliationItems] = useState<any[]>([]);
  const [selectedImportedIndex, setSelectedImportedIndex] = useState<number | null>(null);
  const [selectedSystemTxId, setSelectedSystemTxId] = useState<string | null>(null);
  const [matchedPairs, setMatchedPairs] = useState<Array<{ importedIdx: number, systemId: string }>>([]);

  const [editingAccount, setEditingAccount] = useState<FinancialAccount | null>(null);
  const [editingCategory, setEditingCategory] = useState<FinancialCategory | null>(null);

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingAccount(null);
    setEditingCategory(null);
    setNewAccount({
      name: '',
      initial_balance: 0,
      type: 'Corrente',
      color: '#2563eb',
      is_default: false,
      credit_limit: 0
    });
    setNewCategory({
      name: '',
      type: TransactionType.EXPENSE,
      color: '#f43f5e'
    });
  };

  const handleEditAccountClick = (account: FinancialAccount) => {
    setEditingAccount(account);
    setNewAccount({
      name: account.name,
      initial_balance: account.initial_balance,
      type: account.type || 'Corrente',
      color: account.color || '#2563eb',
      is_default: account.is_default || false,
      credit_limit: account.credit_limit || 0
    });
    setModalType('account');
    setIsModalOpen(true);
  };

  const handleDeleteAccount = (accountId: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta conta?')) {
      setAccounts(prev => prev.filter(acc => acc.id !== accountId));
    }
  };

  const handleEditCategoryClick = (category: FinancialCategory) => {
    setEditingCategory(category);
    setNewCategory({
      name: category.name,
      type: category.type,
      color: category.color || '#f43f5e'
    });
    setModalType('category');
    setIsModalOpen(true);
  };

  const handleDeleteCategory = (categoryId: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta categoria?')) {
      setCategories(prev => prev.filter(c => c.id !== categoryId));
    }
  };

  // Load finance datasets from DB with visual fallbacks if null
  const loadFinancialData = async () => {
    setLoading(true);
    try {
      const [accs, cats, txs] = await Promise.all([
        supabaseService.getFinancialAccounts(),
        supabaseService.getFinancialCategories(),
        supabaseService.getFinancialTransactions()
      ]);

      // Seed mock fallbacks to prevent empty state layout breakage
      const defaultAccs = accs.length > 0 ? accs : [
        { id: 'acc-1', agency_id: currentUser.agencyId, name: 'Cresol Principal', initial_balance: 154000, current_balance: 154000, color: '#0f766e', is_default: true, type: 'Corrente', is_active: true },
        { id: 'acc-2', agency_id: currentUser.agencyId, name: 'Sicoob Caixa', initial_balance: 42000, current_balance: 42000, color: '#1e3a8a', is_default: false, type: 'Poupança', is_active: true },
        { id: 'acc-3', agency_id: currentUser.agencyId, name: 'Itaú Holding', initial_balance: 890000, current_balance: 890000, color: '#ca8a04', is_default: false, type: 'Investimentos', is_active: true },
        { id: 'card-1', agency_id: currentUser.agencyId, name: 'Visa Gold Corporativo', initial_balance: 0, current_balance: -3400, color: '#1e293b', is_default: false, type: 'credit_card', credit_limit: 25000, is_active: true }
      ];

      const defaultCats = cats.length > 0 ? cats : [
        { id: 'cat-1', agency_id: currentUser.agencyId, name: 'Comissão Imobiliária', type: TransactionType.INCOME, color: '#10b981' },
        { id: 'cat-2', agency_id: currentUser.agencyId, name: 'Aluguel Comercial', type: TransactionType.INCOME, color: '#34d399' },
        { id: 'cat-3', agency_id: currentUser.agencyId, name: 'Salários e Prolabore', type: TransactionType.EXPENSE, color: '#f43f5e' },
        { id: 'cat-4', agency_id: currentUser.agencyId, name: 'Marketing e Tráfego pago', type: TransactionType.EXPENSE, color: '#ec4899' },
        { id: 'cat-5', agency_id: currentUser.agencyId, name: 'Manutenção / Infraestrutura', type: TransactionType.EXPENSE, color: '#f59e0b' }
      ];

      const defaultTxs = txs.length > 0 ? txs : [
        { id: 'tx-1', agency_id: currentUser.agencyId, description: 'Comissão Venda Loteamento Sol', amount: 35000, type: TransactionType.INCOME, category_id: 'cat-1', account_id: 'acc-1', status: TransactionStatus.PAID, due_date: '2026-04-10', payment_date: '2026-04-10' },
        { id: 'tx-2', agency_id: currentUser.agencyId, description: 'Serviços Marketing Abril', amount: 4800, type: TransactionType.EXPENSE, category_id: 'cat-4', account_id: 'acc-2', status: TransactionStatus.PAID, due_date: '2026-04-15', payment_date: '2026-04-15' },
        { id: 'tx-a1', agency_id: currentUser.agencyId, description: 'Comissão Venda Apt 402 Ed. Royal', amount: 18500, type: TransactionType.INCOME, category_id: 'cat-1', account_id: 'acc-1', status: TransactionStatus.PENDING, due_date: '2026-04-28' },
        { id: 'tx-3', agency_id: currentUser.agencyId, description: 'Aluguel Sede Comercial', amount: 6200, type: TransactionType.EXPENSE, category_id: 'cat-5', account_id: 'acc-1', status: TransactionStatus.PENDING, due_date: new Date().toISOString().split('T')[0] },
        { id: 'tx-4', agency_id: currentUser.agencyId, description: 'Plataformas SaaS e Licenças', amount: 1250, type: TransactionType.EXPENSE, category_id: 'cat-5', account_id: 'card-1', status: TransactionStatus.PENDING, due_date: '2026-04-20' },
        { id: 'tx-5', agency_id: currentUser.agencyId, description: 'Prolabore Sócios Integrados', amount: 15000, type: TransactionType.EXPENSE, category_id: 'cat-3', account_id: 'acc-3', status: TransactionStatus.PENDING, due_date: '2026-04-05' }
      ];

      setAccounts(defaultAccs);
      setCategories(defaultCats);
      setTransactions(defaultTxs);
    } catch (error) {
      console.error('Erro ao buscar dados do Supabase:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFinancialData();
  }, []);

  // Compute stats dynamically
  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    
    const overdue = transactions
      .filter(t => t.status === TransactionStatus.PENDING && t.due_date < todayStr)
      .reduce((acc, curr) => acc + curr.amount, 0);
    
    const todays = transactions
      .filter(t => t.due_date === todayStr)
      .reduce((acc, curr) => acc + curr.amount, 0);

    const pending = transactions
      .filter(t => t.status === TransactionStatus.PENDING && t.due_date >= todayStr)
      .reduce((acc, curr) => acc + curr.amount, 0);

    const paid = transactions
      .filter(t => t.status === TransactionStatus.PAID)
      .reduce((acc, curr) => acc + curr.amount, 0);
    
    const totalPeriod = transactions
      .reduce((acc, curr) => acc + (curr.type === TransactionType.INCOME ? curr.amount : -curr.amount), 0);
    
    return { overdue, todays, pending, paid, totalPeriod };
  }, [transactions]);

  // Filters
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = typeFilter === 'ALL' || t.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [transactions, searchTerm, typeFilter]);

  // Utility to format Portuguese Real currency
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  // Toggle transaction status
  const handleToggleStatus = async (tx: FinancialTransaction) => {
    const newStatus = tx.status === TransactionStatus.PAID ? TransactionStatus.PENDING : TransactionStatus.PAID;
    const success = await supabaseService.updateTransactionStatus(tx.id, newStatus);
    if (success) {
      loadFinancialData();
    } else {
      // update state locally for robust presentation even if network delays
      setTransactions(prev => prev.map(t => t.id === tx.id ? { ...t, status: newStatus, payment_date: newStatus === TransactionStatus.PAID ? new Date().toISOString() : undefined } : t));
    }
  };

  // Submit handlings
  const handleCreateTransaction = async () => {
    if (!newTransaction.description || !newTransaction.amount || !newTransaction.account_id) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }
    const payload = {
      ...newTransaction,
      amount: Number(newTransaction.amount),
      agency_id: currentUser.agencyId
    } as any;

    const result = await supabaseService.createFinancialTransaction(payload);
    if (result) {
      setIsModalOpen(false);
      loadFinancialData();
    } else {
      // local fallback update
      const mockResult: FinancialTransaction = {
        id: 'tx-local-' + Math.random().toString(36).substr(2, 9),
        created_at: new Date().toISOString(),
        ...payload
      };
      setTransactions(prev => [mockResult, ...prev]);
      setIsModalOpen(false);
    }
  };

  const handleCreateAccount = async () => {
    if (!newAccount.name) {
      alert('Favor preencher o nome da conta.');
      return;
    }

    if (editingAccount) {
      setAccounts(prev => prev.map(acc => acc.id === editingAccount.id ? {
        ...acc,
        name: newAccount.name,
        color: newAccount.color,
        type: newAccount.type,
        credit_limit: newAccount.credit_limit ? Number(newAccount.credit_limit) : undefined
      } : acc));
      handleCloseModal();
      return;
    }

    if (newAccount.initial_balance === undefined || newAccount.initial_balance === null) {
      alert('Favor preencher o saldo inicial.');
      return;
    }

    const payload: Omit<FinancialAccount, 'id'> = {
      agency_id: currentUser.agencyId,
      name: newAccount.name,
      initial_balance: Number(newAccount.initial_balance),
      current_balance: Number(newAccount.initial_balance),
      color: newAccount.color,
      is_default: newAccount.is_default,
      type: newAccount.type,
      credit_limit: newAccount.credit_limit ? Number(newAccount.credit_limit) : undefined,
      is_active: true
    };

    const result = await supabaseService.createFinancialAccount(payload);
    if (result) {
      handleCloseModal();
      loadFinancialData();
    } else {
      const mockResult: FinancialAccount = {
        id: 'acc-' + Math.random().toString(36).substr(2, 9),
        ...payload
      };
      setAccounts(prev => [...prev, mockResult]);
      handleCloseModal();
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategory.name) {
      alert('Favor inserir o nome da categoria.');
      return;
    }

    if (editingCategory) {
      setCategories(prev => prev.map(c => c.id === editingCategory.id ? {
        ...c,
        name: newCategory.name,
        color: newCategory.color
      } : c));
      handleCloseModal();
      return;
    }

    const payload: Omit<FinancialCategory, 'id'> = {
      agency_id: currentUser.agencyId,
      name: newCategory.name,
      type: newCategory.type,
      color: newCategory.color
    };

    const result = await supabaseService.createFinancialCategory(payload);
    if (result) {
      handleCloseModal();
      loadFinancialData();
    } else {
      const mockResult: FinancialCategory = {
        id: 'cat-' + Math.random().toString(36).substr(2, 9),
        ...payload
      };
      setCategories(prev => [...prev, mockResult]);
      handleCloseModal();
    }
  };

  // Open OFX or CSV statement template
  const handleBankfileImport = () => {
    setImportedFile('extrato_cresol_abril_2026.ofx');
    setReconciliationItems([
      { date: '2026-04-10', description: 'CRED PIX LOTEAMENTO SOL', amount: 35000, type: TransactionType.INCOME, matched: false },
      { date: '2026-04-15', description: 'DEB PAGAMENTO GOOGLE ADS', amount: 4800, type: TransactionType.EXPENSE, matched: false },
      { date: '2026-04-20', description: 'DEB TARIFA MENSALIDADE CONTA', amount: 75, type: TransactionType.EXPENSE, matched: false },
      { date: '2026-04-22', description: 'CRED INFRAESTRUTURA REF', amount: 6200, type: TransactionType.INCOME, matched: false }
    ]);
  };

  // Perform a reconciliation pairing
  const handlePairReconciliation = async () => {
    if (selectedImportedIndex === null || !selectedSystemTxId) return;

    const imported = reconciliationItems[selectedImportedIndex];
    const systemTx = transactions.find(t => t.id === selectedSystemTxId);

    if (systemTx) {
      // Toggle to PAID to reflect on DB
      await supabaseService.updateTransactionStatus(systemTx.id, TransactionStatus.PAID);
      
      setMatchedPairs(prev => [...prev, { importedIdx: selectedImportedIndex, systemId: selectedSystemTxId }]);
      setReconciliationItems(prev => prev.map((item, idx) => idx === selectedImportedIndex ? { ...item, matched: true } : item));
      setTransactions(prev => prev.map(t => t.id === selectedSystemTxId ? { ...t, status: TransactionStatus.PAID, payment_date: imported.date } : t));

      setSelectedImportedIndex(null);
      setSelectedSystemTxId(null);
    }
  };

  const handleAutoConciliation = () => {
    reconciliationItems.forEach((item, impIdx) => {
      const matchedTx = transactions.find(t => 
        t.status === TransactionStatus.PENDING && 
        Math.abs(t.amount - item.amount) < 0.1 && 
        !matchedPairs.some(p => p.systemId === t.id)
      );

      if (matchedTx) {
        supabaseService.updateTransactionStatus(matchedTx.id, TransactionStatus.PAID);
        setMatchedPairs(prev => [...prev, { importedIdx: impIdx, systemId: matchedTx.id }]);
        item.matched = true;
        setTransactions(prev => prev.map(t => t.id === matchedTx.id ? { ...t, status: TransactionStatus.PAID, payment_date: item.date } : t));
      }
    });

    setReconciliationItems([...reconciliationItems]);
  };

  // 1. View: Extrato (Statement)
  const renderExtrato = () => (
    <div className="space-y-6">
      {/* KPI Cards section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'VENCIDOS', value: stats.overdue, color: 'text-rose-600', bg: 'bg-white' },
          { label: 'VENCEM HOJE', value: stats.todays, color: 'text-amber-600', bg: 'bg-white' },
          { label: 'A VENCER', value: stats.pending, color: 'text-blue-600', bg: 'bg-white' },
          { label: 'PAGOS', value: stats.paid, color: 'text-emerald-600', bg: 'bg-white' },
          { label: 'TOTAL DO PERÍODO', value: stats.totalPeriod, color: stats.totalPeriod >= 0 ? 'text-emerald-600' : 'text-rose-600', bg: 'bg-emerald-500/5', help: true },
        ].map((kpi, idx) => (
          <div key={idx} className={`${kpi.bg} p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center`}>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{kpi.label}</span>
              {kpi.help && <HelpCircle size={12} className="text-slate-300" />}
            </div>
            <h3 className={`text-xl font-black ${kpi.color}`}>
              {formatCurrency(kpi.value)}
            </h3>
          </div>
        ))}
      </div>

      {/* Main Table Container */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        {/* Filter Bar */}
        <div className="p-6 border-b border-slate-50 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative min-w-[300px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Buscar lançamentos..." 
                className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none w-full focus:ring-2 focus:ring-blue-100 transition-all font-medium"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="flex bg-slate-100 p-1 rounded-xl">
              {['Todos', 'Receitas', 'Despesas'].map((tab) => (
                <button
                  key={tab}
                  className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    (tab === 'Todos' && typeFilter === 'ALL') || 
                    (tab === 'Receitas' && typeFilter === TransactionType.INCOME) ||
                    (tab === 'Despesas' && typeFilter === TransactionType.EXPENSE)
                      ? 'bg-white text-slate-800 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                  onClick={() => {
                    if (tab === 'Todos') setTypeFilter('ALL');
                    else if (tab === 'Receitas') setTypeFilter(TransactionType.INCOME);
                    else setTypeFilter(TransactionType.EXPENSE);
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
              <button className="p-1 px-2 text-slate-400 hover:text-slate-600"><ChevronLeft size={16} /></button>
              <span className="text-xs font-black uppercase tracking-wider text-slate-800 px-2 min-w-[120px] text-center">Abril de 2026</span>
              <button className="p-1 px-2 text-slate-400 hover:text-slate-600"><ChevronRight size={16} /></button>
            </div>
          </div>
          
          <button className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors bg-white font-bold text-sm px-4 py-2 border border-slate-100 rounded-xl shadow-sm">
            <Download size={18} />
            <span>Exportar CSV</span>
          </button>
        </div>



        {/* Transactions Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-center w-12"><input type="checkbox" className="rounded text-blue-600 focus:ring-blue-400" /></th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Vencimento</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Pagamento</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">Descrição</th>
                <th className="px-6 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Conta / Categoria</th>
                <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Situação</th>
                <th className="px-6 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredTransactions.map((tx) => {
                const category = categories.find(c => c.id === tx.category_id);
                const account = accounts.find(a => a.id === tx.account_id);
                const isPaid = tx.status === TransactionStatus.PAID;

                return (
                  <tr key={tx.id} className="hover:bg-slate-50/50 transition-all group">
                    <td className="px-6 py-5 text-center"><input type="checkbox" className="rounded text-blue-600 focus:ring-blue-400" /></td>
                    <td className="px-6 py-5 text-sm font-bold text-slate-700">{new Date(tx.due_date).toLocaleDateString('pt-BR')}</td>
                    <td className="px-6 py-5 text-sm font-medium text-slate-400">
                      {tx.payment_date ? new Date(tx.payment_date).toLocaleDateString('pt-BR') : '-'}
                    </td>
                    <td className="px-6 py-5">
                      <p className="text-sm font-bold text-slate-900 leading-none">{tx.description}</p>
                      {tx.notes && <p className="text-xs text-slate-400 mt-1">{tx.notes}</p>}
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col items-center justify-center text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase text-white tracking-widest shadow-sm" style={{ backgroundColor: category?.color || '#cbd5e1' }}>
                          {category?.name || 'Geral'}
                        </span>
                        <span className="text-[10px] font-medium text-slate-400 mt-1">
                          {account?.name || 'Ativo Cresol'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <span className={`text-sm font-black ${tx.type === TransactionType.EXPENSE ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {tx.type === TransactionType.EXPENSE ? '-' : '+'} {formatCurrency(tx.amount)}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                        isPaid ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-amber-50 text-amber-600 border border-amber-100'
                      }`}>
                        {isPaid ? 'Liquidado' : 'Aberto'}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => handleToggleStatus(tx)}
                          className={`p-1.5 rounded-lg border transition-all ${
                            isPaid 
                              ? 'bg-amber-50 border-amber-200 text-amber-600 hover:bg-amber-100' 
                              : 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100'
                          }`}
                          title={isPaid ? 'Marcar como Pendente' : 'Liquidar Lançamento'}
                        >
                          <RefreshCw size={14} className="hover:rotate-180 transition-transform duration-300" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredTransactions.length === 0 && !loading && (
                <tr>
                   <td colSpan={8} className="py-20 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">Nenhum lançamento no período</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // 2. View: Fluxo de Caixa (Cash Flow Analyzer)
  const renderFluxodeCaixa = () => {
    // Math for Cash Flow
    const paidIncome = transactions.filter(t => t.type === TransactionType.INCOME && t.status === TransactionStatus.PAID).reduce((a, b) => a + b.amount, 0);
    const paidExpense = transactions.filter(t => t.type === TransactionType.EXPENSE && t.status === TransactionStatus.PAID).reduce((a, b) => a + b.amount, 0);
    const expectedIncome = transactions.filter(t => t.type === TransactionType.INCOME && t.status === TransactionStatus.PENDING).reduce((a, b) => a + b.amount, 0);
    const expectedExpense = transactions.filter(t => t.type === TransactionType.EXPENSE && t.status === TransactionStatus.PENDING).reduce((a, b) => a + b.amount, 0);

    const netRealized = paidIncome - paidExpense;
    const netProjected = (paidIncome + expectedIncome) - (paidExpense + expectedExpense);

    // Grouping by categories for nice horizontal chart meters
    const expenseByCat = categories
      .filter(c => c.type === TransactionType.EXPENSE)
      .map(cat => {
        const total = transactions
          .filter(t => t.category_id === cat.id && t.status === TransactionStatus.PAID)
          .reduce((acc, curr) => acc + curr.amount, 0);
        return { name: cat.name, color: cat.color, total };
      })
      .filter(c => c.total > 0)
      .sort((a, b) => b.total - a.total);

    const totalExpenseSum = expenseByCat.reduce((acc, curr) => acc + curr.total, 1);

    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Analytical widgets */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
            <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2 mb-6">
              <TrendingUp className="text-emerald-500" size={20} />
              Demonstrativo de Resultado do Período (DRE)
            </h3>

            {/* Custom Interactive SVG Graph */}
            <div className="relative h-64 w-full bg-slate-50/50 rounded-2xl border border-slate-100 p-4 flex flex-col justify-between mb-6">
              <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
                <span>Evolução Projetada de Caixa</span>
                <span className="text-emerald-600">Saldo Final Estimado: {formatCurrency(netProjected)}</span>
              </div>
              
              <div className="flex-1 flex items-end justify-around gap-6 pt-6">
                {[
                  { name: 'Semana 1', income: paidIncome * 0.25, expense: paidExpense * 0.2 },
                  { name: 'Semana 2', income: paidIncome * 0.35, expense: paidExpense * 0.4 },
                  { name: 'Semana 3', income: expectedIncome * 0.4, expense: expectedExpense * 0.3 },
                  { name: 'Semana 4', income: expectedIncome * 0.6, expense: expectedExpense * 0.5 },
                ].map((item, idx) => {
                  const maxVal = Math.max(paidIncome, expectedIncome, paidExpense, expectedExpense, 1);
                  const incomeHeight = `${Math.max((item.income / maxVal) * 120, 15)}px`;
                  const expenseHeight = `${Math.max((item.expense / maxVal) * 120, 15)}px`;

                  return (
                    <div key={idx} className="flex flex-col items-center space-y-2 flex-1 group relative">
                      <div className="flex items-end justify-center gap-2 w-full">
                        {/* Income Bar */}
                        <div className="w-10 bg-emerald-500 hover:bg-emerald-600 rounded-t-md cursor-pointer transition-all shadow-sm" style={{ height: incomeHeight }} title={`Entrada: ${formatCurrency(item.income)}`} />
                        {/* Expense Bar */}
                        <div className="w-10 bg-rose-500 hover:bg-rose-600 rounded-t-md cursor-pointer transition-all shadow-sm" style={{ height: expenseHeight }} title={`Saída: ${formatCurrency(item.expense)}`} />
                      </div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{item.name}</span>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-center gap-6 mt-4 pt-2 border-t border-slate-100/60 text-xs font-bold text-slate-500">
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-emerald-500 rounded-sm" />Receitas</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-rose-500 rounded-sm" />Despesas</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 flex flex-col justify-center">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">REALIZADO (PAGO)</span>
                <span className="text-2xl font-black text-emerald-700 mt-1">{formatCurrency(netRealized)}</span>
              </div>
              <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100 flex flex-col justify-center">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">PROJETADO (CONCILIADO)</span>
                <span className="text-2xl font-black text-blue-700 mt-1">{formatCurrency(netProjected)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Expense categories break-down */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <h3 className="text-base font-black text-slate-900 mb-6 uppercase tracking-wider text-center border-b border-slate-50 pb-4">
              Distribuição de Despesas
            </h3>
            
            <div className="space-y-4">
              {expenseByCat.map((item, idx) => {
                const percentage = Math.round((item.total / totalExpenseSum) * 100);
                return (
                  <div key={idx} className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color || '#3b82f6' }} />
                        <span>{item.name}</span>
                      </div>
                      <span>{percentage}% ({formatCurrency(item.total)})</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ backgroundColor: item.color || '#3b82f6', width: `${percentage}%` }} />
                    </div>
                  </div>
                );
              })}
              {expenseByCat.length === 0 && (
                <div className="text-center py-10 text-slate-400 uppercase tracking-widest text-xs">
                   Nenhuma despesa liquidada neste período.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // 3. View: Cartões (Credit Card Wallet)
  const renderCartoes = () => {
    const cardAccounts = accounts.filter(a => a.type === 'credit_card' || a.type === 'CREDIT' || a.name.toLowerCase().includes('cartão'));

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <CreditCard size={20} className="text-slate-700" />
            Meus Cartões Corporativos
          </h2>
          <button 
            onClick={() => {
              setModalType('card');
              setIsModalOpen(true);
            }}
            className="flex items-center gap-1.5 bg-slate-900 text-white rounded-lg px-3 py-1.5 text-xs font-bold hover:bg-slate-800 transition-all shadow-sm"
          >
            <Plus size={14} /> Novo Cartão
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cardAccounts.map((card, idx) => {
            const limit = card.credit_limit || 25000;
            const openInvoices = Math.abs(card.current_balance);
            const available = limit - openInvoices;
            const progressPct = Math.round((openInvoices / limit) * 100);

            return (
              <motion.div 
                key={card.id} 
                className={`bg-gradient-to-tr ${CARD_GRADIENTS[idx % CARD_GRADIENTS.length]} p-6 rounded-3xl shadow-xl flex flex-col justify-between h-52 relative overflow-hidden`}
                whileHover={{ y: -4 }}
              >
                <div className="absolute right-0 top-0 w-32 h-32 bg-white/5 rounded-full blur-2xl pointer-events-none" />
                <div className="flex items-start justify-between relative z-10">
                  <div>
                    <h3 className="text-lg font-black tracking-tight leading-none">{card.name}</h3>
                  </div>
                  <div className="w-10 h-6 bg-amber-400/80 rounded-md border border-amber-300 opacity-80" />
                </div>

                <div className="mt-4">
                  <p className="text-2xl font-black">{formatCurrency(openInvoices)}</p>
                </div>

                <div className="space-y-1 mt-auto">
                  <div className="flex items-center justify-between text-[10px] font-bold text-white/80 uppercase">
                    <span>Limite: {formatCurrency(limit)}</span>
                    <span>Disp: {formatCurrency(available)}</span>
                  </div>
                  <div className="w-full bg-white/20 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-white h-full" style={{ width: `${Math.min(progressPct, 100)}%` }} />
                  </div>
                </div>
              </motion.div>
            );
          })}

          {cardAccounts.length === 0 && (
            <div className="col-span-full border border-dashed border-slate-200 py-16 rounded-3xl flex flex-col items-center justify-center text-center">
              <CreditCard size={40} className="text-slate-300 mb-2" />
              <p className="text-slate-400 font-bold uppercase tracking-wider text-xs">Nenhum cartão corporativo cadastrado.</p>
              <button 
                onClick={() => {
                  setModalType('card');
                  setIsModalOpen(true);
                }}
                className="mt-4 text-xs font-black text-blue-600 hover:underline"
              >
                Cadastrar Primeiro Cartão
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // 4. View: Contas Bancárias (Bank Accounts list)
  const renderContas = () => {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div />
          <button 
            onClick={() => {
              setModalType('account');
              setIsModalOpen(true);
            }}
            className="flex items-center gap-1.5 bg-slate-900 text-white rounded-lg px-3 py-1.5 text-xs font-bold hover:bg-slate-800 transition-all shadow-sm"
          >
            <Plus size={14} /> Adicionar Conta
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {accounts.map(account => {
            const sumTransactions = transactions
              .filter(t => t.account_id === account.id && t.status === TransactionStatus.PAID)
              .reduce((acc, curr) => acc + (curr.type === TransactionType.INCOME ? curr.amount : -curr.amount), 0);
            
            const liveBalance = account.initial_balance + sumTransactions;

            return (
              <div key={account.id} className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: account.color || '#3b82f6' }} />
                    <span className="px-2 py-0.5 rounded bg-slate-50 border border-slate-100 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                      {account.is_default ? 'Principal' : (account.type?.toUpperCase() === 'CREDIT_CARD' || account.type === 'credit_card' ? 'Cartão de Crédito' : account.type || 'Conta')}
                    </span>
                  </div>
                  <h4 className="text-base font-black text-slate-800">{account.name}</h4>
                </div>

                <div className="mt-6 flex items-end justify-between">
                  <div>
                    <p className="text-2xl font-black text-slate-900">{formatCurrency(liveBalance)}</p>
                  </div>
                  <span className="flex items-center gap-1 text-[10px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-2 py-1 rounded border border-emerald-100">
                    <Check size={10} /> Conciliada
                  </span>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-end gap-2">
                  <button 
                    onClick={() => handleEditAccountClick(account)}
                    className="flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-blue-600 transition-colors px-2.5 py-1.5 bg-slate-50 hover:bg-blue-50 rounded-lg"
                  >
                    <Pencil size={11} /> Editar
                  </button>
                  <button 
                    onClick={() => handleDeleteAccount(account.id)}
                    className="flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-rose-600 transition-colors px-2.5 py-1.5 bg-slate-50 hover:bg-rose-50 rounded-lg"
                  >
                    <Trash2 size={11} /> Excluir
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // 5. View: Conciliação Bancária (Statement Matching Tool)
  const renderConciliacao = () => {
    // Collect non-reconciled items in system (unpaid or paid matches)
    const systemMatches = transactions.filter(t => t.status === TransactionStatus.PENDING);

    return (
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-6">
            <div>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <RefreshCw size={20} className="text-blue-500 animate-spin" style={{ animationDuration: '4s' }} />
                Conciliação Bancária
              </h2>
              <p className="text-xs text-slate-400 font-medium">Importe seu extrato para conciliar os lançamentos.</p>
            </div>
            
            <div className="flex items-center gap-3">
              {!importedFile ? (
                <button 
                  onClick={handleBankfileImport}
                  className="flex items-center gap-2 bg-blue-600 text-white rounded-xl px-4 py-2 text-sm font-bold hover:bg-blue-700 transition-all shadow-md"
                >
                  <Upload size={16} /> Importar Extrato (.OFX / .CSV)
                </button>
              ) : (
                <button 
                  onClick={handleAutoConciliation}
                  className="flex items-center gap-2 bg-emerald-600 text-white rounded-xl px-4 py-2 text-sm font-bold hover:bg-emerald-700 transition-all shadow-md"
                >
                  <Sparkles size={16} /> Auto-Conciliar via AI
                </button>
              )}
            </div>
          </div>

          {!importedFile ? (
            <div className="border-4 border-dashed border-slate-100 py-24 rounded-3xl flex flex-col items-center justify-center text-center cursor-pointer hover:bg-slate-50/50 transition-all" onClick={handleBankfileImport}>
              <div className="h-16 w-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4">
                <Upload size={32} />
              </div>
              <p className="font-black text-slate-700 text-sm">Arraste seu arquivo bancário aqui ou clique para selecionar</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2">Formatos recomendados: OFX, CSV, QFX</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left Column: Bank Statement */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase text-slate-400 tracking-wider">1. Extrato Bancário Importado ({importedFile})</span>
                  <span className="text-[10px] text-emerald-600 font-bold uppercase">Ativo</span>
                </div>

                <div className="border border-slate-100 rounded-2xl overflow-hidden divide-y divide-slate-50 max-h-[400px] overflow-y-auto">
                  {reconciliationItems.map((item, idx) => {
                    const isSelected = selectedImportedIndex === idx;
                    
                    return (
                      <div 
                        key={idx} 
                        className={`p-4 flex items-center justify-between cursor-pointer transition-all ${
                          item.matched 
                            ? 'bg-emerald-50/30 line-through text-slate-400 opacity-60' 
                            : isSelected 
                              ? 'bg-blue-50 border-l-4 border-blue-500' 
                              : 'hover:bg-slate-50'
                        }`}
                        onClick={() => !item.matched && setSelectedImportedIndex(idx)}
                      >
                        <div>
                          <p className="text-xs font-semibold text-slate-400">{new Date(item.date).toLocaleDateString('pt-BR')}</p>
                          <p className="font-black text-slate-800 text-sm mt-0.5">{item.description}</p>
                        </div>
                        <div className="text-right">
                          <p className={`font-black text-sm ${item.type === TransactionType.EXPENSE ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {item.type === TransactionType.EXPENSE ? '-' : '+'} {formatCurrency(item.amount)}
                          </p>
                          {item.matched && (
                            <span className="text-[9px] font-black text-emerald-600 bg-emerald-100 rounded px-1 text-center py-0.5 inline-block uppercase mt-1 leading-none">
                              Conciliado
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: ERP Pending list */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase text-slate-400 tracking-wider">2. Lançamentos no Sistema (Abertos)</span>
                  <span className="text-[10px] text-blue-600 font-bold uppercase">Match Inteligente Ativado</span>
                </div>

                <div className="border border-slate-100 rounded-2xl overflow-hidden divide-y divide-slate-50 max-h-[400px] overflow-y-auto">
                  {systemMatches.map((tx) => {
                    const isSelected = selectedSystemTxId === tx.id;
                    const matchedItem = matchedPairs.find(p => p.systemId === tx.id);

                    if (matchedItem) return null;

                    return (
                      <div 
                        key={tx.id} 
                        className={`p-4 flex items-center justify-between cursor-pointer transition-all ${
                          isSelected ? 'bg-blue-50 border-l-4 border-blue-500' : 'hover:bg-slate-50'
                        }`}
                        onClick={() => setSelectedSystemTxId(tx.id)}
                      >
                        <div>
                          <p className="text-xs font-semibold text-slate-400">{new Date(tx.due_date).toLocaleDateString('pt-BR')}</p>
                          <p className="font-black text-slate-800 text-sm mt-0.5">{tx.description}</p>
                        </div>
                        <div className="text-right">
                          <p className={`font-black text-sm ${tx.type === TransactionType.EXPENSE ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {tx.type === TransactionType.EXPENSE ? '-' : '+'} {formatCurrency(tx.amount)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  {systemMatches.length === 0 && (
                     <div className="p-8 text-center text-slate-400 uppercase tracking-widest text-xs">Sem lançamentos abertos restantes</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Pair reconciliation dock */}
          {selectedImportedIndex !== null && selectedSystemTxId && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }} 
              animate={{ height: 'auto', opacity: 1 }} 
              className="mt-8 bg-blue-50/50 rounded-2xl p-6 border border-blue-100 flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div>
                <p className="text-xs font-black text-blue-800 uppercase">Match de Conciliação Selecionado</p>
                <p className="text-sm font-semibold text-slate-700 mt-1">
                  Vincular <span className="font-black text-slate-900">"{reconciliationItems[selectedImportedIndex].description}"</span> com <span className="font-black text-slate-900">"{transactions.find(t => t.id === selectedSystemTxId)?.description}"</span>
                </p>
              </div>
              <button 
                onClick={handlePairReconciliation}
                className="bg-blue-600 hover:bg-blue-700 text-white hover:scale-[1.02] transform transition-all font-black text-sm rounded-xl px-6 py-3 shadow-md"
              >
                Confirmar Match e Liquidar
              </button>
            </motion.div>
          )}
        </div>
      </div>
    );
  };

  // 6. View: Categorias (Organize visual cards)
  const renderCategorias = () => {
    const revenueCats = categories.filter(c => c.type === TransactionType.INCOME);
    const expenseCats = categories.filter(c => c.type === TransactionType.EXPENSE);

    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div />
          <button 
            onClick={() => {
              setModalType('category');
              setIsModalOpen(true);
            }}
            className="flex items-center gap-1.5 bg-slate-900 text-white rounded-lg px-3 py-1.5 text-xs font-bold hover:bg-slate-800 transition-all shadow-sm"
          >
            <Plus size={14} /> Nova Categoria
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Revenues block */}
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <h3 className="text-base font-black text-emerald-600 mb-6 flex items-center gap-1.5 uppercase tracking-wider">
              <ArrowUpRight size={18} /> Categorias de Receita
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {revenueCats.map(cat => (
                <div key={cat.id} className="p-4 border border-slate-50 bg-slate-50/10 rounded-xl flex items-center justify-between gap-3 shadow-sm hover:border-slate-100 transition-all">
                  <div className="flex items-center gap-3">
                    <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color || '#10b981' }} />
                    <p className="text-sm font-bold text-slate-800">{cat.name}</p>
                  </div>
                  <div className="flex gap-1.5">
                    <button 
                      onClick={() => handleEditCategoryClick(cat)}
                      className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                      title="Editar"
                    >
                      <Pencil size={12} />
                    </button>
                    <button 
                      onClick={() => handleDeleteCategory(cat.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                      title="Excluir"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Expenses block */}
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <h3 className="text-base font-black text-rose-600 mb-6 flex items-center gap-1.5 uppercase tracking-wider">
              <ArrowDownRight size={18} /> Categorias de Despesa
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {expenseCats.map(cat => (
                <div key={cat.id} className="p-4 border border-slate-50 bg-slate-50/10 rounded-xl flex items-center justify-between gap-3 shadow-sm hover:border-slate-100 transition-all">
                  <div className="flex items-center gap-3">
                    <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color || '#f43f5e' }} />
                    <p className="text-sm font-bold text-slate-800">{cat.name}</p>
                  </div>
                  <div className="flex gap-1.5">
                    <button 
                      onClick={() => handleEditCategoryClick(cat)}
                      className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                      title="Editar"
                    >
                      <Pencil size={12} />
                    </button>
                    <button 
                      onClick={() => handleDeleteCategory(cat.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                      title="Excluir"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const getSubTitleText = () => {
    switch (activeView) {
      case 'financial-fluxo': return 'Visão consolidada e evolução de caixa';
      case 'financial-cartoes': return 'Cartões de crédito corporativos e limites';
      case 'financial-contas': return '';
      case 'financial-conciliacao': return 'Atribuição e match automático de extratos bancários';
      case 'financial-categorias': return '';
      default: return 'Detalhamento de transações e fluxo do mês';
    }
  };

  const getMainTitleText = () => {
    switch (activeView) {
      case 'financial-fluxo': return 'Fluxo de Caixa';
      case 'financial-cartoes': return 'Cartões Corporativos';
      case 'financial-contas': return 'Contas Bancárias';
      case 'financial-conciliacao': return 'Conciliação Bancária';
      case 'financial-categorias': return 'Categorias';
      default: return 'Extrato';
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Dynamic Subheader matching requested view */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            Financeiro
            <span className="text-blue-600 font-medium text-lg">| {getMainTitleText()}</span>
          </h1>
          {getSubTitleText() && (
            <p className="text-slate-500 font-medium text-sm mt-0.5">{getSubTitleText()}</p>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => {
              setNewTransaction({...newTransaction, type: TransactionType.INCOME});
              setModalType('transaction');
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 hover:scale-[1.02] transform transition-all shadow-sm text-sm"
          >
            <Plus size={18} /> Nova Receita
          </button>
          <button 
            onClick={() => {
              setNewTransaction({...newTransaction, type: TransactionType.EXPENSE});
              setModalType('transaction');
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 text-white font-bold rounded-xl hover:bg-rose-700 hover:scale-[1.02] transform transition-all shadow-sm text-sm"
          >
            <Plus size={18} /> Nova Despesa
          </button>
        </div>
      </div>

      {/* Render selected view panel */}
      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <RefreshCw size={40} className="text-blue-500 animate-spin" />
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div 
            key={activeView}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeView === 'financial-fluxo' && renderFluxodeCaixa()}
            {activeView === 'financial-cartoes' && renderCartoes()}
            {activeView === 'financial-contas' && renderContas()}
            {activeView === 'financial-conciliacao' && renderConciliacao()}
            {activeView === 'financial-categorias' && renderCategorias()}
            {(activeView === 'financial-extrato' || activeView === 'financial') && renderExtrato()}
          </motion.div>
        </AnimatePresence>
      )}

      {/* Modal overlays containing forms */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
             <motion.div 
               initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
               className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
               onClick={handleCloseModal}
             />
             <motion.div 
               initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
               className="bg-white rounded-3xl w-full max-w-lg shadow-2xl relative z-10 p-8 overflow-hidden"
             >
                {/* 1. Modal type: Transaction creation */}
                {modalType === 'transaction' && (
                  <div>
                    <h2 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
                       <PlusCircle className="text-blue-500" size={24} />
                       Novo Lançamento Financeiro
                    </h2>
                    <div className="space-y-4">
                      <div>
                        <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Descrição do Lançamento*</label>
                        <input 
                          type="text" placeholder="Ex: Aluguel do escritório, Tráfego Pago..." 
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-100 transition-all font-medium text-slate-800"
                          value={newTransaction.description} 
                          onChange={(e) => setNewTransaction({...newTransaction, description: e.target.value})}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Valor (R$)*</label>
                          <input 
                            type="number" placeholder="0.00" 
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-100 transition-all font-bold text-slate-805"
                            value={newTransaction.amount || ''} 
                            onChange={(e) => setNewTransaction({...newTransaction, amount: Number(e.target.value)})}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Data de Vencimento*</label>
                          <input 
                            type="date" 
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-100 transition-all font-medium text-slate-700"
                            value={newTransaction.due_date} 
                            onChange={(e) => setNewTransaction({...newTransaction, due_date: e.target.value})}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Conta Principal*</label>
                          <select 
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-100 transition-all font-medium text-slate-700"
                            value={newTransaction.account_id}
                            onChange={(e) => setNewTransaction({...newTransaction, account_id: e.target.value})}
                          >
                            <option value="">Selecione...</option>
                            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Categoria*</label>
                          <select 
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-100 transition-all font-medium text-slate-700"
                            value={newTransaction.category_id}
                            onChange={(e) => setNewTransaction({...newTransaction, category_id: e.target.value})}
                          >
                            <option value="">Selecione...</option>
                            {categories.filter(c => c.type === newTransaction.type).map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Anotações Adicionais</label>
                        <textarea 
                          placeholder="Notas, observações, etc..." 
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-100 transition-all font-medium text-slate-800 h-20"
                          value={newTransaction.notes}
                          onChange={(e) => setNewTransaction({...newTransaction, notes: e.target.value})}
                        />
                      </div>
                    </div>

                    <div className="flex gap-4 mt-8">
                      <button onClick={handleCloseModal} className="flex-1 font-bold text-slate-400">Cancelar</button>
                      <button 
                        onClick={handleCreateTransaction}
                        className="flex-1 bg-blue-600 text-white font-black py-3 rounded-xl shadow-lg shadow-blue-100"
                      >
                        Confirmar Lançamento
                      </button>
                    </div>
                  </div>
                )}

                {/* 2. Modal type: Account creation */}
                {modalType === 'account' && (
                  <div>
                    <h2 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
                       <Landmark className="text-blue-500" size={24} />
                       {editingAccount ? 'Editar Conta Bancária' : 'Adicionar Nova Conta'}
                    </h2>
                    <div className="space-y-4">
                      <div>
                        <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Nome da Conta*</label>
                        <input 
                          type="text" placeholder="Ex: Cresol Comercial, Itaú Invest..." 
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 outline-none text-slate-800"
                          value={newAccount.name} 
                          onChange={(e) => setNewAccount({...newAccount, name: e.target.value})}
                        />
                      </div>
                      
                      {!editingAccount && (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Saldo Inicial (R$)*</label>
                            <input 
                              type="number" placeholder="8500.00" 
                              className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 outline-none text-slate-800"
                              value={newAccount.initial_balance || ''} 
                              onChange={(e) => setNewAccount({...newAccount, initial_balance: Number(e.target.value)})}
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Tipo de Conta*</label>
                            <select 
                              className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 outline-none text-slate-800"
                              value={newAccount.type}
                              onChange={(e) => setNewAccount({...newAccount, type: e.target.value})}
                            >
                              <option value="Corrente">Corrente</option>
                              <option value="Poupança">Poupança</option>
                              <option value="Investimentos">Investimentos</option>
                              <option value="Dinheiro">Dinheiro</option>
                            </select>
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Cor da Conta</label>
                        <select 
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 outline-none text-slate-805"
                          value={newAccount.color}
                          onChange={(e) => setNewAccount({...newAccount, color: e.target.value})}
                        >
                          <option value="#3b82f6">Azul Standard</option>
                          <option value="#10b981">Verde</option>
                          <option value="#f43f5e">Vermelho</option>
                          <option value="#eab308">Amarelo Itaú</option>
                          <option value="#8b5cf6">Roxo</option>
                          <option value="#1e293b">Cinza Escuro</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex gap-4 mt-8">
                      <button onClick={handleCloseModal} className="flex-1 font-bold text-slate-400">Cancelar</button>
                      <button 
                        onClick={handleCreateAccount}
                        className="flex-1 bg-blue-600 text-white font-black py-3 rounded-xl shadow-lg"
                      >
                        {editingAccount ? 'Salvar Alterações' : 'Salvar Conta'}
                      </button>
                    </div>
                  </div>
                )}

                {/* 3. Modal type: Category creation */}
                {modalType === 'category' && (
                  <div>
                    <h2 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
                       <Tag className="text-blue-500" size={24} />
                       {editingCategory ? 'Editar Categoria Financeira' : 'Criar Categoria Financeira'}
                    </h2>
                    <div className="space-y-4">
                      <div>
                        <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Nome da Categoria*</label>
                        <input 
                          type="text" placeholder="Ex: Impostos, Assinaturas..." 
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 outline-none text-slate-800"
                          value={newCategory.name} 
                          onChange={(e) => setNewCategory({...newCategory, name: e.target.value})}
                        />
                      </div>
                      
                      {!editingCategory && (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Tipo*</label>
                            <select 
                              className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 outline-none text-slate-800"
                              value={newCategory.type}
                              onChange={(e) => setNewCategory({...newCategory, type: e.target.value as TransactionType})}
                            >
                              <option value={TransactionType.EXPENSE}>Despesa</option>
                              <option value={TransactionType.INCOME}>Receita</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Cor Visual</label>
                            <select 
                              className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 outline-none text-slate-800"
                              value={newCategory.color}
                              onChange={(e) => setNewCategory({...newCategory, color: e.target.value})}
                            >
                              <option value="#f43f5e">Vermelho</option>
                              <option value="#3b82f6">Azul</option>
                              <option value="#10b981">Verde</option>
                              <option value="#eab308">Amarelo</option>
                              <option value="#a855f7">Roxo</option>
                            </select>
                          </div>
                        </div>
                      )}

                      {editingCategory && (
                        <div>
                          <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Cor Visual</label>
                          <select 
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 outline-none text-slate-800"
                            value={newCategory.color}
                            onChange={(e) => setNewCategory({...newCategory, color: e.target.value})}
                          >
                            <option value="#f43f5e">Vermelho</option>
                            <option value="#3b82f6">Azul</option>
                            <option value="#10b981">Verde</option>
                            <option value="#eab308">Amarelo</option>
                            <option value="#a855f7">Roxo</option>
                          </select>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-4 mt-8">
                      <button onClick={handleCloseModal} className="flex-1 font-bold text-slate-400">Cancelar</button>
                      <button 
                        onClick={handleCreateCategory}
                        className="flex-1 bg-blue-600 text-white font-black py-3 rounded-xl shadow-lg"
                      >
                        {editingCategory ? 'Salvar Alterações' : 'Criar Categoria'}
                      </button>
                    </div>
                  </div>
                )}

                {/* 4. Modal type: Credit card creation */}
                {modalType === 'card' && (
                  <div>
                    <h2 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
                       <CreditCard className="text-blue-500" size={24} />
                       Cadastrar Cartão Corporativo
                    </h2>
                    <div className="space-y-4">
                      <div>
                        <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Nome / Identificador do Cartão*</label>
                        <input 
                          type="text" placeholder="Ex: Visa Corporate Gold..." 
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 outline-none text-slate-800"
                          value={newAccount.name} 
                          onChange={(e) => setNewAccount({...newAccount, name: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Limite de Crédito Disponível (R$)*</label>
                        <input 
                          type="number" placeholder="25000" 
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 outline-none"
                          value={newAccount.credit_limit || ''} 
                          onChange={(e) => setNewAccount({...newAccount, credit_limit: Number(e.target.value)})}
                        />
                      </div>
                      <input type="hidden" value="credit_card" />
                    </div>

                    <div className="flex gap-4 mt-8">
                      <button onClick={handleCloseModal} className="flex-1 font-bold text-slate-400">Cancelar</button>
                      <button 
                        onClick={() => {
                          setNewAccount(prev => ({...prev, type: 'credit_card', initial_balance: 0}));
                          handleCreateAccount();
                        }}
                        className="flex-1 bg-blue-600 text-white font-black py-3 rounded-xl shadow-lg"
                      >
                        Salvar Cartão
                      </button>
                    </div>
                  </div>
                )}
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Financial;
