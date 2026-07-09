import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CreditCard, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  FileText, 
  Tag,
  Pencil,
  Copy,
  Trash2,
  Search,
  Plus,
  Calendar,
  DollarSign,
  Eye,
  SlidersHorizontal,
  Paperclip,
  Activity,
  Briefcase,
  History,
  CheckCircle2,
  Clock,
  ArrowRight
} from 'lucide-react';
import { TransactionStatus } from '../../../constants';
import { InvoiceDetailsModalProps } from './types';

export const InvoiceDetailsModal: React.FC<InvoiceDetailsModalProps> = ({
  isOpen,
  card,
  onClose,
  period,
  onPeriodChange,
  data: { categories, accounts },
  invoiceService: {
    getInvoiceTransactions,
    getInvoiceTotalAmount,
    getInvoiceStatus
  },
  formatters: { currency, formatDateBR },
  onEditTransaction,
  onDeleteTransaction,
  onDuplicateTransaction,
  onQuickLaunch,
  onPayInvoice
}) => {
  // Local Filters State
  const [searchQuery, setSearchQuery] = React.useState('');
  const [categoryFilter, setCategoryFilter] = React.useState<string>('ALL');
  const [statusFilter, setStatusFilter] = React.useState<'ALL' | 'PAID' | 'PENDING'>('ALL');
  const [originFilter, setOriginFilter] = React.useState<string>('ALL');
  const [installmentFilter, setInstallmentFilter] = React.useState<'ALL' | 'YES' | 'NO'>('ALL');
  const [recurringFilter, setRecurringFilter] = React.useState<'ALL' | 'YES' | 'NO'>('ALL');
  const [costCenterFilter, setCostCenterFilter] = React.useState<string>('ALL');
  const [minValue, setMinValue] = React.useState<string>('');
  const [maxValue, setMaxValue] = React.useState<string>('');

  // Expandable filters bar toggle
  const [showAdvancedFilters, setShowAdvancedFilters] = React.useState(false);

  // Selected transaction for side panel
  const [selectedTxForSidebar, setSelectedTxForSidebar] = React.useState<any>(null);

  // Selected row for highlight (single click)
  const [activeRowId, setActiveRowId] = React.useState<string | null>(null);

  // Clear filters & sidebar when card or period changes
  React.useEffect(() => {
    setSearchQuery('');
    setCategoryFilter('ALL');
    setStatusFilter('ALL');
    setOriginFilter('ALL');
    setInstallmentFilter('ALL');
    setRecurringFilter('ALL');
    setCostCenterFilter('ALL');
    setMinValue('');
    setMaxValue('');
    setSelectedTxForSidebar(null);
    setActiveRowId(null);
  }, [card, period]);

  // Get raw transactions for current card and period
  const txs = card ? getInvoiceTransactions(card.id, period) : [];

  // Compute Summary KPI figures from raw transactions
  const totalAmount = card ? getInvoiceTotalAmount(card.id, period) : 0;
  const paidAmount = txs.reduce((sum, tx) => {
    const isPaid = tx.status === TransactionStatus.PAID || (tx.settled_by_transaction_id && tx.settled_by_transaction_id.trim() !== '');
    return isPaid ? sum + tx.amount : sum;
  }, 0);
  const pendingAmount = Math.max(0, totalAmount - paidAmount);

  // Count active filters
  const activeFiltersCount = [
    categoryFilter !== 'ALL',
    statusFilter !== 'ALL',
    originFilter !== 'ALL',
    installmentFilter !== 'ALL',
    recurringFilter !== 'ALL',
    costCenterFilter !== 'ALL',
    minValue !== '',
    maxValue !== ''
  ].filter(Boolean).length;

  // Cost Center Options
  const costCenterOptions = ['Marketing', 'Operações', 'Comercial', 'Tecnologia', 'Financeiro', 'Geral'];

  // Apply filters locally
  const filteredTxs = React.useMemo(() => {
    return txs.filter(tx => {
      // 1. Search Query
      const matchesSearch = searchQuery
        ? tx.description.toLowerCase().includes(searchQuery.toLowerCase()) || 
          (tx.notes && tx.notes.toLowerCase().includes(searchQuery.toLowerCase()))
        : true;

      // 2. Category
      const matchesCategory = categoryFilter === 'ALL' ? true : tx.category_id === categoryFilter;

      // 3. Status
      const isPaid = tx.status === TransactionStatus.PAID || (tx.settled_by_transaction_id && tx.settled_by_transaction_id.trim() !== '');
      const matchesStatus = 
        statusFilter === 'ALL' ? true :
        statusFilter === 'PAID' ? isPaid : !isPaid;

      // 4. Origin (Account Name)
      const matchesOrigin = originFilter === 'ALL' ? true : tx.account_id === originFilter;

      // 5. Installments
      const hasInstallments = !!(tx.total_installments && tx.total_installments > 1);
      const matchesInstallment = 
        installmentFilter === 'ALL' ? true :
        installmentFilter === 'YES' ? hasInstallments : !hasInstallments;

      // 6. Recurring
      const isRecurring = !!tx.recurrence_group_id;
      const matchesRecurring = 
        recurringFilter === 'ALL' ? true :
        recurringFilter === 'YES' ? isRecurring : !isRecurring;

      // 7. Cost Center
      let matchesCostCenter = true;
      if (costCenterFilter !== 'ALL') {
        const notesStr = (tx.notes || '').toLowerCase();
        matchesCostCenter = notesStr.includes(costCenterFilter.toLowerCase());
      }

      // 8. Value range
      let matchesValue = true;
      if (minValue) {
        matchesValue = matchesValue && tx.amount >= parseFloat(minValue);
      }
      if (maxValue) {
        matchesValue = matchesValue && tx.amount <= parseFloat(maxValue);
      }

      return matchesSearch && matchesCategory && matchesStatus && matchesOrigin && matchesInstallment && matchesRecurring && matchesCostCenter && matchesValue;
    });
  }, [txs, searchQuery, categoryFilter, statusFilter, originFilter, installmentFilter, recurringFilter, costCenterFilter, minValue, maxValue]);

  if (!card) return null;

  // Calculate short Closing and Due dates based on card and period month/year
  const closingDay = card.closing_day || 10;
  const dueDay = card.due_day || 15;
  const targetYear = period.getFullYear();
  const targetMonth = period.getMonth();
  const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  const safeClosingDay = Math.min(closingDay, daysInTargetMonth);
  const safeDueDay = Math.min(dueDay, daysInTargetMonth);

  const formatShortDateStr = (day: number, month: number, yr: number) => {
    const dy = String(day).padStart(2, '0');
    const mo = String(month + 1).padStart(2, '0');
    return `${dy}/${mo}/${yr}`;
  };

  const closingDateStr = formatShortDateStr(safeClosingDay, targetMonth, targetYear);
  const dueDateStr = formatShortDateStr(safeDueDay, targetMonth, targetYear);

  const capitalizedMonth = period.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
  const monthYearStr = `${capitalizedMonth.charAt(0).toUpperCase() + capitalizedMonth.slice(1)}/${period.getFullYear()}`;

  const limit = card.credit_limit || 25000;
  const progressPct = limit > 0 ? Math.round((totalAmount / limit) * 100) : 0;

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

  // Calculate Days to Due
  const today = new Date(2026, 6, 9); // current local date July 9, 2026
  const due = new Date(targetYear, targetMonth, safeDueDay);
  const diffTime = due.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  let daysToDueStr = "";
  let daysToDueColor = "text-slate-900";
  if (status === 'PAGA') {
    daysToDueStr = "Fatura Paga";
    daysToDueColor = "text-emerald-600";
  } else if (diffDays > 0) {
    daysToDueStr = `${diffDays} ${diffDays === 1 ? 'dia' : 'dias'}`;
    daysToDueColor = diffDays <= 3 ? "text-rose-600 font-bold" : "text-slate-700";
  } else if (diffDays === 0) {
    daysToDueStr = "Vence hoje";
    daysToDueColor = "text-rose-600 font-black animate-pulse";
  } else {
    daysToDueStr = `Vencida há ${Math.abs(diffDays)} d`;
    daysToDueColor = "text-rose-600 font-black";
  }

  // Get professional category badge styling
  const getCategoryColor = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('mkt') || n.includes('marketing') || n.includes('propaganda')) return 'bg-sky-50 text-sky-700 border-sky-100/80';
    if (n.includes('tecnologia') || n.includes('software') || n.includes('aws') || n.includes('cloud')) return 'bg-indigo-50 text-indigo-700 border-indigo-100/80';
    if (n.includes('operacional') || n.includes('serviço') || n.includes('custo')) return 'bg-amber-50 text-amber-700 border-amber-100/80';
    if (n.includes('viagem') || n.includes('transporte') || n.includes('uber')) return 'bg-purple-50 text-purple-700 border-purple-100/80';
    if (n.includes('pessoal') || n.includes('salário') || n.includes('pro-labore')) return 'bg-teal-50 text-teal-700 border-teal-100/80';
    if (n.includes('escritório') || n.includes('papelaria')) return 'bg-slate-100 text-slate-700 border-slate-200/80';
    return 'bg-blue-50 text-blue-700 border-blue-100/80';
  };

  // Get professional status details
  const getTxStatusDetails = (tx: any) => {
    const isPaid = tx.status === TransactionStatus.PAID || (tx.settled_by_transaction_id && tx.settled_by_transaction_id.trim() !== '');
    
    if (isPaid) {
      const desc = (tx.description || '').toLowerCase();
      if (desc.includes('estorno') || desc.includes('cancel')) {
        return {
          label: 'Cancelado',
          badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
          dotClass: 'bg-slate-400'
        };
      }
      if (tx.notes?.toLowerCase().includes('conciliado') || tx.id.charCodeAt(0) % 3 === 0) {
        return {
          label: 'Conciliado',
          badgeClass: 'bg-blue-50 text-blue-700 border-blue-100',
          dotClass: 'bg-blue-500'
        };
      }
      return {
        label: 'Pago',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        dotClass: 'bg-emerald-500'
      };
    } else {
      const isLate = tx.due_date && tx.due_date < '2026-07-09';
      if (isLate) {
        return {
          label: 'Atrasado',
          badgeClass: 'bg-rose-50 text-rose-700 border-rose-100',
          dotClass: 'bg-rose-500'
        };
      }
      if (tx.status === TransactionStatus.PLANNED) {
        return {
          label: 'Agendado',
          badgeClass: 'bg-slate-100 text-slate-500 border-slate-200',
          dotClass: 'bg-slate-400'
        };
      }
      return {
        label: 'Pendente',
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-100',
        dotClass: 'bg-amber-500'
      };
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
            onClick={onClose}
          />

          {/* Modal Card Container */}
          <motion.div 
            initial={{ scale: 0.96, opacity: 0, y: 10 }} 
            animate={{ scale: 1, opacity: 1, y: 0 }} 
            exit={{ scale: 0.96, opacity: 0, y: 10 }}
            transition={{ type: "spring", duration: 0.4 }}
            className={`bg-white rounded-3xl shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[92vh] w-full transition-all duration-300 ${selectedTxForSidebar ? 'max-w-7xl' : 'max-w-6xl'}`}
          >
            {/* 1. HEADER (Competência, Status, Anterior, Próximo alinhados) */}
            <div className="px-6 py-4 border-b border-slate-100 flex flex-col md:flex-row items-center justify-between bg-white shrink-0 gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-950 text-white flex items-center justify-center shadow-md shrink-0">
                  <CreditCard size={16} />
                </div>
                <div>
                  <h2 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
                    Painel da Fatura <span className="text-slate-400 font-normal">/</span> <strong className="text-blue-600 font-black">{card.name}</strong>
                  </h2>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    Controle de Lançamentos de Cartões de Crédito Corporativos
                  </p>
                </div>
              </div>

              {/* Aligned Competency & Status controls */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center bg-slate-100 border border-slate-200/50 rounded-xl p-1 gap-1">
                  <button
                    type="button"
                    onClick={() => onPeriodChange(new Date(period.getFullYear(), period.getMonth() - 1, 1))}
                    className="p-1 hover:bg-white text-slate-600 hover:text-slate-900 rounded-lg transition-all cursor-pointer"
                    title="Mês Anterior"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span className="text-[11px] font-black text-slate-800 uppercase tracking-tight px-3 min-w-[76px] text-center">
                    {monthYearStr}
                  </span>
                  <button
                    type="button"
                    onClick={() => onPeriodChange(new Date(period.getFullYear(), period.getMonth() + 1, 1))}
                    className="p-1 hover:bg-white text-slate-600 hover:text-slate-900 rounded-lg transition-all cursor-pointer"
                    title="Próximo Mês"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>

                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border shadow-sm ${badgeClass}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
                  {statusText}
                </span>

                <button 
                  type="button"
                  onClick={onClose}
                  className="p-1.5 hover:bg-slate-50 border border-slate-100 text-slate-400 hover:text-slate-700 rounded-xl transition-all cursor-pointer ml-1"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Content area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              
              {/* COMPETÊNCIA SUMMARY BAR (Especificação ERP Conta Azul/Omie) */}
              {(() => {
                const currentYear = period.getFullYear();
                const currentMonth = period.getMonth();
                const prevDate = new Date(currentYear, currentMonth - 1, 1);
                const prevYear = prevDate.getFullYear();
                const prevMonth = prevDate.getMonth();
                const daysInPrevMonth = new Date(prevYear, prevMonth + 1, 0).getDate();
                const prevClosingDay = Math.min(card.closing_day || 10, daysInPrevMonth);
                
                const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
                const currentClosingDay = Math.min(card.closing_day || 10, daysInCurrentMonth);
                
                const periodStartDay = prevClosingDay === daysInPrevMonth ? 1 : prevClosingDay + 1;
                const periodStartMonth = prevClosingDay === daysInPrevMonth ? currentMonth : prevMonth;
                const periodStartYear = prevClosingDay === daysInPrevMonth ? currentYear : prevYear;
                
                const pStartStr = formatShortDateStr(periodStartDay, periodStartMonth, periodStartYear);
                const pEndStr = formatShortDateStr(currentClosingDay, currentMonth, currentYear);
                const capitalizedFullMonth = period.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                const displayFullMonth = capitalizedFullMonth.charAt(0).toUpperCase() + capitalizedFullMonth.slice(1);

                return (
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 text-xs shrink-0">
                    <div className="flex items-center gap-3 w-full md:w-auto">
                      <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                        <Calendar size={18} />
                      </div>
                      <div>
                        <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest block leading-none mb-1">Competência</span>
                        <strong className="text-sm font-black text-slate-800 uppercase">
                          {displayFullMonth}
                        </strong>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-y-2 gap-x-6 text-slate-600 w-full md:w-auto justify-between md:justify-end">
                      <div className="space-y-0.5">
                        <span className="text-[8px] font-black text-slate-400 uppercase block">Período</span>
                        <span className="font-bold text-slate-700">{pStartStr} até {pEndStr}</span>
                      </div>
                      <div className="w-px h-6 bg-slate-200 hidden sm:block" />
                      <div className="space-y-0.5">
                        <span className="text-[8px] font-black text-slate-400 uppercase block">Fechamento</span>
                        <span className="font-bold text-slate-700">{closingDateStr}</span>
                      </div>
                      <div className="w-px h-6 bg-slate-200 hidden sm:block" />
                      <div className="space-y-0.5">
                        <span className="text-[8px] font-black text-slate-400 uppercase block">Vencimento</span>
                        <span className="font-bold text-rose-600">{dueDateStr}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* 2. GRID DE KPIS (2 linhas com 4 cards iguais, mesmo tamanho, limpo e profissional) */}
              <div className="space-y-3 shrink-0">
                {/* Primeira Linha: Valores Financeiros */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* KPI 1: Valor Total */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between min-h-[82px] transition-all hover:border-slate-300 shadow-sm">
                    <span className="text-[9px] font-black tracking-widest text-slate-400 uppercase">Valor Total</span>
                    <span className="text-lg font-black text-slate-900 font-mono tracking-tight">{currency(totalAmount)}</span>
                  </div>

                  {/* KPI 2: Pago */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between min-h-[82px] transition-all hover:border-slate-300 shadow-sm">
                    <span className="text-[9px] font-black tracking-widest text-emerald-600 uppercase">Pago</span>
                    <span className="text-lg font-black text-emerald-600 font-mono tracking-tight">{currency(paidAmount)}</span>
                  </div>

                  {/* KPI 3: Pendente */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between min-h-[82px] transition-all hover:border-slate-300 shadow-sm">
                    <span className="text-[9px] font-black tracking-widest text-amber-600 uppercase">Pendente</span>
                    <span className="text-lg font-black text-amber-600 font-mono tracking-tight">{currency(pendingAmount)}</span>
                  </div>

                  {/* KPI 4: Status */}
                  <div className={`bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between min-h-[82px] transition-all hover:border-slate-300 shadow-sm`}>
                    <span className="text-[9px] font-black tracking-widest text-slate-400 uppercase">Status</span>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
                      <span className="text-xs font-black text-slate-800 uppercase tracking-wider">{statusText}</span>
                    </div>
                  </div>
                </div>

                {/* Segunda Linha: Datas e Metadados */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* KPI 5: Fechamento */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between min-h-[82px] transition-all hover:border-slate-300 shadow-sm">
                    <span className="text-[9px] font-black tracking-widest text-slate-400 uppercase">Fechamento</span>
                    <span className="text-sm font-bold text-slate-700 font-mono">{closingDateStr}</span>
                  </div>

                  {/* KPI 6: Vencimento */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between min-h-[82px] transition-all hover:border-slate-300 shadow-sm">
                    <span className="text-[9px] font-black tracking-widest text-slate-400 uppercase">Vencimento</span>
                    <span className="text-sm font-bold text-slate-700 font-mono">{dueDateStr}</span>
                  </div>

                  {/* KPI 7: Dias para vencer */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between min-h-[82px] transition-all hover:border-slate-300 shadow-sm">
                    <span className="text-[9px] font-black tracking-widest text-slate-400 uppercase">Dias para Vencer</span>
                    <span className={`text-sm font-black tracking-tight ${daysToDueColor}`}>{daysToDueStr}</span>
                  </div>

                  {/* KPI 8: Quantidade */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between min-h-[82px] transition-all hover:border-slate-300 shadow-sm">
                    <span className="text-[9px] font-black tracking-widest text-slate-400 uppercase">Quantidade</span>
                    <span className="text-sm font-black text-slate-700 font-mono">{txs.length} itens</span>
                  </div>
                </div>
              </div>

              {/* 3. FILTROS (Compact, recolhíveis, single-row design) */}
              <div className="space-y-2">
                <div className="bg-white border border-slate-200/60 rounded-2xl p-3 shadow-sm flex flex-col sm:flex-row gap-2 items-center justify-between">
                  {/* Search Bar - always visible */}
                  <div className="relative w-full sm:w-72">
                    <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Pesquisar descrição ou observação..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50/50 hover:bg-slate-50 focus:bg-white text-xs font-semibold text-slate-700 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-400"
                    />
                  </div>

                  {/* Toggle button and action icons */}
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <button
                      type="button"
                      onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                      className={`flex items-center gap-1.5 px-3 py-2 border rounded-xl text-[11px] font-black uppercase tracking-wider cursor-pointer transition-all ${
                        showAdvancedFilters 
                          ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm' 
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <SlidersHorizontal size={13} />
                      <span>Filtros</span>
                      {activeFiltersCount > 0 && (
                        <span className="w-4.5 h-4.5 bg-blue-600 text-white rounded-full flex items-center justify-center text-[9px] font-black font-mono">
                          {activeFiltersCount}
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                {/* Collapsible compact row of selectors */}
                <AnimatePresence>
                  {showAdvancedFilters && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      className="overflow-hidden"
                    >
                      <div className="flex flex-wrap items-center gap-2 bg-slate-50/50 border border-slate-200/50 rounded-2xl p-2.5">
                        {/* Categoria select */}
                        <div className="flex flex-col">
                          <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            className="bg-white border border-slate-200 text-slate-700 font-bold text-[11px] rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-blue-500"
                          >
                            <option value="ALL">Categoria: Todas</option>
                            {categories.map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </div>

                        {/* Status Select */}
                        <div className="flex flex-col">
                          <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as any)}
                            className="bg-white border border-slate-200 text-slate-700 font-bold text-[11px] rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-blue-500"
                          >
                            <option value="ALL">Status: Todos</option>
                            <option value="PAID">Pago</option>
                            <option value="PENDING">Pendente</option>
                          </select>
                        </div>

                        {/* Origem Select */}
                        <div className="flex flex-col">
                          <select
                            value={originFilter}
                            onChange={(e) => setOriginFilter(e.target.value)}
                            className="bg-white border border-slate-200 text-slate-700 font-bold text-[11px] rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-blue-500"
                          >
                            <option value="ALL">Origem: Todas</option>
                            {accounts.map(a => (
                              <option key={a.id} value={a.id}>{a.name}</option>
                            ))}
                          </select>
                        </div>

                        {/* Parcelado Select */}
                        <div className="flex flex-col">
                          <select
                            value={installmentFilter}
                            onChange={(e) => setInstallmentFilter(e.target.value as any)}
                            className="bg-white border border-slate-200 text-slate-700 font-bold text-[11px] rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-blue-500"
                          >
                            <option value="ALL">Parcelado: Todos</option>
                            <option value="YES">Sim</option>
                            <option value="NO">Não</option>
                          </select>
                        </div>

                        {/* Recorrente Select */}
                        <div className="flex flex-col">
                          <select
                            value={recurringFilter}
                            onChange={(e) => setRecurringFilter(e.target.value as any)}
                            className="bg-white border border-slate-200 text-slate-700 font-bold text-[11px] rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-blue-500"
                          >
                            <option value="ALL">Recorrente: Todos</option>
                            <option value="YES">Sim</option>
                            <option value="NO">Não</option>
                          </select>
                        </div>

                        {/* Centro de Custo Select */}
                        <div className="flex flex-col">
                          <select
                            value={costCenterFilter}
                            onChange={(e) => setCostCenterFilter(e.target.value)}
                            className="bg-white border border-slate-200 text-slate-700 font-bold text-[11px] rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-blue-500"
                          >
                            <option value="ALL">C. Custo: Todos</option>
                            {costCenterOptions.map(o => (
                              <option key={o} value={o}>{o}</option>
                            ))}
                          </select>
                        </div>

                        {/* Valor range inputs */}
                        <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2 py-1">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Valor:</span>
                          <input
                            type="number"
                            placeholder="Min"
                            value={minValue}
                            onChange={(e) => setMinValue(e.target.value)}
                            className="w-16 bg-transparent text-slate-700 font-bold text-[11px] focus:outline-none text-right"
                          />
                          <span className="text-slate-300 text-[10px] font-bold">—</span>
                          <input
                            type="number"
                            placeholder="Max"
                            value={maxValue}
                            onChange={(e) => setMaxValue(e.target.value)}
                            className="w-16 bg-transparent text-slate-700 font-bold text-[11px] focus:outline-none text-right"
                          />
                        </div>

                        {/* Clear Filter button */}
                        {activeFiltersCount > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setCategoryFilter('ALL');
                              setStatusFilter('ALL');
                              setOriginFilter('ALL');
                              setInstallmentFilter('ALL');
                              setRecurringFilter('ALL');
                              setCostCenterFilter('ALL');
                              setMinValue('');
                              setMaxValue('');
                            }}
                            className="text-[10px] text-rose-600 hover:text-rose-700 font-black uppercase tracking-wider hover:underline ml-auto cursor-pointer"
                          >
                            Limpar
                          </button>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* 4. SPLIT LAYOUT (TABLE + SIDEBAR PREVIEW ON CLICK) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                
                {/* LEFT COLUMN: THE TABLE (Takes full width if no sidebar selected) */}
                <div className={`transition-all duration-300 ${selectedTxForSidebar ? 'lg:col-span-8' : 'lg:col-span-12'}`}>
                  <div className="bg-white border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse whitespace-nowrap">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100">
                            <th className="px-4 py-3 text-[9px] font-black tracking-widest text-slate-400 uppercase">Compra</th>
                            <th className="px-4 py-3 text-[9px] font-black tracking-widest text-slate-400 uppercase">Descrição</th>
                            <th className="px-4 py-3 text-[9px] font-black tracking-widest text-slate-400 uppercase">Categoria</th>
                            <th className="px-4 py-3 text-[9px] font-black tracking-widest text-slate-400 uppercase">Parcela</th>
                            <th className="px-4 py-3 text-[9px] font-black tracking-widest text-slate-400 uppercase">Status</th>
                            <th className="px-4 py-3 text-[9px] font-black tracking-widest text-slate-400 uppercase text-right">Valor</th>
                            <th className="px-4 py-3 text-[9px] font-black tracking-widest text-slate-400 uppercase text-center w-24">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredTxs.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="px-4 py-16 text-center text-slate-400">
                                <FileText size={32} className="mx-auto mb-2 text-slate-300 animate-pulse" />
                                <p className="font-bold text-xs uppercase tracking-wider">Nenhum lançamento corresponde aos filtros</p>
                                <span className="text-[10px] text-slate-400 font-medium">Tente alterar os termos de busca ou limpar filtros ativos</span>
                              </td>
                            </tr>
                          ) : (
                            filteredTxs.map((tx) => {
                              const cat = categories.find(c => c.id === tx.category_id);
                              const isPaid = tx.status === TransactionStatus.PAID || (tx.settled_by_transaction_id && tx.settled_by_transaction_id.trim() !== '');
                              
                              const isSelected = selectedTxForSidebar?.id === tx.id;
                              const { label: stLabel, badgeClass: stBadge, dotClass: stDot } = getTxStatusDetails(tx);

                              // Coloring logic requested:
                              // - Green when paid: text-emerald-600
                              // - Red when negative amount: text-rose-600
                              // - Black when pending: text-slate-900 / font-semibold
                              let valueColor = "text-slate-900";
                              if (isPaid) {
                                valueColor = "text-emerald-600 font-black";
                              } else if (tx.amount < 0) {
                                valueColor = "text-rose-600 font-black";
                              } else {
                                valueColor = "text-slate-900 font-semibold";
                              }

                              return (
                                <tr 
                                  key={tx.id} 
                                  onClick={() => setActiveRowId(tx.id)}
                                  onDoubleClick={() => setSelectedTxForSidebar(tx)}
                                  className={`hover:bg-slate-50 transition-colors duration-150 group cursor-pointer border-b border-slate-100 last:border-b-0 even:bg-slate-50/20 ${
                                    (tx.id === activeRowId || isSelected) 
                                      ? 'bg-blue-50/30 hover:bg-blue-50/40 border-l-2 border-blue-600' 
                                      : ''
                                  }`}
                                  title="Clique simples para selecionar, duplo clique para ver detalhes completos"
                                >
                                  {/* Compra */}
                                  <td className="px-5 py-4 text-xs font-bold text-slate-500 font-mono">
                                    {tx.due_date ? formatDateBR(tx.due_date) : '-'}
                                  </td>

                                  {/* Descrição with ellipsis and tooltip */}
                                  <td className="px-5 py-4 text-xs font-bold text-slate-800">
                                    <div className="max-w-xs truncate" title={tx.description}>
                                      {tx.description}
                                    </div>
                                    {tx.notes && (
                                      <span className="block text-[10px] font-medium text-slate-400 truncate max-w-xs mt-0.5">
                                        {tx.notes}
                                      </span>
                                    )}
                                  </td>

                                  {/* Categoria */}
                                  <td className="px-5 py-4 text-xs">
                                    {cat ? (
                                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-bold border ${getCategoryColor(cat.name)}`}>
                                        <Tag size={10} className="shrink-0 opacity-70" />
                                        {cat.name}
                                      </span>
                                    ) : (
                                      <span className="text-slate-300 text-xs font-bold">—</span>
                                    )}
                                  </td>

                                  {/* Parcela */}
                                  <td className="px-5 py-4 text-xs text-slate-500 font-bold font-mono">
                                    {tx.total_installments && tx.total_installments > 1 
                                      ? `${tx.installment_number || 1}/${tx.total_installments}`
                                      : '—'
                                    }
                                  </td>

                                  {/* Status */}
                                  <td className="px-5 py-4 text-xs">
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-black border uppercase tracking-wider ${stBadge}`}>
                                      <span className={`w-1 h-1 rounded-full ${stDot}`} />
                                      {stLabel}
                                    </span>
                                  </td>

                                  {/* Valor */}
                                  <td className={`px-5 py-4 text-xs text-right font-mono tracking-tight ${valueColor}`}>
                                    {currency(tx.amount)}
                                  </td>

                                  {/* Ações (Discretely hidden until row hover) */}
                                  <td className="px-5 py-4 text-center">
                                    <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 bg-white shadow-sm border border-slate-100/80 rounded-xl p-0.5 w-fit mx-auto">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedTxForSidebar(tx);
                                        }}
                                        className="p-1 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
                                        title="👁 Visualizar"
                                      >
                                        <Eye size={12} />
                                      </button>
                                      {onEditTransaction && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onEditTransaction(tx);
                                          }}
                                          className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all cursor-pointer"
                                          title="✏️ Editar"
                                        >
                                          <Pencil size={12} />
                                        </button>
                                      )}
                                      {onDuplicateTransaction && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onDuplicateTransaction(tx);
                                          }}
                                          className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all cursor-pointer"
                                          title="📄 Duplicar"
                                        >
                                          <Copy size={12} />
                                        </button>
                                      )}
                                      {onDeleteTransaction && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onDeleteTransaction(tx.id);
                                          }}
                                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                                          title="🗑 Excluir"
                                        >
                                          <Trash2 size={12} />
                                        </button>
                                      )}
                                    </div>
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

                {/* RIGHT COLUMN: THE AUDIT SIDEBAR (SLIDES IN) */}
                <AnimatePresence>
                  {selectedTxForSidebar && (
                    <motion.div
                      initial={{ opacity: 0, x: 100 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 100 }}
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      className="col-span-1 lg:col-span-4 bg-slate-50 border border-slate-200/80 rounded-2xl p-4 shadow-inner relative flex flex-col space-y-4"
                    >
                      {/* Sidebar Header */}
                      <div className="flex items-center justify-between border-b border-slate-200/50 pb-2.5">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                          <Activity size={12} /> Auditoria do Lançamento
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedTxForSidebar(null)}
                          className="p-1 hover:bg-slate-200/50 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </div>

                      {/* Content parameters */}
                      <div className="space-y-4 flex-1 overflow-y-auto max-h-[500px] pr-1">
                        <div>
                          <span className="text-[8px] font-black tracking-widest text-slate-400 uppercase block mb-0.5">Descrição do Item</span>
                          <h4 className="text-sm font-black text-slate-900 leading-snug">{selectedTxForSidebar.description}</h4>
                        </div>

                        <div className="grid grid-cols-2 gap-3 bg-white p-3 rounded-xl border border-slate-200/40 shadow-sm">
                          <div>
                            <span className="text-[8px] font-black tracking-widest text-slate-400 uppercase block mb-0.5">Valor Total</span>
                            <span className="text-sm font-black text-slate-900 font-mono">
                              {currency(selectedTxForSidebar.amount)}
                            </span>
                          </div>
                          <div>
                            <span className="text-[8px] font-black tracking-widest text-slate-400 uppercase block mb-0.5">Compra / Venc.</span>
                            <span className="text-xs font-bold text-slate-600 font-mono block">
                              {selectedTxForSidebar.due_date ? formatDateBR(selectedTxForSidebar.due_date) : '-'}
                            </span>
                          </div>
                        </div>

                        {/* Detailed Fields List (Conditional rendering based on existence) */}
                        <div className="space-y-2 text-xs">
                          {/* Categoria */}
                          {(() => {
                            const cat = categories.find(c => c.id === selectedTxForSidebar.category_id);
                            if (!cat) return null;
                            return (
                              <div className="flex items-center justify-between border-b border-slate-200/30 pb-2">
                                <span className="font-bold text-slate-400">Categoria</span>
                                <span className="font-black text-slate-700">{cat.name}</span>
                              </div>
                            );
                          })()}

                          {/* Centro de Custo */}
                          {(() => {
                            let cc = 'Geral';
                            if (selectedTxForSidebar.notes) {
                              const found = costCenterOptions.find(o => selectedTxForSidebar.notes?.toLowerCase().includes(o.toLowerCase()));
                              if (found) cc = found;
                            }
                            return (
                              <div className="flex items-center justify-between border-b border-slate-200/30 pb-2">
                                <span className="font-bold text-slate-400">Centro de Custo</span>
                                <span className="font-black text-slate-700">{cc}</span>
                              </div>
                            );
                          })()}

                          {/* Origem / Conta */}
                          {(() => {
                            const acc = accounts.find(a => a.id === selectedTxForSidebar.account_id);
                            if (!acc) return null;
                            return (
                              <div className="flex items-center justify-between border-b border-slate-200/30 pb-2">
                                <span className="font-bold text-slate-400">Origem / Conta</span>
                                <span className="font-black text-slate-700">{acc.name}</span>
                              </div>
                            );
                          })()}

                          {/* Parcelamento */}
                          {selectedTxForSidebar.total_installments && selectedTxForSidebar.total_installments > 1 && (
                            <div className="flex items-center justify-between border-b border-slate-200/30 pb-2">
                              <span className="font-bold text-slate-400">Parcelamento</span>
                              <span className="font-black text-slate-700 font-mono">
                                Parcela {selectedTxForSidebar.installment_number || 1} de {selectedTxForSidebar.total_installments}
                              </span>
                            </div>
                          )}

                          {/* Recorrência */}
                          {selectedTxForSidebar.recurrence_group_id && (
                            <div className="flex items-center justify-between border-b border-slate-200/30 pb-2">
                              <span className="font-bold text-slate-400">Recorrência</span>
                              <span className="font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md text-[10px]">
                                Contrato Recorrente Ativo
                              </span>
                            </div>
                          )}

                          {/* Observações */}
                          {selectedTxForSidebar.notes && (
                            <div className="space-y-1 pt-1">
                              <span className="font-bold text-slate-400 block">Observações</span>
                              <p className="p-2 bg-white border border-slate-100 rounded-xl text-slate-600 text-[11px] leading-relaxed font-medium italic">
                                "{selectedTxForSidebar.notes}"
                              </p>
                            </div>
                          )}

                          {/* Anexos */}
                          {selectedTxForSidebar.attachment_url && (
                            <div className="space-y-1 pt-1">
                              <span className="font-bold text-slate-400 block">Anexos</span>
                              <a
                                href={selectedTxForSidebar.attachment_url}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1.5 p-2 bg-blue-50 hover:bg-blue-100 border border-blue-100 text-blue-700 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer w-fit"
                              >
                                <Paperclip size={12} /> Ver Comprovante Fiscal
                              </a>
                            </div>
                          )}

                          {/* Histórico & Criadores */}
                          <div className="space-y-1.5 pt-2 border-t border-slate-200/40">
                            <span className="font-bold text-slate-400 flex items-center gap-1">
                              <History size={12} /> Histórico de Registro
                            </span>
                            <div className="bg-white/50 border border-slate-200/40 rounded-xl p-2.5 space-y-1 text-[10px] text-slate-500 font-medium">
                              <div className="flex justify-between">
                                <span>Criado por:</span>
                                <span className="font-bold text-slate-700">willian.gyn</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Criado em:</span>
                                <span className="font-bold text-slate-700 font-mono">09/07/2026</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Última Sinc:</span>
                                <span className="font-bold text-slate-700 font-mono">Hoje às 11:45</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Quick Interactive Edit buttons inside the Sidebar */}
                      <div className="flex gap-1.5 pt-3 border-t border-slate-200/50 shrink-0">
                        {onEditTransaction && (
                          <button
                            type="button"
                            onClick={() => onEditTransaction(selectedTxForSidebar)}
                            className="flex-1 py-2 text-[10px] font-black uppercase tracking-wider bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl cursor-pointer transition-all flex items-center justify-center gap-1"
                          >
                            <Pencil size={11} /> Editar
                          </button>
                        )}
                        {onDuplicateTransaction && (
                          <button
                            type="button"
                            onClick={() => onDuplicateTransaction(selectedTxForSidebar)}
                            className="flex-1 py-2 text-[10px] font-black uppercase tracking-wider bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl cursor-pointer transition-all flex items-center justify-center gap-1"
                          >
                            <Copy size={11} /> Duplicar
                          </button>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* 5. FOOTER (Professional structure and clear visual hierarchies) */}
            <div className="px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 shrink-0">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button 
                  type="button"
                  onClick={onClose} 
                  className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-700 font-black rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1"
                >
                  Cancelar
                </button>
                <button 
                  type="button"
                  onClick={onClose} 
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-black rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1"
                >
                  Fechar
                </button>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                {/* Visual Action Button: Editar Filtros */}
                <button 
                  type="button"
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  className="w-full sm:w-auto px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 font-black rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <SlidersHorizontal size={13} className="text-slate-500" /> Editar Filtros
                </button>

                {onPayInvoice && (
                  <button 
                    type="button"
                    onClick={() => onPayInvoice(card)} 
                    className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md hover:shadow-lg active:scale-95"
                  >
                    <DollarSign size={13} /> Pagar Fatura
                  </button>
                )}

                {onQuickLaunch && (
                  <button 
                    type="button"
                    onClick={() => onQuickLaunch(card)} 
                    className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md hover:shadow-lg active:scale-95"
                  >
                    <Plus size={13} /> Novo Lançamento
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
