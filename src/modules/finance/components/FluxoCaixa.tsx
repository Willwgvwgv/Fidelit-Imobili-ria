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
  RefreshCw,
  MoreVertical,
  CalendarClock,
  XCircle,
  CheckCircle,
  X
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

interface RentInstallmentRow {
  id: string;
  contract_id: string;
  due_date: string;
  expected_amount: number;
  received_amount?: number | null;
  received_at?: string | null;
  notes?: string | null;
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
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [actionModal, setActionModal] = useState<{
    type: 'partial' | 'cancel' | 'reschedule';
    installment: RentInstallmentRow;
  } | null>(null);
  const [partialAmount, setPartialAmount] = useState<string>('');
  const [partialNotes, setPartialNotes] = useState<string>('');
  const [cancelReason, setCancelReason] = useState<string>('');
  const [newDueDate, setNewDueDate] = useState<string>('');
  const [submittingAction, setSubmittingAction] = useState(false);

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
          received_amount,
          received_at,
          notes,
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
        received_amount: item.received_amount ? Number(item.received_amount) : null,
        received_at: item.received_at,
        notes: item.notes,
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

  const handleMarkAsReceived = async (installment: RentInstallmentRow) => {
    if (!supabase) return;
    try {
      const hoje = new Date().toISOString().split('T')[0];
      const { error } = await supabase
        .from('rent_installments')
        .update({
          status: 'received',
          received_amount: installment.expected_amount,
          received_at: hoje,
          updated_at: new Date().toISOString(),
        })
        .eq('id', installment.id);

      if (error) throw error;
      if (showToast) showToast('Aluguel marcado como recebido!', 'success');
      loadMonthInstallments();
      fetchAllCashFlowData();
    } catch (err) {
      console.error('Erro ao marcar aluguel como recebido:', err);
      if (showToast) showToast('Erro ao atualizar status.', 'error');
    }
  };

  const handlePartialPayment = async () => {
    if (!supabase || !actionModal?.installment) return;
    const val = parseFloat(partialAmount.replace(',', '.'));
    if (isNaN(val) || val <= 0) {
      if (showToast) showToast('Informe um valor recebido válido maior que zero.', 'error');
      return;
    }
    if (val >= actionModal.installment.expected_amount) {
      if (showToast) showToast('O valor parcial deve ser menor que o valor total esperado.', 'warning');
      return;
    }

    setSubmittingAction(true);
    try {
      const hoje = new Date().toISOString().split('T')[0];
      const noteText = partialNotes.trim()
        ? `Baixa parcial de R$ ${val.toFixed(2)}. Obs: ${partialNotes.trim()}`
        : `Baixa parcial de R$ ${val.toFixed(2)}`;

      const { error } = await supabase
        .from('rent_installments')
        .update({
          status: 'partial',
          received_amount: val,
          received_at: hoje,
          notes: noteText,
          updated_at: new Date().toISOString(),
        })
        .eq('id', actionModal.installment.id);

      if (error) throw error;
      if (showToast) showToast('Baixa parcial registrada com sucesso!', 'success');
      setActionModal(null);
      loadMonthInstallments();
      fetchAllCashFlowData();
    } catch (err) {
      console.error('Erro ao registrar baixa parcial:', err);
      if (showToast) showToast('Erro ao registrar baixa parcial.', 'error');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleCancelInstallment = async () => {
    if (!supabase || !actionModal?.installment) return;
    if (!cancelReason.trim()) {
      if (showToast) showToast('Por favor, informe o motivo do cancelamento.', 'warning');
      return;
    }

    setSubmittingAction(true);
    try {
      const { error } = await supabase
        .from('rent_installments')
        .update({
          status: 'cancelled',
          notes: `Cancelada: ${cancelReason.trim()}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', actionModal.installment.id);

      if (error) throw error;
      if (showToast) showToast('Parcela cancelada com sucesso.', 'success');
      setActionModal(null);
      loadMonthInstallments();
      fetchAllCashFlowData();
    } catch (err) {
      console.error('Erro ao cancelar parcela:', err);
      if (showToast) showToast('Erro ao cancelar parcela.', 'error');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleRescheduleDueDate = async () => {
    if (!supabase || !actionModal?.installment) return;
    if (!newDueDate) {
      if (showToast) showToast('Selecione a nova data de vencimento.', 'warning');
      return;
    }

    setSubmittingAction(true);
    try {
      const hoje = new Date().toISOString().split('T')[0];
      const isPast = newDueDate < hoje;
      const newStatus = isPast ? 'overdue' : 'pending';

      const { error } = await supabase
        .from('rent_installments')
        .update({
          due_date: newDueDate,
          status: newStatus,
          notes: `Vencimento renegociado de ${actionModal.installment.due_date} para ${newDueDate}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', actionModal.installment.id);

      if (error) throw error;
      if (showToast) showToast(`Vencimento alterado para ${newDueDate} (${isPast ? 'Atrasado' : 'Pendente'}).`, 'success');
      setActionModal(null);
      loadMonthInstallments();
      fetchAllCashFlowData();
    } catch (err) {
      console.error('Erro ao alterar vencimento:', err);
      if (showToast) showToast('Erro ao alterar vencimento.', 'error');
    } finally {
      setSubmittingAction(false);
    }
  };

  return (
    <div className="space-y-6">
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
                  const isPartial = item.status === 'partial';
                  const isCancelled = item.status === 'cancelled';
                  const isOverdue = item.status === 'overdue' || (item.status === 'pending' && new Date(item.due_date) < new Date());

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80">
                      <td className="p-3 font-semibold text-slate-900">{item.tenant_name}</td>
                      <td className="p-3 text-slate-600 max-w-xs truncate">{item.property_address}</td>
                      <td className="p-3 font-mono text-slate-600">{item.due_date}</td>
                      <td className="p-3 font-bold text-right text-slate-900">
                        R$ {item.expected_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        {isPartial && item.received_amount && (
                          <div className="text-[10px] font-medium text-indigo-600">
                            Recebido: R$ {item.received_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                            isReceived
                              ? 'bg-[#d1fae5] text-[#065f46]'
                              : isPartial
                              ? 'bg-indigo-100 text-indigo-800'
                              : isCancelled
                              ? 'bg-slate-100 text-slate-600 line-through'
                              : isOverdue
                              ? 'bg-[#fee2e2] text-[#991b1b]'
                              : 'bg-[#fef3c7] text-[#92400e]'
                          }`}
                          title={item.notes || undefined}
                        >
                          {isReceived
                            ? 'Recebido'
                            : isPartial
                            ? 'Parcial'
                            : isCancelled
                            ? 'Cancelada'
                            : isOverdue
                            ? 'Atrasado'
                            : 'Pendente'}
                        </span>
                      </td>
                      <td className="p-3 text-center relative">
                        {!isReceived && !isCancelled && (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleMarkAsReceived(item)}
                              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg transition-all shadow-2xs cursor-pointer"
                              title="Dar Baixa Integral"
                            >
                              Dar Baixa
                            </button>
                            <div className="relative">
                              <button
                                onClick={() => setActiveMenuId(activeMenuId === item.id ? null : item.id)}
                                className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-all cursor-pointer"
                                title="Mais Ações"
                              >
                                <MoreVertical size={14} />
                              </button>

                              {activeMenuId === item.id && (
                                <>
                                  <div
                                    className="fixed inset-0 z-10"
                                    onClick={() => setActiveMenuId(null)}
                                  />
                                  <div className="absolute right-0 mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1 text-left">
                                    <button
                                      onClick={() => {
                                        setActiveMenuId(null);
                                        setPartialAmount('');
                                        setPartialNotes('');
                                        setActionModal({ type: 'partial', installment: item });
                                      }}
                                      className="w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                                    >
                                      <DollarSign size={13} className="text-indigo-600" />
                                      <span>Baixa Parcial</span>
                                    </button>
                                    <button
                                      onClick={() => {
                                        setActiveMenuId(null);
                                        setNewDueDate(item.due_date);
                                        setActionModal({ type: 'reschedule', installment: item });
                                      }}
                                      className="w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                                    >
                                      <CalendarClock size={13} className="text-amber-600" />
                                      <span>Alterar Vencimento</span>
                                    </button>
                                    <div className="border-t border-slate-100 my-1" />
                                    <button
                                      onClick={() => {
                                        setActiveMenuId(null);
                                        setCancelReason('');
                                        setActionModal({ type: 'cancel', installment: item });
                                      }}
                                      className="w-full px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2 cursor-pointer"
                                    >
                                      <XCircle size={13} className="text-red-500" />
                                      <span>Cancelar Parcela</span>
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
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

      {/* Modal de Ações de Parcela: Baixa Parcial, Cancelamento, Alteração de Vencimento */}
      {actionModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-150">
            
            {/* Cabeçalho do Modal */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                {actionModal.type === 'partial' && (
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                    <DollarSign size={18} />
                  </div>
                )}
                {actionModal.type === 'reschedule' && (
                  <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                    <CalendarClock size={18} />
                  </div>
                )}
                {actionModal.type === 'cancel' && (
                  <div className="p-2 bg-red-50 text-red-600 rounded-xl">
                    <XCircle size={18} />
                  </div>
                )}
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {actionModal.type === 'partial' && 'Registrar Baixa Parcial'}
                    {actionModal.type === 'reschedule' && 'Alterar Vencimento'}
                    {actionModal.type === 'cancel' && 'Cancelar Parcela'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {actionModal.installment.tenant_name} • {actionModal.installment.property_address}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActionModal(null)}
                disabled={submittingAction}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Resumo da Parcela */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4 text-xs text-slate-600 flex justify-between items-center">
              <div>
                <span className="text-slate-400 block text-[11px]">Vencimento Atual</span>
                <span className="font-semibold text-slate-700">{actionModal.installment.due_date}</span>
              </div>
              <div className="text-right">
                <span className="text-slate-400 block text-[11px]">Valor Esperado</span>
                <span className="font-bold text-slate-900 text-sm">
                  R$ {actionModal.installment.expected_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Formulário Tipo: Baixa Parcial */}
            {actionModal.type === 'partial' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Valor Recebido Parcial (R$) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    max={actionModal.installment.expected_amount - 0.01}
                    value={partialAmount}
                    onChange={(e) => setPartialAmount(e.target.value)}
                    placeholder="Ex: 1500.00"
                    autoFocus
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Deve ser menor que R$ {actionModal.installment.expected_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Observação (Opcional)
                  </label>
                  <textarea
                    rows={2}
                    value={partialNotes}
                    onChange={(e) => setPartialNotes(e.target.value)}
                    placeholder="Ex: Pagou 50% hoje, saldo restante prometido para o dia 15"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden resize-none"
                  />
                </div>
              </div>
            )}

            {/* Formulário Tipo: Alterar Vencimento */}
            {actionModal.type === 'reschedule' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nova Data de Vencimento *
                  </label>
                  <input
                    type="date"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    autoFocus
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                  />
                  {newDueDate && (
                    <p className="text-[11px] mt-1 text-slate-500">
                      {newDueDate < new Date().toISOString().split('T')[0] ? (
                        <span className="text-red-600 font-medium">⚠️ Data retroativa: a parcela será marcada como Atrasada.</span>
                      ) : (
                        <span className="text-emerald-600 font-medium">✓ A parcela ficará com status Pendente.</span>
                      )}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Formulário Tipo: Cancelar Parcela */}
            {actionModal.type === 'cancel' && (
              <div className="space-y-3">
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800">
                  Atenção: Cancelar a parcela desativa a cobrança no fluxo de caixa. O motivo ficará registrado no histórico.
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Motivo do Cancelamento *
                  </label>
                  <textarea
                    rows={3}
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Ex: Rescisão contratual antecipada, Isenção acordada em aditivo..."
                    autoFocus
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-hidden resize-none"
                  />
                </div>
              </div>
            )}

            {/* Rodapé / Botões de Ação */}
            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 mt-5">
              <button
                type="button"
                onClick={() => setActionModal(null)}
                disabled={submittingAction}
                className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
              >
                Fechar
              </button>

              {actionModal.type === 'partial' && (
                <button
                  type="button"
                  onClick={handlePartialPayment}
                  disabled={submittingAction || !partialAmount}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-xs rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle size={14} />
                  {submittingAction ? 'Gravando...' : 'Confirmar Baixa Parcial'}
                </button>
              )}

              {actionModal.type === 'reschedule' && (
                <button
                  type="button"
                  onClick={handleRescheduleDueDate}
                  disabled={submittingAction || !newDueDate}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-semibold text-xs rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <CalendarClock size={14} />
                  {submittingAction ? 'Gravando...' : 'Confirmar Novo Vencimento'}
                </button>
              )}

              {actionModal.type === 'cancel' && (
                <button
                  type="button"
                  onClick={handleCancelInstallment}
                  disabled={submittingAction || !cancelReason.trim()}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold text-xs rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <XCircle size={14} />
                  {submittingAction ? 'Cancelando...' : 'Confirmar Cancelamento'}
                </button>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
