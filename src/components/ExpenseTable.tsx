import React, { useState } from 'react';
import {
  Pencil,
  Copy,
  Trash2,
  Paperclip,
  CheckCircle2,
  Clock,
  FileCheck,
  ChevronDown,
  ChevronRight,
  Search,
  Filter,
  Building,
  Tag,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import { Category, ExpenseItem } from '../types';
import { formatCurrency, formatDate } from '../utils/formatters';

interface ExpenseTableProps {
  items: ExpenseItem[];
  categories: Category[];
  onEdit: (item: ExpenseItem) => void;
  onDuplicate: (item: ExpenseItem) => void;
  onDelete: (item: ExpenseItem) => void;
  onToggleStatus: (item: ExpenseItem) => void;
  onManageReceipts: (item: ExpenseItem) => void;
}

export const ExpenseTable: React.FC<ExpenseTableProps> = ({
  items,
  categories,
  onEdit,
  onDuplicate,
  onDelete,
  onToggleStatus,
  onManageReceipts,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | 'PAGO' | 'PENDENTE'>('ALL');
  const [selectedType, setSelectedType] = useState<'ALL' | 'FIXA' | 'VARIAVEL'>('ALL');

  const categoryMap = new Map<string, Category>(categories.map((c) => [c.id, c]));

  // Filtering
  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.supplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.costCenter && item.costCenter.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCategory = selectedCategory === 'ALL' || item.categoryId === selectedCategory;
    const matchesStatus = selectedStatus === 'ALL' || item.status === selectedStatus;
    const matchesType = selectedType === 'ALL' || item.type === selectedType;

    return matchesSearch && matchesCategory && matchesStatus && matchesType;
  });

  const totalFixas = filteredItems.filter((i) => i.type === 'FIXA').reduce((a, b) => a + b.amount, 0);
  const totalVariaveis = filteredItems.filter((i) => i.type === 'VARIAVEL').reduce((a, b) => a + b.amount, 0);
  const totalGeral = totalFixas + totalVariaveis;

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-3">
      {/* Search and Filters Bar */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-3 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por descrição, fornecedor ou centro de custo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-8 pl-8 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 border border-slate-200 rounded-lg">
            <Filter className="w-3 h-3 text-slate-400" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-transparent text-xs text-slate-700 font-medium focus:outline-none cursor-pointer"
            >
              <option value="ALL">Todas Categorias</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as 'ALL' | 'FIXA' | 'VARIAVEL')}
            className="h-8 bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-2 text-xs font-medium focus:outline-none cursor-pointer"
          >
            <option value="ALL">Fixas & Variáveis</option>
            <option value="FIXA">Apenas Fixas</option>
            <option value="VARIAVEL">Apenas Variáveis</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as 'ALL' | 'PAGO' | 'PENDENTE')}
            className="h-8 bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-2 text-xs font-medium focus:outline-none cursor-pointer"
          >
            <option value="ALL">Todos Status</option>
            <option value="PAGO">Pagas</option>
            <option value="PENDENTE">Pendentes</option>
          </select>
        </div>
      </div>

      {/* Main ERP Table */}
      <div className="bg-white border border-slate-200/90 rounded-xl shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200">
                <th className="py-3 px-3 w-8 text-center"></th>
                <th className="py-3 px-3 w-10 text-center">#</th>
                <th className="py-3 px-4 min-w-[200px]">Descrição / Histórico ERP</th>
                <th className="py-3 px-4 min-w-[130px]">Categoria</th>
                <th className="py-3 px-4 min-w-[140px]">Fornecedor</th>
                <th className="py-3 px-4 min-w-[80px] text-center">Tipo</th>
                <th className="py-3 px-4 min-w-[100px] text-center">Vencimento</th>
                <th className="py-3 px-4 min-w-[95px] text-center">Status</th>
                <th className="py-3 px-4 min-w-[110px] text-right">Valor (R$)</th>
                <th className="py-3 px-4 min-w-[70px] text-center">Anexo</th>
                <th className="py-3 px-4 w-28 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    <FileCheck className="w-8 h-8 mx-auto mb-2 opacity-30 text-slate-400" />
                    <p className="font-medium text-sm text-slate-600">Nenhuma despesa encontrada com estes filtros.</p>
                    <p className="text-xs mt-1 text-slate-400">Tente ajustar o termo de pesquisa ou a categoria.</p>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, index) => {
                  const cat = categoryMap.get(item.categoryId);
                  const hasReceipts = item.receipts && item.receipts.length > 0;
                  const isExpanded = expandedId === item.id;
                  const isOverdue = item.status === 'PENDENTE' && item.dueDate < todayStr;

                  return (
                    <React.Fragment key={item.id}>
                      <tr className={`hover:bg-slate-50/80 transition group ${isExpanded ? 'bg-blue-50/20' : ''}`}>
                        <td className="py-3 px-2 text-center">
                          <button
                            onClick={() => toggleExpand(item.id)}
                            className="p-1 rounded text-slate-400 hover:text-slate-600 transition cursor-pointer"
                            title="Expandir detalhes da linha"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5 text-blue-600" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </td>

                        <td className="py-3 px-3 text-slate-400 font-mono text-[11px] text-center">
                          {index + 1}
                        </td>

                        <td className="py-3 px-4 font-semibold text-slate-800">
                          <div>
                            {item.description}
                            {item.costCenter && (
                              <span className="block text-[10px] text-slate-400 font-normal">
                                CC: {item.costCenter}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          {cat ? (
                            <span
                              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium"
                              style={{
                                backgroundColor: `${cat.color}15`,
                                color: cat.color,
                                border: `1px solid ${cat.color}30`,
                              }}
                            >
                              <span
                                className="w-1.5 h-1.5 rounded-full shrink-0"
                                style={{ backgroundColor: cat.color }}
                              />
                              {cat.name}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-slate-600 font-medium">
                          {item.supplier || '-'}
                        </td>

                        <td className="py-3 px-4 text-center">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                              item.type === 'FIXA'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200/80'
                                : 'bg-purple-50 text-purple-700 border border-purple-200/80'
                            }`}
                          >
                            {item.type}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-center font-mono text-[11px]">
                          <span className={isOverdue ? 'text-rose-600 font-bold flex items-center justify-center gap-1' : 'text-slate-600'}>
                            {isOverdue && <AlertTriangle className="w-3 h-3 text-rose-500 shrink-0" />}
                            {formatDate(item.dueDate)}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => onToggleStatus(item)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold transition cursor-pointer ${
                              item.status === 'PAGO'
                                ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100/80 border border-emerald-200/80'
                                : 'bg-amber-50 text-amber-700 hover:bg-amber-100/80 border border-amber-200/80'
                            }`}
                            title="Clique para alternar Pago / Pendente"
                          >
                            {item.status === 'PAGO' ? (
                              <>
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Pago
                              </>
                            ) : (
                              <>
                                <Clock className="w-3 h-3 text-amber-600" />
                                {isOverdue ? 'Vencido' : 'Pendente'}
                              </>
                            )}
                          </button>
                        </td>

                        <td className="py-3 px-4 text-right font-bold text-slate-900 font-mono">
                          {formatCurrency(item.amount)}
                        </td>

                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => onManageReceipts(item)}
                            className={`p-1.5 rounded-lg transition cursor-pointer inline-flex items-center gap-1 ${
                              hasReceipts
                                ? 'bg-blue-50 text-blue-600 border border-blue-200'
                                : 'text-slate-300 hover:text-slate-500 hover:bg-slate-100'
                            }`}
                            title={hasReceipts ? `${item.receipts?.length} anexo(s)` : 'Anexar comprovante'}
                          >
                            <Paperclip className="w-3.5 h-3.5" />
                            {hasReceipts && (
                              <span className="text-[10px] font-bold">{item.receipts?.length}</span>
                            )}
                          </button>
                        </td>

                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => onEdit(item)}
                              className="p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                              title="Editar despesa"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => onDuplicate(item)}
                              className="p-1 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition cursor-pointer"
                              title="Duplicar despesa"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => onDelete(item)}
                              className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                              title="Excluir despesa"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expandable Line Details */}
                      {isExpanded && (
                        <tr className="bg-slate-50/90 border-b border-slate-200/80">
                          <td colSpan={11} className="p-4">
                            <div className="bg-white rounded-xl p-4 border border-slate-200/80 space-y-3 text-xs">
                              <div className="flex flex-wrap items-center justify-between gap-4">
                                <div className="space-y-1">
                                  <h4 className="font-bold text-slate-800 text-sm">
                                    {item.description}
                                  </h4>
                                  <p className="text-slate-500 flex items-center gap-2 text-[11px]">
                                    <Building className="w-3.5 h-3.5 text-slate-400" />
                                    <span>Fornecedor: <strong>{item.supplier || 'Não informado'}</strong></span>
                                    <span>•</span>
                                    <Tag className="w-3.5 h-3.5 text-slate-400" />
                                    <span>Centro de Custo: <strong>{item.costCenter || 'Geral Imobiliária'}</strong></span>
                                  </p>
                                </div>

                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => onManageReceipts(item)}
                                    className="h-8 flex items-center gap-1.5 px-3 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold transition cursor-pointer"
                                  >
                                    <Paperclip className="w-3.5 h-3.5" />
                                    <span>Anexos / Notas ({item.receipts?.length || 0})</span>
                                  </button>
                                </div>
                              </div>

                              {item.observation && (
                                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 text-slate-600 italic">
                                  "{item.observation}"
                                </div>
                              )}

                              <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100">
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3 text-slate-400" />
                                  Criado em: {formatDate(item.createdAt)}
                                </span>
                                <span>ID do Registro ERP: <code className="font-mono">{item.id}</code></span>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Table Footer Summary Row */}
      {filteredItems.length > 0 && (
        <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 text-xs font-bold text-slate-800">
          <div className="flex items-center gap-6">
            <span>
              Total Fixas:{' '}
              <span className="text-blue-600 font-mono ml-1">
                {formatCurrency(totalFixas)}
              </span>
            </span>
            <span>
              Total Variáveis:{' '}
              <span className="text-purple-600 font-mono ml-1">
                {formatCurrency(totalVariaveis)}
              </span>
            </span>
          </div>
          <div className="text-sm">
            Total da Seleção:{' '}
            <span className="text-emerald-600 font-extrabold font-mono ml-2 text-base">
              {formatCurrency(totalGeral)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
