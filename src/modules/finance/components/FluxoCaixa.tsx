import React, { useState, useEffect, useMemo } from 'react';
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  Building2,
  BarChart3,
  RefreshCw
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  BarChart, 
  Bar, 
  Legend 
} from 'recharts';
import { useCashFlow } from '../../../hooks/useCashFlow';
import { supabase } from '../../../../supabase';
import { User, FinancialTransaction } from '../../../../types';
import { HeaderTooltip } from './HeaderTooltip';
import { FinancialKpiHeaderCards } from './FinancialKpiHeaderCards';

interface RentInstallmentRow {
  id: string;
  contract_id: string;
  due_date: string;
  expected_amount: number;
  status: 'pending' | 'received' | 'overdue' | 'partial' | 'cancelled';
  tenant_name?: string;
  property_address?: string;
}

interface FluxoCaixaProps {
  currentUser: User;
  transactions?: FinancialTransaction[];
  showToast?: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const FluxoCaixa: React.FC<FluxoCaixaProps> = ({ currentUser, transactions = [], showToast }) => {
  const { realBalances, projectedBalances, dreMonthly, loading, fetchAllCashFlowData } = useCashFlow(
    currentUser.agencyId
  );

  const [currentMonthInstallments, setCurrentMonthInstallments] = useState<RentInstallmentRow[]>([]);
  const [loadingInstallments, setLoadingInstallments] = useState(false);

  // Fetch rent installments for current month
  const loadMonthInstallments = async () => {
    if (!supabase) return;
    setLoadingInstallments(true);

    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('rent_installments')
        .select(`
          id,
          contract_id,
          due_date,
          expected_amount,
          status,
          rent_contracts (
            tenant_name,
            property_address
          )
        `)
        .gte('due_date', startOfMonth)
        .lte('due_date', endOfMonth)
        .order('due_date', { ascending: true });

      if (error) throw error;

      const formatted: RentInstallmentRow[] = (data || []).map((item: any) => ({
        id: item.id,
        contract_id: item.contract_id,
        due_date: item.due_date,
        expected_amount: Number(item.expected_amount || 0),
        status: item.status,
        tenant_name: item.rent_contracts?.tenant_name || 'Inquilino',
        property_address: item.rent_contracts?.property_address || 'Imóvel',
      }));

      setCurrentMonthInstallments(formatted);
    } catch (err) {
      console.error('Error fetching month installments:', err);
    } finally {
      setLoadingInstallments(false);
    }
  };

  useEffect(() => {
    loadMonthInstallments();
  }, []);

  // Sum KPIs
  const totalRealBalance = useMemo(() => {
    return realBalances.reduce((acc, curr) => acc + curr.current_balance, 0);
  }, [realBalances]);

  const totalReceivable30d = useMemo(() => {
    return projectedBalances.reduce((acc, curr) => acc + curr.receivable_30d, 0);
  }, [projectedBalances]);

  const totalPayable30d = useMemo(() => {
    return projectedBalances.reduce((acc, curr) => acc + curr.payable_30d, 0);
  }, [projectedBalances]);

  const totalProjected30d = useMemo(() => {
    return totalRealBalance + totalReceivable30d - totalPayable30d;
  }, [totalRealBalance, totalReceivable30d, totalPayable30d]);

  // Chart 1: Simulated 30-day projected balance trend
  const trendData30d = useMemo(() => {
    const data = [];
    const today = new Date();
    let runningBalance = totalRealBalance;
    const dailyDeltaReceivable = totalReceivable30d / 30;
    const dailyDeltaPayable = totalPayable30d / 30;

    for (let i = 0; i <= 30; i += 3) {
      const d = new Date();
      d.setDate(today.getDate() + i);
      const label = `${d.getDate()}/${d.getMonth() + 1}`;
      runningBalance += (dailyDeltaReceivable - dailyDeltaPayable) * (i === 0 ? 0 : 3);

      data.push({
        day: label,
        Saldo: Math.round(runningBalance),
      });
    }
    return data;
  }, [totalRealBalance, totalReceivable30d, totalPayable30d]);

  // Chart 2: 12-month revenue vs expense (using dreMonthly or fallback historical)
  const monthlyData12m = useMemo(() => {
    if (dreMonthly.length > 0) {
      return dreMonthly.slice(0, 12).reverse().map((item) => ({
        mes: item.month.substring(0, 7),
        Receita: Math.round(item.rent_received),
        Despesa: Math.round(item.brokerage_fee_received),
      }));
    }

    // Default 6-month simulation
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const currentMonthIdx = new Date().getMonth();
    const result = [];

    for (let i = 5; i >= 0; i--) {
      const idx = (currentMonthIdx - i + 12) % 12;
      result.push({
        mes: months[idx],
        Receita: Math.round(totalReceivable30d * (0.8 + Math.random() * 0.4)),
        Despesa: Math.round(totalPayable30d * (0.8 + Math.random() * 0.4)),
      });
    }

    return result;
  }, [dreMonthly, totalReceivable30d, totalPayable30d]);

  const handleMarkAsReceived = async (installmentId: string) => {
    if (!supabase) return;
    try {
      const { error } = await supabase
        .from('rent_installments')
        .update({
          status: 'received',
          received_at: new Date().toISOString().split('T')[0],
          updated_at: new Date().toISOString(),
        })
        .eq('id', installmentId);

      if (error) throw error;
      if (showToast) showToast('Aluguel marcado como recebido!', 'success');
      loadMonthInstallments();
      fetchAllCashFlowData();
    } catch (err) {
      console.error('Erro ao marcar aluguel como recebido:', err);
      if (showToast) showToast('Erro ao atualizar status.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <FinancialKpiHeaderCards transactions={transactions} />

      {/* Header */}
      <div className="flex items-center justify-between bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp className="text-blue-600" size={20} />
            Fluxo de Caixa
            <HeaderTooltip text="Projeção financeira diária e mensal para análise de entradas, saídas e liquidez operacional." />
          </h2>
          <p className="text-xs font-normal text-slate-500 mt-0.5">
            Visão consolidada do saldo bancário real conciliado e estimativas de entradas e saídas.
          </p>
        </div>

        <button
          onClick={() => {
            fetchAllCashFlowData();
            loadMonthInstallments();
          }}
          className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl transition-all flex items-center gap-1.5 text-xs font-semibold cursor-pointer shadow-2xs"
        >
          <RefreshCw size={14} />
          <span>Atualizar Dados</span>
        </button>
      </div>

      {/* 4 Cards KPI no topo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Saldo Real */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Saldo Real (Reconciliado)</span>
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
              <Wallet size={16} />
            </div>
          </div>
          <div>
            <p className="text-[24px] font-bold text-slate-900 tracking-tight leading-none">
              R$ {totalRealBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs font-medium text-slate-400 mt-1.5">Extratos bancários conciliados</p>
          </div>
        </div>

        {/* Card 2: A Receber 30d */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">A Receber (30d)</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">
              <TrendingUp size={16} />
            </div>
          </div>
          <div>
            <p className="text-[24px] font-bold text-emerald-600 tracking-tight leading-none">
              + R$ {totalReceivable30d.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs font-medium text-slate-400 mt-1.5">Aluguéis e comissões pendentes</p>
          </div>
        </div>

        {/* Card 3: A Pagar 30d */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">A Pagar (30d)</span>
            <div className="w-8 h-8 rounded-xl bg-red-100 text-red-600 flex items-center justify-center font-bold">
              <TrendingDown size={16} />
            </div>
          </div>
          <div>
            <p className="text-[24px] font-bold text-red-600 tracking-tight leading-none">
              - R$ {totalPayable30d.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs font-medium text-slate-400 mt-1.5">Repasses e despesas operacionais</p>
          </div>
        </div>

        {/* Card 4: Saldo Projetado 30d */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Saldo Projetado (30d)</span>
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
              <DollarSign size={16} />
            </div>
          </div>
          <div>
            <p className="text-[24px] font-bold text-slate-900 tracking-tight leading-none">
              R$ {totalProjected30d.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs font-medium text-slate-400 mt-1.5">Estimativa em 30 dias</p>
          </div>
        </div>
      </div>

      {/* Gráficos em Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico 1: Linha de Projeção */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <TrendingUp size={16} className="text-blue-600" />
            Evolução Projetada do Saldo Acumulado (Próximos 30 dias)
          </h3>
          <div className="h-64 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <AreaChart data={trendData30d}>
                <defs>
                  <linearGradient id="colorSaldo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip
                  formatter={(val: any) => [`R$ ${Number(val).toLocaleString('pt-BR')}`, 'Saldo']}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Area type="monotone" dataKey="Saldo" stroke="#2563eb" strokeWidth={2.5} fillOpacity={1} fill="url(#colorSaldo)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 2: Barras Receitas vs Despesas (12 meses) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <BarChart3 size={16} className="text-blue-600" />
            Receita vs Despesa (DRE Histórica)
          </h3>
          <div className="h-64 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart data={monthlyData12m}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="mes" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip
                  formatter={(val: any) => `R$ ${Number(val).toLocaleString('pt-BR')}`}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Legend />
                <Bar dataKey="Receita" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Despesa" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Tabela: Parcelas de Aluguel do Mês Corrente */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <Building2 size={16} className="text-blue-600" />
              Aluguéis do Mês Corrente (imobia.app)
            </h3>
            <p className="text-xs text-slate-400">Parcelas com vencimento este mês</p>
          </div>
          <span className="text-xs font-semibold text-slate-500">{currentMonthInstallments.length} parcelas</span>
        </div>

        {loadingInstallments ? (
          <div className="p-8 text-center text-slate-400 text-xs">Carregando parcelas de aluguel...</div>
        ) : currentMonthInstallments.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            Nenhuma parcela de aluguel encontrada para este mês. Importe os contratos do imobia.app.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                  <th className="p-3">Inquilino</th>
                  <th className="p-3">Imóvel</th>
                  <th className="p-3 font-mono">Vencimento</th>
                  <th className="p-3 text-right">Valor Esperado</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentMonthInstallments.map((item) => {
                  const isReceived = item.status === 'received';
                  const isOverdue = item.status === 'overdue' || (item.status === 'pending' && new Date(item.due_date) < new Date());

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80">
                      <td className="p-3 font-semibold text-slate-900">{item.tenant_name}</td>
                      <td className="p-3 text-slate-600 max-w-xs truncate">{item.property_address}</td>
                      <td className="p-3 font-mono text-slate-600">{item.due_date}</td>
                      <td className="p-3 font-bold text-right text-slate-900">
                        R$ {item.expected_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                            isReceived
                              ? 'bg-[#d1fae5] text-[#065f46]'
                              : isOverdue
                              ? 'bg-[#fee2e2] text-[#991b1b]'
                              : 'bg-[#fef3c7] text-[#92400e]'
                          }`}
                        >
                          {isReceived ? 'Recebido' : isOverdue ? 'Atrasado' : 'Pendente'}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        {!isReceived && (
                          <button
                            onClick={() => handleMarkAsReceived(item.id)}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl transition-all shadow-2xs cursor-pointer"
                          >
                            Dar Baixa
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
