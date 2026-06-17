
import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Info, 
  Trash2, 
  ShoppingCart, 
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

  // Lógica de Filtragem
  const filteredSales = useMemo(() => {
    let result = [...sales];

    // 1. Busca por texto
    if (searchTerm) {
      result = result.filter(s => 
        s.propertyAddress.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.buyerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.sellerName.toLowerCase().includes(searchTerm.toLowerCase())
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

    return result;
  }, [sales, searchTerm, period, startDate, endDate, brokerFilter]);

  // Filtra as vendas ativas (removendo as canceladas) para os cards de totalizadores
  const allActiveSales = useMemo(() => {
    return sales.filter(s => s.status !== 'CANCELED');
  }, [sales]);

  // KPIs baseados nos dados de vendas ativas (totalizadores) e dados filtrados (contagem)
  const kpis = useMemo(() => {
    const totalVGV = allActiveSales.reduce((acc, s) => acc + s.vgv, 0);
    const totalComm = allActiveSales.reduce((acc, s) => acc + s.totalCommissionValue, 0);
    const avgTicket = allActiveSales.length > 0 ? totalVGV / allActiveSales.length : 0;
    
    return { totalVGV, totalComm, avgTicket, count: filteredSales.length };
  }, [allActiveSales, filteredSales]);

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

  const handleSaveSale = async () => {
    if (!newSale.propertyAddress || !newSale.vgv) {
      alert("Por favor, preencha o endereço e o valor da venda.");
      return;
    }

    const vgv = Number(newSale.vgv) || 0;
    const commPerc = Number(newSale.commissionPercentage) || 0;
    const totalComm = (vgv * commPerc) / 100;

    setIsSaving(true);
    try {
      if (editingSale) {
        // Implementation for editing can be added if needed, focusing on creation for now 
        // as per supabaseService logic
        alert("Edição via Supabase ainda não implementada. Focando na criação de novas vendas.");
      } else {
        const saleToAdd: Omit<Sale, 'id' | 'splits'> = {
          agencyId: currentUser.agencyId,
          saleDate: newSale.saleDate || '',
          propertyAddress: newSale.propertyAddress || '',
          buyerName: newSale.buyerName || 'Não informado',
          sellerName: newSale.sellerName || 'Não informado',
          vgv,
          commissionPercentage: commPerc,
          totalCommissionValue: totalComm,
          invoiceIssued: newSale.invoiceIssued || false,
          invoiceNumber: newSale.invoiceNumber || '',
          notes: newSale.notes,
          status: 'ACTIVE'
        };
        
        await supabaseService.createSale(saleToAdd, (newSale.splits || []) as any);
      }
      await onRefresh();
      closeModal();
    } catch (error) {
      console.error('Error saving sale:', error);
      alert('Erro ao salvar venda no banco de dados.');
    } finally {
      setIsSaving(false);
    }
  };

  const openEditModal = (sale: Sale) => {
    setEditingSale(sale);
    setNewSale(sale);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingSale(null);
    setNewSale({ saleDate: new Date().toISOString().split('T')[0], commissionPercentage: 6, splits: [], invoiceIssued: false, invoiceNumber: '' });
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
      s.saleDate,
      s.propertyAddress.replace(/,/g, ' '),
      s.sellerName.replace(/,/g, ' '),
      s.buyerName.replace(/,/g, ' '),
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">VGV TOTAL</p>
          <p className="text-xl font-bold text-slate-800">{formatCurrency(kpis.totalVGV)}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">COMISSÃO GERADA</p>
          <p className="text-xl font-bold text-blue-600">{formatCurrency(kpis.totalComm)}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">TICKET MÉDIO</p>
          <p className="text-xl font-bold text-slate-800">{formatCurrency(kpis.avgTicket)}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">VENDAS TOTAIS</p>
          <p className="text-xl font-bold text-slate-800">{kpis.count}</p>
        </div>
      </div>

      {/* Control Bar & Filtros */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-1 items-center gap-3 w-full sm:w-auto bg-slate-50/80 p-1.5 rounded-2xl border border-slate-100">
            <div className="relative flex-1 max-lg">
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
                className="bg-transparent text-sm font-medium text-slate-600 px-3 py-2.5 outline-none cursor-pointer max-w-[150px]"
              >
                <option value="all">Todos os Corretores</option>
                {team.filter(u => u.role === UserRole.BROKER || u.role === UserRole.ADMIN).map(user => (
                  <option key={user.id} value={user.id}>{user.name}</option>
                ))}
              </select>
            </div>

            <button 
              onClick={handleExportCSV}
              className="flex items-center justify-center p-2.5 bg-white border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-all shadow-sm"
              title="Exportar Listados"
            >
              <Download size={18} />
            </button>
          </div>
          
          <button 
            onClick={() => setIsModalOpen(true)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-10 py-3.5 rounded-2xl font-bold transition-all shadow-xl shadow-blue-300/50"
          >
            <Plus size={20} /> Nova Venda
          </button>
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
                <th className="px-10 py-8">DATA</th>
                <th className="px-10 py-8">IMÓVEL</th>
                <th className="px-6 py-8">COMPRADOR</th>
                <th className="px-6 py-8">VENDEDOR</th>
                <th className="px-6 py-8">VGV</th>
                <th className="px-6 py-8">NF</th>
                <th className="px-10 py-8 text-right">AÇÕES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredSales.map(sale => (
                <tr key={sale.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-10 py-8 text-sm text-slate-500 font-medium">
                    {new Date(sale.saleDate).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-10 py-8">
                    <span className="text-[14px] font-bold text-slate-800 block leading-tight">{sale.propertyAddress}</span>
                  </td>
                  <td className="px-6 py-8">
                    <span className="text-sm font-medium text-slate-600">{sale.buyerName}</span>
                  </td>
                  <td className="px-6 py-8">
                    <span className="text-sm font-medium text-slate-600">{sale.sellerName}</span>
                  </td>
                  <td className="px-6 py-8">
                    <span className="text-[14px] font-bold text-slate-800">{formatCurrency(sale.vgv)}</span>
                  </td>
                  <td className="px-6 py-8">
                    {sale.invoiceIssued ? (
                      <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border border-emerald-100">
                        <FileCheck size={12} /> Sim
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 bg-slate-50 text-slate-400 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border border-slate-100">
                        <FileX size={12} /> Não
                      </span>
                    )}
                  </td>
                  <td className="px-10 py-8 text-right flex items-center justify-end gap-3">
                    <button 
                      onClick={() => openEditModal(sale)}
                      className="p-2 text-slate-300 hover:text-blue-500 transition-colors"
                      title="Editar Venda"
                    >
                      <Edit size={20} />
                    </button>
                    <button 
                      onClick={() => setSaleToDelete(sale.id)}
                      className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                      title="Excluir Venda"
                    >
                      <Trash2 size={20} />
                    </button>
                    <button className="p-2 text-slate-300 hover:text-blue-500 transition-colors">
                      <Info size={22} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredSales.length === 0 && (
            <div className="p-24 text-center text-slate-300">
              <ShoppingCart className="mx-auto mb-4 opacity-10" size={64} />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-4xl rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[95vh] animate-in zoom-in duration-200">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <h3 className="text-2xl font-black text-slate-800">{editingSale ? 'Editar Venda' : 'Nova Venda'}</h3>
                <p className="text-sm text-slate-400 font-medium">Cadastre os detalhes do imóvel e o rateio de comissões.</p>
              </div>
              <button onClick={closeModal} className="bg-slate-50 p-2 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-10">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                <div className="space-y-8">
                  <div className="space-y-4">
                    <h4 className="text-xs font-black uppercase text-blue-600 tracking-widest">Informações Básicas</h4>
                    
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Imóvel (Endereço / Unidade)</label>
                      <input 
                        type="text" 
                        value={newSale.propertyAddress || ''}
                        placeholder="Ex: Av. Paulista, 1000 - Apto 42"
                        className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-100 outline-none text-sm font-semibold"
                        onChange={e => setNewSale({...newSale, propertyAddress: e.target.value})}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">VGV (Valor de Venda)</label>
                        <input 
                          type="number" 
                          value={newSale.vgv || ''}
                          placeholder="R$ 0,00"
                          className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-100 outline-none text-sm font-bold"
                          onChange={e => setNewSale({...newSale, vgv: Number(e.target.value)})}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">% Comissão</label>
                        <input 
                          type="number" 
                          value={newSale.commissionPercentage || 6}
                          className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-100 outline-none text-sm font-bold"
                          onChange={e => setNewSale({...newSale, commissionPercentage: Number(e.target.value)})}
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Data da Venda</label>
                      <input 
                        type="date" 
                        value={newSale.saleDate}
                        className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-100 outline-none text-sm font-semibold text-slate-600"
                        onChange={e => setNewSale({...newSale, saleDate: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-xs font-black uppercase text-blue-600 tracking-widest">Participantes</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <input type="text" value={newSale.buyerName || ''} placeholder="Nome do Comprador" className="w-full px-5 py-3 bg-slate-50 border-none rounded-2xl text-sm" onChange={e => setNewSale({...newSale, buyerName: e.target.value})} />
                      <input type="text" value={newSale.sellerName || ''} placeholder="Nome do Vendedor" className="w-full px-5 py-3 bg-slate-50 border-none rounded-2xl text-sm" onChange={e => setNewSale({...newSale, sellerName: e.target.value})} />
                    </div>
                  </div>

                  <div className="flex flex-col gap-4 p-5 bg-blue-50/30 rounded-[32px] border border-blue-50">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-7 rounded-full relative transition-colors cursor-pointer ${newSale.invoiceIssued ? 'bg-blue-600' : 'bg-slate-200'}`} onClick={() => setNewSale({...newSale, invoiceIssued: !newSale.invoiceIssued})}>
                        <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all shadow-sm ${newSale.invoiceIssued ? 'left-6' : 'left-1'}`} />
                      </div>
                      <span className="text-sm font-bold text-slate-600">NF já emitida?</span>
                    </div>
                    
                    {newSale.invoiceIssued && (
                      <div className="animate-in fade-in slide-in-from-top-2 duration-300 w-full">
                        <input 
                          type="text" 
                          value={newSale.invoiceNumber || ''}
                          placeholder="Digite o número da Nota Fiscal..."
                          className="w-full px-5 py-3 bg-white border border-blue-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-200 text-sm font-semibold shadow-sm"
                          onChange={e => setNewSale({...newSale, invoiceNumber: e.target.value})}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-slate-50/50 p-8 rounded-[32px] border border-slate-100 space-y-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Split className="text-blue-500" size={20} />
                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest">Rateio de Comissão</h4>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <select 
                        className="flex-1 px-4 py-3 bg-white border border-slate-100 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-100"
                        value={currentSplit.brokerId}
                        onChange={e => setCurrentSplit({...currentSplit, brokerId: e.target.value})}
                      >
                        <option value="">Selecionar Beneficiário</option>
                        <option value="AGENCY" className="font-bold text-blue-600">Agência (Imobiliária)</option>
                        <hr />
                        {team.map(u => (
                          <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                        ))}
                      </select>
                      <select 
                        className="w-32 px-4 py-3 bg-white border border-slate-100 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-100"
                        value={currentSplit.role}
                        onChange={e => setCurrentSplit({...currentSplit, role: e.target.value as SplitRole})}
                      >
                        {Object.entries(SplitRole).map(([key, value]) => (
                          <option key={key} value={value}>{value}</option>
                        ))}
                      </select>
                      <input 
                        type="number" 
                        className="w-20 px-4 py-3 bg-white border border-slate-100 rounded-xl text-xs font-bold text-center outline-none focus:ring-2 focus:ring-blue-100"
                        value={currentSplit.percentage}
                        onChange={e => setCurrentSplit({...currentSplit, percentage: Number(e.target.value)})}
                        placeholder="%"
                      />
                      <button 
                        onClick={handleAddSplit}
                        className="bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100"
                      >
                        <Plus size={20} />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2">
                    {(newSale.splits || []).map((split, idx) => (
                      <div key={idx} className="bg-white p-4 rounded-2xl flex items-center justify-between border border-slate-100 animate-in slide-in-from-bottom-2 duration-300">
                        <div className="flex items-center gap-3">
                          {split.brokerId === 'AGENCY' ? (
                             <Building2 className="text-blue-500" size={16} />
                          ) : (
                             <UserIcon className="text-slate-400" size={16} />
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-black text-slate-800">{split.brokerName}</p>
                              {split.role && (
                                <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase font-bold tracking-tighter">
                                  {split.role}
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-blue-600 font-bold uppercase">{split.percentage}% — {formatCurrency(split.calculatedValue)}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => setNewSale({...newSale, splits: newSale.splits?.filter((_, i) => i !== idx)})}
                          className="text-slate-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="pt-6 border-t border-slate-100 space-y-2">
                     <div className="flex justify-between text-[10px] font-black uppercase text-slate-400">
                        <span>Soma do Rateio</span>
                        <span className={(newSale.splits?.reduce((a,b)=>a+b.percentage, 0) || 0) === 100 ? 'text-emerald-500' : 'text-amber-500'}>
                          {(newSale.splits?.reduce((a,b)=>a+b.percentage, 0) || 0)}%
                        </span>
                     </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-8 border-t border-slate-50 bg-slate-50/50 flex justify-end gap-4 sticky bottom-0 z-10">
              <button 
                onClick={closeModal}
                className="px-8 py-3 text-slate-400 font-bold hover:text-slate-600 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveSale}
                disabled={isSaving}
                className="bg-blue-600 hover:bg-blue-700 text-white px-12 py-3 rounded-2xl font-black transition-all shadow-xl shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSaving && <Loader2 className="animate-spin" size={20} />}
                {editingSale ? 'Salvar Alterações' : 'Salvar Venda'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sales;
