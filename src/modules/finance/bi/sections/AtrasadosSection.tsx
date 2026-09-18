import React, { useMemo, useState } from 'react';
import { AlertTriangle, ArrowUpDown } from 'lucide-react';
import { FinancialTransaction, FinancialCategory } from '../../../../../types';
import { formatCurrency } from '../../utils/currency';
import { formatDateBR } from '../../utils/dates';
import { daysLate, getTodayStr } from '../calculations';

interface AtrasadosSectionProps {
  atrasadosReceber: FinancialTransaction[];
  atrasadosPagar: FinancialTransaction[];
  categoriesById: Map<string, FinancialCategory>;
  onRowClick: (tx: FinancialTransaction) => void;
}

type SortKey = 'dias' | 'valor' | 'vencimento';

const SubTable: React.FC<{
  titulo: string;
  rows: FinancialTransaction[];
  categoriesById: Map<string, FinancialCategory>;
  today: string;
  onRowClick: (tx: FinancialTransaction) => void;
  tone: 'blue' | 'red';
}> = ({ titulo, rows, categoriesById, today, onRowClick, tone }) => {
  const [sortKey, setSortKey] = useState<SortKey>('dias');
  const [asc, setAsc] = useState(false);

  const sorted = useMemo(() => {
    const arr = [...rows];
    arr.sort((a, b) => {
      let diff = 0;
      if (sortKey === 'dias') diff = daysLate(a.due_date, today) - daysLate(b.due_date, today);
      else if (sortKey === 'valor') diff = Number(a.amount) - Number(b.amount);
      else diff = a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : 0;
      return asc ? diff : -diff;
    });
    return arr;
  }, [rows, sortKey, asc, today]);

  const total = rows.reduce((a, t) => a + Number(t.amount || 0), 0);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setAsc(!asc);
    else {
      setSortKey(key);
      setAsc(false);
    }
  };

  const headerBtn = (label: string, key: SortKey) => (
    <button type="button" onClick={() => toggleSort(key)} className="flex items-center gap-1 hover:text-slate-700">
      {label} <ArrowUpDown size={10} />
    </button>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-bold text-slate-600">{titulo}</p>
        <p className={`text-xs font-bold ${tone === 'red' ? 'text-red-600' : 'text-blue-700'}`}>
          {rows.length} lançamento(s) · {formatCurrency(total)}
        </p>
      </div>
      <div className="border border-slate-100 rounded-xl overflow-hidden">
        {sorted.length === 0 ? (
          <div className="p-5 text-center text-xs text-slate-400">Nenhum lançamento atrasado. 🎉</div>
        ) : (
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                  <th className="px-3 py-2">Pessoa</th>
                  <th className="px-3 py-2">Categoria</th>
                  <th className="px-3 py-2 text-right">{headerBtn('Valor', 'valor')}</th>
                  <th className="px-3 py-2">{headerBtn('Vencimento', 'vencimento')}</th>
                  <th className="px-3 py-2 text-right">{headerBtn('Dias atraso', 'dias')}</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((t) => {
                  const cat = t.category_id ? categoriesById.get(t.category_id) : undefined;
                  return (
                    <tr key={t.id} className="border-t border-slate-50 hover:bg-red-50/30 cursor-pointer" onClick={() => onRowClick(t)}>
                      <td className="px-3 py-2 text-slate-700">{t.contact_name || '—'}</td>
                      <td className="px-3 py-2 text-slate-500">{cat?.name || '—'}</td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-800">{formatCurrency(Number(t.amount))}</td>
                      <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{formatDateBR(t.due_date)}</td>
                      <td className="px-3 py-2 text-right">
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600">
                          {daysLate(t.due_date, today)}d
                        </span>
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

export const AtrasadosSection: React.FC<AtrasadosSectionProps> = ({
  atrasadosReceber,
  atrasadosPagar,
  categoriesById,
  onRowClick,
}) => {
  const today = getTodayStr();
  return (
    <div className="bg-white border border-red-100 rounded-2xl shadow-2xs p-5 md:p-6">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center">
          <AlertTriangle size={16} className="text-red-600" />
        </div>
        <h3 className="text-sm font-bold text-slate-700">Atenção — Contas em atraso</h3>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <SubTable
          titulo="Recebimentos atrasados"
          rows={atrasadosReceber}
          categoriesById={categoriesById}
          today={today}
          onRowClick={onRowClick}
          tone="blue"
        />
        <SubTable
          titulo="Pagamentos atrasados"
          rows={atrasadosPagar}
          categoriesById={categoriesById}
          today={today}
          onRowClick={onRowClick}
          tone="red"
        />
      </div>
    </div>
  );
};
