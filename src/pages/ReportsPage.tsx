import React, { useState } from 'react';
import {
  BarChart3,
  Building,
  FolderTree,
  CalendarDays,
  FileText,
  FileSpreadsheet,
  TrendingDown,
  Receipt,
  PieChart as PieIcon,
  Send,
  CheckCircle2,
} from 'lucide-react';
import { Category, CompanySettings, Competence, ExpenseItem } from '../types';
import { formatCurrency, formatDate } from '../utils/formatters';
import { exportCompetencePDF } from '../utils/pdfExporter';
import { exportCompetenceExcel } from '../utils/excelExporter';

interface ReportsPageProps {
  competencies: Competence[];
  allItems: ExpenseItem[];
  categories: Category[];
  settings: CompanySettings;
  onNavigateTab: (tab: string) => void;
}

export const ReportsPage: React.FC<ReportsPageProps> = ({
  competencies,
  allItems,
  categories,
  settings,
  onNavigateTab,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<
    'dre' | 'category' | 'supplier' | 'monthly' | 'accountant'
  >('dre');

  const [selectedCompId, setSelectedCompId] = useState<string>(
    competencies[0]?.id || ''
  );

  // Revenue estimation state for DRE calculation
  const [grossRevenueInput, setGrossRevenueInput] = useState<string>('45000');

  const selectedCompetence = competencies.find((c) => c.id === selectedCompId) || competencies[0];
  const activeItems = allItems.filter((i) => i.competenceId === selectedCompId);
  const categoryMap = new Map<string, Category>(categories.map((c) => [c.id, c]));

  // Totals calculations for selected competence
  const totalFixas = activeItems.filter((i) => i.type === 'FIXA').reduce((a, b) => a + b.amount, 0);
  const totalVariaveis = activeItems.filter((i) => i.type === 'VARIAVEL').reduce((a, b) => a + b.amount, 0);
  const totalGeral = totalFixas + totalVariaveis;

  const grossRevenue = parseFloat(grossRevenueInput.replace(',', '.')) || 0;
  const netOperatingIncome = grossRevenue - totalGeral;
  const operatingMargin = grossRevenue > 0 ? (netOperatingIncome / grossRevenue) * 100 : 0;

  // Totals by Category
  const categoryTotalsMap = new Map<string, number>();
  activeItems.forEach((item) => {
    const cur = categoryTotalsMap.get(item.categoryId) || 0;
    categoryTotalsMap.set(item.categoryId, cur + item.amount);
  });

  const categoryRows = Array.from(categoryTotalsMap.entries()).map(([catId, amount]) => ({
    category: categoryMap.get(catId),
    amount,
    percentage: totalGeral > 0 ? (amount / totalGeral) * 100 : 0,
    count: activeItems.filter((i) => i.categoryId === catId).length,
  })).sort((a, b) => b.amount - a.amount);

  // Totals by Supplier
  const supplierTotalsMap = new Map<string, { amount: number; count: number }>();
  activeItems.forEach((item) => {
    const supplierName = item.supplier || 'Outros / Não Informado';
    const cur = supplierTotalsMap.get(supplierName) || { amount: 0, count: 0 };
    supplierTotalsMap.set(supplierName, {
      amount: cur.amount + item.amount,
      count: cur.count + 1,
    });
  });

  const supplierRows = Array.from(supplierTotalsMap.entries()).map(([supplier, data]) => ({
    supplier,
    amount: data.amount,
    count: data.count,
    avg: data.count > 0 ? data.amount / data.count : 0,
  })).sort((a, b) => b.amount - a.amount);

  // Month-over-month total history
  const monthlyHistory = competencies.map((comp) => {
    const compItems = allItems.filter((i) => i.competenceId === comp.id);
    const fix = compItems.filter((i) => i.type === 'FIXA').reduce((a, b) => a + b.amount, 0);
    const varAmount = compItems.filter((i) => i.type === 'VARIAVEL').reduce((a, b) => a + b.amount, 0);
    const totalPagas = compItems.filter((i) => i.status === 'PAGO').reduce((a, b) => a + b.amount, 0);

    return {
      competence: comp,
      totalFixas: fix,
      totalVariaveis: varAmount,
      totalGeral: fix + varAmount,
      totalPagas,
      count: compItems.length,
    };
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white border border-slate-200/90 rounded-xl p-5 shadow-2xs">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            Relatórios Financeiros & DRE Imobiliária
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Análise executiva por DRE, centro de custo, fornecedores e kit contábil.
          </p>
        </div>

        {selectedCompetence && (
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                exportCompetencePDF(settings, selectedCompetence.label, activeItems, categories)
              }
              className="h-10 flex items-center gap-1.5 bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 px-3.5 rounded-lg text-xs font-medium transition shadow-2xs cursor-pointer"
            >
              <FileText className="w-4 h-4 text-rose-600" />
              <span>PDF Relatório</span>
            </button>
            <button
              onClick={() =>
                exportCompetenceExcel(settings, selectedCompetence.label, activeItems, categories)
              }
              className="h-10 flex items-center gap-1.5 bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 px-3.5 rounded-lg text-xs font-medium transition shadow-2xs cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Excel ERP</span>
            </button>
          </div>
        )}
      </div>

      {/* Competence Selector & Navigation Tabs */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-bold text-slate-800">Competência em Análise:</span>
          </div>

          <select
            value={selectedCompId}
            onChange={(e) => setSelectedCompId(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 h-9 text-xs font-semibold text-slate-800 cursor-pointer focus:ring-2 focus:ring-blue-600 focus:outline-none"
          >
            {competencies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        {/* Sub-tab Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            onClick={() => setActiveSubTab('dre')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeSubTab === 'dre'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
            }`}
          >
            DRE Simplificada
          </button>
          <button
            onClick={() => setActiveSubTab('category')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeSubTab === 'category'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
            }`}
          >
            Por Categoria
          </button>
          <button
            onClick={() => setActiveSubTab('supplier')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeSubTab === 'supplier'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
            }`}
          >
            Por Fornecedor
          </button>
          <button
            onClick={() => setActiveSubTab('monthly')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeSubTab === 'monthly'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
            }`}
          >
            Comparativo Mensal
          </button>
          <button
            onClick={() => setActiveSubTab('accountant')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeSubTab === 'accountant'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
            }`}
          >
            Resumo do Contador
          </button>
        </div>
      </div>

      {/* TAB 1: DRE SIMPLIFICADA */}
      {activeSubTab === 'dre' && (
        <div className="bg-white border border-slate-200/90 rounded-xl p-6 shadow-2xs space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Receipt className="w-5 h-5 text-blue-600" />
                Demonstrativo do Resultado do Exercício (DRE Operacional)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Competência: <strong>{selectedCompetence?.label}</strong>
              </p>
            </div>

            <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
              <span className="text-xs font-bold text-slate-700">Faturamento Bruto Estimado:</span>
              <span className="text-xs font-bold text-slate-400">R$</span>
              <input
                type="text"
                value={grossRevenueInput}
                onChange={(e) => setGrossRevenueInput(e.target.value)}
                className="w-28 h-7 text-xs font-mono font-bold bg-white border border-slate-300 rounded px-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* DRE Structured Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs">
            <div className="p-3 bg-slate-50 font-bold text-slate-800 flex justify-between">
              <span>(+) Receita Bruta Intermediação / Comissões Imobiliárias</span>
              <span className="font-mono text-emerald-600">{formatCurrency(grossRevenue)}</span>
            </div>

            <div className="p-3 bg-white flex justify-between text-slate-700">
              <span className="pl-4">(-) Total Despesas Fixas</span>
              <span className="font-mono text-rose-600">({formatCurrency(totalFixas)})</span>
            </div>

            <div className="p-3 bg-white flex justify-between text-slate-700">
              <span className="pl-4">(-) Total Despesas Variáveis</span>
              <span className="font-mono text-rose-600">({formatCurrency(totalVariaveis)})</span>
            </div>

            <div className="p-3 bg-slate-100 font-bold text-slate-900 flex justify-between border-t-2 border-slate-300 text-sm">
              <span>(=) Total de Despesas Operacionais</span>
              <span className="font-mono text-slate-900">({formatCurrency(totalGeral)})</span>
            </div>

            <div className={`p-4 font-extrabold flex justify-between text-base ${
              netOperatingIncome >= 0 ? 'bg-emerald-50 text-emerald-900' : 'bg-rose-50 text-rose-900'
            }`}>
              <div>
                <span>(=) Resultado Operacional da Imobiliária</span>
                <span className="block text-xs font-normal text-slate-500 mt-0.5">
                  Margem Operacional: {operatingMargin.toFixed(1)}%
                </span>
              </div>
              <span className="font-mono text-lg">{formatCurrency(netOperatingIncome)}</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: POR CATEGORIA */}
      {activeSubTab === 'category' && (
        <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-2xs space-y-4">
          <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
            <FolderTree className="w-4 h-4 text-blue-600" />
            Consolidado por Categoria de Custo ({selectedCompetence?.label})
          </h3>

          <div className="space-y-2">
            {categoryRows.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">Nenhum lançamento nesta competência.</p>
            ) : (
              categoryRows.map(({ category, amount, percentage, count }) => (
                <div
                  key={category?.id || 'gen'}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50/80 border border-slate-200 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: category?.color || '#3B82F6' }}
                    />
                    <div>
                      <p className="font-bold text-slate-800">{category?.name || 'Geral'}</p>
                      <p className="text-[10px] text-slate-400">{count} lançamentos • {percentage.toFixed(1)}% do total</p>
                    </div>
                  </div>

                  <span className="font-bold font-mono text-slate-900 text-sm">
                    {formatCurrency(amount)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 3: POR FORNECEDOR */}
      {activeSubTab === 'supplier' && (
        <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-2xs space-y-4">
          <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
            <Building className="w-4 h-4 text-emerald-600" />
            Ranking e Total por Fornecedor ({selectedCompetence?.label})
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <th className="py-2.5 px-3">Fornecedor</th>
                  <th className="py-2.5 px-3 text-center">Faturas</th>
                  <th className="py-2.5 px-3 text-right">Média por Fatura</th>
                  <th className="py-2.5 px-3 text-right font-bold">Total Acumulado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {supplierRows.map(({ supplier, amount, count, avg }) => (
                  <tr key={supplier} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-3 font-bold text-slate-800">{supplier}</td>
                    <td className="py-3 px-3 text-center font-semibold">{count}</td>
                    <td className="py-3 px-3 text-right font-mono text-slate-600">{formatCurrency(avg)}</td>
                    <td className="py-3 px-3 text-right font-bold font-mono text-slate-900">
                      {formatCurrency(amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: COMPARATIVO MENSAL */}
      {activeSubTab === 'monthly' && (
        <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-2xs space-y-4">
          <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-purple-600" />
            Histórico Comparativo de Competências
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <th className="py-3 px-4">Competência</th>
                  <th className="py-3 px-4 text-center">Nº Lançamentos</th>
                  <th className="py-3 px-4 text-right">Total Fixas</th>
                  <th className="py-3 px-4 text-right">Total Variáveis</th>
                  <th className="py-3 px-4 text-right">Total Pago</th>
                  <th className="py-3 px-4 text-right font-bold">Total Geral</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {monthlyHistory.map(({ competence, totalFixas, totalVariaveis, totalPagas, totalGeral, count }) => (
                  <tr key={competence.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 font-bold text-slate-800">{competence.label}</td>
                    <td className="py-3 px-4 text-center font-semibold">{count}</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-600">{formatCurrency(totalFixas)}</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-600">{formatCurrency(totalVariaveis)}</td>
                    <td className="py-3 px-4 text-right font-mono text-emerald-600 font-semibold">{formatCurrency(totalPagas)}</td>
                    <td className="py-3 px-4 text-right font-bold font-mono text-blue-600">{formatCurrency(totalGeral)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: RESUMO / KIT DO CONTADOR */}
      {activeSubTab === 'accountant' && (
        <div className="bg-white border border-slate-200/90 rounded-xl p-6 shadow-2xs space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-base text-slate-800 flex items-center gap-2">
                <Send className="w-5 h-5 text-emerald-600" />
                Kit de Envio para Contabilidade Externa
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Gere todos os documentos necessários em um único clique para auditoria fiscal.
              </p>
            </div>

            <button
              onClick={() => onNavigateTab('comissione')}
              className="h-10 flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 rounded-lg shadow-2xs transition cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>Transmitir para Comissione</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <h4 className="font-bold text-slate-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Checklist da Prestação de Contas
              </h4>
              <ul className="text-xs text-slate-600 space-y-1.5 pl-5 list-disc">
                <li>Razão Social e CNPJ validados nas Configurações</li>
                <li>Todas as despesas fixas recorrentes vinculadas</li>
                <li>Comprovantes e notas fiscais anexadas em PDF/Imagem</li>
                <li>Totais de despesas pagas vs pendentes consolidados</li>
              </ul>
            </div>

            <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200 space-y-3">
              <h4 className="font-bold text-blue-900 text-xs">
                Escritório Contábil Cadastrado:
              </h4>
              <p className="text-xs text-blue-800 font-semibold">{settings.accountantName || 'Não especificado'}</p>
              <p className="text-xs text-blue-700">{settings.accountantEmail || 'Sem e-mail cadastrado'}</p>
              <button
                onClick={() => onNavigateTab('settings')}
                className="text-xs text-blue-600 font-bold hover:underline cursor-pointer"
              >
                Editar dados do contador
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
