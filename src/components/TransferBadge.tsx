import React from 'react';

interface TransferBadgeProps {
  transferId?: string | null;
  className?: string;
}

export const TransferBadge: React.FC<TransferBadgeProps> = ({ transferId, className = '' }) => {
  if (!transferId) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 ${className}`}
      title="Transferência entre contas, sem impacto em receita/despesa"
    >
      <span>↔</span>
      <span>Transferência</span>
    </span>
  );
};
