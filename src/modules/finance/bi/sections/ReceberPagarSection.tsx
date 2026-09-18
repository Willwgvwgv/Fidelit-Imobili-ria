import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { formatCurrency } from '../../utils/currency';
import { formatDateBR } from '../../utils/dates';
import { ContasResumo, PontoEvolucao } from '../calculations';

interface ReceberPagarSectionProps {
  tipo: 'INCOME' | 'EXPENSE';
  resumo: ContasResumo;
  evolucao: PontoEvolucao[];
  onDrill: (kind: 'recebido_pago' | 'aberto' | 'atrasado') => void;
}

const CORES = { pago: '#2563eb', aberto: '#93c5fd', atrasado: '#ef4444' };

const StatCell: React.FC<{ label: string; value: string; onClick?: () => void }> = ({ label, value, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={!onClick}
    className={`text-left rounded-xl border border-slate-100 px-3 py-2.5 ${onClick ? 'hover:border-blue-200 hover:bg-blue-50/50 cursor-pointer' : ''} transition-colors`}
  >
    <p className="text-[10.5px] font-medium text-slate-400 uppercase tracking-wide">{label}</p>
    <p className="text-base font-bold text-slate-800 mt-0.5">{value}</p>
  </button>
);

export const ReceberPagarSection: React.FC<ReceberPagarSectionProps> = ({ tipo, resumo, evolucao, onDrill }) => {
  const isReceita = tipo === 'INCOME';
  const titulo = isReceita ? 'Contas a Receber' : 'Contas a Pagar';
  const rotuloRealizado = isReceita ? 'Total recebido' : 'Total pago';

  const pieData = [
    { name: isReceita ? 'Recebido' : 'Pago', value: resumo.recebidoOuPago, color: CORES.pago },
    { name: 'Em aberto', value: resumo.emAberto, color: CORES.aberto },
    { name: 'Atrasado', value: resumo.atrasado, color: CORES.atrasado },
  ].filter((d) => d.value > 0);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs p-5 md:p-6">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
          {isReceita ? <ArrowUpCircle size={16} className="text-blue-600" /> : <ArrowDownCircle size={16} className="text-blue-600" />}
        </div>
        <h3 className="text-sm font-bold text-slate-700">{titulo}</h3>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-5">
        <StatCell label={rotuloRealizado} value={formatCurrency(resumo.recebidoOuPago)} onClick={() => onDrill('recebido_pago')} />
        <StatCell label={isReceita ? 'Total a receber' : 'Total a pagar'} value={formatCurrency(resumo.previsto)} />
        <StatCell label="Total vencido" value={formatCurrency(resumo.atrasado)} onClick={() => onDrill('atrasado')} />
        <StatCell label="Total em aberto" value={formatCurrency(resumo.emAberto)} onClick={() => onDrill('aberto')} />
      </div>

      <div className="flex gap-4 text-xs text-slate-500 mb-5">
        <span>
          <strong className="text-slate-700">{resumo.qtdTotal}</strong> lançamento(s) no período
        </span>
        <span>
          <strong className="text-red-600">{resumo.qtdAtrasados}</strong> atrasado(s)
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <p className="text-xs font-semibold text-slate-500 mb-2">
            Evolução de {isReceita ? 'recebimentos' : 'pagamentos'} ao longo do tempo
          </p>
          <div className="h-56">
            {evolucao.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">Sem dados pagos no período selecionado.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={evolucao} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id={`grad-${tipo}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="data" tickFormatter={formatDateBR} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 10, fill: '#94a3b8' }} width={70} />
                  <Tooltip
                    formatter={(v: number) => formatCurrency(v)}
                    labelFormatter={(l) => formatDateBR(String(l))}
                    contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0', fontSize: 12 }}
                  />
                  <Area type="monotone" dataKey="acumulado" name="Acumulado" stroke="#2563eb" fill={`url(#grad-${tipo})`} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-500 mb-2">
            {isReceita ? 'Recebido' : 'Pago'} x Em aberto x Atrasado
          </p>
          <div className="h-56">
            {pieData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">Sem valores no período.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={2}>
                    {pieData.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
