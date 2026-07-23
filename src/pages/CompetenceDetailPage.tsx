import React, { useState, useMemo } from 'react';
import {
  FileText,
  FileSpreadsheet,
  PlusCircle,
  Upload,
  Printer,
  CalendarDays,
  CheckCircle2,
  Clock,
  Share2,
} from 'lucide-react';
import { Category, Competence, ExpenseItem, FilterOptions } from '../types';
import { ExpenseTable } from '../components/ExpenseTable';
import { ExpenseFilters } from '../components/ExpenseFilters';
import { StatCard } from '../components/StatCard';
import { formatCurrency } from '../utils/formatters';

interface CompetenceDetailPageProps {
  activeCompetence: Competence | null;
  items: ExpenseItem[];
  categories: Category[];
  suppliers: string[];
  onNewExpense: () => void;
  onImportExcel: () => void;
  onGeneratePDF: () => void;
  onGenerateExcel: () => void;
  onOpenComissione: () => void;
  onEditItem: (item: ExpenseItem) => void;
  onDuplicateItem: (item: ExpenseItem) => void;
  onDeleteItem: (item: ExpenseItem) => void;
  onToggleStatus: (item: ExpenseItem) => void;
  onManageReceipts: (item: ExpenseItem) => void;
}

export const CompetenceDetailPage: React.FC<CompetenceDetailPageProps> = ({
  activeCompetence,
  items,
  categories,
  suppliers,
  onNewExpense,
  onImportExcel,
  onGeneratePDF,
  onGenerateExcel,
  onOpenComissione,
  onEditItem,
  onDuplicateItem,
  onDeleteItem,
  onToggleStatus,
  onManageReceipts,
}) => {
  const [filters, setFilters] = useState<FilterOptions>({
    search: '',
    categoryId: '',
    supplier: '',
    type: 'TODAS',
    status: 'TODAS',
  });

  const handleResetFilters = () => {
    setFilters({
      search: '',
      categoryId: '',
      supplier: '',
      type: 'TODAS',
      status: 'TODAS',
      minAmount: undefined,
      maxAmount: undefined,
    });
  };

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Search
      if (
        filters.search &&
        !item.description.toLowerCase().includes(filters.search.toLowerCase()) &&
        !item.supplier.toLowerCase().includes(filters.search.toLowerCase()) &&
        !item.observation?.toLowerCase().includes(filters.search.toLowerCase())
      ) {
        return false;
      }

      // Category
      if (filters.categoryId && item.categoryId !== filters.categoryId) {
        return false;
      }

      // Supplier
      if (filters.supplier && item.supplier !== filters.supplier) {
        return false;
      }

      // Type
      if (filters.type !== 'TODAS' && item.type !== filters.type) {
        return false;
      }

      // Status
      if (filters.status !== 'TODAS' && item.status !== filters.status) {
        return false;
      }

      // Min Amount
      if (filters.minAmount !== undefined && item.amount < filters.minAmount) {
        return false;
      }

      // Max Amount
      if (filters.maxAmount !== undefined && item.amount > filters.maxAmount) {
        return false;
      }

      return true;
    });
  }, [items, filters]);

  // Totals
  const totalFixas = filteredItems.filter((i) => i.type === 'FIXA').reduce((a, b) => a + b.amount, 0);
  const totalVariaveis = filteredItems.filter((i) => i.type === 'VARIAVEL').reduce((a, b) => a + b.amount, 0);
  const totalGeral = totalFixas + totalVariaveis;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Actions Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white border border-slate-200/90 rounded-xl p-5 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-800">
              Competência: {activeCompetence?.label || 'Julho/2026'}
            </h2>
            <span className="text-[11px] bg-blue-50 text-blue-700 font-bold px-2.5 py-0.5 rounded-md border border-blue-200/80">
              {filteredItems.length} lançamentos
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Visualização detalhada de todas as despesas da competência ativa.
          </p>
        </div>

        {/* Action Buttons (40px height) */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            onClick={onNewExpense}
            className="h-10 flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 rounded-lg text-xs font-medium transition-all shadow-2xs cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Nova Despesa</span>
          </button>

          <button
            onClick={onImportExcel}
            className="h-10 flex items-center gap-1.5 bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 px-3.5 rounded-lg text-xs font-medium transition-all shadow-2xs cursor-pointer"
          >
            <Upload className="w-4 h-4 text-emerald-600" />
            <span>Importar Excel</span>
          </button>

          <button
            onClick={onGeneratePDF}
            className="h-10 flex items-center gap-1.5 bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 px-3 rounded-lg text-xs font-medium transition-all shadow-2xs cursor-pointer"
          >
            <FileText className="w-4 h-4 text-rose-600" />
            <span>PDF</span>
          </button>

          <button
            onClick={onGenerateExcel}
            className="h-10 flex items-center gap-1.5 bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 px-3 rounded-lg text-xs font-medium transition-all shadow-2xs cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Excel</span>
          </button>

          <button
            onClick={handlePrint}
            title="Imprimir direto"
            className="h-10 w-10 flex items-center justify-center bg-white text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer"
          >
            <Printer className="w-4 h-4" />
          </button>

          <button
            onClick={onOpenComissione}
            title="Integrar com Comissione"
            className="h-10 w-10 flex items-center justify-center bg-emerald-50 text-emerald-700 hover:bg-emerald-100/80 border border-emerald-200/80 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Geral"
          value={formatCurrency(totalGeral)}
          subtext="Soma de todas as despesas"
          icon={CalendarDays}
          iconBgColor="bg-blue-50"
          iconTextColor="text-blue-600"
        />

        <StatCard
          title="Despesas Fixas"
          value={formatCurrency(totalFixas)}
          subtext="Replicadas da matriz de fixas"
          icon={CheckCircle2}
          iconBgColor="bg-emerald-50"
          iconTextColor="text-emerald-600"
        />

        <StatCard
          title="Despesas Variáveis"
          value={formatCurrency(totalVariaveis)}
          subtext="Lançamentos diretos do mês"
          icon={Clock}
          iconBgColor="bg-purple-50"
          iconTextColor="text-purple-600"
        />

        <StatCard
          title="Quantidade"
          value={`${filteredItems.length} itens`}
          subtext="Lançamentos na seleção"
          icon={FileText}
          iconBgColor="bg-amber-50"
          iconTextColor="text-amber-600"
        />
      </div>

      {/* Filters Bar */}
      <ExpenseFilters
        filters={filters}
        categories={categories}
        suppliers={suppliers}
        onChangeFilters={setFilters}
        onResetFilters={handleResetFilters}
      />

      {/* Main Expense Table */}
      <ExpenseTable
        items={filteredItems}
        categories={categories}
        onEdit={onEditItem}
        onDuplicate={onDuplicateItem}
        onDelete={onDeleteItem}
        onToggleStatus={onToggleStatus}
        onManageReceipts={onManageReceipts}
      />
    </div>
  );
};
