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
  X,
  ChevronDown,
  ChevronUp,
  Shield,
  Flame,
  Percent,
  Info,
  Save,
  Edit2,
  Sparkles,
  Check
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
  expected_fee: number;
  owner_repasse_amount?: number | null;
  seguro_locaticio_amount?: number | null;
  seguro_incendio_amount?: number | null;
  outras_taxas_amount?: number | null;
  broker_commission_pct?: number | null;
  broker_commission_amount?: number | null;
  broker_commission_launched?: boolean;
  received_amount?: number | null;
  received_at?: string | null;
  notes?: string | null;
  status: 'pending' | 'received' | 'overdue' | 'partial' | 'cancelled';
  tenant_name?: string;
  property_address?: string;
  owner_name?: string;
  contract_status?: 'active' | 'inactive' | 'broken' | string;
  brokerage_fee_pct?: number;
  seguro_locaticio_value?: number;
  seguro_incendio_value?: number;
  outras_taxas_value?: number;
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
  const [firstDueDateMap, setFirstDueDateMap] = useState<Map<string, string>>(new Map());
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string; bank_name?: string }>>([]);
  const [loadingInstallments, setLoadingInstallments] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // Edit installment composition state
  const [editingCompositionId, setEditingCompositionId] = useState<string | null>(null);
  const [compositionForm, setCompositionForm] = useState<{
    expected_amount: number;
    expected_fee: number;
    owner_repasse_amount: number;
    seguro_locaticio_amount: number;
    seguro_incendio_amount: number;
    outras_taxas_amount: number;
    broker_commission_pct: number;
  }>({
    expected_amount: 0,
    expected_fee: 0,
    owner_repasse_amount: 0,
    seguro_locaticio_amount: 0,
    seguro_incendio_amount: 0,
    outras_taxas_amount: 0,
    broker_commission_pct: 0,
  });
  const [savingComposition, setSavingComposition] = useState(false);

  // Modal for First Installment Baixa with Broker Commission
  const [commissionModalItem, setCommissionModalItem] = useState<RentInstallmentRow | null>(null);
  const [selectedCommissionAccountId, setSelectedCommissionAccountId] = useState<string>('');
  const [submittingCommissionBaixa, setSubmittingCommissionBaixa] = useState(false);

  const [actionModal, setActionModal] = useState<{
    type: 'partial' | 'cancel' | 'reschedule';
    installment: RentInstallmentRow;
  } | null>(null);
  const [partialAmount, setPartialAmount] = useState<string>('');
  const [partialNotes, setPartialNotes] = useState<string>('');
  const [cancelReason, setCancelReason] = useState<string>('');
  const [newDueDate, setNewDueDate] = useState<string>('');
  const [submittingAction, setSubmittingAction] = useState(false);

  // Fetch rent installments, contract details & accounts
  const loadMonthInstallments = async () => {
    if (!supabase) return;
    setLoadingInstallments(true);

    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

      // 1. Fetch bank accounts for agency
      const { data: accsData } = await supabase
        .from('financial_accounts')
        .select('id, name, bank_name')
        .eq('agency_id', currentUser.agencyId)
        .eq('is_active', true);
      if (accsData) setAccounts(accsData);

      // 2. Fetch min due_date for all contracts to deterministically identify 1st installment
      const { data: allDates } = await supabase
        .from('rent_installments')
        .select('contract_id, due_date')
        .order('due_date', { ascending: true });

      const dateMap = new Map<string, string>();
      (allDates || []).forEach((row: any) => {
        if (row.contract_id && !dateMap.has(row.contract_id)) {
          dateMap.set(row.contract_id, row.due_date);
        }
      });
      setFirstDueDateMap(dateMap);

      // 3. Fetch installments for current month
      const { data, error } = await supabase
        .from('rent_installments')
        .select(`
          id,
          contract_id,
          due_date,
          expected_amount,
          expected_fee,
          owner_repasse_amount,
          seguro_locaticio_amount,
          seguro_incendio_amount,
          outras_taxas_amount,
          broker_commission_pct,
          broker_commission_amount,
          broker_commission_launched,
          received_amount,
          received_at,
          notes,
          status,
          rent_contracts (
            tenant_name,
            property_address,
            owner_name,
            brokerage_fee_pct,
            status,
            seguro_locaticio_value,
            seguro_incendio_value,
            outras_taxas_value
          )
        `)
        .gte('due_date', startOfMonth)
        .lte('due_date', endOfMonth)
        .order('due_date', { ascending: true });

      if (error) throw error;

      const formatted: RentInstallmentRow[] = (data || []).map((item: any) => {
        const expAmount = Number(item.expected_amount || 0);
        const expFee = item.expected_fee !== null && item.expected_fee !== undefined 
          ? Number(item.expected_fee) 
          : expAmount * (Number(item.rent_contracts?.brokerage_fee_pct || 10) / 100);

        return {
          id: item.id,
          contract_id: item.contract_id,
          due_date: item.due_date,
          expected_amount: expAmount,
          expected_fee: expFee,
          owner_repasse_amount: item.owner_repasse_amount !== null && item.owner_repasse_amount !== undefined 
            ? Number(item.owner_repasse_amount) 
            : null,
          seguro_locaticio_amount: item.seguro_locaticio_amount !== null && item.seguro_locaticio_amount !== undefined 
            ? Number(item.seguro_locaticio_amount) 
            : null,
          seguro_incendio_amount: item.seguro_incendio_amount !== null && item.seguro_incendio_amount !== undefined 
            ? Number(item.seguro_incendio_amount) 
            : null,
          outras_taxas_amount: item.outras_taxas_amount !== null && item.outras_taxas_amount !== undefined 
            ? Number(item.outras_taxas_amount) 
            : null,
          broker_commission_pct: item.broker_commission_pct !== null && item.broker_commission_pct !== undefined 
            ? Number(item.broker_commission_pct) 
            : null,
          broker_commission_amount: item.broker_commission_amount !== null && item.broker_commission_amount !== undefined 
            ? Number(item.broker_commission_amount) 
            : 0,
          broker_commission_launched: Boolean(item.broker_commission_launched),
          received_amount: item.received_amount ? Number(item.received_amount) : null,
          received_at: item.received_at,
          notes: item.notes,
          status: item.status,
          tenant_name: item.rent_contracts?.tenant_name || 'Inquilino',
          property_address: item.rent_contracts?.property_address || 'Imóvel',
          owner_name: item.rent_contracts?.owner_name || 'Proprietário',
          contract_status: item.rent_contracts?.status || 'active',
          brokerage_fee_pct: item.rent_contracts?.brokerage_fee_pct ? Number(item.rent_contracts.brokerage_fee_pct) : 10,
          seguro_locaticio_value: item.rent_contracts?.seguro_locaticio_value ? Number(item.rent_contracts.seguro_locaticio_value) : 0,
          seguro_incendio_value: item.rent_contracts?.seguro_incendio_value ? Number(item.rent_contracts.seguro_incendio_value) : 0,
          outras_taxas_value: item.rent_contracts?.outras_taxas_value ? Number(item.rent_contracts.outras_taxas_value) : 0,
        };
      });

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

  // Totals for rent installment real revenue vs pass-through
  const rentRevenueStats = useMemo(() => {
    let totalExpectedVolume = 0;
    let totalRealFeeRevenue = 0;
    let totalOwnerRepasse = 0;
    let totalSegurosTaxas = 0;

    currentMonthInstallments.forEach(item => {
      totalExpectedVolume += item.expected_amount;
      totalRealFeeRevenue += item.expected_fee;
      const repasse = item.owner_repasse_amount !== null 
        ? item.owner_repasse_amount 
        : Math.max(0, item.expected_amount - item.expected_fee);
      totalOwnerRepasse += repasse;
      const segLoc = item.seguro_locaticio_amount || 0;
      const segInc = item.seguro_incendio_amount || 0;
      const outras = item.outras_taxas_amount || 0;
      totalSegurosTaxas += segLoc + segInc + outras;
    });

    return {
      totalExpectedVolume,
      totalRealFeeRevenue,
      totalOwnerRepasse,
      totalSegurosTaxas,
    };
  }, [currentMonthInstallments]);

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

  // Handler to update contract status (active, inactive, broken)
  const handleUpdateContractStatus = async (contractId: string, newStatus: string) => {
    if (!supabase || !contractId) return;
    try {
      const { error } = await supabase
        .from('rent_contracts')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', contractId);

      if (error) throw error;

      setCurrentMonthInstallments(prev => prev.map(inst => {
        if (inst.contract_id === contractId) {
          return { ...inst, contract_status: newStatus };
        }
        return inst;
      }));

      if (showToast) showToast('Status do contrato atualizado!', 'success');
    } catch (err: any) {
      console.error('Error updating contract status:', err);
      if (showToast) showToast('Erro ao atualizar status do contrato.', 'error');
    }
  };

  // Start editing composition of an installment
  const handleStartEditComposition = (item: RentInstallmentRow) => {
    setEditingCompositionId(item.id);
    const fee = item.expected_fee || (item.expected_amount * (item.brokerage_fee_pct || 10) / 100);
    const segLoc = item.seguro_locaticio_amount !== null && item.seguro_locaticio_amount !== undefined 
      ? item.seguro_locaticio_amount 
      : (item.seguro_locaticio_value || 0);
    const segInc = item.seguro_incendio_amount !== null && item.seguro_incendio_amount !== undefined 
      ? item.seguro_incendio_amount 
      : (item.seguro_incendio_value || 0);
    const outras = item.outras_taxas_amount !== null && item.outras_taxas_amount !== undefined 
      ? item.outras_taxas_amount 
      : (item.outras_taxas_value || 0);
    const repasse = item.owner_repasse_amount !== null && item.owner_repasse_amount !== undefined 
      ? item.owner_repasse_amount 
      : (item.expected_amount - fee - segLoc - segInc - outras);

    setCompositionForm({
      expected_amount: item.expected_amount,
      expected_fee: fee,
      owner_repasse_amount: repasse,
      seguro_locaticio_amount: segLoc,
      seguro_incendio_amount: segInc,
      outras_taxas_amount: outras,
      broker_commission_pct: item.broker_commission_pct || 0,
    });
  };

  // Save edited installment composition
  const handleSaveComposition = async (installmentId: string) => {
    if (!supabase || !installmentId) return;
    setSavingComposition(true);

    try {
      const brokerPct = compositionForm.broker_commission_pct > 0 ? compositionForm.broker_commission_pct : null;
      const brokerAmt = brokerPct ? (compositionForm.expected_amount * (brokerPct / 100)) : 0;

      const payload = {
        expected_amount: compositionForm.expected_amount,
        expected_fee: compositionForm.expected_fee,
        owner_repasse_amount: compositionForm.owner_repasse_amount,
        seguro_locaticio_amount: compositionForm.seguro_locaticio_amount,
        seguro_incendio_amount: compositionForm.seguro_incendio_amount,
        outras_taxas_amount: compositionForm.outras_taxas_amount,
        broker_commission_pct: brokerPct,
        broker_commission_amount: brokerAmt,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('rent_installments')
        .update(payload)
        .eq('id', installmentId);

      if (error) throw error;

      setCurrentMonthInstallments(prev => prev.map(inst => {
        if (inst.id === installmentId) {
          return {
            ...inst,
            ...payload,
          };
        }
        return inst;
      }));

      setEditingCompositionId(null);
      if (showToast) showToast('Composição da parcela atualizada com sucesso!', 'success');
    } catch (err: any) {
      console.error('Error saving installment composition:', err);
      if (showToast) showToast('Erro ao salvar composição da parcela.', 'error');
    } finally {
      setSavingComposition(false);
    }
  };

  // Mark installment as received (with commission check on 1st installment)
  const handleMarkAsReceived = async (installment: RentInstallmentRow) => {
    if (!supabase) return;

    const isFirstInstallment = firstDueDateMap.get(installment.contract_id) === installment.due_date;
    const hasPendingBrokerCommission = isFirstInstallment && 
      Number(installment.broker_commission_pct) > 0 && 
      !installment.broker_commission_launched;

    // If 1st installment has broker commission not launched yet, open modal for bank account selection
    if (hasPendingBrokerCommission) {
      setSelectedCommissionAccountId(accounts.length > 0 ? accounts[0].id : '');
      setCommissionModalItem(installment);
      return;
    }

    // Direct baixa for regular installments or already launched commission
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

  // Confirm Baixa with Broker Commission Launch
  const handleConfirmBaixaWithCommission = async () => {
    if (!supabase || !commissionModalItem) return;
    if (!selectedCommissionAccountId) {
      if (showToast) showToast('Selecione a conta bancária para débito da comissão.', 'warning');
      return;
    }

    setSubmittingCommissionBaixa(true);
    try {
      const hoje = new Date().toISOString().split('T')[0];
      const commissionAmount = commissionModalItem.broker_commission_amount || 
        (commissionModalItem.expected_amount * ((commissionModalItem.broker_commission_pct || 0) / 100));

      const txDescription = `Comissão Corretor - 1ª Parcela (${commissionModalItem.tenant_name} / ${commissionModalItem.property_address})`;

      // 1. Tenta PRIMEIRO o insert da despesa em financial_transactions
      if (commissionAmount > 0) {
        const { error: txErr } = await supabase
          .from('financial_transactions')
          .insert({
            agency_id: currentUser.agencyId,
            account_id: selectedCommissionAccountId,
            type: 'EXPENSE',
            category_id: '72990fe0-62b1-43f3-8fdb-12410d12a8e9', // Categoria: Comissão de Locação (Corretor)
            amount: commissionAmount,
            description: txDescription,
            status: 'PENDING',
            due_date: hoje,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        if (txErr) {
          throw new Error(`Falha ao lançar despesa de comissão: ${txErr.message || 'Erro no banco'}`);
        }
      }

      // 2. SÓ com o insert bem-sucedido, atualiza a parcela em rent_installments
      const { error: instErr } = await supabase
        .from('rent_installments')
        .update({
          status: 'received',
          received_amount: commissionModalItem.expected_amount,
          received_at: hoje,
          broker_commission_launched: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', commissionModalItem.id);

      if (instErr) {
        // Rollback compensatório: remove a despesa criada, já que a parcela não pôde ser atualizada
        if (commissionAmount > 0) {
          await supabase
            .from('financial_transactions')
            .delete()
            .eq('agency_id', currentUser.agencyId)
            .eq('account_id', selectedCommissionAccountId)
            .eq('amount', commissionAmount)
            .eq('due_date', hoje)
            .eq('description', txDescription);
        }
        throw new Error(`Falha ao dar baixa na parcela: ${instErr.message || 'Erro no banco'}`);
      }

      if (showToast) {
        showToast('Aluguel recebido e despesa de comissão do corretor lançada com sucesso!', 'success');
      }

      setCommissionModalItem(null);
      loadMonthInstallments();
      fetchAllCashFlowData();
    } catch (err: any) {
      console.error('Erro na baixa com comissão:', err);
      if (showToast) {
        showToast(err?.message || 'Erro ao processar baixa com comissão.', 'error');
      }
    } finally {
      setSubmittingCommissionBaixa(false);
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

      {/* Indicador em Destaque: Receita Real da Fidelité vs Valores de Passagem */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 rounded-3xl p-6 text-white shadow-md border border-emerald-800/40 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-emerald-800/50">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-500/20 border border-emerald-400/30 rounded-2xl text-emerald-400">
              <Sparkles size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-widest text-emerald-300">Análise de Receita Real</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold border border-emerald-400/30">Mês Corrente</span>
              </div>
              <h4 className="text-lg font-bold text-white tracking-tight">Receita Real da Fidelité vs. Valores de Passagem</h4>
            </div>
          </div>
          <div className="text-xs text-emerald-200/80 max-w-md">
            <span className="font-bold text-white">Importante:</span> Apenas a <strong>Taxa de Administração (Comissão Fidelité)</strong> compõe a receita líquida própria da imobiliária. Repasses aos proprietários e seguros são valores de passagem transitórios.
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white/10 backdrop-blur-xs rounded-2xl p-4 border border-emerald-400/30">
            <span className="text-[11px] font-bold text-emerald-300 uppercase tracking-wider block">Receita Real da Fidelité (Taxa Adm)</span>
            <div className="text-2xl font-black text-emerald-400 mt-1">
              R$ {rentRevenueStats.totalRealFeeRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-emerald-200/70 mt-1 block">Comissão líquida prevista no mês</span>
          </div>

          <div className="bg-white/5 backdrop-blur-xs rounded-2xl p-4 border border-white/10">
            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">Repasse aos Proprietários (Passagem)</span>
            <div className="text-2xl font-black text-white mt-1">
              R$ {rentRevenueStats.totalOwnerRepasse.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">Destinado aos locadores</span>
          </div>

          <div className="bg-white/5 backdrop-blur-xs rounded-2xl p-4 border border-white/10">
            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">Seguros & Taxas (Passagem)</span>
            <div className="text-2xl font-black text-amber-300 mt-1">
              R$ {rentRevenueStats.totalSegurosTaxas.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">Seguro locatício, incêndio e taxas</span>
          </div>
        </div>
      </div>

      {/* Tabela: Parcelas de Aluguel do Mês Corrente com Detalhamento Expansível */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
          <div>
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <Building2 size={16} className="text-blue-600" />
              Aluguéis do Mês Corrente (imobia.app)
            </h3>
            <p className="text-xs text-slate-400">Clique na linha para expandir a composição completa e gerenciar status do contrato</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
              {currentMonthInstallments.length} parcelas no mês
            </span>
          </div>
        </div>

        {loadingInstallments ? (
          <div className="p-8 text-center text-slate-400 text-xs">Carregando parcelas de aluguel e contratos...</div>
        ) : currentMonthInstallments.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            Nenhuma parcela de aluguel encontrada para este mês. Importe os contratos do imobia.app.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                  <th className="p-3 w-8"></th>
                  <th className="p-3">Inquilino & Imóvel</th>
                  <th className="p-3">Status do Contrato</th>
                  <th className="p-3 font-mono">Vencimento</th>
                  <th className="p-3 text-right">Valor Total</th>
                  <th className="p-3 text-right text-emerald-700">Comissão Fidelité</th>
                  <th className="p-3 text-center">Status Parcela</th>
                  <th className="p-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentMonthInstallments.map((item) => {
                  const isReceived = item.status === 'received';
                  const isPartial = item.status === 'partial';
                  const isCancelled = item.status === 'cancelled';
                  const isOverdue = item.status === 'overdue' || (item.status === 'pending' && new Date(item.due_date) < new Date());
                  const isExpanded = expandedRowId === item.id;
                  const isEditing = editingCompositionId === item.id;
                  const isFirstInstallment = firstDueDateMap.get(item.contract_id) === item.due_date;

                  return (
                    <React.Fragment key={item.id}>
                      <tr 
                        className={`hover:bg-slate-50/90 transition-colors cursor-pointer ${isExpanded ? 'bg-slate-50/80 font-medium' : ''}`}
                        onClick={(e) => {
                          if ((e.target as HTMLElement).closest('button, select, input, a')) return;
                          setExpandedRowId(isExpanded ? null : item.id);
                        }}
                      >
                        <td className="p-3 text-slate-400 text-center">
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-slate-900">{item.tenant_name}</div>
                          <div className="text-[11px] text-slate-500 max-w-xs truncate">{item.property_address}</div>
                          {isFirstInstallment && (
                            <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60">
                              <Sparkles size={10} /> 1ª Parcela do Contrato
                            </span>
                          )}
                        </td>
                        <td className="p-3" onClick={(e) => e.stopPropagation()}>
                          <select
                            value={item.contract_status || 'active'}
                            onChange={(e) => handleUpdateContractStatus(item.contract_id, e.target.value)}
                            className={`text-[11px] font-bold px-2 py-1 rounded-lg border transition-all ${
                              item.contract_status === 'active'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : item.contract_status === 'ended'
                                ? 'bg-slate-100 text-slate-700 border-slate-200'
                                : 'bg-rose-50 text-rose-800 border-rose-200'
                            }`}
                          >
                            <option value="active">● Ativo</option>
                            <option value="ended">○ Inativo (Encerrado)</option>
                            <option value="cancelled">✕ Quebrado / Rescindido</option>
                          </select>
                        </td>
                        <td className="p-3 font-mono text-slate-600">{item.due_date}</td>
                        <td className="p-3 font-bold text-right text-slate-900">
                          R$ {item.expected_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          {isPartial && item.received_amount && (
                            <div className="text-[10px] font-medium text-indigo-600">
                              Recebido: R$ {item.received_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <span className="font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60 text-[11px]">
                            R$ {item.expected_fee.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
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
                        <td className="p-3 text-center relative" onClick={(e) => e.stopPropagation()}>
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

                      {/* Linha Expansível com Detalhamento de Composição & Comissão Corretor */}
                      {isExpanded && (
                        <tr className="bg-slate-50/90 border-b border-slate-200">
                          <td colSpan={8} className="p-4 sm:p-6 space-y-4">
                            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-4">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                                    <Info size={16} />
                                  </span>
                                  <div>
                                    <h4 className="font-bold text-slate-900 text-sm">Detalhamento da Composição da Parcela</h4>
                                    <p className="text-[11px] text-slate-500">
                                      Proprietário: <strong>{item.owner_name}</strong> • Vencimento: {item.due_date}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  {!isEditing ? (
                                    <button
                                      onClick={() => handleStartEditComposition(item)}
                                      className="px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl border border-indigo-200 transition-all flex items-center gap-1.5"
                                    >
                                      <Edit2 size={13} /> Editar Composição
                                    </button>
                                  ) : (
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => setEditingCompositionId(null)}
                                        className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                                      >
                                        Cancelar
                                      </button>
                                      <button
                                        disabled={savingComposition}
                                        onClick={() => handleSaveComposition(item.id)}
                                        className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl flex items-center gap-1.5 shadow-2xs"
                                      >
                                        <Save size={13} /> {savingComposition ? 'Salvando...' : 'Salvar Composição'}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Grade de Composição */}
                              {!isEditing ? (
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Valor Total</span>
                                    <div className="text-sm font-bold text-slate-900 mt-0.5">
                                      R$ {item.expected_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </div>
                                  </div>

                                  <div className="p-3 bg-emerald-50/80 rounded-xl border border-emerald-200/80">
                                    <span className="text-[10px] font-black text-emerald-800 uppercase flex items-center gap-1">
                                      <TrendingUp size={11} /> Comissão (Fidelité)
                                    </span>
                                    <div className="text-sm font-black text-emerald-700 mt-0.5">
                                      R$ {item.expected_fee.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </div>
                                    <span className="text-[9px] font-bold text-emerald-600">Receita Real</span>
                                  </div>

                                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Repasse Proprietário</span>
                                    <div className="text-sm font-bold text-slate-700 mt-0.5">
                                      R$ {(item.owner_repasse_amount !== null && item.owner_repasse_amount !== undefined 
                                        ? item.owner_repasse_amount 
                                        : Math.max(0, item.expected_amount - item.expected_fee - (item.seguro_locaticio_amount || 0) - (item.seguro_incendio_amount || 0) - (item.outras_taxas_amount || 0))
                                      ).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </div>
                                    <span className="text-[9px] text-slate-400">Passagem</span>
                                  </div>

                                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                                      <Shield size={11} className="text-blue-500" /> Seguro Locatício
                                    </span>
                                    <div className="text-sm font-bold text-slate-700 mt-0.5">
                                      R$ {(item.seguro_locaticio_amount !== null && item.seguro_locaticio_amount !== undefined 
                                        ? item.seguro_locaticio_amount 
                                        : (item.seguro_locaticio_value || 0)
                                      ).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </div>
                                    <span className="text-[9px] text-slate-400">Passagem</span>
                                  </div>

                                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                                      <Flame size={11} className="text-orange-500" /> Seguro Incêndio
                                    </span>
                                    <div className="text-sm font-bold text-slate-700 mt-0.5">
                                      R$ {(item.seguro_incendio_amount !== null && item.seguro_incendio_amount !== undefined 
                                        ? item.seguro_incendio_amount 
                                        : (item.seguro_incendio_value || 0)
                                      ).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </div>
                                    <span className="text-[9px] text-slate-400">Passagem</span>
                                  </div>

                                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Outras Taxas</span>
                                    <div className="text-sm font-bold text-slate-700 mt-0.5">
                                      R$ {(item.outras_taxas_amount !== null && item.outras_taxas_amount !== undefined 
                                        ? item.outras_taxas_amount 
                                        : (item.outras_taxas_value || 0)
                                      ).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </div>
                                    <span className="text-[9px] text-slate-400">Passagem</span>
                                  </div>
                                </div>
                              ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                  <div>
                                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Valor Total Parcela (R$)</label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={compositionForm.expected_amount}
                                      onChange={(e) => setCompositionForm(prev => ({ ...prev, expected_amount: parseFloat(e.target.value) || 0 }))}
                                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800"
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-[11px] font-bold text-emerald-800 mb-1">Comissão Fidelité (Receita Real R$)</label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={compositionForm.expected_fee}
                                      onChange={(e) => setCompositionForm(prev => ({ ...prev, expected_fee: parseFloat(e.target.value) || 0 }))}
                                      className="w-full bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-1.5 text-xs font-bold text-emerald-900"
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Repasse Proprietário (R$)</label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={compositionForm.owner_repasse_amount}
                                      onChange={(e) => setCompositionForm(prev => ({ ...prev, owner_repasse_amount: parseFloat(e.target.value) || 0 }))}
                                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800"
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Seguro Locatício (R$)</label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={compositionForm.seguro_locaticio_amount}
                                      onChange={(e) => setCompositionForm(prev => ({ ...prev, seguro_locaticio_amount: parseFloat(e.target.value) || 0 }))}
                                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800"
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Seguro Incêndio (R$)</label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={compositionForm.seguro_incendio_amount}
                                      onChange={(e) => setCompositionForm(prev => ({ ...prev, seguro_incendio_amount: parseFloat(e.target.value) || 0 }))}
                                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800"
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Outras Taxas (R$)</label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={compositionForm.outras_taxas_amount}
                                      onChange={(e) => setCompositionForm(prev => ({ ...prev, outras_taxas_amount: parseFloat(e.target.value) || 0 }))}
                                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800"
                                    />
                                  </div>
                                </div>
                              )}

                              {/* Bloco de 1ª Parcela - Comissão do Corretor */}
                              {isFirstInstallment && (
                                <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-black text-amber-900 flex items-center gap-1.5">
                                      <Sparkles size={14} className="text-amber-600" />
                                      Comissão do Corretor (1ª Parcela do Contrato)
                                    </span>
                                    {item.broker_commission_launched ? (
                                      <span className="text-[10px] font-black text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                                        <CheckCircle2 size={11} /> Despesa já lançada no Financeiro
                                      </span>
                                    ) : (
                                      <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full">
                                        Pendente de lançamento (gerado no "Dar Baixa")
                                      </span>
                                    )}
                                  </div>

                                  {!isEditing ? (
                                    <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-amber-900 pt-1">
                                      <div>Percentual: <strong>{item.broker_commission_pct || 0}%</strong></div>
                                      <div>Valor Calculado: <strong>R$ {((item.expected_amount * ((item.broker_commission_pct || 0) / 100))).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></div>
                                      <div className="text-[11px] text-amber-700">Categoria: Comissão de Locação (Corretor)</div>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-3 pt-2">
                                      <div className="w-44">
                                        <label className="block text-[10px] font-bold text-amber-900 mb-0.5">Percentual Corretor (%)</label>
                                        <input
                                          type="number"
                                          step="0.1"
                                          placeholder="Ex: 50 ou 100"
                                          value={compositionForm.broker_commission_pct || ''}
                                          onChange={(e) => setCompositionForm(prev => ({ ...prev, broker_commission_pct: parseFloat(e.target.value) || 0 }))}
                                          className="w-full bg-white border border-amber-300 rounded-xl px-3 py-1.5 text-xs font-bold text-amber-950"
                                        />
                                      </div>
                                      <div className="pt-3 text-xs font-bold text-amber-900">
                                        = R$ {((compositionForm.expected_amount * (compositionForm.broker_commission_pct / 100))).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Confirmação de Baixa com Lançamento de Comissão do Corretor */}
      {commissionModalItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-emerald-600">
                <Sparkles size={20} />
                <h3 className="text-base font-bold text-slate-900">Lançar Comissão do Corretor</h3>
              </div>
              <button 
                onClick={() => setCommissionModalItem(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Esta é a <strong>1ª parcela</strong> do contrato de <strong>{commissionModalItem.tenant_name}</strong> ({commissionModalItem.property_address}). Ao dar baixa, será criado automaticamente o lançamento de despesa da comissão do corretor.
            </p>

            <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-200/80 space-y-1.5">
              <div className="flex justify-between text-xs text-emerald-900 font-medium">
                <span>Valor do Aluguel:</span>
                <span className="font-bold">R$ {commissionModalItem.expected_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-xs text-emerald-900 font-medium">
                <span>Comissão ({commissionModalItem.broker_commission_pct}%):</span>
                <span className="font-black text-emerald-700 text-sm">
                  R$ {(commissionModalItem.broker_commission_amount || (commissionModalItem.expected_amount * ((commissionModalItem.broker_commission_pct || 0) / 100))).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="text-[10px] text-emerald-700 font-medium pt-1 border-t border-emerald-200/60">
                Categoria: <strong>Comissão de Locação (Corretor)</strong> • Status: <strong>PENDENTE</strong>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Selecione a Conta Bancária de Débito:
              </label>
              <select
                value={selectedCommissionAccountId}
                onChange={(e) => setSelectedCommissionAccountId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="">Selecione uma conta bancária...</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.bank_name || 'Conta Bancária'})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCommissionModalItem(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!selectedCommissionAccountId || submittingCommissionBaixa}
                onClick={handleConfirmBaixaWithCommission}
                className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl shadow-md transition-all flex items-center gap-1.5"
              >
                <Check size={14} />
                {submittingCommissionBaixa ? 'Processando...' : 'Confirmar Baixa e Lançar Despesa'}
              </button>
            </div>
          </div>
        </div>
      )}

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
                  <h3 className="font-bold text-slate-800 text-base">
                    {actionModal.type === 'partial' && 'Registrar Baixa Parcial'}
                    {actionModal.type === 'reschedule' && 'Alterar Vencimento'}
                    {actionModal.type === 'cancel' && 'Cancelar Parcela de Aluguel'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {actionModal.installment.tenant_name} • {actionModal.installment.property_address}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActionModal(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>

            {/* Corpo do Modal: Baixa Parcial */}
            {actionModal.type === 'partial' && (
              <div className="space-y-4">
                <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 flex justify-between items-center text-xs">
                  <span className="text-indigo-900 font-medium">Valor Total Esperado:</span>
                  <span className="font-bold text-indigo-950 text-sm">
                    R$ {actionModal.installment.expected_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Valor Recebido Parcialmente (R$) *
                  </label>
                  <input
                    type="text"
                    placeholder="0,00"
                    value={partialAmount}
                    onChange={(e) => setPartialAmount(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Observações / Motivo do Pagamento Parcial
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Ex: Inquilino pagou metade e quitará o restante na próxima semana"
                    value={partialNotes}
                    onChange={(e) => setPartialNotes(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setActionModal(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={submittingAction}
                    onClick={handlePartialPayment}
                    className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl transition-all shadow-xs"
                  >
                    {submittingAction ? 'Salvando...' : 'Confirmar Baixa Parcial'}
                  </button>
                </div>
              </div>
            )}

            {/* Corpo do Modal: Alterar Vencimento */}
            {actionModal.type === 'reschedule' && (
              <div className="space-y-4">
                <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-100 flex justify-between items-center text-xs">
                  <span className="text-amber-900 font-medium">Vencimento Atual:</span>
                  <span className="font-mono font-bold text-amber-950">{actionModal.installment.due_date}</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Nova Data de Vencimento *
                  </label>
                  <input
                    type="date"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setActionModal(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={submittingAction}
                    onClick={handleRescheduleDueDate}
                    className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 rounded-xl transition-all shadow-xs"
                  >
                    {submittingAction ? 'Salvando...' : 'Salvar Novo Vencimento'}
                  </button>
                </div>
              </div>
            )}

            {/* Corpo do Modal: Cancelar Parcela */}
            {actionModal.type === 'cancel' && (
              <div className="space-y-4">
                <div className="p-3 bg-red-50/50 rounded-xl border border-red-100 text-xs text-red-800 space-y-1">
                  <p className="font-bold flex items-center gap-1.5">
                    <AlertTriangle size={14} className="text-red-600 shrink-0" />
                    Atenção: A parcela será cancelada
                  </p>
                  <p className="text-red-700">
                    O valor de R$ {actionModal.installment.expected_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} deixará de compor o saldo projetado.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Motivo do Cancelamento *
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Ex: Contrato rescindido antes do vencimento, rescisão acordada, etc."
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setActionModal(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    disabled={submittingAction}
                    onClick={handleCancelInstallment}
                    className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-xl transition-all shadow-xs"
                  >
                    {submittingAction ? 'Cancelando...' : 'Confirmar Cancelamento'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
