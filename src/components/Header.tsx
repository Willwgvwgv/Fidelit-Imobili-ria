import React from 'react';
import { Search, FileText, FileSpreadsheet, Building } from 'lucide-react';
import { CompanySettings, Competence } from '../types';

interface HeaderProps {
  settings: CompanySettings;
  activeCompetence: Competence | null;
  competencies: Competence[];
  onSelectCompetence: (compKey: string) => void;
  globalSearch: string;
  onGlobalSearchChange: (value: string) => void;
  onGeneratePDF: () => void;
  onGenerateExcel: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  settings,
  activeCompetence,
  competencies,
  onSelectCompetence,
  globalSearch,
  onGlobalSearchChange,
  onGeneratePDF,
  onGenerateExcel,
}) => {
  return (
    <header className="bg-white border-b border-slate-200/90 px-6 py-3 flex items-center justify-between gap-4 sticky top-0 z-10 shadow-2xs">
      {/* Global Search Bar (40px height) */}
      <div className="flex items-center gap-3 flex-1 max-w-md">
        <div className="relative w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={globalSearch}
            onChange={(e) => onGlobalSearchChange(e.target.value)}
            placeholder="Pesquisar por descrição, fornecedor ou categoria..."
            className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>
      </div>

      {/* Center / Competence Selector & Company */}
      <div className="flex items-center gap-3">
        {/* Company Info Badge */}
        <div className="hidden lg:flex items-center gap-2 text-xs text-slate-700 bg-slate-50 h-9 px-3 rounded-lg border border-slate-200">
          <Building className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          <span className="font-semibold truncate max-w-[180px] text-slate-800">{settings.name || 'Sua Empresa'}</span>
          <span className="text-slate-300">|</span>
          <span className="text-slate-500 text-[11px]">{settings.city}/{settings.state}</span>
        </div>

        {/* Competence Selector */}
        {competencies.length > 0 && (
          <div className="flex items-center gap-2 bg-slate-50 h-9 px-3 rounded-lg border border-slate-200">
            <span className="text-xs font-medium text-slate-500">Competência:</span>
            <select
              value={activeCompetence?.id || ''}
              onChange={(e) => onSelectCompetence(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-hidden cursor-pointer"
            >
              {competencies.map((c) => (
                <option key={c.id} value={c.id} className="bg-white text-slate-800">
                  {c.label} {c.closed ? '(Fechada)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right Quick Exports */}
      <div className="flex items-center gap-2">
        <button
          onClick={onGeneratePDF}
          title="Gerar PDF para o Contador"
          className="h-9 flex items-center gap-1.5 bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 px-3 rounded-lg text-xs font-semibold transition cursor-pointer shadow-2xs"
        >
          <FileText className="w-3.5 h-3.5 text-rose-600" />
          <span>Exportar PDF</span>
        </button>

        <button
          onClick={onGenerateExcel}
          title="Gerar Planilha Excel"
          className="h-9 flex items-center gap-1.5 bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 px-3 rounded-lg text-xs font-semibold transition cursor-pointer shadow-2xs"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
          <span>Exportar Excel</span>
        </button>
      </div>
    </header>
  );
};
