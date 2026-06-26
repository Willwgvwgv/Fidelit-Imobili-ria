
import React, { useMemo, useState } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line,
  Legend,
  Cell
} from 'recharts';
import { 
  FileDown, 
  Calendar, 
  TrendingUp, 
  Users, 
  Target, 
  ArrowUpRight, 
  ArrowDownRight,
  Filter,
  BarChart3,
  Award,
  PieChart as PieChartIcon
} from 'lucide-react';
import { Sale, User, UserRole, CommissionStatus } from '../types';

interface ReportsProps {
  sales: Sale[];
  team: User[];
  currentUser: User;
}

const Reports: React.FC<ReportsProps> = ({ sales, team, currentUser }) => {
  const [period, setPeriod] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedBroker, setSelectedBroker] = useState<string>('all');
  const isAdmin = currentUser.role === UserRole.ADMIN;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  // 1. Filtragem de dados para o relatório
  const filteredData = useMemo(() => {
    let result = [...sales];
    const now = new Date();

    if (period === 'month') {
      result = result.filter(s => {
        const d = new Date(s.saleDate + 'T00:00:00');
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      });
    } else if (period === 'quarter') {
      const currentQuarter = Math.floor(now.getMonth() / 3);
      result = result.filter(s => {
        const d = new Date(s.saleDate + 'T00:00:00');
        return Math.floor(d.getMonth() / 3) === currentQuarter && d.getFullYear() === now.getFullYear();
      });
    } else if (period === 'year') {
      result = result.filter(s => {
        const d = new Date(s.saleDate + 'T00:00:00');
        return d.getFullYear() === now.getFullYear();
      });
    } else if (period === 'custom') {
      const start = startDate ? new Date(startDate + 'T00:00:00') : null;
      const end = endDate ? new Date(endDate + 'T23:59:59') : null;
      result = result.filter(s => {
        const d = new Date(s.saleDate + 'T00:00:00');
        if (isNaN(d.getTime())) return true;
        if (start && d < start) return false;
        if (end && d > end) return false;
        return true;
      });
    }

    if (selectedBroker !== 'all') {
      result = result.filter(s => s.splits.some(sp => sp.brokerId === selectedBroker));
    }

    return result;
  }, [sales, period, selectedBroker, startDate, endDate]);

  // 2. Agregação por Corretor
  const brokerPerformance = useMemo(() => {
    const map: Record<string, { name: string; vgv: number; comm: number; salesCount: number }> = {};

    // Inicializar com todos que têm brokerId nos splits das vendas filtradas
    // Isso inclui BROKER, ADMIN e qualquer participante com nome
    filteredData.forEach(sale => {
      sale.splits.forEach(split => {
        const id = split.brokerId || split.brokerName;
        if (!id) return;
        if (!map[id]) {
          map[id] = {
            name: split.brokerName,
            vgv: 0,
            comm: 0,
            salesCount: 0,
          };
        }
      });
    });

    // Agregar VGV total da venda (não proporcional) e comissão real do split
    // salesCount = vendas únicas (deduplicado por saleId)
    filteredData.forEach(sale => {
      const seenBrokers = new Set<string>();
      sale.splits.forEach(split => {
        const id = split.brokerId || split.brokerName;
        if (!id || !map[id]) return;

        // Comissão: soma o valor calculado do split
        map[id].comm += split.calculatedValue || 0;

        // VGV: conta o VGV total da venda uma vez por corretor
        if (!seenBrokers.has(id)) {
          map[id].vgv += sale.vgv || 0;
          map[id].salesCount += 1;
          seenBrokers.add(id);
        }
      });
    });

    return Object.values(map).sort((a, b) => b.vgv - a.vgv);
  }, [filteredData]);

  // 3. Agregação Mensal real por mês/ano
  const monthlyTrend = useMemo(() => {
    const map: Record<string, { name: string; sortKey: string; vgv: number; comm: number }> = {};

    filteredData.forEach(sale => {
      const d = new Date(sale.saleDate + 'T00:00:00');
      if (isNaN(d.getTime())) return;
      const year = d.getFullYear();
      const month = d.getMonth();
      const key = `${year}-${String(month + 1).padStart(2, '0')}`;
      const label = d.toLocaleString('pt-BR', { month: 'short', year: '2-digit' });
      if (!map[key]) map[key] = { name: label, sortKey: key, vgv: 0, comm: 0 };
      map[key].vgv += sale.vgv || 0;
      map[key].comm += sale.totalCommissionValue || 0;
    });

    return Object.values(map).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }, [filteredData]);

  const conversionRate = useMemo(() => {
    const allSplits = filteredData.flatMap(s => s.splits);
    if (!allSplits.length) return 0;
    const paid = allSplits.filter(sp => sp.status === CommissionStatus.PAID).length;
    return Math.round((paid / allSplits.length) * 100);
  }, [filteredData]);

  const ticketComparison = useMemo(() => {
    const now = new Date();
    const thisMonth = filteredData.filter(s => {
      const d = new Date(s.saleDate + 'T00:00:00');
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const prevMonth = filteredData.filter(s => {
      const d = new Date(s.saleDate + 'T00:00:00');
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return d.getMonth() === prev.getMonth() && d.getFullYear() === prev.getFullYear();
    });
    const avgThis = thisMonth.length ? thisMonth.reduce((a, s) => a + s.vgv, 0) / thisMonth.length : 0;
    const avgPrev = prevMonth.length ? prevMonth.reduce((a, s) => a + s.vgv, 0) / prevMonth.length : 0;
    if (!avgPrev) return null;
    const pct = Math.round(((avgThis - avgPrev) / avgPrev) * 100);
    return pct;
  }, [filteredData]);

  const handleExportPDF = () => {
    window.print();
  };

  const getActiveFilterLabel = () => {
    if (period === 'all') return 'Período Total';
    if (period === 'month') return 'Este Mês';
    if (period === 'quarter') return 'Este Trimestre';
    if (period === 'year') return 'Este Ano';
    if (period === 'custom') return `De ${startDate || '...'} até ${endDate || '...'}`;
    return period;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header & Main Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Relatórios de Performance</h2>
          <p className="text-slate-400 text-sm font-medium">Análise detalhada de VGV, Comissões e Produtividade.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all shadow-sm no-print"
          >
            <FileDown size={18} /> Exportar PDF
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-wrap items-center gap-4 no-print">
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-2xl border border-slate-100">
          <Calendar size={16} className="text-slate-400" />
          <select 
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="bg-transparent text-sm font-bold text-slate-600 outline-none cursor-pointer"
          >
            <option value="all">Todo o Período</option>
            <option value="month">Este Mês</option>
            <option value="quarter">Este Trimestre</option>
            <option value="year">Este Ano</option>
            <option value="custom">Datas Customizadas</option>
          </select>
        </div>

        {period === 'custom' && (
          <div className="flex items-center gap-3 bg-slate-50 p-1.5 px-3 rounded-2xl border border-slate-100 animate-in fade-in slide-in-from-left-2 duration-300">
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">De:</label>
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-white text-xs font-bold text-slate-600 px-2 py-1 rounded-lg border border-slate-200 outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Até:</label>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-white text-xs font-bold text-slate-600 px-2 py-1 rounded-lg border border-slate-200 outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
          </div>
        )}

        {isAdmin && (
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-2xl border border-slate-100">
            <Users size={16} className="text-slate-400" />
            <select 
              value={selectedBroker}
              onChange={(e) => setSelectedBroker(e.target.value)}
              className="bg-transparent text-sm font-bold text-slate-600 outline-none cursor-pointer"
            >
              <option value="all">Todos os Corretores</option>
              {team.filter(u => u.role === UserRole.BROKER).map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="ml-auto flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 tracking-widest">
          <Filter size={12} />
          Filtros Ativos: {period === 'all' ? 'Sempre' : period === 'custom' ? 'Range' : period}
        </div>
      </div>

      {/* Header visível apenas na impressão para dar contexto ao PDF */}
      <div className="hidden print:block border-b-2 border-slate-100 pb-4 mb-6">
        <h1 className="text-2xl font-black text-slate-800">ComissOne - Relatório de Performance</h1>
        <div className="flex gap-4 mt-2 text-sm text-slate-500 font-bold uppercase tracking-wider">
           <span>Período: {getActiveFilterLabel()}</span>
           <span>Corretor: {selectedBroker === 'all' ? 'Todos' : team.find(t => t.id === selectedBroker)?.name}</span>
        </div>
      </div>

      {/* KPI Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex items-center gap-5 group hover:border-blue-200 transition-colors">
          <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all">
            <Target size={28} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Ticket Médio</p>
            <p className="text-xl font-black text-slate-800">
              {formatCurrency(filteredData.length ? filteredData.reduce((acc, s) => acc + s.vgv, 0) / filteredData.length : 0)}
            </p>
            {ticketComparison !== null && (
              <p className={`text-[10px] font-bold flex items-center gap-1 mt-1 ${ticketComparison >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                {ticketComparison >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                {ticketComparison >= 0 ? '+' : ''}{ticketComparison}% vs mês ant.
              </p>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex items-center gap-5 group hover:border-indigo-200 transition-colors">
          <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all">
            <TrendingUp size={28} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Conversão de Recebimento</p>
            <p className="text-xl font-black text-slate-800">{conversionRate}%</p>
            <p className="text-[10px] text-slate-400 font-bold flex items-center gap-1 mt-1">
              Meta da Agência: 95%
            </p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex items-center gap-5 group hover:border-emerald-200 transition-colors">
          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-all">
            <Award size={28} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Top Performer</p>
            <p className="text-xl font-black text-slate-800">{brokerPerformance[0]?.name || '---'}</p>
            <p className="text-[10px] text-emerald-500 font-bold flex items-center gap-1 mt-1 uppercase tracking-wider">
              Líder em VGV no período
            </p>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Performance por Corretor Bar Chart */}
        <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-10">
            <h3 className="font-black text-slate-800 flex items-center gap-2">
              <BarChart3 className="text-blue-600" size={20} /> VGV por Corretor
            </h3>
            <span className="text-[10px] bg-slate-100 text-slate-500 px-3 py-1 rounded-full font-black uppercase tracking-widest no-print">Top 5</span>
          </div>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={brokerPerformance.slice(0, 5)} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 12, fontWeight: 700 }}
                  width={100}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: any) => formatCurrency(value)}
                />
                <Bar dataKey="vgv" radius={[0, 10, 10, 0]} barSize={32}>
                  {brokerPerformance.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? '#2563eb' : '#94a3b8'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Evolução Line Chart */}
        <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-10">
            <h3 className="font-black text-slate-800 flex items-center gap-2">
              <TrendingUp className="text-indigo-600" size={20} /> Evolução de Comissões
            </h3>
          </div>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 700 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={(v) => `R$${v/1000}k`} />
                <Tooltip 
                  contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: any) => formatCurrency(value)}
                />
                <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px' }} />
                <Line type="monotone" dataKey="comm" name="Comissão Total" stroke="#6366f1" strokeWidth={4} dot={{ r: 6, fill: '#6366f1', strokeWidth: 3, stroke: '#fff' }} activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Performance List Table */}
      <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden break-inside-avoid">
        <div className="p-8 border-b border-slate-50 flex items-center justify-between">
          <h3 className="font-black text-slate-800 flex items-center gap-2 uppercase tracking-widest text-xs">
            Detalhamento por Corretor
          </h3>
          <div className="flex gap-1 no-print">
             <div className="w-2 h-2 rounded-full bg-blue-500"></div>
             <div className="w-2 h-2 rounded-full bg-slate-200"></div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                <th className="px-8 py-5">Corretor</th>
                <th className="px-8 py-5">Vendas</th>
                <th className="px-8 py-5">VGV Total</th>
                <th className="px-8 py-5">Comissão Gerada</th>
                <th className="px-8 py-5 text-right">Eficiência</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {brokerPerformance.map((broker, idx) => (
                <tr key={broker.name} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${idx === 0 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                        {idx + 1}
                      </div>
                      <span className="font-bold text-slate-800">{broker.name}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-sm font-bold text-slate-500">{broker.salesCount} vendas</td>
                  <td className="px-8 py-6 text-sm font-black text-slate-800">{formatCurrency(broker.vgv)}</td>
                  <td className="px-8 py-6">
                    <span className="text-sm font-bold text-blue-600">{formatCurrency(broker.comm)}</span>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                       <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden no-print">
                          <div 
                            className={`h-full rounded-full transition-all duration-1000 ${idx === 0 ? 'bg-blue-600' : 'bg-slate-300'}`} 
                            style={{ width: `${Math.min((broker.vgv / (brokerPerformance[0]?.vgv || 1)) * 100, 100)}%` }}
                          />
                       </div>
                       <span className="text-[10px] font-black text-slate-400">
                          {Math.round((broker.vgv / (brokerPerformance[0]?.vgv || 1)) * 100)}%
                       </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Reports;
