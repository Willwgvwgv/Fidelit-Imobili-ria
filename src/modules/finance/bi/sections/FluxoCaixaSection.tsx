import React, { useMemo } from 'react';
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Activity } from 'lucide-react';
import { formatCurrency } from '../../utils/currency';
import { SaldoRealizado } from '../calculations';
import { MesAnalise } from '../types';

interface FluxoCaixaSectionProps {
  realizado: SaldoRealizado;
  projetado: SaldoRealizado;
  mensal: MesAnalise[];
}

export const FluxoCaixaSection: React.FC<FluxoCaixaSectionProps> = ({ realizado, projetado, mensal }) => {
  const chartData = useMemo(
    () =>
      mensal.map((m) => ({
        label: m.label,
        entradas: m.recebido,
        saidas: m.pago,
        saldo: m.resultadoRealizado,
      })),
    [mensal]
  );

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs p-5 md:p-6">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
          <Activity size={16} className="text-blue-600" />
        </div>
        <h3 className="text-sm font-bold text-slate-700">Fluxo de Caixa</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="rounded-xl border border-slate-100 p-4">
          <p className="text-xs font-bold text-slate-600 mb-2">Realizado</p>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-slate-500">Entradas recebidas</span>
            <span className="font-semibold text-blue-700">{formatCurrency(realizado.entradas)}</span>
          </div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-slate-500">Saídas pagas</span>
            <span className="font-semibold text-red-600">{formatCurrency(realizado.saidas)}</span>
          </div>
          <div className="flex justify-between text-sm pt-2 border-t border-slate-50 mt-2">
            <span className="text-slate-600 font-semibold">Saldo</span>
            <span className={`font-bold ${realizado.saldo >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
              {formatCurrency(realizado.saldo)}
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-100 p-4">
          <p className="text-xs font-bold text-slate-600 mb-2">Projetado</p>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-slate-500">Entradas futuras</span>
            <span className="font-semibold text-blue-700">{formatCurrency(projetado.entradas)}</span>
          </div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-slate-500">Saídas futuras</span>
            <span className="font-semibold text-red-600">{formatCurrency(projetado.saidas)}</span>
          </div>
          <div className="flex justify-between text-sm pt-2 border-t border-slate-50 mt-2">
            <span className="text-slate-600 font-semibold">Saldo projetado</span>
            <span className={`font-bold ${projetado.saldo >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
              {formatCurrency(projetado.saldo)}
            </span>
          </div>
        </div>
      </div>

      <p className="text-xs font-semibold text-slate-500 mb-2">Evolução mensal (entradas x saídas realizadas)</p>
      <div className="h-64">
        {chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-slate-400">Sem dados suficientes ainda.</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ left: 0, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <YAxis tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 10, fill: '#94a3b8' }} width={70} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="entradas" name="Entradas" fill="#93c5fd" radius={[4, 4, 0, 0]} />
              <Bar dataKey="saidas" name="Saídas" fill="#1d4ed8" radius={[4, 4, 0, 0]} />
              <Line type="monotone" dataKey="saldo" name="Saldo" stroke="#0f172a" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
