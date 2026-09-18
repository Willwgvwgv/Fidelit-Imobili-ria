import React from 'react';
import { CalendarClock } from 'lucide-react';
import { formatCurrency } from '../../utils/currency';
import { formatDateBR } from '../../utils/dates';
import { FutureWindowResult, FluxoDia } from '../types';

interface FuturasSectionProps {
  windows: FutureWindowResult[];
  cashFlowTable: FluxoDia[];
  onDrillWindow: (dias: number, tipo: 'INCOME' | 'EXPENSE') => void;
  onDrillDay: (data: string) => void;
}

const WindowCard: React.FC<{
  w: FutureWindowResult;
  onDrillEntradas: () => void;
  onDrillSaidas: () => void;
}> = ({ w, onDrillEntradas, onDrillSaidas }) => (
  <div className="border border-slate-100 rounded-xl p-3.5 flex flex-col gap-2 min-w-[150px]">
    <p className="text-xs font-bold text-slate-600">Próximos {w.dias} dias</p>
    <button type="button" onClick={onDrillEntradas} className="text-left hover:bg-blue-50/50 rounded-lg px-1.5 py-1 -mx-1.5 transition-colors">
      <p className="text-[10px] text-slate-400 uppercase tracking-wide">A receber ({w.qtdEntradas})</p>
      <p className="text-sm font-bold text-blue-700">{formatCurrency(w.entradas)}</p>
    </button>
    <button type="button" onClick={onDrillSaidas} className="text-left hover:bg-red-50/50 rounded-lg px-1.5 py-1 -mx-1.5 transition-colors">
      <p className="text-[10px] text-slate-400 uppercase tracking-wide">A pagar ({w.qtdSaidas})</p>
      <p className="text-sm font-bold text-red-600">{formatCurrency(w.saidas)}</p>
    </button>
    <div className="pt-1.5 border-t border-slate-50">
      <p className="text-[10px] text-slate-400 uppercase tracking-wide">Saldo do período</p>
      <p className={`text-sm font-bold ${w.entradas - w.saidas >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
        {formatCurrency(w.entradas - w.saidas)}
      </p>
    </div>
  </div>
);

export const FuturasSection: React.FC<FuturasSectionProps> = ({ windows, cashFlowTable, onDrillWindow, onDrillDay }) => {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs p-5 md:p-6">
      <div className="flex items-center gap-2.5 mb-1">
        <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
          <CalendarClock size={16} className="text-blue-600" />
        </div>
        <h3 className="text-sm font-bold text-slate-700">Contas Futuras</h3>
      </div>
      <p className="text-xs text-slate-400 mb-4">O que ainda está previsto para acontecer, a partir de hoje.</p>

      <div className="flex gap-3 overflow-x-auto pb-2 mb-6">
        {windows.map((w) => (
          <WindowCard
            key={w.dias}
            w={w}
            onDrillEntradas={() => onDrillWindow(w.dias, 'INCOME')}
            onDrillSaidas={() => onDrillWindow(w.dias, 'EXPENSE')}
          />
        ))}
      </div>

      <p className="text-xs font-semibold text-slate-500 mb-2">Fluxo de caixa futuro (próximos 90 dias, por data de vencimento)</p>
      <div className="max-h-72 overflow-y-auto border border-slate-100 rounded-xl">
        {cashFlowTable.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400">Não há lançamentos futuros pendentes nos próximos 90 dias.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 sticky top-0">
              <tr className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                <th className="px-4 py-2">Data</th>
                <th className="px-4 py-2 text-right">Entradas previstas</th>
                <th className="px-4 py-2 text-right">Saídas previstas</th>
                <th className="px-4 py-2 text-right">Saldo projetado (acum.)</th>
              </tr>
            </thead>
            <tbody>
              {cashFlowTable.map((row) => (
                <tr
                  key={row.data}
                  className="border-t border-slate-50 hover:bg-blue-50/40 cursor-pointer"
                  onClick={() => onDrillDay(row.data)}
                >
                  <td className="px-4 py-2 text-slate-600 whitespace-nowrap">{formatDateBR(row.data)}</td>
                  <td className="px-4 py-2 text-right text-blue-700 font-medium">{formatCurrency(row.entradasPrevistas)}</td>
                  <td className="px-4 py-2 text-right text-red-600 font-medium">{formatCurrency(row.saidasPrevistas)}</td>
                  <td className={`px-4 py-2 text-right font-bold ${row.saldoAcumulado >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                    {formatCurrency(row.saldoAcumulado)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
