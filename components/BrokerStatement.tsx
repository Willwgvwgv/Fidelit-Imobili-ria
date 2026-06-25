import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, X, AlertCircle, RefreshCw } from 'lucide-react';
import { BrokerEntry, BrokerEntryType, User } from '../types';
import { supabaseService } from '../services/supabaseService';

interface BrokerStatementProps {
  broker: User;
  agencyId: string;
  commissionTotal: number; // total de comissões de vendas do corretor
  onClose: () => void;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const TYPE_CONFIG = {
  COMMISSION: { label: 'Comissão de venda', textClass: 'text-indigo-700 bg-indigo-50 border-indigo-100', sign: 1 },
  CREDIT:     { label: 'Crédito',           textClass: 'text-emerald-700 bg-emerald-50 border-emerald-100', sign: 1 },
  DEBIT:      { label: 'Desconto',          textClass: 'text-red-750 bg-red-50 border-red-100', sign: -1 },
  PAYMENT:    { label: 'Pagamento',         textClass: 'text-sky-700 bg-sky-50 border-sky-100', sign: -1 },
};

const BrokerStatement: React.FC<BrokerStatementProps> = ({ broker, agencyId, commissionTotal, onClose }) => {
  const [entries, setEntries] = useState<BrokerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<BrokerEntryType>('CREDIT');
  const [formDesc, setFormDesc] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadEntries();
  }, [broker.id]);

  const loadEntries = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await supabaseService.getBrokerEntries(agencyId, broker.id);
      setEntries(data);
    } catch (err: any) {
      console.error(err);
      setError('Não foi possível carregar os lançamentos. Verifique se a tabela broker_entries existe no seu banco de dados.');
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    let totalCredits = commissionTotal; // comissões de vendas já contam como crédito
    let totalDebits = 0;

    entries.forEach(e => {
      const sign = TYPE_CONFIG[e.type]?.sign || 1;
      if (sign > 0) totalCredits += e.amount;
      else totalDebits += e.amount;
    });

    return {
      totalCredits,
      totalDebits,
      balance: totalCredits - totalDebits
    };
  }, [entries, commissionTotal]);

  const handleSave = async () => {
    setError(null);
    const amount = parseFloat(formAmount.replace(',', '.'));
    if (!formDesc.trim() || isNaN(amount) || amount <= 0) {
      setError('Por favor, preencha a descrição e um valor maior que zero.');
      return;
    }
    setSaving(true);
    try {
      const entry = await supabaseService.createBrokerEntry({
        agency_id: agencyId,
        broker_id: broker.id,
        broker_name: broker.name,
        type: formType,
        description: formDesc.trim(),
        amount,
        date: formDate,
        sale_id: null
      });
      if (entry) {
        setEntries(prev => [entry, ...prev]);
        setFormDesc('');
        setFormAmount('');
        setShowForm(false);
      } else {
        setError('Erro ao criar o lançamento no banco de dados. Verifique a tabela broker_entries.');
      }
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro ao salvar o lançamento.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remover este lançamento?')) return;
    setError(null);
    try {
      const ok = await supabaseService.deleteBrokerEntry(id);
      if (ok) {
        setEntries(prev => prev.filter(e => e.id !== id));
      } else {
        setError('Não foi possível remover o lançamento.');
      }
    } catch (err: any) {
      setError('Erro ao deletar o lançamento.');
    }
  };

  return (
    <div className="max-w-2xl mx-auto font-sans bg-slate-50/50 rounded-2xl p-5 border border-slate-100">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-sm">
            {broker.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-800 leading-none">{broker.name}</h3>
              {!loading && stats.balance > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.balance)} a receber
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1">Extrato de conta corrente</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 h-9 px-3 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-all shadow-sm"
          >
            <Plus size={14} /> Novo lançamento
          </button>
          <button
            onClick={onClose}
            aria-label="Fechar extrato"
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3.5 bg-red-50 border border-red-150 rounded-xl text-xs text-red-700 mb-4 font-medium leading-relaxed">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p>{error}</p>
            <p className="text-[10px] text-red-500/90 font-normal">
              Nota: Certifique-se de executar o SCRIPT SQL fornecido no rodapé da página para criar a tabela se ainda não o fez.
            </p>
          </div>
        </div>
      )}

      {/* Cards de resumo */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white border border-slate-100 rounded-xl p-3 shadow-xs">
          <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1">Total a receber</p>
          <p className="text-base font-bold text-emerald-600">{formatCurrency(stats.totalCredits)}</p>
        </div>
        <div className="bg-white border border-slate-100 rounded-xl p-3 shadow-xs">
          <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1">Total descontado</p>
          <p className="text-base font-bold text-rose-600">{formatCurrency(stats.totalDebits)}</p>
        </div>
        <div className="bg-white border border-slate-100 rounded-xl p-3 shadow-xs">
          <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1">Saldo atual</p>
          <p className={`text-base font-bold ${stats.balance >= 0 ? 'text-indigo-600' : 'text-rose-700'}`}>
            {formatCurrency(stats.balance)}
          </p>
        </div>
      </div>

      {/* Formulário novo lançamento */}
      {showForm && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 mb-5 space-y-3 shadow-sm animate-in slide-in-from-top-1 duration-200">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Novo lançamento manual</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Tipo</label>
              <select
                value={formType}
                onChange={e => setFormType(e.target.value as BrokerEntryType)}
                className="w-full h-9 px-2 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-indigo-400 transition-colors"
              >
                <option value="CREDIT">Crédito</option>
                <option value="DEBIT">Desconto</option>
                <option value="PAYMENT">Pagamento</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Descrição</label>
              <input
                type="text"
                placeholder="Ex: Adiantamento"
                value={formDesc}
                onChange={e => setFormDesc(e.target.value)}
                className="w-full h-9 px-2 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-indigo-400 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Valor (R$)</label>
              <input
                type="text"
                placeholder="0,00"
                value={formAmount}
                onChange={e => setFormAmount(e.target.value)}
                className="w-full h-9 px-2 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-indigo-400 transition-colors"
              />
            </div>
          </div>
          <div className="flex items-end justify-between gap-3 pt-1">
            <div className="w-1/2">
              <label className="block text-xs font-semibold text-slate-500 mb-1">Data</label>
              <input
                type="date"
                value={formDate}
                onChange={e => setFormDate(e.target.value)}
                className="w-full h-9 px-2 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-indigo-400 transition-colors"
              />
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="h-9 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-all shadow-xs flex items-center justify-center gap-1"
            >
              {saving ? (
                <>
                  <RefreshCw className="animate-spin" size={12} />
                  Salvando...
                </>
              ) : (
                'Registrar Lançamento'
              )}
            </button>
          </div>
        </div>
      )}

      {/* Lista de lançamentos */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 font-bold text-[10px] text-slate-400 uppercase tracking-widest">
          Lançamentos
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400 font-medium">Carregando...</div>
        ) : entries.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 font-medium space-y-1">
            <p>Nenhum lançamento manual ainda.</p>
            <p className="text-[10px] text-slate-350">Comissões de vendas reais não contam como lançamento manual, mas já aparecem somadas no Total a Receber acima.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-150">
            {entries.map((e) => {
              const cfg = TYPE_CONFIG[e.type] || { label: e.type, textClass: 'text-slate-600 bg-slate-50 border-slate-100', sign: 1 };
              const isCredit = cfg.sign > 0;
              return (
                <div key={e.id} className="flex items-center justify-between p-4 hover:bg-slate-50/40 transition-colors">
                  <div className="flex flex-col gap-1">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border w-fit leading-none ${cfg.textClass}`}>
                      {cfg.label}
                    </span>
                    <span className="text-sm font-semibold text-slate-800">{e.description}</span>
                    <span className="text-[11px] text-slate-400 font-medium">
                      {new Date(e.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-bold ${isCredit ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {isCredit ? '+' : '-'} {formatCurrency(e.amount)}
                    </span>
                    {e.type !== 'COMMISSION' && (
                      <button
                        onClick={() => handleDelete(e.id)}
                        aria-label="Remover lançamento"
                        className="p-1 px-1.5 text-slate-300 hover:text-rose-500 rounded hover:bg-rose-50/50 transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default BrokerStatement;
