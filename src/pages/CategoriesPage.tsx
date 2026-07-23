import React from 'react';
import { FolderTree, PlusCircle, Pencil, Trash2 } from 'lucide-react';
import { Category, ExpenseItem } from '../types';
import { formatCurrency } from '../utils/formatters';

interface CategoriesPageProps {
  categories: Category[];
  allItems: ExpenseItem[];
  onNewCategory: () => void;
  onEditCategory: (cat: Category) => void;
  onDeleteCategory: (id: string) => void;
}

export const CategoriesPage: React.FC<CategoriesPageProps> = ({
  categories,
  allItems,
  onNewCategory,
  onEditCategory,
  onDeleteCategory,
}) => {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between bg-white border border-slate-200/90 rounded-xl p-5 shadow-2xs">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <FolderTree className="w-5 h-5 text-blue-600" />
            Categorias de Despesas
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Organização do plano de contas para relatórios e prestação de contas.
          </p>
        </div>

        <button
          onClick={onNewCategory}
          className="h-10 flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs px-4 rounded-lg transition-all shadow-2xs cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Nova Categoria</span>
        </button>
      </div>

      {/* Grid of Categories */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {categories.map((cat) => {
          const catItems = allItems.filter((i) => i.categoryId === cat.id);
          const totalCatAmount = catItems.reduce((acc, i) => acc + i.amount, 0);

          return (
            <div
              key={cat.id}
              className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition-all"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span
                    className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold"
                    style={{
                      backgroundColor: `${cat.color}15`,
                      color: cat.color,
                      border: `1px solid ${cat.color}30`,
                    }}
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: cat.color }}
                    />
                    {cat.name}
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onEditCategory(cat)}
                      className="p-1 text-slate-400 hover:text-blue-600 transition cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDeleteCategory(cat.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-slate-500 min-h-[32px] line-clamp-2">
                  {cat.description || 'Sem descrição cadastrada.'}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">
                  {catItems.length} lançamento(s)
                </span>
                <span className="font-bold text-slate-900 font-mono">
                  {formatCurrency(totalCatAmount)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
