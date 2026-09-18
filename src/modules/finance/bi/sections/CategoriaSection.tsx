import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Tags, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { formatCurrency } from '../../utils/currency';
import { CategoriaAnalise } from '../types';

interface CategoriaSectionProps {
  entradas: CategoriaAnalise[];
  saidas: CategoriaAnalise[];
  onSelectCategoria: (c: CategoriaAnalise) => void;
}

const BARS_COLOR_INCOME = '#2563eb';
const BARS_COLOR_EXPENSE = '#60a5fa';

const CategoriaLista: React.FC<{
  titulo: string;
  icon: React.ReactNode;
  data: CategoriaAnalise[];
  color: string;
  onSelect: (c: CategoriaAnalise) => void;
}> = ({ titulo, icon, data, color, onSelect }) => {
  const chartData = data.slice(0, 8).map((c) => ({ name: c.categoriaNome, valor: c.valorTotal, raw: c }));

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <p className="text-xs font-bold text-slate-600">{titulo}</p>
      </div>

      <div className="h-64 mb-3">
        {chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-slate-400">Sem lançamentos no período.</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 10, fill: '#475569' }} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
              <Bar
                dataKey="valor"
                radius={[0, 6, 6, 0]}
                cursor="pointer"
                onClick={(d: any) => onSelect(d.raw)}
              >
                {chartData.map((_, i) => (
                  <Cell key={i} fill={color} fillOpacity={1 - i * 0.07} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="border border-slate-100 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 sticky top-0">
            <tr className="text-left text-[10.5px] font-semibold text-slate-500 uppercase tracking-wide">
              <th className="px-3 py-1.5">Categoria</th>
              <th className="px-3 py-1.5 text-right">Valor</th>
              <th className="px-3 py-1.5 text-right">%</th>
              <th className="px-3 py-1.5 text-right">Qtd</th>
            </tr>
          </thead>
          <tbody>
            {data.map((c) => (
              <tr
                key={c.categoriaId}
                className="border-t border-slate-50 hover:bg-blue-50/40 cursor-pointer"
                onClick={() => onSelect(c)}
              >
                <td className="px-3 py-1.5 text-slate-700">{c.categoriaNome}</td>
                <td className="px-3 py-1.5 text-right font-semibold text-slate-800">{formatCurrency(c.valorTotal)}</td>
                <td className="px-3 py-1.5 text-right text-slate-500">{c.percentualDoTotal.toFixed(1)}%</td>
                <td className="px-3 py-1.5 text-right text-slate-500">{c.quantidadeLancamentos}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const CategoriaSection: React.FC<CategoriaSectionProps> = ({ entradas, saidas, onSelectCategoria }) => {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs p-5 md:p-6">
      <div className="flex items-center gap-2.5 mb-1">
        <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
          <Tags size={16} className="text-blue-600" />
        </div>
        <h3 className="text-sm font-bold text-slate-700">Análise por Categoria</h3>
      </div>
      <p className="text-xs text-slate-400 mb-5">
        Categorias exatamente como cadastradas no Comissione. Clique em uma categoria (na lista ou no gráfico) para ver os lançamentos.
      </p>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <CategoriaLista
          titulo="Entradas por categoria"
          icon={<ArrowUpCircle size={14} className="text-blue-600" />}
          data={entradas}
          color={BARS_COLOR_INCOME}
          onSelect={onSelectCategoria}
        />
        <CategoriaLista
          titulo="Saídas por categoria"
          icon={<ArrowDownCircle size={14} className="text-blue-600" />}
          data={saidas}
          color={BARS_COLOR_EXPENSE}
          onSelect={onSelectCategoria}
        />
      </div>
    </div>
  );
};
