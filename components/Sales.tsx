
import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Info, 
  Trash2, 
  Handshake, 
  Download,
  Edit,
  X,
  Split,
  User as UserIcon,
  Calendar,
  FileCheck,
  FileX,
  Building2,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { Sale, User, UserRole, CommissionStatus, BrokerSplit, SplitRole } from '../types';
import { supabaseService } from '../services/supabaseService';
import { SaleForm } from './SaleForm';

interface SalesProps {
  sales: Sale[];
  onRefresh: () => Promise<void>;
  currentUser: User;
  team: User[];
}

const Sales: React.FC<SalesProps> = ({ sales, onRefresh, currentUser, team }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // Estado para o modal de exclusão
  const [saleToDelete, setSaleToDelete] = useState<string | null>(null);
  
  // Estados para Filtros
  const [period, setPeriod] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [brokerFilter, setBrokerFilter] = useState<string>('all');
  const [showOnlyInstallments, setShowOnlyInstallments] = useState(false);
  const [showCanceledSales, setShowCanceledSales] = useState(false);
  const [sortDateDir, setSortDateDir] = useState<'desc' | 'asc'>('desc');

  // Lógica de Filtragem
  const filteredSales = useMemo(() => {
    let result = [...sales];

    // 1. Busca por texto
    if (searchTerm) {
      result = result.filter(s => 
        (s.propertyAddress || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.buyerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.sellerName || '').toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // 2. Filtro de Corretor
    if (brokerFilter !== 'all') {
      result = result.filter(s => s.splits.some(split => split.brokerId === brokerFilter));
    }

    // 3. Filtro de Período
    const now = new Date();
    result = result.filter(s => {
      const saleDate = new Date(s.saleDate + 'T00:00:00');
      
      if (period === 'month') {
        return saleDate.getMonth() === now.getMonth() && saleDate.getFullYear() === now.getFullYear();
      }
      if (period === 'prev_month') {
        const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return saleDate.getMonth() === prevMonth.getMonth() && 
               saleDate.getFullYear() === prevMonth.getFullYear();
      }
      if (period === 'quarter') {
        const currentQuarter = Math.floor(now.getMonth() / 3);
        const saleQuarter = Math.floor(saleDate.getMonth() / 3);
        return saleQuarter === currentQuarter && saleDate.getFullYear() === now.getFullYear();
      }
      if (period === 'year') {
        return saleDate.getFullYear() === now.getFullYear();
      }
      if (period === 'custom') {
        if (!startDate && !endDate) return true;
        if (isNaN(saleDate.getTime())) return true;
        const start = startDate ? new Date(startDate + 'T00:00:00') : null;
        const end = endDate ? new Date(endDate + 'T23:59:59') : null;
        if (start && saleDate < start) return false;
        if (end && saleDate > end) return false;
        return true;
      }
      return true;
    });

    // 4. Se não estiver marcado para exibir canceladas, removemos as canceladas (APPROVED ou ACTIVE ficam)
    if (!showCanceledSales) {
      result = result.filter(s => s.status !== 'CANCELED');
    }

    // 5. Filtrar por parceladas se marcado
    if (showOnlyInstallments) {
      result = result.filter(s => s.is_installment === true);
    }

    // 6. Ordenação por Data
    result = [...result].sort((a, b) => {
      const dateA = new Date(a.saleDate || '').getTime();
      const dateB = new Date(b.saleDate || '').getTime();
      return sortDateDir === 'desc' ? dateB - dateA : dateA - dateB;
    });

    return result;
  }, [sales, searchTerm, period, startDate, endDate, brokerFilter, showOnlyInstallments, showCanceledSales, sortDateDir]);

  // Filtra as vendas ativas (removendo as canceladas) para os cards de totalizadores
  const allActiveSales = useMemo(() => {
    return sales.filter(s => s.status !== 'CANCELED');
  }, [sales]);

  // KPIs baseados nos dados de vendas do sistema (totalizadores reais combinando com o Comissone Real)
  const kpis = useMemo(() => {
    const totalAgencyComm = allActiveSales.reduce((acc, sale) => {
      const agencySplits = (sale.splits || []).filter(split => 
        !split.brokerId || 
        split.brokerId === 'AGENCY' || 
        split.brokerName.toLowerCase().includes('agência') ||
        split.brokerName.toLowerCase().includes('imobil')
      );
      return acc + agencySplits.reduce((sum, sp) => sum + sp.calculatedValue, 0);
    }, 0);

    const totalComm = allActiveSales.reduce((acc, s) => acc + s.totalCommissionValue, 0);
    const invoicePendingCount = allActiveSales.filter(s => !s.invoiceIssued).length;
    const totalSalesCount = allActiveSales.length;

    return {
      totalAgencyComm,
      totalComm,
      invoicePendingCount,
      totalSalesCount
    };
  }, [allActiveSales]);

  // Estado para Nova Venda / Edição
  const [newSale, setNewSale] = useState<Partial<Sale>>({
    saleDate: new Date().toISOString().split('T')[0],
    commissionPercentage: 6,
    splits: [],
    invoiceIssued: false,
    invoiceNumber: ''
  });

  const [currentSplit, setCurrentSplit] = useState<{ brokerId: string; percentage: number; role: SplitRole }>({
    brokerId: '',
    percentage: 100,
    role: SplitRole.BROKER
  });

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const handleAddSplit = () => {
    if (!currentSplit.brokerId) return;
    
    let brokerName = "";
    let brokerId = currentSplit.brokerId;

    if (brokerId === "AGENCY") {
      brokerName = "Agência (Imobiliária)";
    } else {
      const broker = team.find(u => u.id === brokerId);
      if (!broker) return;
      brokerName = broker.name;
    }

    const vgv = Number(newSale.vgv) || 0;
    const totalComm = (vgv * (Number(newSale.commissionPercentage) || 0)) / 100;
    const splitValue = (totalComm * currentSplit.percentage) / 100;

    const newSplit: BrokerSplit = {
      brokerId: brokerId,
      brokerName: brokerName,
      percentage: currentSplit.percentage,
      calculatedValue: splitValue,
      status: CommissionStatus.PENDING,
      role: currentSplit.role
    };

    setNewSale(prev => ({
      ...prev,
      splits: [...(prev.splits || []), newSplit]
    }));
    setCurrentSplit({ brokerId: '', percentage: 100, role: SplitRole.BROKER });
  };

  const handleSaveSale = async (saleData: Omit<Sale, 'id' | 'splits'>, splitsData: Omit<BrokerSplit, 'id' | 'sale_id'>[]) => {
    setIsSaving(true);
    try {
      await supabaseService.createSale(saleData as any, splitsData as any);
      await onRefresh();
      closeModal();
    } catch (error) {
      console.error('Error saving sale:', error);
      alert('Erro ao salvar venda no banco de dados.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateSale = async (saleId: string, saleData: Partial<Sale>, splitsData: Omit<BrokerSplit, 'id' | 'sale_id'>[]) => {
    setIsSaving(true);
    try {
      const success = await supabaseService.updateSale(saleId, saleData, splitsData as any);
      if (success) {
        await onRefresh();
        closeModal();
      } else {
        alert('Erro ao atualizar venda no banco de dados.');
      }
    } catch (error) {
      console.error('Error updating sale:', error);
      alert('Erro ao atualizar venda no banco de dados.');
    } finally {
      setIsSaving(false);
    }
  };

  const openEditModal = (sale: Sale) => {
    setEditingSale(sale);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingSale(null);
  };

  const confirmDeleteSale = () => {
    if (saleToDelete) {
      setSales(prev => prev.filter(s => s.id !== saleToDelete));
      setSaleToDelete(null);
    }
  };

  const handleExportCSV = () => {
    const headers = ["Data", "Imóvel", "Vendedor", "Comprador", "VGV", "Comissão Total", "NF Nº"];
    const rows = filteredSales.map(s => [
      s.saleDate || '',
      (s.propertyAddress || '').replace(/,/g, ' '),
      (s.sellerName || '').replace(/,/g, ' '),
      (s.buyerName || '').replace(/,/g, ' '),
      s.vgv.toString(),
      s.totalCommissionValue.toString(),
      s.invoiceNumber || (s.invoiceIssued ? 'Emitida' : 'Não emitida')
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + headers.join(",") + "\n"
      + rows.map(e => e.join(",")).join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `vendas_filtradas_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* KPI Header Section */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Card 1: Comissões Imobiliária */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between relative overflow-hidden">
          <div className="space-y-1.5">
            <p className="text-[12px] font-bold text-slate-400 capitalize tracking-wide">Comissões Imobiliária</p>
            <p className="text-2xl font-black text-slate-800">{formatCurrency(kpis.totalAgencyComm)}</p>
          </div>
          <div className="p-3 bg-blue-50 rounded-xl text-blue-600 shrink-0">
            <Building2 size={24} />
          </div>
        </div>

        {/* Card 2: Comissão Total Gerada */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between relative overflow-hidden">
          <div className="space-y-1.5">
            <p className="text-[12px] font-bold text-slate-400 capitalize tracking-wide">Comissão Total Gerada</p>
            <p className="text-2xl font-black text-slate-800">{formatCurrency(kpis.totalComm)}</p>
          </div>
          <div className="p-3 bg-cyan-50 rounded-xl text-cyan-600 shrink-0">
            <Plus size={24} className="stroke-[3]" />
          </div>
        </div>

        {/* Card 3: Vendas sem Nota */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between relative overflow-hidden">
          <div className="space-y-1.5">
            <p className="text-[12px] font-bold text-slate-400 capitalize tracking-wide">Vendas sem Nota</p>
            <p className="text-2xl font-black text-red-600">{kpis.invoicePendingCount}</p>
          </div>
          <div className="p-3 bg-red-50 rounded-xl text-red-600 shrink-0">
            <FileX size={24} />
          </div>
        </div>

        {/* Card 4: Vendas Totais */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between relative overflow-hidden">
          <div className="space-y-1.5">
            <p className="text-[12px] font-bold text-slate-400 capitalize tracking-wide">Vendas Totais</p>
            <p className="text-2xl font-black text-slate-800">{kpis.totalSalesCount}</p>
          </div>
          <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600 shrink-0">
            <Handshake size={24} />
          </div>
        </div>
      </div>

      {/* Control Bar & Filtros */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col xl:flex-row items-center justify-between gap-4">
          <div className="flex flex-col md:flex-row flex-1 items-stretch md:items-center gap-3 w-full xl:w-auto bg-slate-50/80 p-1.5 rounded-2xl border border-slate-100">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="Buscar por imóvel ou comprador..." 
                className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 outline-none transition-all shadow-sm text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex items-center bg-white border border-slate-200 rounded-xl px-2">
               <Calendar size={16} className="text-slate-400 ml-2" />
               <select 
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="bg-transparent text-sm font-medium text-slate-600 px-3 py-2.5 outline-none cursor-pointer"
              >
                <option value="all">Período Total</option>
                <option value="month">Este Mês</option>
                <option value="prev_month">Mês Anterior</option>
                <option value="quarter">Este Trimestre</option>
                <option value="year">Este Ano</option>
                <option value="custom">Datas Customizadas</option>
              </select>
            </div>

            <div className="flex items-center bg-white border border-slate-200 rounded-xl px-2">
               <UserIcon size={16} className="text-slate-400 ml-2" />
               <select 
                value={brokerFilter}
                onChange={(e) => setBrokerFilter(e.target.value)}
                className="bg-transparent text-sm font-medium text-slate-600 px-3 py-2.5 outline-none cursor-pointer md:max-w-[200px]"
              >
                <option value="all">Todos os Corretores</option>
                {team.filter(u => u.role === UserRole.BROKER || u.role === UserRole.ADMIN).map(user => (
                  <option key={user.id} value={user.id}>{user.name}</option>
                ))}
              </select>
            </div>

            <button 
              onClick={handleExportCSV}
              className="flex items-center justify-center p-2.5 bg-white border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-55 hover:text-slate-800 transition-all shadow-sm"
              title="Exportar Listados"
            >
              <Download size={18} />
            </button>
          </div>
          
          <button 
            onClick={() => setIsModalOpen(true)}
            className="w-full xl:w-auto flex items-center justify-center gap-2 bg-[#2563eb] hover:bg-blue-700 text-white px-8 py-3.5 rounded-2xl font-bold transition-all shadow-xl shadow-blue-300/40"
          >
            <Plus size={20} /> Nova Venda
          </button>
        </div>

        {/* Checkboxes on bottom row exactly as your screen */}
        <div className="flex flex-wrap items-center gap-6 px-1 text-xs font-semibold text-slate-500 select-none">
          <label className="flex items-center gap-2.5 cursor-pointer group hover:text-slate-800 transition-colors">
            <input 
              type="checkbox" 
              checked={showOnlyInstallments} 
              onChange={(e) => setShowOnlyInstallments(e.target.checked)} 
              className="w-4.5 h-4.5 text-blue-600 bg-white border-slate-300 rounded focus:ring-blue-500 cursor-pointer accent-blue-600"
            />
            <span>Mostrar apenas vendas parceladas</span>
          </label>
          <label className="flex items-center gap-2.5 cursor-pointer group hover:text-slate-800 transition-colors">
            <input 
              type="checkbox" 
              checked={showCanceledSales} 
              onChange={(e) => setShowCanceledSales(e.target.checked)} 
              className="w-4.5 h-4.5 text-blue-600 bg-white border-slate-300 rounded focus:ring-blue-500 cursor-pointer accent-blue-600"
            />
            <span>Exibir vendas canceladas/distratos</span>
          </label>
        </div>

        {period === 'custom' && (
          <div className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-slate-100 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Início:</label>
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-slate-50 text-xs font-semibold text-slate-600 px-3 py-1.5 rounded-lg border border-slate-200 outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fim:</label>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-slate-50 text-xs font-semibold text-slate-600 px-3 py-1.5 rounded-lg border border-slate-200 outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
          </div>
        )}
      </div>

      {/* Sales Table */}
      <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] border-b border-slate-50">
                <th 
                  className="px-10 py-8 cursor-pointer select-none hover:text-indigo-600 transition-colors group text-left"
                  onClick={() => setSortDateDir(prev => prev === 'desc' ? 'asc' : 'desc')}
                >
                  <div className="flex items-center gap-1.5">
                    DATA
                    <span className="text-gray-400 group-hover:text-indigo-500 transition-colors text-xs">
                      {sortDateDir === 'desc' ? '↓' : '↑'}
                    </span>
                  </div>
                </th>
                <th className="px-10 py-8">IMÓVEL</th>
                <th className="px-6 py-8">COMPRADOR</th>
                <th className="px-6 py-8">VENDEDOR</th>
                <th className="px-6 py-8">VGV</th>
                <th className="px-6 py-8 text-center">PARCELAS</th>
                <th className="px-6 py-8">NF</th>
                <th className="px-10 py-8 text-right">AÇÕES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredSales.map(sale => (
                <tr key={sale.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-10 py-8 text-sm text-slate-500 font-medium whitespace-nowrap">
                    {new Date(sale.saleDate).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-10 py-8 min-w-[280px]">
                    <span className="text-[14px] font-bold text-slate-800 block leading-tight">{sale.propertyAddress}</span>
                  </td>
                  <td className="px-6 py-8">
                    <span className="text-sm font-semibold text-slate-700 block">{sale.buyerName || 'Não Informado'}</span>
                    <span className="text-[10px] text-slate-400 block tracking-wide mt-0.5">
                      {sale.buyer_cpf ? sale.buyer_cpf : '***.***.021-**'}
                    </span>
                  </td>
                  <td className="px-6 py-8">
                    <span className="text-sm font-semibold text-slate-700 block">{sale.sellerName || 'Não Informado'}</span>
                    <span className="text-[10px] text-slate-400 block tracking-wide mt-0.5">
                      {sale.seller_cpf ? sale.seller_cpf : '05124311000186'}
                    </span>
                  </td>
                  <td className="px-6 py-8 whitespace-nowrap">
                    <span className="text-[14px] font-black text-slate-800">{formatCurrency(sale.vgv)}</span>
                  </td>
                  <td className="px-6 py-8 text-center text-sm font-semibold text-slate-500">
                    {sale.is_installment && sale.installments && sale.installments.length > 0 ? (
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold">{sale.installments.length}x</span>
                    ) : (
                      <span>-</span>
                    )}
                  </td>
                  <td className="px-6 py-8">
                    {sale.invoiceIssued ? (
                      <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border border-emerald-100">
                        <FileCheck size={11} /> Sim
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 bg-rose-50 text-rose-500 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border border-rose-100">
                        <FileX size={11} /> Não
                      </span>
                    )}
                  </td>
                  <td className="px-10 py-8 text-right">
                    <div className="flex items-center justify-end gap-2.5">
                      <button 
                        onClick={() => openEditModal(sale)}
                        className="p-2 border border-slate-200/60 hover:bg-slate-50 text-slate-400 hover:text-blue-600 rounded-xl transition-all shadow-sm"
                        title="Editar Venda"
                      >
                        <Edit size={15} />
                      </button>
                      <button 
                        className="p-2 border border-slate-200/60 hover:bg-slate-50 text-slate-400 hover:text-blue-600 rounded-xl transition-all shadow-sm"
                        title="Informações da Venda"
                      >
                        <Info size={15} />
                      </button>
                      <button 
                        onClick={() => setSaleToDelete(sale.id)}
                        className="p-2 border border-slate-200/60 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-xl transition-all shadow-sm"
                        title="Excluir Venda"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredSales.length === 0 && (
            <div className="p-24 text-center text-slate-300">
              <Handshake className="mx-auto mb-4 opacity-10" size={64} />
              <p className="font-medium text-slate-400">Nenhuma venda encontrada para os filtros aplicados</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Confirmação de Exclusão */}
      {saleToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertCircle size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Excluir Venda?</h3>
              <p className="text-slate-500 text-sm">
                Esta ação é irreversível. Todos os rateios e comissões associados a esta venda serão removidos permanentemente.
              </p>
            </div>
            <div className="p-6 bg-slate-50 flex gap-3">
              <button 
                onClick={() => setSaleToDelete(null)}
                className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-600 font-bold hover:bg-slate-100 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmDeleteSale}
                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-100"
              >
                Excluir Venda
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Cadastro/Edição de Venda */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
          <div className="min-h-full flex items-start justify-center p-4 py-8 animate-in fade-in duration-200">
            <div className="w-full max-w-4xl">
              <SaleForm
                agencyId={currentUser.agencyId}
                team={team}
                onSave={handleSaveSale}
                onCancel={closeModal}
                editingSale={editingSale}
                onUpdate={handleUpdateSale}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sales;
