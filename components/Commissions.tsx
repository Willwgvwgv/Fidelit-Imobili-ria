import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
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
  ChevronRight,
  Users,
  Split,
  TrendingUp
} from 'lucide-react';


import { Sale, User, UserRole, CommissionStatus } from '../types';
import { formatCurrency } from '../src/utils/formatters';

const round2 = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;

interface CommissionsProps {

  sales: Sale[];
  currentUser: User;
  onUpdateStatus: (
    saleId: string,
    brokerId: string,
    newStatus: CommissionStatus,
    receiptData?: string,
    paymentAmount?: number,
    remainingAmount?: number,
    installmentNumber?: number,
    remainingForecastDate?: string,
    notes?: string,
    discountValue?: number,
    id?: string
  ) => void;
  onUpdateForecast?: (
    saleId: string,
    brokerId: string,
    newForecastDate: string,
    installmentNumber?: number,
    id?: string
  ) => void;
}


const Commissions: React.FC<CommissionsProps> = ({ sales, currentUser, onUpdateStatus, onUpdateForecast }) => {
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedBroker, setSelectedBroker] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');


  // Estados para modal de previsão
  const [isForecastModalOpen, setIsForecastModalOpen] = useState(false);
  const [selectedComm, setSelectedComm] = useState<{ saleId: string, brokerId: string, property: string, forecastDate?: string, installmentNumber?: number, id?: string } | null>(null);
  const [tempForecastDate, setTempForecastDate] = useState('');


  // Estados para modal de pagamento
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any | null>(null);
  const [paymentReceipt, setPaymentReceipt] = useState<string | null>(null);
  const [partialPaymentAmount, setPartialPaymentAmount] = useState<number>(0);
  const [isPartialPayment, setIsPartialPayment] = useState(false);
  const [remainingForecastDate, setRemainingForecastDate] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [discountValue, setDiscountValue] = useState<number>(0);


  // Estado para expansão de detalhes da venda (Rateio/Parcelas)
  const [expandedId, setExpandedId] = useState<string | null>(null); // "saleId-brokerId"


  // Estados para visualização de comprovante
  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);

  const isAdmin = currentUser.role === UserRole.ADMIN;

  const commissionList = useMemo(() => {
    const list: any[] = [];
    const today = new Date().toISOString().split('T')[0];

    sales.forEach(sale => {
      if (!sale.splits || !Array.isArray(sale.splits)) return;

      sale.splits.forEach(split => {
        if (!split.broker_id || !split.broker_name) return;

        if (isAdmin || split.broker_id === currentUser.id) {
          let effectiveStatus = split.status || CommissionStatus.PENDING;

          if (effectiveStatus === CommissionStatus.OVERDUE && split.forecast_date && split.forecast_date >= today) {
            effectiveStatus = CommissionStatus.PENDING;
          }
          if (effectiveStatus === CommissionStatus.PENDING && split.forecast_date && split.forecast_date < today) {
            effectiveStatus = CommissionStatus.OVERDUE;
          }

          list.push({
            id: split.id, // ID único do split/parcela no banco
            saleId: sale.id || '',
            brokerId: split.broker_id || '',
            brokerName: split.broker_name || 'Sem nome',
            property: sale.property_address || 'Endereço não informado',
            value: split.calculated_value || 0,
            status: effectiveStatus,
            date: sale.sale_date || '',
            paymentDate: split.payment_date || null,
            paymentMethod: split.payment_method || null,
            forecastDate: split.forecast_date || null,
            receiptData: split.receipt_data || null,
            installmentNumber: split.installment_number,
            totalInstallments: split.total_installments,
            notes: split.notes || '',
            discountValue: split.discount_value || 0
          });
        }
      });
    });
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [sales, currentUser, isAdmin]);

  // 1. Filtrar por Corretor primeiro (afeta dashboard e lista)
  const filteredByBroker = useMemo(() => {
    if (selectedBroker === 'ALL') return commissionList;
    return commissionList.filter(c => c.brokerName === selectedBroker);
  }, [commissionList, selectedBroker]);

  // Agrupar a lista para exibição na tabela (Agrupado por Venda + Corretor)
  const displayCommissions = useMemo(() => {
    const groups: { [key: string]: any } = {};

    filteredByBroker.forEach(comm => {
      // Aplicar filtros de Status, Busca e Data no agrupamento
      // Se ALL, mostra tudo exceto CANCELADOS. Se específico, mostra apenas o específico.
      const matchesStatus = statusFilter === 'ALL'
        ? comm.status !== CommissionStatus.CANCELED
        : comm.status === statusFilter;

      const matchesSearch =
        (comm.property || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (comm.brokerName || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchesDate = (() => {
        if (!startDate && !endDate) return true;
        const dateStr = comm.forecastDate || comm.date || '';
        if (!dateStr) return true;
        const txDate = new Date(dateStr + 'T00:00:00');
        if (isNaN(txDate.getTime())) return true;
        const start = startDate ? new Date(startDate + 'T00:00:00') : null;
        const end = endDate ? new Date(endDate + 'T23:59:59') : null;
        if (start && txDate < start) return false;
        if (end && txDate > end) return false;
        return true;
      })();

      if (!matchesSearch || !matchesDate) return;

      const key = `${comm.saleId}-${comm.brokerId}`;
      if (!groups[key]) {
        groups[key] = {
          ...comm,
          totalValue: 0,
          paidValue: 0,
          remainingValue: 0,
          installmentsList: [],
          // O status do grupo será o "pior" para atrair atenção (Atrasado > Pendente > Pago)
          effectiveStatus: CommissionStatus.PAID,
          allSplitsMatchesStatus: true
        };
      }

      const g = groups[key];
      g.totalValue += comm.value;
      if (comm.status === CommissionStatus.PAID) g.paidValue += comm.value;
      else g.remainingValue += comm.value;

      // Status Composite (Priority: OVERDUE > REQUESTED > PENDING > PAID)
      if (comm.status === CommissionStatus.OVERDUE) {
        g.effectiveStatus = CommissionStatus.OVERDUE;
      } else if (comm.status === CommissionStatus.PARTIAL && g.effectiveStatus !== CommissionStatus.OVERDUE) {
        g.effectiveStatus = CommissionStatus.PARTIAL;
      } else if (comm.status === CommissionStatus.REQUESTED &&
        g.effectiveStatus !== CommissionStatus.OVERDUE &&
        g.effectiveStatus !== CommissionStatus.PARTIAL) {
        g.effectiveStatus = CommissionStatus.REQUESTED;
      } else if (comm.status === CommissionStatus.PENDING &&
        g.effectiveStatus !== CommissionStatus.OVERDUE &&
        g.effectiveStatus !== CommissionStatus.PARTIAL &&
        g.effectiveStatus !== CommissionStatus.REQUESTED) {
        g.effectiveStatus = CommissionStatus.PENDING;
      }


      g.installmentsList.push(comm);

      // Se estamos filtrando por um status específico, verificamos se este split bate
      if (statusFilter !== 'ALL' && comm.status !== statusFilter) {
        // Marcamos que nem todos batem, mas se pelo menos um bateu (entramos no loop), a venda aparece
      }
    });

    // Converter para array e aplicar filtro de status final do grupo se necessário
    return Object.values(groups).filter((g: any) => {
      if (statusFilter === 'ALL') return true;
      // Se filtrar por PENDENTE, mostrar se o grupo tem algo pendente ou se o status efetivo bate
      return g.installmentsList.some((i: any) => i.status === statusFilter);
    }).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [filteredByBroker, statusFilter, searchTerm, startDate, endDate]);

  // Lista plana filtrada para exportação e cálculos auxiliares
  const filteredCommissions = useMemo(() => {
    return filteredByBroker.filter(comm => {
      const matchesStatus = statusFilter === 'ALL' || comm.status === statusFilter;
      const matchesSearch =
        (comm.property || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (comm.brokerName || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchesDate = (() => {
        if (!startDate && !endDate) return true;
        const dateStr = comm.forecastDate || comm.date || '';
        if (!dateStr) return true;
        const txDate = new Date(dateStr + 'T00:00:00');
        if (isNaN(txDate.getTime())) return true;
        const start = startDate ? new Date(startDate + 'T00:00:00') : null;
        const end = endDate ? new Date(endDate + 'T23:59:59') : null;
        if (start && txDate < start) return false;
        if (end && txDate > end) return false;
        return true;
      })();

      return matchesStatus && matchesSearch && matchesDate;
    });
  }, [filteredByBroker, statusFilter, searchTerm, startDate, endDate]);



  // 2. Calcular Estatísticas baseadas no filtro de corretores
  const stats = useMemo(() => {
    let vgv = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Calcular VGV baseado nos filtros atuais
    sales.forEach(sale => {
      // Pular vendas locais para não sujar o dashboard com dados de erro
      if (sale.id.startsWith('local-')) return;

      // Se não for admin, ou se tiver corretor selecionado, precisamos ver se esse corretor participou dessa venda
      // Além disso, a venda deve ter pelo menos um split para ser considerada (evitar ghost data)
      const hasSplits = sale.splits && sale.splits.length > 0;
      const participated = !isAdmin || selectedBroker === 'ALL' || (hasSplits && sale.splits.some(s => s.broker_name === selectedBroker));

      if (participated && hasSplits) {
        vgv += sale.vgv;
      }
    });

    return {
      totalVGV: vgv,
      total: filteredByBroker.filter(c => !c.saleId.startsWith('local-')).reduce((acc, curr) => acc + curr.value, 0),
      pending: filteredByBroker.filter(c => c.status === CommissionStatus.PENDING && !c.saleId.startsWith('local-')).reduce((acc, curr) => acc + curr.value, 0),
      overdue: filteredByBroker.filter(c => c.status === CommissionStatus.OVERDUE && !c.saleId.startsWith('local-')).reduce((acc, curr) => acc + curr.value, 0),
      paid: filteredByBroker.filter(c => (c.status === CommissionStatus.PAID || c.status === CommissionStatus.PARTIAL) && !c.saleId.startsWith('local-')).reduce((acc, curr) => acc + curr.value, 0),
      count: filteredByBroker.filter(c => !c.saleId.startsWith('local-')).length
    };
  }, [filteredByBroker, sales, isAdmin, selectedBroker]);


  // 3. Obter lista única de corretores para o filtro
  const uniqueBrokers = useMemo(() => {
    const brokers = new Set(commissionList.map(c => c.brokerName));
    return Array.from(brokers).sort();
  }, [commissionList]);




  const getStatusBadge = (status: CommissionStatus) => {
    switch (status) {
      case CommissionStatus.PAID:
        return <span className="status-badge status-success">Paga</span>;
      case CommissionStatus.PARTIAL:
        return <span className="status-badge status-info">Parcial</span>;
      case CommissionStatus.PENDING:
        return <span className="status-badge status-warning">Pendente</span>;
      case CommissionStatus.OVERDUE:
        return <span className="status-badge status-error">Vencida</span>;
      case CommissionStatus.REQUESTED:
        return <span className="status-badge status-info">Solicitada</span>;
      case CommissionStatus.CANCELED:
        return <span className="status-badge bg-slate-100 text-slate-500">Cancelada</span>;
    }
  };

  const getStatusLabel = (status: CommissionStatus) => {
    switch (status) {
      case CommissionStatus.PAID: return 'Pago';
      case CommissionStatus.PARTIAL: return 'Pago Parcial';
      case CommissionStatus.PENDING: return 'Pendente';
      case CommissionStatus.OVERDUE: return 'Vencido';
      case CommissionStatus.REQUESTED: return 'Solicitado';
      case CommissionStatus.CANCELED: return 'Cancelado';
      default: return status;
    }
  };

  const handleOpenForecastModal = (comm: any) => {
    setSelectedComm({
      saleId: comm.saleId,
      brokerId: comm.brokerId,
      property: comm.property,
      forecastDate: comm.forecastDate,
      installmentNumber: comm.installmentNumber,
      id: comm.id
    });
    setTempForecastDate(comm.forecastDate || '');
    setIsForecastModalOpen(true);
  };

  const handleSaveForecast = () => {
    if (selectedComm && onUpdateForecast) {
      onUpdateForecast(selectedComm.saleId, selectedComm.brokerId, tempForecastDate, selectedComm.installmentNumber, selectedComm.id);
      setIsForecastModalOpen(false);
      setSelectedComm(null);
    }
  };


  const handleOpenPaymentModal = (comm: any) => {
    setSelectedPayment(comm);
    setPaymentReceipt(null);
    setPartialPaymentAmount(round2(comm.value)); // Garante arredondamento
    setIsPartialPayment(false);
    setPaymentNote('');
    setDiscountValue(0);
    setIsPaymentModalOpen(true);
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
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
      const paymentAmount = isPartialPayment ? partialPaymentAmount : selectedPayment.value;
      const remainingAmount = selectedPayment.value - paymentAmount;

      onUpdateStatus(
        selectedPayment.saleId,
        selectedPayment.brokerId,
        CommissionStatus.PAID,
        paymentReceipt || undefined,
        isPartialPayment ? paymentAmount : undefined,
        isPartialPayment ? remainingAmount : undefined,
        selectedPayment.installmentNumber,
        isPartialPayment ? remainingForecastDate : undefined,
        paymentNote || undefined,
        discountValue || undefined,
        selectedPayment.id
      );


      setIsPaymentModalOpen(false);
      setSelectedPayment(null);
      setPaymentReceipt(null);
      setPartialPaymentAmount(0);
      setIsPartialPayment(false);
      setRemainingForecastDate('');
      setPaymentNote('');
      setDiscountValue(0);

    }
  };


  const handleRequestPayment = (comm: any) => {
    onUpdateStatus(comm.saleId, comm.brokerId, CommissionStatus.REQUESTED, undefined, undefined, undefined, comm.installmentNumber, undefined, undefined, undefined, comm.id);
  };


  const handleExportCSV = () => {
    const headers = [
      "Data Venda",
      "Imóvel",
      "Corretor",
      "Parcela",
      "Valor Original",
      "Desconto",
      "Valor Final",
      "Status",
      "Data Pagto/Venc.",
      "Observações"
    ];

    const rows: string[][] = [];

    // Iterar sobre todas as comissões filtradas por corretor
    filteredByBroker.forEach(comm => {
      // Aplicar os mesmos filtros da tela para manter consistência no que o usuário vê
      const matchesStatus = statusFilter === 'ALL'
        ? comm.status !== CommissionStatus.CANCELED
        : comm.status === statusFilter;

      const matchesSearch =
        (comm.property || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (comm.brokerName || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchesDate = (() => {
        if (!startDate && !endDate) return true;
        const dateStr = comm.forecastDate || comm.date || '';
        if (!dateStr) return true;
        const txDate = new Date(dateStr + 'T00:00:00');
        if (isNaN(txDate.getTime())) return true;
        const start = startDate ? new Date(startDate + 'T00:00:00') : null;
        const end = endDate ? new Date(endDate + 'T23:59:59') : null;
        if (start && txDate < start) return false;
        if (end && txDate > end) return false;
        return true;
      })();

      if (!matchesSearch || !matchesDate || !matchesStatus) return;

      // Buscar dados extras do split original que podem não estar no objeto simplificado do useMemo
      const sale = sales.find(s => s.id === comm.saleId);
      const split = sale?.splits?.find(s => s.broker_id === comm.brokerId && s.installment_number === comm.installmentNumber);

      const row = [
        comm.date ? new Date(comm.date).toLocaleDateString('pt-BR') : "",
        comm.property ? comm.property.replace(/;/g, ' ').trim() : "",
        comm.brokerName || "",
        comm.totalInstallments && comm.totalInstallments > 1
          ? `${comm.installmentNumber || 1}/${comm.totalInstallments}`
          : "Única",
        formatCurrency(comm.value).replace("R$\u00a0", "").trim(),
        split?.discount_value ? formatCurrency(split.discount_value).replace("R$\u00a0", "").trim() : "0,00",
        formatCurrency(comm.value - (split?.discount_value || 0)).replace("R$\u00a0", "").trim(),
        getStatusLabel(comm.status as CommissionStatus),
        comm.status === 'PAID'
          ? (comm.paymentDate ? new Date(comm.paymentDate).toLocaleDateString('pt-BR') : "")
          : (comm.forecastDate ? new Date(comm.forecastDate).toLocaleDateString('pt-BR') : ""),
        split?.notes ? split.notes.replace(/;/g, ' ').replace(/\n/g, ' ').trim() : ""
      ];

      rows.push(row);
    });

    const csvContent = "\uFEFF" + headers.join(";") + "\n"
      + rows.map(e => e.join(";")).join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `relatorio_comissoes_detalhado_${new Date().toISOString().split('T')[0]}.csv`);
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
      {/* Dashboard & KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* VGV Card (Not clickable for filter) */}
        <div className="card-base relative overflow-hidden group">
          <div className="absolute top-0 right-[-10px] p-3 opacity-5 group-hover:scale-110 transition-transform duration-500 group-hover:rotate-6">
            <TrendingUp size={100} className="text-blue-600" />
          </div>
          <div className="flex items-center justify-between mb-4 relative z-10">
            <div className="p-2.5 bg-gradient-to-br from-blue-500/20 to-blue-600/5 text-blue-600 rounded-xl border border-blue-500/20 shadow-inner">
              <TrendingUp size={24} />
            </div>
          </div>
          <p className="text-sm font-medium text-slate-500 mb-1">VGV Total</p>
          <p className="text-2xl font-bold text-slate-800">{formatCurrency(stats.totalVGV)}</p>
        </div>

        {/* Total Commissions Card */}
        <div
          className={`card-base relative overflow-hidden group cursor-pointer transition-all ${statusFilter === 'ALL' ? 'border-indigo-500 ring-1 ring-indigo-500 shadow-md' : 'hover:border-indigo-200'}`}
          onClick={() => setStatusFilter('ALL')}
        >
          <div className="absolute top-0 right-[-10px] p-3 opacity-5 group-hover:scale-110 transition-transform duration-500 group-hover:rotate-6">
            <Wallet size={100} className="text-indigo-600" />
          </div>
          <div className="flex items-center justify-between mb-4 relative z-10">
            <div className="p-2.5 bg-gradient-to-br from-indigo-500/20 to-indigo-600/5 text-indigo-600 rounded-xl border border-indigo-500/20 shadow-inner">
              <Wallet size={24} />
            </div>
            {statusFilter === 'ALL' && <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div>}
          </div>
          <p className="text-sm font-medium text-slate-500 mb-1 ">Comissões Totais</p>
          <p className="text-2xl font-bold text-slate-800">{formatCurrency(stats.total)}</p>
        </div>

        {/* Paid Card */}
        <div
          className={`card-base relative overflow-hidden group cursor-pointer transition-all ${statusFilter === CommissionStatus.PAID ? 'border-emerald-500 ring-1 ring-emerald-500 shadow-md' : 'hover:border-emerald-200'}`}
          onClick={() => setStatusFilter(CommissionStatus.PAID)}
        >
          <div className="absolute top-0 right-[-10px] p-3 opacity-5 group-hover:scale-110 transition-transform duration-500 group-hover:rotate-6">
            <CheckCircle2 size={100} className="text-emerald-600" />
          </div>
          <div className="flex items-center justify-between mb-4 relative z-10">
            <div className="p-2.5 bg-gradient-to-br from-emerald-500/20 to-emerald-600/5 text-emerald-600 rounded-xl border border-emerald-500/20 shadow-inner">
              <CheckCircle2 size={24} />
            </div>
            {statusFilter === CommissionStatus.PAID && <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>}
          </div>
          <p className="text-sm font-medium text-slate-500 mb-1">Recebido</p>
          <p className="text-2xl font-bold text-slate-800">{formatCurrency(stats.paid)}</p>
        </div>

        {/* Pending Card */}
        <div
          className={`card-base relative overflow-hidden group cursor-pointer transition-all ${statusFilter === CommissionStatus.PENDING ? 'border-blue-500 ring-1 ring-blue-500 shadow-md' : 'hover:border-blue-200'}`}
          onClick={() => setStatusFilter(CommissionStatus.PENDING)}
        >
          <div className="absolute top-0 right-[-10px] p-3 opacity-5 group-hover:scale-110 transition-transform duration-500 group-hover:-rotate-6">
            <Clock size={100} className="text-blue-600" />
          </div>
          <div className="flex items-center justify-between mb-4 relative z-10">
            <div className="p-2.5 bg-gradient-to-br from-blue-500/20 to-blue-600/5 text-blue-600 rounded-xl border border-blue-500/20 shadow-inner">
              <Clock size={24} />
            </div>
            {statusFilter === CommissionStatus.PENDING && <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>}
          </div>
          <p className="text-sm font-medium text-slate-500 mb-1">A Receber</p>
          <p className="text-2xl font-bold text-slate-800">{formatCurrency(stats.pending)}</p>
        </div>

        {/* Overdue Card */}
        <div
          className={`card-base relative overflow-hidden group cursor-pointer transition-all ${statusFilter === CommissionStatus.OVERDUE ? 'border-red-500 ring-1 ring-red-500 shadow-md' : 'hover:border-red-200'}`}
          onClick={() => setStatusFilter(CommissionStatus.OVERDUE)}
        >
          <div className="absolute top-0 right-[-10px] p-3 opacity-5 group-hover:scale-110 transition-transform duration-500 group-hover:-rotate-6">
            <Clock size={100} className="text-red-600" />
          </div>
          <div className="flex items-center justify-between mb-4 relative z-10">
            <div className="p-2.5 bg-gradient-to-br from-red-500/20 to-red-600/5 text-red-600 rounded-xl border border-red-500/20 shadow-inner">
              <Clock size={24} />
            </div>
            {statusFilter === CommissionStatus.OVERDUE && <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>}
          </div>
          <p className="text-sm font-medium text-slate-500 mb-1">Vencido</p>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(stats.overdue)}</p>
        </div>
      </div>


      {/* Filters Bar */}
      <div className="card-base mb-6 backdrop-blur-xl space-y-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Buscar comissão..."
                className="pl-9 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-100 w-full md:w-64"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {isAdmin && (
              <select
                className="px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none cursor-pointer hover:bg-slate-100 transition-colors font-semibold text-slate-700"
                value={selectedBroker}
                onChange={(e) => setSelectedBroker(e.target.value)}
              >
                <option value="ALL">Todos os Corretores</option>
                {uniqueBrokers.map(broker => (
                  <option key={broker} value={broker}>{broker}</option>
                ))}
              </select>
            )}

            <select
              className="px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none cursor-pointer hover:bg-slate-100 transition-colors"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">TODOS OS STATUS</option>
              <option value={CommissionStatus.PAID}>PAGOS</option>
              <option value={CommissionStatus.PENDING}>A RECEBER</option>
              <option value={CommissionStatus.OVERDUE}>VENCIDOS</option>
              <option value={CommissionStatus.REQUESTED}>SOLICITADOS</option>
              <option value={CommissionStatus.CANCELED}>CANCELADOS (DISTRATOS)</option>
            </select>

          </div>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 w-full md:w-auto justify-center"
          >
            <Download size={18} /> Exportar CSV
          </button>
        </div>

        {/* Filtro de Data */}
        <div className="flex items-center gap-4 pt-4 border-t border-slate-50">
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
              <Calendar size={12} /> Início:
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-slate-50 text-xs font-semibold text-slate-600 px-3 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
              <Calendar size={12} /> Fim:
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-slate-50 text-xs font-semibold text-slate-600 px-3 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>
          {(startDate || endDate) && (
            <button
              onClick={() => { setStartDate(''); setEndDate(''); }}
              className="text-[10px] font-bold text-red-400 uppercase hover:text-red-500 hover:underline transition-all"
            >
              Limpar Datas
            </button>
          )}
        </div>
      </div>


      {/* Commission Table */}
      <div className="card-base p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr className="bg-transparent text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-black/5">
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Venda / Imóvel</th>
                <th className="px-6 py-4">Corretor</th>
                <th className="px-6 py-4">Valor Devido</th>
                <th className="px-6 py-4">Data Pagto / Previsão</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {displayCommissions.map((group, idx) => {
                const isExpanded = expandedId === `${group.saleId}-${group.brokerId}`;
                const saleData = sales.find(s => s.id === group.saleId);
                const isCanceled = group.installmentsList.some(i => i.status === CommissionStatus.CANCELED);

                return (
                  <React.Fragment key={`${group.saleId}-${group.brokerId}`}>
                    <tr
                      className={`transition-colors group ${group.installmentsList.length > 1 ? 'cursor-pointer' : 'cursor-default'} ${isExpanded ? 'bg-blue-50/30' : ''} ${isCanceled ? 'bg-slate-50/80 hover:bg-slate-100/80 opacity-60' : 'hover:bg-slate-50/50'
                        }`}
                      onClick={() => group.installmentsList.length > 1 && toggleExpand(`${group.saleId}-${group.brokerId}`)}
                    >

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {group.installmentsList.length > 1 && (
                            <div className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
                              <ChevronRight size={14} className="text-slate-300" />
                            </div>
                          )}
                          {getStatusBadge(group.effectiveStatus)}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className={`text-sm font-bold ${isCanceled ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{group.property}</span>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-[9px] font-bold uppercase tracking-wider ${isCanceled ? 'text-slate-300 line-through' : 'text-slate-400'}`}>REF: {group.saleId.slice(0, 8)}</span>
                            {(() => {
                              // Mostrar primeira nota encontrada se houver (usando dado mapeado)
                              const note = group.installmentsList.find((i: any) => i.notes)?.notes;

                              if (note) {
                                return (
                                  <span className="text-[9px] text-blue-600 font-black italic truncate max-w-[250px] bg-blue-50/80 px-2 py-0.5 rounded-lg border border-blue-200/50 shadow-sm flex items-center gap-1">
                                    <FileText size={8} /> {note}
                                  </span>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isCanceled ? 'bg-slate-200 text-slate-400' : 'bg-blue-100 text-blue-600'}`}>
                            {group.brokerName.charAt(0)}
                          </div>
                          <span className={`text-sm font-medium ${isCanceled ? 'text-slate-400 line-through' : 'text-slate-600'}`}>{group.brokerName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className={`text-sm font-bold ${isCanceled ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{formatCurrency(group.totalValue)}</span>
                          {group.paidValue > 0 && group.remainingValue > 0 && (
                            <span className="text-[10px] text-emerald-500 font-black tracking-tight bg-emerald-50 px-1.5 py-0.5 rounded inline-block border border-emerald-100/50">
                              AMORTIZADO: {formatCurrency(group.paidValue)}
                            </span>
                          )}
                          {(() => {
                            // Mostrar descontos acumulados se houver (usando dado mapeado)
                            const totalDiscount = group.installmentsList.reduce((acc: number, i: any) => acc + (i.discountValue || 0), 0);

                            if (totalDiscount > 0) {
                              return (
                                <span className="text-[9px] text-red-500 font-black mt-1 bg-red-50 px-1.5 py-0.5 rounded inline-block border border-red-100 uppercase shadow-sm">
                                  (-) DESC: {formatCurrency(totalDiscount)}
                                </span>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-slate-600">
                            {group.remainingValue > 0
                              ? `Falta: ${formatCurrency(group.remainingValue)}`
                              : 'Totalmente Pago'}
                          </span>
                          {(() => {
                            const nextDate = [...group.installmentsList]
                              .filter(i => i.status !== CommissionStatus.PAID)
                              .sort((a, b) => new Date(a.forecastDate).getTime() - new Date(b.forecastDate).getTime())[0]?.forecastDate;

                            const lastPaidDate = [...group.installmentsList]
                              .filter(i => i.status === CommissionStatus.PAID)
                              .sort((a, b) => new Date(b.paymentDate || '').getTime() - new Date(a.paymentDate || '').getTime())[0]?.paymentDate;

                            const displayDate = nextDate || lastPaidDate;

                            return displayDate ? (
                              <span className={`text-[10px] font-bold uppercase mt-1 ${nextDate ? 'text-blue-600' : 'text-emerald-500'}`}>
                                {nextDate ? 'Vencimento: ' : 'Pago em: '}
                                {new Date(displayDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                              </span>
                            ) : null;
                          })()}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-3" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => toggleExpand(`${group.saleId}-${group.brokerId}`)}
                            className="flex items-center gap-1.5 text-xs font-black text-indigo-600 hover:text-indigo-800 hover:underline transition-all bg-indigo-50/50 px-3 py-1.5 rounded-xl border border-indigo-100/50 shadow-sm"
                          >
                            <Eye size={14} /> Ver Detalhes
                          </button>

                          {isAdmin && group.installmentsList.length === 1 && (
                            <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-100 animate-in fade-in zoom-in duration-200">
                              {group.installmentsList[0].status !== CommissionStatus.PAID && (
                                <button
                                  onClick={() => handleOpenForecastModal(group.installmentsList[0])}
                                  className="p-1.5 text-blue-500 hover:bg-blue-100 rounded-md transition-all"
                                  title="Editar Previsão/Info"
                                >
                                  <Calendar size={14} />
                                </button>
                              )}
                              {group.installmentsList[0].status !== CommissionStatus.PAID ? (
                                <button
                                  onClick={() => handleOpenPaymentModal(group.installmentsList[0])}
                                  className="p-1.5 text-emerald-500 hover:bg-emerald-100 rounded-md transition-all"
                                  title="Concretizar Pagamento"
                                >
                                  <DollarSign size={14} />
                                </button>
                              ) : (
                                <button
                                  onClick={() => {
                                    if (confirm("Deseja reabrir esta comissão? O status voltará para 'A RECEBER'.")) {
                                      onUpdateStatus(group.saleId, group.brokerId, CommissionStatus.PENDING, undefined, undefined, undefined, group.installmentsList[0].installmentNumber, undefined, undefined, undefined, group.installmentsList[0].id);
                                    }
                                  }}
                                  className="p-1.5 text-amber-500 hover:bg-amber-100 rounded-md transition-colors"
                                  title="Estornar / Voltar Aberta"
                                >
                                  <ArrowUpRight className="rotate-180" size={14} />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                    </tr>

                    {/* Linha Expandida: Detalhes das Parcelas do Corretor */}
                    {isExpanded && (
                      <tr className="bg-slate-50/80 animate-in fade-in slide-in-from-top-1 duration-200">
                        <td colSpan={6} className="px-8 py-6">
                          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                              <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                <Clock size={14} className="text-blue-500" /> Detalhamento de Parcelas - {group.brokerName}
                              </h4>
                              <div className="flex items-center gap-4">
                                <div className="text-[10px] font-bold text-slate-400 uppercase">
                                  VGV: <span className="text-slate-700">{formatCurrency(saleData?.vgv || 0)}</span>
                                </div>
                                <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-bold">Resumo Individual</span>
                              </div>
                            </div>

                            <div className="p-6">
                              {/* Agrupar por installment_number para lidar com pagamentos parciais */}
                              <div className="space-y-3">
                                {(() => {
                                  // Agrupar splits por número de parcela
                                  const installmentGroups: { [key: number]: any[] } = {};
                                  group.installmentsList.forEach((i: any) => {
                                    const num = i.installmentNumber || 1;
                                    if (!installmentGroups[num]) installmentGroups[num] = [];
                                    installmentGroups[num].push(i);
                                  });

                                  return Object.entries(installmentGroups).sort((a, b) => Number(a[0]) - Number(b[0])).map(([num, splits]) => {
                                    const totalParcelValue = splits.reduce((acc, s) => acc + s.value, 0);
                                    const paidParcelValue = splits.filter(s => s.status === CommissionStatus.PAID).reduce((acc, s) => acc + s.value, 0);
                                    const remainingParcelValue = totalParcelValue - paidParcelValue;
                                    const latestForecast = splits.find(s => s.status !== CommissionStatus.PAID)?.forecastDate || splits[0].forecastDate;

                                    const status = splits.some(s => s.status === CommissionStatus.OVERDUE) ? CommissionStatus.OVERDUE :
                                      splits.some(s => s.status === CommissionStatus.PENDING) ? CommissionStatus.PENDING :
                                        splits.some(s => s.status === CommissionStatus.REQUESTED) ? CommissionStatus.REQUESTED : CommissionStatus.PAID;


                                    return (
                                      <div key={num} className="bg-white border border-slate-100 rounded-xl overflow-hidden hover:border-blue-100 transition-colors">
                                        <div className="flex items-center justify-between p-4">
                                          <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center font-bold text-xs ${status === CommissionStatus.PAID ? 'bg-emerald-50 text-emerald-600' :
                                              status === CommissionStatus.OVERDUE ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
                                              }`}>
                                              <span className="text-[8px] uppercase opacity-60">Parc</span>
                                              {num}/{group.totalInstallments || 1}
                                            </div>
                                            <div className="flex flex-col">
                                              <span className="text-sm font-bold text-slate-700">Valor da Parcela: {formatCurrency(totalParcelValue)}</span>
                                              <span className="text-[10px] text-slate-400 font-medium">
                                                Previsão: {latestForecast ? new Date(latestForecast).toLocaleDateString('pt-BR') : 'A definir'}
                                              </span>
                                            </div>
                                          </div>

                                          <div className="flex items-center gap-6">
                                            <div className="flex flex-col items-end">
                                              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg ${status === CommissionStatus.PAID ? 'bg-emerald-50 text-emerald-600' :
                                                status === CommissionStatus.OVERDUE ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                                                }`}>
                                                {status === CommissionStatus.PAID ? 'PAGO' :
                                                  status === CommissionStatus.PENDING ? 'A RECEBER' :
                                                    status === CommissionStatus.OVERDUE ? 'VENCIDO' :
                                                      status === CommissionStatus.REQUESTED ? 'SOLICITADO' : status}

                                              </span>
                                              {paidParcelValue > 0 && remainingParcelValue > 0 && (
                                                <span className="text-[9px] text-emerald-500 font-bold mt-1">Pago: {formatCurrency(paidParcelValue)}</span>
                                              )}
                                            </div>

                                            <div className="flex items-center gap-2">
                                              {splits.map((s, sIdx) => (
                                                <div key={sIdx} className="flex gap-2">
                                                  {isAdmin && (
                                                    <div className="flex gap-1 bg-slate-50/50 p-1 rounded-lg border border-slate-100">
                                                      <button
                                                        onClick={() => handleOpenForecastModal(s)}
                                                        className="p-1.5 text-blue-500 hover:bg-blue-100 rounded-md transition-colors"
                                                        title="Editar Previsão"
                                                      >
                                                        <Calendar size={14} />
                                                      </button>

                                                      {s.status !== CommissionStatus.PAID ? (
                                                        <button
                                                          onClick={() => handleOpenPaymentModal(s)}
                                                          className="p-1.5 text-emerald-500 hover:bg-emerald-100 rounded-md transition-colors"
                                                          title="Concretizar Pagamento"
                                                        >
                                                          <DollarSign size={14} />
                                                        </button>
                                                      ) : (
                                                        <button
                                                          onClick={() => {
                                                            if (confirm("Deseja reabrir este registro de pagamento? O status voltará para 'A RECEBER'.")) {
                                                              onUpdateStatus(s.saleId, s.brokerId, CommissionStatus.PENDING, undefined, undefined, undefined, s.installmentNumber, undefined, undefined, undefined, s.id);
                                                            }
                                                          }}
                                                          className="p-1.5 text-amber-500 hover:bg-amber-100 rounded-md transition-colors"
                                                          title="Estornar / Reabrir"
                                                        >
                                                          <ArrowUpRight className="rotate-180" size={14} />
                                                        </button>
                                                      )}
                                                    </div>
                                                  )}

                                                  {!isAdmin && (s.status === CommissionStatus.OVERDUE || (s.forecastDate && s.forecastDate <= new Date().toISOString().split('T')[0])) &&
                                                    s.status !== CommissionStatus.PAID &&
                                                    s.status !== CommissionStatus.REQUESTED && (
                                                      <button
                                                        onClick={() => handleRequestPayment(s)}
                                                        className="p-2 text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors"
                                                        title="Solicitar Pagamento"
                                                      >
                                                        <DollarSign size={14} />
                                                      </button>
                                                    )}

                                                  {s.status === CommissionStatus.PAID && s.receiptData && (
                                                    <button
                                                      onClick={() => setViewingReceipt(s.receiptData)}
                                                      className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                                                      title="Ver Comprovante"
                                                    >
                                                      <Eye size={18} />
                                                    </button>
                                                  )}
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        </div>

                                        {/* Detalhes de Pagamento Parcial dentro da Parcela */}
                                        {splits.length > 1 && (
                                          <div className="px-4 pb-4 pt-1 border-t border-slate-50 bg-slate-50/30">
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Composição da Parcela</p>
                                            <div className="space-y-1">
                                              {splits.map((s, sIdx) => (
                                                <div key={sIdx} className="flex items-center justify-between text-[11px] bg-white p-2 rounded-lg border border-slate-100">
                                                  <div className="flex items-center gap-2">
                                                    <div className={`w-1.5 h-1.5 rounded-full ${s.status === CommissionStatus.PAID ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                                                    <span className="text-slate-600">Registro {sIdx + 1}</span>
                                                    <span className={`text-[9px] font-bold px-1.5 rounded ${s.status === CommissionStatus.PAID ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                                                      {s.status === CommissionStatus.PAID ? 'PAGO' :
                                                        s.status === CommissionStatus.PENDING ? 'A RECEBER' :
                                                          s.status === CommissionStatus.OVERDUE ? 'VENCIDO' :
                                                            s.status === CommissionStatus.REQUESTED ? 'SOLICITADO' : s.status}

                                                    </span>

                                                  </div>
                                                  <div className="flex flex-col items-end min-w-[180px]">
                                                    {s.status === CommissionStatus.PAID ? (
                                                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 w-full space-y-2">
                                                        <div className="flex justify-between items-center text-[10px] text-slate-500 uppercase font-bold tracking-tight">
                                                          <span>Valor Original</span>
                                                          <span className="text-slate-700">{formatCurrency(s.value)}</span>
                                                        </div>

                                                        {(() => {
                                                          const splitData = saleData?.splits?.find(split => split.broker_id === s.brokerId && split.installment_number === s.installmentNumber);
                                                          const discount = splitData?.discount_value || 0;
                                                          const note = splitData?.notes || '';

                                                          if (discount > 0) {
                                                            return (
                                                              <div className="flex justify-between items-start text-[10px] text-red-500 border-t border-slate-200/50 pt-2 font-bold">
                                                                <div className="flex flex-col">
                                                                  <span>(-) Dedução</span>
                                                                  <span className="text-[8px] opacity-70 italic font-medium max-w-[120px] leading-tight">Motivo: {note || 'Desconto aplicado'}</span>
                                                                </div>
                                                                <span>{formatCurrency(discount)}</span>
                                                              </div>
                                                            );
                                                          }
                                                          return null;
                                                        })()}

                                                        <div className="flex justify-between items-center text-xs font-black text-emerald-600 border-t border-slate-200 pt-2">
                                                          <span>Recebido Líquido</span>
                                                          <span>
                                                            {(() => {
                                                              const splitData = saleData?.splits?.find(split => split.broker_id === s.brokerId && split.installment_number === s.installmentNumber);
                                                              const discount = splitData?.discount_value || 0;
                                                              return formatCurrency(s.value - discount);
                                                            })()}
                                                          </span>
                                                        </div>
                                                      </div>
                                                    ) : (
                                                      <span className="font-bold text-slate-700 text-sm">{formatCurrency(s.value)}</span>
                                                    )}
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  });
                                })()}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
          {displayCommissions.length === 0 && (
            <div className="p-16 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search size={24} className="text-slate-300" />
              </div>
              <h3 className="text-slate-800 font-bold mb-1">Nenhuma comissão encontrada</h3>
              <p className="text-slate-400 text-sm">Tente ajustar seus filtros de busca ou data.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal Editar Previsão */}
      {isForecastModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white/95 backdrop-blur-xl border border-white/60 w-full max-w-sm rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="p-6 border-b border-black/5 flex items-center justify-between bg-transparent">
              <div>
                <h3 className="text-xl font-bold text-slate-800">Previsão de Pagto</h3>
                <p className="text-xs text-slate-400">Ajuste a data esperada para o recebimento.</p>
              </div>
              <button
                onClick={() => setIsForecastModalOpen(false)}
                className="bg-slate-50 p-2 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-50">
                <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">Imóvel</p>
                <p className="text-sm font-bold text-slate-700 truncate">{selectedComm?.property}</p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 flex items-center gap-1">
                  <CalendarDays size={12} /> Selecione a Nova Data
                </label>
                <input
                  type="date"
                  value={tempForecastDate}
                  className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none text-sm font-bold transition-all"
                  onChange={e => setTempForecastDate(e.target.value)}
                />
              </div>
            </div>

            <div className="p-6 bg-transparent border-t border-black/5 flex gap-3">
              <button
                onClick={() => setIsForecastModalOpen(false)}
                className="flex-1 px-4 py-3 text-slate-500 font-bold hover:text-slate-700 transition-colors text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveForecast}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-xl font-bold transition-all shadow-lg shadow-blue-100 text-sm"
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
          <div className="bg-white/95 backdrop-blur-xl border border-white/60 w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="p-8 pb-4 flex items-center justify-between bg-transparent">
              <div>
                <h3 className="text-xl font-bold text-slate-800">Concretizar Pagamento</h3>
                <p className="text-xs font-medium text-slate-400 mt-0.5">Anexe o comprovante para finalizar.</p>
              </div>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="p-2 text-slate-300 hover:text-slate-500 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="max-h-[75vh] overflow-y-auto custom-scrollbar">
              <div className="p-6 space-y-6">
                <div className="bg-slate-50/50 p-6 rounded-[24px] border border-slate-100 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.15em]">Valor Total</p>
                      <div className="w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center text-white">
                        <Check size={10} strokeWidth={4} />
                      </div>
                    </div>
                    <p className="text-2xl font-black text-slate-800">{formatCurrency(selectedPayment?.value)}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Beneficiário: <span className="text-slate-600">{selectedPayment?.brokerName}</span></p>
                  </div>
                </div>


                {/* Toggle Pagamento Parcial */}
                <div className="flex items-center justify-between p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
                  <span className="text-xs font-black text-slate-600 uppercase tracking-wider">Pagamento Parcial?</span>
                  <div
                    className={`w-11 h-6 rounded-full relative transition-all duration-300 cursor-pointer ${isPartialPayment ? 'bg-emerald-500' : 'bg-slate-200'}`}
                    onClick={() => {
                      setIsPartialPayment(!isPartialPayment);
                      if (!isPartialPayment) {
                        setPartialPaymentAmount(round2(selectedPayment?.value || 0));
                      }
                    }}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-sm ${isPartialPayment ? 'left-6' : 'left-1'}`} />
                  </div>
                </div>

                {isPartialPayment && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-300 space-y-6">
                    <div className="space-y-2.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                        <DollarSign size={12} className="text-emerald-500" /> Valor a Pagar Agora
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(partialPaymentAmount)}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '');
                            setPartialPaymentAmount(round2(Number(val) / 100));
                          }}
                          className="w-full px-6 py-5 bg-white border border-emerald-100 rounded-[20px] focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 outline-none text-2xl font-black text-slate-700 transition-all shadow-sm"
                        />
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300 font-bold text-xs uppercase ml-1">R$</div>
                      </div>
                    </div>
                    {partialPaymentAmount < (selectedPayment?.value || 0) && (
                      <div className="space-y-5 animate-in slide-in-from-top-2 duration-300">
                        <div className="bg-amber-50/30 p-5 rounded-[20px] border border-amber-100/50 flex items-center justify-between">
                          <div className="space-y-1">
                            <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Saldo Remanescente</p>
                            <p className="text-xl font-black text-amber-700">{formatCurrency(round2((selectedPayment?.value || 0) - partialPaymentAmount))}</p>
                          </div>
                          <div className="w-10 h-10 bg-amber-100/50 rounded-xl flex items-center justify-center text-amber-600">
                            <Clock size={18} />
                          </div>
                        </div>

                        <div className="space-y-2.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                            <Calendar size={12} className="text-amber-500" /> Próximo Vencimento
                          </label>
                          <input
                            type="date"
                            value={remainingForecastDate}
                            required
                            className="w-full px-6 py-4 bg-white border border-amber-100 rounded-[16px] focus:ring-4 focus:ring-amber-50 focus:border-amber-400 outline-none text-sm font-bold transition-all shadow-sm"
                            onChange={e => setRemainingForecastDate(e.target.value)}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-6">
                  <div className="space-y-2.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                      <FileText size={12} /> Observações Internas
                    </label>
                    <textarea
                      value={paymentNote}
                      placeholder="Alguma observação sobre este pagamento?"
                      className="w-full px-6 py-5 bg-slate-50/50 border border-slate-100 rounded-[20px] focus:ring-4 focus:ring-emerald-50 focus:border-emerald-200 outline-none text-sm transition-all min-h-[100px] resize-none font-medium placeholder:text-slate-300"
                      onChange={e => setPaymentNote(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                      <ArrowUpRight size={12} className="text-red-400 rotate-180" /> Valor do Desconto (Taxas/Ajustes)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(discountValue)}
                        className="w-full px-6 py-4 bg-slate-50/50 border border-slate-100 rounded-[16px] focus:ring-4 focus:ring-red-50 focus:border-red-100 outline-none text-sm font-bold transition-all text-slate-600"
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          setDiscountValue(round2(Number(val) / 100));
                        }}
                      />
                      <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 font-bold pointer-events-none hidden">R$</span>
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300 font-bold text-xs uppercase ml-1">R$</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                    <Upload size={12} /> Comprovante de Pagamento
                  </label>

                  {!paymentReceipt ? (
                    <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-slate-200 rounded-[24px] cursor-pointer hover:bg-slate-50 hover:border-emerald-200 transition-all group relative overflow-hidden">
                      <div className="flex flex-col items-center justify-center py-8">
                        <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                          <FileText size={24} className="text-slate-300 group-hover:text-emerald-500 transition-colors" />
                        </div>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Clique para anexar comprovante</p>
                      </div>
                      <input type="file" className="hidden" accept="image/*,.pdf" onChange={handleFileChange} />
                    </label>
                  ) : (
                    <div className="relative bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center gap-3 animate-in slide-in-from-bottom-2">
                      <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center shadow-sm">
                        <CheckCircle2 size={24} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate">Comprovante Anexado</p>
                        <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Pronto para salvar</p>
                      </div>
                      <button onClick={() => setPaymentReceipt(null)} className="text-red-400 hover:text-red-600 transition-colors">
                        <X size={18} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-8 pt-4 flex gap-4">
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="flex-1 px-4 py-4 text-slate-400 font-bold hover:text-slate-600 transition-colors text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmPayment}
                className="flex-[2] bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-4 rounded-[20px] font-black transition-all shadow-lg shadow-emerald-100 text-sm tracking-wide"
              >
                Confirmar Pagamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Visualização do Comprovante (Fiel ao design solicitado) */}
      {viewingReceipt && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="relative bg-white p-2 rounded-[48px] max-w-md w-full shadow-2xl animate-in zoom-in duration-300">
            {/* Botão fechar (X em círculo escuro no canto superior direito fora do card) */}
            <button
              onClick={() => setViewingReceipt(null)}
              className="absolute -top-4 -right-4 bg-slate-800/80 p-2.5 rounded-full text-white hover:bg-slate-900 transition-all shadow-lg border border-white/20 z-[120]"
            >
              <X size={20} />
            </button>

            <div className="bg-white rounded-[40px] overflow-hidden">
              {viewingReceipt.startsWith('data:image') ? (
                <div className="p-4">
                  <img src={viewingReceipt} alt="Comprovante" className="w-full h-auto object-contain max-h-[70vh] rounded-[32px]" />
                </div>
              ) : (
                <div className="p-16 text-center space-y-6">
                  <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mx-auto shadow-sm">
                    <FileText size={44} />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-2xl font-black text-slate-800 tracking-tight">Comprovante PDF</h4>
                    <p className="text-slate-400 text-sm font-medium leading-relaxed px-4">
                      Este é um documento PDF. Em um ambiente real, ele seria aberto no navegador.
                    </p>
                  </div>
                  <button
                    onClick={handleDownloadReceipt}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-2xl font-bold transition-all shadow-xl shadow-blue-100 flex items-center justify-center gap-2"
                  >
                    <Download size={20} />
                    Download Comprovante
                  </button>
                </div>
              )}
            </div>

            <div className="p-8 text-center pt-2">
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">
                Visualização Segura • ComissOne Intel
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Commissions;
