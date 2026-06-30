import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Pencil,
  Sparkles,
  Zap,
  X,
  Receipt,
  Activity,
  FileDown
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, 
  FinancialAccount, 
  FinancialCategory, 
  FinancialTransaction, 
  TransactionType, 
  TransactionStatus 
} from '../types';
import { supabaseService, FinancialAccountInsert } from '../services/supabaseService';
import { supabase } from '../supabase';

interface FinancialProps {
  currentUser: User;
  activeView?: string;
}

// Robust Brazilian Real format to float number converter
const parseBrlValue = (valueStr: string): number => {
  if (!valueStr) return 0;
  let clean = valueStr.replace(/[R$\s]/gi, '');
  if (!clean) return 0;
  
  // If there is a comma, it is the decimal separator (BRL standard)
  if (clean.includes(',')) {
    clean = clean.replace(/\./g, '').replace(',', '.');
  } else {
    // No comma. If there is a dot:
    // A single dot followed by exactly 3 digits is assumed to be a thousands separator (e.g., "1.500" -> 1500, but "1500.50" -> 1500.50)
    // Multiple dots (e.g. "1.500.000") are also treated as thousands separators and removed.
    const dotCount = (clean.match(/\./g) || []).length;
    if (dotCount > 1) {
      clean = clean.replace(/\./g, '');
    } else if (dotCount === 1) {
      const parts = clean.split('.');
      if (parts[1].length === 3) {
        clean = clean.replace(/\./g, '');
      }
    }
  }
  
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : parsed;
};

// Precise date incrementer for recurrences avoiding date-boundary errors and month hopping
const addPeriodToDate = (dateStr: string, type: 'WEEKLY' | 'MONTHLY' | 'YEARLY', index: number): string => {
  if (!dateStr) return dateStr;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // 0-indexed month
  const day = parseInt(parts[2], 10);
  
  if (isNaN(year) || isNaN(month) || isNaN(day)) return dateStr;

  if (type === 'WEEKLY') {
    const d = new Date(year, month, day, 12, 0, 0);
    d.setDate(d.getDate() + 7 * index);
    return d.toISOString().split('T')[0];
  } else if (type === 'MONTHLY') {
    const targetMonth = month + index;
    // Get max days in target month
    const testDate = new Date(year, targetMonth, 1, 12, 0, 0);
    const maxDays = new Date(testDate.getFullYear(), testDate.getMonth() + 1, 0).getDate();
    const targetDay = Math.min(day, maxDays);
    const resultDate = new Date(testDate.getFullYear(), testDate.getMonth(), targetDay, 12, 0, 0);
    return resultDate.toISOString().split('T')[0];
  } else if (type === 'YEARLY') {
    const targetYear = year + index;
    // Handle leap years (e.g. Feb 29 -> Feb 28)
    const maxDays = new Date(targetYear, month + 1, 0).getDate();
    const targetDay = Math.min(day, maxDays);
    const resultDate = new Date(targetYear, month, targetDay, 12, 0, 0);
    return resultDate.toISOString().split('T')[0];
  }
  return dateStr;
};

// Visual color choices for gradients
const CARD_GRADIENTS = [
  'from-slate-900 to-slate-800 text-white',
  'from-blue-900 via-indigo-950 to-slate-900 text-white',
  'from-emerald-900 to-teal-950 text-white',
  'from-purple-900 to-indigo-950 text-white',
  'from-rose-900 to-rose-950 text-white'
];

// Retorna a data atual no fuso local no formato YYYY-MM-DD
const getLocalTodayStr = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const BANKS = [
  { code: "sicoob",     name: "Sicoob",           color: "#006B3F", initials: "SIC" },
  { code: "cresol",     name: "Cresol",           color: "#007BC0", initials: "CRS" },
  { code: "sicredi",    name: "Sicredi",          color: "#00A651", initials: "SCR" },
  { code: "bradesco",   name: "Bradesco",         color: "#CC0000", initials: "BRA" },
  { code: "itau",       name: "Itaú",             color: "#EC7000", initials: "ITÁ" },
  { code: "bb",         name: "Banco do Brasil",  color: "#F9D100", initials: "BB"  },
  { code: "caixa",      name: "Caixa Econômica",  color: "#005CA8", initials: "CEF" },
  { code: "santander",  name: "Santander",        color: "#EC0000", initials: "SAN" },
  { code: "nubank",     name: "Nubank",           color: "#8A05BE", initials: "NU"  },
  { code: "inter",      name: "Inter",            color: "#FF7A00", initials: "INT" },
  { code: "c6",         name: "C6 Bank",          color: "#1A1A1A", initials: "C6"  },
  { code: "outros",     name: "Outro",            color: "#64748b", initials: "OUT" },
];

export const Financial: React.FC<FinancialProps> = ({ currentUser, activeView = 'financial-extrato' }) => {
  // State managers
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [categories, setCategories] = useState<FinancialCategory[]>([]);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  
  const getAccountBank = (account: FinancialAccount) => {
    const bankCode = (account as any).bank_code;
    if (!bankCode) return null;
    return BANKS.find(b => b.code === bankCode) || null;
  };

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
    credit_limit: 0,
    bank_code: ''
  });

  const [newCategory, setNewCategory] = useState({
    name: '',
    type: TransactionType.EXPENSE,
    color: '#f43f5e',
    group_name: ''
  });

  // Local mapping for category group names: { [categoryId]: groupName }
  const [categoryGroups, setCategoryGroups] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('financial_category_groups');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Whenever categoryGroups changes, persist it to localStorage
  useEffect(() => {
    localStorage.setItem('financial_category_groups', JSON.stringify(categoryGroups));
  }, [categoryGroups]);

  // Toast notification state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // CSV Import States
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [csvPreview, setCsvPreview] = useState<Array<{ name: string; type: TransactionType; color: string; group_name: string }>>([]);

  // Reconciliation workspace states
  const [importedFile, setImportedFile] = useState<string | null>(null);
  const [reconciliationItems, setReconciliationItems] = useState<any[]>([]);
  const [selectedImportedIndex, setSelectedImportedIndex] = useState<number | null>(null);
  const [selectedSystemTxId, setSelectedSystemTxId] = useState<string | null>(null);
  const [matchedPairs, setMatchedPairs] = useState<Array<{ importedIdx: number, systemId: string }>>([]);
  const [autoMatchScore, setAutoMatchScore] = useState<number | null>(null);
  const [quickCategoryId, setQuickCategoryId] = useState<string>('');
  const [quickAccountId, setQuickAccountId] = useState<string>('');
  const [quickDescription, setQuickDescription] = useState<string>('');
  const [selectedMatches, setSelectedMatches] = useState<Array<{
    reconciliation_id: string;
    transaction_id: string;
    score: number;
    status: 'prepared' | 'confirmed';
  }>>([]);
  const [reconciliationSearch, setReconciliationSearch] = useState<string>('');
  const [showQuickCreateForm, setShowQuickCreateForm] = useState(false);

  const [ofxBankName, setOfxBankName] = useState<string | null>(null);
  const [ofxAgency, setOfxAgency] = useState<string | null>(null);
  const [ofxAccount, setOfxAccount] = useState<string | null>(null);
  const [ofxPeriod, setOfxPeriod] = useState<string | null>(null);
  const [reconciliationPeriodFilter, setReconciliationPeriodFilter] = useState<'all' | 'today' | '7days' | '30days' | 'current_month' | 'custom'>('all');
  const [reconciliationStartDate, setReconciliationStartDate] = useState('');
  const [reconciliationEndDate, setReconciliationEndDate] = useState('');

  const [editingAccount, setEditingAccount] = useState<FinancialAccount | null>(null);
  const [editingCategory, setEditingCategory] = useState<FinancialCategory | null>(null);

  // Extrato dynamic states
  const [currentPeriod, setCurrentPeriod] = useState<Date>(new Date());
  const [kpiFilter, setKpiFilter] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [selectedTxIds, setSelectedTxIds] = useState<string[]>([]);
  const [editingTransaction, setEditingTransaction] = useState<FinancialTransaction | null>(null);

  // New states for form formatting, recurrence, and payment
  const [amountInputStr, setAmountInputStr] = useState<string>('');
  const [recurrenceType, setRecurrenceType] = useState<'NONE' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'>('NONE');
  const [recurrencePeriods, setRecurrencePeriods] = useState<number>(1);
  const [markAsPaid, setMarkAsPaid] = useState<boolean>(false);
  const monthInputRef = useRef<HTMLInputElement>(null);

  // Real Cash Flow & DRE States
  const [fluxoTab, setFluxoTab] = useState<'fluxo' | 'dre'>('fluxo');
  const [fluxoGroupMode, setFluxoGroupMode] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY'>('WEEKLY');
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  
  // States for custom ConfirmModal
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [confirmModalTitle, setConfirmModalTitle] = useState('');
  const [confirmModalMessage, setConfirmModalMessage] = useState('');
  const [confirmModalConfirmText, setConfirmModalConfirmText] = useState('Confirmar');
  const [confirmModalConfirmColor, setConfirmModalConfirmColor] = useState('bg-rose-600 hover:bg-rose-700 text-white');
  const [onConfirmAction, setOnConfirmAction] = useState<(() => void) | null>(null);

  const getAccountLiveBalance = (account: FinancialAccount) => {
    const sumTransactions = transactions
      .filter(t => t.account_id === account.id && t.status === TransactionStatus.PAID)
      .reduce((acc, curr) => acc + (curr.type === TransactionType.INCOME ? curr.amount : -curr.amount), 0);
    return Number(account.initial_balance || 0) + sumTransactions;
  };
  
  // Accounts payable and receivable states
  const [pagamentosTab, setPagamentosTab] = useState<'todas' | 'pagar' | 'receber' | 'vencidas'>('todas');
  const [localActiveView, setLocalActiveView] = useState<string>(activeView);
  const [centroCustoTab, setCentroCustoTab] = useState<'todos' | 'despesas' | 'receitas'>('todos');

  useEffect(() => {
    setLocalActiveView(activeView);
  }, [activeView]);

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingAccount(null);
    setEditingCategory(null);
    setEditingTransaction(null);
    setAmountInputStr('');
    setRecurrenceType('NONE');
    setRecurrencePeriods(1);
    setMarkAsPaid(false);
    setNewAccount({
      name: '',
      initial_balance: 0,
      type: 'Corrente',
      color: '#2563eb',
      is_default: false,
      credit_limit: 0,
      bank_code: ''
    });
    setNewCategory({
      name: '',
      type: TransactionType.EXPENSE,
      color: '#f43f5e',
      group_name: ''
    });
  };

  useEffect(() => {
    if (isModalOpen && modalType === 'transaction') {
      if (editingTransaction) {
        setAmountInputStr(editingTransaction.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
        setMarkAsPaid(editingTransaction.status === TransactionStatus.PAID);
      } else {
        setAmountInputStr('');
        setMarkAsPaid(false);
      }
    }
  }, [isModalOpen, editingTransaction, modalType]);

  const handleAmountBlur = () => {
    const parsed = parseBrlValue(amountInputStr);
    if (parsed > 0) {
      setNewTransaction(prev => ({ ...prev, amount: parsed }));
      setAmountInputStr(parsed.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    } else {
      setNewTransaction(prev => ({ ...prev, amount: 0 }));
      setAmountInputStr('');
    }
  };

  const handleEditAccountClick = (account: FinancialAccount) => {
    setEditingAccount(account);
    const existingBankCode = (account as any).bank_code || '';
    setNewAccount({
      name: account.name,
      initial_balance: account.initial_balance,
      type: account.type || 'Corrente',
      color: account.color || '#2563eb',
      is_default: account.is_default || false,
      credit_limit: account.credit_limit || 0,
      bank_code: existingBankCode
    });
    setModalType('account');
    setIsModalOpen(true);
  };

  const handleExportTransactionsCSV = () => {
    if (filteredTransactions.length === 0) {
      alert('Nenhum lançamento para exportar.');
      return;
    }
    const headers = ['Data Venc.', 'Data Pag.', 'Descrição', 'Categoria', 'Conta', 'Valor', 'Tipo', 'Status'];
    const rows = filteredTransactions.map(tx => {
      const cat = categories.find(c => c.id === tx.category_id)?.name || 'Sem Categoria';
      const acc = accounts.find(a => a.id === tx.account_id)?.name || 'Sem Conta';
      return [
        tx.due_date ? new Date(tx.due_date).toLocaleDateString('pt-BR') : '',
        tx.payment_date ? new Date(tx.payment_date).toLocaleDateString('pt-BR') : '',
        tx.description.replace(/,/g, ';'),
        cat.replace(/,/g, ';'),
        acc.replace(/,/g, ';'),
        tx.amount.toFixed(2).replace('.', ','),
        tx.type === TransactionType.INCOME ? 'Receita' : 'Despesa',
        tx.status === TransactionStatus.PAID ? 'Pago' : 'Pendente'
      ].join(',');
    });
    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `extrato_lancamentos_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDeleteAccount = (accountId: string) => {
    const hasTransactions = transactions.some(t => t.account_id === accountId);
    
    setConfirmModalTitle('Excluir Conta Bancária');
    if (hasTransactions) {
      setConfirmModalMessage('Esta conta possui lançamentos vinculados e será apenas desativada do sistema para preservar os dados históricos. Tem certeza que deseja prosseguir com a desativação?');
    } else {
      setConfirmModalMessage('Tem certeza que deseja excluir esta conta?');
    }
    
    setConfirmModalConfirmText(hasTransactions ? 'Desativar' : 'Excluir');
    setConfirmModalConfirmColor('bg-rose-600 hover:bg-rose-700 text-white');
    setOnConfirmAction(() => async () => {
      setLoading(true);
      try {
        const success = await supabaseService.deleteFinancialAccount(accountId);
        if (success) {
          showToast(hasTransactions ? 'Conta desativada com sucesso!' : 'Conta excluída com sucesso!', 'success');
          await loadFinancialData();
        } else {
          showToast('Erro ao excluir a conta bancária.', 'error');
        }
      } catch (err) {
        console.error('Error during account deletion:', err);
        showToast('Erro ao excluir a conta bancária.', 'error');
      } finally {
        setLoading(false);
      }
    });
    setConfirmModalOpen(true);
  };

  const handleClearExtrato = () => {
    setConfirmModalTitle('Limpar Extrato');
    setConfirmModalMessage('Deseja realmente limpar todos os lançamentos pendentes deste extrato? Os já conciliados serão mantidos no banco de dados.');
    setConfirmModalConfirmText('Limpar');
    setConfirmModalConfirmColor('bg-rose-600 hover:bg-rose-700 text-white');
    setOnConfirmAction(() => async () => {
      setLoading(true);
      try {
        const success = await supabaseService.deletePendingReconciliationItems();
        if (success) {
          showToast('Lançamentos pendentes do extrato limpos com sucesso!', 'success');
          
          // Refresh list of reconciliation items from backend
          const remainingItems = await supabaseService.getReconciliationItems();
          if (remainingItems.length > 0) {
            setReconciliationItems(remainingItems);
            setImportedFile('Extrato Salvo');
          } else {
            setReconciliationItems([]);
            setImportedFile(null);
          }
          
          setSelectedImportedIndex(null);
          setSelectedSystemTxId(null);
          setOfxBankName(null);
          setOfxAgency(null);
          setOfxAccount(null);
          setOfxPeriod(null);
          setSelectedMatches([]);
          setReconciliationSearch('');
          
          await loadFinancialData();
        } else {
          showToast('Erro ao limpar os lançamentos pendentes do extrato.', 'error');
        }
      } catch (err) {
        console.error('Error clearing extrato:', err);
        showToast('Erro ao limpar os lançamentos pendentes do extrato.', 'error');
      } finally {
        setLoading(false);
      }
    });
    setConfirmModalOpen(true);
  };

  const handleEditCategoryClick = (category: FinancialCategory) => {
    setEditingCategory(category);
    setNewCategory({
      name: category.name,
      type: category.type,
      color: category.color || '#f43f5e',
      group_name: categoryGroups[category.id] || ''
    });
    setModalType('category');
    setIsModalOpen(true);
  };

  const handleDeleteCategory = (categoryId: string) => {
    setConfirmModalTitle('Excluir Categoria');
    setConfirmModalMessage('Tem certeza que deseja excluir esta categoria?');
    setConfirmModalConfirmText('Excluir');
    setConfirmModalConfirmColor('bg-rose-600 hover:bg-rose-700 text-white');
    setOnConfirmAction(() => () => {
      setCategories(prev => prev.filter(c => c.id !== categoryId));
    });
    setConfirmModalOpen(true);
  };

  const handleEditTransactionClick = (tx: FinancialTransaction) => {
    setEditingTransaction(tx);
    setNewTransaction({
      type: tx.type,
      amount: tx.amount,
      description: tx.description,
      due_date: tx.due_date,
      status: tx.status,
      account_id: tx.account_id,
      category_id: tx.category_id,
      notes: tx.notes || '',
      payment_date: tx.payment_date || undefined,
      agency_id: tx.agency_id
    });
    setModalType('transaction');
    setIsModalOpen(true);
  };

  const handleDeleteTransaction = (id: string) => {
    setConfirmModalTitle('Excluir Lançamento');
    setConfirmModalMessage('Tem certeza que deseja excluir este lançamento?');
    setConfirmModalConfirmText('Excluir');
    setConfirmModalConfirmColor('bg-rose-600 hover:bg-rose-700 text-white');
    setOnConfirmAction(() => async () => {
      setLoading(true);
      try {
        if (supabase) {
          const { error } = await supabase.from('financial_transactions').delete().eq('id', id);
          if (error) {
            alert('Erro ao excluir lançamento: ' + error.message);
          } else {
            setSelectedTxIds(prev => prev.filter(item => item !== id));
            await loadFinancialData();
          }
        } else {
          // Fallback local delete
          setTransactions(prev => prev.filter(t => t.id !== id));
          setSelectedTxIds(prev => prev.filter(item => item !== id));
        }
      } catch (err) {
        console.error('Erro ao deletar lançamento:', err);
      } finally {
        setLoading(false);
      }
    });
    setConfirmModalOpen(true);
  };

  const handleDeleteSelected = () => {
    if (selectedTxIds.length === 0) return;
    setConfirmModalTitle('Excluir Lançamentos Selecionados');
    setConfirmModalMessage(`Tem certeza que deseja excluir os ${selectedTxIds.length} lançamentos selecionados?`);
    setConfirmModalConfirmText('Excluir');
    setConfirmModalConfirmColor('bg-rose-600 hover:bg-rose-700 text-white');
    setOnConfirmAction(() => async () => {
      setLoading(true);
      try {
        if (supabase) {
          const { error } = await supabase.from('financial_transactions').delete().in('id', selectedTxIds);
          if (error) {
            alert('Erro ao excluir lançamentos selecionados: ' + error.message);
          } else {
            setSelectedTxIds([]);
            await loadFinancialData();
          }
        } else {
          // Fallback local delete
          setTransactions(prev => prev.filter(t => !selectedTxIds.includes(t.id)));
          setSelectedTxIds([]);
        }
      } catch (err) {
        console.error('Erro ao deletar selecionados:', err);
      } finally {
        setLoading(false);
      }
    });
    setConfirmModalOpen(true);
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

      setAccounts(accs);
      setCategories(cats);
      setTransactions(txs);
    } catch (error) {
      console.error('Erro ao buscar dados do Supabase:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFinancialData();
  }, []);

  // Effect to dynamically hide the "Supabase Real" badge from Layout.tsx header
  useEffect(() => {
    const hideBadge = () => {
      const spans = document.getElementsByTagName('span');
      for (let i = 0; i < spans.length; i++) {
        if (spans[i].textContent?.trim() === 'Supabase Real') {
          (spans[i] as HTMLElement).style.display = 'none';
        }
      }
    };
    hideBadge();
    const interval = setInterval(hideBadge, 500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeView === 'financial-conciliacao') {
      supabaseService.getReconciliationItems().then(items => {
        if (items.length > 0) {
          setReconciliationItems(items);
          setImportedFile('Extrato Salvo');
          setSelectedImportedIndex(null);
        }
      });
    }
  }, [activeView]);
  // Compute stats dynamically for current period (selected month/year)
  const stats = useMemo(() => {
    const todayStr = getLocalTodayStr();
    const startOfYear = currentPeriod.getFullYear();
    const startOfMonth = currentPeriod.getMonth();

    const periodTxs = transactions.filter(t => {
      const parts = t.due_date.split('-');
      const txYear = parseInt(parts[0], 10);
      const txMonth = parseInt(parts[1], 10) - 1;
      return txYear === startOfYear && txMonth === startOfMonth;
    });
    
    const overdue = periodTxs
      .filter(t => t.status === TransactionStatus.PENDING && t.due_date < todayStr)
      .reduce((acc, curr) => acc + curr.amount, 0);
    
    const todays = periodTxs
      .filter(t => t.status === TransactionStatus.PENDING && t.due_date === todayStr)
      .reduce((acc, curr) => acc + curr.amount, 0);

    const pending = periodTxs
      .filter(t => t.status === TransactionStatus.PENDING && t.due_date > todayStr)
      .reduce((acc, curr) => acc + curr.amount, 0);

    const paid = periodTxs
      .filter(t => t.status === TransactionStatus.PAID)
      .reduce((acc, curr) => acc + curr.amount, 0);
    
    const totalPeriod = periodTxs
      .reduce((acc, curr) => acc + (curr.type === TransactionType.INCOME ? curr.amount : -curr.amount), 0);
    
    return { overdue, todays, pending, paid, totalPeriod };
  }, [transactions, currentPeriod]);

  // Filters for current period, type, category, search term, and active KPI card click
  const filteredTransactions = useMemo(() => {
    const startOfYear = currentPeriod.getFullYear();
    const startOfMonth = currentPeriod.getMonth();
    const todayStr = getLocalTodayStr();

    return transactions.filter(t => {
      // 1. Month/Year Period Filter
      const parts = t.due_date.split('-');
      const txYear = parseInt(parts[0], 10);
      const txMonth = parseInt(parts[1], 10) - 1;
      const matchesPeriod = txYear === startOfYear && txMonth === startOfMonth;
      if (!matchesPeriod) return false;

      // 2. Search Term
      const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;

      // 3. Type Filter (Todos / Receitas / Despesas)
      const matchesType = typeFilter === 'ALL' || t.type === typeFilter;
      if (!matchesType) return false;

      // 4. Category Filter from dropdown
      if (categoryFilter !== 'ALL' && t.category_id !== categoryFilter) {
        return false;
      }

      // 5. Active KPI Card filter
      if (kpiFilter) {
        if (kpiFilter === 'VENCIDOS') {
          const isOverdue = t.status === TransactionStatus.PENDING && t.due_date < todayStr;
          if (!isOverdue) return false;
        } else if (kpiFilter === 'VENCEM HOJE') {
          const isToday = t.status === TransactionStatus.PENDING && t.due_date === todayStr;
          if (!isToday) return false;
        } else if (kpiFilter === 'A VENCER') {
          const isFuturePending = t.status === TransactionStatus.PENDING && t.due_date > todayStr;
          if (!isFuturePending) return false;
        } else if (kpiFilter === 'PAGOS') {
          const isPaid = t.status === TransactionStatus.PAID;
          if (!isPaid) return false;
        }
      }

      return true;
    });
  }, [transactions, searchTerm, typeFilter, currentPeriod, kpiFilter, categoryFilter]);

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
      setTransactions(prev => prev.map(t => t.id === tx.id ? { ...t, status: newStatus, payment_date: newStatus === TransactionStatus.PAID ? new Date().toISOString().split('T')[0] : null as any } : t));
    }
  };

  // Submit handlings
  const handleCreateTransaction = async () => {
    // 1. Centralized BRL currency parser and validation
    const parsedAmount = parseBrlValue(amountInputStr);
    
    if (parsedAmount <= 0) {
      alert('Por favor, insira um valor válido maior que zero (ex: 100,50 ou 1.500,00).');
      return;
    }

    if (!newTransaction.description || !newTransaction.account_id) {
      alert('Por favor, preencha todos os campos obrigatórios, incluindo a Conta Bancária.');
      return;
    }

    const accountExists = accounts.some(acc => acc.id === newTransaction.account_id);
    if (!accountExists) {
      alert('Conta bancária inválida');
      return;
    }

    // 2. Map payload properties, converting empty UUID values to null
    const payload = {
      ...newTransaction,
      amount: parsedAmount,
      agency_id: currentUser.agencyId,
      account_id: !newTransaction.account_id || newTransaction.account_id === '' ? null : newTransaction.account_id,
      category_id: !newTransaction.category_id || newTransaction.category_id === '' ? null : newTransaction.category_id,
      // 3. Robust "Marcar como Pago/Recebido" mapping
      status: markAsPaid ? TransactionStatus.PAID : TransactionStatus.PENDING,
      payment_date: markAsPaid ? (newTransaction.payment_date || new Date().toISOString().split('T')[0]) : null
    } as any;

    // Validate due_date is present
    if (!payload.due_date) {
      payload.due_date = new Date().toISOString().split('T')[0];
    }

    // 4. Generate recurrences using the precise monthly/yearly helper
    const copiesToCreate: any[] = [];
    if (recurrenceType !== 'NONE' && recurrencePeriods > 0 && !editingTransaction) {
      for (let i = 1; i <= recurrencePeriods; i++) {
        const nextDueDate = addPeriodToDate(payload.due_date, recurrenceType, i);
        copiesToCreate.push({
          ...payload,
          due_date: nextDueDate,
          description: `${payload.description} (Cópia ${i})`
        });
      }
    }

    if (editingTransaction) {
      if (supabase) {
        const { error } = await supabase
          .from('financial_transactions')
          .update(payload)
          .eq('id', editingTransaction.id);
        
        if (error) {
          console.error('Error updating transaction:', error);
          alert('Erro ao atualizar lançamento.');
        } else {
          setIsModalOpen(false);
          setEditingTransaction(null);
          loadFinancialData();
        }
      } else {
        alert('Conexão com o banco de dados indisponível.');
      }
    } else {
      // Insertion of new transactions or recurring batches
      if (supabase) {
        if (copiesToCreate.length > 0) {
          // Batch insertion returning created rows to prevent manual reload
          const { data, error } = await supabase
            .from('financial_transactions')
            .insert([payload, ...copiesToCreate])
            .select();
          
          if (error) {
            console.error('Error creating recurring transactions:', error);
            alert('Erro ao criar lançamentos recorrentes: ' + error.message);
          } else {
            if (data && data.length > 0) {
              setTransactions(prev => [...data, ...prev]);
            }
            setIsModalOpen(false);
            loadFinancialData(); // Background refresh to update accounts/balances
          }
        } else {
          // Single insertion
          const { data, error } = await supabase
            .from('financial_transactions')
            .insert([payload])
            .select();
          
          if (error) {
            console.error('Error creating transaction:', error);
            alert('Erro ao criar lançamento: ' + error.message);
          } else {
            if (data && data.length > 0) {
              setTransactions(prev => [data[0], ...prev]);
            }
            setIsModalOpen(false);
            loadFinancialData(); // Background refresh to update accounts/balances
          }
        }
      } else {
        alert('Conexão com o banco de dados indisponível.');
      }
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
        credit_limit: newAccount.credit_limit ? Number(newAccount.credit_limit) : undefined,
        bank_code: newAccount.bank_code || null
      } : acc));
      handleCloseModal();
      return;
    }

    if (newAccount.initial_balance === undefined || newAccount.initial_balance === null) {
      alert('Favor preencher o saldo inicial.');
      return;
    }

    const selectedBank = BANKS.find(b => b.code === newAccount.bank_code);
    const bank_name = selectedBank ? selectedBank.name : 'Outro';

    const payload: FinancialAccountInsert = {
      agency_id: currentUser.agencyId,
      name: newAccount.name,
      bank_name: bank_name,
      account_type: newAccount.type,
      initial_balance: Number(newAccount.initial_balance),
      current_balance: Number(newAccount.initial_balance),
      color: newAccount.color,
      is_default: newAccount.is_default,
      type: newAccount.type,
      credit_limit: newAccount.credit_limit ? Number(newAccount.credit_limit) : undefined,
      is_active: true,
      bank_code: newAccount.bank_code || null
    };

    const result = await supabaseService.createFinancialAccount(payload);
    if (result) {
      handleCloseModal();
      loadFinancialData();
    } else {
      alert('Erro ao criar a conta bancária no servidor. Favor tentar novamente.');
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
      setCategoryGroups(prev => ({
        ...prev,
        [editingCategory.id]: newCategory.group_name
      }));
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
      if (newCategory.group_name) {
        setCategoryGroups(prev => ({
          ...prev,
          [result.id]: newCategory.group_name
        }));
      }
      handleCloseModal();
      loadFinancialData();
    } else {
      const mockId = 'cat-' + Math.random().toString(36).substr(2, 9);
      const mockResult: FinancialCategory = {
        id: mockId,
        ...payload
      };
      if (newCategory.group_name) {
        setCategoryGroups(prev => ({
          ...prev,
          [mockId]: newCategory.group_name
        }));
      }
      setCategories(prev => [...prev, mockResult]);
      handleCloseModal();
    }
  };

  const generateExternalId = (date: string, amount: number, description: string, fitid?: string | null): string => {
    if (fitid) {
      return fitid.trim();
    }
    const cleanDesc = description
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '_')
      .replace(/__+/g, '_')
      .replace(/^_+|_+$/g, '');
    return `${date}_${amount}_${cleanDesc}`;
  };

  const normalizeDescription = (desc: string): string => {
    if (!desc) return '';
    let str = desc;
    
    // Replace typical UTF-8 read as Latin1 / CP1252 glitches
    const replacements: { [key: string]: string } = {
      '▲▲': 'ÇÃ',
      'â€“': '-',
      'â€”': '-',
      'Ã¡': 'á',
      'Ã¢': 'â',
      'Ã£': 'ã',
      'Ã©': 'é',
      'Ãª': 'ê',
      'Ã­': 'í',
      'Ã³': 'ó',
      'Ã´': 'ô',
      'Ãµ': 'õ',
      'Ãº': 'ú',
      'Ã§': 'ç',
      'Ã ': 'à',
      'Ã‰': 'É',
      'Ã•': 'Õ',
      'Ã‡': 'Ç',
      'Ãš': 'Ú',
      'Ã“': 'Ó',
      'Ã ': 'Á',
      'Âº': 'º',
      'Âª': 'ª',
      'â€¢': '•',
      'â€™': "'",
      'â€œ': '"',
      'â€': '"',
    };
    
    for (const [key, val] of Object.entries(replacements)) {
      str = str.replace(new RegExp(key, 'g'), val);
    }
    
    // Replace multiple spaces
    str = str.replace(/\s+/g, ' ');
    
    return str.trim();
  };

  const parseCsvExtrato = (text: string) => {
    const lines = text.split(/\r?\n/);
    if (lines.length === 0) return [];
    
    const parsed: any[] = [];
    let dateIdx = -1;
    let descIdx = -1;
    let valIdx = -1;
    
    // Attempt header index resolution
    const headers = lines[0].split(/[;,]/).map(h => h.trim().toLowerCase());
    for (let idx = 0; idx < headers.length; idx++) {
      const h = headers[idx];
      if (h.includes('data') || h.includes('date')) dateIdx = idx;
      else if (h.includes('desc') || h.includes('memo') || h.includes('historico') || h.includes('histórico') || h.includes('detalhe')) descIdx = idx;
      else if (h.includes('valor') || h.includes('amount') || h.includes('val')) valIdx = idx;
    }
    
    if (dateIdx === -1) dateIdx = 0;
    if (descIdx === -1) descIdx = 1;
    if (valIdx === -1) valIdx = 2;
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const columns = line.split(/[;,]/).map(c => c.trim().replace(/^["']|["']$/g, ''));
      if (columns.length <= Math.max(dateIdx, descIdx, valIdx)) continue;
      
      const rawDate = columns[dateIdx];
      const desc = normalizeDescription(columns[descIdx]);
      const rawVal = columns[valIdx];
      
      if (!rawDate || !desc || !rawVal) continue;
      
      let dateStr = rawDate;
      if (rawDate.includes('/')) {
        const parts = rawDate.split('/');
        if (parts.length === 3) {
          const day = parts[0].padStart(2, '0');
          const month = parts[1].padStart(2, '0');
          const year = parts[2];
          dateStr = `${year}-${month}-${day}`;
        }
      }
      
      let cleanVal = rawVal.replace(/\./g, '').replace(',', '.');
      cleanVal = cleanVal.replace(/[R$\s]/gi, '');
      const valNum = parseFloat(cleanVal);
      const amount = Math.abs(valNum);
      if (isNaN(amount)) continue;
      
      const isExpense = valNum < 0 || desc.toUpperCase().includes('DEB') || desc.toUpperCase().includes('PAG') || desc.toUpperCase().includes('TARIFA') || desc.toUpperCase().includes('DEBITO') || desc.toUpperCase().includes('TRANSF. PAGO') || desc.toUpperCase().includes('PIX OUT');
      
      const extId = generateExternalId(dateStr, amount, desc, null);
      parsed.push({
        id: extId,
        date: dateStr,
        description: desc,
        amount,
        type: isExpense ? TransactionType.EXPENSE : TransactionType.INCOME,
        matched: false
      });
    }
    return parsed;
  };

  const parseOfxExtrato = (text: string) => {
    const parsed: any[] = [];
    const stmttrnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
    let match;
    
    while ((match = stmttrnRegex.exec(text)) !== null) {
      const block = match[1];
      
      const dtpostedMatch = /<DTPOSTED>(\d{8})/i.exec(block);
      const memoMatch = /<MEMO>([^<\r\n]+)/i.exec(block);
      const trnamtMatch = /<TRNAMT>([^<\r\n]+)/i.exec(block);
      const fitidMatch = /<FITID>([^<\r\n]+)/i.exec(block);
      
      if (dtpostedMatch && trnamtMatch) {
        const rawDate = dtpostedMatch[1];
        const year = rawDate.substring(0, 4);
        const month = rawDate.substring(4, 6);
        const day = rawDate.substring(6, 8);
        const dateStr = `${year}-${month}-${day}`;
        
        const desc = normalizeDescription(memoMatch ? memoMatch[1].trim() : 'Transação Bancária');
        const rawAmt = parseFloat(trnamtMatch[1].trim());
        const amount = Math.abs(rawAmt);
        const type = rawAmt < 0 ? TransactionType.EXPENSE : TransactionType.INCOME;
        const fitid = fitidMatch ? fitidMatch[1].trim() : null;
        
        const extId = generateExternalId(dateStr, amount, desc, fitid);
        parsed.push({
          id: extId,
          date: dateStr,
          description: desc,
          amount,
          type,
          matched: false
        });
      }
    }

    // Estratégia 2: OFX sem tags de fechamento (Sicoob, Bradesco antigo, BB)
    if (parsed.length === 0) {
      const blocks = text.split(/<STMTTRN>/i).slice(1);
      for (const block of blocks) {
        const dtpostedMatch = /<DTPOSTED>(\d{8})/i.exec(block);
        const memoMatch = /<MEMO>([^<\r\n]+)/i.exec(block);
        const nameMatch = /<NAME>([^<\r\n]+)/i.exec(block);
        const trnamtMatch = /<TRNAMT>([^<\r\n]+)/i.exec(block);
        const fitidMatch = /<FITID>([^<\r\n]+)/i.exec(block);

        if (dtpostedMatch && trnamtMatch) {
          const rawDate = dtpostedMatch[1];
          const dateStr = `${rawDate.substring(0,4)}-${rawDate.substring(4,6)}-${rawDate.substring(6,8)}`;
          const desc = normalizeDescription(memoMatch ? memoMatch[1].trim() : (nameMatch ? nameMatch[1].trim() : 'Transação Bancária'));
          const rawAmt = parseFloat(trnamtMatch[1].trim());
          const amount = Math.abs(rawAmt);
          const type = rawAmt < 0 ? TransactionType.EXPENSE : TransactionType.INCOME;
          const fitid = fitidMatch ? fitidMatch[1].trim() : null;
          
          const extId = generateExternalId(dateStr, amount, desc, fitid);
          parsed.push({
            id: extId,
            date: dateStr,
            description: desc,
            amount,
            type,
            matched: false
          });
        }
      }
    }
    
    if (parsed.length === 0) {
      const dtMatches = [...text.matchAll(/<DTPOSTED>(\d{8})/gi)];
      const memoMatches = [...text.matchAll(/<MEMO>([^<\r\n]+)/gi)];
      const amtMatches = [...text.matchAll(/<TRNAMT>([^<\r\n]+)/gi)];
      const fitidMatches = [...text.matchAll(/<FITID>([^<\r\n]+)/gi)];
      
      const count = Math.min(dtMatches.length, memoMatches.length, amtMatches.length);
      for (let i = 0; i < count; i++) {
        const rawDate = dtMatches[i][1];
        const year = rawDate.substring(0, 4);
        const month = rawDate.substring(4, 6);
        const day = rawDate.substring(6, 8);
        const dateStr = `${year}-${month}-${day}`;
        
        const desc = normalizeDescription(memoMatches[i][1].trim());
        const rawAmt = parseFloat(amtMatches[i][1].trim());
        const amount = Math.abs(rawAmt);
        const type = rawAmt < 0 ? TransactionType.EXPENSE : TransactionType.INCOME;
        const fitid = fitidMatches[i] ? fitidMatches[i][1].trim() : null;
        
        const extId = generateExternalId(dateStr, amount, desc, fitid);
        parsed.push({
          id: extId,
          date: dateStr,
          description: desc,
          amount,
          type,
          matched: false
        });
      }
    }
    
    return parsed;
  };

  const handleBankFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;
      
      let parsed: any[] = [];
      if (file.name.toLowerCase().endsWith('.ofx')) {
        parsed = parseOfxExtrato(text);

        // Extracao de metadados do OFX para selecao automatica do banco
        const bankIdMatch = /<BANKID>([^<\r\n]+)/i.exec(text);
        const acctIdMatch = /<ACCTID>([^<\r\n]+)/i.exec(text);
        const branchIdMatch = /<BRANCHID>([^<\r\n]+)/i.exec(text);
        const dtstartMatch = /<DTSTART>(\d{8})/i.exec(text);
        const dtendMatch = /<DTEND>(\d{8})/i.exec(text);
        const orgMatch = /<ORG>([^<\r\n]+)/i.exec(text);

        const parsedBankId = bankIdMatch ? bankIdMatch[1].trim() : '';
        const parsedAcctId = acctIdMatch ? acctIdMatch[1].trim() : '';
        const parsedBranchId = branchIdMatch ? branchIdMatch[1].trim() : '';

        const bankCodeMap: { [key: string]: string } = {
          "001": "bb",
          "341": "itau",
          "237": "bradesco",
          "104": "caixa",
          "033": "santander",
          "260": "nubank",
          "077": "inter",
          "756": "sicoob",
          "133": "cresol",
          "074": "sicredi"
        };

        const mappedBankCode = bankCodeMap[parsedBankId] || '';
        const derivedBankName = orgMatch ? orgMatch[1].trim() : (BANKS.find(b => b.code === mappedBankCode)?.name || parsedBankId || null);

        setOfxBankName(derivedBankName);
        setOfxAgency(parsedBranchId || null);
        setOfxAccount(parsedAcctId || null);

        if (dtstartMatch && dtendMatch) {
          const formatOfxDateStr = (raw: string): string => {
            if (raw && raw.length >= 8) {
              const y = raw.substring(0, 4);
              const m = raw.substring(4, 6);
              const d = raw.substring(6, 8);
              return `${d}/${m}/${y}`;
            }
            return '';
          };
          setOfxPeriod(`${formatOfxDateStr(dtstartMatch[1])} a ${formatOfxDateStr(dtendMatch[1])}`);
        } else {
          setOfxPeriod(null);
        }

        // Tentar encontrar uma conta compativel
        let matchedAccount: any = null;
        let bestAccountScore = 0;
        accounts.forEach(acc => {
          let score = 0;
          const nameLower = (acc.name || '').toLowerCase();
          const bankNameLower = (acc.bank_name || '').toLowerCase();
          const bankCodeLower = (acc.bank_code || '').toLowerCase();

          // Match bank code
          if (mappedBankCode && bankCodeLower === mappedBankCode) {
            score += 50;
          } else if (mappedBankCode) {
            const bankObj = BANKS.find(b => b.code === mappedBankCode);
            if (bankObj && (nameLower.includes(bankObj.name.toLowerCase()) || bankNameLower.includes(bankObj.name.toLowerCase()))) {
              score += 40;
            }
          }

          // Match account number
          if (parsedAcctId && nameLower.includes(parsedAcctId.toLowerCase())) {
            score += 30;
          }
          
          // Match branch/agency
          if (parsedBranchId && nameLower.includes(parsedBranchId.toLowerCase())) {
            score += 20;
          }

          if (score > bestAccountScore) {
            bestAccountScore = score;
            matchedAccount = acc;
          }
        });

        if (matchedAccount && bestAccountScore >= 40) {
          setQuickAccountId(matchedAccount.id);
          showToast(`Conta bancária '${matchedAccount.name}' identificada e selecionada automaticamente!`, 'success');
        } else {
          setQuickAccountId('');
        }
      } else {
        parsed = parseCsvExtrato(text);
        setOfxBankName(null);
        setOfxAgency(null);
        setOfxAccount(null);
        setOfxPeriod(null);
        setQuickAccountId('');
      }
      
      if (parsed.length > 0) {
        setImportedFile(file.name);
        setReconciliationItems(parsed);
        supabaseService.saveReconciliationItems(
          parsed.map((item: any) => ({
            statement_date: item.date,
            description: item.description,
            amount: item.amount,
            type: item.type,
            external_id: item.id,
          }))
        ).then(() => {
          supabaseService.getReconciliationItems().then(dbItems => {
            if (dbItems.length > 0) {
              setReconciliationItems(dbItems);
            }
          });
        });
        setSelectedImportedIndex(0);
        setSelectedSystemTxId(null);
        showToast(`${parsed.length} lançamentos extraídos do extrato bancário!`, 'success');
      } else {
        showToast('Não foi possível identificar lançamentos no arquivo. Verifique o layout.', 'error');
      }
    };
    reader.readAsText(file);
  };

  // Perform a reconciliation pairing
  const handlePairReconciliation = async () => {
    if (selectedImportedIndex === null || !selectedSystemTxId) return;

    const imported = reconciliationItems[selectedImportedIndex];
    const systemTx = transactions.find(t => t.id === selectedSystemTxId);

    if (systemTx) {
      setLoading(true);
      try {
        // 1 - Salvar relacionamento primeiro
        if (imported?.id) {
          await supabaseService.matchReconciliationItem(imported.id, systemTx.id);
        }

        // 2 - Atualizar lançamento financeiro
        await supabaseService.updateTransactionStatus(systemTx.id, TransactionStatus.PAID);

        // Atualizar estados locais
        setMatchedPairs(prev => [...prev, { importedIdx: selectedImportedIndex, systemId: systemTx.id }]);
        setReconciliationItems(prev => prev.map((item, idx) => idx === selectedImportedIndex ? { ...item, matched: true, matchedTxId: systemTx.id } : item));
        setTransactions(prev => prev.map(t => t.id === systemTx.id ? { ...t, status: TransactionStatus.PAID, payment_date: imported.date } : t));

        showToast('Conciliação realizada e lançamento liquidado!', 'success');
        setSelectedImportedIndex(null);
        setSelectedSystemTxId(null);
        setAutoMatchScore(null);
      } catch (err) {
        console.error(err);
        showToast('Erro ao realizar a conciliação.', 'error');
      } finally {
        setLoading(false);
      }
    }
  };

  // Encontrar o próximo item pendente no extrato
  const findNextPendingIndex = (currentIndex: number): number => {
    const items = reconciliationItems;
    for (let i = currentIndex + 1; i < items.length; i++) {
      const itemId = items[i].id || items[i].external_id || `temp-${i}`;
      const isAlreadyPrepared = selectedMatches.some(m => m.reconciliation_id === itemId);
      if (!items[i].matched && !isAlreadyPrepared) {
        return i;
      }
    }
    for (let i = 0; i < currentIndex; i++) {
      const itemId = items[i].id || items[i].external_id || `temp-${i}`;
      const isAlreadyPrepared = selectedMatches.some(m => m.reconciliation_id === itemId);
      if (!items[i].matched && !isAlreadyPrepared) {
        return i;
      }
    }
    return -1;
  };

  // Preparar um vínculo localmente para conciliação em lote
  const handleQueueMatch = () => {
    if (selectedImportedIndex === null || !selectedSystemTxId) {
      showToast('Nenhum item ou lançamento selecionado para vincular.', 'error');
      return;
    }
    
    const imported = reconciliationItems[selectedImportedIndex];
    const systemTx = transactions.find(t => t.id === selectedSystemTxId);
    
    if (imported && systemTx) {
      if (systemTx.id.startsWith('tx-local-')) {
        showToast('Não é possível conciliar com um lançamento temporário em memória.', 'error');
        return;
      }
      const recId = imported.id || imported.external_id || `temp-${selectedImportedIndex}`;
      const score = calculateMatchScore(imported, systemTx);
      
      setSelectedMatches(prev => {
        const filtered = prev.filter(m => m.reconciliation_id !== recId);
        return [...filtered, {
          reconciliation_id: recId,
          transaction_id: systemTx.id,
          score,
          status: 'prepared'
        }];
      });
      
      showToast('Vínculo preparado com sucesso! Prossiga para o próximo ou concilie em lote.', 'success');
      
      // Avança automaticamente para o próximo item pendente do extrato
      const nextIndex = findNextPendingIndex(selectedImportedIndex);
      if (nextIndex !== -1) {
        setSelectedImportedIndex(nextIndex);
        setSelectedSystemTxId(null);
        setAutoMatchScore(null);
        // Calcula a correspondência sugerida para o próximo item
        const suggested = computeAutoMatch(
          reconciliationItems[nextIndex],
          transactions
        );
        if (suggested) {
          setSelectedSystemTxId(suggested.id);
          setAutoMatchScore(suggested.score);
        } else {
          setSelectedSystemTxId(null);
          setAutoMatchScore(null);
        }
      } else {
        setSelectedImportedIndex(null);
        setSelectedSystemTxId(null);
        setAutoMatchScore(null);
      }
    }
  };

  // Remover um vínculo preparado da fila local
  const handleRemoveQueueMatch = (recId: string) => {
    setSelectedMatches(prev => prev.filter(m => m.reconciliation_id !== recId));
    showToast('Vínculo preparado removido.', 'success');
  };

  // Conciliar todos os vínculos preparados em lote no banco
  const handleBatchConciliate = async () => {
    if (selectedMatches.length === 0) {
      showToast('Nenhum vínculo preparado para conciliação em lote.', 'error');
      return;
    }

    // Garantir que somente transações existentes no Supabase entrem no selectedMatches
    const validMatches = selectedMatches.filter(match => {
      const tx = transactions.find(t => t.id === match.transaction_id);
      return tx && !tx.id.startsWith('tx-local-');
    });

    if (validMatches.length === 0) {
      showToast('Nenhum vínculo válido (com lançamentos reais no banco) foi encontrado na fila.', 'error');
      setSelectedMatches([]);
      return;
    }
    
    setLoading(true);
    const succeededMatches: typeof selectedMatches = [];
    const failedMatches: Array<{ match: typeof selectedMatches[0]; errorMsg: string }> = [];

    try {
      for (const match of validMatches) {
        const recItem = reconciliationItems.find(item => (item.id || item.external_id) === match.reconciliation_id);
        const date = recItem ? recItem.date : new Date().toISOString().split('T')[0];
        const payloadSingle = {
          reconciliationId: match.reconciliation_id,
          transactionId: match.transaction_id,
          date
        };

        try {
          const success = await supabaseService.matchReconciliationItemsBatch([payloadSingle]);
          if (success) {
            succeededMatches.push(match);
          } else {
            failedMatches.push({
              match,
              errorMsg: `Falha na API ao atualizar o extrato "${recItem?.description || match.reconciliation_id}"`
            });
          }
        } catch (singleErr) {
          console.error('Error during single batch item match:', singleErr);
          failedMatches.push({
            match,
            errorMsg: singleErr instanceof Error ? singleErr.message : String(singleErr)
          });
        }
      }

      if (succeededMatches.length > 0) {
        // Atualiza o estado local para marcar como conciliado apenas os que deram sucesso
        setReconciliationItems(prev => prev.map(item => {
          const match = succeededMatches.find(m => m.reconciliation_id === (item.id || item.external_id));
          if (match) {
            return { ...item, matched: true, matchedTxId: match.transaction_id };
          }
          return item;
        }));

        setMatchedPairs(prev => {
          const newPairs = [...prev];
          succeededMatches.forEach(match => {
            const idx = reconciliationItems.findIndex(item => (item.id || item.external_id) === match.reconciliation_id);
            if (idx !== -1) {
              newPairs.push({ importedIdx: idx, systemId: match.transaction_id });
            }
          });
          return newPairs;
        });

        setTransactions(prev => prev.map(t => {
          const match = succeededMatches.find(m => m.transaction_id === t.id);
          if (match) {
            const recItem = reconciliationItems.find(item => (item.id || item.external_id) === match.reconciliation_id);
            const date = recItem ? recItem.date : new Date().toISOString().split('T')[0];
            return { ...t, status: TransactionStatus.PAID, payment_date: date };
          }
          return t;
        }));

        // Remove da fila apenas os que deram sucesso
        setSelectedMatches(prev => prev.filter(m => !succeededMatches.some(sm => sm.reconciliation_id === m.reconciliation_id)));
        
        // Recarrega todos os dados financeiros de forma reativa e consistente
        await loadFinancialData();
      }

      if (failedMatches.length > 0) {
        const failedDescriptions = failedMatches.map(f => {
          const recItem = reconciliationItems.find(item => (item.id || item.external_id) === f.match.reconciliation_id);
          return `• ${recItem?.description || f.match.reconciliation_id}`;
        }).join('\n');
        
        if (succeededMatches.length > 0) {
          showToast(`Lote parcial: ${succeededMatches.length} conciliados. Erro nos seguintes itens:\n${failedDescriptions}`, 'error');
        } else {
          showToast(`Erro na conciliação de todos os itens selecionados:\n${failedDescriptions}`, 'error');
        }
      } else {
        showToast(`${succeededMatches.length} lançamentos conciliados com sucesso em lote!`, 'success');
        setSelectedImportedIndex(null);
        setSelectedSystemTxId(null);
        setAutoMatchScore(null);
      }
    } catch (err) {
      console.error(err);
      showToast('Erro ao realizar a conciliação em lote.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Ignore a reconciliation item
  const handleIgnoreReconciliation = async () => {
    if (selectedImportedIndex === null) return;
    const item = reconciliationItems[selectedImportedIndex];
    
    setLoading(true);
    try {
      if (item?.id) {
        await supabaseService.ignoreReconciliationItem(item.id);
      }
      setReconciliationItems(prev => prev.filter((_, idx) => idx !== selectedImportedIndex));
      setSelectedImportedIndex(null);
      setSelectedSystemTxId(null);
      setAutoMatchScore(null);
      showToast('Item ignorado com sucesso!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Erro ao ignorar item.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickCreateAndReconcile = async () => {
    if (selectedImportedIndex === null) return;
    const importedItem = reconciliationItems[selectedImportedIndex];
    
    if (!quickCategoryId || !quickAccountId) {
      showToast('Selecione uma categoria e uma conta para o lançamento.', 'error');
      return;
    }
    
    const accountExists = accounts.some(acc => acc.id === quickAccountId);
    if (!accountExists) {
      showToast('Conta bancária inválida', 'error');
      return;
    }
    
    setLoading(true);
    const desc = quickDescription.trim() || importedItem.description;
    
    const payload = {
      agency_id: currentUser.agencyId,
      description: desc,
      amount: Number(importedItem.amount),
      type: importedItem.type,
      category_id: quickCategoryId,
      account_id: quickAccountId,
      status: TransactionStatus.PAID,
      due_date: importedItem.date,
      payment_date: importedItem.date
    };
    
    try {
      // 1. Criar transação financeira
      const result = await supabaseService.createFinancialTransaction(payload);
      if (!result || !result.id) {
        showToast('Erro ao criar o lançamento no servidor. Nenhuma alteração foi realizada.', 'error');
        return;
      }

      // 2. Tentar vincular com o item do extrato
      if (importedItem?.id) {
        try {
          const matchSuccess = await supabaseService.matchReconciliationItem(importedItem.id, result.id);
          if (!matchSuccess) {
            throw new Error('Retorno falso do serviço ao vincular item.');
          }
        } catch (matchErr) {
          console.error('Failed to link reconciliation item:', matchErr);
          showToast('Lançamento criado no servidor, mas erro ao associar com o extrato. O item continua pendente para nova tentativa.', 'error');
          // Adiciona a transação criada ao estado para que ela fique disponível na listagem manual,
          // mas NÃO marca o item do extrato como conciliado e NÃO limpa a seleção.
          setTransactions(prev => [result, ...prev]);
          return;
        }
      }
      
      // 3. Sucesso completo em ambas as etapas: atualizar UI e limpar estado de seleção
      setMatchedPairs(prev => [...prev, { importedIdx: selectedImportedIndex, systemId: result.id }]);
      setReconciliationItems(prev => prev.map((item, idx) => idx === selectedImportedIndex ? { ...item, matched: true, matchedTxId: result.id } : item));
      setTransactions(prev => [result, ...prev]);
      showToast('Lançamento criado e conciliado com sucesso!', 'success');
      
      setSelectedImportedIndex(null);
      setSelectedSystemTxId(null);
      setQuickDescription('');
    } catch (err) {
      console.error(err);
      showToast('Erro de rede ou permissão ao realizar o fluxo do lançamento rápido.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const calculateMatchScore = (importedItem: any, tx: any): number => {
    // 1. Must be same type (25%)
    if (tx.type !== importedItem.type) return 0;
    const tipoScore = 25;

    // 2. Value must be within ±5% (50%)
    const diffVal = Math.abs(tx.amount - importedItem.amount);
    const maxAllowedDiff = importedItem.amount * 0.05;
    if (diffVal > maxAllowedDiff) return 0;

    const valPct = importedItem.amount > 0 ? diffVal / importedItem.amount : 0;
    const valorScore = (1 - (valPct / 0.05)) * 50;

    // 3. Description: 20%
    let descScore = 0;
    const impDescNorm = normalizeDescription(importedItem.description || '').toLowerCase().trim();
    const txDescNorm = normalizeDescription(tx.description || '').toLowerCase().trim();
    if (impDescNorm === txDescNorm && impDescNorm !== '') {
      descScore = 20;
    } else {
      const impWords = impDescNorm.split(/\s+/).filter((w: string) => w.length > 3);
      const txWords = txDescNorm.split(/\s+/).filter((w: string) => w.length > 3);
      const common = impWords.filter((w: string) => txWords.includes(w));
      descScore = impWords.length > 0 ? Math.min(20, (common.length / impWords.length) * 20) : 0;
    }

    // 4. Data: 5% (difference up to 30 days)
    const txDateStr = tx.due_date || tx.date || tx.transaction_date || '';
    let dataScore = 0;
    if (txDateStr) {
      const txDate = new Date(txDateStr + 'T00:00:00');
      const impDate = new Date(importedItem.date + 'T00:00:00');
      const diffTime = Math.abs(txDate.getTime() - impDate.getTime());
      const diffDays = diffTime / (1000 * 60 * 60 * 24);
      dataScore = diffDays <= 30 ? (1 - diffDays / 30) * 5 : 0;
    }

    return Math.round(tipoScore + valorScore + descScore + dataScore);
  };

  const computeAutoMatch = (importedItem: any, systemTxs: FinancialTransaction[]): { id: string; score: number } | null => {
    if (!importedItem || systemTxs.length === 0) return null;

    let bestId: string | null = null;
    let bestScore = 0;

    systemTxs.forEach(tx => {
      // Ignorar apenas se já conciliada
      const jasConciliada = (tx as any).reconciled === true || (tx as any).matched === true;
      if (jasConciliada) return;
      
      const score = calculateMatchScore(importedItem, tx);

      if (score > bestScore && score >= 50) {
        bestScore = score;
        bestId = tx.id;
      }
    });

    return bestId ? { id: bestId, score: bestScore } : null;
  };

  const handleAutoConciliateAll = async () => {
    const pendingItems = reconciliationItems.filter(item => !item.matched);
    if (pendingItems.length === 0) {
      showToast('Nenhum item pendente para conciliar.', 'error');
      return;
    }

    let matchCount = 0;
    const updatedItems = [...reconciliationItems];

    for (let i = 0; i < updatedItems.length; i++) {
      if (updatedItems[i].matched) continue;

      const suggested = computeAutoMatch(
        updatedItems[i],
        transactions.filter(t => !(t as any).reconciled && !(t as any).matched)
      );

      if (suggested && suggested.score >= 85) {
        // Parear localmente
        updatedItems[i] = { ...updatedItems[i], matched: true, matchedTxId: suggested.id };

        // Persistir no banco
        if (updatedItems[i].id) {
          await supabaseService.matchReconciliationItem(updatedItems[i].id, suggested.id);
        }

        // Atualizar transação local como paga
        setTransactions(prev =>
          prev.map(t => t.id === suggested.id
            ? { ...t, status: TransactionStatus.PAID, payment_date: updatedItems[i].date }
            : t
          )
        );

        matchCount++;
      }
    }

    setReconciliationItems(updatedItems);

    if (matchCount > 0) {
      showToast(`${matchCount} item(s) conciliado(s) automaticamente!`, 'success');
    } else {
      showToast('Nenhuma correspondência com alta confiança encontrada.', 'error');
    }
  };

  const handleAutoConciliation = () => {
    let matchCount = 0;
    const updatedItems = [...reconciliationItems];
    
    updatedItems.forEach((item, impIdx) => {
      if (item.matched) return;
      
      const possibleMatches = transactions
        .filter(t => t.status === TransactionStatus.PENDING && !matchedPairs.some(p => p.systemId === t.id))
        .map(t => {
          if (t.type !== item.type) return { t, score: 0 };
          
          let score = 0;
          const diffVal = Math.abs(t.amount - item.amount);
          if (diffVal < 0.01) score += 60;
          else if (diffVal / item.amount <= 0.05) score += (1 - (diffVal / (item.amount * 0.05))) * 60;
          
          const tDate = new Date(t.due_date);
          const iDate = new Date(item.date);
          const diffTime = Math.abs(tDate.getTime() - iDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          if (diffDays === 0) score += 40;
          else if (diffDays <= 7) score += (1 - diffDays / 7) * 40;
          
          return { t, score: Math.round(score) };
        })
        .filter(match => match.score >= 80)
        .sort((a, b) => b.score - a.score);
        
      if (possibleMatches.length > 0) {
        const bestMatch = possibleMatches[0].t;
        supabaseService.updateTransactionStatus(bestMatch.id, TransactionStatus.PAID);
        setMatchedPairs(prev => [...prev, { importedIdx: impIdx, systemId: bestMatch.id }]);
        item.matched = true;
        item.matchedTxId = bestMatch.id;
        setTransactions(prev => prev.map(t => t.id === bestMatch.id ? { ...t, status: TransactionStatus.PAID, payment_date: item.date } : t));
        matchCount++;
      }
    });
    
    setReconciliationItems(updatedItems);
    if (matchCount > 0) {
      showToast(`${matchCount} conciliações realizadas automaticamente!`, 'success');
    } else {
      showToast('Nenhum match acima de 80% de compatibilidade foi encontrado.', 'error');
    }
  };

  // 1. View: Extrato (Statement)
  const renderExtrato = () => {
    const handleKpiClick = (id: string) => {
      if (kpiFilter === id) {
        setKpiFilter(null);
      } else {
        setKpiFilter(id);
      }
    };

    return (
      <div className="space-y-6">
        {/* KPI Cards section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { id: 'VENCIDOS', label: 'VENCIDOS', value: stats.overdue, color: 'text-rose-600', bg: 'bg-white' },
            { id: 'VENCEM HOJE', label: 'VENCEM HOJE', value: stats.todays, color: 'text-amber-600', bg: 'bg-white' },
            { id: 'A VENCER', label: 'A VENCER', value: stats.pending, color: 'text-blue-600', bg: 'bg-white' },
            { id: 'PAGOS', label: 'PAGOS', value: stats.paid, color: 'text-emerald-600', bg: 'bg-white' },
            { id: 'TOTAL', label: 'TOTAL DO PERÍODO', value: stats.totalPeriod, color: stats.totalPeriod >= 0 ? 'text-emerald-600' : 'text-rose-600', bg: 'bg-emerald-500/5', help: true, notFilterable: true },
          ].map((kpi, idx) => {
            const isSelected = kpiFilter === kpi.id;
            return (
              <div 
                key={idx} 
                onClick={() => !kpi.notFilterable && handleKpiClick(kpi.id)}
                className={`${kpi.bg} p-6 rounded-2xl border transition-all ${
                  isSelected 
                    ? 'border-blue-400 ring-2 ring-blue-100 bg-blue-50/10' 
                    : 'border-slate-100 shadow-sm hover:border-slate-300'
                } flex flex-col items-center justify-center text-center ${kpi.notFilterable ? '' : 'cursor-pointer'}`}
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{kpi.label}</span>
                  {kpi.help && <HelpCircle size={12} className="text-slate-300" />}
                </div>
                <h3 className={`text-xl font-black ${kpi.color}`}>
                  {formatCurrency(kpi.value)}
                </h3>
              </div>
            );
          })}
        </div>

        {/* Main Table Container */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">

          {/* Mass Actions Bar */}
          {selectedTxIds.length > 0 && (
            <div className="bg-rose-50 border-b border-rose-100 px-6 py-3.5 flex items-center justify-between animate-fadeIn">
              <div className="flex items-center gap-2">
                <CheckSquare className="text-rose-600" size={18} />
                <span className="text-xs font-bold text-rose-900">{selectedTxIds.length} lançamentos selecionados</span>
              </div>
              <button 
                onClick={handleDeleteSelected}
                className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs px-4 py-2 rounded-xl transition-all shadow-sm cursor-pointer"
              >
                <Trash2 size={14} /> Excluir Selecionados
              </button>
            </div>
          )}

          {/* Transactions Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="px-6 py-4 text-center w-12">
                    <input 
                      type="checkbox" 
                      className="rounded text-blue-600 focus:ring-blue-400 cursor-pointer" 
                      checked={filteredTransactions.length > 0 && filteredTransactions.every(tx => selectedTxIds.includes(tx.id))}
                      onChange={() => {
                        const isAllVisibleSelected = filteredTransactions.length > 0 && filteredTransactions.every(tx => selectedTxIds.includes(tx.id));
                        if (isAllVisibleSelected) {
                          setSelectedTxIds(prev => prev.filter(id => !filteredTransactions.some(tx => tx.id === id)));
                        } else {
                          const visibleIds = filteredTransactions.map(tx => tx.id);
                          setSelectedTxIds(prev => {
                            const otherIds = prev.filter(id => !visibleIds.includes(id));
                            return [...otherIds, ...visibleIds];
                          });
                        }
                      }}
                    />
                  </th>
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
                      <td className="px-6 py-5 text-center">
                        <input 
                          type="checkbox" 
                          className="rounded text-blue-600 focus:ring-blue-400 cursor-pointer" 
                          checked={selectedTxIds.includes(tx.id)}
                          onChange={() => {
                            setSelectedTxIds(prev => 
                              prev.includes(tx.id) ? prev.filter(id => id !== tx.id) : [...prev, tx.id]
                            );
                          }}
                        />
                      </td>
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
                          <span 
                            className="px-2 py-0.5 rounded-md text-[9px] font-medium uppercase tracking-wider text-center border" 
                            style={{ 
                              backgroundColor: (category?.color || '#cbd5e1') + '26', 
                              borderColor: (category?.color || '#cbd5e1') + '40',
                              color: category?.color || '#475569' 
                            }}
                          >
                            {category?.name || 'Geral'}
                          </span>
                          {!tx.account_id || !account ? (
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 text-[9px] font-medium uppercase tracking-wider mt-1 select-none">
                              Sem conta
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium text-slate-400 mt-1">
                              {account.name}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <span className={`text-sm font-black ${tx.type === TransactionType.EXPENSE ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {tx.type === TransactionType.EXPENSE ? '-' : '+'} {formatCurrency(tx.amount)}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                          isPaid 
                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                            : (tx.status === TransactionStatus.PENDING && tx.due_date < getLocalTodayStr())
                              ? 'bg-rose-50 text-rose-600 border border-rose-100'
                              : 'bg-amber-50 text-amber-600 border border-amber-100'
                        }`}>
                          {isPaid 
                            ? 'Liquidado' 
                            : (tx.status === TransactionStatus.PENDING && tx.due_date < getLocalTodayStr())
                              ? 'Vencido'
                              : 'Pendente'}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            onClick={() => handleToggleStatus(tx)}
                            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                              isPaid 
                                ? 'bg-amber-50 border-amber-200 text-amber-600 hover:bg-amber-100' 
                                : 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100'
                            }`}
                            title={isPaid ? 'Marcar como Pendente' : 'Liquidar Lançamento'}
                          >
                            <RefreshCw size={14} className="hover:rotate-180 transition-transform duration-300" />
                          </button>

                          <button 
                            onClick={() => handleEditTransactionClick(tx)}
                            className="p-1.5 rounded-lg border bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100 transition-all cursor-pointer"
                            title="Editar Lançamento"
                          >
                            <Pencil size={14} />
                          </button>

                          <button 
                            onClick={() => handleDeleteTransaction(tx.id)}
                            className="p-1.5 rounded-lg border bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100 transition-all cursor-pointer"
                            title="Excluir Lançamento"
                          >
                            <Trash2 size={14} />
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
  };

  // 2. View: Fluxo de Caixa (Cash Flow Analyzer)
  const renderFluxodeCaixa = () => {
    // Determine active account IDs (default to all if none explicitly selected)
    const activeAccountIds = selectedAccountIds.length > 0 ? selectedAccountIds : accounts.map(a => a.id);
    const selectedAccountsList = accounts.filter(a => activeAccountIds.includes(a.id));
    
    // Total consolidated initial balance of selected accounts (Fórmula do item 1)
    const totalInitialBalance = selectedAccountsList.reduce((acc, curr) => acc + (curr.initial_balance || 0), 0);

    // Filter overall transactions for selected accounts (to compute current Saldo Atual of all time)
    // Ignore internal transfer transactions to prevent distorting real cash flow
    const txsForSelectedAccounts = transactions.filter(t => {
      const accId = t.account_id || t.financial_account_id;
      return activeAccountIds.includes(accId || '') && t.is_transfer !== true;
    });

    const totalPaidIncomeOverall = txsForSelectedAccounts
      .filter(t => t.type === TransactionType.INCOME && t.status === TransactionStatus.PAID)
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    const totalPaidExpenseOverall = txsForSelectedAccounts
      .filter(t => t.type === TransactionType.EXPENSE && t.status === TransactionStatus.PAID)
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    // 1 - Saldo Atual (Fórmula: saldo inicial + entradas pagas - despesas pagas)
    const saldoAtualCalculado = totalInitialBalance + totalPaidIncomeOverall - totalPaidExpenseOverall;

    // 2 - Projeção futura (Considerar: transactions PENDING com due_date futura)
    const hoje = getLocalTodayStr();
    const futurePendingTxs = txsForSelectedAccounts.filter(t => 
      t.status === TransactionStatus.PENDING && 
      t.due_date > hoje
    );

    const totalFuturePendingIncome = futurePendingTxs
      .filter(t => t.type === TransactionType.INCOME)
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    const totalFuturePendingExpense = futurePendingTxs
      .filter(t => t.type === TransactionType.EXPENSE)
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    // Projeção futura final = Saldo Atual + entradas pendentes futuras - despesas pendentes futuras
    const projecaoFuturaCalculada = saldoAtualCalculado + totalFuturePendingIncome - totalFuturePendingExpense;

    // Filter active period transactions
    const periodTxs = txsForSelectedAccounts.filter(t => {
      const parts = t.due_date.split('-');
      const txYear = parseInt(parts[0], 10);
      const txMonth = parseInt(parts[1], 10) - 1;
      return txYear === currentPeriod.getFullYear() && txMonth === currentPeriod.getMonth();
    });

    // Entradas no período
    const periodPaidIncome = periodTxs
      .filter(t => t.type === TransactionType.INCOME && t.status === TransactionStatus.PAID)
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    const periodPendingIncome = periodTxs
      .filter(t => t.type === TransactionType.INCOME && t.status === TransactionStatus.PENDING)
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    const totalPeriodIncome = periodPaidIncome + periodPendingIncome;

    // Saídas no período
    const periodPaidExpense = periodTxs
      .filter(t => t.type === TransactionType.EXPENSE && t.status === TransactionStatus.PAID)
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    const periodPendingExpense = periodTxs
      .filter(t => t.type === TransactionType.EXPENSE && t.status === TransactionStatus.PENDING)
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    const totalPeriodExpense = periodPaidExpense + periodPendingExpense;

    // --- DRE CALCULATIONS (Competence) ---
    // Receita (Incomes)
    const dreRevenueTransactions = periodTxs.filter(t => t.type === TransactionType.INCOME);
    const totalDreRevenue = dreRevenueTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);

    // Custos vs Despesas
    // Classify as "Custo" if the category or its group name contains 'custo' or 'cost' (case-insensitive)
    const dreExpenseTransactions = periodTxs.filter(t => t.type === TransactionType.EXPENSE);

    const dreCustosTransactions = dreExpenseTransactions.filter(t => {
      const catId = t.category_id || '';
      const cat = categories.find(c => c.id === catId);
      const catName = (cat?.name || '').toLowerCase();
      const groupName = (categoryGroups[catId] || '').toLowerCase();
      return catName.includes('custo') || groupName.includes('custo') || catName.includes('cost') || groupName.includes('cost');
    });

    const dreDespesasTransactions = dreExpenseTransactions.filter(t => {
      const catId = t.category_id || '';
      const cat = categories.find(c => c.id === catId);
      const catName = (cat?.name || '').toLowerCase();
      const groupName = (categoryGroups[catId] || '').toLowerCase();
      return !(catName.includes('custo') || groupName.includes('custo') || catName.includes('cost') || groupName.includes('cost'));
    });

    const totalDreCustos = dreCustosTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
    const totalDreDespesas = dreDespesasTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
    const dreResultado = totalDreRevenue - totalDreCustos - totalDreDespesas;

    // Breakdown DRE categories
    const dreCategoriesIncome = categories
      .filter(c => c.type === TransactionType.INCOME)
      .map(cat => {
        const total = dreRevenueTransactions
          .filter(t => t.category_id === cat.id)
          .reduce((acc, curr) => acc + (curr.amount || 0), 0);
        return { name: cat.name, total, color: cat.color };
      })
      .filter(c => c.total > 0)
      .sort((a, b) => b.total - a.total);

    const dreCategoriesCustos = categories
      .filter(c => c.type === TransactionType.EXPENSE)
      .map(cat => {
        const total = dreCustosTransactions
          .filter(t => t.category_id === cat.id)
          .reduce((acc, curr) => acc + (curr.amount || 0), 0);
        return { name: cat.name, total, color: cat.color };
      })
      .filter(c => c.total > 0)
      .sort((a, b) => b.total - a.total);

    const dreCategoriesDespesas = categories
      .filter(c => c.type === TransactionType.EXPENSE)
      .map(cat => {
        const total = dreDespesasTransactions
          .filter(t => t.category_id === cat.id)
          .reduce((acc, curr) => acc + (curr.amount || 0), 0);
        return { name: cat.name, total, color: cat.color };
      })
      .filter(c => c.total > 0)
      .sort((a, b) => b.total - a.total);

    // --- GROUPING (Dia / Semana / Mês) ---
    const getGroupKeyAndLabel = (dateStr: string, mode: 'DAILY' | 'WEEKLY' | 'MONTHLY') => {
      if (!dateStr) return { key: 'Sem Data', label: 'Sem Data' };
      const [year, month, day] = dateStr.split('-');
      
      if (mode === 'DAILY') {
        return {
          key: dateStr,
          label: `${day}/${month}/${year}`
        };
      } else if (mode === 'WEEKLY') {
        const d = new Date(`${dateStr}T12:00:00`);
        const dayOfWeek = d.getDay();
        const diff = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        const monday = new Date(d.setDate(diff));
        const startStr = monday.toISOString().split('T')[0];
        const [mY, mM, mD] = startStr.split('-');
        return {
          key: startStr,
          label: `Semana de ${mD}/${mM}`
        };
      } else {
        const months = [
          'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
          'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        ];
        const monthIndex = parseInt(month, 10) - 1;
        return {
          key: `${year}-${month}`,
          label: `${months[monthIndex]} / ${year}`
        };
      }
    };

    const groupedDataMap: { 
      [key: string]: { 
        label: string; 
        income: number; 
        expense: number; 
        expectedIncome: number; 
        expectedExpense: number; 
      } 
    } = {};

    periodTxs.forEach(tx => {
      const dateStr = tx.payment_date && tx.status === TransactionStatus.PAID ? tx.payment_date : tx.due_date;
      const { key, label } = getGroupKeyAndLabel(dateStr, fluxoGroupMode);
      
      if (!groupedDataMap[key]) {
        groupedDataMap[key] = {
          label,
          income: 0,
          expense: 0,
          expectedIncome: 0,
          expectedExpense: 0
        };
      }
      
      const amt = tx.amount || 0;
      if (tx.type === TransactionType.INCOME) {
        if (tx.status === TransactionStatus.PAID) {
          groupedDataMap[key].income += amt;
        } else {
          groupedDataMap[key].expectedIncome += amt;
        }
      } else if (tx.type === TransactionType.EXPENSE) {
        if (tx.status === TransactionStatus.PAID) {
          groupedDataMap[key].expense += amt;
        } else {
          groupedDataMap[key].expectedExpense += amt;
        }
      }
    });

    const sortedGroupKeys = Object.keys(groupedDataMap).sort();
    const groupedList = sortedGroupKeys.map(key => ({
      key,
      ...groupedDataMap[key]
    }));

    return (
      <div className="space-y-8">
        {/* Account Selector Section */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider">Contas Ativas na Análise</h4>
              <p className="text-xs text-slate-400 font-medium">Filtre as contas bancárias para recalcular o fluxo de caixa e relatórios.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {accounts.map(acc => {
                const isSelected = selectedAccountIds.includes(acc.id);
                return (
                  <button
                    key={acc.id}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedAccountIds(selectedAccountIds.filter(id => id !== acc.id));
                      } else {
                        setSelectedAccountIds([...selectedAccountIds, acc.id]);
                      }
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                      isSelected 
                        ? 'bg-slate-900 border-slate-900 text-white shadow-sm' 
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: acc.color || '#94a3b8' }} />
                    <span>{acc.name}</span>
                    <span className="opacity-80">({formatCurrency(getAccountLiveBalance(acc))})</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 2 MAIN INTERNAL AREAS: SIDE-BY-SIDE OR STACKED */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          
          {/* AREA 1: FLUXO DE CAIXA */}
          <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
            <div className="border-b border-slate-100 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                  <Wallet className="text-blue-600" size={20} />
                  FLUXO DE CAIXA
                </h3>
                <p className="text-xs text-slate-400 font-medium mt-1">Saldos reais e projeções com base na liquidação e vencimentos.</p>
              </div>
              
              {/* Group Mode Selector */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-start md:self-center">
                {(['DAILY', 'WEEKLY', 'MONTHLY'] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setFluxoGroupMode(mode)}
                    className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                      fluxoGroupMode === mode
                        ? 'bg-white text-slate-800 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {mode === 'DAILY' ? 'Diário' : mode === 'WEEKLY' ? 'Semanal' : 'Mensal'}
                  </button>
                ))}
              </div>
            </div>

            {/* KPIs Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Saldo de Caixa Atual */}
              <div className="p-4 bg-slate-50/70 border border-slate-100 rounded-2xl flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">1. Saldo de Caixa Atual</span>
                  <span className="text-2xl font-black text-slate-900 mt-1 block">{formatCurrency(saldoAtualCalculado)}</span>
                  <span className="text-[9px] text-slate-400 font-medium block mt-1">Fórmula: Saldo Inicial ({formatCurrency(totalInitialBalance)}) + Recebido ({formatCurrency(totalPaidIncomeOverall)}) - Pago ({formatCurrency(totalPaidExpenseOverall)})</span>
                </div>
              </div>

              {/* Projeção de Caixa Futura */}
              <div className="p-4 bg-blue-50/50 border border-blue-100/30 rounded-2xl flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-blue-800/60 uppercase tracking-widest block">2. Projeção Futura</span>
                  <span className="text-2xl font-black text-blue-900 mt-1 block">{formatCurrency(projecaoFuturaCalculada)}</span>
                  <span className="text-[9px] text-blue-700/60 font-medium block mt-1">Considera lançamentos PENDENTES com vencimento futuro ({futurePendingTxs.length} previstos)</span>
                </div>
              </div>

              {/* Total Entradas (Período) */}
              <div className="p-4 bg-emerald-50/30 border border-emerald-100/30 rounded-2xl flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-emerald-800/60 uppercase tracking-widest block">Entradas (Período)</span>
                  <span className="text-xl font-black text-emerald-800 mt-1 block">{formatCurrency(totalPeriodIncome)}</span>
                  <div className="mt-2 flex justify-between text-[9px] text-emerald-700 font-semibold border-t border-emerald-100/30 pt-1.5">
                    <span>Pagas: {formatCurrency(periodPaidIncome)}</span>
                    <span>Pendentes: {formatCurrency(periodPendingIncome)}</span>
                  </div>
                </div>
              </div>

              {/* Total Saídas (Período) */}
              <div className="p-4 bg-rose-50/30 border border-rose-100/30 rounded-2xl flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-rose-800/60 uppercase tracking-widest block">Saídas (Período)</span>
                  <span className="text-xl font-black text-rose-800 mt-1 block">{formatCurrency(totalPeriodExpense)}</span>
                  <div className="mt-2 flex justify-between text-[9px] text-rose-700 font-semibold border-t border-rose-100/30 pt-1.5">
                    <span>Pagas: {formatCurrency(periodPaidExpense)}</span>
                    <span>Pendentes: {formatCurrency(periodPendingExpense)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Cash Flow Evolution Graph */}
            <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100">
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                <Activity size={14} className="text-slate-400" />
                Evolução do Caixa no Período
              </h4>
              {groupedList.length > 0 ? (
                <div className="space-y-4">
                  <div className="h-44 flex items-end justify-around gap-2 pt-4 border-b border-slate-100 pb-2">
                    {groupedList.map((item, idx) => {
                      const totalPeriodIn = item.income + item.expectedIncome;
                      const totalPeriodOut = item.expense + item.expectedExpense;
                      const maxVal = Math.max(...groupedList.map(g => Math.max(g.income + g.expectedIncome, g.expense + g.expectedExpense)), 1);
                      
                      const heightIn = `${Math.max((totalPeriodIn / maxVal) * 110, 4)}px`;
                      const heightOut = `${Math.max((totalPeriodOut / maxVal) * 110, 4)}px`;

                      return (
                        <div key={idx} className="flex flex-col items-center flex-1 min-w-[50px] max-w-[80px] group relative">
                          <div className="flex items-end justify-center gap-1 w-full">
                            {/* Income stacked bar */}
                            <div className="w-4 md:w-6 flex flex-col justify-end rounded-t-sm overflow-hidden" style={{ height: heightIn }}>
                              {item.expectedIncome > 0 && (
                                <div className="bg-emerald-300 w-full" style={{ height: `${(item.expectedIncome / totalPeriodIn) * 100}%` }} title={`Prevista: ${formatCurrency(item.expectedIncome)}`} />
                              )}
                              {item.income > 0 && (
                                <div className="bg-emerald-600 w-full" style={{ height: `${(item.income / totalPeriodIn) * 100}%` }} title={`Realizada: ${formatCurrency(item.income)}`} />
                              )}
                            </div>
                            {/* Expense stacked bar */}
                            <div className="w-4 md:w-6 flex flex-col justify-end rounded-t-sm overflow-hidden" style={{ height: heightOut }}>
                              {item.expectedExpense > 0 && (
                                <div className="bg-rose-300 w-full" style={{ height: `${(item.expectedExpense / totalPeriodOut) * 100}%` }} title={`Prevista: ${formatCurrency(item.expectedExpense)}`} />
                              )}
                              {item.expense > 0 && (
                                <div className="bg-rose-600 w-full" style={{ height: `${(item.expense / totalPeriodOut) * 100}%` }} title={`Realizada: ${formatCurrency(item.expense)}`} />
                              )}
                            </div>
                          </div>
                          <span className="text-[8px] font-bold text-slate-400 mt-2 truncate w-full text-center" title={item.label}>{item.label}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[9px] font-bold text-slate-500 uppercase tracking-wide">
                    <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-emerald-600 rounded-sm" />Entrada Realizada</div>
                    <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-emerald-300 rounded-sm" />Entrada Prevista</div>
                    <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-rose-600 rounded-sm" />Saída Realizada</div>
                    <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-rose-300 rounded-sm" />Saída Prevista</div>
                  </div>
                </div>
              ) : (
                <p className="text-center py-10 text-xs text-slate-400 italic">Sem movimentações para exibir no gráfico neste período.</p>
              )}
            </div>
          </div>

          {/* AREA 2: DRE (DEMONSTRAÇÃO DO RESULTADO DO EXERCÍCIO) */}
          <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                <FileText className="text-violet-600" size={20} />
                DRE (REGIME DE COMPETÊNCIA)
              </h3>
              <p className="text-xs text-slate-400 font-medium mt-1">Lançamentos reconhecidos por data de vencimento/competência no período.</p>
            </div>

            {/* High-level KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 bg-emerald-50/30 rounded-xl border border-emerald-100/20 text-center">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Receita</span>
                <span className="text-sm font-black text-emerald-800 block mt-1">{formatCurrency(totalDreRevenue)}</span>
              </div>
              <div className="p-3 bg-amber-50/30 rounded-xl border border-amber-100/20 text-center">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">(-) Custos</span>
                <span className="text-sm font-black text-amber-800 block mt-1">{formatCurrency(totalDreCustos)}</span>
              </div>
              <div className="p-3 bg-rose-50/30 rounded-xl border border-rose-100/20 text-center">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">(-) Despesas</span>
                <span className="text-sm font-black text-rose-800 block mt-1">{formatCurrency(totalDreDespesas)}</span>
              </div>
              <div className={`p-3 rounded-xl text-center border ${dreResultado >= 0 ? 'bg-emerald-100/20 border-emerald-100/30' : 'bg-rose-100/20 border-rose-100/30'}`}>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Resultado</span>
                <span className={`text-sm font-black block mt-1 ${dreResultado >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {formatCurrency(dreResultado)}
                </span>
              </div>
            </div>

            {/* DRE Structured Report Table */}
            <div className="space-y-4 border border-slate-100 rounded-2xl p-4 md:p-5 bg-slate-50/30">
              <div className="space-y-3">
                {/* 1. RECEITAS OPERACIONAIS */}
                <div>
                  <div className="flex justify-between items-center text-xs font-black text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-1.5">
                    <span>(+) RECEITAS OPERACIONAIS</span>
                    <span className="text-emerald-600">{formatCurrency(totalDreRevenue)}</span>
                  </div>
                  <div className="mt-2 pl-3 space-y-1">
                    {dreCategoriesIncome.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-[11px] text-slate-500 font-semibold">
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.color || '#3b82f6' }} />
                          <span>{item.name}</span>
                        </div>
                        <span>{formatCurrency(item.total)}</span>
                      </div>
                    ))}
                    {dreCategoriesIncome.length === 0 && (
                      <span className="text-[10px] text-slate-400 italic block">Nenhuma receita neste período.</span>
                    )}
                  </div>
                </div>

                {/* 2. CUSTOS DE OPERAÇÃO */}
                <div>
                  <div className="flex justify-between items-center text-xs font-black text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-1.5 mt-4">
                    <span>(-) CUSTOS OPERACIONAIS (Diretos)</span>
                    <span className="text-amber-600">{formatCurrency(totalDreCustos)}</span>
                  </div>
                  <div className="mt-2 pl-3 space-y-1">
                    {dreCategoriesCustos.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-[11px] text-slate-500 font-semibold">
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.color || '#3b82f6' }} />
                          <span>{item.name}</span>
                        </div>
                        <span>{formatCurrency(item.total)}</span>
                      </div>
                    ))}
                    {dreCategoriesCustos.length === 0 && (
                      <span className="text-[10px] text-slate-400 italic block">Nenhum custo registrado neste período.</span>
                    )}
                  </div>
                </div>

                {/* Margem Intermediária */}
                <div className="flex justify-between items-center text-[11px] font-black text-slate-700 uppercase bg-slate-100/50 p-2 rounded-lg mt-2">
                  <span>(=) MARGEM DE CONTRIBUIÇÃO / LUCRO OPERACIONAL</span>
                  <span>{formatCurrency(totalDreRevenue - totalDreCustos)}</span>
                </div>

                {/* 3. DESPESAS OPERACIONAIS */}
                <div>
                  <div className="flex justify-between items-center text-xs font-black text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-1.5 mt-4">
                    <span>(-) DESPESAS OPERACIONAIS (Administrativas/Gerais)</span>
                    <span className="text-rose-600">{formatCurrency(totalDreDespesas)}</span>
                  </div>
                  <div className="mt-2 pl-3 space-y-1">
                    {dreCategoriesDespesas.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-[11px] text-slate-500 font-semibold">
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.color || '#3b82f6' }} />
                          <span>{item.name}</span>
                        </div>
                        <span>{formatCurrency(item.total)}</span>
                      </div>
                    ))}
                    {dreCategoriesDespesas.length === 0 && (
                      <span className="text-[10px] text-slate-400 italic block">Nenhuma despesa operacional neste período.</span>
                    )}
                  </div>
                </div>

                {/* Resultado Líquido DRE final */}
                <div className={`flex justify-between items-center text-xs font-black uppercase p-3 rounded-xl border mt-6 ${
                  dreResultado >= 0 
                    ? 'bg-emerald-50 border-emerald-100 text-emerald-800 shadow-sm' 
                    : 'bg-rose-50 border-rose-100 text-rose-800 shadow-sm'
                }`}>
                  <span>(=) RESULTADO LÍQUIDO DO EXERCÍCIO</span>
                  <span>{formatCurrency(dreResultado)}</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    );
  };

  const renderContasPagarReceber = () => {
    const hoje = getLocalTodayStr();

    // Helper to calculate difference in days
    const getDaysDiff = (d1Str: string, d2Str: string): number => {
      if (!d1Str || !d2Str) return 0;
      const t1 = new Date(d1Str + 'T12:00:00').getTime();
      const t2 = new Date(d2Str + 'T12:00:00').getTime();
      return Math.floor((t1 - t2) / (1000 * 60 * 60 * 24));
    };

    // Helper for formatting dates cleanly
    const formatDateStr = (dateStr: string) => {
      if (!dateStr) return '';
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return new Date(dateStr).toLocaleDateString('pt-BR');
    };

    // Helper to calculate interest and penalty
    const calculateInterest = (amount: number, dueDateStr: string, status: TransactionStatus, type: TransactionType) => {
      if (status !== TransactionStatus.PENDING || type !== TransactionType.EXPENSE || dueDateStr >= hoje) {
        return null;
      }
      const diasAtraso = getDaysDiff(hoje, dueDateStr);
      if (diasAtraso <= 0) return null;

      const multaValor = amount * 0.02;
      const jurosValor = amount * (0.00033 * diasAtraso);
      const totalComJuros = amount + multaValor + jurosValor;

      return {
        diasAtraso,
        multaValor,
        jurosValor,
        totalComJuros
      };
    };

    const handleQuickPay = async (tx: FinancialTransaction) => {
      const success = await supabaseService.updateTransactionStatus(tx.id, TransactionStatus.PAID);
      if (success) {
        showToast('Lançamento liquidado com sucesso!', 'success');
        loadFinancialData();
      } else {
        setTransactions(prev => prev.map(t => t.id === tx.id ? { ...t, status: TransactionStatus.PAID, payment_date: hoje } : t));
        showToast('Lançamento liquidado localmente!', 'success');
      }
    };

    const handlePostponeTransaction = async (tx: FinancialTransaction) => {
      const currentDueDate = new Date(tx.due_date + 'T12:00:00');
      currentDueDate.setDate(currentDueDate.getDate() + 7);
      const newDueDateStr = currentDueDate.toISOString().split('T')[0];
      
      if (supabase) {
        const { error } = await supabase
          .from('financial_transactions')
          .update({ due_date: newDueDateStr })
          .eq('id', tx.id);
        
        if (error) {
          console.error('Error postponing transaction:', error);
          showToast('Erro ao adiar lançamento.', 'error');
        } else {
          showToast(`Vencimento adiado para ${formatDateStr(newDueDateStr)}!`, 'success');
          loadFinancialData();
        }
      } else {
        setTransactions(prev => prev.map(t => t.id === tx.id ? { ...t, due_date: newDueDateStr } : t));
        showToast(`Vencimento adiado localmente para ${formatDateStr(newDueDateStr)}!`, 'success');
      }
    };

    // Compute KPI cards totals
    const txsVencidas = transactions.filter(t => t.status === TransactionStatus.PENDING && t.due_date < hoje && t.type === TransactionType.EXPENSE);
    const txsHoje = transactions.filter(t => t.status === TransactionStatus.PENDING && t.due_date === hoje && t.type === TransactionType.EXPENSE);
    const txsSeteDias = transactions.filter(t => t.status === TransactionStatus.PENDING && t.type === TransactionType.EXPENSE && getDaysDiff(t.due_date, hoje) > 0 && getDaysDiff(t.due_date, hoje) <= 7);
    const txsAReceber = transactions.filter(t => t.type === TransactionType.INCOME && t.status === TransactionStatus.PENDING);

    const countVencidas = txsVencidas.length;
    const sumVencidas = txsVencidas.reduce((a, b) => a + b.amount, 0);

    const countHoje = txsHoje.length;
    const sumHoje = txsHoje.reduce((a, b) => a + b.amount, 0);

    const countSeteDias = txsSeteDias.length;
    const sumSeteDias = txsSeteDias.reduce((a, b) => a + b.amount, 0);

    const countAReceber = txsAReceber.length;
    const sumAReceber = txsAReceber.reduce((a, b) => a + b.amount, 0);

    // Apply filters based on pagamentosTab and search term
    const filteredList = transactions.filter(t => {
      // Search filter
      if (searchTerm.trim() !== '') {
        const term = searchTerm.toLowerCase();
        const descMatches = t.description.toLowerCase().includes(term);
        const catName = categories.find(c => c.id === t.category_id)?.name.toLowerCase() || '';
        const accName = accounts.find(a => a.id === t.account_id)?.name.toLowerCase() || '';
        if (!descMatches && !catName.includes(term) && !accName.includes(term)) {
          return false;
        }
      }

      // Tab filter
      if (pagamentosTab === 'pagar') {
        return t.type === TransactionType.EXPENSE && t.status === TransactionStatus.PENDING;
      }
      if (pagamentosTab === 'receber') {
        return t.type === TransactionType.INCOME && t.status === TransactionStatus.PENDING;
      }
      if (pagamentosTab === 'vencidas') {
        return t.status === TransactionStatus.PENDING && t.due_date < hoje;
      }
      
      // If 'todas' tab, show all pending, plus paid transactions that are in the current month/year
      if (t.status === TransactionStatus.PENDING) {
        return true;
      } else {
        const parts = t.due_date.split('-');
        if (parts.length >= 2) {
          const txYear = parseInt(parts[0], 10);
          const txMonth = parseInt(parts[1], 10) - 1;
          return txYear === currentPeriod.getFullYear() && txMonth === currentPeriod.getMonth();
        }
        return false;
      }
    });

    // Grouping
    const groups: { [key: string]: { title: string; colorClass: string; transactions: FinancialTransaction[] } } = {
      vencidas: { title: 'Contas Vencidas', colorClass: 'bg-rose-50 border-rose-200 text-rose-800', transactions: [] },
      hoje: { title: 'Vence Hoje', colorClass: 'bg-orange-50 border-orange-200 text-orange-800', transactions: [] },
      proximos7: { title: 'Próximos 7 Dias', colorClass: 'bg-amber-50 border-amber-200 text-amber-800', transactions: [] },
      futuro: { title: 'Futuro', colorClass: 'bg-slate-50 border-slate-200 text-slate-800', transactions: [] },
      liquidadas: { title: 'Liquidadas', colorClass: 'bg-emerald-50 border-emerald-200 text-emerald-800', transactions: [] },
    };

    filteredList.forEach(t => {
      if (t.status === TransactionStatus.PAID) {
        groups.liquidadas.transactions.push(t);
      } else if (t.due_date < hoje) {
        groups.vencidas.transactions.push(t);
      } else if (t.due_date === hoje) {
        groups.hoje.transactions.push(t);
      } else if (getDaysDiff(t.due_date, hoje) > 0 && getDaysDiff(t.due_date, hoje) <= 7) {
        groups.proximos7.transactions.push(t);
      } else {
        groups.futuro.transactions.push(t);
      }
    });

    // Sort within groups
    groups.vencidas.transactions.sort((a, b) => a.due_date.localeCompare(b.due_date));
    groups.hoje.transactions.sort((a, b) => a.due_date.localeCompare(b.due_date));
    groups.proximos7.transactions.sort((a, b) => a.due_date.localeCompare(b.due_date));
    groups.futuro.transactions.sort((a, b) => a.due_date.localeCompare(b.due_date));
    groups.liquidadas.transactions.sort((a, b) => (b.payment_date || b.due_date).localeCompare(a.payment_date || a.due_date));

    const totalVisibleTxs = Object.values(groups).reduce((acc, g) => acc + g.transactions.length, 0);

    return (
      <div className="space-y-8">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-rose-50/60 border border-rose-100 p-6 rounded-3xl shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-black text-rose-800/60 uppercase tracking-widest">Vencidas</span>
              <span className="bg-rose-100 text-rose-800 text-xs font-black px-2 py-0.5 rounded-full">{countVencidas}</span>
            </div>
            <div className="mt-4">
              <h3 className="text-2xl font-black text-rose-950">{formatCurrency(sumVencidas)}</h3>
              <p className="text-[10px] text-rose-700/80 font-bold uppercase tracking-wider mt-1">Contas em atraso</p>
            </div>
          </div>

          <div className="bg-orange-50/60 border border-orange-100 p-6 rounded-3xl shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-black text-orange-800/60 uppercase tracking-widest">Vence Hoje</span>
              <span className="bg-orange-100 text-orange-800 text-xs font-black px-2 py-0.5 rounded-full">{countHoje}</span>
            </div>
            <div className="mt-4">
              <h3 className="text-2xl font-black text-orange-950">{formatCurrency(sumHoje)}</h3>
              <p className="text-[10px] text-orange-700/80 font-bold uppercase tracking-wider mt-1">Vencimentos de hoje</p>
            </div>
          </div>

          <div className="bg-amber-50/60 border border-amber-100 p-6 rounded-3xl shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-black text-amber-800/60 uppercase tracking-widest">Próximos 7 Dias</span>
              <span className="bg-amber-100 text-amber-800 text-xs font-black px-2 py-0.5 rounded-full">{countSeteDias}</span>
            </div>
            <div className="mt-4">
              <h3 className="text-2xl font-black text-amber-950">{formatCurrency(sumSeteDias)}</h3>
              <p className="text-[10px] text-amber-700/80 font-bold uppercase tracking-wider mt-1">Vencimentos na semana</p>
            </div>
          </div>

          <div className="bg-emerald-50/60 border border-emerald-100 p-6 rounded-3xl shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-black text-emerald-800/60 uppercase tracking-widest">A Receber</span>
              <span className="bg-emerald-100 text-emerald-800 text-xs font-black px-2 py-0.5 rounded-full">{countAReceber}</span>
            </div>
            <div className="mt-4">
              <h3 className="text-2xl font-black text-emerald-950">{formatCurrency(sumAReceber)}</h3>
              <p className="text-[10px] text-emerald-700/80 font-bold uppercase tracking-wider mt-1">Entradas em aberto</p>
            </div>
          </div>
        </div>

        {/* Tabs of Filter */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex gap-4">
            {(['todas', 'pagar', 'receber', 'vencidas'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setPagamentosTab(tab)}
                className={`pb-3 text-sm font-black uppercase tracking-wider border-b-2 px-4 transition-all cursor-pointer ${
                  pagamentosTab === tab ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                {tab === 'todas' ? 'Todas' : tab === 'pagar' ? 'A Pagar' : tab === 'receber' ? 'A Receber' : 'Vencidas'}
              </button>
            ))}
          </div>
        </div>

        {/* List of Grouped transactions */}
        <div className="space-y-6">
          {totalVisibleTxs === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-100 p-12 shadow-sm text-center flex flex-col items-center justify-center space-y-4">
              <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center shadow-inner">
                <CheckSquare size={32} />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-black text-slate-800">Nenhum lançamento encontrado</h3>
                <p className="text-sm text-slate-400 font-medium">Nenhum vencimento corresponde aos filtros selecionados.</p>
              </div>
            </div>
          ) : (
            ['vencidas', 'hoje', 'proximos7', 'futuro', 'liquidadas'].map(groupKey => {
              const grp = groups[groupKey];
              if (grp.transactions.length === 0) return null;

              return (
                <div key={groupKey} className="space-y-3">
                  <div className={`px-4 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-widest w-fit shadow-sm ${grp.colorClass}`}>
                    {grp.title} ({grp.transactions.length})
                  </div>

                  <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden divide-y divide-slate-100/60">
                    {grp.transactions.map(tx => {
                      const category = categories.find(c => c.id === tx.category_id);
                      const account = accounts.find(a => a.id === tx.account_id);
                      const isIncome = tx.type === TransactionType.INCOME;
                      const isPaid = tx.status === TransactionStatus.PAID;
                      const isOverdue = tx.status === TransactionStatus.PENDING && tx.due_date < hoje;
                      const isToday = tx.status === TransactionStatus.PENDING && tx.due_date === hoje;
                      const interestInfo = calculateInterest(tx.amount, tx.due_date, tx.status, tx.type);

                      return (
                        <div key={tx.id} className="p-5 hover:bg-slate-50/30 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex items-start gap-4 flex-1">
                            <div className={`p-3 rounded-2xl ${isIncome ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'} flex-shrink-0`}>
                              {isIncome ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center flex-wrap gap-2">
                                <span className="text-sm font-black text-slate-800 tracking-tight">{tx.description}</span>
                                {tx.installment_number && tx.total_installments && (
                                  <span className="text-[10px] bg-blue-50 text-blue-600 border border-blue-100 font-bold px-1.5 py-0.5 rounded">
                                    Parcela {tx.installment_number}/{tx.total_installments}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400 font-semibold">
                                <div className="flex items-center gap-1.5">
                                  <Tag size={12} style={{ color: category?.color || '#94a3b8' }} />
                                  <span style={{ color: category?.color || '#64748b' }}>{category?.name || 'Sem Categoria'}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <Wallet size={12} />
                                  <span>{account?.name || 'Sem Conta'}</span>
                                </div>
                              </div>

                              {interestInfo && (
                                <div className="mt-2 text-[10px] font-bold text-rose-600 flex items-center gap-1.5 bg-rose-50 px-2.5 py-1 rounded-xl border border-rose-100 w-fit">
                                  <AlertCircle size={12} />
                                  <span>Atraso de {interestInfo.diasAtraso} {interestInfo.diasAtraso === 1 ? 'dia' : 'dias'}: Multa: {formatCurrency(interestInfo.multaValor)} | Juros: {formatCurrency(interestInfo.jurosValor)} | Total: {formatCurrency(interestInfo.totalComJuros)}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col sm:flex-row sm:items-center justify-between md:justify-end gap-4 flex-shrink-0">
                            <div className="text-left sm:text-right">
                              <p className="text-sm font-black text-slate-900">{formatCurrency(tx.amount)}</p>
                              <div className="flex items-center gap-1.5 text-xs text-slate-400 font-bold mt-0.5">
                                <Calendar size={12} />
                                <span>Vence em {formatDateStr(tx.due_date)}</span>
                              </div>
                            </div>

                            <div>
                              <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${
                                isPaid 
                                  ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                                  : isOverdue
                                    ? 'bg-rose-50 text-rose-600 border-rose-100'
                                    : isToday
                                      ? 'bg-orange-50 text-orange-600 border-orange-100'
                                      : 'bg-amber-50 text-amber-600 border-amber-100'
                              }`}>
                                {isPaid 
                                  ? 'Liquidado' 
                                  : isOverdue
                                    ? 'Vencido'
                                    : isToday
                                      ? 'Hoje'
                                      : 'Pendente'}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5">
                              {!isPaid && (
                                <>
                                  <button
                                    onClick={() => handleQuickPay(tx)}
                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-lg transition-all shadow-sm flex items-center gap-1 cursor-pointer"
                                  >
                                    <Check size={12} /> Pagar
                                  </button>
                                  <button
                                    onClick={() => {
                                      setConfirmModalTitle('Adiar Vencimento');
                                      setConfirmModalMessage(`Deseja adiar o vencimento do lançamento "${tx.description}" em 7 dias?`);
                                      setConfirmModalConfirmText('Adiar');
                                      setConfirmModalConfirmColor('bg-blue-600 hover:bg-blue-700 text-white');
                                      setOnConfirmAction(() => () => {
                                        handlePostponeTransaction(tx);
                                      });
                                      setConfirmModalOpen(true);
                                    }}
                                    className="px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                                  >
                                    <Clock size={12} /> Adiar
                                  </button>
                                </>
                              )}
                              <button
                                onClick={() => handleEditTransactionClick(tx)}
                                className="px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                              >
                                <Sliders size={12} /> Detalhes
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  const renderCentroCusto = () => {
    // Period filter (Month/Year) using due_date
    const periodTransactions = transactions.filter(t => {
      if (!t.due_date) return false;
      const parts = t.due_date.split('-');
      if (parts.length < 2) return false;
      const txYear = parseInt(parts[0], 10);
      const txMonth = parseInt(parts[1], 10) - 1;
      return txYear === currentPeriod.getFullYear() && txMonth === currentPeriod.getMonth();
    });

    const grouped: Record<string, {
      groupName: string;
      transactions: FinancialTransaction[];
      totalPago: number;
      totalPendente: number;
      totalReceita: number;
      totalDespesa: number;
      resultado: number;
      categoryMap: Record<string, {
        categoryId: string;
        categoryName: string;
        categoryColor: string;
        total: number;
        transactionCount: number;
        type: TransactionType;
      }>;
    }> = {};

    periodTransactions.forEach(t => {
      const categoryId = t.category_id || '';
      const groupName = (categoryId && categoryGroups[categoryId]) ? categoryGroups[categoryId].trim() : 'Sem Centro de Custo';

      if (!grouped[groupName]) {
        grouped[groupName] = {
          groupName,
          transactions: [],
          totalPago: 0,
          totalPendente: 0,
          totalReceita: 0,
          totalDespesa: 0,
          resultado: 0,
          categoryMap: {}
        };
      }

      const group = grouped[groupName];
      group.transactions.push(t);

      if (t.status === TransactionStatus.PAID) {
        group.totalPago += t.amount;
      } else if (t.status === TransactionStatus.PENDING) {
        group.totalPendente += t.amount;
      }

      if (t.type === TransactionType.INCOME) {
        group.totalReceita += t.amount;
      } else if (t.type === TransactionType.EXPENSE) {
        group.totalDespesa += t.amount;
      }

      // Category grouping
      const catObj = categories.find(c => c.id === categoryId);
      const catId = categoryId || 'sem-categoria';
      const catName = catObj?.name || 'Sem Categoria';
      const catColor = catObj?.color || '#94a3b8';
      const catType = t.type;

      if (!group.categoryMap[catId]) {
        group.categoryMap[catId] = {
          categoryId: catId,
          categoryName: catName,
          categoryColor: catColor,
          total: 0,
          transactionCount: 0,
          type: catType
        };
      }
      group.categoryMap[catId].total += t.amount;
      group.categoryMap[catId].transactionCount += 1;
    });

    // Calculate outcomes
    Object.values(grouped).forEach(g => {
      g.resultado = g.totalReceita - g.totalDespesa;
    });

    // Overall metrics for KPIs & percentages
    const overallTotalDespesas = Object.values(grouped).reduce((sum, g) => sum + g.totalDespesa, 0);
    const overallTotalReceitas = Object.values(grouped).reduce((sum, g) => sum + g.totalReceita, 0);
    const overallResultadoLiquido = overallTotalReceitas - overallTotalDespesas;

    // Filter and sort groups
    const sortedGroups = Object.values(grouped)
      .filter(g => {
        if (centroCustoTab === 'despesas') return g.totalDespesa > 0;
        if (centroCustoTab === 'receitas') return g.totalReceita > 0;
        return true; // 'todos'
      })
      .sort((a, b) => {
        if (centroCustoTab === 'receitas') {
          return b.totalReceita - a.totalReceita;
        }
        return b.totalDespesa - a.totalDespesa;
      });

    return (
      <div className="space-y-8">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {/* Card: Despesas */}
          <div className="bg-rose-50/60 border border-rose-100 p-6 rounded-3xl shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-black text-rose-800/60 uppercase tracking-widest">Total Despesas</span>
              <span className="p-1.5 bg-rose-100/80 rounded-xl text-rose-700">
                <ArrowDownRight size={16} />
              </span>
            </div>
            <div className="mt-4">
              <h3 className="text-2xl font-black text-rose-950">{formatCurrency(overallTotalDespesas)}</h3>
              <p className="text-[10px] text-rose-700/80 font-bold uppercase tracking-wider mt-1">Soma de todos os centros de custo</p>
            </div>
          </div>

          {/* Card: Receitas */}
          <div className="bg-emerald-50/60 border border-emerald-100 p-6 rounded-3xl shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-black text-emerald-800/60 uppercase tracking-widest">Total Receitas</span>
              <span className="p-1.5 bg-emerald-100/80 rounded-xl text-emerald-700">
                <ArrowUpRight size={16} />
              </span>
            </div>
            <div className="mt-4">
              <h3 className="text-2xl font-black text-emerald-950">{formatCurrency(overallTotalReceitas)}</h3>
              <p className="text-[10px] text-emerald-700/80 font-bold uppercase tracking-wider mt-1">Soma de todos os centros de custo</p>
            </div>
          </div>

          {/* Card: Resultado Líquido */}
          <div className={`${overallResultadoLiquido >= 0 ? 'bg-emerald-50/60 border-emerald-100' : 'bg-rose-50/60 border-rose-100'} p-6 rounded-3xl shadow-sm flex flex-col justify-between`}>
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-black text-slate-800/60 uppercase tracking-widest">Resultado Líquido</span>
              <span className={`p-1.5 rounded-xl ${overallResultadoLiquido >= 0 ? 'bg-emerald-100/80 text-emerald-700' : 'bg-rose-100/80 text-rose-700'}`}>
                <Activity size={16} />
              </span>
            </div>
            <div className="mt-4">
              <h3 className={`text-2xl font-black ${overallResultadoLiquido >= 0 ? 'text-emerald-950' : 'text-rose-950'}`}>{formatCurrency(overallResultadoLiquido)}</h3>
              <p className="text-[10px] text-slate-700/80 font-bold uppercase tracking-wider mt-1">Receitas menos despesas</p>
            </div>
          </div>
        </div>

        {/* Tabs Filter */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex gap-4">
            {([
              { id: 'todos', label: 'Todos' },
              { id: 'despesas', label: 'Despesas' },
              { id: 'receitas', label: 'Receitas' }
            ] as const).map(tab => (
              <button
                key={tab.id}
                onClick={() => setCentroCustoTab(tab.id)}
                className={`pb-3 text-sm font-black uppercase tracking-wider border-b-2 px-4 transition-all cursor-pointer ${
                  centroCustoTab === tab.id ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Groups List */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {sortedGroups.length === 0 ? (
            <div className="col-span-full bg-white rounded-3xl border border-slate-100 p-12 shadow-sm text-center flex flex-col items-center justify-center space-y-4">
              <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center shadow-inner animate-pulse">
                <Layers size={32} />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-black text-slate-800">Nenhum centro de custo</h3>
                <p className="text-sm text-slate-400 font-medium">Nenhum lançamento com grupo de categoria no período.</p>
              </div>
            </div>
          ) : (
            sortedGroups.map((g, idx) => {
              const totalForPercent = (centroCustoTab === 'receitas') ? overallTotalReceitas : overallTotalDespesas;
              const groupValueForPercent = (centroCustoTab === 'receitas') ? g.totalReceita : g.totalDespesa;
              const percent = totalForPercent > 0 ? (groupValueForPercent / totalForPercent) * 100 : 0;
              const roundedPercent = Math.round(percent * 10) / 10;

              // Filter category list inside the group based on active tab
              const groupCats = Object.values(g.categoryMap).filter(cat => {
                if (centroCustoTab === 'despesas') return cat.type === TransactionType.EXPENSE;
                if (centroCustoTab === 'receitas') return cat.type === TransactionType.INCOME;
                return true;
              });

              // Sort categories in the list by highest total descending
              groupCats.sort((a, b) => b.total - a.total);

              return (
                <div key={idx} className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-all duration-300">
                  <div className="space-y-5">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="p-2 bg-slate-50 rounded-xl text-slate-700">
                          <Layers size={16} />
                        </span>
                        <h4 className="text-base font-black text-slate-900 tracking-tight">{g.groupName}</h4>
                      </div>
                      <span className="bg-slate-100 text-slate-700 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border border-slate-200">
                        {g.transactions.length} {g.transactions.length === 1 ? 'Lançamento' : 'Lançamentos'}
                      </span>
                    </div>

                    {/* Totals Sub-grid */}
                    <div className="grid grid-cols-3 gap-2 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                      <div>
                        <span className="text-[8px] font-black text-rose-800/60 uppercase tracking-widest block">Despesas</span>
                        <span className="text-xs font-bold text-rose-700 mt-1 block">{formatCurrency(g.totalDespesa)}</span>
                      </div>
                      <div>
                        <span className="text-[8px] font-black text-emerald-800/60 uppercase tracking-widest block">Receitas</span>
                        <span className="text-xs font-bold text-emerald-700 mt-1 block">{formatCurrency(g.totalReceita)}</span>
                      </div>
                      <div>
                        <span className="text-[8px] font-black text-slate-800/60 uppercase tracking-widest block">Resultado</span>
                        <span className={`text-xs font-bold mt-1 block ${g.resultado >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {formatCurrency(g.resultado)}
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-500">
                        <span>Representação no Total</span>
                        <span>{roundedPercent}%</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${centroCustoTab === 'receitas' ? 'bg-emerald-500' : 'bg-rose-500'}`} 
                          style={{ width: `${Math.min(100, roundedPercent)}%` }} 
                        />
                      </div>
                    </div>

                    {/* Category List */}
                    <div className="space-y-2.5 pt-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Distribuição por Categoria</span>
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {groupCats.map((cat, cIdx) => (
                          <div key={cIdx} className="flex items-center justify-between py-2 px-3 bg-slate-50/30 rounded-xl hover:bg-slate-50 border border-slate-100/60 transition-all text-xs">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.categoryColor }} />
                              <span className="font-bold text-slate-700">{cat.categoryName}</span>
                              <span className="text-[9px] text-slate-400 font-bold">({cat.transactionCount})</span>
                            </div>
                            <span className={`font-black ${cat.type === TransactionType.INCOME ? 'text-emerald-700' : 'text-slate-800'}`}>
                              {cat.type === TransactionType.INCOME ? '+' : '-'} {formatCurrency(cat.total)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  const handleExportFinanceiroXLSX = () => {
    const todayStr = getLocalTodayStr();
    const headers = [
      'Data Vencimento',
      'Data Pagamento',
      'Descrição',
      'Tipo (Receita/Despesa)',
      'Categoria',
      'Centro de Custo',
      'Conta Bancária',
      'Valor',
      'Status (Pago/Pendente/Vencido)'
    ];

    const rows = filteredTransactions.map(tx => {
      const catObj = categories.find(c => c.id === tx.category_id);
      const categoryName = catObj?.name || 'Sem Categoria';
      const groupName = (tx.category_id && categoryGroups[tx.category_id]) ? categoryGroups[tx.category_id].trim() : 'Sem Centro de Custo';
      const accountName = accounts.find(a => a.id === tx.account_id)?.name || 'Sem Conta';
      
      let statusLabel = 'Pendente';
      if (tx.status === TransactionStatus.PAID) {
        statusLabel = 'Pago';
      } else if (tx.status === TransactionStatus.PENDING && tx.due_date < todayStr) {
        statusLabel = 'Vencido';
      }

      // Format Date dd/mm/aaaa
      const formatDateBR = (dateStr: string | null | undefined) => {
        if (!dateStr) return '';
        const parts = dateStr.split('-');
        if (parts.length !== 3) return dateStr;
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      };

      const valStr = tx.amount.toFixed(2).replace('.', ',');

      return [
        formatDateBR(tx.due_date),
        formatDateBR(tx.payment_date),
        tx.description,
        tx.type === TransactionType.INCOME ? 'Receita' : 'Despesa',
        categoryName,
        groupName,
        accountName,
        valStr,
        statusLabel
      ];
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Extrato');
    
    const formattedMonth = String(currentPeriod.getMonth() + 1).padStart(2, '0');
    const formattedYear = currentPeriod.getFullYear();
    XLSX.writeFile(wb, `extrato_financeiro_${formattedMonth}_${formattedYear}.xlsx`);
  };

  const handleExportCentroCustoXLSX = () => {
    const periodTransactions = transactions.filter(t => {
      if (!t.due_date) return false;
      const parts = t.due_date.split('-');
      if (parts.length < 2) return false;
      const txYear = parseInt(parts[0], 10);
      const txMonth = parseInt(parts[1], 10) - 1;
      return txYear === currentPeriod.getFullYear() && txMonth === currentPeriod.getMonth();
    });

    const grouped: Record<string, {
      groupName: string;
      totalReceita: number;
      totalDespesa: number;
      resultado: number;
      categoryMap: Record<string, {
        categoryName: string;
        type: TransactionType;
        total: number;
        transactionCount: number;
      }>;
    }> = {};

    periodTransactions.forEach(t => {
      const categoryId = t.category_id || '';
      const groupName = (categoryId && categoryGroups[categoryId]) ? categoryGroups[categoryId].trim() : 'Sem Centro de Custo';

      if (!grouped[groupName]) {
        grouped[groupName] = {
          groupName,
          totalReceita: 0,
          totalDespesa: 0,
          resultado: 0,
          categoryMap: {}
        };
      }

      const group = grouped[groupName];

      if (t.type === TransactionType.INCOME) {
        group.totalReceita += t.amount;
      } else if (t.type === TransactionType.EXPENSE) {
        group.totalDespesa += t.amount;
      }

      const catObj = categories.find(c => c.id === categoryId);
      const catId = categoryId || 'sem-categoria';
      const catName = catObj?.name || 'Sem Categoria';

      if (!group.categoryMap[catId]) {
        group.categoryMap[catId] = {
          categoryName: catName,
          type: t.type,
          total: 0,
          transactionCount: 0
        };
      }
      group.categoryMap[catId].total += t.amount;
      group.categoryMap[catId].transactionCount += 1;
    });

    // Calculate outcomes
    Object.values(grouped).forEach(g => {
      g.resultado = g.totalReceita - g.totalDespesa;
    });

    const rows: any[][] = [];

    // Seção 1 — Resumo por Centro de Custo
    rows.push(['SEÇÃO 1 - RESUMO POR CENTRO DE CUSTO']);
    rows.push(['Centro de Custo', 'Total Receitas', 'Total Despesas', 'Resultado']);
    
    Object.values(grouped).forEach(g => {
      rows.push([
        g.groupName,
        g.totalReceita.toFixed(2).replace('.', ','),
        g.totalDespesa.toFixed(2).replace('.', ','),
        g.resultado.toFixed(2).replace('.', ',')
      ]);
    });

    rows.push([]);
    rows.push([]);

    // Seção 2 — Detalhe por Categoria
    rows.push(['SEÇÃO 2 - DETALHE POR CATEGORIA']);
    rows.push(['Centro de Custo', 'Categoria', 'Tipo', 'Total', 'Qtd Lançamentos']);

    Object.values(grouped).forEach(g => {
      Object.values(g.categoryMap).forEach(cat => {
        rows.push([
          g.groupName,
          cat.categoryName,
          cat.type === TransactionType.INCOME ? 'Receita' : 'Despesa',
          cat.total.toFixed(2).replace('.', ','),
          cat.transactionCount
        ]);
      });
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Centro de Custo');

    const formattedMonth = String(currentPeriod.getMonth() + 1).padStart(2, '0');
    const formattedYear = currentPeriod.getFullYear();
    XLSX.writeFile(wb, `centro_custo_${formattedMonth}_${formattedYear}.xlsx`);
  };

  const handleExportFinanceiroPDF = () => {
    const printDiv = document.createElement('div');
    printDiv.className = 'print-container p-8 text-slate-800 font-sans';
    
    const style = document.createElement('style');
    style.innerHTML = `
      @media print {
        body > *:not(.print-container) {
          display: none !important;
        }
        .print-container {
          display: block !important;
          width: 100% !important;
          font-family: system-ui, -apple-system, sans-serif !important;
        }
        @page {
          margin: 1.5cm;
        }
      }
    `;
    document.head.appendChild(style);

    const formattedPeriod = `${String(currentPeriod.getMonth() + 1).padStart(2, '0')}/${currentPeriod.getFullYear()}`;
    const todayStr = getLocalTodayStr();

    let totalReceitas = 0;
    let totalDespesas = 0;

    const formatDateBR = (dateStr: string | null | undefined) => {
      if (!dateStr) return '';
      const parts = dateStr.split('-');
      if (parts.length !== 3) return dateStr;
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    };

    const rowsHtml = filteredTransactions.map(tx => {
      const catObj = categories.find(c => c.id === tx.category_id);
      const categoryName = catObj?.name || 'Sem Categoria';
      const groupName = (tx.category_id && categoryGroups[tx.category_id]) ? categoryGroups[tx.category_id].trim() : 'Sem Centro de Custo';
      const accountName = accounts.find(a => a.id === tx.account_id)?.name || 'Sem Conta';
      
      let statusLabel = 'Pendente';
      if (tx.status === TransactionStatus.PAID) {
        statusLabel = 'Pago';
      } else if (tx.status === TransactionStatus.PENDING && tx.due_date < todayStr) {
        statusLabel = 'Vencido';
      }

      if (tx.type === TransactionType.INCOME) {
        totalReceitas += tx.amount;
      } else {
        totalDespesas += tx.amount;
      }

      return `
        <tr style="border-bottom: 1px solid #e2e8f0; font-size: 10px;">
          <td style="padding: 6px; white-space: nowrap;">${formatDateBR(tx.due_date)}</td>
          <td style="padding: 6px; white-space: nowrap;">${formatDateBR(tx.payment_date) || '-'}</td>
          <td style="padding: 6px; font-weight: 500;">${tx.description}</td>
          <td style="padding: 6px; color: ${tx.type === TransactionType.INCOME ? '#047857' : '#b91c1c'}; font-weight: bold;">
            ${tx.type === TransactionType.INCOME ? 'Receita' : 'Despesa'}
          </td>
          <td style="padding: 6px;">${categoryName}</td>
          <td style="padding: 6px;">${groupName}</td>
          <td style="padding: 6px;">${accountName}</td>
          <td style="padding: 6px; text-align: right; font-weight: bold;">${formatCurrency(tx.amount)}</td>
          <td style="padding: 6px; font-weight: bold;">${statusLabel}</td>
        </tr>
      `;
    }).join('');

    const saldo = totalReceitas - totalDespesas;

    printDiv.innerHTML = `
      <div style="border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-end;">
          <div>
            <h1 style="font-size: 20px; font-weight: 900; color: #0f172a; margin: 0; letter-spacing: -0.025em;">
              Fidelité Negócios Imobiliários
            </h1>
            <p style="font-size: 12px; font-weight: 600; color: #64748b; margin: 4px 0 0 0;">
              Extrato Financeiro Completo
            </p>
          </div>
          <div style="text-align: right;">
            <p style="font-size: 11px; font-weight: 700; color: #475569; margin: 0;">Período: ${formattedPeriod}</p>
            <p style="font-size: 9px; font-weight: 500; color: #94a3b8; margin: 2px 0 0 0;">Gerado em: ${new Date().toLocaleDateString('pt-BR')}</p>
          </div>
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 32px;">
        <thead>
          <tr style="border-bottom: 2px solid #94a3b8; text-align: left; background-color: #f8fafc; font-size: 10px; font-weight: 800; color: #1e293b;">
            <th style="padding: 8px;">Vencimento</th>
            <th style="padding: 8px;">Pagamento</th>
            <th style="padding: 8px;">Descrição</th>
            <th style="padding: 8px;">Tipo</th>
            <th style="padding: 8px;">Categoria</th>
            <th style="padding: 8px;">Centro de Custo</th>
            <th style="padding: 8px;">Conta</th>
            <th style="padding: 8px; text-align: right;">Valor</th>
            <th style="padding: 8px;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || '<tr><td colspan="9" style="text-align: center; padding: 24px; color: #94a3b8;">Nenhuma transação encontrada para este período.</td></tr>'}
        </tbody>
      </table>

      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-top: 24px; page-break-inside: avoid;">
        <h3 style="font-size: 12px; font-weight: 800; color: #0f172a; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 0.05em;">Resumo de Totais</h3>
        <div style="display: flex; justify-content: space-between; gap: 16px;">
          <div style="flex: 1;">
            <span style="font-size: 9px; font-weight: 800; color: #64748b; text-transform: uppercase; tracking-wider: 0.05em; display: block;">Total Receitas</span>
            <span style="font-size: 14px; font-weight: 900; color: #047857; margin-top: 4px; display: block;">${formatCurrency(totalReceitas)}</span>
          </div>
          <div style="flex: 1; border-left: 1px solid #e2e8f0; padding-left: 16px;">
            <span style="font-size: 9px; font-weight: 800; color: #64748b; text-transform: uppercase; tracking-wider: 0.05em; display: block;">Total Despesas</span>
            <span style="font-size: 14px; font-weight: 900; color: #b91c1c; margin-top: 4px; display: block;">${formatCurrency(totalDespesas)}</span>
          </div>
          <div style="flex: 1; border-left: 1px solid #e2e8f0; padding-left: 16px;">
            <span style="font-size: 9px; font-weight: 800; color: #64748b; text-transform: uppercase; tracking-wider: 0.05em; display: block;">Saldo Líquido</span>
            <span style="font-size: 14px; font-weight: 900; color: ${saldo >= 0 ? '#047857' : '#b91c1c'}; margin-top: 4px; display: block;">${formatCurrency(saldo)}</span>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(printDiv);
    window.print();
    document.body.removeChild(printDiv);
    document.head.removeChild(style);
  };

  const renderRelatorios = () => {
    // Filter transactions in current period using due_date
    const periodTransactions = transactions.filter(t => {
      if (!t.due_date) return false;
      const parts = t.due_date.split('-');
      if (parts.length < 2) return false;
      const txYear = parseInt(parts[0], 10);
      const txMonth = parseInt(parts[1], 10) - 1;
      return txYear === currentPeriod.getFullYear() && txMonth === currentPeriod.getMonth();
    });

    const todayStr = getLocalTodayStr();

    // Calculate metrics
    const totalReceitasPagas = periodTransactions
      .filter(t => t.type === TransactionType.INCOME && t.status === TransactionStatus.PAID)
      .reduce((sum, t) => sum + t.amount, 0);

    const totalDespesasPagas = periodTransactions
      .filter(t => t.type === TransactionType.EXPENSE && t.status === TransactionStatus.PAID)
      .reduce((sum, t) => sum + t.amount, 0);

    const saldoRealizado = totalReceitasPagas - totalDespesasPagas;

    const totalPendente = periodTransactions
      .filter(t => t.status === TransactionStatus.PENDING)
      .reduce((sum, t) => sum + t.amount, 0);

    // Latest 20 transactions sorted by due_date desc
    const latestTransactions = [...periodTransactions]
      .sort((a, b) => b.due_date.localeCompare(a.due_date))
      .slice(0, 20);

    const formatDateBR = (dateStr: string | null | undefined) => {
      if (!dateStr) return '';
      const parts = dateStr.split('-');
      if (parts.length !== 3) return dateStr;
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    };

    return (
      <div className="space-y-8">
        {/* KPI Cards (4 cards) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card: Receitas Pagas */}
          <div className="bg-emerald-50/60 border border-emerald-100 p-5 rounded-3xl shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-black text-emerald-800/60 uppercase tracking-widest">Receitas Recebidas</span>
              <span className="p-1.5 bg-emerald-100/80 rounded-xl text-emerald-700">
                <ArrowUpRight size={16} />
              </span>
            </div>
            <div className="mt-4">
              <h3 className="text-xl font-black text-emerald-950">{formatCurrency(totalReceitasPagas)}</h3>
              <p className="text-[9px] text-emerald-700/80 font-bold uppercase tracking-wider mt-1">Realizado (Pago) no período</p>
            </div>
          </div>

          {/* Card: Despesas Pagas */}
          <div className="bg-rose-50/60 border border-rose-100 p-5 rounded-3xl shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-black text-rose-800/60 uppercase tracking-widest">Despesas Pagas</span>
              <span className="p-1.5 bg-rose-100/80 rounded-xl text-rose-700">
                <ArrowDownRight size={16} />
              </span>
            </div>
            <div className="mt-4">
              <h3 className="text-xl font-black text-rose-950">{formatCurrency(totalDespesasPagas)}</h3>
              <p className="text-[9px] text-rose-700/80 font-bold uppercase tracking-wider mt-1">Realizado (Pago) no período</p>
            </div>
          </div>

          {/* Card: Saldo Realizado */}
          <div className={`${saldoRealizado >= 0 ? 'bg-sky-50/60 border-sky-100' : 'bg-rose-50/60 border-rose-100'} p-5 rounded-3xl shadow-sm flex flex-col justify-between`}>
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-black text-slate-800/60 uppercase tracking-widest">Saldo Realizado</span>
              <span className={`p-1.5 rounded-xl ${saldoRealizado >= 0 ? 'bg-sky-100/80 text-sky-700' : 'bg-rose-100/80 text-rose-700'}`}>
                <Activity size={16} />
              </span>
            </div>
            <div className="mt-4">
              <h3 className={`text-xl font-black ${saldoRealizado >= 0 ? 'text-sky-950' : 'text-rose-950'}`}>{formatCurrency(saldoRealizado)}</h3>
              <p className="text-[9px] text-slate-700/80 font-bold uppercase tracking-wider mt-1">Receitas pagas menos despesas pagas</p>
            </div>
          </div>

          {/* Card: Total Pendente */}
          <div className="bg-amber-50/60 border border-amber-100 p-5 rounded-3xl shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-black text-amber-800/60 uppercase tracking-widest">Total Pendente</span>
              <span className="p-1.5 bg-amber-100/80 rounded-xl text-amber-700">
                <Clock size={16} />
              </span>
            </div>
            <div className="mt-4">
              <h3 className="text-xl font-black text-amber-950">{formatCurrency(totalPendente)}</h3>
              <p className="text-[9px] text-amber-700/80 font-bold uppercase tracking-wider mt-1">Todos a pagar e receber pendentes</p>
            </div>
          </div>
        </div>

        {/* Export Buttons */}
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
          <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-4">Exportações Disponíveis</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={handleExportFinanceiroXLSX}
              className="px-5 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-sm transition-all flex items-center justify-center gap-2.5 cursor-pointer hover:shadow-md active:scale-[0.98]"
            >
              <FileDown size={16} />
              Exportar Extrato Excel
            </button>
            <button
              onClick={handleExportFinanceiroPDF}
              className="px-5 py-4 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-sm transition-all flex items-center justify-center gap-2.5 cursor-pointer hover:shadow-md active:scale-[0.98]"
            >
              <FileText size={16} />
              Exportar PDF (Imprimir)
            </button>
            <button
              onClick={handleExportCentroCustoXLSX}
              className="px-5 py-4 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-sm transition-all flex items-center justify-center gap-2.5 cursor-pointer hover:shadow-md active:scale-[0.98]"
            >
              <Layers size={16} />
              Exportar Centro de Custo Excel
            </button>
          </div>
        </div>

        {/* Preview Table */}
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider">
              Prévia do Extrato do Mês <span className="text-slate-400">({latestTransactions.length} lançamentos)</span>
            </h4>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-4">Data Venc.</th>
                  <th className="py-3 px-4">Descrição</th>
                  <th className="py-3 px-4">Categoria</th>
                  <th className="py-3 px-4 text-right">Valor</th>
                  <th className="py-3 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {latestTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-xs text-slate-400 font-medium">
                      Nenhum lançamento encontrado para o mês selecionado.
                    </td>
                  </tr>
                ) : (
                  latestTransactions.map((tx) => {
                    const catObj = categories.find(c => c.id === tx.category_id);
                    const categoryName = catObj?.name || 'Sem Categoria';
                    const categoryColor = catObj?.color || '#cbd5e1';
                    
                    let statusStyle = 'bg-amber-50 text-amber-700 border-amber-100';
                    let statusLabel = 'Pendente';
                    if (tx.status === TransactionStatus.PAID) {
                      statusStyle = 'bg-emerald-50 text-emerald-700 border-emerald-100';
                      statusLabel = 'Pago';
                    } else if (tx.status === TransactionStatus.PENDING && tx.due_date < todayStr) {
                      statusStyle = 'bg-rose-50 text-rose-700 border-rose-100';
                      statusLabel = 'Vencido';
                    }

                    return (
                      <tr key={tx.id} className="text-xs hover:bg-slate-50/50 transition-colors">
                        <td className="py-3.5 px-4 text-slate-500 font-medium whitespace-nowrap">
                          {formatDateBR(tx.due_date)}
                        </td>
                        <td className="py-3.5 px-4 text-slate-800 font-bold max-w-xs truncate">
                          {tx.description}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: categoryColor }} />
                            <span className="text-slate-600 font-medium">{categoryName}</span>
                          </div>
                        </td>
                        <td className={`py-3.5 px-4 text-right font-bold whitespace-nowrap ${tx.type === TransactionType.INCOME ? 'text-emerald-700' : 'text-slate-800'}`}>
                          {tx.type === TransactionType.INCOME ? '+' : '-'} {formatCurrency(tx.amount)}
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${statusStyle}`}>
                            {statusLabel}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
          {cardAccounts.map((card, idx) => {
            const limit = card.credit_limit || 25000;
            const openInvoices = Math.abs(getAccountLiveBalance(card));
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
    if (accounts.length === 0) {
      return (
        <div className="bg-white rounded-3xl border border-slate-100 p-12 shadow-sm text-center flex flex-col items-center justify-center space-y-4">
          <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center shadow-inner">
            <Wallet size={32} />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-black text-slate-800">Nenhuma conta bancária cadastrada</h3>
            <p className="text-sm text-slate-400 font-medium">Cadastre contas para realizar e controlar os lançamentos financeiros.</p>
          </div>
          <button 
            onClick={() => {
              setModalType('account');
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 bg-slate-900 text-white rounded-xl px-5 py-2.5 text-sm font-bold hover:bg-slate-800 transition-all shadow-md cursor-pointer"
          >
            <Plus size={16} /> Adicionar Conta
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
          {accounts.map(account => {
            const liveBalance = getAccountLiveBalance(account);
            const bank = BANKS.find(b => b.code === (account as any).bank_code);
            const initials = bank ? bank.initials : 'BC';
            const bankName = bank ? bank.name : 'Banco';
            const bankColor = bank ? bank.color : '#64748b';

            return (
              <div key={account.id} className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
                <div>
                  {/* 1. Cabeçalho */}
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
                    <span className="px-2 py-0.5 rounded-full bg-slate-50 border border-slate-100 text-[9px] font-extrabold uppercase text-slate-400 tracking-wider">
                      {account.is_default ? 'Principal' : (account.type?.toUpperCase() === 'CREDIT_CARD' || account.type === 'credit_card' ? 'Cartão' : account.type || 'Conta')}
                    </span>
                  </div>

                  {/* 2. Nome da conta */}
                  <div className="mb-4">
                    <h4 className="text-base font-black text-slate-800 leading-tight">{account.name}</h4>
                  </div>
                </div>

                <div>
                  {/* 3. Saldo */}
                  <div className="bg-slate-50/50 rounded-xl p-3 border border-slate-100/50 mb-4">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">
                      Saldo da Conta
                    </span>
                    <p className="text-xl font-black text-slate-900 mt-0.5">{formatCurrency(liveBalance)}</p>
                  </div>

                  {/* 4. Rodapé */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="flex items-center gap-1 text-[9px] font-extrabold text-emerald-600 uppercase tracking-wider bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100/80">
                      <Check size={10} /> Conciliada
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button 
                        onClick={() => handleEditAccountClick(account)}
                        className="flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors p-1.5 rounded-lg cursor-pointer"
                        title="Editar Conta"
                      >
                        <Pencil size={11} /> <span className="sr-only sm:not-sr-only">Editar</span>
                      </button>
                      <button 
                        onClick={() => handleDeleteAccount(account.id)}
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
      </div>
    );
  };

  // 5. View: Conciliação Bancária (Statement Matching Tool)
  const renderConciliacao = () => {
    // Dynamic KPI Calculations
    const importedBalance = reconciliationItems.reduce((acc, item) => {
      return acc + (item.type === TransactionType.INCOME ? item.amount : -item.amount);
    }, 0);

    const systemBalance = transactions.reduce((acc, tx) => {
      return acc + (tx.type === TransactionType.INCOME ? tx.amount : -tx.amount);
    }, 0);

    const totalImportedAmt = reconciliationItems.reduce((acc, item) => acc + item.amount, 0);
    const conciliatedAmt = reconciliationItems.filter(item => item.matched).reduce((acc, item) => acc + item.amount, 0);
    const pendingAmt = reconciliationItems.filter(item => !item.matched).reduce((acc, item) => acc + item.amount, 0);
    const diffAmt = totalImportedAmt - conciliatedAmt;

    const countConciliated = reconciliationItems.filter(item => item.matched).length;
    const countPending = reconciliationItems.filter(item => !item.matched).length;

    // Active item selected from the left side (statement)
    const activeImportedItem = selectedImportedIndex !== null ? reconciliationItems[selectedImportedIndex] : null;

    // Filter candidate system transactions (not matched in DB, and not prepared in local batch list)
    const availableSystemTxs = transactions.filter(t => {
      const isPending = t.status === TransactionStatus.PENDING;
      const isMatchedInDb = matchedPairs.some(p => p.systemId === t.id);
      const itemKey = activeImportedItem ? (activeImportedItem.id || activeImportedItem.external_id || `temp-${selectedImportedIndex}`) : '';
      const isPreparedInBatchForSomeoneElse = selectedMatches.some(m => m.transaction_id === t.id && m.reconciliation_id !== itemKey);
      return isPending && !isMatchedInDb && !isPreparedInBatchForSomeoneElse;
    });

    // Calculate score for each candidate if activeImportedItem is loaded
    let candidateTxs: Array<{ tx: any; score: number }> = [];
    if (activeImportedItem) {
      candidateTxs = availableSystemTxs.map(tx => {
        const score = calculateMatchScore(activeImportedItem, tx);
        return { tx, score };
      });
    }

    // Filter displayed transactions based on search or compatibility score (> 0)
    let displayedSystemTxs: Array<{ tx: any; score: number }> = [];
    if (reconciliationSearch.trim() !== '') {
      const query = reconciliationSearch.toLowerCase().trim();
      displayedSystemTxs = candidateTxs.filter(({ tx }) => {
        const descMatch = (tx.description || '').toLowerCase().includes(query);
        const amtMatch = String(tx.amount).includes(query);
        const dateMatch = (tx.due_date || '').includes(query);
        return descMatch || amtMatch || dateMatch;
      });
    } else {
      displayedSystemTxs = candidateTxs.filter(({ score }) => score > 0);
    }

    // Sort displayed transactions by score descending
    displayedSystemTxs.sort((a, b) => b.score - a.score);

    // Active suggestions (only scores > 0)
    const suggestions = candidateTxs.filter(({ score }) => score > 0).sort((a, b) => b.score - a.score);

    // Selected system transaction (either via click on suggestion or right column item)
    const selectedSystemTx = selectedSystemTxId ? transactions.find(t => t.id === selectedSystemTxId) : null;
    let manualCompatibilityScore = 0;
    if (activeImportedItem && selectedSystemTx) {
      manualCompatibilityScore = calculateMatchScore(activeImportedItem, selectedSystemTx);
    }

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (file) {
        handleBankFileUpload(file);
      }
    };

    const totalImportedCount = reconciliationItems.length;
    const progressPercent = totalImportedCount > 0 ? Math.round((countConciliated / totalImportedCount) * 100) : 0;

    return (
      <div className="space-y-6">
        {/* Dynamic Conciliation Dashboard */}
        <div className="space-y-4">
          {/* First Row: 4 Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm text-center flex flex-col justify-center min-h-[110px]">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Movimentado</p>
              <p className="text-lg font-black text-slate-800">{formatCurrency(totalImportedAmt || 0)}</p>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">Soma absoluta das transações</p>
            </div>
            
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm text-center flex flex-col justify-center min-h-[110px]">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Conciliados</p>
              <p className="text-lg font-black text-emerald-600">{formatCurrency(conciliatedAmt || 0)}</p>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">{(countConciliated || 0)} lançamentos vinculados</p>
            </div>
            
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm text-center flex flex-col justify-center min-h-[110px]">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Pendentes</p>
              <p className="text-lg font-black text-amber-600">{formatCurrency(pendingAmt || 0)}</p>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">{(countPending || 0)} itens pendentes</p>
            </div>
            
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm text-center flex flex-col justify-between min-h-[110px]">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Progresso de Conciliação</p>
                <p className={`text-lg font-black ${
                  (progressPercent || 0) >= 80 ? 'text-emerald-600' : (progressPercent || 0) >= 50 ? 'text-amber-600' : 'text-rose-600'
                }`}>{(progressPercent || 0)}%</p>
                <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                  {(countConciliated || 0)} de {(totalImportedCount || 0)} itens
                </p>
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full mt-1.5 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    (progressPercent || 0) >= 80 ? 'bg-emerald-500' : (progressPercent || 0) >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                  }`}
                  style={{ width: `${progressPercent || 0}%` }}
                />
              </div>
            </div>
          </div>

          {/* Second Row: 3 Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm text-center flex flex-col justify-center min-h-[90px]">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Saldo Banco</p>
              <p className={`text-lg font-black ${(importedBalance || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {formatCurrency(importedBalance || 0)}
              </p>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">Saldo líquido do extrato</p>
            </div>
            
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm text-center flex flex-col justify-center min-h-[90px]">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Saldo ERP</p>
              <p className="text-lg font-black text-slate-800">{formatCurrency(systemBalance || 0)}</p>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">Saldo de lançamentos ERP</p>
            </div>
            
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm text-center flex flex-col justify-center min-h-[90px]">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Diferença</p>
              <p className={`text-lg font-black ${Math.abs(diffAmt || 0) < 0.01 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {formatCurrency(diffAmt || 0)}
              </p>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">Diferença entre banco e ERP</p>
            </div>
          </div>
        </div>

        {/* Workspace Layout */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-6">
            <div>
              <p className="text-xs text-slate-400 font-medium">Selecione lançamentos para realizar o vínculo ou crie novos em lote.</p>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              {importedFile && selectedMatches.length > 0 && (
                <button
                  onClick={handleBatchConciliate}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black rounded-lg transition-all shadow-sm animate-pulse"
                  title="Confirmar e salvar todas as conciliações preparadas no banco"
                >
                  <CheckCircle2 size={13} />
                  Conciliar Selecionados ({selectedMatches.length})
                </button>
              )}
              {importedFile && (
                <button
                  onClick={handleAutoConciliateAll}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-lg transition-all shadow-sm"
                  title="Conciliar automaticamente itens com alta confiança (≥85%)"
                >
                  <Zap size={13} />
                  Conciliar automaticamente
                </button>
              )}
              {importedFile && (
                <button 
                  onClick={handleAutoConciliation}
                  className="flex items-center gap-1.5 bg-emerald-600 text-white rounded-lg px-3 py-1.5 text-xs font-black hover:bg-emerald-700 transition-all shadow-sm cursor-pointer"
                >
                  <Sparkles size={13} /> Auto-Conciliar Inteligente
                </button>
              )}
              {importedFile && (
                <button 
                  onClick={() => {
                    setImportedFile(null);
                    setReconciliationItems([]);
                    setSelectedImportedIndex(null);
                    setSelectedSystemTxId(null);
                    setOfxBankName(null);
                    setOfxAgency(null);
                    setOfxAccount(null);
                    setOfxPeriod(null);
                    setReconciliationPeriodFilter('all');
                    setReconciliationStartDate('');
                    setReconciliationEndDate('');
                    setSelectedMatches([]);
                    setReconciliationSearch('');
                    setShowQuickCreateForm(false);
                  }}
                  className="flex items-center gap-1 bg-slate-100 text-slate-600 rounded-lg px-2.5 py-1.5 text-xs font-bold hover:bg-slate-200 transition-all cursor-pointer"
                  title="Trocar Extrato"
                >
                  <Trash2 size={12} /> Limpar
                </button>
              )}
            </div>
          </div>

          {!importedFile ? (
            <div
              className="border-2 border-dashed border-indigo-200 bg-indigo-50/30
                         rounded-3xl p-10 text-center cursor-pointer
                         hover:border-indigo-400 hover:bg-indigo-50/60 transition-all relative"
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
            >
              <label htmlFor="bank-file-upload" className="absolute inset-0 cursor-pointer z-10" />
              <input 
                id="bank-file-upload"
                type="file" 
                accept=".ofx,.csv" 
                className="hidden" 
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleBankFileUpload(file);
                  e.target.value = '';
                }}
              />
              <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center
                              justify-center mx-auto mb-4 relative z-20 pointer-events-none">
                <Upload size={28} className="text-indigo-600" />
              </div>
              <p className="text-sm font-black text-slate-700 mb-1 relative z-20 pointer-events-none">
                👉 Clique ou arraste arquivos aqui para importar
              </p>
              <p className="text-xs text-slate-400 font-medium relative z-20 pointer-events-none">
                Suporta OFX e CSV de qualquer banco
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              {/* 1. Left Column: Statement Items */}
              <div className="xl:col-span-3 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    Extrato Bancário
                  </span>
                  <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded font-bold text-slate-500">
                    {reconciliationItems.length} itens
                  </span>
                </div>

                {/* Filtro de Periodo do Extrato */}
                <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Filtrar Lançamentos</span>
                    <select 
                      value={reconciliationPeriodFilter}
                      onChange={(e) => setReconciliationPeriodFilter(e.target.value as any)}
                      className="text-xs bg-slate-50 border border-slate-100 rounded-lg p-1 outline-none text-slate-700 font-medium"
                    >
                      <option value="all">Todos</option>
                      <option value="today">Hoje</option>
                      <option value="7days">Últimos 7 dias</option>
                      <option value="30days">Últimos 30 dias</option>
                      <option value="current_month">Mês atual</option>
                      <option value="custom">Personalizado</option>
                    </select>
                  </div>

                  {reconciliationPeriodFilter === 'custom' && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Início</label>
                        <input 
                          type="date" 
                          value={reconciliationStartDate}
                          onChange={(e) => setReconciliationStartDate(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-100 rounded-lg p-1.5 text-[10px] outline-none text-slate-700"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Fim</label>
                        <input 
                          type="date" 
                          value={reconciliationEndDate}
                          onChange={(e) => setReconciliationEndDate(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-100 rounded-lg p-1.5 text-[10px] outline-none text-slate-700"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Informacoes do Extrato (Banco, Agencia, Conta, Periodo Original) */}
                {(ofxBankName || ofxAccount || ofxPeriod) && (
                  <div className="bg-blue-50/30 p-3 rounded-2xl border border-blue-50/80 text-[11px] text-slate-600 space-y-1">
                    <p className="font-bold text-[10px] uppercase text-blue-500 tracking-wider mb-1.5 flex items-center gap-1.5">
                      <Landmark size={12} /> Detalhes do Arquivo
                    </p>
                    {ofxBankName && <p><strong>Banco:</strong> {normalizeDescription(ofxBankName)}</p>}
                    {(ofxAgency || ofxAccount) && (
                      <p>
                        {ofxAgency && <span className="mr-3"><strong>Agência:</strong> {ofxAgency}</span>}
                        {ofxAccount && <span><strong>Conta:</strong> {ofxAccount}</span>}
                      </p>
                    )}
                    {ofxPeriod && <p><strong>Período Original:</strong> {ofxPeriod}</p>}
                  </div>
                )}

                <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl max-h-[500px] overflow-y-auto bg-slate-50/20">
                  {reconciliationItems
                    .map((item, idx) => ({ ...item, originalIndex: idx }))
                    .filter(item => {
                      if (reconciliationPeriodFilter === 'all') return true;
                      const itemDateStr = item.date;
                      if (!itemDateStr) return true;

                      const itemDate = new Date(itemDateStr + 'T00:00:00');
                      
                      const today = new Date();
                      today.setHours(0,0,0,0);
                      const itemDateClean = new Date(itemDateStr + 'T00:00:00');
                      itemDateClean.setHours(0,0,0,0);

                      if (reconciliationPeriodFilter === 'today') {
                        const todayStr = today.toISOString().split('T')[0];
                        return itemDateStr === todayStr;
                      }
                      if (reconciliationPeriodFilter === '7days') {
                        const diffTime = today.getTime() - itemDateClean.getTime();
                        const diffDays = diffTime / (1000 * 60 * 60 * 24);
                        return diffDays >= 0 && diffDays <= 7;
                      }
                      if (reconciliationPeriodFilter === '30days') {
                        const diffTime = today.getTime() - itemDateClean.getTime();
                        const diffDays = diffTime / (1000 * 60 * 60 * 24);
                        return diffDays >= 0 && diffDays <= 30;
                      }
                      if (reconciliationPeriodFilter === 'current_month') {
                        const itemYear = itemDateClean.getFullYear();
                        const itemMonth = itemDateClean.getMonth();
                        const curYear = today.getFullYear();
                        const curMonth = today.getMonth();
                        return itemYear === curYear && itemMonth === curMonth;
                      }
                      if (reconciliationPeriodFilter === 'custom') {
                        if (reconciliationStartDate && itemDateStr < reconciliationStartDate) return false;
                        if (reconciliationEndDate && itemDateStr > reconciliationEndDate) return false;
                        return true;
                      }
                      return true;
                    })
                    .map((item) => {
                      const isSelected = selectedImportedIndex === item.originalIndex;
                      const itemKey = item.id || item.external_id || `temp-${item.originalIndex}`;
                      const isPrepared = selectedMatches.some(m => m.reconciliation_id === itemKey);

                      return (
                        <div 
                          key={item.id || item.originalIndex} 
                          onClick={() => {
                            setSelectedImportedIndex(item.originalIndex);
                            setSelectedSystemTxId(null);
                            setAutoMatchScore(null);
                            setShowQuickCreateForm(false);
                            
                            // Check if this item is prepared in selectedMatches
                            const prep = selectedMatches.find(m => m.reconciliation_id === itemKey);
                            if (prep) {
                              setSelectedSystemTxId(prep.transaction_id);
                              setAutoMatchScore(prep.score);
                            } else {
                              const suggested = computeAutoMatch(
                                reconciliationItems[item.originalIndex],
                                transactions
                              );
                              if (suggested) {
                                setSelectedSystemTxId(suggested.id);
                                setAutoMatchScore(suggested.score);
                              } else {
                                setAutoMatchScore(null);
                              }
                            }
                          }}
                          className={`p-4 flex flex-col justify-between cursor-pointer transition-all ${
                            item.matched 
                              ? 'bg-emerald-50/20 opacity-65 border-l-4 border-emerald-500' 
                              : isPrepared
                                ? 'bg-amber-50/40 border-l-4 border-amber-400 opacity-95 shadow-sm'
                                : isSelected 
                                  ? 'bg-blue-50/80 border-l-4 border-blue-500 shadow-inner' 
                                  : 'hover:bg-slate-50/50 bg-white'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-bold text-slate-400">
                              {new Date(item.date).toLocaleDateString('pt-BR')}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {isPrepared && (
                                <span className="text-[8px] font-black uppercase bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded flex items-center gap-0.5 animate-pulse">
                                  <Clock size={8} /> Fila
                                </span>
                              )}
                              <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                                item.type === TransactionType.INCOME 
                                  ? 'text-emerald-600 bg-emerald-50 border border-emerald-100/50' 
                                  : 'text-rose-600 bg-rose-50 border border-rose-100/50'
                              }`}>
                                {item.type === TransactionType.INCOME ? 'Entrada' : 'Saída'}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-end justify-between gap-2">
                            <p className={`font-bold text-slate-800 text-xs truncate max-w-[180px] ${item.matched ? 'line-through text-slate-400' : ''}`}>
                              {normalizeDescription(item.description)}
                            </p>
                            <div className="text-right flex-shrink-0">
                              <p className={`font-black text-xs ${item.type === TransactionType.INCOME ? 'text-emerald-600' : 'text-slate-700'}`}>
                                {formatCurrency(item.amount)}
                              </p>
                            </div>
                          </div>
                          {item.matched && (
                            <div className="mt-1 flex items-center gap-1 text-[9px] font-black text-emerald-600 uppercase tracking-widest">
                              <Check size={10} /> Conciliado
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* 2. Center Column: Match details, preparation confirmation, and quick create */}
              <div className="xl:col-span-5 bg-slate-50/50 rounded-2xl p-5 border border-slate-100 space-y-4">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block border-b border-slate-100 pb-2">
                  Painel de Conciliação
                </span>

                {!activeImportedItem ? (
                  <div className="py-16 text-center text-slate-400">
                    <RefreshCw size={24} className="mx-auto text-slate-300 mb-2 animate-pulse" />
                    <p className="text-xs font-bold uppercase tracking-wider">Selecione um item</p>
                    <p className="text-[10px] mt-1">Selecione uma transação bancária à esquerda para iniciar o vínculo.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Selected Item Details */}
                    <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-3">
                      <div className="flex justify-between items-start">
                        <span className="text-[9px] bg-blue-50 text-blue-600 font-bold px-2 py-0.5 rounded uppercase tracking-wider font-sans">
                          Transação do Extrato
                        </span>
                        {!activeImportedItem.matched && (
                          <button
                            onClick={handleIgnoreReconciliation}
                            className="text-[10px] font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 transition-all cursor-pointer font-sans"
                            title="Ignorar esta transação"
                          >
                            <Trash2 size={12} /> Ignorar
                          </button>
                        )}
                      </div>
                      
                      <h4 className="text-sm font-black text-slate-800 leading-tight font-sans">
                        {normalizeDescription(activeImportedItem.description)}
                      </h4>

                      <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-50 text-xs text-slate-500 font-medium">
                        <div>
                          <p className="text-[9px] text-slate-400 uppercase font-black tracking-wider">Data</p>
                          <p className="text-slate-700 font-bold">{new Date(activeImportedItem.date).toLocaleDateString('pt-BR')}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-slate-400 uppercase font-black tracking-wider">Valor</p>
                          <p className={`font-black ${activeImportedItem.type === TransactionType.INCOME ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {activeImportedItem.type === TransactionType.INCOME ? 'Entrada (+)' : 'Saída (-)'} {formatCurrency(activeImportedItem.amount)}
                          </p>
                        </div>
                        {ofxBankName && (
                          <div className="col-span-2">
                            <p className="text-[9px] text-slate-400 uppercase font-black tracking-wider">Banco de Origem</p>
                            <p className="text-slate-700 font-bold flex items-center gap-1.5 mt-0.5">
                              <Landmark size={12} className="text-slate-400" /> {normalizeDescription(ofxBankName)}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Display status in bank item details */}
                      <div className="pt-2 border-t border-slate-50 flex justify-between items-center">
                        <span className="text-[9px] text-slate-400 uppercase font-black tracking-wider">Status do Extrato</span>
                        {(() => {
                          const itemKey = activeImportedItem.id || activeImportedItem.external_id || `temp-${selectedImportedIndex}`;
                          const prep = selectedMatches.find(m => m.reconciliation_id === itemKey);
                          if (activeImportedItem.matched) {
                            return (
                              <span className="bg-emerald-50 text-emerald-600 font-black text-[9px] px-2 py-0.5 rounded-full border border-emerald-100 flex items-center gap-1 uppercase tracking-wider">
                                <Check size={10} /> Conciliado no Banco
                              </span>
                            );
                          } else if (prep) {
                            return (
                              <span className="bg-amber-50 text-amber-600 font-black text-[9px] px-2 py-0.5 rounded-full border border-amber-100 flex items-center gap-1 uppercase tracking-wider animate-pulse">
                                <Clock size={10} /> Preparado (Fila)
                              </span>
                            );
                          } else {
                            return (
                              <span className="bg-slate-100 text-slate-600 font-black text-[9px] px-2 py-0.5 rounded-full border border-slate-200 uppercase tracking-wider">
                                Pendente
                              </span>
                            );
                          }
                        })()}
                      </div>
                    </div>

                    {/* Check if the active item has a prepared match */}
                    {(() => {
                      const itemKey = activeImportedItem.id || activeImportedItem.external_id || `temp-${selectedImportedIndex}`;
                      const preparedMatch = selectedMatches.find(m => m.reconciliation_id === itemKey);
                      
                      if (activeImportedItem.matched) {
                        return (
                          <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4 text-center space-y-2">
                            <CheckCircle2 size={24} className="text-emerald-500 mx-auto" />
                            <p className="text-xs font-black text-emerald-800 uppercase tracking-wider">Transação Conciliada</p>
                            <p className="text-[10px] text-slate-500 font-medium">Esta transação já foi vinculada e liquidada no ERP com sucesso.</p>
                          </div>
                        );
                      } else if (preparedMatch) {
                        // Find the transaction it's paired with
                        const pairedTx = transactions.find(t => t.id === preparedMatch.transaction_id);
                        return (
                          <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-4 space-y-3">
                            <div className="flex justify-between items-center">
                              <p className="text-xs font-black text-amber-800 uppercase tracking-wider flex items-center gap-1.5 font-sans">
                                <Clock size={14} className="text-amber-600" /> Vínculo Preparado em Fila
                              </p>
                              <button
                                onClick={() => handleRemoveQueueMatch(itemKey)}
                                className="text-[10px] font-black text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                              >
                                Cancelar Preparação
                              </button>
                            </div>
                            
                            {pairedTx ? (
                              <div className="bg-white rounded-xl p-3 border border-amber-200/50 space-y-1.5">
                                <p className="text-xs font-bold text-slate-800 leading-snug">{normalizeDescription(pairedTx.description)}</p>
                                <div className="flex justify-between text-[10px] text-slate-500 font-semibold pt-1 border-t border-slate-50">
                                  <span>Vencimento: {new Date(pairedTx.due_date).toLocaleDateString('pt-BR')}</span>
                                  <span className="text-slate-800 font-bold">Valor: {formatCurrency(pairedTx.amount)}</span>
                                </div>
                                <div className="text-[9px] text-slate-400 font-medium italic">
                                  Compatibilidade: {preparedMatch.score}%
                                </div>
                              </div>
                            ) : (
                              <p className="text-[10px] text-slate-500">Transação vinculada não encontrada no estado local.</p>
                            )}
                          </div>
                        );
                      } else if (showQuickCreateForm) {
                        return (
                          <div className="bg-white border border-slate-100 rounded-2xl p-5 space-y-4 shadow-sm">
                            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                              <span className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5 font-sans">
                                <Plus size={14} className="text-indigo-600" /> Novo lançamento
                              </span>
                              <button
                                onClick={() => setShowQuickCreateForm(false)}
                                className="text-[10px] font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
                              >
                                Cancelar
                              </button>
                            </div>
                            
                            <div className="space-y-3.5">
                              <div>
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">Descrição do Lançamento</label>
                                <input 
                                  type="text"
                                  placeholder={normalizeDescription(activeImportedItem.description)}
                                  value={quickDescription}
                                  onChange={(e) => setQuickDescription(e.target.value)}
                                  className="w-full bg-slate-50 border border-slate-100 rounded-xl p-2.5 text-xs outline-none text-slate-800 focus:border-indigo-300 focus:ring-1 focus:ring-indigo-100"
                                />
                              </div>
                              
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">Categoria</label>
                                  <select 
                                    value={quickCategoryId}
                                    onChange={(e) => setQuickCategoryId(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-100 rounded-xl p-2.5 text-xs outline-none text-slate-800 focus:border-indigo-300 focus:ring-1 focus:ring-indigo-100"
                                  >
                                    <option value="">Selecione...</option>
                                    {categories.filter(c => c.type === activeImportedItem.type).map(cat => (
                                      <option key={cat.id} value={cat.id}>{normalizeDescription(cat.name)}</option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">Conta Bancária</label>
                                  <select 
                                    value={quickAccountId}
                                    onChange={(e) => setQuickAccountId(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-100 rounded-xl p-2.5 text-xs outline-none text-slate-800 focus:border-indigo-300 focus:ring-1 focus:ring-indigo-100"
                                  >
                                    <option value="">Selecione...</option>
                                    {accounts.map(acc => (
                                      <option key={acc.id} value={acc.id}>{normalizeDescription(acc.name)}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>

                              <button 
                                onClick={handleQuickCreateAndReconcile}
                                disabled={loading}
                                className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-black text-xs py-3 rounded-xl shadow-sm cursor-pointer text-center uppercase tracking-wider font-sans mt-2"
                              >
                                {loading ? 'Criando...' : 'Salvar no Sistema e Conciliar'}
                              </button>
                            </div>
                          </div>
                        );
                      } else if (selectedSystemTx && selectedSystemTx.type === activeImportedItem.type) {
                        let badgeBg = 'bg-rose-50 text-rose-700 border border-rose-100';
                        if (manualCompatibilityScore >= 85) {
                          badgeBg = 'bg-emerald-50 text-emerald-700 border border-emerald-100';
                        } else if (manualCompatibilityScore >= 60) {
                          badgeBg = 'bg-amber-50 text-amber-700 border border-amber-100';
                        }

                        return (
                          <div className="bg-white border border-slate-100 rounded-2xl p-5 space-y-4 shadow-sm">
                            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                              <p className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5 font-sans">
                                <Zap size={14} className="text-indigo-600" /> SUGESTÃO SELECIONADA
                              </p>
                              <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black tracking-wider ${badgeBg}`}>
                                {manualCompatibilityScore}% CONFIANÇA
                              </span>
                            </div>
                            
                            <div className="space-y-2">
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Lançamento ERP</p>
                              <p className="text-xs font-bold text-slate-800 leading-snug whitespace-normal">
                                {normalizeDescription(selectedSystemTx.description)}
                              </p>
                              <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 font-medium pt-2 border-t border-slate-50">
                                <div>
                                  <p className="text-[9px] text-slate-400 uppercase font-black tracking-wider">Vencimento</p>
                                  <p className="text-slate-700 font-bold">
                                    {new Date(selectedSystemTx.due_date).toLocaleDateString('pt-BR')}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[9px] text-slate-400 uppercase font-black tracking-wider">Valor ERP</p>
                                  <p className="text-slate-700 font-black text-sm">
                                    {formatCurrency(selectedSystemTx.amount)}
                                  </p>
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 gap-2 pt-2 border-t border-slate-100/60">
                              <button 
                                onClick={handleQueueMatch}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs py-3 rounded-xl shadow-md transition-all cursor-pointer text-center font-sans uppercase tracking-wider"
                              >
                                CONFIRMAR VÍNCULO
                              </button>
                              <button 
                                onClick={() => {
                                  setSelectedSystemTxId(null);
                                  setAutoMatchScore(null);
                                }}
                                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-[10px] py-2 rounded-lg transition-all cursor-pointer text-center font-sans uppercase tracking-wider"
                              >
                                LIMPAR SELEÇÃO
                              </button>
                            </div>
                          </div>
                        );
                      } else {
                        return (
                          <div className="bg-white p-6 rounded-2xl border border-dashed border-slate-200 text-center space-y-4 shadow-sm">
                            <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center mx-auto text-indigo-600">
                              <Zap size={20} className="animate-pulse" />
                            </div>
                            <div>
                              <p className="text-sm font-black text-slate-700 uppercase tracking-wide">Aguardando Seleção</p>
                              <p className="text-xs text-slate-400 font-medium mt-1">
                                Selecione uma das sugestões ao lado para preparar o vínculo.
                              </p>
                            </div>
                            <div className="flex flex-col gap-2 pt-2">
                              <button
                                onClick={() => {
                                  setQuickDescription(activeImportedItem.description);
                                  setShowQuickCreateForm(true);
                                  setSelectedSystemTxId(null);
                                }}
                                className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-black py-2.5 px-4 rounded-xl transition-all inline-flex items-center justify-center gap-1 cursor-pointer mx-auto"
                              >
                                <Plus size={12} /> Criar Novo Lançamento
                              </button>
                            </div>
                          </div>
                        );
                      }
                    })()}
                  </div>
                )}
              </div>

              {/* 3. Right Column: System transactions for matching */}
              <div className="xl:col-span-4 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    Sugestões do Sistema
                  </span>
                  <span className="text-[10px] bg-indigo-50 px-2 py-0.5 rounded font-black text-indigo-600 uppercase tracking-wide">
                    {displayedSystemTxs.length} Disponíveis
                  </span>
                </div>

                {/* Manual Search Field with Clear Button */}
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Search size={14} />
                  </span>
                  <input
                    type="text"
                    id="reconciliation-search-input"
                    placeholder="Buscar por descrição, valor ou data..."
                    value={reconciliationSearch}
                    onChange={(e) => setReconciliationSearch(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-9 pr-10 py-2.5 text-xs outline-none text-slate-800 placeholder-slate-400 focus:border-indigo-300 focus:ring-1 focus:ring-indigo-100 transition-all font-medium"
                  />
                  {reconciliationSearch && (
                    <button
                      onClick={() => setReconciliationSearch('')}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-all text-xs font-bold"
                    >
                      Limpar
                    </button>
                  )}
                </div>

                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                  {displayedSystemTxs.map(({ tx, score }) => {
                    const isSelected = selectedSystemTxId === tx.id;
                    const cat = categories.find(c => c.id === tx.category_id);
                    
                    let badgeBg = 'bg-rose-50 text-rose-700 border border-rose-100';
                    if (score >= 85) {
                      badgeBg = 'bg-emerald-50 text-emerald-700 border border-emerald-100';
                    } else if (score >= 60) {
                      badgeBg = 'bg-amber-50 text-amber-700 border border-amber-100';
                    }

                    return (
                      <div 
                        key={tx.id} 
                        onClick={() => {
                          setSelectedSystemTxId(tx.id);
                          setAutoMatchScore(score);
                          setShowQuickCreateForm(false);
                        }}
                        className={`p-4 rounded-2xl border transition-all flex flex-col justify-between cursor-pointer space-y-3 ${
                          isSelected 
                            ? 'bg-indigo-50/50 border-indigo-200 ring-1 ring-indigo-100' 
                            : 'bg-white border-slate-100 hover:border-slate-200 hover:shadow-sm'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-400">
                            Vence em {new Date(tx.due_date).toLocaleDateString('pt-BR')}
                          </span>
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${badgeBg}`}>
                            {score}% Compatível
                          </span>
                        </div>

                        <div>
                          <p className="font-bold text-slate-800 text-xs leading-relaxed whitespace-normal break-words">
                            {normalizeDescription(tx.description)}
                          </p>
                          
                          {cat && (
                            <div className="flex items-center gap-1.5 mt-2">
                              <span 
                                className="w-2 h-2 rounded-full inline-block shrink-0" 
                                style={{ backgroundColor: cat.color || '#cbd5e1' }}
                              />
                              <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">
                                {normalizeDescription(cat.name)}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-100/60">
                          <div>
                            <span className="text-[9px] text-slate-400 uppercase font-black block leading-none">Valor ERP</span>
                            <span className="font-black text-sm text-slate-800 inline-block mt-0.5">
                              {formatCurrency(tx.amount)}
                            </span>
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSystemTxId(tx.id);
                              setAutoMatchScore(score);
                              setShowQuickCreateForm(false);
                              // Smooth scroll to Center Panel for easy confirmation
                              document.getElementById('reconciliation-search-input')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              showToast('Selecione e confirme o vínculo no painel central.', 'info');
                            }}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                              isSelected 
                                ? 'bg-indigo-600 text-white shadow-sm' 
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                          >
                            Vincular
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {displayedSystemTxs.length === 0 && (
                    <div className="p-8 bg-slate-50/50 rounded-2xl border border-slate-100 text-center space-y-4">
                      <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
                        <AlertCircle size={20} className="text-slate-400" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-700 uppercase tracking-wide">Nenhuma correspondência encontrada</p>
                        <p className="text-xs text-slate-400 font-medium mt-1">Nenhum lançamento com compatibilidade no sistema.</p>
                      </div>
                      <div className="flex flex-col gap-2 pt-2">
                        <button
                          onClick={() => {
                            document.getElementById('reconciliation-search-input')?.focus();
                            showToast('Digite uma descrição ou valor para pesquisar manualmente.', 'info');
                          }}
                          className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-black py-2 px-4 rounded-xl transition-all cursor-pointer inline-flex items-center justify-center gap-1.5"
                        >
                          <Search size={12} /> Buscar Manualmente
                        </button>
                        
                        {activeImportedItem && (
                          <button
                            onClick={() => {
                              setQuickDescription(activeImportedItem.description);
                              setShowQuickCreateForm(true);
                              setSelectedSystemTxId(null);
                              showToast('Utilize o formulário de Novo Lançamento no painel central.', 'info');
                            }}
                            className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-black py-2 px-4 rounded-xl transition-all cursor-pointer inline-flex items-center justify-center gap-1"
                          >
                            <Plus size={12} /> Criar Novo Lançamento
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const handleCsvImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      if (!text) return;
      
      const lines = text.split(/\r?\n/);
      const parsedCategories: Array<{ name: string; type: TransactionType; color: string; group_name: string }> = [];
      
      let nameIdx = 0;
      let typeIdx = 1;
      let colorIdx = 2;
      let groupIdx = -1;
      
      if (lines.length > 0) {
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        nameIdx = headers.indexOf('nome');
        if (nameIdx === -1) nameIdx = headers.indexOf('name');
        typeIdx = headers.indexOf('tipo');
        if (typeIdx === -1) typeIdx = headers.indexOf('type');
        colorIdx = headers.indexOf('cor');
        if (colorIdx === -1) colorIdx = headers.indexOf('color');
        groupIdx = headers.indexOf('grupo');
        if (groupIdx === -1) groupIdx = headers.indexOf('group_name');
        if (groupIdx === -1) groupIdx = headers.indexOf('group');
      }
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const columns = line.split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
        if (columns.length < 2) continue;
        
        const name = columns[nameIdx !== -1 ? nameIdx : 0] || '';
        const typeRaw = columns[typeIdx !== -1 ? typeIdx : 1] || 'EXPENSE';
        const color = columns[colorIdx !== -1 ? colorIdx : 2] || '#f43f5e';
        const group_name = groupIdx !== -1 ? (columns[groupIdx] || '') : '';
        
        if (!name) continue;
        
        let type = TransactionType.EXPENSE;
        if (typeRaw.toUpperCase() === 'INCOME' || typeRaw.toUpperCase() === 'RECEITA') {
          type = TransactionType.INCOME;
        }
        
        parsedCategories.push({ name, type, color, group_name });
      }
      
      setCsvPreview(parsedCategories);
      setIsCsvModalOpen(true);
    };
    reader.readAsText(file);
  };

  const handleConfirmCsvImport = async () => {
    if (csvPreview.length === 0) return;
    setLoading(true);
    let successCount = 0;
    
    try {
      const newGroups: Record<string, string> = {};
      const newCatsToState: FinancialCategory[] = [];
      
      for (const cat of csvPreview) {
        const payload: Omit<FinancialCategory, 'id'> = {
          agency_id: currentUser.agencyId,
          name: cat.name,
          type: cat.type,
          color: cat.color
        };
        
        const result = await supabaseService.createFinancialCategory(payload);
        if (result) {
          successCount++;
          if (cat.group_name) {
            newGroups[result.id] = cat.group_name;
          }
        } else {
          const mockId = 'cat-local-' + Math.random().toString(36).substr(2, 9);
          successCount++;
          newCatsToState.push({
            id: mockId,
            ...payload
          });
          if (cat.group_name) {
            newGroups[mockId] = cat.group_name;
          }
        }
      }
      
      if (Object.keys(newGroups).length > 0) {
        setCategoryGroups(prev => {
          const updated = { ...prev, ...newGroups };
          localStorage.setItem('financial_category_groups', JSON.stringify(updated));
          return updated;
        });
      }
      
      if (newCatsToState.length > 0) {
        setCategories(prev => [...prev, ...newCatsToState]);
      }
      
      await loadFinancialData();
      showToast(`${successCount} categorias importadas com sucesso!`, 'success');
    } catch (err) {
      console.error('Erro na importação em massa:', err);
      showToast('Ocorreu um erro ao importar as categorias.', 'error');
    } finally {
      setIsCsvModalOpen(false);
      setCsvPreview([]);
      setLoading(false);
    }
  };

  // 6. View: Categorias (Organize visual cards)
  const renderCategorias = () => {
    const revenueCats = categories.filter(c => c.type === TransactionType.INCOME);
    const expenseCats = categories.filter(c => c.type === TransactionType.EXPENSE);

    const groupCategories = (cats: FinancialCategory[]) => {
      const groups: Record<string, FinancialCategory[]> = {};
      cats.forEach(c => {
        const groupName = categoryGroups[c.id]?.trim() || 'Sem Grupo';
        if (!groups[groupName]) {
          groups[groupName] = [];
        }
        groups[groupName].push(c);
      });
      return groups;
    };

    const groupedRevenueCats = groupCategories(revenueCats);
    const sortedRevenueGroups = Object.entries(groupedRevenueCats).sort(([a], [b]) => {
      if (a === 'Sem Grupo') return 1;
      if (b === 'Sem Grupo') return -1;
      return a.localeCompare(b);
    });

    const groupedExpenseCats = groupCategories(expenseCats);
    const sortedExpenseGroups = Object.entries(groupedExpenseCats).sort(([a], [b]) => {
      if (a === 'Sem Grupo') return 1;
      if (b === 'Sem Grupo') return -1;
      return a.localeCompare(b);
    });

    return (
      <div className="space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-2">
          {/* Revenues block */}
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
            <h3 className="text-base font-black text-emerald-600 border-b border-slate-100 pb-3 flex items-center gap-1.5 uppercase tracking-wider">
              <ArrowUpRight size={18} /> Categorias de Receita
            </h3>
            
            <div className="space-y-6">
              {sortedRevenueGroups.map(([groupName, cats]) => (
                <div key={groupName} className="space-y-3">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
                    <span>{groupName}</span>
                    <span className="text-[9px] bg-slate-50 text-slate-400 border border-slate-100 rounded px-1.5 py-0.5 font-bold uppercase">{cats.length} {cats.length === 1 ? 'Categoria' : 'Categorias'}</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {cats.map(cat => (
                      <div key={cat.id} className="p-4 border border-slate-50 bg-slate-50/10 rounded-xl flex items-center justify-between gap-3 shadow-sm hover:border-slate-100 transition-all">
                        <div className="flex items-center gap-3">
                          <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color || '#10b981' }} />
                          <p className="text-sm font-bold text-slate-800">{cat.name}</p>
                        </div>
                        <div className="flex gap-1.5">
                          <button 
                            onClick={() => handleEditCategoryClick(cat)}
                            className="p-1 text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
                            title="Editar"
                          >
                            <Pencil size={12} />
                          </button>
                          <button 
                            onClick={() => handleDeleteCategory(cat.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                            title="Excluir"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {revenueCats.length === 0 && (
                <div className="text-center py-10 text-slate-400 uppercase tracking-widest text-xs font-bold">Sem categorias cadastradas</div>
              )}
            </div>
          </div>

          {/* Expenses block */}
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
            <h3 className="text-base font-black text-rose-600 border-b border-slate-100 pb-3 flex items-center gap-1.5 uppercase tracking-wider">
              <ArrowDownRight size={18} /> Categorias de Despesa
            </h3>
            
            <div className="space-y-6">
              {sortedExpenseGroups.map(([groupName, cats]) => (
                <div key={groupName} className="space-y-3">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
                    <span>{groupName}</span>
                    <span className="text-[9px] bg-slate-50 text-slate-400 border border-slate-100 rounded px-1.5 py-0.5 font-bold uppercase">{cats.length} {cats.length === 1 ? 'Categoria' : 'Categorias'}</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {cats.map(cat => (
                      <div key={cat.id} className="p-4 border border-slate-50 bg-slate-50/10 rounded-xl flex items-center justify-between gap-3 shadow-sm hover:border-slate-100 transition-all">
                        <div className="flex items-center gap-3">
                          <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color || '#f43f5e' }} />
                          <p className="text-sm font-bold text-slate-800">{cat.name}</p>
                        </div>
                        <div className="flex gap-1.5">
                          <button 
                            onClick={() => handleEditCategoryClick(cat)}
                            className="p-1 text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
                            title="Editar"
                          >
                            <Pencil size={12} />
                          </button>
                          <button 
                            onClick={() => handleDeleteCategory(cat.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                            title="Excluir"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {expenseCats.length === 0 && (
                <div className="text-center py-10 text-slate-400 uppercase tracking-widest text-xs font-bold">Sem categorias cadastradas</div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const getGroupKeyAndLabelHelper = (dateStr: string, mode: 'DAILY' | 'WEEKLY' | 'MONTHLY') => {
    if (!dateStr) return { key: 'Sem Data', label: 'Sem Data' };
    const [year, month, day] = dateStr.split('-');
    
    if (mode === 'DAILY') {
      return {
        key: dateStr,
        label: `${day}/${month}/${year}`
      };
    } else if (mode === 'WEEKLY') {
      const d = new Date(`${dateStr}T12:00:00`);
      const dayOfWeek = d.getDay();
      const diff = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diff));
      const startStr = monday.toISOString().split('T')[0];
      const [mY, mM, mD] = startStr.split('-');
      return {
        key: startStr,
        label: `Semana de ${mD}/${mM}`
      };
    } else {
      const months = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
      ];
      const monthIndex = parseInt(month, 10) - 1;
      return {
        key: `${year}-${month}`,
        label: `${months[monthIndex]} / ${year}`
      };
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Dynamic Action / Context Toolbar */}
      <div className="bg-white rounded-3xl border border-slate-100 p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Extrato / General Financial view */}
        {((localActiveView === 'financial-extrato' || localActiveView === 'financial') && (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[240px]">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Buscar lançamentos..." 
                  className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none w-full focus:ring-2 focus:ring-blue-100 transition-all font-semibold"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="flex bg-slate-100 p-1 rounded-xl">
                {['Todos', 'Receitas', 'Despesas'].map((tab) => (
                  <button
                    key={tab}
                    className={`px-3.5 py-1.5 text-xs font-black rounded-lg transition-all cursor-pointer ${
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

              {/* Period Navigation */}
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl relative">
                <button 
                  onClick={() => {
                    setCurrentPeriod(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
                  }}
                  className="p-1 px-1.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title="Mês Anterior"
                >
                  <ChevronLeft size={16} />
                </button>
                
                <div 
                  onClick={() => {
                    monthInputRef.current?.showPicker ? monthInputRef.current.showPicker() : monthInputRef.current?.click();
                  }}
                  className="text-xs font-black uppercase tracking-wider text-slate-800 px-1.5 min-w-[110px] text-center cursor-pointer hover:bg-slate-200 py-1 rounded-lg transition-colors relative flex items-center justify-center"
                >
                  {(() => {
                    const monthNames = [
                      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
                    ];
                    return `${monthNames[currentPeriod.getMonth()]} de ${currentPeriod.getFullYear()}`;
                  })()}
                  <input 
                    ref={monthInputRef}
                    type="month" 
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    value={`${currentPeriod.getFullYear()}-${String(currentPeriod.getMonth() + 1).padStart(2, '0')}`}
                    onChange={(e) => {
                      if (e.target.value) {
                        const [y, m] = e.target.value.split('-').map(Number);
                        setCurrentPeriod(new Date(y, m - 1, 1));
                      }
                    }}
                  />
                </div>
                
                <button 
                  onClick={() => {
                    setCurrentPeriod(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
                  }}
                  className="p-1 px-1.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title="Próximo Mês"
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              {/* Additional Filter Trigger */}
              <div className="relative">
                <button 
                  onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                  className="flex items-center gap-1.5 text-slate-500 hover:text-slate-900 transition-colors bg-white font-bold text-xs px-3.5 py-2.5 border border-slate-100 rounded-xl shadow-sm cursor-pointer"
                >
                  <Filter size={14} />
                  <span>Filtrar</span>
                </button>
                
                {isFilterDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsFilterDropdownOpen(false)} />
                    <div className="absolute left-0 mt-2 w-64 bg-white border border-slate-100 rounded-2xl shadow-xl p-4 z-20 space-y-4">
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Filtrar por Categoria</label>
                        <select 
                          value={categoryFilter}
                          onChange={(e) => setCategoryFilter(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-700 outline-none cursor-pointer"
                        >
                          <option value="ALL">Todas as Categorias</option>
                          {categories.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={() => {
                  setNewTransaction({...newTransaction, type: TransactionType.INCOME});
                  setModalType('transaction');
                  setIsModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-emerald-600 text-white font-black text-xs uppercase tracking-wider rounded-xl hover:bg-emerald-700 hover:scale-[1.02] transform transition-all shadow-sm cursor-pointer"
              >
                <Plus size={14} /> Receita
              </button>
              <button 
                onClick={() => {
                  setNewTransaction({...newTransaction, type: TransactionType.EXPENSE});
                  setModalType('transaction');
                  setIsModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-rose-600 text-white font-black text-xs uppercase tracking-wider rounded-xl hover:bg-rose-700 hover:scale-[1.02] transform transition-all shadow-sm cursor-pointer"
              >
                <Plus size={14} /> Despesa
              </button>
              <button 
                onClick={handleExportTransactionsCSV}
                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white border border-slate-200 text-slate-600 font-black text-xs uppercase tracking-wider rounded-xl hover:bg-slate-50 hover:text-slate-900 transition-all shadow-sm cursor-pointer"
              >
                <Download size={14} /> Exportar CSV
              </button>
            </div>
          </>
        ))}

        {/* Fluxo de Caixa */}
        {localActiveView === 'financial-fluxo' && (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
                <TrendingUp size={14} /> Fluxo de Caixa
              </span>
              
              {/* Group Mode Selector */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                {(['DAILY', 'WEEKLY', 'MONTHLY'] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setFluxoGroupMode(mode)}
                    className={`px-3 py-1 text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer rounded-lg ${
                      fluxoGroupMode === mode
                        ? 'bg-white text-slate-800 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {mode === 'DAILY' ? 'Diário' : mode === 'WEEKLY' ? 'Semanal' : 'Mensal'}
                  </button>
                ))}
              </div>

              {/* Period Navigation */}
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl relative">
                <button 
                  onClick={() => {
                    setCurrentPeriod(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
                  }}
                  className="p-1 px-1.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title="Mês Anterior"
                >
                  <ChevronLeft size={16} />
                </button>
                
                <div 
                  onClick={() => {
                    monthInputRef.current?.showPicker ? monthInputRef.current.showPicker() : monthInputRef.current?.click();
                  }}
                  className="text-xs font-black uppercase tracking-wider text-slate-800 px-1.5 min-w-[110px] text-center cursor-pointer hover:bg-slate-200 py-1 rounded-lg transition-colors relative flex items-center justify-center"
                >
                  {(() => {
                    const monthNames = [
                      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
                    ];
                    return `${monthNames[currentPeriod.getMonth()]} de ${currentPeriod.getFullYear()}`;
                  })()}
                  <input 
                    ref={monthInputRef}
                    type="month" 
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    value={`${currentPeriod.getFullYear()}-${String(currentPeriod.getMonth() + 1).padStart(2, '0')}`}
                    onChange={(e) => {
                      if (e.target.value) {
                        const [y, m] = e.target.value.split('-').map(Number);
                        setCurrentPeriod(new Date(y, m - 1, 1));
                      }
                    }}
                  />
                </div>
                
                <button 
                  onClick={() => {
                    setCurrentPeriod(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
                  }}
                  className="p-1 px-1.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title="Próximo Mês"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const activeAccountIds = selectedAccountIds.length > 0 ? selectedAccountIds : accounts.map(a => a.id);
                  const txsForSelectedAccounts = transactions.filter(t => {
                    const accId = t.account_id || t.financial_account_id;
                    return activeAccountIds.includes(accId || '') && t.is_transfer !== true;
                  });
                  const periodTxs = txsForSelectedAccounts.filter(t => {
                    const parts = t.due_date.split('-');
                    const txYear = parseInt(parts[0], 10);
                    const txMonth = parseInt(parts[1], 10) - 1;
                    return txYear === currentPeriod.getFullYear() && txMonth === currentPeriod.getMonth();
                  });
                  const groupedDataMap: Record<string, any> = {};
                  periodTxs.forEach(tx => {
                    const dateStr = tx.payment_date && tx.status === TransactionStatus.PAID ? tx.payment_date : tx.due_date;
                    const { key, label } = getGroupKeyAndLabelHelper(dateStr, fluxoGroupMode);
                    if (!groupedDataMap[key]) {
                      groupedDataMap[key] = { label, income: 0, expense: 0, expectedIncome: 0, expectedExpense: 0 };
                    }
                    const amt = tx.amount || 0;
                    if (tx.type === TransactionType.INCOME) {
                      if (tx.status === TransactionStatus.PAID) groupedDataMap[key].income += amt;
                      else groupedDataMap[key].expectedIncome += amt;
                    } else if (tx.type === TransactionType.EXPENSE) {
                      if (tx.status === TransactionStatus.PAID) groupedDataMap[key].expense += amt;
                      else groupedDataMap[key].expectedExpense += amt;
                    }
                  });
                  const sortedKeys = Object.keys(groupedDataMap).sort();
                  const csvData = [
                    ['Periodo', 'Entradas Reais (R$)', 'Saidas Reais (R$)', 'Entradas Previstas (R$)', 'Saidas Previstas (R$)'],
                    ...sortedKeys.map(k => [
                      groupedDataMap[k].label,
                      groupedDataMap[k].income,
                      groupedDataMap[k].expense,
                      groupedDataMap[k].expectedIncome,
                      groupedDataMap[k].expectedExpense
                    ])
                  ];
                  const ws = XLSX.utils.aoa_to_sheet(csvData);
                  const wb = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(wb, ws, 'Fluxo de Caixa');
                  XLSX.writeFile(wb, `fluxo_caixa_${currentPeriod.getFullYear()}_${currentPeriod.getMonth() + 1}.xlsx`);
                  showToast('Relatório exportado!', 'success');
                }}
                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800 transition-all shadow-sm cursor-pointer"
              >
                <Download size={14} /> Exportar Planilha
              </button>
            </div>
          </>
        )}

        {/* Conciliação Bancária */}
        {localActiveView === 'financial-conciliacao' && (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1 mr-2">
                <CheckCircle2 size={14} /> Conciliação Bancária
              </span>

              {/* Import/Clear Button */}
              {importedFile && (
                <button 
                  onClick={handleClearExtrato}
                  className="flex items-center gap-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  <RefreshCw size={12} /> Limpar Extrato
                </button>
              )}

              {/* Search Input (only when file is imported) */}
              {importedFile && (
                <div className="relative min-w-[200px]">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Pesquisar no extrato..." 
                    className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-100 transition-all font-medium"
                    value={reconciliationSearch}
                    onChange={(e) => setReconciliationSearch(e.target.value)}
                  />
                </div>
              )}

              {/* Period Filter (only when file is imported) */}
              {importedFile && (
                <select 
                  value={reconciliationPeriodFilter}
                  onChange={(e) => setReconciliationPeriodFilter(e.target.value as any)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700 outline-none cursor-pointer"
                >
                  <option value="all">Todas as Datas</option>
                  <option value="today">Hoje</option>
                  <option value="7days">Últimos 7 dias</option>
                  <option value="30days">Últimos 30 dias</option>
                  <option value="current_month">Mês Atual</option>
                </select>
              )}
            </div>

            {/* Reconciliation Actions */}
            {importedFile && (
              <div className="flex items-center gap-2">
                {selectedMatches.length > 0 && (
                  <button
                    onClick={handleBatchConciliate}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-3.5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black rounded-xl transition-all shadow-sm animate-pulse cursor-pointer"
                  >
                    <CheckCircle2 size={13} /> Conciliar Selecionados ({selectedMatches.length})
                  </button>
                )}
                <button 
                  onClick={handleAutoConciliation}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl text-xs uppercase tracking-wider transition-all shadow-sm cursor-pointer"
                >
                  <Sparkles size={13} /> Conciliação Inteligente
                </button>
              </div>
            )}
          </>
        )}

        {/* Cartões */}
        {localActiveView === 'financial-cartoes' && (
          <>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
                <CreditCard size={14} /> Cartões Corporativos
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={() => {
                  setModalType('card');
                  setIsModalOpen(true);
                }}
                className="flex items-center gap-1.5 bg-slate-900 text-white rounded-xl px-3.5 py-2.5 text-xs font-black uppercase tracking-wider hover:bg-slate-800 transition-all shadow-sm cursor-pointer"
              >
                <Plus size={14} /> Novo Cartão
              </button>
            </div>
          </>
        )}

        {/* Contas Bancárias */}
        {localActiveView === 'financial-contas' && (
          <>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
                <Landmark size={14} /> Contas Bancárias
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={() => {
                  setModalType('account');
                  setIsModalOpen(true);
                }}
                className="flex items-center gap-1.5 bg-slate-900 text-white rounded-xl px-3.5 py-2.5 text-xs font-black uppercase tracking-wider hover:bg-slate-800 transition-all shadow-sm cursor-pointer"
              >
                <Plus size={14} /> Adicionar Conta
              </button>
            </div>
          </>
        )}

        {/* Categorias */}
        {localActiveView === 'financial-categorias' && (
          <>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
                <Tag size={14} /> Categorias Financeiras
              </span>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-black uppercase tracking-wider hover:bg-slate-50 transition-all shadow-sm cursor-pointer">
                <Download size={14} className="rotate-180" /> Importar CSV
                <input 
                  type="file" 
                  accept=".csv" 
                  className="hidden" 
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleCsvImport(file);
                    e.target.value = '';
                  }}
                />
              </label>
              <button 
                onClick={() => {
                  setModalType('category');
                  setIsModalOpen(true);
                }}
                className="flex items-center gap-1.5 bg-slate-900 text-white rounded-xl px-3.5 py-2.5 text-xs font-black uppercase tracking-wider hover:bg-slate-800 transition-all shadow-sm cursor-pointer"
              >
                <Plus size={14} /> Nova Categoria
              </button>
            </div>
          </>
        )}

        {/* Contas a Pagar / Receber */}
        {localActiveView === 'financial-pagamentos' && (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1 mr-2">
                <Receipt size={14} /> Contas a Pagar/Receber
              </span>

              {/* Tab Filter */}
              <div className="flex bg-slate-100 p-1 rounded-xl">
                {(['todas', 'pagar', 'receber', 'vencidas'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setPagamentosTab(tab)}
                    className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider transition-all cursor-pointer rounded-lg ${
                      pagamentosTab === tab
                        ? 'bg-white text-slate-800 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {tab === 'todas' ? 'Todas' : tab === 'pagar' ? 'A Pagar' : tab === 'receber' ? 'A Receber' : 'Vencidas'}
                  </button>
                ))}
              </div>

              {/* Search Input */}
              <div className="relative min-w-[200px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Pesquisar lançamentos..." 
                  className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-100 transition-all font-medium"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={() => {
                  setNewTransaction({...newTransaction, type: TransactionType.EXPENSE, status: TransactionStatus.PENDING});
                  setModalType('transaction');
                  setIsModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-sm cursor-pointer"
              >
                <Plus size={13} /> Nova Despesa Pagar
              </button>
              <button 
                onClick={() => {
                  setNewTransaction({...newTransaction, type: TransactionType.INCOME, status: TransactionStatus.PENDING});
                  setModalType('transaction');
                  setIsModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-sm cursor-pointer"
              >
                <Plus size={13} /> Nova Receita Receber
              </button>
            </div>
          </>
        )}

        {/* Centro de Custo */}
        {localActiveView === 'financial-centrocusto' && (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1 mr-2">
                <Layers size={14} /> Centro de Custo
              </span>

              {/* Centro de Custo Tab Filter */}
              <div className="flex bg-slate-100 p-1 rounded-xl">
                {(['todos', 'despesas', 'receitas'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setCentroCustoTab(tab)}
                    className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider transition-all cursor-pointer rounded-lg ${
                      centroCustoTab === tab
                        ? 'bg-white text-slate-800 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {tab === 'todos' ? 'Todos' : tab === 'despesas' ? 'Despesas' : 'Receitas'}
                  </button>
                ))}
              </div>

              {/* Search Input */}
              <div className="relative min-w-[200px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Buscar no centro de custo..." 
                  className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-100 transition-all font-medium"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (typeof (window as any).handleExportCentroCustoXLSX === 'function') {
                    (window as any).handleExportCentroCustoXLSX();
                  } else {
                    showToast('Exportando dados do Centro de Custo...', 'success');
                  }
                }}
                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-sm cursor-pointer"
              >
                <Download size={14} /> Exportar Excel
              </button>
            </div>
          </>
        )}

        {/* Relatórios */}
        {localActiveView === 'financial-relatorios' && (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1 mr-2">
                <FileDown size={14} /> Relatórios Financeiros
              </span>

              {/* Period Navigation */}
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl relative">
                <button 
                  onClick={() => {
                    setCurrentPeriod(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
                  }}
                  className="p-1 px-1.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title="Mês Anterior"
                >
                  <ChevronLeft size={16} />
                </button>
                
                <div 
                  onClick={() => {
                    monthInputRef.current?.showPicker ? monthInputRef.current.showPicker() : monthInputRef.current?.click();
                  }}
                  className="text-xs font-black uppercase tracking-wider text-slate-800 px-1.5 min-w-[110px] text-center cursor-pointer hover:bg-slate-200 py-1 rounded-lg transition-colors relative flex items-center justify-center"
                >
                  {(() => {
                    const monthNames = [
                      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
                    ];
                    return `${monthNames[currentPeriod.getMonth()]} de ${currentPeriod.getFullYear()}`;
                  })()}
                  <input 
                    ref={monthInputRef}
                    type="month" 
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    value={`${currentPeriod.getFullYear()}-${String(currentPeriod.getMonth() + 1).padStart(2, '0')}`}
                    onChange={(e) => {
                      if (e.target.value) {
                        const [y, m] = e.target.value.split('-').map(Number);
                        setCurrentPeriod(new Date(y, m - 1, 1));
                      }
                    }}
                  />
                </div>
                
                <button 
                  onClick={() => {
                    setCurrentPeriod(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
                  }}
                  className="p-1 px-1.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title="Próximo Mês"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-wider rounded-xl px-3.5 py-2.5 shadow-sm transition-all cursor-pointer"
              >
                <FileText size={14} /> Exportar PDF
              </button>
            </div>
          </>
        )}
      </div>

      {/* Render selected view panel */}
      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <RefreshCw size={40} className="text-blue-500 animate-spin" />
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div 
            key={localActiveView}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {localActiveView === 'financial-fluxo' && renderFluxodeCaixa()}
            {localActiveView === 'financial-cartoes' && renderCartoes()}
            {localActiveView === 'financial-contas' && renderContas()}
            {localActiveView === 'financial-conciliacao' && renderConciliacao()}
            {localActiveView === 'financial-categorias' && renderCategorias()}
            {localActiveView === 'financial-pagamentos' && renderContasPagarReceber()}
            {localActiveView === 'financial-centrocusto' && renderCentroCusto()}
            {localActiveView === 'financial-relatorios' && renderRelatorios()}
            {(localActiveView === 'financial-extrato' || localActiveView === 'financial' || localActiveView === 'financial-extrato') && renderExtrato()}
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
             {modalType === 'transaction' ? (
               <div className="bg-white rounded-[28px] w-full max-w-lg shadow-2xl relative z-10 overflow-hidden animate-in zoom-in duration-200">
                 {/* 1. Modal type: Transaction creation */}
                 <div className="flex items-center justify-between px-7 pt-7 pb-4 border-b border-slate-100">
                   <h2 className="text-base font-bold text-slate-800">
                     {editingTransaction ? 'Editar Lançamento' : 'Novo Lançamento'}
                   </h2>
                   <button onClick={handleCloseModal} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors">
                     <X size={18} />
                   </button>
                 </div>
                 <div className="px-7 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
                      <div>
                        <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Descrição do Lançamento*</label>
                        <input 
                          type="text" placeholder="Ex: Aluguel do escritório, Tráfego Pago..." 
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-100 transition-all font-medium text-slate-800"
                          value={newTransaction.description} 
                          onChange={(e) => setNewTransaction({...newTransaction, description: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Tipo*</label>
                        <select 
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-100 transition-all font-medium text-slate-700"
                          value={newTransaction.type}
                          onChange={(e) => {
                            const selectedType = e.target.value as TransactionType;
                            setNewTransaction({
                              ...newTransaction, 
                              type: selectedType,
                              category_id: '' // Clear category when type changes
                            });
                          }}
                        >
                          <option value={TransactionType.INCOME}>Receita</option>
                          <option value={TransactionType.EXPENSE}>Despesa</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Valor (R$)*</label>
                          <input 
                            type="text" placeholder="0,00" 
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-100 transition-all font-bold text-slate-800"
                            value={amountInputStr} 
                            onChange={(e) => {
                              const val = e.target.value;
                              setAmountInputStr(val);
                            }}
                            onBlur={handleAmountBlur}
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
                          <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Conta Bancária*</label>
                          {accounts.length === 0 ? (
                            <div className="mt-1 p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-700 font-semibold space-y-2">
                              <p>Nenhuma conta cadastrada. Cadastre uma conta antes de lançar.</p>
                              <button
                                type="button"
                                onClick={() => {
                                  setIsModalOpen(false);
                                  setTimeout(() => {
                                    const btn = Array.from(document.querySelectorAll('button, a')).find(el => 
                                      el.textContent?.toUpperCase().includes('CONTAS BANCÁRIAS') || 
                                      el.textContent?.includes('Contas Bancárias')
                                    );
                                    if (btn) (btn as HTMLElement).click();
                                  }, 100);
                                }}
                                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
                              >
                                Ir para Contas Bancárias
                              </button>
                            </div>
                          ) : (
                            <select 
                              className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-100 transition-all font-medium text-slate-700"
                              value={newTransaction.account_id || ''}
                              required
                              onChange={(e) => {
                                const val = e.target.value;
                                setNewTransaction({
                                  ...newTransaction,
                                  account_id: val
                                });
                              }}
                            >
                              <option value="">Selecione...</option>
                              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                          )}
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

                      {/* Recorrência */}
                      {!editingTransaction && (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Recorrência</label>
                            <select 
                              className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-100 transition-all font-medium text-slate-700"
                              value={recurrenceType}
                              onChange={(e) => setRecurrenceType(e.target.value as any)}
                            >
                              <option value="NONE">Não repetir</option>
                              <option value="WEEKLY">Semanal</option>
                              <option value="MONTHLY">Mensal</option>
                              <option value="YEARLY">Anual</option>
                            </select>
                          </div>
                          {recurrenceType !== 'NONE' && (
                            <div>
                              <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Repetir por X períodos</label>
                              <input 
                                type="number" 
                                min={1}
                                max={60}
                                className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-100 transition-all font-medium text-slate-800"
                                value={recurrencePeriods}
                                onChange={(e) => setRecurrencePeriods(Math.max(1, Number(e.target.value)))}
                              />
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex items-center gap-2 py-2">
                        <input 
                          type="checkbox" 
                          id="markAsPaid"
                          className="rounded text-blue-600 focus:ring-blue-400 cursor-pointer w-4 h-4"
                          checked={markAsPaid}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setMarkAsPaid(checked);
                            if (checked) {
                              setNewTransaction(prev => ({
                                ...prev,
                                status: TransactionStatus.PAID,
                                payment_date: prev.payment_date || new Date().toISOString().split('T')[0]
                              }));
                            } else {
                              setNewTransaction(prev => ({
                                ...prev,
                                status: TransactionStatus.PENDING,
                                payment_date: undefined
                              }));
                            }
                          }}
                        />
                        <label htmlFor="markAsPaid" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                          {newTransaction.type === TransactionType.INCOME ? 'Marcar como Recebido' : 'Marcar como Pago'}
                        </label>
                      </div>

                      {markAsPaid && (
                        <div>
                          <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Data do Pagamento*</label>
                          <input 
                            type="date" 
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-100 transition-all font-medium text-slate-700"
                            value={newTransaction.payment_date || new Date().toISOString().split('T')[0]} 
                            onChange={(e) => setNewTransaction({...newTransaction, payment_date: e.target.value})}
                          />
                        </div>
                      )}

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
                 <div className="px-7 py-5 bg-slate-50 flex justify-end gap-3">
                   <button onClick={handleCloseModal} className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-100 transition-colors">
                     Cancelar
                   </button>
                   <button 
                     onClick={handleCreateTransaction}
                     className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-lg shadow-blue-100 transition-colors"
                   >
                     Confirmar Lançamento
                   </button>
                 </div>
               </div>
             ) : (
               <motion.div 
                 initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                 className="bg-white rounded-3xl w-full max-w-lg shadow-2xl relative z-10 p-8 overflow-hidden"
               >
                {/* 2. Modal type: Account creation */}
                {modalType === 'account' && (
                  <div>
                    <h2 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
                       <Landmark className="text-blue-500" size={24} />
                       {editingAccount ? 'Editar Conta Bancária' : 'Adicionar Nova Conta'}
                    </h2>
                    <div className="space-y-4">
                      <div>
                        <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase mb-2 block">Banco</label>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-100">
                          {BANKS.map(b => {
                            const isSelected = newAccount.bank_code === b.code;
                            return (
                              <button
                                key={b.code}
                                type="button"
                                onClick={() => {
                                  setNewAccount(prev => ({
                                    ...prev,
                                    bank_code: b.code,
                                    color: b.color // "Usar a cor automaticamente"
                                  }));
                                }}
                                className={`flex flex-col items-center justify-center p-2 rounded-lg border text-center transition-all cursor-pointer ${
                                  isSelected 
                                    ? 'border-blue-500 bg-blue-50/50 shadow-sm' 
                                    : 'border-slate-100 bg-white hover:border-slate-200'
                                }`}
                              >
                                <span 
                                  className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white mb-1"
                                  style={{ backgroundColor: b.color }}
                                >
                                  {b.initials}
                                </span>
                                <span className="text-[10px] font-extrabold text-slate-700 truncate w-full">
                                  {b.name}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

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

                      <div>
                        <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Grupo / Agrupamento (Opcional)</label>
                        <input 
                          type="text" placeholder="Ex: Despesas Fixas, Receitas Operacionais, Impostos..." 
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 outline-none text-slate-800"
                          value={newCategory.group_name} 
                          onChange={(e) => setNewCategory({...newCategory, group_name: e.target.value})}
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
             )}
          </div>
        )}
      </AnimatePresence>

      {/* CSV Import Preview Modal */}
      <AnimatePresence>
        {isCsvModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
              onClick={() => setIsCsvModalOpen(false)}
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-lg shadow-2xl relative z-10 p-8 overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-6">
                <FileText className="text-blue-500" size={24} />
                <h2 className="text-xl font-black text-slate-900">
                  Visualizar Categorias a Importar
                </h2>
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                <p className="text-xs font-medium text-slate-500 mb-2">
                  As seguintes categorias foram detectadas no arquivo CSV. Verifique os dados antes de prosseguir com a importação:
                </p>
                {csvPreview.map((item, idx) => (
                  <div key={idx} className="p-3 border border-slate-100 rounded-xl flex items-center justify-between gap-4 bg-slate-50/50">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="text-sm font-bold text-slate-800">{item.name}</span>
                      </div>
                      {item.group_name && (
                        <p className="text-[10px] font-semibold text-slate-400 mt-1 uppercase tracking-wider">
                          Grupo: {item.group_name}
                        </p>
                      )}
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                      item.type === TransactionType.INCOME 
                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                        : 'bg-rose-50 text-rose-600 border border-rose-100'
                    }`}>
                      {item.type === TransactionType.INCOME ? 'Receita' : 'Despesa'}
                    </span>
                  </div>
                ))}
              </div>
              
              <div className="flex gap-4 mt-8 pt-4 border-t border-slate-100">
                <button onClick={() => setIsCsvModalOpen(false)} className="flex-1 font-bold text-slate-400 text-sm">Cancelar</button>
                <button 
                  onClick={handleConfirmCsvImport}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-black py-3 rounded-xl shadow-lg shadow-blue-100 text-sm"
                >
                  Confirmar Importação
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom ConfirmModal */}
      <AnimatePresence>
        {confirmModalOpen && (
          <div className="fixed inset-0 z-[99] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
              onClick={() => setConfirmModalOpen(false)}
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-md shadow-2xl relative z-10 p-8 overflow-hidden flex flex-col"
            >
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-6">
                <AlertCircle className="text-rose-500 animate-pulse" size={24} />
                <h2 className="text-lg font-black text-slate-900 uppercase tracking-wide">
                  {confirmModalTitle}
                </h2>
              </div>
              
              <div className="text-sm font-semibold text-slate-500 mb-8 leading-relaxed">
                {confirmModalMessage}
              </div>
              
              <div className="flex gap-4">
                <button 
                  onClick={() => setConfirmModalOpen(false)} 
                  className="flex-1 py-3 text-slate-500 bg-slate-50 hover:bg-slate-100 font-bold text-sm rounded-xl transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => {
                    if (onConfirmAction) onConfirmAction();
                    setConfirmModalOpen(false);
                  }}
                  className={`flex-1 font-black py-3 rounded-xl shadow-lg text-sm transition-all cursor-pointer ${confirmModalConfirmColor}`}
                >
                  {confirmModalConfirmText}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Global Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[100] bg-slate-900 text-white px-6 py-3.5 rounded-2xl shadow-xl flex items-center gap-3 animate-fadeIn border border-slate-800">
          <span className={`w-2.5 h-2.5 rounded-full animate-pulse ${toast.type === 'error' ? 'bg-rose-500' : 'bg-emerald-500'}`} />
          <p className="text-sm font-black tracking-wide">{toast.message}</p>
        </div>
      )}
    </div>
  );
};

export default Financial;
