
import React, { useState, useMemo } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  Search, 
  Download, 
  ArrowUpRight, 
  ArrowRight,
  DollarSign, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Wallet,
  Calendar,
  X,
  CalendarDays,
  FileText,
  Upload,
  Eye,
  Check,
  TrendingUp,
  Trash2,
  RotateCcw,
  Sparkles,
  Loader2,
  Tag,
  Building2,
  Users,
  AlertCircle,
  Lock,
  Link2,
  PlusCircle
} from 'lucide-react';
import { Sale, User, UserRole, CommissionStatus, FinancialAccount, FinancialCategory, FinancialTransaction } from '../types';
import BrokerStatement from './BrokerStatement';
import { supabaseService } from '../services/supabaseService';
import { supabase } from '../supabase';
import { ConfirmModal } from './ui/ConfirmModal';
import { logAuditEvent } from '../src/utils/auditLogger';

interface CommissionsProps {
  sales: Sale[];
  team: User[];
  currentUser: User;
  onUpdateStatus: (saleId: string, brokerId: string, newStatus: CommissionStatus, receiptData?: string, paymentDate?: string) => void;
  onUpdateForecast?: (saleId: string, brokerId: string, newForecastDate: string) => void;
  onDeleteSplit?: (splitId: string) => Promise<boolean | void> | void;
  onRefresh?: () => void;
  showToast?: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

const Commissions: React.FC<CommissionsProps> = ({ 
  sales, 
  team, 
  currentUser, 
  onUpdateStatus, 
  onUpdateForecast, 
  onDeleteSplit, 
  onRefresh,
  showToast: showToastProp 
}) => {
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [brokerFilter, setBrokerFilter] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [period, setPeriod] = useState<string>('all');
  const [sortDateDir, setSortDateDir] = useState<'desc' | 'asc'>('desc');

  // Estado para Toast Notification
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null);

  const triggerToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'success') => {
    if (showToastProp) {
      showToastProp(message, type);
    } else {
      setToast({ message, type });
      setTimeout(() => setToast(null), 4000);
    }
  };
  
  // Estados para modal de previsão
  const [isForecastModalOpen, setIsForecastModalOpen] = useState(false);
  const [selectedComm, setSelectedComm] = useState<{saleId: string, brokerId: string, property: string, forecastDate?: string} | null>(null);
  const [tempForecastDate, setTempForecastDate] = useState('');

  // Estados para modal de pagamento (quitação total e parcial)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [remainingForecastDate, setRemainingForecastDate] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('Pagamento de Repasse (Padrão)');
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  const [paymentReceipt, setPaymentReceipt] = useState<string | null>(null);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState<boolean>(false);

  // Estados de conciliação financeira no pagamento (Opcional - Decisão do usuário)
  const [isFinancialLaunchPromptOpen, setIsFinancialLaunchPromptOpen] = useState(false);
  const [financialPromptData, setFinancialPromptData] = useState<any | null>(null);
  const [financeAccounts, setFinanceAccounts] = useState<FinancialAccount[]>([]);
  const [financeCategories, setFinanceCategories] = useState<FinancialCategory[]>([]);
  const [reconciliationMode, setReconciliationMode] = useState<'create' | 'link'>('create');
  const [candidateTransactions, setCandidateTransactions] = useState<FinancialTransaction[]>([]);
  const [isLoadingCandidates, setIsLoadingCandidates] = useState<boolean>(false);
  const [selectedCandidateTxId, setSelectedCandidateTxId] = useState<string>('');
  const [newTxAccountId, setNewTxAccountId] = useState<string>('');
  const [newTxCategoryId, setNewTxCategoryId] = useState<string>('');
  const [newTxDescription, setNewTxDescription] = useState<string>('');

  // Estados para visualização de comprovante
  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);

  // Estados para modal de confirmação de exclusão
  const [confirmDeleteSplit, setConfirmDeleteSplit] = useState<any | null>(null);
  const [warningPaidSplitModal, setWarningPaidSplitModal] = useState<boolean>(false);
  const [isDeletingSplit, setIsDeletingSplit] = useState<boolean>(false);

  // Estados para estorno de pagamento (com justificativa obrigatória)
  const [confirmEstornarSplit, setConfirmEstornarSplit] = useState<any | null>(null);
  const [estornoMotivo, setEstornoMotivo] = useState<string>('');
  const [isEstornandoSplit, setIsEstornandoSplit] = useState<boolean>(false);

  // Estados para o fluxo de comissões relacionadas em aberto
  const [isRelatedCommsPromptOpen, setIsRelatedCommsPromptOpen] = useState<boolean>(false);
  const [isBatchForecastModalOpen, setIsBatchForecastModalOpen] = useState<boolean>(false);
  const [relatedCommsData, setRelatedCommsData] = useState<{
    matchedSplit: {
      id: string;
      saleId: string;
      propertyAddress?: string;
      clientName?: string;
      brokerName?: string;
      value?: number;
    };
    relatedSplits: Array<{
      id: string;
      saleId: string;
      brokerName: string;
      value: number;
      forecastDate?: string;
      status: string;
    }>;
  } | null>(null);
  const [selectedRelatedSplitIds, setSelectedRelatedSplitIds] = useState<Set<string>>(new Set());
  const [batchForecastDate, setBatchForecastDate] = useState<string>('');
  const [isSavingBatchForecast, setIsSavingBatchForecast] = useState<boolean>(false);

  const [statementBroker, setStatementBroker] = useState<User | null>(null);
  const [openStatusMenu, setOpenStatusMenu] = useState<string | null>(null);

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleExpand = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const isAdmin = currentUser.role === UserRole.ADMIN;

  const commissionList = useMemo(() => {
    const list: any[] = [];
    const today = new Date().toISOString().split('T')[0];

    sales.forEach(sale => {
      sale.splits.forEach(split => {
        if (isAdmin || split.brokerId === currentUser.id) {
          let effectiveStatus = split.status;

          // Se estiver marcado como atrasado mas a previsão for futura (ou hoje), trata como pendente
          if (effectiveStatus === CommissionStatus.OVERDUE && split.forecastDate && split.forecastDate >= today) {
            effectiveStatus = CommissionStatus.PENDING;
          }
          
          // Se estiver pendente mas a previsão for passada, trata como atrasado (opcional, mas lógico)
          if (effectiveStatus === CommissionStatus.PENDING && split.forecastDate && split.forecastDate < today) {
            effectiveStatus = CommissionStatus.OVERDUE;
          }

          list.push({
            id: split.id,
            saleId: sale.id,
            saleCode: (sale as any).code || sale.id.substring(0, 8).toUpperCase(),
            buyerName: sale.buyerName || (sale as any).buyer_name || null,
            sellerName: sale.sellerName || (sale as any).seller_name || null,
            buyerCpf: (sale as any).buyer_cpf || (sale as any).buyer_document || null,
            brokerId: split.brokerId,
            brokerName: split.brokerName,
            property: sale.propertyAddress,
            value: split.calculatedValue,
            status: effectiveStatus,
            date: sale.saleDate,
            paymentDate: split.paymentDate,
            paymentMethod: split.paymentMethod,
            forecastDate: split.forecastDate,
            receiptData: split.receiptData,
            role: split.role,
            installment_number: split.installment_number,
            total_installments: split.total_installments
          });
        }
      });
    });
    return list.sort((a, b) => {
      const dateA = new Date(a.date || '').getTime();
      const dateB = new Date(b.date || '').getTime();
      return sortDateDir === 'desc' ? dateB - dateA : dateA - dateB;
    });
  }, [sales, currentUser, isAdmin, sortDateDir]);

  const filteredCommissions = useMemo(() => {
    const term = (searchTerm || '').trim().toLowerCase();
    return commissionList.filter(c => {
      const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
      const matchesSearch = !term || 
                           (c.property && c.property.toLowerCase().includes(term)) || 
                           (c.brokerName && c.brokerName.toLowerCase().includes(term)) ||
                           (c.buyerName && c.buyerName.toLowerCase().includes(term)) ||
                           (c.sellerName && c.sellerName.toLowerCase().includes(term)) ||
                           (c.buyerCpf && c.buyerCpf.toLowerCase().includes(term)) ||
                           (c.saleCode && c.saleCode.toLowerCase().includes(term));
      const matchesBroker = brokerFilter === 'ALL' || c.brokerId === brokerFilter;
      
      const matchesDate = (() => {
        if (!startDate && !endDate) return true;
        // Se não tem forecastDate, usa a data da venda como fallback
        const dateStr = c.forecastDate || c.date || '';
        if (!dateStr) return true; // sem data nenhuma, sempre exibe
        const txDate = new Date(dateStr + 'T00:00:00');
        if (isNaN(txDate.getTime())) return true;
        const start = startDate ? new Date(startDate + 'T00:00:00') : null;
        const end = endDate ? new Date(endDate + 'T23:59:59') : null;
        if (start && txDate < start) return false;
        if (end && txDate > end) return false;
        return true;
      })();

      const matchesPeriod = (() => {
        if (period === 'all') return true;
        const dateStr = c.forecastDate || c.date || '';
        if (!dateStr) return true;
        const d = new Date(dateStr + 'T00:00:00');
        if (isNaN(d.getTime())) return true;
        const now = new Date();
        
        if (period === 'month') {
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        }
        if (period === 'prev_month') {
          const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          return d.getMonth() === prev.getMonth() && d.getFullYear() === prev.getFullYear();
        }
        if (period === 'quarter') {
          const currentQ = Math.floor(now.getMonth() / 3);
          return Math.floor(d.getMonth() / 3) === currentQ && d.getFullYear() === now.getFullYear();
        }
        if (period === 'year') {
          return d.getFullYear() === now.getFullYear();
        }
        if (period === 'custom') {
          if (!startDate && !endDate) return true;
          const start = startDate ? new Date(startDate + 'T00:00:00') : null;
          const end = endDate ? new Date(endDate + 'T23:59:59') : null;
          if (start && d < start) return false;
          if (end && d > end) return false;
          return true;
        }
        return true;
      })();

      return matchesStatus && matchesSearch && matchesBroker && matchesDate && matchesPeriod;
    });
  }, [commissionList, statusFilter, searchTerm, brokerFilter, startDate, endDate, period]);

  const kpis = useMemo(() => {
    const total = filteredCommissions.reduce((acc, c) => acc + (c.value || 0), 0);
    const pending = filteredCommissions
      .filter(c => c.status === CommissionStatus.PENDING)
      .reduce((acc, c) => acc + (c.value || 0), 0);
    const overdue = filteredCommissions
      .filter(c => c.status === CommissionStatus.OVERDUE)
      .reduce((acc, c) => acc + (c.value || 0), 0);
    const paid = filteredCommissions
      .filter(c => c.status === CommissionStatus.PAID)
      .reduce((acc, c) => acc + (c.value || 0), 0);

    return { total, pending, overdue, paid };
  }, [filteredCommissions]);

  const brokerCommissionTotal = useMemo(() => {
    if (!statementBroker) return 0;
    return commissionList
      .filter(c => c.brokerId === statementBroker.id && 
        (c.status === CommissionStatus.PENDING || c.status === CommissionStatus.OVERDUE))
      .reduce((sum, c) => sum + c.value, 0);
  }, [commissionList, statementBroker]);

  const groupedCommissions = useMemo(() => {
    const map = new Map<string, {
      key: string;
      saleId: string;
      saleCode?: string;
      buyerName?: string;
      sellerName?: string;
      buyerCpf?: string;
      brokerId?: string;
      brokerName: string;
      property: string;
      date: string;
      role?: string;
      totalValue: number;
      paidValue: number;
      pendingValue: number;
      groupStatus: string;
      installments: any[];
    }>();

    commissionList.forEach(comm => {
      const key = `${comm.saleId}::${comm.brokerId || comm.brokerName}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          saleId: comm.saleId,
          saleCode: comm.saleCode,
          buyerName: comm.buyerName,
          sellerName: comm.sellerName,
          buyerCpf: comm.buyerCpf,
          brokerId: comm.brokerId,
          brokerName: comm.brokerName,
          property: comm.property,
          date: comm.date,
          role: comm.role,
          totalValue: 0,
          paidValue: 0,
          pendingValue: 0,
          groupStatus: '',
          installments: [],
        });
      }
      const g = map.get(key)!;
      g.installments.push(comm);
      g.totalValue += comm.value || 0;
      if (comm.status === CommissionStatus.PAID) g.paidValue += comm.value || 0;
      else g.pendingValue += comm.value || 0;
    });

    map.forEach(g => {
      const allPaid = g.installments.every(c => c.status === CommissionStatus.PAID);
      const nonePaid = g.installments.every(c => c.status !== CommissionStatus.PAID);
      const hasOverdue = g.installments.some(c => c.status === CommissionStatus.OVERDUE);
      if (allPaid) g.groupStatus = CommissionStatus.PAID;
      else if (nonePaid && hasOverdue) g.groupStatus = CommissionStatus.OVERDUE;
      else if (nonePaid) g.groupStatus = CommissionStatus.PENDING;
      else g.groupStatus = 'PARTIAL';
    });

    return Array.from(map.values());
  }, [commissionList]);

  const filteredGroups = useMemo(() => {
    const term = (searchTerm || '').trim().toLowerCase();
    return groupedCommissions.filter(group => {
      const matchesStatus = statusFilter === 'ALL' || group.groupStatus === statusFilter;
      const matchesSearch = !term ||
        (group.property && group.property.toLowerCase().includes(term)) ||
        (group.brokerName && group.brokerName.toLowerCase().includes(term)) ||
        (group.buyerName && group.buyerName.toLowerCase().includes(term)) ||
        (group.sellerName && group.sellerName.toLowerCase().includes(term)) ||
        (group.buyerCpf && group.buyerCpf.toLowerCase().includes(term)) ||
        (group.saleCode && group.saleCode.toLowerCase().includes(term));
      const matchesBroker = brokerFilter === 'ALL' || group.brokerId === brokerFilter;
      const matchesPeriod = (() => {
        if (period === 'all') return true;
        const dateStr = group.date || '';
        if (!dateStr) return true;
        const d = new Date(dateStr + 'T00:00:00');
        if (isNaN(d.getTime())) return true;
        const now = new Date();
        if (period === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        if (period === 'prev_month') {
          const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          return d.getMonth() === prev.getMonth() && d.getFullYear() === prev.getFullYear();
        }
        if (period === 'quarter') {
          const q = Math.floor(now.getMonth() / 3);
          return Math.floor(d.getMonth() / 3) === q && d.getFullYear() === now.getFullYear();
        }
        if (period === 'year') return d.getFullYear() === now.getFullYear();
        if (period === 'custom') {
          const start = startDate ? new Date(startDate + 'T00:00:00') : null;
          const end = endDate ? new Date(endDate + 'T23:59:59') : null;
          if (start && d < start) return false;
          if (end && d > end) return false;
          return true;
        }
        return true;
      })();
      return matchesStatus && matchesSearch && matchesBroker && matchesPeriod;
    });
  }, [groupedCommissions, statusFilter, searchTerm, brokerFilter, period, startDate, endDate]);

  const formatCurrency = (val?: number | null) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val) || 0);
  };

  const renderStatusBadge = (comm: any) => {
    const key = `${comm.saleId}-${comm.brokerId || comm.id}`;
    const isOpen = openStatusMenu === key;
    const isPaid = comm.status === CommissionStatus.PAID;

    const formattedPaymentDate = comm.paymentDate ? new Date(comm.paymentDate + 'T12:00:00').toLocaleDateString('pt-BR') : '';

    const badgeContent = () => {
      switch (comm.status) {
        case CommissionStatus.PAID:
          return (
            <span 
              className="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 border border-emerald-200 select-none shadow-2xs"
              title={formattedPaymentDate ? `Pago em ${formattedPaymentDate} (Trava de segurança: status bloqueado para edição direta)` : 'Pago (Trava de segurança: status bloqueado para edição direta)'}
            >
              <CheckCircle2 size={13} className="text-emerald-600" /> 
              <span>PAGO</span>
              <Lock size={11} className="text-emerald-500/80 ml-0.5" />
            </span>
          );
        case CommissionStatus.PENDING:
          return (
            <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 border border-blue-100">
              <Clock size={14} /> PENDENTE
            </span>
          );
        case CommissionStatus.OVERDUE:
          return (
            <span className="bg-red-50 text-red-600 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 border border-red-100">
              <AlertTriangle size={14} /> ATRASADO
            </span>
          );
        default:
          return null;
      }
    };

    // Trava de segurança: Se for PAID ou se não for Admin, não permite menu de edição direta de status
    if (isPaid || !isAdmin) {
      return (
        <div className="inline-flex items-center">
          {badgeContent()}
        </div>
      );
    }

    // Não pago + admin: badge clicável com dropdown de ações
    return (
      <div className="relative inline-block text-left">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setOpenStatusMenu(isOpen ? null : key);
          }}
          className="cursor-pointer hover:opacity-80 transition-opacity focus:outline-none flex items-center"
          title="Alterar status"
        >
          {badgeContent()}
        </button>

        {isOpen && (
          <>
            {/* Overlay transparente para fechar ao clicar fora */}
            <div
              className="fixed inset-0 z-40"
              onClick={(e) => {
                e.stopPropagation();
                setOpenStatusMenu(null);
              }}
            />
            <div className="absolute left-0 top-full mt-1.5 z-50 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden min-w-[160px] animate-in fade-in zoom-in duration-150">
              {comm.status !== CommissionStatus.PENDING && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateStatus(comm.saleId, comm.brokerId, CommissionStatus.PENDING);
                    setOpenStatusMenu(null);
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer text-left"
                >
                  <Clock size={14} />
                  Marcar Pendente
                </button>
              )}
              {comm.status !== CommissionStatus.OVERDUE && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateStatus(comm.saleId, comm.brokerId, CommissionStatus.OVERDUE);
                    setOpenStatusMenu(null);
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors cursor-pointer text-left"
                >
                  <AlertTriangle size={14} />
                  Marcar Atrasado
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenPaymentModal(comm);
                  setOpenStatusMenu(null);
                }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-emerald-600 hover:bg-emerald-50 transition-colors border-t border-slate-100 cursor-pointer text-left"
              >
                <DollarSign size={14} />
                Registrar Pagamento
              </button>
            </div>
          </>
        )}
      </div>
    );
  };

  const renderGroupStatusBadge = (groupStatus: string, group?: any) => {
    const singlePaidComm = group?.installments?.find((c: any) => c.status === CommissionStatus.PAID);
    const formattedPaymentDate = singlePaidComm?.paymentDate 
      ? new Date(singlePaidComm.paymentDate + 'T12:00:00').toLocaleDateString('pt-BR') 
      : '';

    switch (groupStatus) {
      case CommissionStatus.PAID:
        return (
          <span 
            className="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 border border-emerald-200 shadow-2xs select-none"
            title={formattedPaymentDate ? `Quitado em ${formattedPaymentDate} (Trava: edição direta bloqueada)` : 'Quitado (Trava: edição direta bloqueada)'}
          >
            <CheckCircle2 size={13} className="text-emerald-600" /> 
            <span>PAGO</span>
            <Lock size={11} className="text-emerald-500/80 ml-0.5" />
          </span>
        );
      case 'PARTIAL':
        return (
          <span 
            className="bg-amber-50 text-amber-800 px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 border border-amber-200 shadow-2xs select-none"
            title="Pagamento Parcial (Trava: parcelas pagas estão protegidas contra edição direta)"
          >
            <TrendingUp size={13} className="text-amber-600" /> 
            <span>PARCIAL</span>
            <Lock size={11} className="text-amber-600/80 ml-0.5" />
          </span>
        );
      case CommissionStatus.OVERDUE:
        return <span className="bg-red-50 text-red-600 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 border border-red-100"><AlertTriangle size={14} /> ATRASADO</span>;
      default:
        return <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 border border-blue-100"><Clock size={14} /> PENDENTE</span>;
    }
  };

  const handleOpenForecastModal = (comm: any) => {
    setSelectedComm({
      saleId: comm.saleId,
      brokerId: comm.brokerId,
      property: comm.property,
      forecastDate: comm.forecastDate
    });
    setTempForecastDate(comm.forecastDate || '');
    setIsForecastModalOpen(true);
  };

  const handleSaveForecast = () => {
    if (selectedComm && onUpdateForecast) {
      onUpdateForecast(selectedComm.saleId, selectedComm.brokerId, tempForecastDate);
      setIsForecastModalOpen(false);
      setSelectedComm(null);
    }
  };

  const handleOpenPaymentModal = async (comm: any) => {
    setSelectedPayment(comm);
    const totalVal = comm.value || 0;
    setPaymentAmount(totalVal ? totalVal.toFixed(2) : '');
    const defaultDate = comm.paymentDate || new Date().toISOString().split('T')[0];
    setPaymentDate(defaultDate);
    
    // Sugere a data do saldo restante para 30 dias à frente (ou início do próximo mês)
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    setRemainingForecastDate(futureDate.toISOString().split('T')[0]);
    
    setPaymentMethod(comm.paymentMethod || 'Pagamento de Repasse (Padrão)');
    setPaymentNotes('');
    setPaymentReceipt(null);
    setReconciliationMode('create');
    setSelectedCandidateTxId('');
    setNewTxDescription(`Comissão Corretor - ${comm.brokerName || 'Corretor'} (${comm.property || 'Imóvel'})`);
    setIsSubmittingPayment(false);
    setIsPaymentModalOpen(true);

    // Carregar contas e categorias financeiras para conciliação obrigatória
    try {
      const [accs, cats] = await Promise.all([
        supabaseService.getFinancialAccounts(),
        supabaseService.getFinancialCategories()
      ]);
      setFinanceAccounts(accs || []);
      setFinanceCategories(cats || []);

      if (accs && accs.length > 0) {
        const defaultAcc = accs.find(a => a.is_default) || accs[0];
        setNewTxAccountId(defaultAcc.id);
      }

      if (cats && cats.length > 0) {
        const commCat = cats.find(c => c.name.toLowerCase().includes('comiss') && c.type === 'EXPENSE') 
          || cats.find(c => c.type === 'EXPENSE')
          || cats[0];
        if (commCat) setNewTxCategoryId(commCat.id);
      }

      // Buscar transações financeiras candidatas
      setIsLoadingCandidates(true);
      const candidates = await supabaseService.findCandidateFinancialTransactions({
        targetAmount: totalVal,
        paymentDate: defaultDate,
        agencyId: currentUser?.agencyId
      });
      setCandidateTransactions(candidates || []);
      if (candidates && candidates.length > 0) {
        setSelectedCandidateTxId(candidates[0].id);
      }
    } catch (e) {
      console.warn('Erro ao carregar dados financeiros para conciliação:', e);
    } finally {
      setIsLoadingCandidates(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPaymentReceipt(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleConfirmPayment = async () => {
    if (!selectedPayment) return;

    const numAmount = parseFloat(paymentAmount.toString().replace(',', '.')) || 0;
    const totalVal = selectedPayment.value || 0;

    if (numAmount <= 0) {
      triggerToast("Por favor, informe um valor de pagamento válido maior que zero.", "warning");
      return;
    }

    if (numAmount > totalVal + 0.01) {
      triggerToast(`O valor do pagamento (R$ ${numAmount.toFixed(2)}) não pode ser superior ao saldo a pagar (R$ ${totalVal.toFixed(2)}).`, "warning");
      return;
    }

    if (!paymentDate) {
      triggerToast("Por favor, selecione a data do pagamento.", "warning");
      return;
    }

    const isPartial = numAmount < (totalVal - 0.009);

    if (isPartial && !remainingForecastDate) {
      triggerToast("Para pagamentos parciais, por favor informe a data de previsão do saldo restante.", "warning");
      return;
    }

    const paymentRoleStr = selectedPayment?.role ? String(selectedPayment.role).trim().toUpperCase() : '';
    const validRoles = ['BROKER', 'CAPTURER', 'MANAGER', 'PARTNER', 'AGENCY', 'CORRETOR', 'CAPTADOR', 'GERENTE', 'SÓCIO', 'SOCIO', 'AGÊNCIA', 'AGENCIA'];

    if (!paymentRoleStr || !validRoles.includes(paymentRoleStr)) {
      triggerToast("Este rateio possui role indefinido ou inválido no banco de dados. Corrija o campo 'role' antes de registrar o pagamento.", "error");
      return;
    }

    // Fechar o modal de dados do pagamento e abrir o modal de decisão financeira
    setIsPaymentModalOpen(false);
    setFinancialPromptData({
      payment: selectedPayment,
      numAmount,
      totalVal,
      paymentDate,
      paymentMethod,
      paymentNotes,
      paymentReceipt,
      isPartial,
      remainingForecastDate
    });
    setIsFinancialLaunchPromptOpen(true);
  };

  const handleExecutePaymentWithFinancialChoice = async (launchInFinance: boolean) => {
    if (!financialPromptData) return;

    const {
      payment,
      numAmount,
      totalVal,
      paymentDate: pDate,
      paymentMethod: pMethod,
      paymentNotes: pNotes,
      paymentReceipt: pReceipt,
      isPartial,
      remainingForecastDate: remDate
    } = financialPromptData;

    // Se o usuário optou por lançar no financeiro, validar os campos necessários se selecionou modo criar ou vincular
    if (launchInFinance) {
      if (reconciliationMode === 'link' && !selectedCandidateTxId) {
        triggerToast("Por favor, selecione uma transação existente no extrato ou escolha a opção de Criar Lançamento.", "warning");
        return;
      }
      if (reconciliationMode === 'create') {
        if (!newTxAccountId) {
          triggerToast("Por favor, selecione a conta bancária para o lançamento financeiro.", "warning");
          return;
        }
        if (!newTxCategoryId) {
          triggerToast("Por favor, selecione a categoria financeira da despesa.", "warning");
          return;
        }
      }
    }

    setIsSubmittingPayment(true);
    try {
      if (payment.id) {
        const paymentPayload: any = {
          splitId: payment.id,
          saleId: payment.saleId,
          paidAmount: numAmount,
          fullAmount: totalVal,
          paymentDate: pDate,
          paymentMethod: pMethod,
          notes: pNotes || undefined,
          receiptData: pReceipt || undefined,
          remainingForecastDate: isPartial ? remDate : undefined,
          userEmail: currentUser?.email,
          agencyId: currentUser?.agencyId,
          skipFinancialLaunch: !launchInFinance
        };

        if (launchInFinance) {
          if (reconciliationMode === 'link' && selectedCandidateTxId) {
            paymentPayload.transactionId = selectedCandidateTxId;
          } else {
            paymentPayload.newTransactionData = {
              accountId: newTxAccountId,
              categoryId: newTxCategoryId,
              description: newTxDescription || `Repasse ${payment.role || 'Comissão'} - ${payment.brokerName || ''}`
            };
          }
        }

        const result = await supabaseService.payCommissionSplit(paymentPayload);

        if (result.success) {
          const currentPaidSplit = payment;
          setIsFinancialLaunchPromptOpen(false);
          setFinancialPromptData(null);
          setSelectedPayment(null);
          setPaymentReceipt(null);

          const remainingVal = Math.max(0, totalVal - numAmount);
          if (result.isPartial) {
            triggerToast(
              `Pagamento parcial de ${formatCurrency(numAmount)} ${launchInFinance ? 'conciliado e lançado no Financeiro' : 'conciliado com sucesso'}! Saldo de ${formatCurrency(remainingVal)} agendado.`,
              "success"
            );
          } else {
            triggerToast(
              `Pagamento total de ${formatCurrency(numAmount)} ${launchInFinance ? 'conciliado e lançado no Financeiro' : 'conciliado com sucesso'}!`,
              "success"
            );
          }

          if (onRefresh) {
            onRefresh();
          } else if (onUpdateStatus) {
            onUpdateStatus(currentPaidSplit.saleId, currentPaidSplit.brokerId, CommissionStatus.PAID, pReceipt || undefined, pDate);
          }

          // Verificar se existem outras comissões em aberto relacionadas ao mesmo negócio/imóvel/contrato
          const targetSale = sales.find(s => s.id === currentPaidSplit.saleId);
          const otherOpenSplits = targetSale?.splits.filter(sp => 
            sp.id !== currentPaidSplit.id && 
            sp.status !== CommissionStatus.PAID
          ) || [];

          if (otherOpenSplits.length > 0) {
            setRelatedCommsData({
              matchedSplit: {
                id: currentPaidSplit.id,
                saleId: currentPaidSplit.saleId,
                propertyAddress: currentPaidSplit.propertyAddress || targetSale?.propertyAddress,
                clientName: currentPaidSplit.clientName || targetSale?.buyerName,
                brokerName: currentPaidSplit.brokerName,
                value: currentPaidSplit.value
              },
              relatedSplits: otherOpenSplits.map(sp => ({
                id: sp.id,
                saleId: currentPaidSplit.saleId,
                brokerName: team.find(b => b.id === sp.brokerId)?.name || sp.brokerName || 'Corretor',
                value: sp.value,
                forecastDate: sp.forecastDate,
                status: sp.status
              }))
            });
            setIsRelatedCommsPromptOpen(true);
          }
        } else {
          triggerToast(result.message || "Erro ao registrar o pagamento.", "error");
        }
      } else {
        // Fallback caso não tenha split.id no momento
        onUpdateStatus(payment.saleId, payment.brokerId, CommissionStatus.PAID, pReceipt || undefined, pDate);
        setIsFinancialLaunchPromptOpen(false);
        setFinancialPromptData(null);
        setSelectedPayment(null);
        setPaymentReceipt(null);
        triggerToast("Pagamento registrado com sucesso!", "success");
      }
    } catch (err: any) {
      console.error("Erro ao registrar pagamento:", err);
      triggerToast(err?.message || "Erro ao processar pagamento.", "error");
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const handleRelatedPromptNo = () => {
    setIsRelatedCommsPromptOpen(false);
    setRelatedCommsData(null);
  };

  const handleRelatedPromptYes = () => {
    if (!relatedCommsData) return;
    setIsRelatedCommsPromptOpen(false);
    // Por padrão, todas as comissões relacionadas que estiverem em aberto devem aparecer selecionadas
    setSelectedRelatedSplitIds(new Set(relatedCommsData.relatedSplits.map(s => s.id)));
    setBatchForecastDate('');
    setIsBatchForecastModalOpen(true);
  };

  const handleToggleRelatedSplit = (splitId: string) => {
    setSelectedRelatedSplitIds(prev => {
      const next = new Set(prev);
      if (next.has(splitId)) {
        next.delete(splitId);
      } else {
        next.add(splitId);
      }
      return next;
    });
  };

  const handleToggleAllRelatedSplits = () => {
    if (!relatedCommsData) return;
    if (selectedRelatedSplitIds.size === relatedCommsData.relatedSplits.length) {
      setSelectedRelatedSplitIds(new Set());
    } else {
      setSelectedRelatedSplitIds(new Set(relatedCommsData.relatedSplits.map(s => s.id)));
    }
  };

  const handleCancelBatchForecast = () => {
    setIsBatchForecastModalOpen(false);
    setRelatedCommsData(null);
    setSelectedRelatedSplitIds(new Set());
    setBatchForecastDate('');
  };

  const handleConfirmBatchForecast = async () => {
    if (!relatedCommsData) return;

    if (selectedRelatedSplitIds.size === 0) {
      triggerToast('Selecione pelo menos uma comissão para alterar a previsão.', 'warning');
      return;
    }

    if (!batchForecastDate) {
      triggerToast('Por favor, informe a nova data de previsão de pagamento.', 'warning');
      return;
    }

    setIsSavingBatchForecast(true);
    try {
      const idsToUpdate = Array.from(selectedRelatedSplitIds);
      const { error: updateErr } = await supabase
        .from('broker_splits')
        .update({ forecast_date: batchForecastDate })
        .in('id', idsToUpdate);

      if (updateErr) {
        console.error('Erro ao atualizar previsão de comissões relacionadas:', updateErr);
        triggerToast(`Erro ao atualizar previsões: ${updateErr.message}`, 'error');
        return;
      }

      triggerToast(
        `Previsão de pagamento atualizada para ${idsToUpdate.length} comissão(ões) com sucesso!`,
        'success'
      );
      setIsBatchForecastModalOpen(false);
      setRelatedCommsData(null);
      setSelectedRelatedSplitIds(new Set());
      setBatchForecastDate('');
      if (onRefresh) onRefresh();
    } catch (err: any) {
      console.error('Erro ao atualizar previsões:', err);
      triggerToast('Erro ao atualizar previsões de pagamento.', 'error');
    } finally {
      setIsSavingBatchForecast(false);
    }
  };

  const handleDeleteSplit = (comm: any) => {
    if (comm.status === CommissionStatus.PAID || comm.paymentDate) {
      setWarningPaidSplitModal(true);
      return;
    }

    if (!comm.id) {
      triggerToast("ID do rateio não encontrado.", "error");
      return;
    }

    setConfirmDeleteSplit(comm);
  };

  const executeDeleteSplit = async () => {
    if (!confirmDeleteSplit?.id) return;

    const targetSplit = confirmDeleteSplit;
    setIsDeletingSplit(true);
    try {
      const success = await supabaseService.deleteSplit(targetSplit.id);
      if (success) {
        setConfirmDeleteSplit(null);
        setIsDeletingSplit(false);
        triggerToast("Rateio excluído com sucesso.", "success");

        if (onRefresh) {
          onRefresh();
        } else if (onDeleteSplit) {
          await onDeleteSplit(targetSplit.id);
        }
      } else {
        setConfirmDeleteSplit(null);
        setIsDeletingSplit(false);
        triggerToast("Erro ao excluir o rateio.", "error");
      }
    } catch (err) {
      console.error("Erro ao excluir rateio:", err);
      setConfirmDeleteSplit(null);
      setIsDeletingSplit(false);
      triggerToast("Erro ao excluir o rateio.", "error");
    } finally {
      setIsDeletingSplit(false);
      setConfirmDeleteSplit(null);
    }
  };

  const handleOpenEstornarModal = (comm: any) => {
    setConfirmEstornarSplit(comm);
    setEstornoMotivo('');
  };

  const executeEstornarSplit = async () => {
    if (!confirmEstornarSplit?.id) return;

    if (!estornoMotivo || estornoMotivo.trim().length < 3) {
      triggerToast("O motivo do estorno é obrigatório (mínimo 3 caracteres).", "warning");
      return;
    }

    const commToEstornar = confirmEstornarSplit;
    setIsEstornandoSplit(true);

    try {
      const result = await supabaseService.estornarCommissionSplit({
        splitId: commToEstornar.id,
        reason: estornoMotivo.trim(),
        agencyId: currentUser?.agencyId
      });

      if (result.success) {
        setConfirmEstornarSplit(null);
        setEstornoMotivo('');
        setIsEstornandoSplit(false);

        triggerToast("Pagamento estornado com sucesso e registrado no log de auditoria.", "success");

        if (onRefresh) {
          onRefresh();
        } else if (onUpdateStatus) {
          onUpdateStatus(commToEstornar.saleId, commToEstornar.brokerId, CommissionStatus.PENDING);
        }
      } else {
        setIsEstornandoSplit(false);
        triggerToast(result.message || "Erro ao estornar o pagamento.", "error");
      }
    } catch (err: any) {
      console.error("Erro ao estornar pagamento:", err);
      setIsEstornandoSplit(false);
      triggerToast(err?.message || "Erro ao estornar o pagamento.", "error");
    } finally {
      setIsEstornandoSplit(false);
    }
  };

  const handleExportPDF = () => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const now = new Date();
      const formattedDate = now.toLocaleDateString('pt-BR');
      const formattedTime = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const currentDateTimeStr = `${formattedDate} às ${formattedTime}`;

      const formatCurrencyVal = (val?: number | null) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
      };

      const formatDateLocal = (d?: string) => {
        if (!d) return '-';
        const clean = d.split('T')[0];
        const parts = clean.split('-');
        if (parts.length === 3) {
          return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        return d;
      };

      const getRoleName = (role?: string) => {
        if (!role) return 'Corretor';
        const r = String(role).toLowerCase();
        if (r.includes('agency') || r.includes('agencia') || r.includes('agência')) return 'Agência';
        if (r.includes('partner') || r.includes('socio') || r.includes('sócio')) return 'Sócio';
        if (r.includes('capturer') || r.includes('captador')) return 'Captador';
        if (r.includes('manager') || r.includes('gerente')) return 'Gerente';
        if (r.includes('broker') || r.includes('corretor')) return 'Corretor';
        return role;
      };

      const getStatusText = (st?: string) => {
        if (!st) return 'PENDENTE';
        const s = String(st).toUpperCase();
        if (s === 'PAID') return 'PAGO';
        if (s === 'PENDING') return 'PENDENTE';
        if (s === 'OVERDUE') return 'ATRASADO';
        if (s === 'PARTIAL') return 'PARCIAL';
        return s;
      };

      // Agency name
      const agencyName = currentUser?.agencyId ? "Agência Imobiliária" : "Agência";

      // Period label
      let periodLabel = "Período Total";
      if (period === 'month') periodLabel = "Este Mês";
      else if (period === 'prev_month') periodLabel = "Mês Anterior";
      else if (period === 'quarter') periodLabel = "Este Trimestre";
      else if (period === 'year') periodLabel = "Este Ano";
      else if (period === 'custom') {
        const s = startDate ? formatDateLocal(startDate) : 'Início';
        const e = endDate ? formatDateLocal(endDate) : 'Fim';
        periodLabel = `De ${s} até ${e}`;
      }

      // Filter details text
      let filterDetails = "";
      if (statusFilter !== 'ALL') {
        filterDetails += ` | Status: ${getStatusText(statusFilter)}`;
      }
      if (brokerFilter !== 'ALL') {
        const brokerObj = team.find(u => u.id === brokerFilter);
        if (brokerObj) filterDetails += ` | Corretor: ${brokerObj.name}`;
      }

      const pageWidth = doc.internal.pageSize.getWidth();
      let y = 16;

      // === PÁGINA 1: RESUMO EXECUTIVO ===
      doc.setFillColor(30, 41, 59); // Slate 800
      doc.rect(14, y, pageWidth - 28, 24, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text("RELATÓRIO DE COMISSÕES", 20, y + 10);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`${agencyName} — ${periodLabel}${filterDetails}`, 20, y + 18);

      y += 30;

      doc.setTextColor(100, 116, 139);
      doc.setFontSize(8);
      doc.text(`Gerado em: ${currentDateTimeStr}`, 14, y);

      y += 6;

      // Totais por status
      let paidCount = 0, paidVal = 0;
      let pendingCount = 0, pendingVal = 0;
      let overdueCount = 0, overdueVal = 0;
      let partialCount = 0, partialVal = 0;

      filteredCommissions.forEach(c => {
        const val = c.value || 0;
        if (c.status === CommissionStatus.PAID) {
          paidCount++;
          paidVal += val;
        } else if (c.status === CommissionStatus.OVERDUE) {
          overdueCount++;
          overdueVal += val;
        } else if (c.status === CommissionStatus.PENDING) {
          pendingCount++;
          pendingVal += val;
        }
      });

      groupedCommissions.forEach(g => {
        if (g.groupStatus === 'PARTIAL') {
          partialCount++;
          partialVal += g.totalValue;
        }
      });

      const totalCount = filteredCommissions.length;
      const totalVal = paidVal + pendingVal + overdueVal;

      doc.setTextColor(30, 41, 59);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text("1. Resumo Executivo", 14, y + 4);
      y += 8;

      autoTable(doc, {
        startY: y,
        head: [['Status', 'Qtd Registros', 'Valor Total']],
        body: [
          ['PAGO', paidCount.toString(), formatCurrencyVal(paidVal)],
          ['PENDENTE', pendingCount.toString(), formatCurrencyVal(pendingVal)],
          ['ATRASADO', overdueCount.toString(), formatCurrencyVal(overdueVal)],
          ['PARCIAL (Grupos)', partialCount.toString(), formatCurrencyVal(partialVal)],
          ['TOTAL GERAL', totalCount.toString(), formatCurrencyVal(totalVal)],
        ],
        theme: 'grid',
        headStyles: {
          fillColor: [37, 99, 235],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 9,
        },
        bodyStyles: {
          fontSize: 9,
          textColor: [51, 65, 85],
        },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 50 },
          1: { halign: 'center', cellWidth: 40 },
          2: { halign: 'right', fontStyle: 'bold' },
        },
        margin: { left: 14, right: 14 },
      });

      y = (doc as any).lastAutoTable.finalY + 14;

      // === PÁGINAS 2+: DETALHAMENTO POR VENDA ===
      const salesMap = new Map<string, any[]>();
      filteredCommissions.forEach(comm => {
        if (!salesMap.has(comm.saleId)) {
          salesMap.set(comm.saleId, []);
        }
        salesMap.get(comm.saleId)!.push(comm);
      });

      if (salesMap.size > 0) {
        doc.addPage();
        y = 16;

        doc.setTextColor(30, 41, 59);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text("2. Detalhamento por Venda", 14, y);
        y += 10;

        let saleIndex = 1;
        salesMap.forEach((splitsInSale, saleId) => {
          const saleObj = sales.find(s => s.id === saleId);
          const propertyName = saleObj?.propertyAddress || splitsInSale[0]?.property || "Imóvel Não Identificado";
          const saleDate = formatDateLocal(saleObj?.saleDate || splitsInSale[0]?.date);
          const vgvVal = saleObj?.vgv ? formatCurrencyVal(saleObj.vgv) : 'R$ 0,00';
          const commVal = saleObj?.totalCommissionValue ? formatCurrencyVal(saleObj.totalCommissionValue) : formatCurrencyVal(splitsInSale.reduce((a, b) => a + (b.value || 0), 0));
          const buyerName = saleObj?.buyerName || splitsInSale[0]?.buyerName || '—';

          if (y > 230) {
            doc.addPage();
            y = 16;
          }

          doc.setFillColor(248, 250, 252);
          doc.setDrawColor(226, 232, 240);
          doc.roundedRect(14, y, pageWidth - 28, 18, 2, 2, 'FD');

          doc.setTextColor(15, 23, 42);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
          doc.text(`VENDA #${saleIndex} — ${propertyName}`, 18, y + 6);

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(100, 116, 139);
          doc.text(`Cliente: ${buyerName}   |   Data: ${saleDate}   |   VGV: ${vgvVal}   |   Comissão Total: ${commVal}`, 18, y + 13);

          y += 22;

          const tableBody = splitsInSale.map(split => {
            let pct = '-';
            if (split.percentage !== undefined && split.percentage !== null) {
              pct = `${split.percentage}%`;
            } else if (saleObj?.totalCommissionValue && saleObj.totalCommissionValue > 0) {
              pct = `${((split.value / saleObj.totalCommissionValue) * 100).toFixed(1)}%`;
            }

            return [
              split.brokerName || 'Não Informado',
              getRoleName(split.role),
              pct,
              formatCurrencyVal(split.value),
              getStatusText(split.status),
              split.paymentDate ? formatDateLocal(split.paymentDate) : '-'
            ];
          });

          const saleSubtotal = splitsInSale.reduce((acc, curr) => acc + (curr.value || 0), 0);

          autoTable(doc, {
            startY: y,
            head: [['Corretor / Beneficiário', 'Papel', '%', 'Valor', 'Status', 'Pago em']],
            body: tableBody,
            foot: [[
              { content: 'Subtotal desta Venda', colSpan: 3, styles: { fontStyle: 'bold', halign: 'right' } },
              { content: formatCurrencyVal(saleSubtotal), colSpan: 3, styles: { fontStyle: 'bold', halign: 'left' } }
            ]],
            theme: 'striped',
            headStyles: {
              fillColor: [37, 99, 235],
              textColor: [255, 255, 255],
              fontStyle: 'bold',
              fontSize: 8,
            },
            bodyStyles: {
              fontSize: 8,
              textColor: [51, 65, 85],
            },
            footStyles: {
              fillColor: [241, 245, 249],
              textColor: [30, 41, 59],
              fontSize: 8,
            },
            columnStyles: {
              0: { cellWidth: 55 },
              1: { cellWidth: 25 },
              2: { halign: 'center', cellWidth: 20 },
              3: { halign: 'right', fontStyle: 'bold', cellWidth: 30 },
              4: { halign: 'center', cellWidth: 25 },
              5: { halign: 'center', cellWidth: 25 },
            },
            margin: { left: 14, right: 14 },
          });

          y = (doc as any).lastAutoTable.finalY + 12;
          saleIndex++;
        });
      }

      // === PÁGINA FINAL: RESUMO POR CORRETOR ===
      doc.addPage();
      y = 16;

      doc.setTextColor(30, 41, 59);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text("3. Resumo por Corretor", 14, y);
      y += 10;

      const brokerStatsMap = new Map<string, {
        name: string;
        totalQtd: number;
        pago: number;
        pendente: number;
        atrasado: number;
      }>();

      filteredCommissions.forEach(comm => {
        let displayName = comm.brokerName?.trim() || 'Desconhecido';
        let bKey = comm.brokerId ? comm.brokerId.trim().toLowerCase() : '';

        // Tenta associar com membro do time para garantir nome/ID canônico
        const teamMember = team.find(m => 
          (comm.brokerId && m.id === comm.brokerId) || 
          (m.name && comm.brokerName && m.name.trim().toLowerCase() === comm.brokerName.trim().toLowerCase())
        );

        if (teamMember) {
          bKey = teamMember.id;
          displayName = teamMember.name.trim();
        } else if (!bKey) {
          bKey = displayName.toLowerCase();
        }

        if (!brokerStatsMap.has(bKey)) {
          brokerStatsMap.set(bKey, {
            name: displayName,
            totalQtd: 0,
            pago: 0,
            pendente: 0,
            atrasado: 0,
          });
        }

        const stats = brokerStatsMap.get(bKey)!;
        stats.totalQtd += 1;

        const val = comm.value || 0;
        if (comm.status === CommissionStatus.PAID) {
          stats.pago += val;
        } else if (comm.status === CommissionStatus.OVERDUE) {
          stats.atrasado += val;
        } else {
          stats.pendente += val;
        }
      });

      // Filtrar apenas corretores com Total > 0 (qtd > 0 ou valor > 0)
      const activeBrokers = Array.from(brokerStatsMap.values()).filter(
        b => b.totalQtd > 0 || (b.pago + b.pendente + b.atrasado) > 0
      );

      const brokerRows: any[] = [];
      let totQtd = 0;
      let totPago = 0;
      let totPendente = 0;
      let totAtrasado = 0;
      let totAReceber = 0;

      activeBrokers.forEach((stats) => {
        const aReceber = stats.pago + stats.pendente + stats.atrasado;

        totQtd += stats.totalQtd;
        totPago += stats.pago;
        totPendente += stats.pendente;
        totAtrasado += stats.atrasado;
        totAReceber += aReceber;

        brokerRows.push([
          stats.name,
          stats.totalQtd.toString(),
          formatCurrencyVal(stats.pago),
          formatCurrencyVal(stats.pendente),
          formatCurrencyVal(stats.atrasado),
          formatCurrencyVal(aReceber),
        ]);
      });

      autoTable(doc, {
        startY: y,
        head: [['Corretor', 'Total', 'Pago', 'Pendente', 'Atrasado', 'A Receber']],
        body: brokerRows,
        foot: [[
          'TOTAL',
          totQtd.toString(),
          formatCurrencyVal(totPago),
          formatCurrencyVal(totPendente),
          formatCurrencyVal(totAtrasado),
          formatCurrencyVal(totAReceber),
        ]],
        theme: 'grid',
        headStyles: {
          fillColor: [37, 99, 235],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 8.5,
        },
        bodyStyles: {
          fontSize: 8.5,
          textColor: [51, 65, 85],
        },
        footStyles: {
          fillColor: [30, 41, 59],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 8.5,
        },
        columnStyles: {
          0: { cellWidth: 50 },
          1: { halign: 'center', cellWidth: 15 },
          2: { halign: 'right', cellWidth: 28 },
          3: { halign: 'right', cellWidth: 28 },
          4: { halign: 'right', cellWidth: 28 },
          5: { halign: 'right', fontStyle: 'bold', cellWidth: 33 },
        },
        margin: { left: 14, right: 14 },
      });

      // === RODAPÉ E NUMERAÇÃO DE PÁGINAS ===
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);

        const pageHeight = doc.internal.pageSize.getHeight();
        
        doc.setDrawColor(226, 232, 240);
        doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);

        doc.text(
          `Página ${i} de ${totalPages}   |   ComissOne — Relatório de Comissões   |   Gerado em ${currentDateTimeStr}`,
          pageWidth / 2,
          pageHeight - 6,
          { align: 'center' }
        );
      }

      const todayISO = new Date().toISOString().split('T')[0];
      doc.save(`comissoes_${todayISO}.pdf`);
      triggerToast("Relatório PDF baixado com sucesso!", "success");
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
      triggerToast("Erro ao gerar relatório em PDF.", "error");
    }
  };

  const handleExportCSV = () => {
    const headers = ["Data", "Imóvel", "Corretor", "Valor", "Status", "Previsão"];
    const rows = filteredCommissions.map(c => [
      c.date,
      c.property,
      c.brokerName,
      c.value.toString(),
      c.status,
      c.forecastDate || ""
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n"
      + rows.map(e => e.join(",")).join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `comissoes_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadReceipt = () => {
    if (viewingReceipt) {
      const link = document.createElement("a");
      link.href = viewingReceipt;
      link.download = "comprovante_pagamento";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Comissões</p>
            <p className="text-xl font-black text-slate-800">{formatCurrency(kpis.total)}</p>
          </div>
          <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600 shrink-0">
            <DollarSign size={22} />
          </div>
        </div>

        {/* A Receber */}
        <div
          className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center justify-between cursor-pointer hover:border-blue-200 hover:shadow-md transition-all"
          onClick={() => setStatusFilter(CommissionStatus.PENDING)}
        >
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">A Receber</p>
            <p className="text-xl font-black text-blue-600">{formatCurrency(kpis.pending)}</p>
          </div>
          <div className="p-3 bg-blue-50 rounded-xl text-blue-600 shrink-0">
            <Clock size={22} />
          </div>
        </div>

        {/* Em Atraso */}
        <div
          className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center justify-between cursor-pointer hover:border-red-200 hover:shadow-md transition-all"
          onClick={() => setStatusFilter(CommissionStatus.OVERDUE)}
        >
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Em Atraso</p>
            <p className="text-xl font-black text-red-600">{formatCurrency(kpis.overdue)}</p>
          </div>
          <div className="p-3 bg-red-50 rounded-xl text-red-600 shrink-0">
            <AlertTriangle size={22} />
          </div>
        </div>

        {/* Pagas */}
        <div
          className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center justify-between cursor-pointer hover:border-emerald-200 hover:shadow-md transition-all"
          onClick={() => setStatusFilter(CommissionStatus.PAID)}
        >
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Pagas</p>
            <p className="text-xl font-black text-emerald-600">{formatCurrency(kpis.paid)}</p>
          </div>
          <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600 shrink-0">
            <CheckCircle2 size={22} />
          </div>
        </div>
      </div>

      {/* Barra de filtros */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 space-y-3 shadow-sm">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex flex-wrap gap-3 items-center flex-1">
            {/* Busca */}
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
              <input
                type="text"
                placeholder="Buscar por cliente, imóvel, corretor..."
                className="w-full h-[38px] pl-9 pr-4 text-sm bg-white border border-gray-200 rounded-lg outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 transition-colors"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Status */}
            <select
              className="h-[38px] px-3 text-sm bg-white border border-gray-200 rounded-lg outline-none hover:bg-gray-50 transition-colors"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">Todos os Status</option>
              <option value={CommissionStatus.PENDING}>A Receber</option>
              <option value={CommissionStatus.PAID}>Pagos</option>
              <option value={CommissionStatus.OVERDUE}>Atrasados</option>
            </select>

            {/* Período */}
            <select
              className="h-[38px] px-3 text-sm bg-white border border-gray-200 rounded-lg outline-none hover:bg-gray-50 transition-colors"
              value={period}
              onChange={(e) => { setPeriod(e.target.value); setStartDate(''); setEndDate(''); }}
            >
              <option value="all">Período Total</option>
              <option value="month">Este Mês</option>
              <option value="prev_month">Mês Anterior</option>
              <option value="quarter">Este Trimestre</option>
              <option value="year">Este Ano</option>
              <option value="custom">Datas Customizadas</option>
            </select>

            {/* Corretor (admin only) */}
            {isAdmin && (
              <select
                className="h-[38px] px-3 text-sm bg-white border border-gray-200 rounded-lg outline-none hover:bg-gray-50 transition-colors"
                value={brokerFilter}
                onChange={(e) => setBrokerFilter(e.target.value)}
              >
                <option value="ALL">Todos os Corretores</option>
                {team.filter(u => u.role === UserRole.BROKER || u.role === UserRole.ADMIN).map(user => (
                  <option key={user.id} value={user.id}>{user.name}</option>
                ))}
              </select>
            )}

            {/* Botão Ver Extrato */}
            {isAdmin ? (
              brokerFilter !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => {
                    const broker = team.find(u => u.id === brokerFilter);
                    if (broker) setStatementBroker(broker);
                  }}
                  className="h-[38px] px-3 text-sm bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-250 rounded-lg transition-all flex items-center gap-2 font-semibold"
                >
                  <Wallet size={15} />
                  Ver Extrato
                </button>
              )
            ) : (
              <button
                type="button"
                onClick={() => {
                  setStatementBroker(currentUser);
                }}
                className="h-[38px] px-3 text-sm bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-250 rounded-lg transition-all flex items-center gap-2 font-semibold"
              >
                <Wallet size={15} />
                Ver Extrato
              </button>
            )}
          </div>

          {/* Exportar */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-2 h-[38px] px-4 text-sm bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-all shadow-sm cursor-pointer"
              title="Exportar Relatório em PDF"
            >
              <FileText size={16} /> Exportar PDF
            </button>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 h-[38px] px-4 text-sm bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition-all shadow-sm cursor-pointer"
              title="Exportar Planilha CSV"
            >
              <Download size={16} /> Exportar CSV
            </button>
          </div>
        </div>

        {/* Datas customizadas — aparece inline quando selecionado */}
        {period === 'custom' && (
          <div className="flex flex-wrap gap-3 items-center pt-2 border-t border-gray-100 animate-in slide-in-from-top-1 duration-200">
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">De</label>
              <input
                type="date"
                className="h-[38px] px-3 text-sm bg-white border border-gray-200 rounded-lg outline-none focus:border-indigo-400 transition-colors"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Até</label>
              <input
                type="date"
                className="h-[38px] px-3 text-sm bg-white border border-gray-200 rounded-lg outline-none focus:border-indigo-400 transition-colors"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            {(startDate || endDate) && (
              <button
                onClick={() => { setStartDate(''); setEndDate(''); }}
                className="text-xs font-semibold text-red-400 hover:text-red-600 transition-colors"
              >
                Limpar datas
              </button>
            )}
          </div>
        )}
      </div>

      {statementBroker && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4 animate-in slide-in-from-top-2 duration-200 shadow-sm">
          <BrokerStatement
            broker={statementBroker}
            agencyId={currentUser.agencyId}
            commissionTotal={brokerCommissionTotal}
            onClose={() => setStatementBroker(null)}
          />
        </div>
      )}

      {/* Commission Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th 
                  className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-indigo-600 transition-colors group"
                  onClick={() => setSortDateDir(prev => prev === 'desc' ? 'asc' : 'desc')}
                >
                  <div className="flex items-center gap-1.5">
                    Venda / Imóvel
                    <span className="text-gray-400 group-hover:text-indigo-500 transition-colors text-xs">
                      {sortDateDir === 'desc' ? '↓' : '↑'}
                    </span>
                  </div>
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Corretor</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Valor Devido</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Data Pagto / Previsão</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredGroups.map((group) => {
                const isExpanded = expandedGroups.has(group.key);
                const isMulti = group.installments.length > 1;
                return (
                  <React.Fragment key={group.key}>
                    <tr
                      data-split-id={group.installments[0]?.id}
                      className={`hover:bg-gray-50/50 transition-colors ${isMulti ? 'cursor-pointer select-none' : ''}`}
                      onClick={() => isMulti && toggleExpand(group.key)}
                    >
                      <td className="px-5 py-4">{renderGroupStatusBadge(group.groupStatus, group)}</td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-gray-950">{group.property}</span>
                          <span className="text-[11px] text-gray-500 font-medium flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className="text-gray-400 uppercase text-[10px] font-bold">CLIENTE:</span>
                            <span className="text-gray-800 font-bold">
                              {group.buyerName ? group.buyerName : <em className="text-gray-400 font-normal">Cliente: —</em>}
                            </span>
                            <span className="text-gray-300">•</span>
                            <span className="text-gray-500 text-[10px] font-semibold">{new Date(group.date + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                            {group.saleCode && <span className="text-[10px] text-gray-400 font-normal">({`#${group.saleCode}`})</span>}
                            {isMulti && (
                              <span className="ml-1 text-indigo-600 font-bold text-[10px]">
                                {isExpanded ? '▲' : '▼'} {group.installments.length} parcelas
                              </span>
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-indigo-50 flex items-center justify-center text-[10px] text-indigo-600 font-bold">
                            {group.brokerName.charAt(0)}
                          </div>
                          <div className="flex flex-col ml-1">
                            <span className="font-semibold text-gray-900 text-sm leading-none">{group.brokerName}</span>
                            {group.role && <span className="text-[10px] text-gray-400 font-medium mt-0.5">{group.role}</span>}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-gray-950">{formatCurrency(group.totalValue)}</span>
                          {isMulti && group.paidValue > 0 && (
                            <span className="text-[10px] text-emerald-600 font-medium">Pago: {formatCurrency(group.paidValue)}</span>
                          )}
                          {isMulti && group.pendingValue > 0 && (
                            <span className="text-[10px] text-gray-400 font-medium">Saldo: {formatCurrency(group.pendingValue)}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {isMulti ? (
                          <span className="text-xs text-gray-400 italic">Clique para ver parcelas</span>
                        ) : (() => {
                          const comm = group.installments[0];
                          return comm.paymentDate ? (
                            <div className="flex flex-col">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm text-gray-700">{new Date(comm.paymentDate).toLocaleDateString('pt-BR')}</span>
                                {comm.receiptData && (
                                  <button onClick={e => { e.stopPropagation(); setViewingReceipt(comm.receiptData); }} className="text-emerald-600 hover:text-emerald-700" title="Ver Comprovante"><FileText size={14} /></button>
                                )}
                              </div>
                              <span className="text-[10px] text-emerald-600 font-bold uppercase">{comm.paymentMethod}</span>
                            </div>
                          ) : comm.forecastDate ? (
                            <div className="flex flex-col">
                              <span className="text-sm text-indigo-600 font-bold">{new Date(comm.forecastDate).toLocaleDateString('pt-BR')}</span>
                              <span className="text-[10px] text-gray-400 font-bold uppercase flex items-center gap-1 mt-0.5"><Clock size={10} /> Previsão</span>
                            </div>
                          ) : <span className="text-sm text-gray-400">---</span>;
                        })()}
                      </td>
                      <td className="px-5 py-4 text-right">
                        {!isMulti && (() => {
                          const comm = group.installments[0];
                          return (
                            <div className="flex items-center justify-end gap-1">
                              {isAdmin && comm.status !== CommissionStatus.PAID && (
                                <button onClick={e => { e.stopPropagation(); handleOpenForecastModal(comm); }} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Editar Previsão"><Calendar size={15} /></button>
                              )}
                              {isAdmin && comm.status !== CommissionStatus.PAID && (
                                <button onClick={e => { e.stopPropagation(); handleOpenPaymentModal(comm); }} className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all" title="Registrar Pagamento"><DollarSign size={15} /></button>
                              )}
                              {isAdmin && comm.status === CommissionStatus.PAID && (
                                <button onClick={e => { e.stopPropagation(); handleOpenEstornarModal(comm); }} className="p-1.5 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-all" title="Estornar pagamento. Volta status para Pendente e limpa data/método/comprovante. Depois você pode deletar."><RotateCcw size={15} /></button>
                              )}
                              {comm.receiptData && (
                                <button onClick={e => { e.stopPropagation(); setViewingReceipt(comm.receiptData); }} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" title="Ver Comprovante"><Eye size={15} /></button>
                              )}
                              {isAdmin && (
                                <button onClick={e => { e.stopPropagation(); handleDeleteSplit(comm); }} className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all" title="Excluir Rateio"><Trash2 size={15} /></button>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                    </tr>

                    {isMulti && isExpanded && group.installments.map((comm, i) => (
                      <tr key={`${group.key}-${i}`} data-split-id={comm.id} className="bg-indigo-50/30 border-l-4 border-indigo-200 hover:bg-indigo-50/60 transition-colors">
                        <td className="px-5 py-3 pl-10">{renderStatusBadge(comm)}</td>
                        <td className="px-5 py-3 pl-10">
                          <span className="text-xs text-indigo-600 font-bold">
                            Parcela {comm.installment_number ?? i + 1}/{comm.total_installments ?? group.installments.length}
                          </span>
                        </td>
                        <td className="px-5 py-3"></td>
                        <td className="px-5 py-3 text-sm font-semibold text-gray-800">{formatCurrency(comm.value)}</td>
                        <td className="px-5 py-3">
                          {comm.paymentDate ? (
                            <div className="flex flex-col">
                              <span className="text-xs text-gray-700">{new Date(comm.paymentDate).toLocaleDateString('pt-BR')}</span>
                              <span className="text-[10px] text-emerald-600 font-bold uppercase">{comm.paymentMethod}</span>
                            </div>
                          ) : comm.forecastDate ? (
                            <div className="flex flex-col">
                              <span className="text-xs text-indigo-600 font-bold">{new Date(comm.forecastDate).toLocaleDateString('pt-BR')}</span>
                              <span className="text-[10px] text-gray-400 font-bold uppercase flex items-center gap-1"><Clock size={9} /> Previsão</span>
                            </div>
                          ) : <span className="text-xs text-gray-400">---</span>}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {isAdmin && comm.status !== CommissionStatus.PAID && (
                              <button onClick={e => { e.stopPropagation(); handleOpenForecastModal(comm); }} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Editar Previsão"><Calendar size={15} /></button>
                            )}
                            {isAdmin && comm.status !== CommissionStatus.PAID && (
                              <button onClick={e => { e.stopPropagation(); handleOpenPaymentModal(comm); }} className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all" title="Registrar Pagamento"><DollarSign size={15} /></button>
                            )}
                            {isAdmin && comm.status === CommissionStatus.PAID && (
                              <button onClick={e => { e.stopPropagation(); handleOpenEstornarModal(comm); }} className="p-1.5 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-all" title="Estornar pagamento. Volta status para Pendente e limpa data/método/comprovante. Depois você pode deletar."><RotateCcw size={15} /></button>
                            )}
                            {comm.receiptData && (
                              <button onClick={e => { e.stopPropagation(); setViewingReceipt(comm.receiptData); }} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" title="Ver Comprovante"><Eye size={15} /></button>
                            )}
                            {isAdmin && (
                              <button onClick={e => { e.stopPropagation(); handleDeleteSplit(comm); }} className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all" title="Excluir Rateio"><Trash2 size={15} /></button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
          {filteredGroups.length === 0 && (
            <div className="p-16 text-center">
              <div className="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Wallet className="text-gray-300" size={40} />
              </div>
              <h3 className="text-base font-bold text-gray-900 mb-2">Nenhuma comissão aqui</h3>
              <p className="text-sm text-gray-500 max-w-sm mx-auto">Ajuste os filtros ou verifique se as vendas registradas possuem corretores vinculados.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal Editar Previsão */}
      {isForecastModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-xl border border-gray-200 shadow-xl overflow-hidden animate-in zoom-in duration-200">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900">Previsão de Pagto</h3>
                <p className="text-xs text-gray-500">Ajuste a data esperada para o recebimento.</p>
              </div>
              <button 
                onClick={() => setIsForecastModalOpen(false)} 
                className="bg-gray-50 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-indigo-50/50 p-4 rounded-lg border border-indigo-100">
                <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mb-1">Imóvel</p>
                <p className="text-sm font-bold text-gray-800 truncate">{selectedComm?.property}</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1 flex items-center gap-1">
                  <CalendarDays size={12} /> Selecione a Nova Data
                </label>
                <input 
                  type="date" 
                  value={tempForecastDate}
                  className="w-full px-4 h-[38px] bg-white border border-gray-200 rounded-lg outline-none text-sm font-semibold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  onChange={e => setTempForecastDate(e.target.value)}
                />
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-200 flex gap-3">
              <button 
                onClick={() => setIsForecastModalOpen(false)}
                className="flex-1 h-[38px] text-gray-500 font-semibold hover:text-gray-700 transition-colors text-sm"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveForecast}
                className="flex-1 h-[38px] bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition-all text-sm"
              >
                Salvar Previsão
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Concretizar / Registrar Pagamento (Cheio ou Parcial) */}
      {isPaymentModalOpen && (() => {
        const numAmount = parseFloat(paymentAmount.toString().replace(',', '.')) || 0;
        const totalVal = selectedPayment?.value || 0;
        const isPartial = numAmount > 0 && numAmount < (totalVal - 0.009);
        const remainingVal = Math.max(0, totalVal - numAmount);
        const isFiftyPercent = Math.abs(numAmount - (totalVal * 0.5)) < 0.01;
        const isHundredPercent = Math.abs(numAmount - totalVal) < 0.01;

        const setQuickRemainingDate = (days: number) => {
          const d = new Date();
          d.setDate(d.getDate() + days);
          setRemainingForecastDate(d.toISOString().split('T')[0]);
        };

        const setNextMonthRemainingDate = () => {
          const d = new Date();
          d.setMonth(d.getMonth() + 1);
          d.setDate(10);
          setRemainingForecastDate(d.toISOString().split('T')[0]);
        };

        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-lg rounded-2xl border border-gray-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
              {/* Header */}
              <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shadow-xs">
                    <Wallet size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900 leading-tight">Registrar Pagamento de Repasse</h3>
                    <p className="text-xs text-gray-500">Lançamento financeiro e quitação para a equipe</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsPaymentModalOpen(false)} 
                  className="bg-gray-100 hover:bg-gray-200 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
                {/* Beneficiary Card */}
                <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-sm">
                      {(selectedPayment?.brokerName || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-bold text-slate-800 truncate">{selectedPayment?.brokerName}</span>
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-blue-100/70 text-blue-700 border border-blue-200">
                          {selectedPayment?.role || 'CORRETOR'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Total rateio: <span className="font-semibold text-slate-700">{formatCurrency(selectedPayment?.value)}</span>
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Saldo a Pagar</p>
                    <p className="text-lg font-black text-slate-900">{formatCurrency(selectedPayment?.value)}</p>
                  </div>
                </div>

                {/* Quick Shortcuts */}
                <div className="flex items-center justify-between gap-2 pt-0.5">
                  <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                    <Sparkles size={13} className="text-amber-500" /> Atalho rápido:
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button 
                      type="button"
                      onClick={() => setPaymentAmount(totalVal ? totalVal.toFixed(2) : '0')}
                      className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                        isHundredPercent 
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs' 
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                      }`}
                    >
                      Quitar Saldo ({formatCurrency(totalVal)})
                    </button>
                    <button 
                      type="button"
                      onClick={() => setPaymentAmount((totalVal * 0.5).toFixed(2))}
                      className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                        isFiftyPercent 
                          ? 'bg-amber-600 text-white border-amber-600 shadow-xs' 
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                      }`}
                    >
                      50% ({formatCurrency(totalVal * 0.5)})
                    </button>
                  </div>
                </div>

                {/* Form Inputs Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Valor do Pagamento */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-gray-600 uppercase flex items-center gap-1">
                        <DollarSign size={13} className="text-emerald-600" /> Valor do Pagamento (R$) *
                      </label>
                      {isPartial ? (
                        <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 uppercase tracking-tight">
                          Parcial
                        </span>
                      ) : (
                        <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 uppercase tracking-tight">
                          Total
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">R$</span>
                      <input 
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={totalVal}
                        required
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full pl-9 pr-3 h-[38px] bg-white border border-gray-200 rounded-lg outline-none text-sm font-bold text-gray-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                      />
                    </div>
                  </div>

                  {/* Data do Pagamento */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-gray-600 uppercase flex items-center gap-1">
                      <CalendarDays size={13} className="text-blue-600" /> Data do Pagamento *
                    </label>
                    <input 
                      type="date"
                      required
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="w-full px-3 h-[38px] bg-white border border-gray-200 rounded-lg outline-none text-sm font-semibold text-gray-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                    />
                  </div>
                </div>

                {/* Se for Pagamento Parcial, exibe bloco com restante e escolha da data do restante */}
                {isPartial && (
                  <div className="bg-amber-50/90 border border-amber-200/90 rounded-xl p-3.5 space-y-2.5 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                        <TrendingUp size={15} className="text-amber-600" /> Pagamento Parcial Selecionado
                      </div>
                      <div className="text-xs font-black text-amber-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                        Restante: {formatCurrency(remainingVal)}
                      </div>
                    </div>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      Será gerado automaticamente um novo lançamento pendente no valor de <strong>{formatCurrency(remainingVal)}</strong> com a previsão de pagamento abaixo.
                    </p>
                    
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1">
                          <Calendar size={12} className="text-amber-600" /> Data de Pagamento do Restante *
                        </label>
                        <div className="flex items-center gap-1">
                          <button 
                            type="button" 
                            onClick={() => setQuickRemainingDate(15)}
                            className="text-[10px] font-bold text-amber-800 bg-amber-100/80 hover:bg-amber-200 px-1.5 py-0.5 rounded transition-colors cursor-pointer"
                          >
                            +15 dias
                          </button>
                          <button 
                            type="button" 
                            onClick={() => setQuickRemainingDate(30)}
                            className="text-[10px] font-bold text-amber-800 bg-amber-100/80 hover:bg-amber-200 px-1.5 py-0.5 rounded transition-colors cursor-pointer"
                          >
                            +30 dias
                          </button>
                          <button 
                            type="button" 
                            onClick={setNextMonthRemainingDate}
                            className="text-[10px] font-bold text-amber-800 bg-amber-100/80 hover:bg-amber-200 px-1.5 py-0.5 rounded transition-colors cursor-pointer"
                          >
                            Próx. mês
                          </button>
                        </div>
                      </div>
                      <input 
                        type="date"
                        required
                        value={remainingForecastDate}
                        onChange={(e) => setRemainingForecastDate(e.target.value)}
                        className="w-full px-3 h-[38px] bg-white border border-amber-300 rounded-lg outline-none text-sm font-bold text-gray-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all shadow-2xs"
                      />
                    </div>
                  </div>
                )}

                {/* Tipo de Operação */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-gray-600 uppercase flex items-center gap-1">
                    <Tag size={13} className="text-slate-500" /> Tipo de Operação / Método
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-3 h-[38px] bg-white border border-gray-200 rounded-lg outline-none text-sm font-semibold text-gray-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                  >
                    <option value="Pagamento de Repasse (Padrão)">Pagamento de Repasse (Padrão)</option>
                    <option value="PIX">PIX</option>
                    <option value="Transferência Bancária (TED/DOC)">Transferência Bancária (TED/DOC)</option>
                    <option value="Dinheiro">Dinheiro em Espécie</option>
                    <option value="Depósito em Conta">Depósito em Conta</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>

                {/* Comprovante / Anotação PIX */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-gray-600 uppercase flex items-center gap-1">
                    <FileText size={13} className="text-slate-500" /> Comprovante / Anotação PIX (Opcional)
                  </label>
                  <input
                    type="text"
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    placeholder="Ex: Chave PIX Nubank, código de transação ou nota"
                    className="w-full px-3 h-[38px] bg-white border border-gray-200 rounded-lg outline-none text-sm font-medium text-gray-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all placeholder:text-gray-400"
                  />
                </div>

                {/* Anexo de Arquivo de Comprovante */}
                <div className="space-y-1.5">
                  {!paymentReceipt ? (
                    <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50/80 hover:border-emerald-300 transition-all group">
                      <div className="flex items-center gap-2 text-gray-400 group-hover:text-emerald-600 transition-colors">
                        <Upload size={18} />
                        <span className="text-xs font-semibold">Anexar comprovante de pagamento (imagem ou PDF)</span>
                      </div>
                      <input type="file" className="hidden" accept="image/*,.pdf" onChange={handleFileChange} />
                    </label>
                  ) : (
                    <div className="relative bg-emerald-50/50 p-3 rounded-xl border border-emerald-100 flex items-center gap-3">
                      <div className="w-9 h-9 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center shrink-0">
                        <CheckCircle2 size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-gray-900 truncate">Comprovante Anexado</p>
                        <p className="text-[10px] text-emerald-700 font-semibold">Pronto para salvar no registro</p>
                      </div>
                      <button 
                        type="button"
                        onClick={() => setPaymentReceipt(null)} 
                        className="text-gray-400 hover:text-red-500 p-1 transition-colors cursor-pointer"
                        title="Remover anexo"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 bg-gray-50 border-t border-gray-200 flex gap-3 shrink-0">
                <button 
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  disabled={isSubmittingPayment}
                  className="flex-1 h-[40px] bg-white border border-gray-200 hover:bg-gray-100 text-gray-600 font-bold rounded-xl transition-colors text-sm cursor-pointer disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button 
                  type="button"
                  onClick={handleConfirmPayment}
                  disabled={isSubmittingPayment}
                  className="flex-1 h-[40px] bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-all text-sm flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  Continuar <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal de Decisão de Lançamento Financeiro (Independente e Opcional) */}
      {isFinancialLaunchPromptOpen && financialPromptData && (() => {
        const hasExistingTransaction = !!financialPromptData.payment?.settled_by_transaction_id;

        return (
          <div className="fixed inset-0 z-[105] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="relative bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-slate-50/80 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Building2 size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-base leading-tight">Lançamento no Financeiro</h3>
                    <p className="text-xs text-gray-500 font-medium">Decida se deseja registrar este pagamento no Financeiro</p>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => {
                    setIsFinancialLaunchPromptOpen(false);
                    setFinancialPromptData(null);
                  }}
                  disabled={isSubmittingPayment}
                  className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 space-y-4 overflow-y-auto">
                {/* Resumo da Comissão a ser Paga */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-medium">Beneficiário:</span>
                    <span className="font-bold text-slate-800">{financialPromptData.payment?.brokerName} ({financialPromptData.payment?.role || 'Comissão'})</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-medium">Valor a Quitar:</span>
                    <span className="font-bold text-emerald-600 text-sm">{formatCurrency(financialPromptData.numAmount)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-medium">Data do Pagamento:</span>
                    <span className="font-semibold text-slate-700">{new Date(financialPromptData.paymentDate + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>

                {hasExistingTransaction ? (
                  /* Mensagem quando já possui lançamento vinculado */
                  <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-blue-800">
                      <CheckCircle2 size={15} /> Este pagamento já possui um lançamento no Financeiro
                    </div>
                    <p className="text-[11px] text-blue-700 leading-relaxed">
                      A transação financeira vinculada será mantida. Ao confirmar, o status da comissão será atualizado normalmente.
                    </p>
                  </div>
                ) : (
                  /* Pergunta e Configuração de Lançamento */
                  <div className="space-y-3">
                    <div className="p-3.5 bg-amber-50/60 border border-amber-200/80 rounded-xl">
                      <p className="text-xs font-bold text-amber-900 leading-snug">
                        Deseja lançar este pagamento também no Financeiro?
                      </p>
                      <p className="text-[11px] text-amber-800 mt-1 leading-relaxed">
                        A comissão pode ser conciliada independentemente. Você tem total liberdade para escolher se deseja criar/vincular uma transação financeira agora ou apenas conciliar a comissão.
                      </p>
                    </div>

                    {/* Bloco de Configuração Financeira (se optar por lançar) */}
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                          <Building2 size={15} className="text-indigo-600" /> Detalhes do Lançamento
                        </div>
                        <div className="flex items-center bg-white p-0.5 rounded-lg border border-slate-200 text-[11px] font-bold">
                          <button
                            type="button"
                            onClick={() => setReconciliationMode('create')}
                            className={`px-2 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                              reconciliationMode === 'create'
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            <PlusCircle size={12} /> Criar Novo
                          </button>
                          <button
                            type="button"
                            onClick={() => setReconciliationMode('link')}
                            className={`px-2 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                              reconciliationMode === 'link'
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            <Link2 size={12} /> Vincular Existente
                          </button>
                        </div>
                      </div>

                      {reconciliationMode === 'create' ? (
                        <div className="space-y-2.5 animate-in fade-in duration-150">
                          <p className="text-[11px] text-slate-500 leading-tight">
                            Será criada uma despesa no módulo financeiro vinculada a este pagamento.
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                                Conta Bancária *
                              </label>
                              <select
                                value={newTxAccountId}
                                onChange={(e) => setNewTxAccountId(e.target.value)}
                                className="w-full px-2.5 h-[34px] bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 outline-none focus:border-indigo-500"
                              >
                                <option value="">Selecione uma conta...</option>
                                {financeAccounts.map((acc) => (
                                  <option key={acc.id} value={acc.id}>
                                    {acc.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                                Categoria *
                              </label>
                              <select
                                value={newTxCategoryId}
                                onChange={(e) => setNewTxCategoryId(e.target.value)}
                                className="w-full px-2.5 h-[34px] bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 outline-none focus:border-indigo-500"
                              >
                                <option value="">Selecione uma categoria...</option>
                                {financeCategories
                                  .filter((c) => c.type === 'EXPENSE')
                                  .map((cat) => (
                                    <option key={cat.id} value={cat.id}>
                                      {cat.name}
                                    </option>
                                  ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2 animate-in fade-in duration-150">
                          <p className="text-[11px] text-slate-500 leading-tight">
                            Selecione uma transação de despesa do extrato para vincular.
                          </p>
                          {isLoadingCandidates ? (
                            <div className="p-3 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                              <Loader2 size={14} className="animate-spin text-indigo-600" /> Buscando transações...
                            </div>
                          ) : candidateTransactions.length > 0 ? (
                            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                              {candidateTransactions.map((tx) => (
                                <label
                                  key={tx.id}
                                  className={`p-2 rounded-lg border text-xs flex items-center justify-between cursor-pointer transition-all ${
                                    selectedCandidateTxId === tx.id
                                      ? 'bg-indigo-50/80 border-indigo-300 text-indigo-950 font-semibold shadow-2xs'
                                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <input
                                      type="radio"
                                      name="candidate_tx"
                                      checked={selectedCandidateTxId === tx.id}
                                      onChange={() => setSelectedCandidateTxId(tx.id)}
                                      className="text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <div className="truncate">
                                      <p className="truncate font-medium">{tx.description}</p>
                                      <p className="text-[10px] text-slate-400">
                                        Vencimento: {new Date(tx.due_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                                      </p>
                                    </div>
                                  </div>
                                  <span className="font-bold text-red-600 shrink-0 ml-2">
                                    -{formatCurrency(tx.amount)}
                                  </span>
                                </label>
                              ))}
                            </div>
                          ) : (
                            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800">
                              Nenhuma transação similar encontrada no extrato para este valor.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer com botões de decisão */}
              <div className="p-4 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleExecutePaymentWithFinancialChoice(false)}
                  disabled={isSubmittingPayment}
                  className="flex-1 h-[42px] bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold rounded-xl transition-all text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-2xs"
                  title="Conclui o pagamento da comissão sem criar lançamento financeiro"
                >
                  {isSubmittingPayment ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 size={15} className="text-slate-500" /> Somente conciliar
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleExecutePaymentWithFinancialChoice(true)}
                  disabled={isSubmittingPayment}
                  className="flex-1 h-[42px] bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                  title="Conclui o pagamento da comissão e registra o lançamento no módulo Financeiro"
                >
                  {isSubmittingPayment ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <>
                      <Building2 size={15} /> Lançar no Financeiro
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal de Visualização do Comprovante */}
      {viewingReceipt && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="relative bg-white p-2 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
            <button 
              onClick={() => setViewingReceipt(null)}
              className="absolute top-4 right-4 bg-gray-800/80 p-1.5 rounded-lg text-white hover:bg-slate-900 transition-all z-[120]"
            >
              <X size={16} />
            </button>
            
            <div className="bg-white rounded-lg overflow-hidden">
               {viewingReceipt.startsWith('data:image') ? (
                 <div className="p-2">
                   <img src={viewingReceipt} alt="Comprovante" className="w-full h-auto object-contain max-h-[60vh] rounded-lg" />
                 </div>
               ) : (
                  <div className="p-12 text-center space-y-4">
                     <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mx-auto shadow-sm">
                       <FileText size={32} />
                     </div>
                     <div className="space-y-1">
                       <h4 className="text-lg font-bold text-gray-900 tracking-tight">Comprovante PDF</h4>
                       <p className="text-gray-500 text-xs font-medium leading-relaxed px-4">
                         Este é um documento PDF. Em um ambiente real, ele seria aberto no seu navegador.
                       </p>
                     </div>
                     <button 
                       onClick={handleDownloadReceipt}
                       className="w-full h-[38px] bg-indigo-600 hover:bg-indigo-700 text-white px-6 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 text-sm"
                     >
                       <Download size={16} />
                       Download Comprovante
                     </button>
                  </div>
               )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Estorno de Pagamento com Justificativa Obrigatória */}
      {confirmEstornarSplit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-6 space-y-4">
              <div className="flex items-start gap-3.5">
                <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl shrink-0 mt-0.5 border border-amber-100">
                  <RotateCcw size={22} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 leading-snug">
                    Estornar Pagamento de Comissão
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    O rateio voltará ao status <strong>Pendente</strong> e o vínculo de quitação será desfeito. O evento será registrado com auditoria completa.
                  </p>
                </div>
              </div>

              <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs space-y-1">
                <div className="flex justify-between text-slate-700">
                  <span>Corretor:</span>
                  <strong className="text-slate-900">{confirmEstornarSplit.brokerName || 'Corretor'}</strong>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>Valor:</span>
                  <strong className="text-emerald-700">{formatCurrency(confirmEstornarSplit.value || 0)}</strong>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Motivo do Estorno *</span>
                  <span className="text-[10px] text-slate-400 font-normal">Obrigatório</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={estornoMotivo}
                  onChange={(e) => setEstornoMotivo(e.target.value)}
                  placeholder="Explique o motivo do estorno (ex: duplicidade de lançamento, cancelamento de contrato, etc.)"
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl outline-none text-xs font-medium text-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all resize-none placeholder:text-slate-400"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex gap-2.5 justify-end">
              <button
                type="button"
                onClick={() => {
                  setConfirmEstornarSplit(null);
                  setEstornoMotivo('');
                }}
                disabled={isEstornandoSplit}
                className="px-4 h-[38px] bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={executeEstornarSplit}
                disabled={isEstornandoSplit || !estornoMotivo.trim()}
                className="px-5 h-[38px] bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isEstornandoSplit ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Estornando...
                  </>
                ) : (
                  <>
                    <RotateCcw size={14} /> Confirmar Estorno
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão de Rateio */}
      <ConfirmModal
        open={!!confirmDeleteSplit}
        title="Excluir Rateio"
        message={
          <span>
            Tem certeza que deseja excluir o rateio de <strong>{confirmDeleteSplit?.brokerName || 'Corretor'}</strong> no valor de <strong>R$ {(confirmDeleteSplit?.value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>?
          </span>
        }
        variant="danger"
        confirmText="Excluir Rateio"
        cancelText="Cancelar"
        isLoading={isDeletingSplit}
        onConfirm={executeDeleteSplit}
        onCancel={() => setConfirmDeleteSplit(null)}
      />

      {/* Modal de Aviso de Rateio Pago */}
      <ConfirmModal
        open={warningPaidSplitModal}
        title="Ação Não Permitida"
        message="Rateio com pagamento registrado não pode ser excluído. Estorne o pagamento primeiro."
        variant="warning"
        confirmText="Entendido"
        showCancel={false}
        onConfirm={() => setWarningPaidSplitModal(false)}
        onCancel={() => setWarningPaidSplitModal(false)}
      />

      {/* Modal 1: Pergunta sobre outras comissões em aberto relacionadas */}
      {isRelatedCommsPromptOpen && relatedCommsData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-6 space-y-4">
              <div className="flex items-start gap-3.5">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl shrink-0 mt-0.5 border border-indigo-100">
                  <Calendar size={22} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 leading-snug">
                    Comissões Relacionadas em Aberto
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Existem outras comissões em aberto relacionadas a esta comissão. Deseja alterar também a previsão de pagamento delas?
                  </p>
                </div>
              </div>

              {/* Informações do Negócio / Imóvel */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs space-y-1.5">
                {relatedCommsData.matchedSplit.propertyAddress && (
                  <div className="flex items-center gap-1.5 text-slate-700 font-medium truncate">
                    <Building2 size={14} className="text-slate-400 shrink-0" />
                    <span className="truncate">{relatedCommsData.matchedSplit.propertyAddress}</span>
                  </div>
                )}
                {relatedCommsData.matchedSplit.clientName && (
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <Users size={14} className="text-slate-400 shrink-0" />
                    <span>Cliente: <strong className="text-slate-800 font-semibold">{relatedCommsData.matchedSplit.clientName}</strong></span>
                  </div>
                )}
                <div className="text-[11px] text-indigo-600 font-semibold pt-1 border-t border-slate-200/60">
                  {relatedCommsData.relatedSplits.length} outra(s) comissão(ões) em aberto encontrada(s)
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
              <button
                type="button"
                onClick={handleRelatedPromptNo}
                className="px-4 py-2.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-all shadow-2xs cursor-pointer"
              >
                NÃO
              </button>
              <button
                type="button"
                onClick={handleRelatedPromptYes}
                className="px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                SIM, ALTERAR PREVISÕES
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Seleção e alteração em lote da nova previsão das comissões em aberto */}
      {isBatchForecastModalOpen && relatedCommsData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Comissões relacionadas em aberto
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {relatedCommsData.matchedSplit.propertyAddress || relatedCommsData.matchedSplit.clientName || 'Negócio vinculado'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCancelBatchForecast}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700">Selecione as comissões para alterar:</span>
                <button
                  type="button"
                  onClick={handleToggleAllRelatedSplits}
                  className="text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                >
                  {selectedRelatedSplitIds.size === relatedCommsData.relatedSplits.length ? 'Desmarcar todas' : 'Marcar todas'}
                </button>
              </div>

              {/* Lista de comissões */}
              <div className="space-y-2.5">
                {relatedCommsData.relatedSplits.map((split) => {
                  const isChecked = selectedRelatedSplitIds.has(split.id);
                  let formattedDate = 'Não informada';
                  if (split.forecastDate) {
                    const [y, m, d] = split.forecastDate.split('-');
                    if (y && m && d) formattedDate = `${d}/${m}/${y}`;
                  }
                  return (
                    <label
                      key={split.id}
                      className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
                        isChecked
                          ? 'bg-indigo-50/60 border-indigo-300 ring-1 ring-indigo-200'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleRelatedSplit(split.id)}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-800 truncate">
                            {split.brokerName || 'Corretor'}
                          </span>
                          <span className="font-bold text-slate-900 shrink-0">
                            R$ {(split.value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1">
                          <span>
                            Previsão atual: <strong className="font-semibold text-slate-700">{formattedDate}</strong>
                          </span>
                          <span className="text-slate-300">•</span>
                          <span className="uppercase text-[10px] font-semibold text-amber-600">
                            Em aberto
                          </span>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>

              {/* Campo Nova Previsão */}
              <div className="pt-3 border-t border-slate-100 space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  Nova previsão de pagamento:
                </label>
                <input
                  type="date"
                  value={batchForecastDate}
                  onChange={(e) => setBatchForecastDate(e.target.value)}
                  className="w-full h-10 px-3 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all cursor-pointer"
                />
              </div>

              {/* Mensagem de Segurança */}
              <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl text-[11px] text-amber-800 leading-relaxed flex items-start gap-2">
                <AlertCircle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Somente a previsão de pagamento das comissões selecionadas será alterada. Os demais dados permanecerão inalterados.
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-5 py-4 bg-slate-50 border-t border-slate-100">
              <button
                type="button"
                onClick={handleCancelBatchForecast}
                disabled={isSavingBatchForecast}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmBatchForecast}
                disabled={isSavingBatchForecast || selectedRelatedSplitIds.size === 0 || !batchForecastDate}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer"
              >
                {isSavingBatchForecast ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Atualizando...
                  </>
                ) : (
                  'Atualizar previsões'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[100] text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center space-x-3 border border-white/20 backdrop-blur-sm transition-all ${
          toast.type === 'error' ? 'bg-rose-600' :
          toast.type === 'warning' ? 'bg-amber-600' :
          toast.type === 'info' ? 'bg-blue-600' :
          'bg-emerald-600'
        }`}>
          <p className="text-xs font-bold tracking-wide">{toast.message}</p>
        </div>
      )}
    </div>
  );
};

export default Commissions;
