import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  Pencil,
  XCircle,
  AlertTriangle,
  CheckCircle2,
  Receipt,
  X,
  Save,
} from 'lucide-react';
import { supabase } from '../../../../supabase';
import { User } from '../../../../types';

interface ContratosLocacaoProps {
  currentUser: User;
  showToast?: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

interface RentContract {
  id: string;
  property_address: string;
  tenant_name: string;
  owner_name: string;
  monthly_rent: number;
  brokerage_fee_pct: number;
  day_of_month: number;
  start_date: string;
  end_date: string | null;
  status: string;
  is_delinquent: boolean;
  seguro_locaticio_value: number | null;
  seguro_incendio_value: number | null;
  outras_taxas_value: number | null;
}

interface RentInstallmentRow {
  id: string;
  due_date: string;
  expected_amount: number;
  status: string;
  received_at: string | null;
}

type StatusTab = 'all' | 'alugados' | 'inadimplentes' | 'cancelados';

const formatCurrency = (v: number) =>
  (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatDateBR = (d: string | null) => {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
};

export const ContratosLocacao: React.FC<ContratosLocacaoProps> = ({ currentUser, showToast }) => {
  const [contracts, setContracts] = useState<RentContract[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<StatusTab>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const [editingContract, setEditingContract] = useState<RentContract | null>(null);
  const [editForm, setEditForm] = useState<Partial<RentContract>>({});
  const [savingEdit, setSavingEdit] = useState(false);

  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);

  const [viewingInstallmentsFor, setViewingInstallmentsFor] = useState<RentContract | null>(null);
  const [installments, setInstallments] = useState<RentInstallmentRow[]>([]);
  const [loadingInstallments, setLoadingInstallments] = useState(false);

  const loadContracts = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('rent_contracts')
        .select('*')
        .eq('agency_id', currentUser.agencyId)
        .order('property_address', { ascending: true });
      if (error) throw error;
      setContracts((data || []) as RentContract[]);
    } catch (err) {
      console.error('Erro ao carregar contratos:', err);
      if (showToast) showToast('Erro ao carregar contratos de locação.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContracts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredContracts = useMemo(() => {
    let list = contracts;
    if (activeTab === 'alugados') list = list.filter(c => c.status === 'active' && !c.is_delinquent);
    else if (activeTab === 'inadimplentes') list = list.filter(c => c.is_delinquent);
    else if (activeTab === 'cancelados') list = list.filter(c => c.status === 'cancelled' || c.status === 'ended');

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(
        c =>
          c.property_address?.toLowerCase().includes(term) ||
          c.tenant_name?.toLowerCase().includes(term) ||
          c.owner_name?.toLowerCase().includes(term)
      );
    }
    return list;
  }, [contracts, activeTab, searchTerm]);

  const counts = useMemo(() => ({
    all: contracts.length,
    alugados: contracts.filter(c => c.status === 'active' && !c.is_delinquent).length,
    inadimplentes: contracts.filter(c => c.is_delinquent).length,
    cancelados: contracts.filter(c => c.status === 'cancelled' || c.status === 'ended').length,
  }), [contracts]);

  const handleToggleDelinquent = async (contract: RentContract) => {
    if (!supabase) return;
    const newValue = !contract.is_delinquent;
    // Atualização otimista
    setContracts(prev => prev.map(c => (c.id === contract.id ? { ...c, is_delinquent: newValue } : c)));
    const { error } = await supabase
      .from('rent_contracts')
      .update({ is_delinquent: newValue })
      .eq('id', contract.id);
    if (error) {
      console.error('Erro ao atualizar inadimplência:', error);
      if (showToast) showToast('Erro ao atualizar status de inadimplência.', 'error');
      setContracts(prev => prev.map(c => (c.id === contract.id ? { ...c, is_delinquent: contract.is_delinquent } : c)));
    } else if (showToast) {
      showToast(newValue ? 'Contrato marcado como inadimplente.' : 'Inadimplência removida.', 'success');
    }
  };

  const openEditModal = (contract: RentContract) => {
    setEditingContract(contract);
    setEditForm({
      monthly_rent: contract.monthly_rent,
      brokerage_fee_pct: contract.brokerage_fee_pct,
      day_of_month: contract.day_of_month,
      seguro_locaticio_value: contract.seguro_locaticio_value || 0,
      seguro_incendio_value: contract.seguro_incendio_value || 0,
      outras_taxas_value: contract.outras_taxas_value || 0,
      end_date: contract.end_date,
    });
  };

  const handleSaveEdit = async () => {
    if (!supabase || !editingContract) return;
    setSavingEdit(true);
    try {
      const { error } = await supabase
        .from('rent_contracts')
        .update({
          monthly_rent: editForm.monthly_rent,
          brokerage_fee_pct: editForm.brokerage_fee_pct,
          day_of_month: editForm.day_of_month,
          seguro_locaticio_value: editForm.seguro_locaticio_value,
          seguro_incendio_value: editForm.seguro_incendio_value,
          outras_taxas_value: editForm.outras_taxas_value,
          end_date: editForm.end_date || null,
        })
        .eq('id', editingContract.id);
      if (error) throw error;
      if (showToast) showToast('Contrato atualizado! Vale lembrar: parcelas já geradas não mudam retroativamente — só as próximas.', 'success');
      setEditingContract(null);
      await loadContracts();
    } catch (err) {
      console.error('Erro ao salvar contrato:', err);
      if (showToast) showToast('Erro ao salvar alterações do contrato.', 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!supabase || !confirmCancelId) return;
    const { error } = await supabase
      .from('rent_contracts')
      .update({ status: 'cancelled' })
      .eq('id', confirmCancelId);
    if (error) {
      console.error('Erro ao cancelar contrato:', error);
      if (showToast) showToast('Erro ao cancelar contrato.', 'error');
    } else {
      if (showToast) showToast('Contrato cancelado. Ele não vai mais gerar novas parcelas.', 'success');
      await loadContracts();
    }
    setConfirmCancelId(null);
  };

  const openInstallments = async (contract: RentContract) => {
    if (!supabase) return;
    setViewingInstallmentsFor(contract);
    setLoadingInstallments(true);
    try {
      const { data, error } = await supabase
        .from('rent_installments')
        .select('id, due_date, expected_amount, status, received_at')
        .eq('contract_id', contract.id)
        .order('due_date', { ascending: false });
      if (error) throw error;
      setInstallments((data || []) as RentInstallmentRow[]);
    } catch (err) {
      console.error('Erro ao carregar parcelas:', err);
      if (showToast) showToast('Erro ao carregar parcelas do contrato.', 'error');
    } finally {
      setLoadingInstallments(false);
    }
  };

  const tabs: { key: StatusTab; label: string }[] = [
    { key: 'all', label: 'Todos' },
    { key: 'alugados', label: 'Alugados' },
    { key: 'inadimplentes', label: 'Inadimplentes' },
    { key: 'cancelados', label: 'Cancelados' },
  ];

  return (
    <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
          <Building2 size={16} className="text-blue-600" />
          Contratos de Locação
        </h3>
        <input
          type="text"
          placeholder="Buscar por imóvel, inquilino ou proprietário..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="text-xs px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-blue-200 w-full sm:w-72"
        />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {tabs.map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-1.5 text-xs font-bold rounded-full transition-all cursor-pointer ${
              activeTab === tab.key
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            {tab.label} ({counts[tab.key]})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="p-8 text-center text-slate-400 text-xs">Carregando contratos...</div>
      ) : filteredContracts.length === 0 ? (
        <div className="p-8 text-center text-slate-400 text-xs">Nenhum contrato encontrado.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-2 px-2 text-[10px] font-black text-slate-400 uppercase tracking-wide">Imóvel</th>
                <th className="text-left py-2 px-2 text-[10px] font-black text-slate-400 uppercase tracking-wide">Inquilino</th>
                <th className="text-left py-2 px-2 text-[10px] font-black text-slate-400 uppercase tracking-wide">Proprietário</th>
                <th className="text-right py-2 px-2 text-[10px] font-black text-slate-400 uppercase tracking-wide">Aluguel</th>
                <th className="text-center py-2 px-2 text-[10px] font-black text-slate-400 uppercase tracking-wide">Venc.</th>
                <th className="text-center py-2 px-2 text-[10px] font-black text-slate-400 uppercase tracking-wide">Início / Fim</th>
                <th className="text-center py-2 px-2 text-[10px] font-black text-slate-400 uppercase tracking-wide">Status</th>
                <th className="text-center py-2 px-2 text-[10px] font-black text-slate-400 uppercase tracking-wide">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredContracts.map(c => (
                <tr key={c.id} className="hover:bg-slate-50/60 transition-all">
                  <td className="py-3 px-2 font-semibold text-slate-800">{c.property_address}</td>
                  <td className="py-3 px-2 text-slate-600">{c.tenant_name}</td>
                  <td className="py-3 px-2 text-slate-600">{c.owner_name}</td>
                  <td className="py-3 px-2 text-right font-bold text-slate-800">{formatCurrency(c.monthly_rent)}</td>
                  <td className="py-3 px-2 text-center text-slate-500">dia {c.day_of_month}</td>
                  <td className="py-3 px-2 text-center text-slate-500 text-xs">
                    {formatDateBR(c.start_date)} — {c.end_date ? formatDateBR(c.end_date) : 'indeterminado'}
                  </td>
                  <td className="py-3 px-2 text-center">
                    {c.status === 'cancelled' || c.status === 'ended' ? (
                      <span className="px-2 py-1 rounded-full text-[10px] font-black uppercase bg-slate-100 text-slate-500">Cancelado</span>
                    ) : c.is_delinquent ? (
                      <span className="px-2 py-1 rounded-full text-[10px] font-black uppercase bg-rose-50 text-rose-600">Inadimplente</span>
                    ) : (
                      <span className="px-2 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-50 text-emerald-600">Alugado</span>
                    )}
                  </td>
                  <td className="py-3 px-2">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openInstallments(c)}
                        title="Ver parcelas"
                        className="p-1.5 rounded-lg border bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 transition-all cursor-pointer"
                      >
                        <Receipt size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(c)}
                        title="Editar valores"
                        className="p-1.5 rounded-lg border bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100 transition-all cursor-pointer"
                      >
                        <Pencil size={14} />
                      </button>
                      {c.status !== 'cancelled' && c.status !== 'ended' && (
                        <button
                          type="button"
                          onClick={() => handleToggleDelinquent(c)}
                          title={c.is_delinquent ? 'Remover inadimplência' : 'Marcar como inadimplente'}
                          className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                            c.is_delinquent
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100'
                              : 'bg-amber-50 border-amber-200 text-amber-600 hover:bg-amber-100'
                          }`}
                        >
                          {c.is_delinquent ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                        </button>
                      )}
                      {c.status !== 'cancelled' && c.status !== 'ended' && (
                        <button
                          type="button"
                          onClick={() => setConfirmCancelId(c.id)}
                          title="Cancelar contrato"
                          className="p-1.5 rounded-lg border bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100 transition-all cursor-pointer"
                        >
                          <XCircle size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: Editar valores */}
      {editingContract && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px]">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <h3 className="font-bold text-slate-800 text-sm">Editar Contrato — {editingContract.property_address}</h3>
              <button type="button" onClick={() => setEditingContract(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={18} />
              </button>
            </div>
            <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 mb-4">
              Alterações aqui só valem para as próximas parcelas geradas — não mudam parcelas que já existem.
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Valor do Aluguel (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editForm.monthly_rent ?? ''}
                  onChange={e => setEditForm(f => ({ ...f, monthly_rent: parseFloat(e.target.value) || 0 }))}
                  className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Taxa Corretagem (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.brokerage_fee_pct ?? ''}
                    onChange={e => setEditForm(f => ({ ...f, brokerage_fee_pct: parseFloat(e.target.value) || 0 }))}
                    className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Dia Vencimento</label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={editForm.day_of_month ?? ''}
                    onChange={e => setEditForm(f => ({ ...f, day_of_month: parseInt(e.target.value) || 1 }))}
                    className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Seguro Locatício</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.seguro_locaticio_value ?? ''}
                    onChange={e => setEditForm(f => ({ ...f, seguro_locaticio_value: parseFloat(e.target.value) || 0 }))}
                    className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Seguro Incêndio</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.seguro_incendio_value ?? ''}
                    onChange={e => setEditForm(f => ({ ...f, seguro_incendio_value: parseFloat(e.target.value) || 0 }))}
                    className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Outras Taxas</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.outras_taxas_value ?? ''}
                    onChange={e => setEditForm(f => ({ ...f, outras_taxas_value: parseFloat(e.target.value) || 0 }))}
                    className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Fim do Contrato (opcional)</label>
                <input
                  type="date"
                  value={editForm.end_date || ''}
                  onChange={e => setEditForm(f => ({ ...f, end_date: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setEditingContract(null)}
                className="flex-1 py-2.5 text-slate-500 bg-slate-50 hover:bg-slate-100 font-bold text-sm rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-black py-2.5 rounded-xl shadow-lg text-sm transition-all cursor-pointer disabled:opacity-50"
              >
                <Save size={14} />
                {savingEdit ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirmar cancelamento */}
      {confirmCancelId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px]">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-6">
            <h3 className="font-bold text-slate-800 text-sm mb-2">Cancelar este contrato?</h3>
            <p className="text-xs text-slate-500 mb-6">
              O contrato deixa de gerar novas parcelas automaticamente. As parcelas já existentes não são apagadas.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmCancelId(null)}
                className="flex-1 py-2.5 text-slate-500 bg-slate-50 hover:bg-slate-100 font-bold text-sm rounded-xl transition-all cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-black py-2.5 rounded-xl shadow-lg text-sm transition-all cursor-pointer"
              >
                Cancelar Contrato
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Ver parcelas */}
      {viewingInstallmentsFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px]">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <h3 className="font-bold text-slate-800 text-sm">Parcelas — {viewingInstallmentsFor.property_address}</h3>
              <button type="button" onClick={() => setViewingInstallmentsFor(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={18} />
              </button>
            </div>
            {loadingInstallments ? (
              <div className="p-6 text-center text-slate-400 text-xs">Carregando...</div>
            ) : installments.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs">Nenhuma parcela gerada ainda para este contrato.</div>
            ) : (
              <div className="space-y-2">
                {installments.map(inst => (
                  <div key={inst.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-xs font-semibold text-slate-600">{formatDateBR(inst.due_date)}</span>
                    <span className="text-sm font-bold text-slate-800">{formatCurrency(inst.expected_amount)}</span>
                    <span
                      className={`px-2 py-1 rounded-full text-[10px] font-black uppercase ${
                        inst.status === 'received'
                          ? 'bg-emerald-50 text-emerald-600'
                          : inst.status === 'overdue'
                          ? 'bg-rose-50 text-rose-600'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {inst.status === 'received' ? 'Recebido' : inst.status === 'overdue' ? 'Vencido' : inst.status === 'partial' ? 'Parcial' : 'Pendente'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
