import React from 'react';
import {
  CalendarDays,
  PlusCircle,
  FileSpreadsheet,
  FileText,
  Trash2,
  ExternalLink,
  CheckCircle2,
  Clock,
  Share2,
} from 'lucide-react';
import { Category, CompanySettings, Competence, ExpenseItem } from '../types';
import { formatCurrency, formatDate } from '../utils/formatters';
import { exportCompetencePDF } from '../utils/pdfExporter';
import { exportCompetenceExcel } from '../utils/excelExporter';

interface CompetenciesPageProps {
  competencies: Competence[];
  allItems: ExpenseItem[];
  settings: CompanySettings;
  categories: Category[];
  activeCompetenceId: string;
  onSelectCompetence: (compKey: string) => void;
  onNewCompetence: () => void;
  onDeleteCompetence: (compKey: string) => void;
  onNavigateTab: (tab: string) => void;
}

export const CompetenciesPage: React.FC<CompetenciesPageProps> = ({
  competencies,
  allItems,
  settings,
  categories,
  activeCompetenceId,
  onSelectCompetence,
  onNewCompetence,
  onDeleteCompetence,
  onNavigateTab,
}) => {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white border border-slate-200/90 rounded-xl p-5 shadow-2xs">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-blue-600" />
            Histórico de Competências Mensais
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Gere, consulte e exporte relatórios financeiros organizados por competência contábil.
          </p>
        </div>

        <button
          onClick={onNewCompetence}
          className="h-10 flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs px-4 rounded-lg transition-all shadow-2xs cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Nova Competência</span>
        </button>
      </div>

      {/* Rich ERP Competencies Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {competencies.map((comp) => {
          const compItems = allItems.filter((i) => i.competenceId === comp.id);
          const totalAmount = compItems.reduce((acc, i) => acc + i.amount, 0);
          const totalPagas = compItems.filter((i) => i.status === 'PAGO').reduce((acc, i) => acc + i.amount, 0);
          const totalPendentes = compItems.filter((i) => i.status === 'PENDENTE').reduce((acc, i) => acc + i.amount, 0);
          const fixedCount = compItems.filter((i) => i.type === 'FIXA').length;
          const varCount = compItems.filter((i) => i.type === 'VARIAVEL').length;
          const isActive = comp.id === activeCompetenceId;

          return (
            <div
              key={comp.id}
              className={`bg-white border rounded-xl p-5 transition-all shadow-2xs flex flex-col justify-between relative overflow-hidden ${
                isActive
                  ? 'border-blue-500 ring-2 ring-blue-500/20'
                  : 'border-slate-200/90 hover:border-slate-300 hover:shadow-xs'
              }`}
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Prestação de Contas
                    </span>
                    <h3 className="text-lg font-bold text-slate-800">
                      {comp.label}
                    </h3>
                  </div>

                  {isActive ? (
                    <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200/80 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                      <CheckCircle2 className="w-3 h-3 text-blue-600" />
                      Ativa
                    </span>
                  ) : (
                    <span className="text-[10px] bg-slate-100 text-slate-600 border border-slate-200 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                      <Clock className="w-3 h-3 text-slate-400" />
                      Encerrada
                    </span>
                  )}
                </div>

                {/* Subtitle / Item Count */}
                <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
                  <span className="font-semibold text-slate-700">{compItems.length} lançamentos</span>
                  <span>•</span>
                  <span>{fixedCount} Fixas</span>
                  <span>•</span>
                  <span>{varCount} Variáveis</span>
                </div>

                {/* Rich Financial Breakdown Box */}
                <div className="bg-slate-50/90 rounded-xl p-3.5 space-y-2 text-xs mb-3 border border-slate-200/80">
                  <div className="flex justify-between items-center text-slate-700">
                    <span className="font-semibold">Total Geral:</span>
                    <strong className="font-mono text-sm font-bold text-slate-900">
                      {formatCurrency(totalAmount)}
                    </strong>
                  </div>

                  <div className="flex justify-between items-center text-emerald-700">
                    <span className="flex items-center gap-1 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Pagas:
                    </span>
                    <strong className="font-mono font-bold">{formatCurrency(totalPagas)}</strong>
                  </div>

                  <div className="flex justify-between items-center text-amber-700">
                    <span className="flex items-center gap-1 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      Pendentes:
                    </span>
                    <strong className="font-mono font-bold">{formatCurrency(totalPendentes)}</strong>
                  </div>

                  <div className="pt-2 border-t border-slate-200/80 flex justify-between text-[11px] text-slate-500">
                    <span>Criada em:</span>
                    <span>{formatDate(comp.createdAt)}</span>
                  </div>
                </div>

                {comp.notes && (
                  <p className="text-[11px] text-slate-500 italic mb-3 line-clamp-2 bg-slate-50 p-2 rounded border border-slate-100">
                    "{comp.notes}"
                  </p>
                )}
              </div>

              {/* Action Buttons Row */}
              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-1.5">
                <button
                  onClick={() => {
                    onSelectCompetence(comp.id);
                    onNavigateTab('competence_detail');
                  }}
                  className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-2.5 py-1.5 rounded-md hover:bg-blue-100 transition cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Abrir
                </button>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => exportCompetencePDF(settings, comp.label, compItems, categories)}
                    title="Exportar PDF"
                    className="flex items-center gap-1 text-xs font-semibold px-2 py-1.5 rounded-md bg-rose-50 text-rose-700 hover:bg-rose-100 transition cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>PDF</span>
                  </button>

                  <button
                    onClick={() => exportCompetenceExcel(settings, comp.label, compItems, categories)}
                    title="Exportar Excel"
                    className="flex items-center gap-1 text-xs font-semibold px-2 py-1.5 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Excel</span>
                  </button>

                  <button
                    onClick={() => {
                      onSelectCompetence(comp.id);
                      onNavigateTab('comissione');
                    }}
                    title="Enviar para Comissione"
                    className="p-1.5 rounded-md bg-slate-100 hover:bg-emerald-100 text-slate-600 hover:text-emerald-700 transition cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => onDeleteCompetence(comp.id)}
                    title="Excluir competência"
                    className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
