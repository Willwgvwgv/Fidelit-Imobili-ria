import React, { useState, useEffect } from 'react';
import { X, Save, Zap } from 'lucide-react';
import { Category, FixedExpense } from '../../types';

interface FixedExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<FixedExpense>) => void;
  initialData?: FixedExpense | null;
  categories: Category[];
}

export const FixedExpenseModal: React.FC<FixedExpenseModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  categories,
}) => {
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [supplier, setSupplier] = useState('');
  const [defaultAmount, setDefaultAmount] = useState<string>('');
  const [dueDay, setDueDay] = useState<number>(10);
  const [costCenter, setCostCenter] = useState('');
  const [observation, setObservation] = useState('');
  const [active, setActive] = useState(true);
  const [monthlyRecurrence, setMonthlyRecurrence] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    setErrorMessage('');
    if (initialData) {
      setName(initialData.name || '');
      setCategoryId(initialData.categoryId || (categories[0]?.id || ''));
      setSupplier(initialData.supplier || '');
      setDefaultAmount(initialData.defaultAmount ? String(initialData.defaultAmount) : '');
      setDueDay(initialData.dueDay || 10);
      setCostCenter(initialData.costCenter || '');
      setObservation(initialData.observation || '');
      setActive(initialData.active ?? true);
      setMonthlyRecurrence(initialData.monthlyRecurrence ?? true);
    } else {
      setName('');
      setCategoryId(categories[0]?.id || '');
      setSupplier('');
      setDefaultAmount('');
      setDueDay(10);
      setCostCenter('');
      setObservation('');
      setActive(true);
      setMonthlyRecurrence(true);
    }
  }, [initialData, categories, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    const parsedAmount = parseFloat(defaultAmount.replace(',', '.'));
    if (!name || isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMessage('Preencha o nome e um valor padrão válido maior que zero.');
      return;
    }

    onSave({
      id: initialData?.id,
      name,
      categoryId: categoryId || categories[0]?.id || 'cat-1',
      supplier,
      defaultAmount: parsedAmount,
      dueDay: Math.min(31, Math.max(1, dueDay)),
      costCenter,
      observation,
      active,
      monthlyRecurrence,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200/90 rounded-xl w-full max-w-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-800">
                {initialData ? 'Editar Despesa Fixa' : 'Nova Despesa Fixa'}
              </h3>
              <p className="text-[11px] text-slate-500">Cadastro rápido para replicação automática mensal</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg font-medium">
              {errorMessage}
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nome da Despesa Fixa <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Aluguel da Sede / CRM Imobiliário / Internet Fibra"
              className="w-full bg-white border border-slate-200 rounded-lg h-10 px-3.5 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Categoria <span className="text-rose-500">*</span>
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg h-10 px-3 text-xs text-slate-800 focus:ring-2 focus:ring-blue-600 cursor-pointer focus:outline-none"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Fornecedor / Favorecido
              </label>
              <input
                type="text"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="Ex: Imobiliária / Vivo / Contador"
                className="w-full bg-white border border-slate-200 rounded-lg h-10 px-3.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Valor Padrão Mensal (R$) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={defaultAmount}
                onChange={(e) => setDefaultAmount(e.target.value)}
                placeholder="0,00"
                className="w-full bg-white border border-slate-200 rounded-lg h-10 px-3.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Dia do Vencimento (1 a 31)
              </label>
              <input
                type="number"
                min="1"
                max="31"
                value={dueDay}
                onChange={(e) => setDueDay(parseInt(e.target.value, 10) || 10)}
                className="w-full bg-white border border-slate-200 rounded-lg h-10 px-3.5 text-xs text-slate-800 font-semibold focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Centro de Custo
              </label>
              <input
                type="text"
                value={costCenter}
                onChange={(e) => setCostCenter(e.target.value)}
                placeholder="Ex: Matriz / Vendas"
                className="w-full bg-white border border-slate-200 rounded-lg h-10 px-3.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Observações Fixas
              </label>
              <input
                type="text"
                value={observation}
                onChange={(e) => setObservation(e.target.value)}
                placeholder="Ex: Contrato #402"
                className="w-full bg-white border border-slate-200 rounded-lg h-10 px-3.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Checkboxes */}
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="w-4 h-4 rounded-md text-blue-600 focus:ring-blue-600 border-slate-300 cursor-pointer"
              />
              Despesa Fixa Ativa
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={monthlyRecurrence}
                onChange={(e) => setMonthlyRecurrence(e.target.checked)}
                className="w-4 h-4 rounded-md text-blue-600 focus:ring-blue-600 border-slate-300 cursor-pointer"
              />
              Recorrência Mensal (Copiar automaticamente ao criar nova competência)
            </label>
          </div>

          {/* Actions */}
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
              <Save className="w-4 h-4" />
              <span>Salvar Fixa</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
