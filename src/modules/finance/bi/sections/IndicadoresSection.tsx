import React from 'react';
import { Gauge } from 'lucide-react';
import { formatCurrency } from '../../utils/currency';
import { IndicadoresGerenciais } from '../calculations';

interface IndicadoresSectionProps {
  ind: IndicadoresGerenciais;
}

const Indicador: React.FC<{ label: string; value: string; tone?: 'blue' | 'red' | 'emerald' | 'slate' }> = ({
  label,
  value,
  tone = 'slate',
}) => {
  const toneCls =
    tone === 'blue' ? 'text-blue-700' : tone === 'red' ? 'text-red-600' : tone === 'emerald' ? 'text-emerald-700' : 'text-slate-800';
  return (
    <div className="rounded-xl border border-slate-100 p-3.5">
      <p className="text-[10.5px] font-medium text-slate-400 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-lg font-bold ${toneCls}`}>{value}</p>
    </div>
  );
};

export const IndicadoresSection: React.FC<IndicadoresSectionProps> = ({ ind }) => {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs p-5 md:p-6">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
          <Gauge size={16} className="text-blue-600" />
        </div>
        <h3 className="text-sm font-bold text-slate-700">Indicadores Gerenciais</h3>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        <Indicador label="Total recebido no período" value={formatCurrency(ind.totalRecebidoPeriodo)} tone="blue" />
        <Indicador label="Total pago no período" value={formatCurrency(ind.totalPagoPeriodo)} />
        <Indicador label="Total em aberto" value={formatCurrency(ind.totalEmAberto)} />
        <Indicador label="Total atrasado" value={formatCurrency(ind.totalAtrasado)} tone="red" />
        <Indicador label="Futuro a receber (90d)" value={formatCurrency(ind.totalFuturoReceber90d)} tone="emerald" />
        <Indicador label="Futuro a pagar (90d)" value={formatCurrency(ind.totalFuturoPagar90d)} />
        <Indicador label="% recebido" value={`${ind.percentualRecebido.toFixed(1)}%`} tone="emerald" />
        <Indicador label="% pago" value={`${ind.percentualPago.toFixed(1)}%`} />
        <Indicador label="Qtd. contas vencidas" value={String(ind.qtdContasVencidas)} tone="red" />
        <Indicador label="Qtd. contas em aberto" value={String(ind.qtdContasEmAberto)} />
      </div>
    </div>
  );
};
