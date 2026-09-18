import React, { useMemo } from 'react';
import { Filter, X, Calendar } from 'lucide-react';
import { FinancialCategory, FinancialTransaction } from '../../../../../types';
import { BIFilters, DEFAULT_FILTERS, PeriodoPreset, TipoFiltro, StatusFiltro } from '../types';

interface FiltersBarProps {
  filters: BIFilters;
  onChange: (f: BIFilters) => void;
  categories: FinancialCategory[];
  transactions: FinancialTransaction[];
}

const PERIODO_OPTIONS: { value: PeriodoPreset; label: string }[] = [
  { value: 'hoje', label: 'Hoje' },
  { value: 'semana', label: 'Esta semana' },
  { value: 'mes', label: 'Este mês' },
  { value: 'mes_anterior', label: 'Mês anterior' },
  { value: 'proximo_mes', label: 'Próximo mês' },
  { value: 'ano', label: 'Este ano' },
  { value: 'personalizado', label: 'Personalizado' },
  { value: 'todos', label: 'Todo o período' },
];

const TIPO_OPTIONS: { value: TipoFiltro; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'INCOME', label: 'Contas a receber' },
  { value: 'EXPENSE', label: 'Contas a pagar' },
];

const STATUS_OPTIONS: { value: StatusFiltro; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'pago_recebido', label: 'Pago / Recebido' },
  { value: 'em_aberto', label: 'Em aberto' },
  { value: 'atrasado', label: 'Atrasado' },
  { value: 'pendente', label: 'Pendente (aberto + atrasado)' },
];

const baseSelect =
  'w-full text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400';

export const FiltersBar: React.FC<FiltersBarProps> = ({ filters, onChange, categories, transactions }) => {
  const pessoas = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach((t) => {
      if (t.contact_name) set.add(t.contact_name);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [transactions]);

  const categoriasFiltradas = useMemo(() => {
    let list = categories;
    if (filters.tipo !== 'todos') list = list.filter((c) => c.type === filters.tipo);
    return [...list].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [categories, filters.tipo]);

  const set = <K extends keyof BIFilters>(key: K, value: BIFilters[K]) => {
    onChange({ ...filters, [key]: value });
  };

  const isDefault = JSON.stringify(filters) === JSON.stringify(DEFAULT_FILTERS);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs p-4 md:p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-slate-700 font-semibold text-sm">
          <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <Filter size={15} />
          </div>
          Filtros
        </div>
        {!isDefault && (
          <button
            type="button"
            onClick={() => onChange(DEFAULT_FILTERS)}
            className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-xl transition-colors"
          >
            <X size={13} /> Limpar filtros
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Período</label>
          <select className={baseSelect} value={filters.periodo} onChange={(e) => set('periodo', e.target.value as PeriodoPreset)}>
            {PERIODO_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Tipo</label>
          <select className={baseSelect} value={filters.tipo} onChange={(e) => set('tipo', e.target.value as TipoFiltro)}>
            {TIPO_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Status</label>
          <select className={baseSelect} value={filters.status} onChange={(e) => set('status', e.target.value as StatusFiltro)}>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Categoria</label>
          <select className={baseSelect} value={filters.categoriaId} onChange={(e) => set('categoriaId', e.target.value)}>
            <option value="todas">Todas</option>
            {categoriasFiltradas.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Pessoa</label>
          <select className={baseSelect} value={filters.pessoa} onChange={(e) => set('pessoa', e.target.value)}>
            <option value="todas">Todas</option>
            {pessoas.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        {filters.periodo === 'personalizado' && (
          <div className="col-span-2 sm:col-span-1 lg:col-span-1">
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1 flex items-center gap-1">
              <Calendar size={11} /> Intervalo
            </label>
            <div className="flex gap-1.5">
              <input
                type="date"
                className={baseSelect + ' px-2'}
                value={filters.dataInicioCustom}
                onChange={(e) => set('dataInicioCustom', e.target.value)}
              />
              <input
                type="date"
                className={baseSelect + ' px-2'}
                value={filters.dataFimCustom}
                onChange={(e) => set('dataFimCustom', e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      <p className="mt-3 text-[11px] text-slate-400">
        O filtro de período é aplicado sobre a data de vencimento dos lançamentos. Forma de pagamento não é exibida como filtro
        porque não existe esse campo na tabela de lançamentos financeiros do Comissione hoje.
      </p>
    </div>
  );
};
