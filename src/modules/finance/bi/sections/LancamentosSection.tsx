import React, { useMemo, useState } from 'react';
import { List, Search, ArrowUpDown, ChevronLeft, ChevronRight, ArrowLeftRight } from 'lucide-react';
import { FinancialTransaction, FinancialCategory } from '../../../../../types';
import { formatCurrency } from '../../utils/currency';
import { formatDateBR } from '../../utils/dates';
import { isPaid, isOverdue, isTransfer, getTodayStr } from '../calculations';

interface LancamentosSectionProps {
  transactions: FinancialTransaction[];
  categoriesById: Map<string, FinancialCategory>;
  onRowClick: (tx: FinancialTransaction) => void;
}

type SortKey = 'due_date' | 'amount' | 'description';
const PAGE_SIZE = 20;

const statusLabel = (tx: FinancialTransaction, today: string, categoriesById: Map<string, FinancialCategory>) => {
  if (isTransfer(tx, categoriesById)) return { text: 'Transferência', cls: 'bg-slate-100 text-slate-600' };
  if (isPaid(tx)) return { text: tx.type === 'INCOME' ? 'Recebido' : 'Pago', cls: 'bg-emerald-50 text-emerald-700' };
  if (isOverdue(tx, today)) return { text: 'Atrasado', cls: 'bg-red-50 text-red-600' };
  return { text: 'Em aberto', cls: 'bg-amber-50 text-amber-700' };
};

export const LancamentosSection: React.FC<LancamentosSectionProps> = ({ transactions, categoriesById, onRowClick }) => {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('due_date');
  const [asc, setAsc] = useState(false);
  const [page, setPage] = useState(0);
  const today = getTodayStr();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return transactions;
    return transactions.filter((t) => {
      const cat = t.category_id ? categoriesById.get(t.category_id)?.name : '';
      return (
        t.description?.toLowerCase().includes(q) ||
        t.contact_name?.toLowerCase().includes(q) ||
        cat?.toLowerCase().includes(q)
      );
    });
  }, [transactions, search, categoriesById]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let diff = 0;
      if (sortKey === 'due_date') diff = a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : 0;
      else if (sortKey === 'amount') diff = Number(a.amount) - Number(b.amount);
      else diff = (a.description || '').localeCompare(b.description || '', 'pt-BR');
      return asc ? diff : -diff;
    });
    return arr;
  }, [filtered, sortKey, asc]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages - 1);
  const paged = sorted.slice(pageSafe * PAGE_SIZE, pageSafe * PAGE_SIZE + PAGE_SIZE);

  const toggleSort = (key: SortKey) => {
    setPage(0);
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
    <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs p-5 md:p-6">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
            <List size={16} className="text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-700">Tabela de Lançamentos</h3>
            <p className="text-[11px] text-slate-400">{sorted.length} lançamento(s) com os filtros atuais</p>
          </div>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por descrição, pessoa ou categoria..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-xl w-72 max-w-full focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
          />
        </div>
      </div>

      <div className="border border-slate-100 rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[820px]">
          <thead className="bg-slate-50">
            <tr className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
              <th className="px-3 py-2">{headerBtn('Vencimento', 'due_date')}</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Categoria</th>
              <th className="px-3 py-2">{headerBtn('Descrição', 'description')}</th>
              <th className="px-3 py-2">Pessoa</th>
              <th className="px-3 py-2 text-right">{headerBtn('Valor', 'amount')}</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Pagto/Receb.</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((t) => {
              const cat = t.category_id ? categoriesById.get(t.category_id) : undefined;
              const st = statusLabel(t, today, categoriesById);
              const transfer = isTransfer(t, categoriesById);
              return (
                <tr key={t.id} className="border-t border-slate-50 hover:bg-blue-50/40 cursor-pointer" onClick={() => onRowClick(t)}>
                  <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{formatDateBR(t.due_date)}</td>
                  <td className="px-3 py-2">
                    {transfer ? (
                      <ArrowLeftRight size={13} className="text-slate-400" />
                    ) : (
                      <span className={t.type === 'INCOME' ? 'text-blue-700 font-semibold text-xs' : 'text-slate-500 font-semibold text-xs'}>
                        {t.type === 'INCOME' ? 'Receita' : 'Despesa'}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-500">{cat?.name || '—'}</td>
                  <td className="px-3 py-2 text-slate-700 max-w-[220px] truncate">{t.description}</td>
                  <td className="px-3 py-2 text-slate-500">{t.contact_name || '—'}</td>
                  <td className={`px-3 py-2 text-right font-semibold whitespace-nowrap ${t.type === 'INCOME' ? 'text-blue-700' : 'text-slate-700'}`}>
                    {formatCurrency(Number(t.amount))}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>{st.text}</span>
                  </td>
                  <td className="px-3 py-2 text-slate-400 whitespace-nowrap">{formatDateBR(t.payment_date) || '—'}</td>
                </tr>
              );
            })}
            {paged.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-xs text-slate-400">
                  Nenhum lançamento encontrado com os filtros atuais.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-3 text-xs text-slate-500">
        <span>
          Página {pageSafe + 1} de {totalPages}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={pageSafe === 0}
            onClick={() => setPage(pageSafe - 1)}
            className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center disabled:opacity-30 hover:bg-slate-50"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            type="button"
            disabled={pageSafe >= totalPages - 1}
            onClick={() => setPage(pageSafe + 1)}
            className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center disabled:opacity-30 hover:bg-slate-50"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
