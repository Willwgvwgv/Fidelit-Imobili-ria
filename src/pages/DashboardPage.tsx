import React from 'react';
import {
  CalendarDays,
  DollarSign,
  Repeat,
  TrendingUp,
  Receipt,
  FileText,
  FileSpreadsheet,
  PlusCircle,
  Upload,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  PieChart as PieIcon,
  BarChart2,
  Clock,
  Send,
  Building,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import { Category, CompanySettings, Competence, ExpenseItem } from '../types';
import { StatCard } from '../components/StatCard';
import { formatCurrency, formatDate } from '../utils/formatters';

interface DashboardPageProps {
  settings: CompanySettings;
  activeCompetence: Competence | null;
  allCompetencies: Competence[];
  allItems: ExpenseItem[];
  categories: Category[];
  onNavigateTab: (tab: string) => void;
  onNewCompetence: () => void;
  onNewExpense: () => void;
  onImportExcel: () => void;
  onGeneratePDF: () => void;
  onGenerateExcel: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  settings,
  activeCompetence,
  allCompetencies,
  allItems,
  categories,
  onNavigateTab,
  onNewCompetence,
  onNewExpense,
  onImportExcel,
  onGeneratePDF,
  onGenerateExcel,
}) => {
  const categoryMap = new Map<string, Category>(categories.map((c) => [c.id, c]));

  // Current competence items
  const currentItems = activeCompetence
    ? allItems.filter((i) => i.competenceId === activeCompetence.id)
    : [];

  const totalFixas = currentItems.filter((i) => i.type === 'FIXA').reduce((a, b) => a + b.amount, 0);
  const totalVariaveis = currentItems.filter((i) => i.type === 'VARIAVEL').reduce((a, b) => a + b.amount, 0);
  const totalGeral = totalFixas + totalVariaveis;
  const totalPagas = currentItems.filter((i) => i.status === 'PAGO').reduce((a, b) => a + b.amount, 0);
  const totalPendentes = currentItems.filter((i) => i.status === 'PENDENTE').reduce((a, b) => a + b.amount, 0);

  // Overdue calculation (dueDate < today and status === PENDENTE)
  const todayStr = new Date().toISOString().split('T')[0];
  const overdueItems = currentItems.filter(
    (i) => i.status === 'PENDENTE' && i.dueDate < todayStr
  );
  const totalVencido = overdueItems.reduce((acc, i) => acc + i.amount, 0);

  // Group by Category for Recharts Pie Chart
  const categoryTotals = new Map<string, number>();
  currentItems.forEach((item) => {
    const current = categoryTotals.get(item.categoryId) || 0;
    categoryTotals.set(item.categoryId, current + item.amount);
  });

  const pieChartData = Array.from(categoryTotals.entries()).map(([catId, amount]) => {
    const cat = categoryMap.get(catId);
    return {
      name: cat?.name || 'Geral',
      value: amount,
      color: cat?.color || '#3B82F6',
    };
  }).sort((a, b) => b.value - a.value);

  // Evolution chart data across all competencies (last 6-12 competencies)
  const sortedCompetencies = [...allCompetencies].reverse(); // oldest to newest
  const evolutionChartData = sortedCompetencies.slice(-6).map((comp) => {
    const compItems = allItems.filter((i) => i.competenceId === comp.id);
    const fix = compItems.filter((i) => i.type === 'FIXA').reduce((a, b) => a + b.amount, 0);
    const varAmount = compItems.filter((i) => i.type === 'VARIAVEL').reduce((a, b) => a + b.amount, 0);
    return {
      label: comp.label,
      'Despesas Fixas': fix,
      'Despesas Variáveis': varAmount,
      Total: fix + varAmount,
    };
  });

  return (
    <div className="space-y-6">
      {/* Top Banner Executive Header */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-2xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 px-2.5 py-1 rounded-md text-xs font-semibold border border-blue-200/80">
              <Building className="w-3.5 h-3.5 text-blue-600" />
              {settings.name}
            </span>
            <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-md text-xs font-semibold border border-emerald-200/80">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Competência Aberta: {activeCompetence?.label || 'Julho/2026'}
            </span>
          </div>

          <h1 className="text-xl font-bold text-slate-800 tracking-tight">
            Painel Executivo de Gestão Financeira
          </h1>
          <p className="text-slate-500 text-xs mt-1 max-w-2xl">
            Acompanhamento em tempo real de liquidez, despesas fixas, prestação de contas mensal e kit contábil para imobiliárias.
          </p>
        </div>

        {/* Quick Action Export Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <button
            onClick={onNewExpense}
            className="flex-1 lg:flex-none h-10 flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs px-4 rounded-lg transition-all shadow-2xs cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Nova Despesa</span>
          </button>
          <button
            onClick={onGeneratePDF}
            className="flex-1 lg:flex-none h-10 flex items-center justify-center gap-1.5 bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 font-medium text-xs px-3.5 rounded-lg transition-all shadow-2xs cursor-pointer"
            title="Exportar Prestação em PDF"
          >
            <FileText className="w-4 h-4 text-rose-600" />
            <span>PDF Auditoria</span>
          </button>
          <button
            onClick={onGenerateExcel}
            className="flex-1 lg:flex-none h-10 flex items-center justify-center gap-1.5 bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 font-medium text-xs px-3.5 rounded-lg transition-all shadow-2xs cursor-pointer"
            title="Exportar Planilha Excel"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Excel ERP</span>
          </button>
        </div>
      </div>

      {/* Main KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Fluxo de Caixa (Total)"
          value={formatCurrency(totalGeral)}
          subtext={`${currentItems.length} lançamentos na competência`}
          icon={DollarSign}
          iconBgColor="bg-slate-100"
          iconTextColor="text-slate-800"
        />

        <StatCard
          title="Total Pago"
          value={formatCurrency(totalPagas)}
          subtext={`${totalGeral > 0 ? ((totalPagas / totalGeral) * 100).toFixed(1) : 0}% liquidado`}
          icon={CheckCircle2}
          iconBgColor="bg-emerald-50"
          iconTextColor="text-emerald-600"
        />

        <StatCard
          title="Total Pendente"
          value={formatCurrency(totalPendentes)}
          subtext={`${currentItems.filter((i) => i.status === 'PENDENTE').length} faturas a pagar`}
          icon={Clock}
          iconBgColor="bg-amber-50"
          iconTextColor="text-amber-600"
        />

        <StatCard
          title="Total Vencido"
          value={formatCurrency(totalVencido)}
          subtext={overdueItems.length > 0 ? `⚠️ ${overdueItems.length} faturas em atraso` : 'Nenhuma conta em atraso'}
          icon={AlertTriangle}
          iconBgColor={overdueItems.length > 0 ? 'bg-rose-50' : 'bg-slate-50'}
          iconTextColor={overdueItems.length > 0 ? 'text-rose-600' : 'text-slate-400'}
        />

        <StatCard
          title="Fixas vs Variáveis"
          value={`${totalGeral > 0 ? ((totalFixas / totalGeral) * 100).toFixed(0) : 0}% Fixa`}
          subtext={`Fixas: ${formatCurrency(totalFixas)}`}
          icon={Repeat}
          iconBgColor="bg-blue-50"
          iconTextColor="text-blue-600"
        />
      </div>

      {/* Interactive Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 12-Month / Competencies Evolution Bar Chart */}
        <div className="lg:col-span-2 bg-white border border-slate-200/90 rounded-xl p-5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-blue-600" />
                Evolução Financeira por Competência
              </h3>
              <p className="text-[11px] text-slate-500">
                Histórico comparativo de despesas fixas e variáveis nos últimos meses.
              </p>
            </div>
            <button
              onClick={() => onNavigateTab('reports')}
              className="text-xs text-blue-600 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
            >
              Ver DRE Completa <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-64 w-full pt-2">
            {evolutionChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Sem dados suficientes para gráficos de evolução.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={evolutionChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748B' }} tickFormatter={(val) => `R$${val / 1000}k`} />
                  <Tooltip
                    formatter={(val: number | string | Array<number | string> | undefined) => [
                      formatCurrency(typeof val === 'number' ? val : Number(val) || 0),
                      '',
                    ]}
                    contentStyle={{ borderRadius: '8px', fontSize: '12px', border: '1px solid #E2E8F0' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Bar dataKey="Despesas Fixas" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Despesas Variáveis" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Expenses by Category Donut Chart */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                <PieIcon className="w-4 h-4 text-purple-600" />
                Despesas por Categoria
              </h3>
              <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                {activeCompetence?.label}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mb-4">
              Distribuição por centro de custo e grupo contábil.
            </p>

            <div className="h-48 w-full">
              {pieChartData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-400">
                  Nenhuma despesa cadastrada no mês.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number | string | Array<number | string> | undefined) =>
                        formatCurrency(typeof value === 'number' ? value : Number(value) || 0)
                      }
                      contentStyle={{ borderRadius: '8px', fontSize: '11px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Top 3 categories legend list */}
          <div className="space-y-1.5 pt-3 border-t border-slate-100">
            {pieChartData.slice(0, 3).map((item) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-slate-600 truncate">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="truncate">{item.name}</span>
                </span>
                <span className="font-bold text-slate-800 font-mono ml-2">
                  {formatCurrency(item.value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Alerts & Quick ERP Operations Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pending & Overdue Bills Alert List */}
        <div className="lg:col-span-2 bg-white border border-slate-200/90 rounded-xl p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Alertas Financeiros & Contas a Pagar ({currentItems.filter((i) => i.status === 'PENDENTE').length})
              </h3>
              <p className="text-[11px] text-slate-500">Faturas pendentes de liquidação na competência ativa</p>
            </div>
            <button
              onClick={() => onNavigateTab('competence_detail')}
              className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
            >
              Gerenciar tudo
            </button>
          </div>

          <div className="space-y-2">
            {currentItems.filter((i) => i.status === 'PENDENTE').length === 0 ? (
              <div className="p-6 text-center bg-slate-50 rounded-lg border border-dashed border-slate-200">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-700">Parabéns! Nenhuma conta pendente nesta competência.</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Todas as despesas foram marcadas como PAGAS.</p>
              </div>
            ) : (
              currentItems
                .filter((i) => i.status === 'PENDENTE')
                .slice(0, 4)
                .map((item) => {
                  const isOverdue = item.dueDate < todayStr;
                  const cat = categoryMap.get(item.categoryId);

                  return (
                    <div
                      key={item.id}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition ${
                        isOverdue
                          ? 'bg-rose-50/60 border-rose-200'
                          : 'bg-slate-50/80 border-slate-200/80 hover:bg-slate-100/80'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0"
                          style={{ backgroundColor: cat?.color || '#3B82F6' }}
                        >
                          {cat?.name ? cat.name.charAt(0) : 'G'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate">{item.description}</p>
                          <p className="text-[11px] text-slate-500 flex items-center gap-2">
                            <span>{item.supplier || 'Fornecedor não inf.'}</span>
                            <span>•</span>
                            <span className={isOverdue ? 'text-rose-600 font-bold' : 'text-slate-600'}>
                              Vencimento: {formatDate(item.dueDate)} {isOverdue && '(VENCIDO)'}
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-mono font-bold text-slate-900 text-xs block">
                          {formatCurrency(item.amount)}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mt-0.5 ${
                            isOverdue
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {isOverdue ? 'Atrasado' : 'Pendente'}
                        </span>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>

        {/* Right: Accountant Kit & Comissione Sync Status */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2 mb-1">
              <Send className="w-4 h-4 text-emerald-600" />
              Kit Contábil & Envio Comissione
            </h3>
            <p className="text-[11px] text-slate-500 mb-4">
              Status da integração e exportação para contabilidade externa.
            </p>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs mb-4">
              <div className="flex justify-between items-center text-slate-600">
                <span>Destinatário Contábil:</span>
                <span className="font-bold text-slate-800">{settings.accountantName || 'Silva & Assoc.'}</span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>Competência Ativa:</span>
                <span className="font-semibold text-blue-600">{activeCompetence?.label}</span>
              </div>
              <div className="flex justify-between items-center text-slate-600 pt-2 border-t border-slate-200">
                <span>Total em Lançamentos:</span>
                <span className="font-mono font-bold text-slate-900">{formatCurrency(totalGeral)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => onNavigateTab('comissione')}
                className="w-full h-9 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs px-3 rounded-lg transition-all shadow-2xs cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Enviar para Comissione</span>
              </button>

              <button
                onClick={onImportExcel}
                className="w-full h-9 flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-medium text-xs px-3 rounded-lg transition cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-slate-500" />
                <span>Importar Planilha Externa</span>
              </button>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-[10px] text-slate-400 text-center">
            PrestConta ERP Imobiliário v2.4 • Conectado
          </div>
        </div>
      </div>
    </div>
  );
};
