
import React, { useMemo, useState } from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { 
  Filter, 
  User as UserIcon, 
  X, 
  TrendingUp, 
  Wallet, 
  CheckCircle2, 
  Clock, 
  Award 
} from 'lucide-react';
import { Sale, UserRole, User, CommissionStatus } from '../types';
import { MOCK_USERS } from '../constants';

interface DashboardProps {
  sales: Sale[];
  team: User[];
  currentUser: User;
}

const Dashboard: React.FC<DashboardProps> = ({ sales, team, currentUser }) => {
  const isAdmin = currentUser.role === UserRole.ADMIN;

  // Estados dos Filtros
  const [period, setPeriod] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedBroker, setSelectedBroker] = useState<string>('all');

  const filteredSales = useMemo(() => {
    let result = [...sales];

    // 1. Isolamento por Role
    if (!isAdmin) {
      result = result.filter(s => s.splits.some(split => split.brokerId === currentUser.id));
    }

    // 2. Filtro de Corretor (Admin)
    if (isAdmin && selectedBroker !== 'all') {
      result = result.filter(s => s.splits.some(split => split.brokerId === selectedBroker));
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
  }, [sales, period, startDate, endDate, selectedBroker, isAdmin, currentUser.id]);

  const stats = useMemo(() => {
    const totalVGV = filteredSales.reduce((acc, curr) => acc + curr.vgv, 0);
    let totalComm = 0;
    let paidComm = 0;
    let pendingComm = 0;
    let overdueComm = 0;

    filteredSales.forEach(sale => {
      sale.splits.forEach(split => {
        const isTargetBroker = isAdmin 
          ? (selectedBroker === 'all' || split.brokerId === selectedBroker)
          : split.brokerId === currentUser.id;

        if (isTargetBroker) {
          totalComm += split.calculatedValue;
          if (split.status === CommissionStatus.PAID) paidComm += split.calculatedValue;
          if (split.status === CommissionStatus.PENDING) pendingComm += split.calculatedValue;
          if (split.status === CommissionStatus.OVERDUE) overdueComm += split.calculatedValue;
        }
      });
    });

    const brokerPerfMap: Record<string, { name: string; vgv: number; commissions: number }> = {};
    filteredSales.forEach(s => {
      s.splits.forEach(split => {
        if (!brokerPerfMap[split.brokerId]) {
          brokerPerfMap[split.brokerId] = { name: split.brokerName, vgv: 0, commissions: 0 };
        }
        brokerPerfMap[split.brokerId].commissions += split.calculatedValue;
        brokerPerfMap[split.brokerId].vgv += (s.vgv * (split.percentage / 100));
      });
    });

    return {
      totalVGV,
      totalComm,
      paidComm,
      pendingComm,
      overdueComm,
      brokerPerformance: Object.values(brokerPerfMap).sort((a, b) => b.vgv - a.vgv)
    };
  }, [filteredSales, currentUser.id, isAdmin, selectedBroker]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const chartData = [
    { name: 'Jan', vgv: 400000, comm: 24000 },
    { name: 'Fev', vgv: 300000, comm: 18000 },
    { name: 'Mar', vgv: 600000, comm: 36000 },
    { name: 'Abr', vgv: 800000, comm: 48000 },
    { name: 'Mai', vgv: 500000, comm: 30000 },
    { name: 'Jun', vgv: 900000, comm: 54000 },
    { name: 'Jul', vgv: 1200000, comm: 72000 },
  ];

  const statusData = [
    { name: 'Pago', value: stats.paidComm, color: '#10b981' },
    { name: 'Pendente', value: stats.pendingComm, color: '#3b82f6' },
    { name: 'Atrasado', value: stats.overdueComm, color: '#ef4444' },
  ];

  const clearFilters = () => {
    setPeriod('all');
    setStartDate('');
    setEndDate('');
    setSelectedBroker('all');
  };

  return (
    <div className="space-y-6">
      {/* Barra de Filtros do Dashboard */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm transition-all duration-300">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-slate-700 font-semibold">
            <Filter size={18} className="text-blue-600" />
            <span>Filtros do Dashboard</span>
            {(period !== 'all' || selectedBroker !== 'all' || startDate !== '') && (
              <button 
                onClick={clearFilters}
                className="ml-2 text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded-full flex items-center gap-1 hover:bg-slate-200 transition-colors"
              >
                Limpar Filtros <X size={10} />
              </button>
            )}
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-100">
              <select 
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="bg-transparent text-sm font-medium text-slate-600 px-3 py-1.5 outline-none border-none cursor-pointer"
              >
                <option value="all">Período Total</option>
                <option value="month">Este Mês</option>
                <option value="quarter">Este Trimestre</option>
                <option value="year">Este Ano</option>
                <option value="custom">Datas Customizadas</option>
              </select>
            </div>

            {period === 'custom' && (
              <div className="flex items-center gap-3 bg-slate-50 p-1.5 px-3 rounded-xl border border-slate-100 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex items-center gap-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">De:</label>
                  <input 
                    type="date" 
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-white text-xs text-slate-600 px-2 py-1 rounded-lg border border-slate-200 outline-none focus:ring-1 focus:ring-blue-400"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Até:</label>
                  <input 
                    type="date" 
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-white text-xs text-slate-600 px-2 py-1 rounded-lg border border-slate-200 outline-none focus:ring-1 focus:ring-blue-400"
                  />
                </div>
              </div>
            )}

            {isAdmin && (
              <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-100">
                <div className="pl-3 text-slate-400">
                  <UserIcon size={14} />
                </div>
                <select 
                  value={selectedBroker}
                  onChange={(e) => setSelectedBroker(e.target.value)}
                  className="bg-transparent text-sm font-medium text-slate-600 px-3 py-1.5 outline-none border-none cursor-pointer"
                >
                  <option value="all">Todos Corretores</option>
                  {team.filter(u => u.role === UserRole.BROKER || u.role === UserRole.ADMIN).map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
            <TrendingUp size={64} className="text-blue-600" />
          </div>
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <TrendingUp size={24} />
            </div>
          </div>
          <p className="text-sm font-medium text-slate-500 mb-1">{isAdmin && selectedBroker === 'all' ? 'VGV Total da Agência' : 'VGV Gerado'}</p>
          <p className="text-2xl font-bold text-slate-800">{formatCurrency(stats.totalVGV)}</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
            <Wallet size={64} className="text-indigo-600" />
          </div>
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Wallet size={24} />
            </div>
          </div>
          <p className="text-sm font-medium text-slate-500 mb-1">{isAdmin && selectedBroker === 'all' ? 'Comissões Totais' : 'Minhas Comissões'}</p>
          <p className="text-2xl font-bold text-slate-800">{formatCurrency(stats.totalComm)}</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
            <CheckCircle2 size={64} className="text-emerald-600" />
          </div>
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <CheckCircle2 size={24} />
            </div>
          </div>
          <p className="text-sm font-medium text-slate-500 mb-1">Comissões Recebidas</p>
          <p className="text-2xl font-bold text-slate-800">{formatCurrency(stats.paidComm)}</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
            <Clock size={64} className="text-amber-600" />
          </div>
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <Clock size={24} />
            </div>
          </div>
          <p className="text-sm font-medium text-slate-500 mb-1">Pendentes / Atrasadas</p>
          <p className="text-2xl font-bold text-slate-800">{formatCurrency(stats.pendingComm + stats.overdueComm)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="font-bold text-slate-800 text-lg mb-8">Evolução de Vendas e Comissões</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorVgv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} tickFormatter={(v) => `R$${v/1000}k`} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: any) => formatCurrency(value)}
                />
                <Area type="monotone" dataKey="vgv" name="VGV" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorVgv)" />
                <Area type="monotone" dataKey="comm" name="Comissões" stroke="#6366f1" strokeWidth={2} fill="transparent" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="font-bold text-slate-800 text-lg mb-8">Distribuição de Status</h3>
          <div className="h-[250px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-slate-400 text-xs font-medium uppercase tracking-widest">Total</span>
              <span className="text-slate-800 font-bold text-lg">{formatCurrency(stats.totalComm)}</span>
            </div>
          </div>
          <div className="mt-6 space-y-3">
            {statusData.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></div>
                  <span className="text-slate-600 font-medium">{item.name}</span>
                </div>
                <span className="font-bold text-slate-800">{formatCurrency(item.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {isAdmin && stats.brokerPerformance.length > 0 && (
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2 mb-8">
            <Award className="text-blue-600" size={20} /> Performance por Corretor
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-50">
                  <th className="pb-4 pr-4">Posição</th>
                  <th className="pb-4 px-4">Corretor</th>
                  <th className="pb-4 px-4">VGV Atribuído</th>
                  <th className="pb-4 px-4 text-right">Comissões</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {stats.brokerPerformance.map((broker, idx) => (
                  <tr key={broker.name} className="group hover:bg-slate-50 transition-colors">
                    <td className="py-4 pr-4 font-bold text-slate-300">#{idx + 1}</td>
                    <td className="py-4 px-4 font-semibold text-slate-700">{broker.name}</td>
                    <td className="py-4 px-4 text-slate-600 font-medium">{formatCurrency(broker.vgv)}</td>
                    <td className="py-4 px-4 text-right font-bold text-blue-600">{formatCurrency(broker.commissions)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
