import React from 'react';
import { FinancialTransaction, TransactionStatus, TransactionType } from '../../../../types';
import { formatCurrency } from '../utils/currency';

interface FinancialKpiHeaderCardsProps {
  transactions?: FinancialTransaction[];
  onCardClick?: (filterId: string) => void;
  activeFilter?: string | null;
}

const getDaysDiff = (dateStr1: string, dateStr2: string) => {
  if (!dateStr1 || !dateStr2) return 0;
  const d1 = new Date(dateStr1);
  const d2 = new Date(dateStr2);
  const diffTime = d1.getTime() - d2.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

export const FinancialKpiHeaderCards: React.FC<FinancialKpiHeaderCardsProps> = ({
  transactions = [],
  onCardClick,
  activeFilter,
}) => {
  const hoje = new Date().toISOString().split('T')[0];

  const txsVencidos = transactions.filter(
    (t) => t.status === TransactionStatus.PENDING && t.due_date < hoje && t.type === TransactionType.EXPENSE
  );
  const txsHoje = transactions.filter(
    (t) => t.status === TransactionStatus.PENDING && t.due_date === hoje && t.type === TransactionType.EXPENSE
  );
  const txsSeteDias = transactions.filter(
    (t) =>
      t.status === TransactionStatus.PENDING &&
      t.type === TransactionType.EXPENSE &&
      getDaysDiff(t.due_date, hoje) > 0 &&
      getDaysDiff(t.due_date, hoje) <= 7
  );
  const txsAVencerReceber = transactions.filter(
    (t) => t.status === TransactionStatus.PENDING && (t.type === TransactionType.INCOME || t.due_date > hoje)
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
    },
    {
      id: 'avencer_receber',
      title: 'A Vencer / A Receber',
      count: countAVencerReceber,
      amount: sumAVencerReceber,
      sub: 'Entradas e a vencer',
      bgColor: 'bg-emerald-50/60',
      borderColor: 'border-emerald-100',
      textColor: 'text-emerald-800',
      numColor: 'text-emerald-950',
      badgeBg: 'bg-emerald-100 text-emerald-800',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const isSelected = activeFilter === card.id;
        return (
          <div
            key={card.id}
            onClick={() => onCardClick && onCardClick(card.id)}
            className={`${card.bgColor} border ${card.borderColor} p-5 rounded-3xl shadow-xs flex flex-col justify-between transition-all ${
              onCardClick ? 'cursor-pointer hover:shadow-md' : ''
            } ${isSelected ? 'ring-2 ring-indigo-500 scale-[1.02]' : ''}`}
          >
            <div className="flex justify-between items-start">
              <span className={`text-[10px] font-black uppercase tracking-widest ${card.textColor}`}>
                {card.title}
              </span>
              <span className={`text-xs font-black px-2 py-0.5 rounded-full ${card.badgeBg}`}>
                {card.count}
              </span>
            </div>
            <div className="mt-3">
              <h3 className={`text-2xl font-black ${card.numColor}`}>
                {formatCurrency(card.amount)}
              </h3>
              <p className={`text-[10px] font-bold uppercase tracking-wider mt-1 opacity-80 ${card.textColor}`}>
                {card.sub}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};
