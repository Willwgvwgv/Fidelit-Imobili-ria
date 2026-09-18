import React from 'react';
import { ArrowUpCircle, ArrowDownCircle, Scale, TrendingUp } from 'lucide-react';
import { formatCurrency } from '../../utils/currency';
import { ContasResumo, SaldoRealizado } from '../calculations';

export type SummaryDrillKind =
  | 'receber-previsto' | 'receber-recebido' | 'receber-aberto' | 'receber-atrasado'
  | 'pagar-previsto' | 'pagar-pago' | 'pagar-aberto' | 'pagar-atrasado'
  | 'realizado-entradas' | 'realizado-saidas' | 'projetado-entradas' | 'projetado-saidas';

interface SummaryCardsProps {
  receber: ContasResumo;
  pagar: ContasResumo;
  realizado: SaldoRealizado;
  projetado: SaldoRealizado;
  onDrill: (kind: SummaryDrillKind) => void;
}

const MiniStat: React.FC<{ label: string; value: number; onClick?: () => void; tone?: 'blue' | 'slate' }> = ({
  label,
  value,
  onClick,
  tone = 'slate',
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={!onClick}
    className={`text-left flex flex-col gap-0.5 rounded-xl px-2.5 py-2 transition-colors ${
      onClick ? 'hover:bg-blue-50 cursor-pointer' : 'cursor-default'
    }`}
  >
    <span className="text-[10.5px] font-medium text-slate-400 uppercase tracking-wide">{label}</span>
    <span className={`text-sm font-bold ${tone === 'blue' ? 'text-blue-700' : 'text-slate-700'}`}>{formatCurrency(value)}</span>
  </button>
);

const CardShell: React.FC<{
  title: string;
  icon: React.ReactNode;
  iconBg: string;
  children: React.ReactNode;
}> = ({ title, icon, iconBg, children }) => (
  <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs p-5 flex flex-col gap-3">
    <div className="flex items-center gap-2.5">
      <div className={`w-8 h-8 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>{icon}</div>
      <h3 className="text-sm font-bold text-slate-700">{title}</h3>
    </div>
    <div className="grid grid-cols-2 gap-1">{children}</div>
  </div>
);

export const SummaryCards: React.FC<SummaryCardsProps> = ({ receber, pagar, realizado, projetado, onDrill }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <CardShell title="Contas a Receber" icon={<ArrowUpCircle size={16} className="text-blue-600" />} iconBg="bg-blue-50">
        <MiniStat label="Previsto" value={receber.previsto} onClick={() => onDrill('receber-previsto')} />
        <MiniStat label="Recebido" value={receber.recebidoOuPago} tone="blue" onClick={() => onDrill('receber-recebido')} />
        <MiniStat label="Em aberto" value={receber.emAberto} onClick={() => onDrill('receber-aberto')} />
        <MiniStat label="Atrasado" value={receber.atrasado} onClick={() => onDrill('receber-atrasado')} />
      </CardShell>

      <CardShell title="Contas a Pagar" icon={<ArrowDownCircle size={16} className="text-blue-600" />} iconBg="bg-blue-50">
        <MiniStat label="Previsto" value={pagar.previsto} onClick={() => onDrill('pagar-previsto')} />
        <MiniStat label="Pago" value={pagar.recebidoOuPago} tone="blue" onClick={() => onDrill('pagar-pago')} />
        <MiniStat label="Em aberto" value={pagar.emAberto} onClick={() => onDrill('pagar-aberto')} />
        <MiniStat label="Atrasado" value={pagar.atrasado} onClick={() => onDrill('pagar-atrasado')} />
      </CardShell>

      <CardShell title="Saldo (Realizado)" icon={<Scale size={16} className="text-blue-600" />} iconBg="bg-blue-50">
        <MiniStat label="Entradas" value={realizado.entradas} onClick={() => onDrill('realizado-entradas')} />
        <MiniStat label="Saídas" value={realizado.saidas} onClick={() => onDrill('realizado-saidas')} />
        <div className="col-span-2 mt-1 pt-2 border-t border-slate-100">
          <span className="text-[10.5px] font-medium text-slate-400 uppercase tracking-wide">Saldo realizado</span>
          <div className={`text-lg font-bold ${realizado.saldo >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
            {formatCurrency(realizado.saldo)}
          </div>
        </div>
      </CardShell>

      <CardShell title="Saldo Projetado" icon={<TrendingUp size={16} className="text-blue-600" />} iconBg="bg-blue-50">
        <MiniStat label="Entradas futuras" value={projetado.entradas} onClick={() => onDrill('projetado-entradas')} />
        <MiniStat label="Saídas futuras" value={projetado.saidas} onClick={() => onDrill('projetado-saidas')} />
        <div className="col-span-2 mt-1 pt-2 border-t border-slate-100">
          <span className="text-[10.5px] font-medium text-slate-400 uppercase tracking-wide">Saldo projetado</span>
          <div className={`text-lg font-bold ${projetado.saldo >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
            {formatCurrency(projetado.saldo)}
          </div>
        </div>
      </CardShell>
    </div>
  );
};
