import React from 'react';
import { FinancialTransaction, TransactionStatus } from '../../../../types';
import { formatCurrency } from '../utils/currency';
import { getLocalTodayStr } from '../utils/dates';
import { X, AlertTriangle, Clock, Calendar, TrendingUp } from 'lucide-react';

interface FinancialKpiHeaderCardsProps {
  transactions?: FinancialTransaction[];
  selectedMonth?: Date;
  onCardClick?: (filterId: string | null) => void;
  activeFilter?: string | null;
}

const getDaysDiff = (dateStr1: string, dateStr2: string) => {
  if (!dateStr1 || !dateStr2) return 0;
  const d1 = new Date(dateStr1 + 'T12:00:00');
  const d2 = new Date(dateStr2 + 'T12:00:00');
  const diffTime = d1.getTime() - d2.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
};

export const FinancialKpiHeaderCards: React.FC<FinancialKpiHeaderCardsProps> = ({
  transactions = [],
  selectedMonth = new Date(),
  onCardClick,
  activeFilter,
}) => {
  const hoje = getLocalTodayStr();
  const selYear = selectedMonth.getFullYear();
  const selMonthIdx = selectedMonth.getMonth();
  const monthName = selectedMonth.toLocaleString('pt-BR', { month: 'long' });

  const isInSelectedMonth = (dateStr: string) => {
    if (!dateStr) return false;
    const parts = dateStr.split('-');
    if (parts.length !== 3) return false;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    return y === selYear && m === selMonthIdx;
  };

  // 1. Vencidos (global)
  const txsVencidos = transactions.filter(
    (t) => t.status === TransactionStatus.PENDING && t.due_date < hoje
  );

  // 2. Vence Hoje (global)
  const txsHoje = transactions.filter(
    (t) => t.status === TransactionStatus.PENDING && t.due_date === hoje
  );

  // 3. Próximos 7 dias (global)
  const txsSeteDias = transactions.filter(
    (t) =>
      t.status === TransactionStatus.PENDING &&
      getDaysDiff(t.due_date, hoje) > 0 &&
      getDaysDiff(t.due_date, hoje) <= 7
  );

  // 4. A Vencer / A Receber (mês selecionado, excluindo hoje e próximos 7 dias pra não duplicar)
  const txsAVencerReceber = transactions.filter(
    (t) =>
      t.status === TransactionStatus.PENDING &&
      isInSelectedMonth(t.due_date) &&
      getDaysDiff(t.due_date, hoje) >= 8
  );

  const countVencidos = txsVencidos.length;
  const sumVencidos = txsVencidos.reduce((a, b) => a + (Number(b.amount) || 0), 0);

  const countHoje = txsHoje.length;
  const sumHoje = txsHoje.reduce((a, b) => a + (Number(b.amount) || 0), 0);

  const countSeteDias = txsSeteDias.length;
  const sumSeteDias = txsSeteDias.reduce((a, b) => a + (Number(b.amount) || 0), 0);

  const countAVencerReceber = txsAVencerReceber.length;
  const sumAVencerReceber = txsAVencerReceber.reduce((a, b) => a + (Number(b.amount) || 0), 0);

  const monthLabelUpper = monthName.toUpperCase();

  const cards = [
    {
      id: 'vencidos',
      title: 'Vencidos',
      count: countVencidos,
      amount: sumVencidos,
      sub: 'TODOS EM ATRASO',
      icon: <AlertTriangle size={16} />,
      iconBg: 'bg-red-100 text-red-600',
      activeBorder: 'border-2 border-red-500 ring-2 ring-red-100',
    },
    {
      id: 'hoje',
      title: 'Vence Hoje',
      count: countHoje,
      amount: sumHoje,
      sub: 'VENCIMENTOS DE HOJE',
      icon: <Clock size={16} />,
      iconBg: 'bg-amber-100 text-amber-600',
      activeBorder: 'border-2 border-amber-500 ring-2 ring-amber-100',
    },
    {
      id: 'proximos7',
      title: 'Próximos 7 dias',
      count: countSeteDias,
      amount: sumSeteDias,
      sub: 'PRÓXIMOS 7 DIAS',
      icon: <Calendar size={16} />,
      iconBg: 'bg-blue-100 text-blue-600',
      activeBorder: 'border-2 border-blue-500 ring-2 ring-blue-100',
    },
    {
      id: 'avencer',
      title: 'A Vencer / A Receber',
      count: countAVencerReceber,
      amount: sumAVencerReceber,
      sub: `DE ${monthLabelUpper}`,
      icon: <TrendingUp size={16} />,
      iconBg: 'bg-emerald-100 text-emerald-600',
      activeBorder: 'border-2 border-emerald-500 ring-2 ring-emerald-100',
    },
  ];

  const activeCardObj = cards.find(
    (c) =>
      c.id === activeFilter ||
      c.id === activeFilter?.toLowerCase() ||
      (activeFilter === 'A VENCER' && c.id === 'avencer') ||
      (activeFilter === 'VENCIDOS' && c.id === 'vencidos') ||
      (activeFilter === 'VENCEM HOJE' && c.id === 'hoje')
  );

  return (
    <div className="space-y-3">
      {activeFilter && (
        <div className="flex items-center justify-between bg-blue-50 border border-blue-100 px-4 py-2 rounded-2xl animate-fadeIn">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
            <span className="text-xs font-semibold text-slate-700">
              Filtro ativo: <span className="font-bold text-blue-900">{activeCardObj?.title || activeFilter}</span>
            </span>
          </div>
          <button
            type="button"
            onClick={() => onCardClick && onCardClick(null)}
            className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900 bg-white hover:bg-blue-50 px-3 py-1 rounded-xl border border-blue-200 transition-all cursor-pointer shadow-xs"
          >
            <X size={13} /> Limpar filtro
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => {
          const isSelected =
            activeFilter === card.id ||
            activeFilter?.toLowerCase() === card.id ||
            (activeFilter === 'A VENCER' && card.id === 'avencer') ||
            (activeFilter === 'VENCIDOS' && card.id === 'vencidos') ||
            (activeFilter === 'VENCEM HOJE' && card.id === 'hoje');

          return (
            <button
              key={card.id}
              type="button"
              onClick={() => {
                if (onCardClick) {
                  onCardClick(isSelected ? null : card.id);
                }
              }}
              className={`text-left w-full bg-white p-5 rounded-2xl flex flex-col justify-between transition-all cursor-pointer ${
                isSelected
                  ? card.activeBorder + ' shadow-md'
                  : 'border border-slate-200 shadow-2xs hover:border-slate-300 hover:shadow-xs'
              }`}
            >
              <div className="flex justify-between items-center w-full">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-xl ${card.iconBg} flex items-center justify-center font-bold shrink-0`}>
                    {card.icon}
                  </div>
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                    {card.title}
                  </span>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {card.count}
                </span>
              </div>
              <div className="mt-3 w-full">
                <h3 className="text-[24px] font-bold text-slate-900 tracking-tight leading-none">
                  {formatCurrency(card.amount)}
                </h3>
                <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mt-1.5">
                  {card.sub}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

