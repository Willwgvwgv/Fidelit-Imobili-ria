import React, { useState } from 'react';
import { X, CalendarPlus, Sparkles } from 'lucide-react';
import { getMonthName } from '../../utils/formatters';

interface NewCompetenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (year: number, month: number, notes?: string) => void;
  activeFixedCount: number;
}

export const NewCompetenceModal: React.FC<NewCompetenceModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  activeFixedCount,
}) => {
  const currentDate = new Date();
  const [year, setYear] = useState<number>(currentDate.getFullYear() < 2026 ? 2026 : currentDate.getFullYear());
  const [month, setMonth] = useState<number>(currentDate.getMonth() + 1);
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate(year, month, notes);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200/90 rounded-xl w-full max-w-md shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
              <CalendarPlus className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-slate-800">
              Nova Competência Mensal
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-blue-50/80 border border-blue-200/80 rounded-lg p-3.5 flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-900 leading-relaxed font-medium">
              Ao gerar a competência, o sistema copiará automaticamente as{' '}
              <strong className="font-bold underline">{activeFixedCount} despesas fixas ativas</strong>{' '}
              como lançamentos independentes.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mês
              </label>
              <select
                value={month}
                onChange={(e) => setMonth(parseInt(e.target.value, 10))}
                className="w-full bg-white border border-slate-200 rounded-lg h-10 px-3 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-600 cursor-pointer focus:outline-none"
              >
                {Array.from({ length: 12 }).map((_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {getMonthName(i + 1)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Ano
              </label>
              <input
                type="number"
                min="2020"
                max="2035"
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value, 10) || 2026)}
                className="w-full bg-white border border-slate-200 rounded-lg h-10 px-3.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Observações da Competência (Opcional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Mês com reajuste de aluguel e fechamento contábil antecipado..."
              className="w-full bg-white border border-slate-200 rounded-lg p-3 text-xs text-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-none"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="h-10 flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-5 rounded-lg text-xs font-medium transition-all shadow-2xs cursor-pointer"
            >
              <CalendarPlus className="w-4 h-4" />
              <span>Gerar Competência</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
