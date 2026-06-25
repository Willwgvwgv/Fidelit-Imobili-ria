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
  X
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
  const [quickCategoryId, setQuickCategoryId] = useState<string>('');
  const [quickAccountId, setQuickAccountId] = useState<string>('');
  const [quickDescription, setQuickDescription] = useState<string>('');

  const [editingAccount, setEditingAccount] = useState<FinancialAccount | null>(null);
  const [editingCategory, setEditingCategory] = useState<FinancialCategory | null>(null);

  // Extrato dynamic states
  const [currentPeriod, setCurrentPeriod] = useState<Date>(new Date(2026, 3, 1)); // Default: Abril de 2026
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
      color: category.color || '#f43f5e',
      group_name: categoryGroups[category.id] || ''
    });
    setModalType('category');
    setIsModalOpen(true);
  };

  const handleDeleteCategory = (categoryId: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta categoria?')) {
      setCategories(prev => prev.filter(c => c.id !== categoryId));
    }
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

  const handleDeleteTransaction = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este lançamento?')) {
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
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedTxIds.length === 0) return;
    if (window.confirm(`Tem certeza que deseja excluir os ${selectedTxIds.length} lançamentos selecionados?`)) {
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
      setImportedFile(null);
      setReconciliationItems([]);
      setSelectedImportedIndex(null);
      setSelectedSystemTxId(null);
      setMatchedPairs([]);
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

    // 2. Map payload properties, converting empty UUID values to null
    const payload = {
      ...newTransaction,
      amount: parsedAmount,
      agency_id: currentUser.agencyId,
      account_id: !newTransaction.account_id || newTransaction.account_id === '' ? null : newTransaction.account_id,
      financial_account_id: !newTransaction.account_id || newTransaction.account_id === '' ? null : newTransaction.account_id,
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
        // local fallback update
        setTransactions(prev => prev.map(t => t.id === editingTransaction.id ? { ...t, ...payload } : t));
        setIsModalOpen(false);
        setEditingTransaction(null);
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
        // Fallback local or services without direct supabase access
        const result = await supabaseService.createFinancialTransaction(payload);
        if (result) {
          if (copiesToCreate.length > 0) {
            const mockCopies = copiesToCreate.map((c, i) => ({
              id: 'tx-local-rec-' + i + '-' + Math.random().toString(36).substr(2, 9),
              created_at: new Date().toISOString(),
              ...c
            }));
            setTransactions(prev => [result, ...mockCopies, ...prev]);
          } else {
            setTransactions(prev => [result, ...prev]);
          }
          setIsModalOpen(false);
          loadFinancialData();
        } else {
          // Entirely local fallback
          const mockResult: FinancialTransaction = {
            id: 'tx-local-' + Math.random().toString(36).substr(2, 9),
            created_at: new Date().toISOString(),
            ...payload
          };
          const mockCopies = copiesToCreate.map((c, i) => ({
            id: 'tx-local-rec-' + i + '-' + Math.random().toString(36).substr(2, 9),
            created_at: new Date().toISOString(),
            ...c
          }));
          setTransactions(prev => [mockResult, ...mockCopies, ...prev]);
          setIsModalOpen(false);
        }
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

    const payload: any = {
      agency_id: currentUser.agencyId,
      name: newAccount.name,
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
      const mockResult: any = {
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
      const desc = columns[descIdx];
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
      
      parsed.push({
        id: 'ext-' + Math.random().toString(36).substr(2, 9),
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
      
      if (dtpostedMatch && trnamtMatch) {
        const rawDate = dtpostedMatch[1];
        const year = rawDate.substring(0, 4);
        const month = rawDate.substring(4, 6);
        const day = rawDate.substring(6, 8);
        const dateStr = `${year}-${month}-${day}`;
        
        const desc = memoMatch ? memoMatch[1].trim() : 'Transação Bancária';
        const rawAmt = parseFloat(trnamtMatch[1].trim());
        const amount = Math.abs(rawAmt);
        const type = rawAmt < 0 ? TransactionType.EXPENSE : TransactionType.INCOME;
        
        parsed.push({
          id: 'ext-' + Math.random().toString(36).substr(2, 9),
          date: dateStr,
          description: desc,
          amount,
          type,
          matched: false
        });
      }
    }
    
    if (parsed.length === 0) {
      const dtMatches = [...text.matchAll(/<DTPOSTED>(\d{8})/gi)];
      const memoMatches = [...text.matchAll(/<MEMO>([^<\r\n]+)/gi)];
      const amtMatches = [...text.matchAll(/<TRNAMT>([^<\r\n]+)/gi)];
      
      const count = Math.min(dtMatches.length, memoMatches.length, amtMatches.length);
      for (let i = 0; i < count; i++) {
        const rawDate = dtMatches[i][1];
        const year = rawDate.substring(0, 4);
        const month = rawDate.substring(4, 6);
        const day = rawDate.substring(6, 8);
        
        const desc = memoMatches[i][1].trim();
        const rawAmt = parseFloat(amtMatches[i][1].trim());
        const amount = Math.abs(rawAmt);
        const type = rawAmt < 0 ? TransactionType.EXPENSE : TransactionType.INCOME;
        
        parsed.push({
          id: 'ext-' + Math.random().toString(36).substr(2, 9),
          date: `${year}-${month}-${day}`,
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
      } else {
        parsed = parseCsvExtrato(text);
      }
      
      if (parsed.length > 0) {
        setImportedFile(file.name);
        setReconciliationItems(parsed);
        setSelectedImportedIndex(0);
        setSelectedSystemTxId(null);
        showToast(`${parsed.length} lançamentos extraídos do extrato bancário!`, 'success');
      } else {
        showToast('Não foi possível identificar lançamentos no arquivo. Verifique o layout.', 'error');
      }
    };
    reader.readAsText(file);
  };

  // Open OFX or CSV statement template
  const handleBankfileImport = () => {
    setImportedFile('extrato_demonstrativo_abril_2026.ofx');
    setReconciliationItems([
      { id: 'ext-demo-1', date: '2026-04-10', description: 'CRED PIX LOTEAMENTO SOL', amount: 35000, type: TransactionType.INCOME, matched: false },
      { id: 'ext-demo-2', date: '2026-04-15', description: 'DEB PAGAMENTO GOOGLE ADS', amount: 4800, type: TransactionType.EXPENSE, matched: false },
      { id: 'ext-demo-3', date: '2026-04-20', description: 'DEB TARIFA MENSALIDADE CONTA', amount: 75, type: TransactionType.EXPENSE, matched: false },
      { id: 'ext-demo-4', date: '2026-04-22', description: 'CRED INFRAESTRUTURA REF', amount: 6200, type: TransactionType.INCOME, matched: false }
    ]);
    setSelectedImportedIndex(0);
    setSelectedSystemTxId(null);
    showToast('Extrato demonstrativo carregado com sucesso!', 'success');
  };

  // Perform a reconciliation pairing
  const handlePairReconciliation = async () => {
    if (selectedImportedIndex === null || !selectedSystemTxId) return;

    const imported = reconciliationItems[selectedImportedIndex];
    const systemTx = transactions.find(t => t.id === selectedSystemTxId);

    if (systemTx) {
      await supabaseService.updateTransactionStatus(systemTx.id, TransactionStatus.PAID);
      
      setMatchedPairs(prev => [...prev, { importedIdx: selectedImportedIndex, systemId: selectedSystemTxId }]);
      setReconciliationItems(prev => prev.map((item, idx) => idx === selectedImportedIndex ? { ...item, matched: true, matchedTxId: selectedSystemTxId } : item));
      setTransactions(prev => prev.map(t => t.id === selectedSystemTxId ? { ...t, status: TransactionStatus.PAID, payment_date: imported.date } : t));

      showToast('Conciliação realizada e lançamento liquidado!', 'success');
      setSelectedImportedIndex(null);
      setSelectedSystemTxId(null);
    }
  };

  const handleQuickCreateAndReconcile = async () => {
    if (selectedImportedIndex === null) return;
    const importedItem = reconciliationItems[selectedImportedIndex];
    
    if (!quickCategoryId || !quickAccountId) {
      showToast('Selecione uma categoria e uma conta para o lançamento.', 'error');
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
      const result = await supabaseService.createFinancialTransaction(payload);
      if (result) {
        setMatchedPairs(prev => [...prev, { importedIdx: selectedImportedIndex, systemId: result.id }]);
        setReconciliationItems(prev => prev.map((item, idx) => idx === selectedImportedIndex ? { ...item, matched: true, matchedTxId: result.id } : item));
        setTransactions(prev => [result, ...prev]);
        showToast('Lançamento criado e conciliado com sucesso!', 'success');
      } else {
        const mockId = 'tx-local-' + Math.random().toString(36).substr(2, 9);
        const mockTx: FinancialTransaction = {
          id: mockId,
          created_at: new Date().toISOString(),
          ...payload
        };
        setMatchedPairs(prev => [...prev, { importedIdx: selectedImportedIndex, systemId: mockId }]);
        setReconciliationItems(prev => prev.map((item, idx) => idx === selectedImportedIndex ? { ...item, matched: true, matchedTxId: mockId } : item));
        setTransactions(prev => [mockTx, ...prev]);
        showToast('Lançamento criado (local) e conciliado com sucesso!', 'success');
      }
      setSelectedImportedIndex(null);
      setSelectedSystemTxId(null);
      setQuickDescription('');
    } catch (err) {
      console.error(err);
      showToast('Erro ao criar lançamento rápido.', 'error');
    } finally {
      setLoading(false);
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
                    className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
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
              <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl relative">
                <button 
                  onClick={() => {
                    setCurrentPeriod(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
                  }}
                  className="p-1 px-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title="Mês Anterior"
                >
                  <ChevronLeft size={16} />
                </button>
                
                <div 
                  onClick={() => {
                    monthInputRef.current?.showPicker ? monthInputRef.current.showPicker() : monthInputRef.current?.click();
                  }}
                  className="text-xs font-black uppercase tracking-wider text-slate-800 px-2 min-w-[120px] text-center cursor-pointer hover:bg-slate-200/60 py-1 rounded-lg transition-colors relative flex items-center justify-center"
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
                  className="p-1 px-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title="Próximo Mês"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
            
            <div className="flex items-center gap-3 relative">
              {/* Additional Filter Button with Dropdown */}
              <div className="relative">
                <button 
                  onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                  className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors bg-white font-bold text-sm px-4 py-2 border border-slate-100 rounded-xl shadow-sm cursor-pointer"
                >
                  <Filter size={18} />
                  <span>Filtrar</span>
                </button>
                
                {isFilterDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsFilterDropdownOpen(false)} />
                    <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-100 rounded-2xl shadow-xl p-4 z-20 space-y-4">
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

              <button className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors bg-white font-bold text-sm px-4 py-2 border border-slate-100 rounded-xl shadow-sm cursor-pointer">
                <Download size={18} />
                <span>Exportar CSV</span>
              </button>
            </div>
          </div>

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
                          {(!tx.account_id && !tx.financial_account_id) || !account ? (
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
                          isPaid ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-amber-50 text-amber-600 border border-amber-100'
                        }`}>
                          {isPaid ? 'Liquidado' : 'Pendente'}
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
        <div className="flex items-center justify-between">
          <div />
          <button 
            onClick={() => {
              setModalType('account');
              setIsModalOpen(true);
            }}
            className="flex items-center gap-1.5 bg-slate-900 text-white rounded-lg px-3 py-1.5 text-xs font-bold hover:bg-slate-800 transition-all shadow-sm cursor-pointer"
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
            const bank = getAccountBank(account);
            const circleColor = bank ? bank.color : (account.color || '#3b82f6');

            return (
              <div key={account.id} className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: circleColor }} />
                    <span className="px-2 py-0.5 rounded bg-slate-50 border border-slate-100 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                      {account.is_default ? 'Principal' : (account.type?.toUpperCase() === 'CREDIT_CARD' || account.type === 'credit_card' ? 'Cartão de Crédito' : account.type || 'Conta')}
                    </span>
                  </div>
                  {bank && (
                    <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-slate-500 mb-1 uppercase tracking-wider">
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-black">
                        {bank.initials}
                      </span>
                      <span>{bank.name}</span>
                    </div>
                  )}
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
                    className="flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-blue-600 transition-colors px-2.5 py-1.5 bg-slate-50 hover:bg-blue-50 rounded-lg cursor-pointer"
                  >
                    <Pencil size={11} /> Editar
                  </button>
                  <button 
                    onClick={() => handleDeleteAccount(account.id)}
                    className="flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-rose-600 transition-colors px-2.5 py-1.5 bg-slate-50 hover:bg-rose-50 rounded-lg cursor-pointer"
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
    // Dynamic KPI Calculations
    const importedBalance = reconciliationItems.reduce((acc, item) => {
      return acc + (item.type === TransactionType.INCOME ? item.amount : -item.amount);
    }, 0);

    const systemBalance = transactions.reduce((acc, tx) => {
      return acc + (tx.type === TransactionType.INCOME ? tx.amount : -tx.amount);
    }, 0);

    const kpiDiff = importedBalance - systemBalance;
    const countConciliated = reconciliationItems.filter(item => item.matched).length;
    const countPending = reconciliationItems.filter(item => !item.matched).length;

    const pendingSystemTxs = transactions.filter(t => t.status === TransactionStatus.PENDING && !matchedPairs.some(p => p.systemId === t.id));

    // Suggestions function for selected item
    const getMatchSuggestions = (importedItem: any) => {
      if (!importedItem) return [];
      
      const suggestions = transactions
        .filter(tx => tx.status === TransactionStatus.PENDING && !matchedPairs.some(p => p.systemId === tx.id))
        .map(tx => {
          if (tx.type !== importedItem.type) {
            return { tx, score: 0 };
          }
          
          let valueScore = 0;
          const diffVal = Math.abs(tx.amount - importedItem.amount);
          
          if (diffVal < 0.01) {
            valueScore = 60;
          } else {
            const diffPct = diffVal / importedItem.amount;
            if (diffPct <= 0.05) {
              valueScore = Math.max(0, (1 - diffPct / 0.05) * 60);
            }
          }
          
          let dateScore = 0;
          const txDate = new Date(tx.due_date);
          const impDate = new Date(importedItem.date);
          const diffTime = Math.abs(txDate.getTime() - impDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          if (diffDays === 0) {
            dateScore = 40;
          } else if (diffDays <= 7) {
            dateScore = Math.max(0, (1 - diffDays / 7) * 40);
          }
          
          const totalScore = Math.round(valueScore + dateScore);
          return { tx, score: totalScore };
        })
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score);
        
      return suggestions;
    };

    const activeImportedItem = selectedImportedIndex !== null ? reconciliationItems[selectedImportedIndex] : null;
    const suggestions = activeImportedItem ? getMatchSuggestions(activeImportedItem) : [];

    // If an item is selected from right side, calculate compatibility for manual pairing
    const selectedSystemTx = selectedSystemTxId ? transactions.find(t => t.id === selectedSystemTxId) : null;
    let manualCompatibilityScore = 0;
    if (activeImportedItem && selectedSystemTx) {
      if (selectedSystemTx.type === activeImportedItem.type) {
        let valScore = 0;
        const diffVal = Math.abs(selectedSystemTx.amount - activeImportedItem.amount);
        if (diffVal < 0.01) valScore = 60;
        else if (diffVal / activeImportedItem.amount <= 0.05) valScore = (1 - (diffVal / (activeImportedItem.amount * 0.05))) * 60;

        let dateScore = 0;
        const txDate = new Date(selectedSystemTx.due_date);
        const impDate = new Date(activeImportedItem.date);
        const diffTime = Math.abs(txDate.getTime() - impDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays === 0) dateScore = 40;
        else if (diffDays <= 7) dateScore = (1 - diffDays / 7) * 40;

        manualCompatibilityScore = Math.round(valScore + dateScore);
      }
    }

    return (
      <div className="space-y-6">
        {/* Dynamic Conciliation Dashboard */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm text-center">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Saldo Extrato</p>
            <p className="text-xl font-black text-slate-800">{formatCurrency(importedBalance)}</p>
            <p className="text-[10px] text-slate-400 font-medium mt-1">Soma do extrato carregado</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm text-center">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Saldo Sistema</p>
            <p className="text-xl font-black text-slate-800">{formatCurrency(systemBalance)}</p>
            <p className="text-[10px] text-slate-400 font-medium mt-1">Soma de lançamentos ERP</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm text-center">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Diferença</p>
            <p className={`text-xl font-black ${Math.abs(kpiDiff) < 0.01 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {formatCurrency(kpiDiff)}
            </p>
            <p className="text-[10px] text-slate-400 font-medium mt-1">Diferença entre saldos</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm text-center">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Conciliado</p>
            <p className="text-xl font-black text-emerald-600">{countConciliated}</p>
            <p className="text-[10px] text-slate-400 font-medium mt-1">Lançamentos vinculados</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm text-center">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Pendências</p>
            <p className="text-xl font-black text-amber-600">{countPending}</p>
            <p className="text-[10px] text-slate-400 font-medium mt-1">Aguardando conciliação</p>
          </div>
        </div>

        {/* Workspace Layout */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-6">
            <div>
              <p className="text-xs text-slate-400 font-medium">Selecione lançamentos para realizar o vínculo ou crie novos em lote.</p>
            </div>
            
            <div className="flex items-center gap-3">
              {importedFile && (
                <button 
                  onClick={handleAutoConciliation}
                  className="flex items-center gap-2 bg-emerald-600 text-white rounded-xl px-4 py-2 text-xs font-bold hover:bg-emerald-700 transition-all shadow-md cursor-pointer"
                >
                  <Sparkles size={14} /> Auto-Conciliar Inteligente
                </button>
              )}
              {importedFile && (
                <button 
                  onClick={() => {
                    setImportedFile(null);
                    setReconciliationItems([]);
                    setSelectedImportedIndex(null);
                    setSelectedSystemTxId(null);
                  }}
                  className="flex items-center gap-1 bg-slate-100 text-slate-600 rounded-xl px-3 py-2 text-xs font-bold hover:bg-slate-200 transition-all cursor-pointer"
                  title="Trocar Extrato"
                >
                  <Trash2 size={13} /> Limpar
                </button>
              )}
            </div>
          </div>

          {!importedFile ? (
            <div className="border-4 border-dashed border-slate-100 py-24 rounded-3xl flex flex-col items-center justify-center text-center hover:bg-slate-50/50 transition-all relative">
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
              <div className="h-16 w-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4 relative z-20 pointer-events-none">
                <Upload size={32} />
              </div>
              <p className="font-black text-slate-700 text-sm relative z-20 pointer-events-none">Arraste seu extrato bancário aqui ou clique para selecionar</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2 relative z-20 pointer-events-none">Suporta formatos OFX e CSV de qualquer banco</p>
              <div className="mt-6 flex gap-3 relative z-20">
                <button 
                  type="button" 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleBankfileImport();
                  }}
                  className="px-4 py-2.5 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800 transition-all shadow-sm cursor-pointer"
                >
                  Carregar Extrato de Demonstração
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              {/* 1. Left Column: Statement Items */}
              <div className="xl:col-span-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    Extrato Bancário ({importedFile})
                  </span>
                  <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded font-bold text-slate-500">
                    {reconciliationItems.length} itens
                  </span>
                </div>

                <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl max-h-[500px] overflow-y-auto bg-slate-50/20">
                  {reconciliationItems.map((item, idx) => {
                    const isSelected = selectedImportedIndex === idx;
                    return (
                      <div 
                        key={item.id || idx} 
                        onClick={() => setSelectedImportedIndex(idx)}
                        className={`p-4 flex flex-col justify-between cursor-pointer transition-all ${
                          item.matched 
                            ? 'bg-emerald-50/20 opacity-65 border-l-4 border-emerald-500' 
                            : isSelected 
                              ? 'bg-blue-50/80 border-l-4 border-blue-500 shadow-inner' 
                              : 'hover:bg-slate-50/50 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-bold text-slate-400">
                            {new Date(item.date).toLocaleDateString('pt-BR')}
                          </span>
                          <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                            item.type === TransactionType.INCOME 
                              ? 'text-emerald-600 bg-emerald-50 border border-emerald-100/50' 
                              : 'text-rose-600 bg-rose-50 border border-rose-100/50'
                          }`}>
                            {item.type === TransactionType.INCOME ? 'Entrada' : 'Saída'}
                          </span>
                        </div>
                        <div className="flex items-end justify-between gap-2">
                          <p className={`font-bold text-slate-800 text-xs truncate max-w-[180px] ${item.matched ? 'line-through text-slate-400' : ''}`}>
                            {item.description}
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

              {/* 2. Center Column: Match suggestions and forms */}
              <div className="xl:col-span-4 bg-slate-50/50 rounded-2xl p-5 border border-slate-100 space-y-4">
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
                    <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-2">
                      <span className="text-[9px] bg-blue-50 text-blue-600 font-bold px-2 py-0.5 rounded uppercase tracking-wider">Transação do Banco</span>
                      <h4 className="text-sm font-black text-slate-800 leading-tight">{activeImportedItem.description}</h4>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400 font-semibold">Data: {new Date(activeImportedItem.date).toLocaleDateString('pt-BR')}</span>
                        <span className={`font-black ${activeImportedItem.type === TransactionType.INCOME ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {activeImportedItem.type === TransactionType.INCOME ? '+' : '-'} {formatCurrency(activeImportedItem.amount)}
                        </span>
                      </div>
                    </div>

                    {activeImportedItem.matched ? (
                      <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4 text-center space-y-2">
                        <CheckCircle2 size={24} className="text-emerald-500 mx-auto" />
                        <p className="text-xs font-black text-emerald-800 uppercase tracking-wider">Transação Conciliada</p>
                        <p className="text-[10px] text-slate-500 font-medium">Esta transação bancária já foi vinculada e liquidada no ERP com sucesso.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* 1. Intelligent Suggestions */}
                        <div className="space-y-2">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Sugestões de Vínculo</span>
                          
                          <div className="space-y-2">
                            {suggestions.map(({ tx, score }) => {
                              const isChecked = selectedSystemTxId === tx.id;
                              return (
                                <div 
                                  key={tx.id}
                                  onClick={() => setSelectedSystemTxId(tx.id)}
                                  className={`p-3 bg-white rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-3 ${
                                    isChecked 
                                      ? 'border-blue-500 ring-2 ring-blue-50 bg-blue-50/10' 
                                      : 'border-slate-100 hover:border-slate-200'
                                  }`}
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 mb-1">
                                      <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${
                                        score >= 90 ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                                      }`}>
                                        {score}% compatível
                                      </span>
                                      <span className="text-[9px] font-medium text-slate-400">{new Date(tx.due_date).toLocaleDateString('pt-BR')}</span>
                                    </div>
                                    <p className="text-xs font-bold text-slate-700 truncate">{tx.description}</p>
                                  </div>
                                  <div className="text-right flex-shrink-0">
                                    <p className="text-xs font-black text-slate-800">{formatCurrency(tx.amount)}</p>
                                    <span className="text-[8px] font-semibold text-slate-400 uppercase">Aberto</span>
                                  </div>
                                </div>
                              );
                            })}
                            
                            {suggestions.length === 0 && (
                              <div className="p-4 bg-white border border-slate-100 rounded-xl text-center">
                                <AlertCircle size={16} className="text-amber-500 mx-auto mb-1" />
                                <p className="text-[10px] font-bold text-slate-500 uppercase">Nenhuma sugestão automática encontrada</p>
                                <p className="text-[9px] text-slate-400 mt-0.5">Use o painel à direita para vincular manualmente ou crie um lançamento abaixo.</p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Confirmation button for suggestions/selections */}
                        {selectedSystemTx && (selectedSystemTx.type === activeImportedItem.type) && (
                          <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 space-y-2">
                            <p className="text-[10px] font-black text-blue-800 uppercase tracking-wider">Confirmar Conciliação</p>
                            <p className="text-[10px] text-slate-600 font-medium leading-relaxed">
                              Vincular o extrato com o lançamento ERP <strong className="text-slate-800">"{selectedSystemTx.description}"</strong>?
                            </p>
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 mb-2">
                              <span>Compatibilidade:</span>
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-black ${
                                manualCompatibilityScore >= 80 ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                              }`}>{manualCompatibilityScore}%</span>
                            </div>
                            <button 
                              onClick={handlePairReconciliation}
                              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black text-xs py-2.5 rounded-xl shadow-md cursor-pointer text-center"
                            >
                              Confirmar Vínculo e Liquidar
                            </button>
                          </div>
                        )}

                        {/* 2. Quick Create Form */}
                        <div className="bg-white border border-slate-100 rounded-xl p-4 space-y-3">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Ou Criar Novo Lançamento Rápido</span>
                          
                          <div className="space-y-3.5">
                            <div>
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">Descrição do Lançamento</label>
                              <input 
                                type="text"
                                placeholder={activeImportedItem.description}
                                value={quickDescription}
                                onChange={(e) => setQuickDescription(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-100 rounded-xl p-2.5 text-xs outline-none text-slate-800"
                              />
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">Categoria</label>
                                <select 
                                  value={quickCategoryId}
                                  onChange={(e) => setQuickCategoryId(e.target.value)}
                                  className="w-full bg-slate-50 border border-slate-100 rounded-xl p-2.5 text-xs outline-none text-slate-800"
                                >
                                  <option value="">Selecione...</option>
                                  {categories.filter(c => c.type === activeImportedItem.type).map(cat => (
                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">Conta Bancária</label>
                                <select 
                                  value={quickAccountId}
                                  onChange={(e) => setQuickAccountId(e.target.value)}
                                  className="w-full bg-slate-50 border border-slate-100 rounded-xl p-2.5 text-xs outline-none text-slate-800"
                                >
                                  <option value="">Selecione...</option>
                                  {accounts.map(acc => (
                                    <option key={acc.id} value={acc.id}>{acc.name}</option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            <button 
                              onClick={handleQuickCreateAndReconcile}
                              disabled={loading}
                              className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-black text-xs py-2.5 rounded-xl shadow-sm cursor-pointer text-center"
                            >
                              {loading ? 'Criando...' : 'Salvar no Sistema e Conciliar'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 3. Right Column: System transactions for matching */}
              <div className="xl:col-span-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    Lançamentos no Sistema (Abertos)
                  </span>
                  <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded font-bold text-slate-500">
                    {pendingSystemTxs.length} pendentes
                  </span>
                </div>

                <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl max-h-[500px] overflow-y-auto bg-slate-50/20">
                  {pendingSystemTxs.map((tx) => {
                    const isSelected = selectedSystemTxId === tx.id;
                    const cat = categories.find(c => c.id === tx.category_id);
                    return (
                      <div 
                        key={tx.id} 
                        onClick={() => setSelectedSystemTxId(tx.id)}
                        className={`p-4 flex flex-col justify-between cursor-pointer transition-all ${
                          isSelected 
                            ? 'bg-blue-50/80 border-l-4 border-blue-500 shadow-inner' 
                            : 'hover:bg-slate-50/50 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-bold text-slate-400">
                            Vence em {new Date(tx.due_date).toLocaleDateString('pt-BR')}
                          </span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                            tx.type === TransactionType.INCOME ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'
                          }`}>
                            {tx.type === TransactionType.INCOME ? 'Receita' : 'Despesa'}
                          </span>
                        </div>
                        <div className="flex items-end justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-bold text-slate-800 text-xs truncate max-w-[180px]">{tx.description}</p>
                            {cat && (
                              <p className="text-[9px] font-semibold text-slate-400 uppercase mt-0.5" style={{ color: cat.color }}>
                                {cat.name}
                              </p>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="font-black text-xs text-slate-700">{formatCurrency(tx.amount)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {pendingSystemTxs.length === 0 && (
                    <div className="p-8 text-center text-slate-400 uppercase tracking-widest text-xs font-bold">
                      Sem lançamentos abertos restantes
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
        <div className="flex items-center justify-between">
          <div />
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg px-3 py-1.5 text-xs font-bold hover:bg-slate-50 transition-all shadow-sm cursor-pointer">
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
              className="flex items-center gap-1.5 bg-slate-900 text-white rounded-lg px-3 py-1.5 text-xs font-bold hover:bg-slate-800 transition-all shadow-sm cursor-pointer"
            >
              <Plus size={14} /> Nova Categoria
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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

  return (
    <div className="space-y-6 pb-20">
      {/* Dynamic Subheader matching requested view */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {(activeView === 'financial-extrato' || activeView === 'financial') && (
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
                                  account_id: val,
                                  financial_account_id: val
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
