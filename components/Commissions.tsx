
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
  Check
} from 'lucide-react';
import { Sale, User, UserRole, CommissionStatus } from '../types';

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
  const [isAdvancedFiltersOpen, setIsAdvancedFiltersOpen] = useState(false);
  
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
            role: split.role
          });
        }
      });
    });
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [sales, currentUser, isAdmin]);

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

    return matchesStatus && matchesSearch && matchesBroker && matchesDate;
  });

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const getStatusBadge = (status: CommissionStatus) => {
    switch (status) {
      case CommissionStatus.PAID:
        return <span className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 border border-emerald-100"><CheckCircle2 size={14} /> PAGO</span>;
      case CommissionStatus.PENDING:
        return <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 border border-blue-100"><Clock size={14} /> PENDENTE</span>;
      case CommissionStatus.OVERDUE:
        return <span className="bg-red-50 text-red-600 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 border border-red-100"><AlertTriangle size={14} /> ATRASADO</span>;
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
      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="Buscar comissão..." 
                className="pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-100 w-full md:w-64"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select 
              className="px-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none cursor-pointer hover:bg-slate-100 transition-colors"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">Todos os Status</option>
              <option value={CommissionStatus.PAID}>Pagos</option>
              <option value={CommissionStatus.PENDING}>Pendentes</option>
              <option value={CommissionStatus.OVERDUE}>Atrasados</option>
            </select>
            {isAdmin && (
              <button 
                onClick={() => setIsAdvancedFiltersOpen(!isAdvancedFiltersOpen)}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all ${
                  isAdvancedFiltersOpen || brokerFilter !== 'ALL' || startDate || endDate 
                    ? 'bg-blue-50 text-blue-600 border border-blue-100' 
                    : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Filter size={16} /> Filtros Avançados
              </button>
            )}
          </div>
          <button 
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 w-full md:w-auto justify-center"
          >
            <Download size={18} /> Exportar CSV
          </button>
        </div>

        {/* Barra de Filtros Avançados */}
        {isAdvancedFiltersOpen && (
          <div className="pt-4 border-t border-slate-50 grid grid-cols-1 md:grid-cols-4 gap-4 animate-in slide-in-from-top-2 duration-200">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Corretor</label>
              <select 
                className="w-full px-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none hover:bg-slate-100 transition-colors"
                value={brokerFilter}
                onChange={(e) => setBrokerFilter(e.target.value)}
              >
                <option value="ALL">Todos os Corretores</option>
                {team.filter(u => u.role === UserRole.BROKER || u.role === UserRole.ADMIN).map(user => (
                  <option key={user.id} value={user.id}>{user.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Data Início</label>
              <input 
                type="date" 
                className="w-full px-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none hover:bg-slate-100 transition-colors"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Data Fim</label>
              <input 
                type="date" 
                className="w-full px-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none hover:bg-slate-100 transition-colors"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="flex items-end gap-2">
              <button 
                onClick={() => {
                  setBrokerFilter('ALL');
                  setStartDate('');
                  setEndDate('');
                  setStatusFilter('ALL');
                  setSearchTerm('');
                }}
                className="w-full px-4 py-2 text-sm text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                Limpar Filtros
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Commission Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Venda / Imóvel</th>
                <th className="px-6 py-4">Corretor</th>
                <th className="px-6 py-4">Valor Devido</th>
                <th className="px-6 py-4">Data Pagto / Previsão</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredCommissions.map((comm, idx) => (
                <tr key={`${comm.saleId}-${comm.brokerId}-${idx}`} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4">{getStatusBadge(comm.status)}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-slate-800">{comm.property}</span>
                      <span className="text-[10px] text-slate-400 uppercase tracking-tight font-medium">Ref: {comm.saleId} • {new Date(comm.date).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-[10px] text-blue-600 font-bold">
                        {comm.brokerName.charAt(0)}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold">{comm.brokerName}</span>
                        {comm.role && (
                          <span className="text-[10px] text-slate-400 font-medium">{comm.role}</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-800">{formatCurrency(comm.value)}</td>
                  <td className="px-6 py-4">
                    {comm.paymentDate ? (
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm text-slate-700">{new Date(comm.paymentDate).toLocaleDateString('pt-BR')}</span>
                          {comm.receiptData && (
                            <button 
                              onClick={() => setViewingReceipt(comm.receiptData)}
                              className="text-emerald-500 hover:text-emerald-600 transition-colors"
                              title="Ver Comprovante"
                            >
                              <FileText size={14} />
                            </button>
                          )}
                        </div>
                        <span className="text-[10px] text-emerald-500 font-bold uppercase">{comm.paymentMethod}</span>
                      </div>
                    ) : comm.forecastDate ? (
                      <div className="flex flex-col">
                        <span className="text-sm text-amber-600 font-bold">{new Date(comm.forecastDate).toLocaleDateString('pt-BR')}</span>
                        <span className="text-[10px] text-amber-500 font-bold uppercase flex items-center gap-1">
                          <Clock size={10} /> Previsão
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-slate-400">---</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {isAdmin && comm.status !== CommissionStatus.PAID && (
                        <button 
                          onClick={() => handleOpenForecastModal(comm)}
                          className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors group relative"
                          title="Editar Previsão"
                        >
                          <Calendar size={18} />
                        </button>
                      )}
                      
                      {isAdmin && comm.status !== CommissionStatus.PAID ? (
                        <button 
                          onClick={() => handleOpenPaymentModal(comm)}
                          className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors group relative"
                          title="Concretizar Pagamento"
                        >
                          <DollarSign size={18} />
                        </button>
                      ) : (
                        <div className="flex gap-1">
                           {comm.receiptData && (
                            <button 
                              onClick={() => setViewingReceipt(comm.receiptData)}
                              className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Visualizar Comprovante"
                            >
                              <Eye size={18} />
                            </button>
                           )}
                           <button className={`p-2 transition-colors ${comm.status === CommissionStatus.PAID ? 'text-slate-300' : 'text-slate-300 cursor-not-allowed'}`}>
                             <ArrowUpRight size={18} />
                           </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredCommissions.length === 0 && (
            <div className="p-16 text-center">
              <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Wallet className="text-slate-200" size={40} />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">Nenhuma comissão aqui</h3>
              <p className="text-slate-500 max-w-sm mx-auto">Ajuste os filtros ou verifique se as vendas registradas possuem corretores vinculados.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal Editar Previsão */}
      {isForecastModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-50 flex items-center justify-between">
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

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
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
          <div className="bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-50 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-800">Concretizar Pagamento</h3>
                <p className="text-xs text-slate-400">Anexe o comprovante para finalizar.</p>
              </div>
              <button 
                onClick={() => setIsPaymentModalOpen(false)} 
                className="bg-slate-50 p-2 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div className="bg-emerald-50/50 p-5 rounded-3xl border border-emerald-100">
                 <div className="flex justify-between items-start mb-4">
                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Valor a Pagar</p>
                    <div className="bg-emerald-100 p-1.5 rounded-full text-emerald-600">
                       <Check size={16} />
                    </div>
                 </div>
                 <p className="text-3xl font-black text-slate-800">{formatCurrency(selectedPayment?.value)}</p>
                 <p className="text-xs text-slate-500 mt-2 font-medium">Beneficiário: <span className="text-slate-700 font-bold">{selectedPayment?.brokerName}</span></p>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 flex items-center gap-1">
                  <Upload size={12} /> Comprovante de Pagamento
                </label>
                
                {!paymentReceipt ? (
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-200 rounded-[24px] cursor-pointer hover:bg-slate-50 transition-all group">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <FileText className="text-slate-300 group-hover:text-emerald-500 transition-colors mb-2" size={32} />
                      <p className="text-xs font-bold text-slate-400">Clique para anexar comprovante</p>
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

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button 
                onClick={() => setIsPaymentModalOpen(false)}
                className="flex-1 px-4 py-3 text-slate-500 font-bold hover:text-slate-700 transition-colors text-sm"
              >
                Cancelar
              </button>
              <button 
                onClick={handleConfirmPayment}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 rounded-xl font-bold transition-all shadow-lg shadow-emerald-100 text-sm flex items-center justify-center gap-2"
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
