import React from 'react';
import { Filter, X, Search } from 'lucide-react';
import { Category, FilterOptions } from '../types';

interface ExpenseFiltersProps {
  filters: FilterOptions;
  categories: Category[];
  suppliers: string[];
  onChangeFilters: (filters: FilterOptions) => void;
  onResetFilters: () => void;
}

export const ExpenseFilters: React.FC<ExpenseFiltersProps> = ({
  filters,
  categories,
  suppliers,
  onChangeFilters,
  onResetFilters,
}) => {
  const isFiltered =
    filters.search ||
    filters.categoryId ||
    filters.supplier ||
    filters.type !== 'TODAS' ||
    filters.status !== 'TODAS' ||
    filters.minAmount !== undefined ||
    filters.maxAmount !== undefined;

  return (
    <div className="bg-white border border-slate-200/90 rounded-xl p-4 mb-4 space-y-3 shadow-2xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
          <Filter className="w-4 h-4 text-blue-600" />
          <span>Filtros de Pesquisa</span>
        </div>
        {isFiltered && (
          <button
            onClick={onResetFilters}
            className="flex items-center gap-1 text-xs text-rose-600 hover:underline cursor-pointer font-medium"
          >
            <X className="w-3.5 h-3.5" />
            Limpar Filtros
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Search */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">
            Descrição / Histórico
          </label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => onChangeFilters({ ...filters, search: e.target.value })}
              placeholder="Buscar..."
              className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-2.5 text-xs text-slate-800 focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>
        </div>

        {/* Category */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">
            Categoria
          </label>
          <select
            value={filters.categoryId}
            onChange={(e) => onChangeFilters({ ...filters, categoryId: e.target.value })}
            className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-2.5 text-xs text-slate-800 focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer transition-all"
          >
            <option value="">Todas as Categorias</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Supplier */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">
            Fornecedor
          </label>
          <select
            value={filters.supplier}
            onChange={(e) => onChangeFilters({ ...filters, supplier: e.target.value })}
            className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-2.5 text-xs text-slate-800 focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer transition-all"
          >
            <option value="">Todos os Fornecedores</option>
            {suppliers.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {/* Type */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">
            Tipo de Despesa
          </label>
          <select
            value={filters.type}
            onChange={(e) =>
              onChangeFilters({
                ...filters,
                type: e.target.value as FilterOptions['type'],
              })
            }
            className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-2.5 text-xs text-slate-800 focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer transition-all"
          >
            <option value="TODAS">Todas (Fixas e Var.)</option>
            <option value="FIXA">Apenas Fixas</option>
            <option value="VARIAVEL">Apenas Variáveis</option>
          </select>
        </div>

        {/* Status */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">
            Status Pagamento
          </label>
          <select
            value={filters.status}
            onChange={(e) =>
              onChangeFilters({
                ...filters,
                status: e.target.value as FilterOptions['status'],
              })
            }
            className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-2.5 text-xs text-slate-800 focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer transition-all"
          >
            <option value="TODAS">Todos (Pago/Pendente)</option>
            <option value="PAGO">Pago</option>
            <option value="PENDENTE">Pendente</option>
          </select>
        </div>

        {/* Amount Range */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">
            Valor Min / Max
          </label>
          <div className="flex items-center gap-1">
            <input
              type="number"
              placeholder="Mín"
              value={filters.minAmount ?? ''}
              onChange={(e) =>
                onChangeFilters({
                  ...filters,
                  minAmount: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              className="w-1/2 h-9 bg-slate-50 border border-slate-200 rounded-lg px-2 text-xs text-slate-800 focus:outline-hidden focus:bg-white focus:border-blue-500 transition-all"
            />
            <span className="text-slate-400 text-xs">-</span>
            <input
              type="number"
              placeholder="Máx"
              value={filters.maxAmount ?? ''}
              onChange={(e) =>
                onChangeFilters({
                  ...filters,
                  maxAmount: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              className="w-1/2 h-9 bg-slate-50 border border-slate-200 rounded-lg px-2 text-xs text-slate-800 focus:outline-hidden focus:bg-white focus:border-blue-500 transition-all"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
