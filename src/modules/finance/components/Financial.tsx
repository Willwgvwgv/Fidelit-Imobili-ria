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
  ChevronDown,
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
  Activity,
  FileDown,
  ArrowLeft,
  History
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';
import { BankLogo, getNormalizedBankCode } from '../../../components/BankLogo';
import {
  User,
  FinancialAccount,
  FinancialCategory,
  FinancialTransaction,
} from '../../../../types';
import { TransactionType, TransactionStatus } from '../constants';
import { supabaseService, FinancialAccountInsert } from '../../../../services/supabaseService';
import { supabase } from '../../../../supabase';
import { RecurrenceEditModal } from './financial/RecurrenceEditModal';
import { PayInvoiceModal } from './financial/PayInvoiceModal';
import { InvoiceDetailsModal } from './financial/InvoiceDetailsModal';
import { useAccounts } from '../hooks/useAccounts';
import { useFinancialCategories } from '../hooks/useFinancialCategories';
import { useFinancialTransactions } from '../hooks/useFinancialTransactions';
import { useRecurringTransactions } from '../hooks/useRecurringTransactions';
import { useInvoicePayment } from '../hooks/useInvoicePayment';
import { parseBrlValue, parseBRL, formatBRL, formatCurrency, isCreditTransaction, getTransactionValueColor } from '../utils/currency';
import { addPeriodToDate, getLocalTodayStr, formatDateBR, parseDateSafe } from '../utils/dates';
import { getAccountLiveBalance as calcAccountLiveBalance } from '../domain/BalanceCalculator';
import { HeaderTooltip } from './HeaderTooltip';
import { FinancialKpiHeaderCards } from './FinancialKpiHeaderCards';
import * as InvoiceDomain from '../domain/InvoiceCalculator';
import { getPreference, setPreference } from '@/src/utils/preferences';
import { Conciliacao } from './Conciliacao';
import { ImportarExtrato } from './ImportarExtrato';
import { FluxoCaixa } from './FluxoCaixa';
import { ImportarImobia } from './ImportarImobia';
import { Cartoes } from './Cartoes'; // Component from Cartoes.tsx
import { ContasBancarias } from './ContasBancarias';
import { ContaBancariaDetalhe } from './ContaBancariaDetalhe';
import { TransferBadge } from '../../../components/TransferBadge';

function escapeHtml(input: unknown): string {
  if (input == null) return "";
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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
  const { accounts, setAccounts, loadAccounts } = useAccounts();
  const { categories, setCategories, loadCategories } = useFinancialCategories();
  const { transactions, setTransactions, loadTransactions } = useFinancialTransactions();
  const [loading, setLoading] = useState(true);

  const getAccountBank = (account: FinancialAccount) => {
    const bankCode = (account as any).bank_code;
    if (!bankCode) return null;
    const norm = getNormalizedBankCode(bankCode);
    return BANKS.find(b => b.code === bankCode || b.code === norm) || null;
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | TransactionType>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'transaction' | 'account' | 'category' | 'card'>('transaction');
  const [responsibleClient, setResponsibleClient] = useState('');

  // Input states for form submissions
  const [newTransaction, setNewTransaction] = useState<Partial<FinancialTransaction>>({
    type: TransactionType.EXPENSE,
    amount: 0,
    description: '',
    due_date: getLocalTodayStr(),
    status: TransactionStatus.PENDING,
    agency_id: currentUser.agencyId
  });

  const [newAccount, setNewAccount] = useState({
    name: '',
    initial_balance: '' as string | number,
    current_balance: '' as string | number,
    type: 'Corrente',
    color: '#2563eb',
    is_default: false,
    credit_limit: '' as string | number,
    bank_code: '',
    closing_day: '' as string | number,
    due_day: '' as string | number
  });

  const [newCategory, setNewCategory] = useState({
    name: '',
    type: TransactionType.EXPENSE,
    color: '#f43f5e',
    group_name: '',
    affects_dre: true
  });

  // Local mapping for category group names: { [categoryId]: groupName }
  const [categoryGroups, setCategoryGroups] = useState<Record<string, string>>({});

  useEffect(() => {
    getPreference<Record<string, string>>('financial_category_groups', {})
      .then(setCategoryGroups);
  }, []);

  // Whenever categoryGroups changes, persist it to user_preferences
  useEffect(() => {
    if (Object.keys(categoryGroups).length > 0) {
      setPreference('financial_category_groups', categoryGroups).catch(console.error);
    }
  }, [categoryGroups]);

  // Toast notification state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // CSV Import States
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [csvPreview, setCsvPreview] = useState<Array<{ name: string; type: TransactionType; color: string; group_name: string }>>([]);

  // Reconciliation workspace states
  const [importedFile, setImportedFile] = useState<string | null>(null);
  const [reconciliationItems, setReconciliationItems] = useState<any[]>([]);
  const [currentImportGroupId, setCurrentImportGroupId] = useState<string>('');
  const [isReconciliationConcluded, setIsReconciliationConcluded] = useState<boolean>(false);
  const [currentFileExternalIds, setCurrentFileExternalIds] = useState<string[]>([]);
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
  const [accountTypeFilter, setAccountTypeFilter] = useState<'all' | 'bank' | 'card'>('all');
  const [editingCategory, setEditingCategory] = useState<FinancialCategory | null>(null);

  // Lancar Extrato modal states
  const [isLancarExtratoModalOpen, setIsLancarExtratoModalOpen] = useState(false);
  const [lancarExtratoAccount, setLancarExtratoAccount] = useState('');
  const [lancarExtratoType, setLancarExtratoType] = useState<'credit' | 'debit'>('credit');
  const [lancarExtratoDate, setLancarExtratoDate] = useState(new Date().toISOString().split('T')[0]);
  const [lancarExtratoAmount, setLancarExtratoAmount] = useState('');
  const [lancarExtratoDescription, setLancarExtratoDescription] = useState('');
  const [submittingLancarExtrato, setSubmittingLancarExtrato] = useState(false);

  const handleOpenLancarExtratoModal = () => {
    if (accounts.length > 0) {
      setLancarExtratoAccount(accounts[0].id);
    }
    setLancarExtratoType('credit');
    setLancarExtratoDate(new Date().toISOString().split('T')[0]);
    setLancarExtratoAmount('');
    setLancarExtratoDescription('');
    setIsLancarExtratoModalOpen(true);
  };

  const handleCreateLancarExtrato = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lancarExtratoAccount) {
      showToast('Selecione uma conta bancária', 'error');
      return;
    }
    const val = parseFloat(lancarExtratoAmount.replace(',', '.'));
    if (isNaN(val) || val <= 0) {
      showToast('Informe um valor numérico positivo', 'error');
      return;
    }
    if (!lancarExtratoDescription.trim()) {
      showToast('Informe uma descrição', 'error');
      return;
    }

    setSubmittingLancarExtrato(true);
    try {
      if (!supabase) throw new Error('Supabase não inicializado');

      const targetAccount = accounts.find(a => a.id === lancarExtratoAccount);
      const agencyId = currentUser?.agencyId || targetAccount?.agency_id || '';

      const uuidVal = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).substring(2, 8));
      const fitid = 'MANUAL-' + uuidVal;

      const { error: insertErr } = await supabase.from('bank_transactions').insert({
        agency_id: agencyId,
        account_id: lancarExtratoAccount,
        date: lancarExtratoDate,
        amount: Math.abs(val),
        description: lancarExtratoDescription.trim(),
        type: lancarExtratoType,
        ofx_fitid: fitid,
        status: 'pending',
      });

      if (insertErr) throw insertErr;

      showToast('Lançamento criado', 'success');
      setIsLancarExtratoModalOpen(false);
      loadFinancialData();
    } catch (err: any) {
      console.error('Erro ao criar lançamento manual:', err);
      showToast(err.message || 'Erro ao criar lançamento', 'error');
    } finally {
      setSubmittingLancarExtrato(false);
    }
  };

  // Extrato dynamic states
  const monthInputRef = useRef<HTMLInputElement>(null);
  const [currentPeriod, setCurrentPeriod] = useState<Date>(new Date());
  const [periodMode, setPeriodMode] = useState<'ALL' | 'THIS_MONTH' | 'LAST_MONTH' | 'CUSTOM'>('THIS_MONTH');
  const [visibleCount, setVisibleCount] = useState<number>(20);
  const [kpiFilter, setKpiFilter] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [accountFilter, setAccountFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'OVERDUE' | 'PAID'>('ALL');
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [selectedTxIds, setSelectedTxIds] = useState<string[]>([]);
  const [editingTransaction, setEditingTransaction] = useState<FinancialTransaction | null>(null);

  // New states for form formatting, recurrence, payment, and transfer
  const [amountInputStr, setAmountInputStr] = useState<string>('');
  const [destinationAccountId, setDestinationAccountId] = useState<string>('');
  const {
    recurrenceType,
    setRecurrenceType,
    recurrencePeriods,
    setRecurrencePeriods,
    isRecurrenceEditModalOpen,
    setIsRecurrenceEditModalOpen,
    recurrenceEditOption,
    setRecurrenceEditOption,
    recurrenceEditPayload,
    setRecurrenceEditPayload,
    handleConfirmRecurrenceEdit
  } = useRecurringTransactions(loadFinancialData);
  const [markAsPaid, setMarkAsPaid] = useState<boolean>(false);
  const [isSubmittingTransaction, setIsSubmittingTransaction] = useState<boolean>(false);
  const [isAutoFilledFromBank, setIsAutoFilledFromBank] = useState<boolean>(false);

  // Pay Credit Card Invoice States
  const {
    payInvoiceModalOpen,
    setPayInvoiceModalOpen,
    payInvoiceSourceAccountId,
    setPayInvoiceSourceAccountId,
    payInvoiceAmountStr,
    setPayInvoiceAmountStr,
    payInvoiceDate,
    setPayInvoiceDate,
    selectedCardForPayment,
    setSelectedCardForPayment,
    resetInvoicePaymentStates
  } = useInvoicePayment();

  // Card invoice details states
  const [selectedCardForDetails, setSelectedCardForDetails] = useState<FinancialAccount | null>(null);
  const [selectedCardForHistory, setSelectedCardForHistory] = useState<FinancialAccount | null>(null);
  const [detailPeriod, setDetailPeriod] = useState<Date>(new Date());
  const [paymentInvoicePeriod, setPaymentInvoicePeriod] = useState<Date>(new Date());
  const [showMismatchConfirm, setShowMismatchConfirm] = useState<boolean>(false);
  const [expandedYears, setExpandedYears] = useState<Record<number, boolean>>({ [new Date().getFullYear()]: true });

  // Card invoice import and quick launch states
  const cardFileInputRef = useRef<HTMLInputElement>(null);
  const importHeaderCheckboxRef = useRef<HTMLInputElement>(null);
  const [importingCard, setImportingCard] = useState<FinancialAccount | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importedLines, setImportedLines] = useState<Array<{
    id: string;
    date: string;
    description: string;
    amount: number;
    categoryId: string;
    isDuplicate: boolean;
    isBalanceAdjustment?: boolean;
    selected?: boolean;
  }>>([]);
  const [defaultImportCategoryId, setDefaultImportCategoryId] = useState<string>('');

  useEffect(() => {
    if (importHeaderCheckboxRef.current) {
      const selectedCount = importedLines.filter(line => line.selected !== false).length;
      const totalCount = importedLines.length;
      importHeaderCheckboxRef.current.indeterminate = selectedCount > 0 && selectedCount < totalCount;
    }
  }, [importedLines]);

  const [quickLaunchCard, setQuickLaunchCard] = useState<FinancialAccount | null>(null);
  const [isQuickLaunchModalOpen, setIsQuickLaunchModalOpen] = useState(false);
  const [quickLaunchData, setQuickLaunchData] = useState({
    description: '',
    amountStr: '',
    categoryId: '',
    dueDate: getLocalTodayStr()
  });

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
    return calcAccountLiveBalance(account, transactions);
  };

  // Helper to calculate interest and penalty for overdue pending rent income
  const calculateInterestAndPenalty = (tx: FinancialTransaction) => {
    const hoje = getLocalTodayStr();
    if (tx.status !== TransactionStatus.PENDING || tx.type !== TransactionType.INCOME || !tx.due_date || tx.due_date >= hoje) {
      return null;
    }

    // Não deve rodar para transferências internas
    if (tx.is_transfer || tx.transfer_group_id) {
      return null;
    }

    // Validação estrita de categoria: deve ser INCOME e conter "aluguel" no nome
    const category = categories.find(c => c.id === tx.category_id);
    if (!category) {
      return null;
    }

    const catNameLower = category.name.toLowerCase();
    if (!catNameLower.includes('aluguel')) {
      return null;
    }

    // Proteção adicional contra ajustes de caixa ou descrições de transferências
    const descLower = (tx.description || '').toLowerCase();
    if (descLower.includes('ajuste de caixa') || descLower.includes('transferência') || descLower.includes('transferencia')) {
      return null;
    }

    const t1 = new Date(hoje + 'T12:00:00').getTime();
    const t2 = new Date(tx.due_date + 'T12:00:00').getTime();
    const diasAtraso = Math.floor((t1 - t2) / (1000 * 60 * 60 * 24));
    if (diasAtraso <= 0) return null;

    const multaValor = tx.amount * 0.10; // 10% multa moratória
    const jurosValor = tx.amount * (0.00033 * diasAtraso); // 1% ao mês pro-rata dia
    const acrescimoTotal = multaValor + jurosValor;
    const totalComJuros = tx.amount + acrescimoTotal;

    return {
      diasAtraso,
      multaValor,
      jurosValor,
      acrescimoTotal,
      totalComJuros
    };
  };

  const [launchingPenaltyId, setLaunchingPenaltyId] = useState<string | null>(null);

  const handleCreatePenaltyTransaction = async (
    originalTx: FinancialTransaction,
    info: { diasAtraso: number; multaValor: number; jurosValor: number; acrescimoTotal: number }
  ) => {
    if (!supabase) {
      showToast('Conexão com o banco de dados indisponível.', 'error');
      return;
    }

    setLaunchingPenaltyId(originalTx.id);
    try {
      const hoje = getLocalTodayStr();

      // 1. Resolve or create dedicated category for Multas e Juros Recebidos
      let penaltyCategoryId = '';
      const existingPenaltyCat = categories.find(
        c => c.type === TransactionType.INCOME &&
        (c.name.toLowerCase().includes('multa') || c.name.toLowerCase().includes('juros'))
      );

      if (existingPenaltyCat) {
        penaltyCategoryId = existingPenaltyCat.id;
      } else {
        // Create new dedicated category
        const { data: newCatData, error: catError } = await supabase
          .from('financial_categories')
          .insert([{
            name: 'Multas e Juros Recebidos',
            type: TransactionType.INCOME,
            description: 'Receitas provenientes de multas contratuais e juros de mora por atraso de pagamento'
          }])
          .select();

        if (catError) {
          console.error('Error creating dedicated penalty category:', catError);
        } else if (newCatData && newCatData.length > 0) {
          penaltyCategoryId = newCatData[0].id;
          await loadCategories();
        }
      }

      const penaltyPayload = {
        type: TransactionType.INCOME,
        amount: Math.round(info.acrescimoTotal * 100) / 100,
        description: `Multa/Juros — ${originalTx.description} — atraso de ${info.diasAtraso} ${info.diasAtraso === 1 ? 'dia' : 'dias'}`,
        account_id: originalTx.account_id || null,
        category_id: penaltyCategoryId || null,
        contact_name: originalTx.contact_name || null,
        status: TransactionStatus.PENDING,
        due_date: hoje,
        notes: `Multa (10% = ${formatCurrency(info.multaValor)}) + Juros (${info.diasAtraso}d = ${formatCurrency(info.jurosValor)}) ref. ao lançamento original [ORIGINAL_TX:${originalTx.id}]`
      };

      const { data, error } = await supabase
        .from('financial_transactions')
        .insert([penaltyPayload])
        .select();

      if (error) {
        console.error('Error creating penalty transaction:', error);
        showToast('Erro ao lançar multa/juros: ' + error.message, 'error');
      } else {
        showToast('Multa/Juros lançada com sucesso!', 'success');
        if (data && data.length > 0) {
          setTransactions(prev => [data[0], ...prev]);
        }
        loadFinancialData();
      }
    } catch (err: any) {
      console.error('Error in handleCreatePenaltyTransaction:', err);
      showToast('Erro ao lançar multa/juros.', 'error');
    } finally {
      setLaunchingPenaltyId(null);
    }
  };

  const [localActiveView, setLocalActiveView] = useState<string>(activeView);
  const [selectedAccountIdForDetail, setSelectedAccountIdForDetail] = useState<string | null>(null);
  const [centroCustoTab, setCentroCustoTab] = useState<'todos' | 'despesas' | 'receitas'>('todos');

  useEffect(() => {
    if (activeView === 'financial-conciliacao' || activeView === 'financial-importar-extrato') {
      setLocalActiveView('financial-contas');
      if (accounts.length > 0 && !selectedAccountIdForDetail) {
        const def = accounts.find((a) => a.is_default) || accounts[0];
        setSelectedAccountIdForDetail(def.id);
      }
    } else {
      setLocalActiveView(activeView);
    }
  }, [activeView, accounts]);

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setIsAutoFilledFromBank(false);
    setEditingAccount(null);
    setEditingCategory(null);
    setEditingTransaction(null);
    setAmountInputStr('');
    setDestinationAccountId('');
    setRecurrenceType('NONE');
    setRecurrencePeriods(1);
    setMarkAsPaid(false);
    setResponsibleClient('');
    setIsRecurrenceEditModalOpen(false);
    setRecurrenceEditOption('single');
    setRecurrenceEditPayload(null);
    resetInvoicePaymentStates();
    setNewAccount({
      name: '',
      initial_balance: '',
      current_balance: '',
      type: 'Corrente',
      color: '#2563eb',
      is_default: false,
      credit_limit: '',
      bank_code: '',
      closing_day: '',
      due_day: ''
    });
    setNewCategory({
      name: '',
      type: TransactionType.EXPENSE,
      color: '#f43f5e',
      group_name: '',
      affects_dre: true
    });
  };

  useEffect(() => {
    if (isModalOpen && modalType === 'transaction') {
      if (editingTransaction) {
        setAmountInputStr(editingTransaction.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
        setMarkAsPaid(editingTransaction.status === TransactionStatus.PAID);
        setResponsibleClient(editingTransaction.contact_name || '');
      } else if (!isAutoFilledFromBank) {
        setAmountInputStr('');
        setMarkAsPaid(false);
        setResponsibleClient('');
      }
    }
  }, [isModalOpen, editingTransaction, modalType, isAutoFilledFromBank]);

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
    const currentBal = account.current_balance !== undefined && account.current_balance !== null
      ? account.current_balance
      : (account.initial_balance || 0);

    setNewAccount({
      name: account.name,
      initial_balance: account.initial_balance !== undefined && account.initial_balance !== null ? formatBRL(account.initial_balance) : '',
      current_balance: formatBRL(currentBal),
      type: account.type || 'Corrente',
      color: account.color || '#2563eb',
      is_default: account.is_default || false,
      credit_limit: account.credit_limit ? formatBRL(account.credit_limit) : '',
      bank_code: existingBankCode,
      closing_day: account.closing_day || '',
      due_day: account.due_day || ''
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
        tx.due_date ? formatDateBR(tx.due_date) : '',
        tx.payment_date ? formatDateBR(tx.payment_date) : '',
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
        const pendingItems = reconciliationItems.filter(item => !item.matched);
        const pendingExternalIds = pendingItems.map(item => item.external_id || item.id).filter(Boolean);

        const success = await supabaseService.deletePendingReconciliationItems(pendingExternalIds);
        if (success) {
          showToast('Lançamentos pendentes do extrato limpos com sucesso!', 'success');

          const remainingItems = reconciliationItems.filter(item => item.matched);
          const remainingIds = remainingItems.map(item => item.external_id || item.id).filter(Boolean);
          setCurrentFileExternalIds(remainingIds);
          setReconciliationItems(remainingItems);

          if (remainingItems.length > 0) {
            setImportedFile('Extrato Salvo');
          } else {
            setImportedFile(null);
            setOfxBankName(null);
            setOfxAgency(null);
            setOfxAccount(null);
            setOfxPeriod(null);
          }

          setSelectedImportedIndex(null);
          setSelectedSystemTxId(null);
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
      group_name: categoryGroups[category.id] || '',
      affects_dre: category.affects_dre ?? true
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
    setSelectedCardForDetails(null);
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

  const handleDuplicateTransaction = (tx: FinancialTransaction) => {
    setSelectedCardForDetails(null);
    setEditingTransaction(null);
    setNewTransaction({
      type: tx.type,
      amount: tx.amount,
      description: `${tx.description} (Cópia)`,
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
  async function loadFinancialData() {
    setLoading(true);
    try {
      const [accs, cats, txs] = await Promise.all([
        loadAccounts(),
        loadCategories(),
        loadTransactions()
      ]);
    } catch (error) {
      console.error('Erro ao buscar dados do Supabase:', error);
    } finally {
      setLoading(false);
    }
  }

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
      if (currentFileExternalIds.length > 0) {
        supabaseService.getReconciliationItemsByExternalIds(currentFileExternalIds).then(items => {
          if (items.length > 0) {
            setReconciliationItems(items);
            setImportedFile('Extrato Salvo');
            setSelectedImportedIndex(null);

            const isConcluded = items.every(item => item.status === 'CONCLUDED');
            setIsReconciliationConcluded(isConcluded);
          }
        });
      } else {
        setReconciliationItems([]);
        setImportedFile(null);
        setSelectedImportedIndex(null);
        setIsReconciliationConcluded(false);
      }
    }
  }, [activeView, currentFileExternalIds]);
  // Compute stats dynamically for current period (selected month/year)
  const stats = useMemo(() => {
    const todayStr = getLocalTodayStr();
    const startOfYear = currentPeriod.getFullYear();
    const startOfMonth = currentPeriod.getMonth();

    const periodTxs = transactions.filter(t => {
      const parts = t.due_date.split('-');
      const txYear = parseInt(parts[0], 10);
      const txMonth = parseInt(parts[1], 10) - 1;
      const matchesPeriod = txYear === startOfYear && txMonth === startOfMonth;
      if (!matchesPeriod) return false;

      // Filter by category
      if (categoryFilter !== 'ALL' && t.category_id !== categoryFilter) {
        return false;
      }

      // Filter by account
      if (accountFilter !== 'ALL' && t.account_id !== accountFilter) {
        return false;
      }

      return true;
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
  }, [transactions, currentPeriod, categoryFilter, accountFilter]);

  const calcDaysDiff = (d1Str: string, d2Str: string): number => {
    if (!d1Str || !d2Str) return 0;
    const t1 = new Date(d1Str + 'T12:00:00').getTime();
    const t2 = new Date(d2Str + 'T12:00:00').getTime();
    return Math.floor((t1 - t2) / (1000 * 60 * 60 * 24));
  };

  // Filters for current period, type, category, search term, and active KPI card click
  const filteredTransactions = useMemo(() => {
    const todayStr = getLocalTodayStr();
    const selYear = currentPeriod.getFullYear();
    const selMonthIdx = currentPeriod.getMonth();

    const isInSelectedMonth = (dateStr: string) => {
      if (!dateStr) return false;
      const parts = dateStr.split('-');
      if (parts.length !== 3) return false;
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      return y === selYear && m === selMonthIdx;
    };

    return transactions.filter(t => {
      // 1. KPI Filter overrides month filter for global cards
      if (kpiFilter) {
        const normKpi = kpiFilter.toLowerCase();
        if (normKpi === 'vencidos') {
          const isOverdue = t.status === TransactionStatus.PENDING && t.due_date < todayStr;
          if (!isOverdue) return false;
        } else if (normKpi === 'hoje' || normKpi === 'vencem hoje') {
          const isToday = t.status === TransactionStatus.PENDING && t.due_date === todayStr;
          if (!isToday) return false;
        } else if (normKpi === 'proximos7') {
          const diff = calcDaysDiff(t.due_date, todayStr);
          const isNext7 = t.status === TransactionStatus.PENDING && diff > 0 && diff <= 7;
          if (!isNext7) return false;
        } else if (normKpi === 'avencer' || normKpi === 'avencer_receber' || normKpi === 'a vencer') {
          const diff = calcDaysDiff(t.due_date, todayStr);
          const isAvencer = t.status === TransactionStatus.PENDING && isInSelectedMonth(t.due_date) && diff >= 8;
          if (!isAvencer) return false;
        } else if (normKpi === 'pagos') {
          if (t.status !== TransactionStatus.PAID || !isInSelectedMonth(t.due_date)) return false;
        }
      } else {
        // Default: filter list strictly by selected month unless periodMode is ALL
        if (periodMode !== 'ALL' && !isInSelectedMonth(t.due_date)) {
          return false;
        }
      }

      // 2. Search Term
      const matchesSearch = !searchTerm || t.description.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;

      // 3. Type Filter (Todos / Receitas / Despesas)
      const matchesType = typeFilter === 'ALL' || t.type === typeFilter;
      if (!matchesType) return false;

      // 4. Category Filter from dropdown
      if (categoryFilter !== 'ALL' && t.category_id !== categoryFilter) {
        return false;
      }

      // 4b. Account Filter from dropdown
      if (accountFilter !== 'ALL' && t.account_id !== accountFilter) {
        return false;
      }

      // 4c. Status Filter from dropdown (Todos / Em Aberto / Vencido / Pago)
      if (statusFilter !== 'ALL') {
        const isPaid = t.status === TransactionStatus.PAID;
        const isOverdue = t.status === TransactionStatus.PENDING && Boolean(t.due_date && t.due_date < todayStr);
        const isOpen = t.status === TransactionStatus.PENDING;

        if (statusFilter === 'PAID' && !isPaid) return false;
        if (statusFilter === 'OVERDUE' && !isOverdue) return false;
        if (statusFilter === 'OPEN' && !isOpen) return false;
      }

      return true;
    });
  }, [transactions, searchTerm, typeFilter, currentPeriod, periodMode, kpiFilter, categoryFilter, accountFilter, statusFilter]);



  // Toggle transaction status
  const handleToggleStatus = async (tx: FinancialTransaction) => {
    const newStatus = tx.status === TransactionStatus.PAID ? TransactionStatus.PENDING : TransactionStatus.PAID;
    const success = await supabaseService.updateTransactionStatus(tx.id, newStatus);
    if (success) {
      loadFinancialData();
    } else {
      // update state locally for robust presentation even if network delays
      setTransactions(prev => prev.map(t => t.id === tx.id ? { ...t, status: newStatus, payment_date: newStatus === TransactionStatus.PAID ? getLocalTodayStr() : null as any } : t));
    }
  };

  // Submit handlings
  const handleCreateTransaction = async () => {
    if (isSubmittingTransaction) return;

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

    setIsSubmittingTransaction(true);

    try {
      // 2. Map payload properties, converting empty UUID values to null
      let dueDateVal = newTransaction.due_date;
      if (!dueDateVal) {
        dueDateVal = getLocalTodayStr();
      }

      const cleanPaymentDate = markAsPaid ? (newTransaction.payment_date || getLocalTodayStr()) : null;
      const computedStatus = cleanPaymentDate ? TransactionStatus.PAID : TransactionStatus.PENDING;

      const payload = {
        ...newTransaction,
        amount: parsedAmount,
        agency_id: currentUser.agencyId,
        account_id: !newTransaction.account_id || newTransaction.account_id === '' ? null : newTransaction.account_id,
        category_id: !newTransaction.category_id || newTransaction.category_id === '' ? null : newTransaction.category_id,
        due_date: dueDateVal,
        status: computedStatus,
        payment_date: cleanPaymentDate,
        contact_name: responsibleClient && responsibleClient.trim() !== '' ? responsibleClient.trim() : null
      } as any;

      // 4. Generate recurrences using the precise monthly/yearly helper
      const copiesToCreate: any[] = [];
      if (recurrenceType !== 'NONE' && recurrencePeriods > 0 && !editingTransaction) {
        const recurrenceGroupId = crypto.randomUUID();
        payload.recurrence_group_id = recurrenceGroupId;
        for (let i = 1; i <= recurrencePeriods; i++) {
          const nextDueDate = addPeriodToDate(payload.due_date, recurrenceType, i);
          copiesToCreate.push({
            ...payload,
            due_date: nextDueDate,
            description: payload.description,
            status: TransactionStatus.PENDING,
            payment_date: null
          });
        }
      }

      // Handle Transfer Type (Linked Pair of Transactions)
      if (newTransaction.type === TransactionType.TRANSFER && !editingTransaction) {
        if (!destinationAccountId) {
          alert('Por favor, selecione a Conta Bancária de Destino para a transferência.');
          setIsSubmittingTransaction(false);
          return;
        }
        if (destinationAccountId === newTransaction.account_id) {
          alert('A Conta de Origem e a Conta de Destino devem ser diferentes.');
          setIsSubmittingTransaction(false);
          return;
        }

        const sourceAcc = accounts.find(a => a.id === newTransaction.account_id);
        const destAcc = accounts.find(a => a.id === destinationAccountId);
        const transferGroupId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).substring(2, 8));

        // Handle Transfer Type (Linked Pair of Transactions with rollback)
        const outgoingPayload = {
          ...payload,
          account_id: newTransaction.account_id,
          type: TransactionType.EXPENSE,
          is_transfer: true,
          transfer_group_id: transferGroupId,
          description: newTransaction.description || `Transferência para ${destAcc?.name || 'Conta Destino'}`,
        };

        const incomingPayload = {
          ...payload,
          account_id: destinationAccountId,
          type: TransactionType.INCOME,
          is_transfer: true,
          transfer_group_id: transferGroupId,
          description: newTransaction.description ? `${newTransaction.description} (Recebido)` : `Transferência de ${sourceAcc?.name || 'Conta Origem'}`,
        };

        if (supabase) {
          try {
            // Atomic batch insert: inserts both records in a single array payload to Postgres
            const { data: insertedData, error: insertError } = await supabase
              .from('financial_transactions')
              .insert([outgoingPayload, incomingPayload])
              .select('id');

            if (insertError) {
              throw new Error(insertError.message);
            }

            // Verify both were created; if only 1 created, perform compensation rollback
            if (!insertedData || insertedData.length < 2) {
              if (insertedData && insertedData.length > 0) {
                const insertedIds = insertedData.map(d => d.id);
                await supabase.from('financial_transactions').delete().in('id', insertedIds);
              }
              throw new Error('Falha ao registrar ambos os lados da transferência bancária.');
            }

            showToast('Transferência entre contas criada com sucesso!', 'success');
            setIsModalOpen(false);
            setDestinationAccountId('');
            loadFinancialData();
          } catch (err: any) {
            console.error('Error creating transfer transactions:', err);
            // Safety rollback using transfer_group_id in case any partial insertion exists
            try {
              await supabase
                .from('financial_transactions')
                .delete()
                .eq('transfer_group_id', transferGroupId);
            } catch (rbErr) {
              console.error('Failed to cleanup orphaned transfer transactions:', rbErr);
            }
            alert('Erro ao criar transferência bancária: ' + (err.message || 'Falha na gravação.'));
          }
        } else {
          alert('Conexão com o banco de dados indisponível.');
        }
        setIsSubmittingTransaction(false);
        return;
      }

      if (editingTransaction) {
        if (supabase) {
          if (editingTransaction.recurrence_group_id) {
            setRecurrenceEditPayload(payload);
            setRecurrenceEditOption('single');
            setIsRecurrenceEditModalOpen(true);
          } else {
            const success = await supabaseService.updateFinancialTransaction(editingTransaction.id, payload);

            if (!success) {
              alert('Erro ao atualizar lançamento.');
            } else {
              setIsModalOpen(false);
              setEditingTransaction(null);
              loadFinancialData();
            }
          }
        } else {
          alert('Conexão com o banco de dados indisponível.');
        }
      } else {
        // Insertion of new transactions or recurring batches
        if (supabase) {
          if (copiesToCreate.length > 0) {
            // Batch insertion returning created rows to prevent manual reload
            let { data, error } = await supabase
              .from('financial_transactions')
              .insert([payload, ...copiesToCreate])
              .select();

            if (error && error.message?.includes('bank_transaction_id')) {
              const { bank_transaction_id, ...cleanPayload } = payload;
              const cleanCopies = copiesToCreate.map(c => {
                const { bank_transaction_id: _, ...rest } = c;
                return rest;
              });
              const retry = await supabase
                .from('financial_transactions')
                .insert([cleanPayload, ...cleanCopies])
                .select();
              data = retry.data;
              error = retry.error;
            }

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
            const targetBankTxId = payload.bank_transaction_id;
            let { data, error } = await supabase
              .from('financial_transactions')
              .insert([payload])
              .select();

            if (error && error.message?.includes('bank_transaction_id')) {
              const { bank_transaction_id, ...cleanPayload } = payload;
              const retry = await supabase
                .from('financial_transactions')
                .insert([cleanPayload])
                .select();
              data = retry.data;
              error = retry.error;
            }

            if (error) {
              console.error('Error creating transaction:', error);
              alert('Erro ao criar lançamento: ' + error.message);
            } else {
              if (data && data.length > 0) {
                setTransactions(prev => [data[0], ...prev]);
              }
              if (targetBankTxId) {
                const createdTxId = data && data[0] ? data[0].id : null;
                await supabase.from('bank_transactions').update({
                  status: 'matched',
                  matched_type: payload.type === TransactionType.EXPENSE ? 'expense' : 'income',
                  matched_id: createdTxId,
                  matched_at: new Date().toISOString()
                }).eq('id', targetBankTxId);
              }
              setIsAutoFilledFromBank(false);
              setIsModalOpen(false);
              loadFinancialData(); // Background refresh to update accounts/balances
            }
          }
        } else {
          alert('Conexão com o banco de dados indisponível.');
        }
      }
    } catch (err: any) {
      console.error('Error in handleCreateTransaction:', err);
      alert('Erro inesperado: ' + err.message);
    } finally {
      setIsSubmittingTransaction(false);
    }
  };

  const getPendingInvoiceAmount = (cardId: string) => {
    const card = accounts.find(a => a.id === cardId);
    return InvoiceDomain.getPendingInvoiceAmount(cardId, card, transactions, currentPeriod);
  };

  const getInvoiceTransactions = (cardId: string, period: Date) => {
    const card = accounts.find(a => a.id === cardId);
    return InvoiceDomain.getInvoiceTransactions(cardId, card, transactions, period);
  };

  const getInvoiceTotalAmount = (cardId: string, period: Date) => {
    const card = accounts.find(a => a.id === cardId);
    return InvoiceDomain.getInvoiceTotalAmount(cardId, card, transactions, period);
  };

  const getInvoiceStatus = (cardId: string, period: Date) => {
    const card = accounts.find(a => a.id === cardId);
    return InvoiceDomain.getInvoiceStatus(cardId, card, transactions, period);
  };

  const normalizeCategoryName = (name: string): string => {
    return name
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // remove accents
      .replace(/\s+/g, ' '); // remove duplicate spaces
  };

  const getPurchaseInvoicePeriodStr = (dueDateStr: string, card: FinancialAccount) => {
    return InvoiceDomain.getPurchaseInvoicePeriodStr(dueDateStr, card, currentPeriod);
  };

  const getInvoicePeriodForDate = (dueDateStr: string, card: FinancialAccount): Date => {
    const parts = dueDateStr.split('-');
    if (parts.length < 3) {
      return new Date();
    }
    const yr = parseInt(parts[0], 10);
    const mo = parseInt(parts[1], 10); // 1-indexed
    const dy = parseInt(parts[2], 10);

    const closingDay = card.closing_day;
    if (!closingDay || closingDay < 1 || closingDay > 31) {
      return new Date(yr, mo - 1, 1);
    }

    if (dy <= closingDay) {
      return new Date(yr, mo - 1, 1);
    } else {
      return new Date(yr, mo, 1);
    }
  };

  const getCardCompetencies = (card: FinancialAccount): Date[] => {
    const periodsMap = new Map<string, Date>();

    // Add only months from actual transactions that belong to this card
    const cardTxs = transactions.filter(t => t.account_id === card.id);
    cardTxs.forEach(tx => {
      const dateStr = tx.due_date || tx.payment_date;
      if (dateStr) {
        const p = getInvoicePeriodForDate(dateStr, card);
        const key = `${p.getFullYear()}-${p.getMonth()}`;
        if (!periodsMap.has(key)) {
          periodsMap.set(key, p);
        }
      }
    });

    // Sort periods in descending order (newest first)
    return Array.from(periodsMap.values()).sort((a, b) => b.getTime() - a.getTime());
  };

  const handleOpenImportInvoiceModal = (card: FinancialAccount) => {
    setImportingCard(card);
    cardFileInputRef.current?.click();
  };

  const handleCardFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !importingCard) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      let parsed: any[] = [];
      if (file.name.toLowerCase().endsWith('.ofx')) {
        parsed = parseOfxExtrato(text);
      } else if (file.name.toLowerCase().endsWith('.csv')) {
        parsed = parseCsvExtrato(text);
      } else {
        showToast("Formato de arquivo não suportado. Use CSV ou OFX.", "error");
        return;
      }

      if (parsed.length === 0) {
        showToast("Nenhuma transação encontrada no arquivo.", "error");
        return;
      }

      const mapped = parsed.map(item => {
        const isDuplicate = transactions.some(t =>
          t.account_id === importingCard.id &&
          t.due_date === item.date &&
          Math.abs(t.amount - item.amount) < 0.01
        );

        const descLower = (item.description || '').toLowerCase();
        const obsLower = (item.observation || '').toLowerCase();

        let isBalanceAdjustment = false;
        if (obsLower) {
          if (obsLower.includes('fatura anterior') || obsLower.includes('saldo anterior')) {
            isBalanceAdjustment = true;
          } else if (obsLower.includes('pagamento') && (obsLower.includes('credito') || obsLower.includes('crédito'))) {
            isBalanceAdjustment = true;
          }
        }
        if (/^mdte\d+/.test(descLower)) {
          isBalanceAdjustment = true;
        }

        return {
          id: item.id || crypto.randomUUID(),
          date: item.date || getLocalTodayStr(),
          description: item.description || 'Transação Importada',
          amount: item.amount || 0,
          categoryId: '',
          isDuplicate,
          isBalanceAdjustment,
          selected: !isBalanceAdjustment
        };
      });

      setImportedLines(mapped);
      const defaultCat = categories.find(c => c.type === TransactionType.EXPENSE)?.id || '';
      setDefaultImportCategoryId(defaultCat);
      setIsImportModalOpen(true);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSaveImportedInvoice = async () => {
    if (!importingCard) return;
    setLoading(true);

    try {
      const transactionsToInsert = importedLines
        .filter(line => line.selected !== false)
        .map(line => ({
          type: TransactionType.EXPENSE,
          account_id: importingCard.id,
          status: TransactionStatus.PENDING,
          due_date: line.date,
          amount: line.amount,
          description: line.description,
          category_id: line.categoryId || defaultImportCategoryId || null,
          agency_id: currentUser.agencyId
        }));

      if (transactionsToInsert.length === 0) {
        showToast("Nenhum lançamento selecionado para importação.", "warning");
        setLoading(false);
        return;
      }

      if (supabase) {
        const promises = transactionsToInsert.map(tx => supabaseService.createFinancialTransaction(tx));
        const results = await Promise.all(promises);

        const total = transactionsToInsert.length;
        const successes = results.filter(r => r !== null).length;
        const failures = total - successes;

        if (failures > 0) {
          if (successes > 0) {
            showToast(`${successes} de ${total} lançamentos importados. ${failures} falharam.`, "warning");
            setIsImportModalOpen(false);
            setImportedLines([]);
            setImportingCard(null);
          } else {
            showToast("Falha ao importar os lançamentos da fatura.", "error");
          }
        } else {
          showToast(`Fatura importada com sucesso! ${successes} lançamentos adicionados.`, "success");
          setIsImportModalOpen(false);
          setImportedLines([]);
          setImportingCard(null);
        }
        await loadFinancialData();
      } else {
        showToast("Conexão com banco de dados indisponível.", "error");
      }
    } catch (err: any) {
      console.error("Error saving imported invoice:", err);
      showToast("Erro ao processar importação.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenQuickLaunchModal = (card: FinancialAccount) => {
    setQuickLaunchCard(card);
    const defaultCat = categories.find(c => c.type === TransactionType.EXPENSE)?.id || '';
    setQuickLaunchData({
      description: '',
      amountStr: '',
      categoryId: defaultCat,
      dueDate: getLocalTodayStr()
    });
    setIsQuickLaunchModalOpen(true);
  };

  const handleSaveQuickLaunch = async () => {
    if (!quickLaunchCard) return;
    const parsedAmt = parseBrlValue(quickLaunchData.amountStr);
    if (parsedAmt <= 0) {
      alert("Por favor, insira um valor válido maior que zero.");
      return;
    }
    if (!quickLaunchData.description.trim()) {
      alert("Por favor, insira uma descrição.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        type: TransactionType.EXPENSE,
        account_id: quickLaunchCard.id,
        status: TransactionStatus.PENDING,
        due_date: quickLaunchData.dueDate,
        amount: parsedAmt,
        description: quickLaunchData.description.trim(),
        category_id: quickLaunchData.categoryId || null,
        agency_id: currentUser.agencyId
      };

      if (supabase) {
        const result = await supabaseService.createFinancialTransaction(payload);

        if (!result) {
          showToast("Erro ao salvar lançamento rápido.", "error");
        } else {
          showToast("Lançamento rápido salvo com sucesso!", "success");
          setIsQuickLaunchModalOpen(false);
          setQuickLaunchCard(null);
          await loadFinancialData();
        }
      } else {
        showToast("Conexão com banco de dados indisponível.", "error");
      }
    } catch (err) {
      console.error("Error saving quick launch:", err);
      showToast("Erro ao processar lançamento.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPayInvoiceModal = (card: FinancialAccount, targetPeriod?: Date) => {
    const activePeriod = targetPeriod || currentPeriod;
    const pendingTxs = transactions.filter(t => {
      if (t.account_id !== card.id) return false;
      if (t.status !== TransactionStatus.PENDING) return false;
      return InvoiceDomain.isTxInCardInvoicePeriod(t.due_date, card, activePeriod);
    });

    if (pendingTxs.length === 0) {
      showToast("Não existem lançamentos pendentes nesta fatura.", "error");
      return;
    }

    const totalAmount = pendingTxs.reduce((sum, t) => sum + t.amount, 0);

    setSelectedCardForPayment(card);
    setPaymentInvoicePeriod(activePeriod);
    setPayInvoiceAmountStr(totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    setPayInvoiceDate(getLocalTodayStr());

    const firstBankAcc = accounts.find(a => a.type !== 'credit_card' && a.account_type !== 'credit_card');
    setPayInvoiceSourceAccountId(firstBankAcc ? firstBankAcc.id : '');

    setShowMismatchConfirm(false);
    setSelectedCardForDetails(null);
    setPayInvoiceModalOpen(true);
  };

  const handlePreConfirmPayInvoice = () => {
    if (loading) return;
    if (!selectedCardForPayment) return;
    if (!payInvoiceSourceAccountId) {
      alert('Por favor, selecione a conta de origem.');
      return;
    }

    const paymentAmount = parseBrlValue(payInvoiceAmountStr);
    if (paymentAmount <= 0) {
      alert('Por favor, insira um valor válido maior que zero.');
      return;
    }

    if (!payInvoiceDate) {
      alert('Por favor, insira a data do pagamento.');
      return;
    }

    const expectedAmount = InvoiceDomain.getPendingInvoiceAmount(selectedCardForPayment.id, selectedCardForPayment, transactions, paymentInvoicePeriod);
    if (Math.abs(paymentAmount - expectedAmount) > 0.01) {
      showToast(
        `O valor informado (R$ ${paymentAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) não corresponde ao total da fatura (R$ ${expectedAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}). Ajuste o valor para prosseguir.`,
        'error'
      );
      return;
    }

    handleExecutePayInvoice();
  };

  const handleExecutePayInvoice = async () => {
    if (!selectedCardForPayment || !payInvoiceSourceAccountId) return;
    if (loading) return; // Prevent double click
    setLoading(true);
    try {
      const paymentAmount = parseBrlValue(payInvoiceAmountStr);

      const targetNormal = normalizeCategoryName('Pagamento de Cartão');
      let category = categories.find(c => normalizeCategoryName(c.name) === targetNormal);
      if (!category) {
        const newCatPayload = {
          agency_id: currentUser.agencyId,
          name: 'Pagamento de Cartão',
          type: TransactionType.EXPENSE,
          color: '#64748b',
          affects_dre: false
        };
        category = await supabaseService.createFinancialCategory(newCatPayload);
        if (category) {
          setCategories(prev => [...prev, category!]);
        }
      }

      const categoryId = category ? category.id : null;

      const paymentTxPayload = {
        agency_id: currentUser.agencyId,
        description: `Pagamento Fatura - ${selectedCardForPayment.name}`,
        amount: paymentAmount, // ALWAYS positive for TRANSFER
        type: TransactionType.TRANSFER,
        account_id: payInvoiceSourceAccountId,
        category_id: categoryId,
        due_date: payInvoiceDate,
        payment_date: payInvoiceDate,
        status: TransactionStatus.PAID,
        contact_name: null,
        notes: `Referente à fatura do cartão ${selectedCardForPayment.name}`
      };

      const createdTx = await supabaseService.createFinancialTransaction(paymentTxPayload);
      if (!createdTx || !createdTx.id) {
        throw new Error("Erro ao criar a transação de pagamento (TRANSFER).");
      }
      const transferTxId = createdTx.id;

      const pendingTxs = transactions.filter(t => {
        if (t.account_id !== selectedCardForPayment.id) return false;
        if (t.status !== TransactionStatus.PENDING) return false;
        return InvoiceDomain.isTxInCardInvoicePeriod(t.due_date, selectedCardForPayment, paymentInvoicePeriod);
      });

      if (pendingTxs.length > 0) {
        let successfullyUpdatedIds: string[] = [];
        try {
          for (const t of pendingTxs) {
            const settledId = t.settled_by_transaction_id || transferTxId;
            const ok = await supabaseService.updateFinancialTransaction(t.id, {
              status: TransactionStatus.PAID,
              payment_date: payInvoiceDate,
              settled_by_transaction_id: settledId
            });
            if (!ok) {
              throw new Error(`Erro ao atualizar a transação ${t.id}.`);
            }
            successfullyUpdatedIds.push(t.id);
          }
        } catch (err: any) {
          console.error("Atomic transaction failed. Rolling back created TRANSFER...", err);
          // Rollback step 1: delete transfer
          const { error: delErr } = await supabase
            .from('financial_transactions')
            .delete()
            .eq('id', transferTxId);
          if (delErr) {
            console.error("Critical: Failed to rollback (delete) TRANSFER transaction during failure recovery:", delErr);
          }
          // Rollback step 2: revert updated transactions
          for (const id of successfullyUpdatedIds) {
            const original = pendingTxs.find(tx => tx.id === id);
            if (original) {
              await supabaseService.updateFinancialTransaction(id, {
                status: TransactionStatus.PENDING,
                payment_date: null,
                settled_by_transaction_id: original.settled_by_transaction_id || null
              });
            }
          }
          throw err;
        }
      }

      showToast(
        `Fatura paga! ${pendingTxs.length} lançamentos marcados como pagos. Total: ${formatCurrency(paymentAmount)}`,
        'success'
      );

      setPayInvoiceModalOpen(false);
      setShowMismatchConfirm(false);

      await loadFinancialData();
    } catch (err: any) {
      console.error('Error paying credit card invoice:', err);
      showToast(err.message || 'Erro ao processar pagamento da fatura.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAccount = async () => {
    if (!newAccount.name) {
      alert('Favor preencher o nome da conta.');
      return;
    }

    const creditLimitVal = newAccount.credit_limit ? parseBRL(String(newAccount.credit_limit)) : null;
    const isCard = modalType === 'card' || (editingAccount && (editingAccount.type === 'credit_card' || (editingAccount as any).account_type === 'credit_card')) || newAccount.type === 'credit_card';

    const closingDayVal = newAccount.closing_day ? parseInt(String(newAccount.closing_day), 10) : (editingAccount?.closing_day || null);
    const dueDayVal = newAccount.due_day ? parseInt(String(newAccount.due_day), 10) : (editingAccount?.due_day || null);

    if (isCard) {
      if (closingDayVal !== null && (closingDayVal < 1 || closingDayVal > 31)) {
        alert('O Dia de Fechamento deve ser entre 1 e 31.');
        return;
      }
      if (dueDayVal !== null && (dueDayVal < 1 || dueDayVal > 31)) {
        alert('O Dia de Vencimento deve ser entre 1 e 31.');
        return;
      }
    }

    if (editingAccount) {
      if (newAccount.current_balance === undefined || newAccount.current_balance === null || String(newAccount.current_balance).trim() === '') {
        alert('Favor preencher o saldo atual.');
        return;
      }
      const newBalVal = parseBrlValue(String(newAccount.current_balance));
      if (isNaN(newBalVal)) {
        alert('Favor informar um saldo atual válido.');
        return;
      }

      const updates = {
        name: newAccount.name,
        color: newAccount.color,
        type: isCard ? 'credit_card' : newAccount.type,
        account_type: isCard ? 'credit_card' : newAccount.type,
        credit_limit: creditLimitVal || undefined,
        bank_code: newAccount.bank_code || null,
        closing_day: closingDayVal,
        due_day: dueDayVal,
        current_balance: newBalVal
      };
      const success = await supabaseService.updateFinancialAccount(editingAccount.id, updates);
      await supabaseService.updateAccountBalance(editingAccount.id, newBalVal);

      if (success) {
        showToast('Conta bancária atualizada com sucesso!', 'success');
        handleCloseModal();
        loadFinancialData();
      } else {
        alert('Erro ao atualizar a conta bancária no servidor. Favor tentar novamente.');
      }
      return;
    }

    if (!isCard && (newAccount.initial_balance === undefined || newAccount.initial_balance === null || newAccount.initial_balance === '')) {
      alert('Favor preencher o saldo inicial.');
      return;
    }

    const initialBalanceVal = isCard ? 0 : parseBRL(String(newAccount.initial_balance));
    const selectedBank = BANKS.find(b => b.code === newAccount.bank_code);
    const bank_name = selectedBank ? selectedBank.name : 'Outro';

    const payload: FinancialAccountInsert = {
      agency_id: currentUser.agencyId,
      name: newAccount.name,
      bank_name: bank_name,
      account_type: isCard ? 'credit_card' : newAccount.type,
      initial_balance: initialBalanceVal,
      current_balance: initialBalanceVal,
      color: newAccount.color,
      is_default: newAccount.is_default,
      type: isCard ? 'credit_card' : newAccount.type,
      credit_limit: creditLimitVal || undefined,
      is_active: true,
      bank_code: newAccount.bank_code || null,
      closing_day: closingDayVal,
      due_day: dueDayVal
    };

    const result = await supabaseService.createFinancialAccount(payload);
    if (result) {
      showToast('Conta bancária criada com sucesso!', 'success');
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
      // Persist to DB
      const success = await supabaseService.updateFinancialCategory(editingCategory.id, {
        name: newCategory.name,
        color: newCategory.color,
        affects_dre: newCategory.affects_dre
      });

      if (!success) {
        alert('Erro ao atualizar a categoria financeira no servidor. Favor tentar novamente.');
        return;
      }

      setCategories(prev => prev.map(c => c.id === editingCategory.id ? {
        ...c,
        name: newCategory.name,
        color: newCategory.color,
        affects_dre: newCategory.affects_dre
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
      color: newCategory.color,
      affects_dre: newCategory.affects_dre
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
      'Ã\u00a0': 'à',
      'Ã‰': 'É',
      'Ã•': 'Õ',
      'Ã‡': 'Ç',
      'Ãš': 'Ú',
      'Ã“': 'Ó',
      'Ã\u0081': 'Á',
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
    const parseCSVValue = (raw: string): number => {
      let cleaned = raw.replace(/[R$\s]/gi, '').trim();

      // Se contém vírgula como separador decimal com separador de milhar (ex: "1.015,99" ou "-1.015,99")
      if (/\d+\.\d+,\d+/.test(cleaned)) {
        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
      } else if (cleaned.includes(',') && !cleaned.includes('.')) {
        // Se contém apenas vírgula como separador decimal (ex: "1015,99" ou "-12,9")
        cleaned = cleaned.replace(',', '.');
      } else if (cleaned.includes(',') && cleaned.includes('.')) {
        // Se possui ambos mas não bateu na regex anterior (ex: formato americano "1,015.99")
        if (cleaned.indexOf('.') < cleaned.indexOf(',')) {
          cleaned = cleaned.replace(/\./g, '').replace(',', '.');
        } else {
          cleaned = cleaned.replace(/,/g, '');
        }
      }
      // Se já está em formato internacional com ponto decimal (ex: "1015.99"), parseFloat funciona direto
      return parseFloat(cleaned);
    };

    const lines = text.split(/\r?\n/);
    if (lines.length === 0) return [];

    const parsed: any[] = [];
    let dateIdx = -1;
    let descIdx = -1;
    let valIdx = -1;
    let anoIdx = -1;
    let obsIdx = -1;

    let delimiter = ';';
    const headerLine = lines[0] || '';
    const semiColons = (headerLine.match(/;/g) || []).length;
    const commas = (headerLine.match(/,/g) || []).length;
    if (commas > semiColons) {
      delimiter = ',';
    }

    // Attempt header index resolution
    const headers = headerLine.split(delimiter).map(h => h.trim().replace(/^["']|["']$/g, '').toLowerCase());
    for (let idx = 0; idx < headers.length; idx++) {
      const h = headers[idx];
      if (h.includes('data') || h.includes('date')) dateIdx = idx;
      else if (h.includes('desc') || h.includes('memo') || h.includes('historico') || h.includes('histórico') || h.includes('detalhe') || h.includes('estabelecimento') || h.includes('lançamento') || h.includes('lancamento')) descIdx = idx;
      else if (h.includes('valor') || h.includes('amount') || h.includes('val')) valIdx = idx;
      else if (h.includes('ano') || h.includes('year')) anoIdx = idx;
      else if (h.includes('observacao') || h.includes('observação') || h.includes('obs')) obsIdx = idx;
    }

    if (dateIdx === -1) dateIdx = 0;
    if (descIdx === -1) descIdx = 1;
    if (valIdx === -1) valIdx = 2;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const columns = line.split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''));
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
        } else if (parts.length === 2 && anoIdx !== -1 && columns[anoIdx]) {
          const day = parts[0].padStart(2, '0');
          const month = parts[1].padStart(2, '0');
          let year = columns[anoIdx].trim();
          if (year.length === 2) {
            year = '20' + year;
          }
          dateStr = `${year}-${month}-${day}`;
        }
      }

      const valNum = parseCSVValue(rawVal);
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
        matched: false,
        observation: obsIdx !== -1 && columns[obsIdx] ? columns[obsIdx].trim() : ''
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
        const externalIds = parsed.map((item: any) => item.id).filter(Boolean);
        setCurrentFileExternalIds(externalIds);

        // Generate a new import group id
        const newGroupId = 'group-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
        setCurrentImportGroupId(newGroupId);

        supabaseService.saveReconciliationItems(
          parsed.map((item: any) => ({
            statement_date: item.date,
            description: item.description,
            amount: item.amount,
            type: item.type,
            external_id: item.id,
          }))
        ).then(() => {
          supabaseService.getReconciliationItemsByExternalIds(externalIds).then(dbItems => {
            if (dbItems.length > 0) {
              setReconciliationItems(dbItems);
              const isConcluded = dbItems.every(item => item.status === 'CONCLUDED');
              setIsReconciliationConcluded(isConcluded);
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
        await supabaseService.updateTransactionStatus(systemTx.id, TransactionStatus.PAID, imported.date);

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
        const date = recItem ? recItem.date : getLocalTodayStr();
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
            const date = recItem ? recItem.date : getLocalTodayStr();
            return { ...t, status: TransactionStatus.PAID, payment_date: date };
          }
          return t;
        }));

        // Remove da fila apenas os que deram sucesso
        setSelectedMatches(prev => prev.filter(m => !succeededMatches.some(sm => sm.reconciliation_id === m.reconciliation_id)));
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

  // Concluir conciliação do lote/grupo
  const handleConcludeReconciliation = async () => {
    setLoading(true);
    try {
      const externalIds = reconciliationItems.map(item => item.external_id || item.id).filter(Boolean);
      const success = await supabaseService.concludeReconciliation(currentImportGroupId, externalIds);
      if (success) {
        setIsReconciliationConcluded(true);
        setReconciliationItems(prev => prev.map(item => ({ ...item, status: 'CONCLUDED', matched: true })));
        showToast('Conciliação concluída com sucesso!', 'success');
      } else {
        showToast('Erro ao concluir conciliação.', 'error');
      }
    } catch (err) {
      console.error('Error concluding reconciliation:', err);
      showToast('Erro ao concluir conciliação.', 'error');
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

    let recurrenceGroupId: string | null = null;
    if (recurrenceType !== 'NONE' && recurrencePeriods > 0) {
      recurrenceGroupId = crypto.randomUUID();
    }

    const payload = {
      agency_id: currentUser.agencyId,
      description: desc,
      amount: Number(importedItem.amount),
      type: importedItem.type,
      category_id: quickCategoryId,
      account_id: quickAccountId,
      status: TransactionStatus.PAID,
      due_date: importedItem.date,
      payment_date: importedItem.date,
      recurrence_group_id: recurrenceGroupId
    };

    try {
      // 1. Criar transação financeira
      const result = await supabaseService.createFinancialTransaction(payload);
      if (!result || !result.id) {
        showToast('Erro ao criar o lançamento no servidor. Nenhuma alteração foi realizada.', 'error');
        return;
      }

      // Se houver recorrência, gerar ocorrências futuras e inserir em lote
      if (recurrenceType !== 'NONE' && recurrencePeriods > 0) {
        const copiesToCreate: any[] = [];
        for (let i = 1; i <= recurrencePeriods; i++) {
          const nextDueDate = addPeriodToDate(payload.due_date, recurrenceType, i);
          copiesToCreate.push({
            agency_id: payload.agency_id,
            description: payload.description,
            amount: payload.amount,
            type: payload.type,
            category_id: payload.category_id,
            account_id: payload.account_id,
            status: TransactionStatus.PENDING,
            due_date: nextDueDate,
            payment_date: null,
            recurrence_group_id: recurrenceGroupId
          });
        }

        if (supabase && copiesToCreate.length > 0) {
          const { data, error } = await supabase
            .from('financial_transactions')
            .insert(copiesToCreate)
            .select();

          if (error) {
            console.error('Error creating recurring transactions in bank reconciliation:', error);
            showToast('Erro ao criar lançamentos recorrentes futuros: ' + error.message, 'error');
          } else if (data && data.length > 0) {
            setTransactions(prev => [...data, ...prev]);
          }
        }
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
      setRecurrenceType('NONE');
      setRecurrencePeriods(1);
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
          await supabaseService.updateTransactionStatus(suggested.id, TransactionStatus.PAID, updatedItems[i].date);
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
        if (item.id) {
          supabaseService.matchReconciliationItem(item.id, bestMatch.id);
        }
        supabaseService.updateTransactionStatus(bestMatch.id, TransactionStatus.PAID, item.date);
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
    const handleKpiClick = (id: string | null) => {
      if (!id || kpiFilter === id || kpiFilter?.toLowerCase() === id?.toLowerCase()) {
        setKpiFilter(null);
      } else {
        setKpiFilter(id);
      }
      setVisibleCount(20);
    };

    const displayedTransactions = filteredTransactions.slice(0, visibleCount);
    const monthFormatted = currentPeriod.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
    const capitalizedMonth = monthFormatted.charAt(0).toUpperCase() + monthFormatted.slice(1);

    return (
      <div className="space-y-6">
        {/* Unified Month & Period Selector Bar at Top of Extrato */}
        <div className="bg-white rounded-3xl border border-slate-100 p-3.5 px-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Pill Navigation [◄] [Mês Ano] [►] */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200/60">
              <button
                type="button"
                onClick={() => {
                  setCurrentPeriod(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
                  setPeriodMode('CUSTOM');
                  setVisibleCount(20);
                }}
                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-white rounded-xl transition-all cursor-pointer"
                title="Mês Anterior"
              >
                <ChevronLeft size={18} />
              </button>

              <span className={`px-3.5 py-1 font-black text-xs sm:text-sm capitalize tracking-wide min-w-[130px] text-center ${periodMode === 'ALL' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                {capitalizedMonth}
              </span>

              <button
                type="button"
                onClick={() => {
                  setCurrentPeriod(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
                  setPeriodMode('CUSTOM');
                  setVisibleCount(20);
                }}
                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-white rounded-xl transition-all cursor-pointer"
                title="Próximo Mês"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            {/* Datepicker Icon Button [📅] */}
            <div className="relative">
              <button
                type="button"
                onClick={() => monthInputRef.current?.showPicker ? monthInputRef.current.showPicker() : monthInputRef.current?.click()}
                className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl transition-all cursor-pointer flex items-center justify-center border border-slate-200/60"
                title="Escolher Mês"
              >
                <Calendar size={18} />
              </button>
              <input
                ref={monthInputRef}
                type="month"
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                value={`${currentPeriod.getFullYear()}-${String(currentPeriod.getMonth() + 1).padStart(2, '0')}`}
                onChange={(e) => {
                  if (e.target.value) {
                    const [y, m] = e.target.value.split('-').map(Number);
                    setCurrentPeriod(new Date(y, m - 1, 1));
                    setPeriodMode('CUSTOM');
                    setVisibleCount(20);
                  }
                }}
              />
            </div>
          </div>

          {/* Quick period shortcuts acoplados */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-2xl border border-slate-200/60">
            <button
              type="button"
              onClick={() => {
                setCurrentPeriod(new Date());
                setPeriodMode('THIS_MONTH');
                setVisibleCount(20);
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                periodMode === 'THIS_MONTH'
                  ? 'bg-white text-blue-600 shadow-2xs font-black'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              Este mês
            </button>
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                setCurrentPeriod(new Date(now.getFullYear(), now.getMonth() - 1, 1));
                setPeriodMode('LAST_MONTH');
                setVisibleCount(20);
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                periodMode === 'LAST_MONTH'
                  ? 'bg-white text-blue-600 shadow-2xs font-black'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              Mês passado
            </button>
            <button
              type="button"
              onClick={() => {
                monthInputRef.current?.showPicker ? monthInputRef.current.showPicker() : monthInputRef.current?.click();
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                periodMode === 'CUSTOM'
                  ? 'bg-white text-blue-600 shadow-2xs font-black'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              Personalizado
            </button>
            <button
              type="button"
              onClick={() => {
                setPeriodMode('ALL');
                setVisibleCount(20);
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                periodMode === 'ALL'
                  ? 'bg-white text-blue-600 shadow-2xs font-black'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              Tudo
            </button>
          </div>
        </div>

        {/* KPI Cards section */}
        <FinancialKpiHeaderCards
          transactions={transactions}
          selectedMonth={currentPeriod}
          onCardClick={(id) => handleKpiClick(id)}
          activeFilter={kpiFilter}
        />

        {/* Main Table Container */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          {/* List Period Header Indicator */}
          <div className="p-4 px-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/50">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
              <span className="text-xs font-bold text-slate-700">
                {kpiFilter === 'vencidos' && 'Exibindo todos os lançamentos vencidos (Todos os meses)'}
                {kpiFilter === 'hoje' && 'Exibindo lançamentos que vencem hoje'}
                {kpiFilter === 'proximos7' && 'Exibindo lançamentos dos próximos 7 dias'}
                {kpiFilter === 'avencer' && `Exibindo lançamentos a vencer de ${capitalizedMonth}`}
                {!kpiFilter && `Exibindo lançamentos de ${capitalizedMonth}`}
              </span>
            </div>
            <span className="text-xs font-extrabold text-slate-500 bg-slate-200/60 px-2.5 py-1 rounded-full w-fit">
              {filteredTransactions.length} {filteredTransactions.length === 1 ? 'lançamento' : 'lançamentos'}
            </span>
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
                      checked={displayedTransactions.length > 0 && displayedTransactions.every(tx => selectedTxIds.includes(tx.id))}
                      onChange={() => {
                        const isAllVisibleSelected = displayedTransactions.length > 0 && displayedTransactions.every(tx => selectedTxIds.includes(tx.id));
                        if (isAllVisibleSelected) {
                          setSelectedTxIds(prev => prev.filter(id => !displayedTransactions.some(tx => tx.id === id)));
                        } else {
                          const visibleIds = displayedTransactions.map(tx => tx.id);
                          setSelectedTxIds(prev => Array.from(new Set([...prev, ...visibleIds])));
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
                {displayedTransactions.map((tx) => {
                  const category = categories.find(c => c.id === tx.category_id);
                  const account = accounts.find(a => a.id === tx.account_id);
                  const isPaid = tx.status === TransactionStatus.PAID;
                  const interestInfo = calculateInterestAndPenalty(tx);

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
                      <td className="px-6 py-5 text-sm font-bold text-slate-700">{formatDateBR(tx.due_date)}</td>
                      <td className="px-6 py-5 text-sm font-medium text-slate-400">
                        {tx.payment_date ? formatDateBR(tx.payment_date) : '-'}
                      </td>
                      <td className="px-6 py-5">
                        <p className="text-sm font-bold text-slate-900 leading-none">{tx.description}</p>
                        {tx.contact_name && <p className="text-xs text-gray-400 mt-1">{tx.contact_name}</p>}
                        {tx.notes && <p className="text-xs text-slate-400 mt-1">{tx.notes}</p>}
                        {tx.recurrence_group_id && (
                          <div className="mt-1">
                            <span className="inline-flex items-center gap-1 text-[9px] font-black text-blue-600 bg-blue-50/50 border border-blue-100/50 px-1.5 py-0.5 rounded-md uppercase tracking-wider select-none">
                              🔁 Recorrente
                            </span>
                          </div>
                        )}
                        {interestInfo && (
                          <div className="mt-2 text-[11px] font-medium text-red-700 flex flex-wrap items-center gap-2 bg-[#fee2e2] px-2.5 py-1.5 rounded-lg border border-[#fca5a5] w-fit">
                            <div className="flex items-center gap-1.5">
                              <AlertCircle size={13} className="flex-shrink-0 text-red-600" />
                              <span>Atraso de {interestInfo.diasAtraso} {interestInfo.diasAtraso === 1 ? 'dia' : 'dias'}: Multa (10%) {formatCurrency(interestInfo.multaValor)} / Juros {formatCurrency(interestInfo.jurosValor)} / Acréscimo {formatCurrency(interestInfo.acrescimoTotal)}</span>
                            </div>
                            {(() => {
                              const alreadyLaunched = transactions.some(t => t.notes && t.notes.includes(`[ORIGINAL_TX:${tx.id}]`));
                              if (alreadyLaunched) {
                                return (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-md">
                                    ✓ Multa/Juros já lançada
                                  </span>
                                );
                              }
                              return (
                                <button
                                  type="button"
                                  disabled={launchingPenaltyId === tx.id}
                                  onClick={() => handleCreatePenaltyTransaction(tx, interestInfo)}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-700 hover:bg-red-800 disabled:opacity-50 text-white text-[10px] font-bold rounded-md transition-all shadow-xs cursor-pointer"
                                >
                                  <PlusCircle size={11} />
                                  {launchingPenaltyId === tx.id ? 'Lançando...' : 'Lançar Multa/Juros'}
                                </button>
                              );
                            })()}
                          </div>
                        )}
                        {((tx as any).ofx_fitid?.startsWith('MANUAL-') || (tx as any).transfer_id) && (
                          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                            {(tx as any).ofx_fitid?.startsWith('MANUAL-') && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-[#fef3c7] text-[#92400e] px-2 py-0.5 rounded-full select-none">
                                ✎ Lançamento manual
                              </span>
                            )}
                            <TransferBadge transferId={(tx as any).transfer_id} />
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col items-center justify-center text-center">
                          <span
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200"
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
                        <span className={`text-sm font-bold whitespace-nowrap ${getTransactionValueColor(tx, category)}`}>
                          {formatCurrency(tx.amount)}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                          isPaid
                            ? 'bg-[#d1fae5] text-[#065f46]'
                            : (tx.status === TransactionStatus.PENDING && tx.due_date < getLocalTodayStr())
                              ? 'bg-[#fee2e2] text-[#991b1b]'
                              : 'bg-[#fef3c7] text-[#92400e]'
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

          {/* Pagination: 20 por página com botão "Ver mais" */}
          {filteredTransactions.length > visibleCount && (
            <div className="p-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between px-6">
              <span className="text-xs font-medium text-slate-500">
                Exibindo <span className="font-bold text-slate-800">{displayedTransactions.length}</span> de <span className="font-bold text-slate-800">{filteredTransactions.length}</span> lançamentos
              </span>
              <button
                type="button"
                onClick={() => setVisibleCount(prev => prev + 20)}
                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer hover:border-slate-300"
              >
                Ver mais
              </button>
            </div>
          )}
          {filteredTransactions.length > 0 && filteredTransactions.length <= visibleCount && (
            <div className="p-3 bg-slate-50/50 border-t border-slate-100 text-center">
              <span className="text-xs font-medium text-slate-400">
                Exibindo todos os {filteredTransactions.length} lançamentos
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  // 2. View: Fluxo de Caixa (Cash Flow Analyzer)
  const renderFluxodeCaixa = () => {
    // Determine active account IDs (default to all if none explicitly selected)
    const isConsolidatedView = selectedAccountIds.length === 0;
    const activeAccountIds = selectedAccountIds.length > 0 ? selectedAccountIds : accounts.map(a => a.id);
    const selectedAccountsList = accounts.filter(a => activeAccountIds.includes(a.id));

    // Total consolidated initial balance of selected accounts (Fórmula do item 1)
    const totalInitialBalance = selectedAccountsList.reduce((acc, curr) => acc + (curr.initial_balance || 0), 0);

    // Filter overall transactions for selected accounts (to compute current Saldo Atual of all time)
    // Ignore internal transfer transactions to prevent distorting real cash flow
    const txsForSelectedAccounts = transactions.filter(t => {
      const accId = t.account_id || t.financial_account_id;
      if (!activeAccountIds.includes(accId || '')) return false;

      // Double counting avoidance rule:
      // In consolidated view, we exclude credit card purchases (i.e. EXPENSE transactions on credit card accounts)
      // to avoid double counting when the card invoice is paid from a checking/savings account.
      if (isConsolidatedView) {
        const acc = accounts.find(a => a.id === accId);
        if (acc && (acc.type === 'credit_card' || acc.account_type === 'credit_card')) {
          if (t.type === TransactionType.EXPENSE) {
            return false;
          }
        }
      }

      return t.is_transfer !== true;
    });

    const totalPaidIncomeOverall = txsForSelectedAccounts
      .filter(t => t.type === TransactionType.INCOME && t.status === TransactionStatus.PAID)
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    const totalPaidExpenseOverall = txsForSelectedAccounts
      .filter(t => (t.type === TransactionType.EXPENSE || t.type === TransactionType.TRANSFER) && t.status === TransactionStatus.PAID)
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
      .filter(t => t.type === TransactionType.EXPENSE || t.type === TransactionType.TRANSFER)
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
      .filter(t => (t.type === TransactionType.EXPENSE || t.type === TransactionType.TRANSFER) && t.status === TransactionStatus.PAID)
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    const periodPendingExpense = periodTxs
      .filter(t => (t.type === TransactionType.EXPENSE || t.type === TransactionType.TRANSFER) && t.status === TransactionStatus.PENDING)
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    const totalPeriodExpense = periodPaidExpense + periodPendingExpense;

    // --- DRE CALCULATIONS (Competence) ---
    // Receita (Incomes)
    const dreRevenueTransactions = periodTxs.filter(t => {
      if (t.type !== TransactionType.INCOME) return false;
      const catId = t.category_id || '';
      const cat = categories.find(c => c.id === catId);
      return cat?.affects_dre ?? true;
    });
    const totalDreRevenue = dreRevenueTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);

    // Custos vs Despesas
    // Classify as "Custo" if the category or its group name contains 'custo' or 'cost' (case-insensitive)
    const dreExpenseTransactions = periodTxs.filter(t => {
      if (t.type !== TransactionType.EXPENSE) return false;
      const catId = t.category_id || '';
      const cat = categories.find(c => c.id === catId);
      return cat?.affects_dre ?? true;
    });

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

    // Breakdown DRE categories grouped by transactions to handle deleted/orphaned categories
    const revenueGroupMap: { [categoryId: string]: { name: string; total: number; color?: string } } = {};
    dreRevenueTransactions.forEach(t => {
      const catId = t.category_id || 'no-category';
      const cat = categories.find(c => c.id === catId);
      const catName = cat?.name || 'Categoria Removida';
      const catColor = cat?.color || '#cbd5e1';

      if (!revenueGroupMap[catId]) {
        revenueGroupMap[catId] = { name: catName, total: 0, color: catColor };
      }
      revenueGroupMap[catId].total += (t.amount || 0);
    });

    const dreCategoriesIncome = Object.values(revenueGroupMap)
      .filter(c => c.total > 0)
      .sort((a, b) => b.total - a.total);

    const custosGroupMap: { [categoryId: string]: { name: string; total: number; color?: string } } = {};
    dreCustosTransactions.forEach(t => {
      const catId = t.category_id || 'no-category';
      const cat = categories.find(c => c.id === catId);
      const catName = cat?.name || 'Categoria Removida';
      const catColor = cat?.color || '#cbd5e1';

      if (!custosGroupMap[catId]) {
        custosGroupMap[catId] = { name: catName, total: 0, color: catColor };
      }
      custosGroupMap[catId].total += (t.amount || 0);
    });

    const dreCategoriesCustos = Object.values(custosGroupMap)
      .filter(c => c.total > 0)
      .sort((a, b) => b.total - a.total);

    const despesasGroupMap: { [categoryId: string]: { name: string; total: number; color?: string } } = {};
    dreDespesasTransactions.forEach(t => {
      const catId = t.category_id || 'no-category';
      const cat = categories.find(c => c.id === catId);
      const catName = cat?.name || 'Categoria Removida';
      const catColor = cat?.color || '#cbd5e1';

      if (!despesasGroupMap[catId]) {
        despesasGroupMap[catId] = { name: catName, total: 0, color: catColor };
      }
      despesasGroupMap[catId].total += (t.amount || 0);
    });

    const dreCategoriesDespesas = Object.values(despesasGroupMap)
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

      const amt = Math.abs(tx.amount || 0);
      if (tx.type === TransactionType.INCOME) {
        if (tx.status === TransactionStatus.PAID) {
          groupedDataMap[key].income += amt;
        } else {
          groupedDataMap[key].expectedIncome += amt;
        }
      } else if (tx.type === TransactionType.EXPENSE || tx.type === TransactionType.TRANSFER) {
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
    style.textContent = `
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
          <td style="padding: 6px; font-weight: 500;">${escapeHtml(tx.description)}</td>
          <td style="padding: 6px; color: ${tx.type === TransactionType.INCOME ? '#047857' : '#b91c1c'}; font-weight: bold;">
            ${tx.type === TransactionType.INCOME ? 'Receita' : 'Despesa'}
          </td>
          <td style="padding: 6px;">${escapeHtml(categoryName)}</td>
          <td style="padding: 6px;">${escapeHtml(groupName)}</td>
          <td style="padding: 6px;">${escapeHtml(accountName)}</td>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card: Receitas Pagas */}
          <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-2xs flex flex-col justify-between space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Receitas Recebidas</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">
                <ArrowUpRight size={16} />
              </div>
            </div>
            <div>
              <p className="text-[24px] font-bold text-slate-900 tracking-tight leading-none">{formatCurrency(totalReceitasPagas)}</p>
              <p className="text-xs font-normal text-slate-500 mt-1.5">Realizado (Pago) no período</p>
            </div>
          </div>

          {/* Card: Despesas Pagas */}
          <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-2xs flex flex-col justify-between space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Despesas Pagas</span>
              <div className="w-8 h-8 rounded-xl bg-red-100 text-red-600 flex items-center justify-center font-bold">
                <ArrowDownRight size={16} />
              </div>
            </div>
            <div>
              <p className="text-[24px] font-bold text-slate-900 tracking-tight leading-none">{formatCurrency(totalDespesasPagas)}</p>
              <p className="text-xs font-normal text-slate-500 mt-1.5">Realizado (Pago) no período</p>
            </div>
          </div>

          {/* Card: Saldo Realizado */}
          <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-2xs flex flex-col justify-between space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Saldo Realizado</span>
              <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                <Activity size={16} />
              </div>
            </div>
            <div>
              <p className="text-[24px] font-bold text-slate-900 tracking-tight leading-none">{formatCurrency(saldoRealizado)}</p>
              <p className="text-xs font-normal text-slate-500 mt-1.5">Receitas pagas menos despesas pagas</p>
            </div>
          </div>

          {/* Card: Total Pendente */}
          <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-2xs flex flex-col justify-between space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Pendente</span>
              <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center font-bold">
                <Clock size={16} />
              </div>
            </div>
            <div>
              <p className="text-[24px] font-bold text-slate-900 tracking-tight leading-none">{formatCurrency(totalPendente)}</p>
              <p className="text-xs font-normal text-slate-500 mt-1.5">Todos a pagar e receber pendentes</p>
            </div>
          </div>
        </div>

        {/* Export Buttons */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs">
          <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-4">Exportações Disponíveis</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={handleExportFinanceiroXLSX}
              className="px-5 py-3.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-900 font-semibold text-xs uppercase tracking-wider rounded-xl shadow-2xs transition-all flex items-center justify-center gap-2.5 cursor-pointer"
            >
              <FileDown size={16} />
              Exportar Extrato Excel
            </button>
            <button
              onClick={handleExportFinanceiroPDF}
              className="px-5 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs uppercase tracking-wider rounded-xl shadow-2xs transition-all flex items-center justify-center gap-2.5 cursor-pointer"
            >
              <FileText size={16} />
              Exportar PDF (Imprimir)
            </button>
            <button
              onClick={handleExportCentroCustoXLSX}
              className="px-5 py-3.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-900 font-semibold text-xs uppercase tracking-wider rounded-xl shadow-2xs transition-all flex items-center justify-center gap-2.5 cursor-pointer"
            >
              <Layers size={16} />
              Exportar Centro de Custo Excel
            </button>
          </div>
        </div>

        {/* Preview Table */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Prévia do Extrato do Mês <span className="text-slate-400 font-normal">({latestTransactions.length} lançamentos)</span>
            </h4>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
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

                    let statusStyle = 'bg-[#fef3c7] text-[#92400e] border border-[#fde68a]';
                    let statusLabel = 'Pendente';
                    if (tx.status === TransactionStatus.PAID) {
                      statusStyle = 'bg-[#d1fae5] text-[#065f46] border border-[#a7f3d0]';
                      statusLabel = 'Pago';
                    } else if (tx.status === TransactionStatus.PENDING && tx.due_date < todayStr) {
                      statusStyle = 'bg-[#fee2e2] text-[#991b1b] border border-[#fca5a5]';
                      statusLabel = 'Vencido';
                    }

                    return (
                      <tr key={tx.id} className="text-xs hover:bg-slate-50/50 transition-colors">
                        <td className="py-3.5 px-4 text-slate-500 font-medium whitespace-nowrap">
                          {formatDateBR(tx.due_date)}
                        </td>
                        <td className="py-3.5 px-4 text-slate-800 font-bold max-w-xs truncate">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span>{tx.description}</span>
                            {tx.recurrence_group_id && (
                              <span className="text-[9px] font-semibold text-blue-600 bg-blue-50/50 border border-blue-100/50 px-1 py-0.5 rounded uppercase tracking-wider select-none">
                                🔁 Recorrente
                              </span>
                            )}
                          </div>
                          {tx.contact_name && (
                            <div className="text-[10px] text-gray-400 font-semibold mt-0.5">{tx.contact_name}</div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            {categoryName}
                          </span>
                        </td>
                        <td className={`py-3.5 px-4 text-right font-bold whitespace-nowrap ${getTransactionValueColor(tx, catObj)}`}>
                          {formatCurrency(tx.amount)}
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${statusStyle}`}>
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

  const getInvoiceStatusLabelAndBadge = (status: string) => {
    switch (status) {
      case 'PAGA':
        return {
          label: 'Paga',
          badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-100',
          dotClass: 'bg-emerald-500'
        };
      case 'FECHADA':
        return {
          label: 'Fechada',
          badgeClass: 'bg-amber-50 text-amber-700 border-amber-100',
          dotClass: 'bg-amber-500'
        };
      case 'VENCIDA':
        return {
          label: 'Vencida',
          badgeClass: 'bg-rose-50 text-rose-700 border-rose-100',
          dotClass: 'bg-rose-500'
        };
      default:
        return {
          label: 'Aberta',
          badgeClass: 'bg-blue-50 text-blue-700 border-blue-100',
          dotClass: 'bg-blue-500'
        };
    }
  };

  const renderHistoricoCompleto = (card: FinancialAccount) => {
    const competencies = getCardCompetencies(card);
    const groupedByYear: { [year: number]: Date[] } = {};
    competencies.forEach(d => {
      const yr = d.getFullYear();
      if (!groupedByYear[yr]) {
        groupedByYear[yr] = [];
      }
      groupedByYear[yr].push(d);
    });
    const years = Object.keys(groupedByYear).map(Number).sort((a, b) => b - a);

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <button
            onClick={() => setSelectedCardForHistory(null)}
            className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200/80 px-4 py-2.5 rounded-xl transition-all cursor-pointer w-fit"
          >
            <ArrowLeft size={14} /> Voltar para os Cartões
          </button>
          <div className="flex items-center gap-2 bg-blue-50 text-blue-700 border border-blue-100 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wide">
            <History size={14} /> Linha do Tempo de Faturas
          </div>
        </div>

        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center gap-4 mb-8 pb-4 border-b border-slate-100">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black">
              <CreditCard size={22} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900">{card.name}</h3>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Limite Total: {formatCurrency(card.credit_limit || 25000)}
              </p>
            </div>
          </div>

          {years.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Calendar size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-xs font-bold uppercase tracking-wider">Nenhuma fatura encontrada.</p>
            </div>
          ) : (
            <div className="relative pl-6 md:pl-8 border-l border-slate-100 ml-3 md:ml-4 mr-3 md:mr-4 space-y-12 py-2">
              {years.map(year => {
                const yearPeriods = groupedByYear[year];
                return (
                  <div key={year} className="relative">
                    {/* Year Marker Node */}
                    <div className="absolute -left-[31px] md:-left-[39px] top-1.5 w-6 h-6 rounded-full bg-slate-900 border-4 border-white shadow-sm flex items-center justify-center text-[10px] font-black text-white shrink-0" />
                    <div className="mb-4">
                      <span className="text-base font-black text-slate-900 tracking-tight block">Ano {year}</span>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                        {yearPeriods.length} {yearPeriods.length === 1 ? 'fatura registrada' : 'faturas registradas'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      {yearPeriods.map((period, pIdx) => {
                        const txs = getInvoiceTransactions(card.id, period);
                        const total = getInvoiceTotalAmount(card.id, period);
                        const count = txs.length;
                        const status = getInvoiceStatus(card.id, period);
                        const { label, badgeClass, dotClass } = getInvoiceStatusLabelAndBadge(status);

                        // Calculate paid vs pending amounts
                        const paid = txs.reduce((sum, tx) => {
                          const isPaid = tx.status === TransactionStatus.PAID || (tx.settled_by_transaction_id && tx.settled_by_transaction_id.trim() !== '');
                          return isPaid ? sum + tx.amount : sum;
                        }, 0);
                        const pending = Math.max(0, total - paid);

                        const capitalizedMonth = period.toLocaleDateString('pt-BR', { month: 'long' });
                        const displayMonth = capitalizedMonth.charAt(0).toUpperCase() + capitalizedMonth.slice(1);

                        const closingDay = card.closing_day || 10;
                        const dueDay = card.due_day || 15;
                        const targetYear = period.getFullYear();
                        const targetMonth = period.getMonth();
                        const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
                        const safeClosingDay = Math.min(closingDay, daysInTargetMonth);

                        let dueYear = targetYear;
                        let dueMonth = targetMonth;
                        if (dueDay <= closingDay) {
                          dueMonth += 1;
                          if (dueMonth > 11) {
                            dueMonth = 0;
                            dueYear += 1;
                          }
                        }
                        const daysInDueMonth = new Date(dueYear, dueMonth + 1, 0).getDate();
                        const safeDueDay = Math.min(dueDay, daysInDueMonth);

                        const formatShortDate = (day: number, month: number, yr: number) => {
                          const dy = String(day).padStart(2, '0');
                          const mo = String(month + 1).padStart(2, '0');
                          return `${dy}/${mo}/${yr}`;
                        };

                        const closingDateStr = formatShortDate(safeClosingDay, targetMonth, targetYear);
                        const dueDateStr = formatShortDate(safeDueDay, dueMonth, dueYear);

                        return (
                          <div
                            key={pIdx}
                            onClick={() => {
                              setDetailPeriod(period);
                              setSelectedCardForDetails(card);
                            }}
                            className="bg-slate-50/35 hover:bg-white border border-slate-100 hover:border-blue-100 p-4.5 rounded-2xl shadow-sm hover:shadow-md cursor-pointer transition-all duration-200 relative group"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                                  <Calendar size={14} />
                                </div>
                                <div>
                                  <span className="text-sm font-black text-slate-800 block leading-none">
                                    {displayMonth}
                                  </span>
                                  <span className="text-[10px] font-bold text-slate-400 block mt-1">
                                    {count} {count === 1 ? 'lançamento' : 'lançamentos'}
                                  </span>
                                </div>
                              </div>

                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border shadow-sm ${badgeClass}`}>
                                <span className={`w-1 h-1 rounded-full ${dotClass}`} />
                                {label}
                              </span>
                            </div>

                            {/* Financial Data Row */}
                            <div className="grid grid-cols-3 gap-3 mt-4 pt-3 border-t border-slate-100/60 text-xs">
                              <div>
                                <span className="text-[8px] font-black tracking-widest text-slate-400 uppercase block mb-0.5">Total</span>
                                <span className="font-black text-slate-800 font-mono block">{formatCurrency(total)}</span>
                              </div>
                              <div>
                                <span className="text-[8px] font-black tracking-widest text-emerald-600 uppercase block mb-0.5">Pago</span>
                                <span className="font-black text-emerald-700 font-mono block">{formatCurrency(paid)}</span>
                              </div>
                              <div>
                                <span className="text-[8px] font-black tracking-widest text-amber-500 uppercase block mb-0.5">Pendente</span>
                                <span className="font-black text-amber-700 font-mono block">{formatCurrency(pending)}</span>
                              </div>
                            </div>

                            {/* Closing and Due dates */}
                            <div className="flex justify-between items-center mt-3 pt-2.5 border-t border-slate-100/40 text-[10px]">
                              <span className="font-bold text-slate-400">Fechamento: <strong className="text-slate-600 font-mono font-black">{closingDateStr}</strong></span>
                              <span className="font-bold text-slate-400">Vencimento: <strong className="text-slate-600 font-mono font-black">{dueDateStr}</strong></span>
                            </div>

                            {/* Chevron navigation overlay */}
                            <div className="absolute right-3 bottom-3 opacity-0 group-hover:opacity-100 transition-opacity">
                              <ChevronRight size={14} className="text-blue-500" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  // 3. View: Cartões (Credit Card Wallet)
  const renderCartoes = () => {
    const cardAccounts = accounts.filter(a => a.type === 'credit_card' || a.type === 'CREDIT' || a.name.toLowerCase().includes('cartão'));

    if (selectedCardForHistory) {
      return renderHistoricoCompleto(selectedCardForHistory);
    }

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
          {cardAccounts.map((card, idx) => {
            const limit = card.credit_limit || 25000;
            const openInvoices = Math.abs(getAccountLiveBalance(card));
            const available = limit - openInvoices;
            const progressPct = limit > 0 ? Math.round((openInvoices / limit) * 100) : 0;
            const competencies = getCardCompetencies(card).slice(0, 5);

            // Latest transaction for last update tracking
            const cardTxs = transactions.filter(t => t.account_id === card.id);
            const latestTx = cardTxs.length > 0
              ? cardTxs.reduce((latest, current) => {
                  const latDate = latest.due_date || latest.payment_date || '';
                  const curDate = current.due_date || current.payment_date || '';
                  return curDate > latDate ? current : latest;
                })
              : null;

            const lastUpdateStr = latestTx
              ? `${formatDateBR(latestTx.due_date || latestTx.payment_date)}`
              : 'N/A';

            // Guessed brand and bank for Bloco 1
            const getCardMeta = (name: string) => {
              const lowercase = name.toLowerCase();
              let brand = 'Visa';
              if (lowercase.includes('master') || lowercase.includes('mc')) brand = 'Mastercard';
              else if (lowercase.includes('elo')) brand = 'Elo';
              else if (lowercase.includes('amex') || lowercase.includes('american')) brand = 'Amex';

              let bank = 'Itaú';
              if (lowercase.includes('nubank') || lowercase.includes('nu')) bank = 'Nubank';
              else if (lowercase.includes('inter')) bank = 'Inter';
              else if (lowercase.includes('bradesco')) bank = 'Bradesco';
              else if (lowercase.includes('santander')) bank = 'Santander';
              else if (lowercase.includes('brasil') || lowercase.includes('bb')) bank = 'Banco do Brasil';
              return { brand, bank };
            };
            const meta = getCardMeta(card.name);

            // 16-segment custom progress bar requested: ██████████░░░░░░
            const barLength = 16;
            const filledCount = Math.min(Math.max(Math.round((progressPct / 100) * barLength), 0), barLength);
            const barStr = "█".repeat(filledCount) + "░".repeat(barLength - filledCount);

            return (
              <div key={card.id} className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col space-y-4 relative overflow-hidden">
                {/* BLOCO 1: Identificação */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <span className="text-sm font-black text-slate-800 tracking-tight flex items-center gap-1.5">
                    💳 {card.name}
                  </span>
                  <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider">
                    <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" /> Ativo
                  </span>
                </div>

                {/* BLOCO 3: Indicador Visual de Utilização */}
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 flex items-center justify-between font-mono text-xs font-bold tracking-wider text-slate-600">
                  <span title={`${progressPct}% utilizado`}>{barStr}</span>
                  <span className="text-[10px] font-black font-sans text-slate-500 uppercase tracking-wider">
                    {progressPct}%
                  </span>
                </div>

                {/* BLOCO 2: KPIs Principais (Vertically-stacked clean list) */}
                <div className="space-y-2.5 py-1">
                  <div className="flex justify-between items-center bg-slate-50/40 px-3 py-2 rounded-xl border border-slate-100/60">
                    <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Limite</span>
                    <span className="text-sm font-black text-slate-700 font-mono">{formatCurrency(limit)}</span>
                  </div>
                  <div className="flex justify-between items-center bg-slate-50/40 px-3 py-2 rounded-xl border border-slate-100/60">
                    <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Disponível</span>
                    <span className="text-sm font-black text-emerald-600 font-mono">{formatCurrency(available)}</span>
                  </div>
                  <div className="flex justify-between items-center bg-slate-50/40 px-3 py-2 rounded-xl border border-slate-100/60">
                    <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Fatura Atual</span>
                    <span className="text-sm font-black text-rose-600 font-mono">{formatCurrency(openInvoices)}</span>
                  </div>
                </div>

                {/* BLOCO 4: Fechamento & Vencimento (Secundário, minimalista e limpo) */}
                <div className="text-center text-[10px] font-black text-slate-500 py-1.5 bg-slate-50 rounded-xl border border-slate-100/60 tracking-wider uppercase">
                  Fechamento {String(card.closing_day || 10).padStart(2, '0')} • Vencimento {String(card.due_day || 15).padStart(2, '0')}
                </div>

                {/* Três botões continuam iguais */}
                <div className="grid grid-cols-3 gap-2 py-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenImportInvoiceModal(card);
                    }}
                    className="py-2 px-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-800 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all shadow-sm flex flex-col items-center justify-center gap-1 cursor-pointer active:scale-95"
                    title="Importar fatura de cartão"
                  >
                    <Upload size={11} className="text-slate-500" />
                    <span>Importar</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenQuickLaunchModal(card);
                    }}
                    className="py-2 px-1 bg-blue-50/60 hover:bg-blue-50 border border-blue-100 text-blue-600 hover:text-blue-700 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all shadow-sm flex flex-col items-center justify-center gap-1 cursor-pointer active:scale-95"
                    title="Lançar nova despesa"
                  >
                    <Plus size={11} className="text-blue-500" />
                    <span>Lançar</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenPayInvoiceModal(card);
                    }}
                    className="py-2 px-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-800 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all shadow-sm flex flex-col items-center justify-center gap-1 cursor-pointer active:scale-95"
                    title="Pagar fatura acumulada"
                  >
                    <DollarSign size={11} className="text-slate-500" />
                    <span>Pagar</span>
                  </button>
                </div>

                {/* Últimas Faturas Section: Structured as individual visual cards */}
                <div className="flex-1 flex flex-col justify-between pt-1">
                  <div>
                    <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5">
                      <Clock size={11} className="text-slate-400 shrink-0" /> Últimas Faturas com Lançamentos
                    </h4>

                    {competencies.length === 0 ? (
                      <div className="text-center py-6 text-slate-400 border border-dashed border-slate-100 rounded-2xl bg-slate-50/20">
                        <p className="text-[9px] font-bold uppercase tracking-widest">Sem faturas com lançamentos</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {competencies.map((period, pIdx) => {
                          const total = getInvoiceTotalAmount(card.id, period);
                          const count = getInvoiceTransactions(card.id, period).length;
                          const status = getInvoiceStatus(card.id, period);
                          const { label, badgeClass, dotClass } = getInvoiceStatusLabelAndBadge(status);

                          // Display short format month, capitalized
                          const capMonth = period.toLocaleDateString('pt-BR', { month: 'long' });
                          const displayMonthYear = `${capMonth.charAt(0).toUpperCase() + capMonth.slice(1)} ${period.getFullYear()}`;

                          return (
                            <div
                              key={pIdx}
                              onClick={() => {
                                setDetailPeriod(period);
                                setSelectedCardForDetails(card);
                              }}
                              className="group relative flex flex-col justify-between p-3.5 rounded-2xl border border-slate-100 hover:border-blue-200 bg-slate-50/20 hover:bg-white hover:shadow-md cursor-pointer transition-all duration-200"
                            >
                              <div className="flex items-start justify-between">
                                <div>
                                  <span className="text-xs font-black text-slate-800 capitalize leading-tight block">
                                    {displayMonthYear}
                                  </span>
                                  <span className="text-[10px] font-bold text-slate-400 block mt-0.5">
                                    {count} {count === 1 ? 'lançamento' : 'lançamentos'}
                                  </span>
                                </div>
                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border shadow-sm ${badgeClass}`}>
                                  <span className={`w-1 h-1 rounded-full ${dotClass}`} />
                                  {label}
                                </span>
                              </div>

                              <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-100/50">
                                <span className="text-xs font-black text-slate-800 font-mono">
                                  {formatCurrency(total)}
                                </span>
                                <span className="text-blue-500 group-hover:translate-x-1 transition-transform">
                                  <ChevronRight size={14} />
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => setSelectedCardForHistory(card)}
                    className="w-full mt-4 py-2.5 text-center text-[10px] font-black uppercase tracking-wider text-blue-600 hover:text-blue-700 bg-blue-50/40 hover:bg-blue-50 rounded-xl transition-all border border-blue-100/50 cursor-pointer flex items-center justify-center gap-1 shadow-sm"
                  >
                    <History size={10} /> Ver Linha do Tempo de Faturas
                  </button>
                </div>
              </div>
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
  const formatAccountTypeLabel = (typeStr?: string) => {
    if (!typeStr) return 'Conta Corrente';
    const t = typeStr.toLowerCase();
    if (t === 'checking' || t === 'corrente') return 'Conta Corrente';
    if (t === 'savings' || t === 'poupança') return 'Poupança';
    if (t === 'credit_card' || t === 'credit' || t === 'cartão') return 'Cartão de Crédito';
    if (t === 'cash' || t === 'caixa' || t === 'dinheiro') return 'Caixa';
    return typeStr;
  };

  const renderContas = () => {
    if (selectedAccountIdForDetail) {
      return (
        <ContaBancariaDetalhe
          accountId={selectedAccountIdForDetail}
          currentUser={currentUser}
          accounts={accounts}
          categories={categories}
          transactions={transactions}
          getAccountLiveBalance={getAccountLiveBalance}
          showToast={showToast}
          onBack={() => setSelectedAccountIdForDetail(null)}
          onRefreshData={loadFinancialData}
          onOpenNewExpenseModal={(data) => {
            const isIncome = data.type === 'INCOME' || data.type === 'credit';
            const txType = isIncome ? TransactionType.INCOME : TransactionType.EXPENSE;

            setNewTransaction({
              description: data.description,
              amount: data.amount,
              due_date: data.date,
              payment_date: data.payment_date || data.date,
              type: txType,
              status: TransactionStatus.PAID,
              agency_id: currentUser.agencyId,
              account_id: data.account_id || selectedAccountIdForDetail || accounts[0]?.id || '',
              category_id: data.category_id || '',
              bank_transaction_id: data.bank_transaction_id,
            });

            setAmountInputStr(data.amount ? data.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '');
            setMarkAsPaid(true);
            setIsAutoFilledFromBank(true);
            setEditingTransaction(null);
            setModalType('transaction');
            setIsModalOpen(true);
          }}
        />
      );
    }

    return (
      <ContasBancarias
        currentUser={currentUser}
        accounts={accounts}
        categories={categories}
        getAccountLiveBalance={getAccountLiveBalance}
        showToast={showToast}
        onRefreshData={loadFinancialData}
        onAddAccount={() => {
          setModalType('account');
          setIsModalOpen(true);
        }}
        onEditAccount={handleEditAccountClick}
        onDeleteAccount={handleDeleteAccount}
        onSelectAccount={(accId) => setSelectedAccountIdForDetail(accId)}
      />
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
              {totalImportedCount > 0 && progressPercent === 100 ? (
                <div className="flex flex-col h-full justify-between">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Progresso de Conciliação</p>
                    <p className="text-emerald-600 font-black text-xs uppercase mb-1 flex items-center justify-center gap-1">
                      <Check size={14} /> 100% Pronto
                    </p>
                  </div>

                  {isReconciliationConcluded ? (
                    <div className="text-[10px] text-emerald-600 font-black bg-emerald-50 py-1.5 px-3 rounded-lg border border-emerald-100 flex items-center justify-center gap-1 uppercase tracking-wider">
                      <CheckCircle2 size={12} /> Concluída
                    </div>
                  ) : (
                    <button
                      onClick={handleConcludeReconciliation}
                      disabled={loading}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-[10px] py-1.5 px-3 rounded-lg transition-all shadow-sm cursor-pointer uppercase tracking-wider"
                    >
                      {loading ? 'Processando...' : 'Concluir Conciliação'}
                    </button>
                  )}
                </div>
              ) : (
                <>
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
                </>
              )}
            </div>
          </div>
        </div>

        {/* Workspace Layout */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-6">
            <div />

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
                    setRecurrenceType('NONE');
                    setRecurrencePeriods(1);
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
                    .sort((a, b) => {
                      const aMatched = !!a.matched;
                      const bMatched = !!b.matched;
                      if (aMatched !== bMatched) {
                        return aMatched ? 1 : -1;
                      }
                      return parseDateSafe(b.date) - parseDateSafe(a.date);
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
                            setRecurrenceType('NONE');
                            setRecurrencePeriods(1);

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
                              {formatDateBR(item.date)}
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

                {isReconciliationConcluded ? (
                  <div className="space-y-4">
                    {activeImportedItem ? (
                      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-3">
                        <div className="flex justify-between items-start">
                          <span className="text-[9px] bg-emerald-50 text-emerald-600 font-bold px-2 py-0.5 rounded uppercase tracking-wider font-sans">
                            Item do Histórico (Conciliado)
                          </span>
                        </div>

                        <h4 className="text-sm font-black text-slate-800 leading-tight font-sans">
                          {normalizeDescription(activeImportedItem.description)}
                        </h4>

                        <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-50 text-xs text-slate-500 font-medium">
                          <div>
                            <p className="text-[9px] text-slate-400 uppercase font-black tracking-wider">Data</p>
                            <p className="text-slate-700 font-bold">{formatDateBR(activeImportedItem.date)}</p>
                          </div>
                          <div>
                            <p className="text-[9px] text-slate-400 uppercase font-black tracking-wider">Valor</p>
                            <p className={`font-black ${activeImportedItem.type === TransactionType.INCOME ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {activeImportedItem.type === TransactionType.INCOME ? 'Entrada (+)' : 'Saída (-)'} {formatCurrency(activeImportedItem.amount)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="py-8 text-center text-slate-400">
                        <RefreshCw size={24} className="mx-auto text-slate-300 mb-2" />
                        <p className="text-xs font-bold uppercase tracking-wider">Lote Concluído</p>
                        <p className="text-[10px] mt-1">Selecione uma transação à esquerda para visualizar seu histórico.</p>
                      </div>
                    )}

                    <div className="bg-emerald-50/40 border border-emerald-200 rounded-2xl p-6 text-center space-y-3 shadow-sm">
                      <CheckCircle2 size={32} className="text-emerald-500 mx-auto" />
                      <div>
                        <h4 className="text-xs font-black text-emerald-800 uppercase tracking-wider">Lote Concluído</h4>
                        <p className="text-[10px] text-emerald-600 font-medium mt-1 leading-relaxed">
                          Esta conciliação foi finalizada com sucesso. As edições e novos vínculos estão desabilitados para preservar o histórico.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : !activeImportedItem ? (
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
                          <p className="text-slate-700 font-bold">{formatDateBR(activeImportedItem.date)}</p>
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
                                  <span>Vencimento: {formatDateBR(pairedTx.due_date)}</span>
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
                                onClick={() => {
                                  setShowQuickCreateForm(false);
                                  setRecurrenceType('NONE');
                                  setRecurrencePeriods(1);
                                }}
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

                              {/* Lançamento Recorrente Toggle & Options */}
                              <div className="space-y-2 pt-1 border-t border-slate-50">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    id="quickRecurrent"
                                    className="rounded text-indigo-600 focus:ring-indigo-400 cursor-pointer w-4 h-4"
                                    checked={recurrenceType !== 'NONE'}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setRecurrenceType('MONTHLY');
                                        setRecurrencePeriods(1);
                                      } else {
                                        setRecurrenceType('NONE');
                                        setRecurrencePeriods(1);
                                      }
                                    }}
                                  />
                                  <label htmlFor="quickRecurrent" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                                    Lançamento recorrente
                                  </label>
                                </div>

                                {recurrenceType !== 'NONE' && (
                                  <div className="grid grid-cols-2 gap-3 pl-6">
                                    <div>
                                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">Frequência</label>
                                      <select
                                        value={recurrenceType}
                                        onChange={(e) => setRecurrenceType(e.target.value as any)}
                                        className="w-full bg-slate-50 border border-slate-100 rounded-xl p-2 text-xs outline-none text-slate-800 focus:border-indigo-300 focus:ring-1 focus:ring-indigo-100 font-medium"
                                      >
                                        <option value="WEEKLY">Semanal</option>
                                        <option value="MONTHLY">Mensal</option>
                                        <option value="YEARLY">Anual</option>
                                      </select>
                                    </div>
                                    <div>
                                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">Repetições futuras</label>
                                      <input
                                        type="number"
                                        min={1}
                                        max={60}
                                        value={recurrencePeriods}
                                        onChange={(e) => setRecurrencePeriods(Math.max(1, Number(e.target.value)))}
                                        className="w-full bg-slate-50 border border-slate-100 rounded-xl p-2 text-xs outline-none text-slate-800 focus:border-indigo-300 focus:ring-1 focus:ring-indigo-100 font-medium"
                                      />
                                    </div>
                                  </div>
                                )}
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
                                    {formatDateBR(selectedSystemTx.due_date)}
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
                                  setRecurrenceType('NONE');
                                  setRecurrencePeriods(1);
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
                          setRecurrenceType('NONE');
                          setRecurrencePeriods(1);
                        }}
                        className={`p-4 rounded-2xl border transition-all flex flex-col justify-between cursor-pointer space-y-3 ${
                          isSelected
                            ? 'bg-indigo-50/50 border-indigo-200 ring-1 ring-indigo-100'
                            : 'bg-white border-slate-100 hover:border-slate-200 hover:shadow-sm'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-400">
                            Vence em {formatDateBR(tx.due_date)}
                          </span>
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${badgeBg}`}>
                            {score}% Compatível
                          </span>
                        </div>

                        <div>
                          <p className="font-bold text-slate-800 text-xs leading-relaxed whitespace-normal break-words">
                            {normalizeDescription(tx.description)}
                          </p>
                          {tx.contact_name && (
                            <p className="text-[10px] text-gray-400 mt-1 font-semibold">{tx.contact_name}</p>
                          )}

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
                              setRecurrenceType('NONE');
                              setRecurrencePeriods(1);
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
                              setRecurrenceType('NONE');
                              setRecurrencePeriods(1);
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
          setPreference('financial_category_groups', updated).catch(console.error);
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
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-6">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2 uppercase tracking-wide">
              <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">
                <ArrowUpRight size={14} />
              </span>
              Categorias de Receita
            </h3>

            <div className="space-y-6">
              {sortedRevenueGroups.map(([groupName, cats]) => (
                <div key={groupName} className="space-y-3">
                  <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide flex items-center justify-between">
                    <span>{groupName}</span>
                    <span className="text-[11px] bg-slate-100 text-slate-600 rounded-full px-2 py-0.5 font-medium">{cats.length} {cats.length === 1 ? 'Categoria' : 'Categorias'}</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {cats.map(cat => (
                      <div key={cat.id} className="p-3.5 border border-slate-200 bg-white rounded-xl flex items-center justify-between gap-3 shadow-2xs hover:border-slate-300 transition-all">
                        <div className="flex items-center gap-2.5">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-slate-400" />
                          <p className="text-xs font-semibold text-slate-900">{cat.name}</p>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleEditCategoryClick(cat)}
                            className="p-1 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                            title="Editar"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(cat.id)}
                            className="p-1 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
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
                <div className="text-center py-10 text-slate-400 text-xs font-medium">Sem categorias cadastradas</div>
              )}
            </div>
          </div>

          {/* Expenses block */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-6">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2 uppercase tracking-wide">
              <span className="w-6 h-6 rounded-lg bg-red-100 text-red-600 flex items-center justify-center font-bold">
                <ArrowDownRight size={14} />
              </span>
              Categorias de Despesa
            </h3>

            <div className="space-y-6">
              {sortedExpenseGroups.map(([groupName, cats]) => (
                <div key={groupName} className="space-y-3">
                  <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide flex items-center justify-between">
                    <span>{groupName}</span>
                    <span className="text-[11px] bg-slate-100 text-slate-600 rounded-full px-2 py-0.5 font-medium">{cats.length} {cats.length === 1 ? 'Categoria' : 'Categorias'}</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {cats.map(cat => (
                      <div key={cat.id} className="p-3.5 border border-slate-200 bg-white rounded-xl flex items-center justify-between gap-3 shadow-2xs hover:border-slate-300 transition-all">
                        <div className="flex items-center gap-2.5">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-slate-400" />
                          <p className="text-xs font-semibold text-slate-900">{cat.name}</p>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleEditCategoryClick(cat)}
                            className="p-1 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                            title="Editar"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(cat.id)}
                            className="p-1 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
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
                <div className="text-center py-10 text-slate-400 text-xs font-medium">Sem categorias cadastradas</div>
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

              {/* Additional Filter Trigger */}
              <div className="relative">
                <button
                  onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                  className="flex items-center gap-1.5 text-slate-500 hover:text-slate-900 transition-colors bg-white font-bold text-xs px-3.5 py-2.5 border border-slate-100 rounded-xl shadow-sm cursor-pointer"
                >
                  <Filter size={14} />
                  <span>Filtrar</span>
                </button>
                {(categoryFilter !== 'ALL' || accountFilter !== 'ALL' || statusFilter !== 'ALL') && (
                  <span
                    id="filter-active-dot"
                    className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-500 rounded-full border border-white shadow-sm animate-pulse"
                  />
                )}

                {isFilterDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsFilterDropdownOpen(false)} />
                    <div className="absolute left-0 mt-2 w-64 bg-white border border-slate-100 rounded-2xl shadow-xl p-4 z-20 space-y-4">
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Filtrar por Situação</label>
                        <select
                          value={statusFilter}
                          onChange={(e) => {
                            setStatusFilter(e.target.value as any);
                            setVisibleCount(20);
                          }}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-700 outline-none cursor-pointer"
                        >
                          <option value="ALL">Todas as Situações</option>
                          <option value="OPEN">Em Aberto</option>
                          <option value="OVERDUE">Vencido</option>
                          <option value="PAID">Pago</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Filtrar por Categoria</label>
                        <select
                          value={categoryFilter}
                          onChange={(e) => {
                            setCategoryFilter(e.target.value);
                            setVisibleCount(20);
                          }}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-700 outline-none cursor-pointer"
                        >
                          <option value="ALL">Todas as Categorias</option>
                          {categories.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Filtrar por Conta</label>
                        <select
                          value={accountFilter}
                          onChange={(e) => {
                            setAccountFilter(e.target.value);
                            setVisibleCount(20);
                          }}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-700 outline-none cursor-pointer"
                        >
                          <option value="ALL">Todas as Contas</option>
                          {accounts.map(acc => (
                            <option key={acc.id} value={acc.id}>{acc.name}</option>
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
                onClick={handleOpenLancarExtratoModal}
                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-indigo-600 text-white font-black text-xs uppercase tracking-wider rounded-xl hover:bg-indigo-700 hover:scale-[1.02] transform transition-all shadow-sm cursor-pointer"
              >
                <Plus size={14} /> Lançar Extrato
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
                  const isConsolidatedView = selectedAccountIds.length === 0;
                  const activeAccountIds = selectedAccountIds.length > 0 ? selectedAccountIds : accounts.map(a => a.id);
                  const txsForSelectedAccounts = transactions.filter(t => {
                    const accId = t.account_id || t.financial_account_id;
                    if (!activeAccountIds.includes(accId || '')) return false;

                    // Double counting avoidance rule:
                    if (isConsolidatedView) {
                      const acc = accounts.find(a => a.id === accId);
                      if (acc && (acc.type === 'credit_card' || acc.account_type === 'credit_card')) {
                        if (t.type === TransactionType.EXPENSE) {
                          return false;
                        }
                      }
                    }

                    return t.is_transfer !== true;
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
            {localActiveView === 'financial-fluxo' && (
              <FluxoCaixa currentUser={currentUser} showToast={showToast} />
            )}
            {localActiveView === 'financial-cartoes' && renderCartoes()}
            {localActiveView === 'financial-contas' && renderContas()}
            {localActiveView === 'financial-conciliacao' && (
              <Conciliacao
                currentUser={currentUser}
                accounts={accounts}
                categories={categories}
                showToast={showToast}
                onOpenNewExpenseModal={(data) => {
                  const isIncome = data.type === 'INCOME' || data.type === 'credit';
                  const txType = isIncome ? TransactionType.INCOME : TransactionType.EXPENSE;

                  setNewTransaction({
                    description: data.description,
                    amount: data.amount,
                    due_date: data.date,
                    payment_date: data.payment_date || data.date,
                    type: txType,
                    status: TransactionStatus.PAID,
                    agency_id: currentUser.agencyId,
                    account_id: data.account_id || accounts[0]?.id || '',
                    category_id: data.category_id || '',
                    bank_transaction_id: data.bank_transaction_id,
                  });

                  setAmountInputStr(data.amount ? data.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '');
                  setMarkAsPaid(true);
                  setIsAutoFilledFromBank(true);
                  setEditingTransaction(null);
                  setModalType('transaction');
                  setIsModalOpen(true);
                }}
              />
            )}
            {localActiveView === 'financial-importar-extrato' && (
              <ImportarExtrato
                accounts={accounts}
                agencyId={currentUser.agencyId}
                onImportDone={() => setLocalActiveView('financial-conciliacao')}
                showToast={showToast}
              />
            )}
            {localActiveView === 'financial-contratos' && (
              <ImportarImobia
                currentUser={currentUser}
                showToast={showToast}
                onImportDone={() => setLocalActiveView('financial-fluxo')}
              />
            )}
            {localActiveView === 'financial-cartoes' && (
              <Cartoes
                currentUser={currentUser}
                accounts={accounts}
                transactions={transactions}
                showToast={showToast}
                onRefreshData={loadFinancialData}
              />
            )}
            {localActiveView === 'financial-categorias' && renderCategorias()}
            {localActiveView === 'financial-centrocusto' && renderCentroCusto()}
            {localActiveView === 'financial-relatorios' && renderRelatorios()}
            {(localActiveView === 'financial-extrato' || localActiveView === 'financial') && renderExtrato()}
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
                         <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Cliente / Fornecedor</label>
                         <input
                           type="text" placeholder="Ex: João Silva / Cliente ou Fornecedor"
                           className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-100 transition-all font-medium text-slate-800"
                           value={responsibleClient}
                           onChange={(e) => setResponsibleClient(e.target.value)}
                         />
                       </div>
                      <div>
                        <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Descrição do Lançamento*</label>
                        <input
                          type="text" placeholder="Ex: Aluguel Sala Fidelité"
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-100 transition-all font-medium text-slate-800"
                          value={newTransaction.description}
                          onChange={(e) => setNewTransaction({...newTransaction, description: e.target.value})}
                        />
                      </div>

                      {isAutoFilledFromBank && (
                        <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-xs text-indigo-900 flex items-center gap-2">
                          <Sparkles size={16} className="text-indigo-600 shrink-0" />
                          <span>Dados preenchidos automaticamente do extrato. Revise a categoria antes de salvar.</span>
                        </div>
                      )}
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
                          <option value={TransactionType.TRANSFER}>Transferência entre Contas</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Valor (R$)*</label>
                          <input
                            type="text" placeholder="Ex: 710,00"
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
                          <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase">
                            {newTransaction.type === TransactionType.TRANSFER ? 'Conta Origem (Saída)*' : 'Conta Bancária*'}
                          </label>
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
                          {newTransaction.type === TransactionType.TRANSFER ? (
                            <>
                              <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Conta Destino (Entrada)*</label>
                              <select
                                className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-100 transition-all font-medium text-slate-700"
                                value={destinationAccountId}
                                required
                                onChange={(e) => setDestinationAccountId(e.target.value)}
                              >
                                <option value="">Selecione...</option>
                                {accounts
                                  .filter(a => a.id !== newTransaction.account_id)
                                  .map(a => (
                                    <option key={a.id} value={a.id}>{a.name}</option>
                                  ))}
                              </select>
                            </>
                          ) : (
                            <>
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
                            </>
                          )}
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
                                payment_date: prev.payment_date || getLocalTodayStr()
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
                          {newTransaction.type === TransactionType.INCOME
                            ? 'Marcar como Recebido'
                            : newTransaction.type === TransactionType.TRANSFER
                            ? 'Marcar como Transferido / Efetivado'
                            : 'Marcar como Pago'}
                        </label>
                      </div>

                      {markAsPaid && (
                        <div>
                          <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Data do Pagamento*</label>
                          <input
                            type="date"
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-100 transition-all font-medium text-slate-700"
                            value={newTransaction.payment_date || getLocalTodayStr()}
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
                     disabled={isSubmittingTransaction}
                     className={`px-5 py-2.5 rounded-xl text-sm font-semibold shadow-lg transition-colors ${
                       isSubmittingTransaction
                         ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                         : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-100'
                     }`}
                   >
                     {isSubmittingTransaction ? 'Salvando...' : 'Confirmar Lançamento'}
                   </button>
                 </div>
               </div>
             ) : (
               <motion.div
                 initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                 className="bg-white rounded-3xl w-full max-w-xl shadow-2xl relative z-10 overflow-hidden"
               >
                {/* 2. Modal type: Account creation */}
                 {modalType === 'account' && (
                   <div className="flex flex-col">
                     {/* Header */}
                     <div className="p-6 border-b border-slate-100 bg-white flex items-center justify-between">
                       <div className="flex items-center gap-3">
                         <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                           <Landmark size={20} />
                         </div>
                         <div>
                           <h2 className="text-xl font-semibold text-slate-900 leading-tight">
                             {editingAccount ? 'Editar Conta Bancária' : 'Adicionar Nova Conta'}
                           </h2>
                           <p className="text-xs text-slate-500 font-medium">
                             {editingAccount ? 'Atualize os dados da sua conta bancária' : 'Cadastre uma nova conta financeira'}
                           </p>
                         </div>
                       </div>
                       <button
                         type="button"
                         onClick={handleCloseModal}
                         className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                         title="Fechar"
                       >
                         <X size={20} />
                       </button>
                     </div>

                     {/* Form Body */}
                     <div className="p-6 space-y-5 bg-white">
                       {/* Seção Banco */}
                       <div>
                         <label className="text-xs font-semibold text-slate-500 tracking-wider uppercase block mb-2.5">
                           BANCO
                         </label>
                         <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                           {[
                             { code: 'sicoob', name: 'Sicoob', color: '#006B3F', normalized: 'sicoob' },
                             { code: 'cresol', name: 'Cresol', color: '#007BC0', normalized: 'cresol' },
                             { code: 'inter', name: 'Inter', color: '#FF7A00', normalized: 'inter' },
                             { code: 'outros', name: 'Outros', color: '#64748b', normalized: 'outros' },
                           ].map((b) => {
                             const isSelected = getNormalizedBankCode(newAccount.bank_code) === b.normalized;
                             return (
                               <button
                                 key={b.normalized}
                                 type="button"
                                 onClick={() => {
                                   setNewAccount((prev) => ({
                                     ...prev,
                                     bank_code: b.code,
                                     color: b.color,
                                   }));
                                 }}
                                 className={`aspect-square rounded-xl border-2 p-4 bg-white flex flex-col items-center justify-center text-center transition-all cursor-pointer ${isSelected ? "border-blue-500 ring-2 ring-blue-100 bg-blue-50/20 shadow-xs" : "border-slate-200 hover:border-slate-300 hover:shadow-md"}`}
                               >
                                 <BankLogo code={b.normalized} size={48} className="w-12 h-12" />
                                 <span className="text-sm font-medium text-slate-700 mt-2">
                                   {b.name}
                                 </span>
                               </button>
                             );
                           })}
                         </div>
                       </div>

                       {/* Nome da Conta */}
                       <div>
                         <label className="text-xs font-semibold text-slate-500 tracking-wider uppercase block mb-1.5">
                           NOME DA CONTA*
                         </label>
                         <input
                           type="text"
                           placeholder="Ex: Conta principal, Conta salários"
                           className="w-full rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-slate-800 text-sm font-medium py-3 px-4 transition-all bg-white"
                           value={newAccount.name}
                           onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
                         />
                       </div>

                       {/* Saldo */}
                       {editingAccount ? (
                         <div>
                           <label className="text-xs font-semibold text-slate-500 tracking-wider uppercase block mb-1.5">
                             SALDO ATUAL*
                           </label>
                           <div className="relative flex items-center">
                             <span className="absolute left-4 text-sm font-bold text-slate-400 select-none">
                               R$
                             </span>
                             <input
                               type="text"
                               inputMode="decimal"
                               lang="pt-BR"
                               placeholder="0,00"
                               required
                               className="w-full rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-slate-900 font-bold text-base py-3 pl-11 pr-4 transition-all bg-white"
                               value={formatBRL(newAccount.current_balance)}
                               onChange={(e) => setNewAccount({ ...newAccount, current_balance: e.target.value })}
                               onBlur={(e) => setNewAccount({ ...newAccount, current_balance: formatBRL(e.target.value) })}
                             />
                           </div>
                           <p className="text-xs text-slate-500 mt-1.5 font-medium">
                             Saldo Anterior: {formatCurrency(editingAccount.current_balance !== undefined && editingAccount.current_balance !== null ? editingAccount.current_balance : (editingAccount.initial_balance || 0))}
                           </p>
                         </div>
                       ) : (
                         <div className="grid grid-cols-2 gap-4">
                           <div>
                             <label className="text-xs font-semibold text-slate-500 tracking-wider uppercase block mb-1.5">
                               SALDO INICIAL (R$)*
                             </label>
                             <div className="relative flex items-center">
                               <span className="absolute left-4 text-sm font-bold text-slate-400 select-none">
                                 R$
                               </span>
                               <input
                                 type="text"
                                 inputMode="decimal"
                                 lang="pt-BR"
                                 placeholder="0,00"
                                 required
                                 className="w-full rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-slate-900 font-bold text-base py-3 pl-11 pr-4 transition-all bg-white"
                                 value={formatBRL(newAccount.initial_balance)}
                                 onChange={(e) => setNewAccount({ ...newAccount, initial_balance: e.target.value, current_balance: e.target.value })}
                                 onBlur={(e) => {
                                   const f = formatBRL(e.target.value);
                                   setNewAccount({ ...newAccount, initial_balance: f, current_balance: f });
                                 }}
                               />
                             </div>
                           </div>
                           <div>
                             <label className="text-xs font-semibold text-slate-500 tracking-wider uppercase block mb-1.5">
                               TIPO DE CONTA*
                             </label>
                             <select
                               className="w-full rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-slate-800 text-sm font-medium py-3 px-4 transition-all bg-white"
                               value={newAccount.type}
                               onChange={(e) => setNewAccount({ ...newAccount, type: e.target.value })}
                             >
                               <option value="checking">Conta Corrente</option>
                               <option value="savings">Poupança</option>
                               <option value="credit_card">Cartão de Crédito</option>
                               <option value="cash">Caixa</option>
                             </select>
                           </div>
                         </div>
                       )}

                       {/* Cor da Conta */}
                       <div>
                         <label className="text-xs font-semibold text-slate-500 tracking-wider uppercase block mb-1.5">
                           COR DA CONTA
                         </label>
                         <select
                           className="w-full rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-slate-800 text-sm font-medium py-3 px-4 transition-all bg-white"
                           value={newAccount.color}
                           onChange={(e) => setNewAccount({ ...newAccount, color: e.target.value })}
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

                     {/* Footer */}
                     <div className="p-6 border-t border-slate-100 bg-white flex items-center justify-end gap-3">
                       <button
                         type="button"
                         onClick={handleCloseModal}
                         className="px-5 py-3 text-slate-600 hover:bg-slate-50 rounded-xl font-medium text-sm transition-colors cursor-pointer"
                       >
                         Cancelar
                       </button>
                       <button
                         type="button"
                         onClick={handleCreateAccount}
                         className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium text-sm hover:from-blue-700 hover:to-indigo-700 transition-all px-6 py-3 shadow-xs hover:shadow-md cursor-pointer"
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

                      <div className="flex items-start gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100 mt-2">
                        <input
                          id="category-affects-dre"
                          type="checkbox"
                          className="mt-1 h-4 w-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                          checked={newCategory.affects_dre}
                          onChange={(e) => setNewCategory({...newCategory, affects_dre: e.target.checked})}
                        />
                        <div className="flex flex-col">
                          <label htmlFor="category-affects-dre" className="text-xs font-bold text-slate-700 cursor-pointer">
                            Participa do DRE
                          </label>
                          <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                            Quando desmarcado, esta categoria continuará aparecendo normalmente no Extrato, Fluxo de Caixa, Conciliação Bancária e Centro de Custo, porém deixará de compor o DRE.
                          </p>
                        </div>
                      </div>
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
                          type="text" placeholder="0,00"
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 outline-none font-bold text-slate-800"
                          value={newAccount.credit_limit}
                          onChange={(e) => setNewAccount({...newAccount, credit_limit: formatBRL(e.target.value)})}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Dia de Fechamento (1 a 31)</label>
                          <input
                            type="number" min="1" max="31" placeholder="Ex: 5"
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 outline-none text-slate-800"
                            value={newAccount.closing_day}
                            onChange={(e) => setNewAccount({...newAccount, closing_day: e.target.value})}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Dia de Vencimento (1 a 31)</label>
                          <input
                            type="number" min="1" max="31" placeholder="Ex: 15"
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 outline-none text-slate-800"
                            value={newAccount.due_day}
                            onChange={(e) => setNewAccount({...newAccount, due_day: e.target.value})}
                          />
                        </div>
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

      {/* Recurrence Edit Choice Modal */}
      <RecurrenceEditModal
        isOpen={isRecurrenceEditModalOpen}
        onClose={() => setIsRecurrenceEditModalOpen(false)}
        option={recurrenceEditOption}
        onOptionChange={setRecurrenceEditOption}
        onConfirm={() => handleConfirmRecurrenceEdit(editingTransaction, handleCloseModal, setEditingTransaction)}
      />

      {/* Modal: Pagar Fatura de Cartão de Crédito */}
      <PayInvoiceModal
        isOpen={payInvoiceModalOpen}
        card={selectedCardForPayment}
        onClose={() => setPayInvoiceModalOpen(false)}
        loading={loading}
        sourceAccountId={payInvoiceSourceAccountId}
        onSourceAccountIdChange={setPayInvoiceSourceAccountId}
        amountStr={payInvoiceAmountStr}
        onAmountStrChange={setPayInvoiceAmountStr}
        paymentDate={payInvoiceDate}
        onPaymentDateChange={setPayInvoiceDate}
        onConfirm={handlePreConfirmPayInvoice}
        data={{
          accounts,
          currentPeriod: paymentInvoicePeriod
        }}
        invoiceService={{
          getInvoicePeriodRangeStr: InvoiceDomain.getInvoicePeriodRangeStr,
          getAccountLiveBalance
        }}
        formatters={{
          currency: formatCurrency,
          formatBRL
        }}
      />

      {/* Modal: Detalhes da Fatura do Cartão */}
      <InvoiceDetailsModal
        isOpen={!!selectedCardForDetails}
        card={selectedCardForDetails}
        onClose={() => setSelectedCardForDetails(null)}
        period={detailPeriod}
        onPeriodChange={setDetailPeriod}
        data={{
          accounts,
          categories,
          transactions
        }}
        invoiceService={{
          getInvoicePeriodRangeStr: InvoiceDomain.getInvoicePeriodRangeStr,
          getInvoiceTransactions,
          getInvoiceTotalAmount,
          getInvoiceStatus
        }}
        formatters={{
          currency: formatCurrency,
          formatDateBR
        }}
        onEditTransaction={handleEditTransactionClick}
        onDeleteTransaction={handleDeleteTransaction}
        onDuplicateTransaction={handleDuplicateTransaction}
        onQuickLaunch={handleOpenQuickLaunchModal}
        onPayInvoice={handleOpenPayInvoiceModal}
        categoryGroups={categoryGroups}
      />

      <input
        type="file"
        ref={cardFileInputRef}
        className="hidden"
        accept=".csv,.ofx"
        onChange={handleCardFileChange}
      />

      {/* Modal: Importar Fatura de Cartão */}
      <AnimatePresence>
        {isImportModalOpen && importingCard && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
              onClick={() => {
                if (!loading) {
                  setIsImportModalOpen(false);
                  setImportedLines([]);
                  setImportingCard(null);
                }
              }}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl w-[90vw] max-w-[1400px] shadow-2xl relative z-10 p-6 md:p-8 overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
                <div className="flex items-center gap-3">
                  <Upload className="text-blue-500 animate-pulse" size={24} />
                  <div>
                    <h2 className="text-xl font-black text-slate-900">
                      Importar Lançamentos da Fatura
                    </h2>
                    <p className="text-xs text-slate-400 font-bold uppercase mt-0.5">{importingCard.name}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setIsImportModalOpen(false);
                    setImportedLines([]);
                    setImportingCard(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 text-sm font-black uppercase p-1"
                >
                  Fechar
                </button>
              </div>

              {/* Top Configuration Bar */}
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                  <span className="text-xs font-black text-slate-700 uppercase tracking-wider">Configurações Gerais</span>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full md:w-auto">
                  <label className="text-xs font-black text-slate-400 uppercase whitespace-nowrap">Categoria Padrão para Itens:</label>
                  <select
                    value={defaultImportCategoryId}
                    onChange={(e) => setDefaultImportCategoryId(e.target.value)}
                    className="w-full sm:w-64 bg-white border border-slate-200 rounded-xl p-2 text-xs font-bold outline-none shadow-sm"
                  >
                    <option value="">Selecione uma categoria padrão...</option>
                    {categories
                      .filter(c => c.type === TransactionType.EXPENSE)
                      .map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Transactions Preview Table Container */}
              <div className={`border border-slate-100 rounded-2xl mb-6 shadow-inner overflow-x-auto lg:overflow-x-clip ${
                importedLines.length > 10
                  ? 'max-h-[70vh] overflow-y-auto'
                  : ''
              }`}>
                <table className="w-full text-left border-collapse table-fixed min-w-full">
                  <thead className="sticky top-0 z-20 bg-slate-50/95 backdrop-blur-sm border-b border-slate-100 shadow-sm">
                    <tr className="text-slate-400 text-[10px] font-black uppercase tracking-widest">
                      <th className="py-3.5 px-3 text-center w-[48px] shrink-0">
                        <input
                          type="checkbox"
                          ref={importHeaderCheckboxRef}
                          checked={importedLines.length > 0 && importedLines.every(line => line.selected !== false)}
                          onChange={(e) => {
                            const isChecked = e.target.checked;
                            setImportedLines(prev => prev.map(line => ({ ...line, selected: isChecked })));
                          }}
                          className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer h-4 w-4"
                        />
                      </th>
                      <th className="py-3.5 px-3 text-center w-[130px] shrink-0">Status</th>
                      <th className="py-3.5 px-3 w-[110px] shrink-0">Data Compra</th>
                      <th className="py-3.5 px-3 w-auto min-w-[300px]">Descrição</th>
                      <th className="py-3.5 px-3 text-right w-[110px] shrink-0">Valor</th>
                      <th className="py-3.5 px-3 w-[170px] shrink-0">Categoria</th>
                      <th className="py-3.5 px-3 w-[110px] shrink-0">Período/Fatura</th>
                      <th className="py-3.5 px-3 text-center w-[60px] shrink-0">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/60">
                    {importedLines.map((line, idx) => {
                      const computedPeriod = getPurchaseInvoicePeriodStr(line.date, importingCard);
                      const selectedCategoryName = categories.find(c => c.id === (line.categoryId || defaultImportCategoryId))?.name || 'Nenhuma';
                      const defaultCategory = categories.find(c => c.id === defaultImportCategoryId);
                      const isUsingDefaultCategory = !line.categoryId;
                      return (
                        <tr
                          key={line.id || idx}
                          className={`text-xs hover:bg-slate-50/50 transition-colors ${line.isDuplicate ? 'bg-amber-50/20' : ''} ${line.selected === false ? 'opacity-60 bg-slate-50/30' : ''}`}
                        >
                          <td className="py-3.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={line.selected !== false}
                              onChange={(e) => {
                                setImportedLines(prev =>
                                  prev.map((item, i) =>
                                    i === idx
                                      ? { ...item, selected: e.target.checked }
                                      : item
                                  )
                                );
                              }}
                              className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer h-4 w-4"
                            />
                          </td>
                          <td className="py-3.5 px-3 text-center whitespace-nowrap">
                            {line.isBalanceAdjustment ? (
                              <span
                                className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-[9px] font-black uppercase px-2.5 py-1 rounded-full border border-amber-300 shadow-sm"
                                title="Lançamento de acerto de saldo."
                              >
                                Acerto de Saldo
                              </span>
                            ) : line.isDuplicate ? (
                              <span
                                className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 text-[9px] font-black uppercase px-2.5 py-1 rounded-full border border-amber-200"
                                title="Aviso de possível duplicidade com lançamento existente no mesmo cartão, mesma data e mesmo valor."
                              >
                                Duplicado?
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-[9px] font-black uppercase px-2.5 py-1 rounded-full border border-emerald-100">
                                Novo
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-3 text-slate-500 font-medium whitespace-nowrap">
                            {formatDateBR(line.date)}
                          </td>
                          <td className="py-3.5 px-3" title={line.description}>
                            <input
                              type="text"
                              value={line.description}
                              title={line.description}
                              onChange={(e) => {
                                setImportedLines(prev =>
                                  prev.map((item, i) =>
                                    i === idx
                                      ? { ...item, description: e.target.value }
                                      : item
                                  )
                                );
                              }}
                              className="w-full bg-slate-50 border border-slate-100 rounded-lg p-1.5 text-xs font-bold outline-none text-slate-800 focus:bg-white focus:border-blue-300 transition-colors truncate overflow-hidden text-ellipsis whitespace-nowrap"
                            />
                          </td>
                          <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                            {formatCurrency(line.amount)}
                          </td>
                          <td className="py-3.5 px-3" title={selectedCategoryName}>
                            <select
                               value={line.categoryId}
                               onChange={(e) => {
                                 setImportedLines(prev =>
                                   prev.map((item, i) =>
                                     i === idx
                                       ? { ...item, categoryId: e.target.value }
                                       : item
                                   )
                                 );
                               }}
                               className={`w-full bg-slate-50 border rounded-lg p-1.5 text-[11px] font-bold outline-none transition-all ${
                                 isUsingDefaultCategory
                                   ? 'border-slate-100 text-slate-400 font-medium'
                                   : 'border-blue-200 text-slate-800 font-extrabold bg-blue-50/20'
                               }`}
                            >
                              <option value="" className="text-slate-400 font-medium">
                                {defaultCategory ? `${defaultCategory.name} (Padrão)` : 'Usar Padrão'}
                              </option>
                              {categories
                                .filter(c => c.type === TransactionType.EXPENSE)
                                .map(cat => (
                                  <option key={cat.id} value={cat.id} className="text-slate-800 font-bold">{cat.name}</option>
                                ))}
                            </select>
                          </td>
                          <td className="py-3.5 px-3 text-slate-500 font-medium whitespace-nowrap">
                            {computedPeriod || 'Desconhecido'}
                          </td>
                          <td className="py-3.5 px-3 text-center whitespace-nowrap">
                            <button
                              onClick={() => {
                                setImportedLines(prev => prev.filter((_, i) => i !== idx));
                              }}
                              className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors"
                              title="Remover este lançamento"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Action Buttons & Footer with Floating Shadow */}
              <div className="flex flex-col sm:flex-row items-center gap-4 pt-5 mt-auto border-t border-slate-100 shadow-[0_-8px_24px_rgba(0,0,0,0.04)] -mx-6 md:-mx-8 px-6 md:px-8 pb-1 bg-white z-20">
                <button
                  onClick={() => {
                    setIsImportModalOpen(false);
                    setImportedLines([]);
                    setImportingCard(null);
                  }}
                  disabled={loading}
                  className="px-6 py-3 text-slate-500 bg-slate-50 hover:bg-slate-100 font-bold text-sm rounded-xl transition-all cursor-pointer w-full sm:w-auto text-center"
                >
                  Cancelar
                </button>
                <div className="ml-auto flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
                  {/* Modern Badges for Counter and Total Value */}
                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-center sm:justify-start">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm border transition-all ${
                      importedLines.filter(line => line.selected !== false).length > 0
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100/80'
                        : 'bg-slate-50 text-slate-400 border-slate-100'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${importedLines.filter(line => line.selected !== false).length > 0 ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                      ✓ {importedLines.filter(line => line.selected !== false).length} de {importedLines.length} itens
                    </span>

                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-100/80 shadow-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      {formatCurrency(importedLines.filter(line => line.selected !== false).reduce((sum, line) => sum + (line.amount || 0), 0))}
                    </span>
                  </div>

                  <button
                    onClick={handleSaveImportedInvoice}
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-black py-3 px-8 rounded-xl shadow-lg shadow-blue-100 text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 w-full sm:w-auto"
                  >
                    {loading ? 'Importando...' : 'Confirmar Importação'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Lançamento Rápido de Cartão */}
      <AnimatePresence>
        {isQuickLaunchModalOpen && quickLaunchCard && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
              onClick={() => {
                if (!loading) {
                  setIsQuickLaunchModalOpen(false);
                  setQuickLaunchCard(null);
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
                <Plus className="text-blue-500 animate-pulse" size={24} />
                <div>
                  <h2 className="text-xl font-black text-slate-900">
                    Lançamento Rápido
                  </h2>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mt-0.5">
                    {quickLaunchCard.name}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Descrição*</label>
                  <input
                    type="text"
                    placeholder="Ex: Assinatura Software SaaS"
                    disabled={loading}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 outline-none text-slate-800 font-bold disabled:opacity-50"
                    value={quickLaunchData.description}
                    onChange={(e) => setQuickLaunchData(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Valor da Compra (R$)*</label>
                  <input
                    type="text"
                    placeholder="0,00"
                    disabled={loading}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 outline-none font-bold text-slate-800 text-lg disabled:opacity-50"
                    value={quickLaunchData.amountStr}
                    onChange={(e) => setQuickLaunchData(prev => ({ ...prev, amountStr: formatBRL(e.target.value) }))}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Categoria*</label>
                  <select
                    value={quickLaunchData.categoryId}
                    onChange={(e) => setQuickLaunchData(prev => ({ ...prev, categoryId: e.target.value }))}
                    disabled={loading}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 outline-none text-slate-800 font-bold disabled:opacity-50"
                  >
                    <option value="">Selecione uma categoria...</option>
                    {categories
                      .filter(c => c.type === TransactionType.EXPENSE)
                      .map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Data da Compra*</label>
                  <input
                    type="date"
                    disabled={loading}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 outline-none text-slate-800 font-bold disabled:opacity-50"
                    value={quickLaunchData.dueDate}
                    onChange={(e) => setQuickLaunchData(prev => ({ ...prev, dueDate: e.target.value }))}
                  />
                </div>

                <div className="flex gap-4 mt-8 pt-4 border-t border-slate-100">
                  <button
                    onClick={() => {
                      setIsQuickLaunchModalOpen(false);
                      setQuickLaunchCard(null);
                    }}
                    disabled={loading}
                    className="flex-1 font-bold text-slate-400 text-sm py-3 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveQuickLaunch}
                    disabled={loading}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-black py-3 rounded-xl shadow-lg shadow-blue-100 text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Modal Lançar Extrato */}
        {isLancarExtratoModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
              onClick={() => setIsLancarExtratoModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 relative z-10"
            >
              <button
                onClick={() => setIsLancarExtratoModalOpen(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg cursor-pointer"
              >
                <X size={20} />
              </button>

              <div className="flex items-center gap-3 mb-6 pb-3 border-b border-slate-100">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Plus size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800 leading-tight">Lançar Extrato</h3>
                  <p className="text-xs text-slate-500 font-medium">Lançamento manual no extrato bancário</p>
                </div>
              </div>

              <form onSubmit={handleCreateLancarExtrato} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Conta Bancária
                  </label>
                  <select
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                    value={lancarExtratoAccount}
                    onChange={(e) => setLancarExtratoAccount(e.target.value)}
                    required
                  >
                    <option value="" disabled>Selecione uma conta</option>
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Tipo de Lançamento
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setLancarExtratoType('credit')}
                      className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                        lancarExtratoType === 'credit'
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-800 shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Crédito (entrou)
                    </button>

                    <button
                      type="button"
                      onClick={() => setLancarExtratoType('debit')}
                      className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                        lancarExtratoType === 'debit'
                          ? 'bg-rose-50 border-rose-300 text-rose-800 shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Débito (saiu)
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Valor (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0,00"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                      value={lancarExtratoAmount}
                      onChange={(e) => setLancarExtratoAmount(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Data
                    </label>
                    <input
                      type="date"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                      value={lancarExtratoDate}
                      onChange={(e) => setLancarExtratoDate(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Descrição
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Lançamento referente a..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                    value={lancarExtratoDescription}
                    onChange={(e) => setLancarExtratoDescription(e.target.value)}
                    required
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsLancarExtratoModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submittingLancarExtrato}
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {submittingLancarExtrato ? 'Processando...' : 'Criar Lançamento'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Global Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[100] bg-slate-900 text-white px-6 py-3.5 rounded-2xl shadow-xl flex items-center gap-3 animate-fadeIn border border-slate-800">
          <span className={`w-2.5 h-2.5 rounded-full animate-pulse ${
            toast.type === 'error' ? 'bg-rose-500' :
            toast.type === 'warning' ? 'bg-amber-500' :
            toast.type === 'info' ? 'bg-blue-500' :
            'bg-emerald-500'
          }`} />
          <p className="text-sm font-black tracking-wide">{toast.message}</p>
        </div>
      )}
    </div>
  );
};

export default Financial;
