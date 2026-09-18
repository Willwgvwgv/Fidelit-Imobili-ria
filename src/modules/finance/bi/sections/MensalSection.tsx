import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { CalendarRange } from 'lucide-react';
import { formatCurrency } from '../../utils/currency';
import { MesAnalise } from '../types';

interface MensalSectionProps {
  meses: MesAnalise[];
}

export const MensalSection: React.FC<MensalSectionProps> = ({ meses }) => {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs p-5 md:p-6">
      <div className="flex items-center gap-2.5 mb-1">
        <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
          <CalendarRange size={16} className="text-blue-600" />
        </div>
        <h3 className="text-sm font-bold text-slate-700">Análise Mensal</h3>
      </div>
      <p className="text-xs text-slate-400 mb-5">
        Comparação previsto x realizado por mês de vencimento (até 12 meses com dados disponíveis).
      </p>

      <div className="h-64 mb-5">
        {meses.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-slate-400">Sem dados suficientes.</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={meses} margin={{ left: 0, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <YAxis tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 10, fill: '#94a3b8' }} width={70} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="entradasPrevistas" name="Entradas previstas" fill="#93c5fd" radius={[4, 4, 0, 0]} />
              <Bar dataKey="saidasPrevistas" name="Saídas previstas" fill="#1d4ed8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="border border-slate-100 rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[680px]">
          <thead className="bg-slate-50">
            <tr className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
              <th className="px-3 py-2">Mês</th>
              <th className="px-3 py-2 text-right">Entradas (previsto)</th>
              <th className="px-3 py-2 text-right">Saídas (previsto)</th>
              <th className="px-3 py-2 text-right">Resultado (previsto)</th>
              <th className="px-3 py-2 text-right">Recebido</th>
              <th className="px-3 py-2 text-right">Pago</th>
              <th className="px-3 py-2 text-right">Resultado realizado</th>
            </tr>
          </thead>
          <tbody>
            {meses.map((m) => (
              <tr key={m.chave} className="border-t border-slate-50">
                <td className="px-3 py-2 font-semibold text-slate-700">{m.label}</td>
                <td className="px-3 py-2 text-right text-slate-600">{formatCurrency(m.entradasPrevistas)}</td>
                <td className="px-3 py-2 text-right text-slate-600">{formatCurrency(m.saidasPrevistas)}</td>
                <td className={`px-3 py-2 text-right font-semibold ${m.resultadoPrevisto >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                  {formatCurrency(m.resultadoPrevisto)}
                </td>
                <td className="px-3 py-2 text-right text-blue-700">{formatCurrency(m.recebido)}</td>
                <td className="px-3 py-2 text-right text-slate-600">{formatCurrency(m.pago)}</td>
                <td className={`px-3 py-2 text-right font-semibold ${m.resultadoRealizado >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                  {formatCurrency(m.resultadoRealizado)}
                </td>
              </tr>
            ))}
            {meses.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-xs text-slate-400">
                  Sem meses com lançamentos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
