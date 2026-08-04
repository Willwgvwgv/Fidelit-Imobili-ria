import React from 'react';
import { FinancialTransaction, TransactionStatus, TransactionType } from '../../../../types';
import { formatCurrency } from '../utils/currency';
import { X } from 'lucide-react';

interface FinancialKpiHeaderCardsProps {
  transactions?: FinancialTransaction[];
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
  onCardClick,
  activeFilter,
}) => {
  const hoje = new Date().toISOString().split('T')[0];

  const txsVencidos = transactions.filter(
    (t) => t.status === TransactionStatus.PENDING && t.due_date < hoje
  );
  const txsHoje = transactions.filter(
    (t) => t.status === TransactionStatus.PENDING && t.due_date === hoje
  );
  const txsSeteDias = transactions.filter(
    (t) =>
      t.status === TransactionStatus.PENDING &&
      getDaysDiff(t.due_date, hoje) > 0 &&
      getDaysDiff(t.due_date, hoje) <= 7
  );
  const txsAVencerReceber = transactions.filter(
    (t) =>
      t.status === TransactionStatus.PENDING &&
      (getDaysDiff(t.due_date, hoje) >= 8 || t.type === TransactionType.INCOME || t.due_date > hoje)
  );

  const countVencidos = txsVencidos.length;
  const sumVencidos = txsVencidos.reduce((a, b) => a + (Number(b.amount) || 0), 0);

  const countHoje = txsHoje.length;
  const sumHoje = txsHoje.reduce((a, b) => a + (Number(b.amount) || 0), 0);

  const countSeteDias = txsSeteDias.length;
  const sumSeteDias = txsSeteDias.reduce((a, b) => a + (Number(b.amount) || 0), 0);

  const countAVencerReceber = txsAVencerReceber.length;
  const sumAVencerReceber = txsAVencerReceber.reduce((a, b) => a + (Number(b.amount) || 0), 0);

  const cards = [
    {
      id: 'vencidos',
      title: 'Vencidos',
      count: countVencidos,
      amount: sumVencidos,
      sub: 'Contas em atraso',
      bgColor: 'bg-rose-50/60',
      borderColor: 'border-rose-100',
      textColor: 'text-rose-800',
      numColor: 'text-rose-950',
      badgeBg: 'bg-rose-100 text-rose-800',
      activeBorder: 'border-2 border-rose-500 ring-2 ring-rose-200',
    },
    {
      id: 'hoje',
      title: 'Vence Hoje',
      count: countHoje,
      amount: sumHoje,
      sub: 'Vencimentos de hoje',
      bgColor: 'bg-orange-50/60',
      borderColor: 'border-orange-100',
      textColor: 'text-orange-800',
      numColor: 'text-orange-950',
      badgeBg: 'bg-orange-100 text-orange-800',
      activeBorder: 'border-2 border-orange-500 ring-2 ring-orange-200',
    },
    {
      id: 'proximos7',
      title: 'Próximos 7 dias',
      count: countSeteDias,
      amount: sumSeteDias,
      sub: 'Vencimentos na semana',
      bgColor: 'bg-amber-50/60',
      borderColor: 'border-amber-100',
      textColor: 'text-amber-800',
      numColor: 'text-amber-950',
      badgeBg: 'bg-amber-100 text-amber-800',
      activeBorder: 'border-2 border-amber-500 ring-2 ring-amber-200',
    },
    {
      id: 'avencer',
      title: 'A Vencer / A Receber',
      count: countAVencerReceber,
      amount: sumAVencerReceber,
      sub: 'Entradas e a vencer',
      bgColor: 'bg-emerald-50/60',
      borderColor: 'border-emerald-100',
      textColor: 'text-emerald-800',
      numColor: 'text-emerald-950',
      badgeBg: 'bg-emerald-100 text-emerald-800',
      activeBorder: 'border-2 border-emerald-500 ring-2 ring-emerald-200',
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
        <div className="flex items-center justify-between bg-indigo-50/80 border border-indigo-100 px-4 py-2 rounded-2xl animate-fadeIn">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse" />
            <span className="text-xs font-bold text-slate-700">
              Filtro ativo: <span className="font-black text-indigo-900">{activeCardObj?.title || activeFilter}</span>
            </span>
          </div>
          <button
            type="button"
            onClick={() => onCardClick && onCardClick(null)}
            className="flex items-center gap-1.5 text-xs font-black text-indigo-700 hover:text-indigo-900 bg-white hover:bg-indigo-100 px-3 py-1 rounded-xl border border-indigo-200 transition-all shadow-2xs cursor-pointer"
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
              className={`text-left w-full ${card.bgColor} p-5 rounded-3xl flex flex-col justify-between transition-all cursor-pointer ${
                isSelected
                  ? card.activeBorder + ' shadow-md scale-[1.02]'
                  : 'border ' + card.borderColor + ' shadow-xs hover:border-slate-300 hover:shadow-md'
              }`}
            >
              <div className="flex justify-between items-start w-full">
                <span className={`text-[10px] font-black uppercase tracking-widest ${card.textColor}`}>
                  {card.title}
                </span>
                <span className={`text-xs font-black px-2 py-0.5 rounded-full ${card.badgeBg}`}>
                  {card.count}
                </span>
              </div>
              <div className="mt-3 w-full">
                <h3 className={`text-2xl font-black ${card.numColor}`}>
                  {formatCurrency(card.amount)}
                </h3>
                <p className={`text-[10px] font-bold uppercase tracking-wider mt-1 opacity-80 ${card.textColor}`}>
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
