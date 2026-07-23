import React from 'react';
import {
  Repeat,
  PlusCircle,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
  Zap,
} from 'lucide-react';
import { Category, FixedExpense } from '../types';
import { formatCurrency } from '../utils/formatters';

interface FixedExpensesPageProps {
  fixedExpenses: FixedExpense[];
  categories: Category[];
  onNewFixedExpense: () => void;
  onEditFixedExpense: (exp: FixedExpense) => void;
  onDeleteFixedExpense: (id: string) => void;
  onToggleActive: (id: string) => void;
}

export const FixedExpensesPage: React.FC<FixedExpensesPageProps> = ({
  fixedExpenses,
  categories,
  onNewFixedExpense,
  onEditFixedExpense,
  onDeleteFixedExpense,
  onToggleActive,
}) => {
  const categoryMap = new Map<string, Category>(categories.map((c) => [c.id, c]));

  const totalActiveFixed = fixedExpenses
    .filter((f) => f.active)
    .reduce((acc, f) => acc + f.defaultAmount, 0);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white border border-slate-200/90 rounded-xl p-5 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Repeat className="w-5 h-5 text-blue-600" />
              Matriz de Despesas Fixas
            </h2>
            <span className="text-[11px] bg-amber-50 text-amber-700 font-bold px-2.5 py-0.5 rounded-md flex items-center gap-1 border border-amber-200/80">
              <Zap className="w-3 h-3 text-amber-600" />
              Recorrência Automática
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Cadastre uma única vez. Ao abrir um novo mês, as despesas ativas são copiadas automaticamente.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden md:block">
            <span className="text-[10px] font-semibold uppercase text-slate-400 block">
              Orçamento Mensal Fixa
            </span>
            <span className="text-lg font-bold text-blue-600 font-mono">
              {formatCurrency(totalActiveFixed)}
            </span>
          </div>

          <button
            onClick={onNewFixedExpense}
            className="h-10 flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs px-4 rounded-lg transition-all shadow-2xs cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Nova Despesa Fixa</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200/90 rounded-xl shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200">
                <th className="py-3 px-4">Status / Ativa</th>
                <th className="py-3 px-4 min-w-[200px]">Nome da Despesa</th>
                <th className="py-3 px-4">Categoria</th>
                <th className="py-3 px-4">Fornecedor</th>
                <th className="py-3 px-4 text-center">Dia Venc.</th>
                <th className="py-3 px-4 text-right">Valor Padrão</th>
                <th className="py-3 px-4">Centro Custo</th>
                <th className="py-3 px-4 text-center w-24">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {fixedExpenses.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Nenhuma despesa fixa cadastrada.
                  </td>
                </tr>
              ) : (
                fixedExpenses.map((exp) => {
                  const cat = categoryMap.get(exp.categoryId);
                  return (
                    <tr
                      key={exp.id}
                      className={`hover:bg-slate-50/80 transition ${
                        !exp.active ? 'opacity-50 bg-slate-50/50' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <button
                          onClick={() => onToggleActive(exp.id)}
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition ${
                            exp.active
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                              : 'bg-slate-100 text-slate-500 border border-slate-200'
                          }`}
                        >
                          {exp.active ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Ativa
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3 text-slate-400" />
                              Inativa
                            </>
                          )}
                        </button>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        {exp.name}
                      </td>
                      <td className="py-3 px-4">
                        {cat ? (
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium"
                            style={{
                              backgroundColor: `${cat.color}15`,
                              color: cat.color,
                              border: `1px solid ${cat.color}30`,
                            }}
                          >
                            {cat.name}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {exp.supplier || '-'}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-slate-700 font-mono">
                        Dia {exp.dueDay}
                      </td>
                      <td className="py-3 px-4 text-right font-bold font-mono text-slate-900">
                        {formatCurrency(exp.defaultAmount)}
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-[11px]">
                        {exp.costCenter || '-'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => onEditFixedExpense(exp)}
                            className="p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDeleteFixedExpense(exp.id)}
                            className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
