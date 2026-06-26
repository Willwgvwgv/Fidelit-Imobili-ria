
import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Download, 
  ArrowUpRight, 
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
  TrendingUp
} from 'lucide-react';
import { Sale, User, UserRole, CommissionStatus } from '../types';
import BrokerStatement from './BrokerStatement';

interface CommissionsProps {
  sales: Sale[];
  team: User[];
  currentUser: User;
  onUpdateStatus: (saleId: string, brokerId: string, newStatus: CommissionStatus, receiptData?: string) => void;
  onUpdateForecast?: (saleId: string, brokerId: string, newForecastDate: string) => void;
}

const Commissions: React.FC<CommissionsProps> = ({ sales, team, currentUser, onUpdateStatus, onUpdateForecast }) => {
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [brokerFilter, setBrokerFilter] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [period, setPeriod] = useState<string>('all');
  const [sortDateDir, setSortDateDir] = useState<'desc' | 'asc'>('desc');
  
  // Estados para modal de previsão
  const [isForecastModalOpen, setIsForecastModalOpen] = useState(false);
  const [selectedComm, setSelectedComm] = useState<{saleId: string, brokerId: string, property: string, forecastDate?: string} | null>(null);
  const [tempForecastDate, setTempForecastDate] = useState('');

  // Estados para modal de pagamento
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any | null>(null);
  const [paymentReceipt, setPaymentReceipt] = useState<string | null>(null);

  // Estados para visualização de comprovante
  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);

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
            saleId: sale.id,
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

  const filteredCommissions = commissionList.filter(c => {
    const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
    const matchesSearch = c.property.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         c.brokerName.toLowerCase().includes(searchTerm.toLowerCase());
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
    return groupedCommissions.filter(group => {
      const matchesStatus = statusFilter === 'ALL' || group.groupStatus === statusFilter;
      const matchesSearch =
        group.property.toLowerCase().includes(searchTerm.toLowerCase()) ||
        group.brokerName.toLowerCase().includes(searchTerm.toLowerCase());
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

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const renderStatusBadge = (comm: any) => {
    const key = `${comm.saleId}-${comm.brokerId}`;
    const isOpen = openStatusMenu === key;
    const isPaid = comm.status === CommissionStatus.PAID;

    const badgeContent = () => {
      switch (comm.status) {
        case CommissionStatus.PAID:
          return (
            <span className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 border border-emerald-100">
              <CheckCircle2 size={14} /> PAGO
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

    // Comissão PAGA: badge estático sem interação
    if (isPaid || !isAdmin) {
      return badgeContent();
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

  const renderGroupStatusBadge = (groupStatus: string) => {
    switch (groupStatus) {
      case CommissionStatus.PAID:
        return <span className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 border border-emerald-100"><CheckCircle2 size={14} /> PAGO</span>;
      case 'PARTIAL':
        return <span className="bg-amber-50 text-amber-600 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 border border-amber-100"><TrendingUp size={14} /> PARCIAL</span>;
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

  const handleOpenPaymentModal = (comm: any) => {
    setSelectedPayment(comm);
    setPaymentReceipt(null);
    setIsPaymentModalOpen(true);
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

  const handleConfirmPayment = () => {
    if (selectedPayment) {
      onUpdateStatus(selectedPayment.saleId, selectedPayment.brokerId, CommissionStatus.PAID, paymentReceipt || undefined);
      setIsPaymentModalOpen(false);
      setSelectedPayment(null);
      setPaymentReceipt(null);
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
                placeholder="Buscar comissão..."
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
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 h-[38px] px-4 text-sm bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition-all"
          >
            <Download size={16} /> Exportar CSV
          </button>
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
                      className={`hover:bg-gray-50/50 transition-colors ${isMulti ? 'cursor-pointer select-none' : ''}`}
                      onClick={() => isMulti && toggleExpand(group.key)}
                    >
                      <td className="px-5 py-4">{renderGroupStatusBadge(group.groupStatus)}</td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-gray-950">{group.property}</span>
                          <span className="text-[10px] text-gray-400 uppercase tracking-tight font-medium">
                            #{group.saleId.slice(0, 8).toUpperCase()} • {new Date(group.date).toLocaleDateString('pt-BR')}
                            {isMulti && (
                              <span className="ml-2 text-indigo-500 font-bold">
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
                              {comm.receiptData && (
                                <button onClick={e => { e.stopPropagation(); setViewingReceipt(comm.receiptData); }} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" title="Ver Comprovante"><Eye size={15} /></button>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                    </tr>

                    {isMulti && isExpanded && group.installments.map((comm, i) => (
                      <tr key={`${group.key}-${i}`} className="bg-indigo-50/30 border-l-4 border-indigo-200 hover:bg-indigo-50/60 transition-colors">
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
                            {comm.receiptData && (
                              <button onClick={e => { e.stopPropagation(); setViewingReceipt(comm.receiptData); }} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" title="Ver Comprovante"><Eye size={15} /></button>
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

      {/* Modal de Concretizar Pagamento */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-xl border border-gray-200 shadow-xl overflow-hidden animate-in zoom-in duration-200">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900">Concretizar Pagamento</h3>
                <p className="text-xs text-gray-500">Anexe o comprovante para finalizar.</p>
              </div>
              <button 
                onClick={() => setIsPaymentModalOpen(false)} 
                className="bg-gray-50 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-emerald-50/50 p-4 rounded-lg border border-emerald-100">
                 <div className="flex justify-between items-start mb-2">
                    <p className="text-[10px] font-bold text-emerald-650 uppercase tracking-widest">Valor a Pagar</p>
                    <div className="bg-emerald-100 p-1 rounded-full text-emerald-650">
                       <Check size={14} />
                    </div>
                 </div>
                 <p className="text-2xl font-bold text-gray-900">{formatCurrency(selectedPayment?.value)}</p>
                 <p className="text-xs text-slate-500 mt-1 font-medium">Beneficiário: <span className="text-slate-700 font-bold">{selectedPayment?.brokerName}</span></p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1 flex items-center gap-1">
                  <Upload size={12} /> Comprovante de Pagamento
                </label>
                
                {!paymentReceipt ? (
                  <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-all group">
                    <div className="flex flex-col items-center justify-center pt-2">
                      <FileText className="text-gray-300 group-hover:text-emerald-500 transition-colors mb-1.5" size={24} />
                      <p className="text-xs font-semibold text-gray-500">Clique para anexar comprovante</p>
                    </div>
                    <input type="file" className="hidden" accept="image/*,.pdf" onChange={handleFileChange} />
                  </label>
                ) : (
                  <div className="relative bg-gray-50 p-3 rounded-lg border border-gray-200 flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center">
                      <CheckCircle2 size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-950 truncate">Comprovante Anexado</p>
                      <p className="text-[9px] text-gray-400 uppercase font-bold tracking-widest">Pronto para salvar</p>
                    </div>
                    <button onClick={() => setPaymentReceipt(null)} className="text-gray-400 hover:text-red-500 transition-colors">
                      <X size={16} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-200 flex gap-3">
              <button 
                onClick={() => setIsPaymentModalOpen(false)}
                className="flex-1 h-[38px] text-gray-500 font-semibold hover:text-gray-700 transition-colors text-sm"
              >
                Cancelar
              </button>
              <button 
                onClick={handleConfirmPayment}
                className="flex-1 h-[38px] bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition-all text-sm flex items-center justify-center gap-2"
              >
                Confirmar Pagamento
              </button>
            </div>
          </div>
        </div>
      )}

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
    </div>
  );
};

export default Commissions;
