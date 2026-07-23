import React, { useState, useEffect } from 'react';
import { X, Save, Plus } from 'lucide-react';
import { Category, ExpenseItem, ExpenseType, ExpenseStatus } from '../../types';

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: Partial<ExpenseItem>) => void;
  initialData?: ExpenseItem | null;
  categories: Category[];
  competenceId: string;
}

export const ExpenseModal: React.FC<ExpenseModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  categories,
  competenceId,
}) => {
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [supplier, setSupplier] = useState('');
  const [amount, setAmount] = useState<string>('');
  const [type, setType] = useState<ExpenseType>('VARIAVEL');
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState<ExpenseStatus>('PENDENTE');
  const [costCenter, setCostCenter] = useState('');
  const [observation, setObservation] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    setErrorMessage('');
    if (initialData) {
      setDescription(initialData.description || '');
      setCategoryId(initialData.categoryId || (categories[0]?.id || ''));
      setSupplier(initialData.supplier || '');
      setAmount(initialData.amount ? String(initialData.amount) : '');
      setType(initialData.type || 'VARIAVEL');
      setDueDate(initialData.dueDate || new Date().toISOString().split('T')[0]);
      setStatus(initialData.status || 'PENDENTE');
      setCostCenter(initialData.costCenter || '');
      setObservation(initialData.observation || '');
    } else {
      setDescription('');
      setCategoryId(categories[0]?.id || '');
      setSupplier('');
      setAmount('');
      setType('VARIAVEL');
      setDueDate(new Date().toISOString().split('T')[0]);
      setStatus('PENDENTE');
      setCostCenter('');
      setObservation('');
    }
  }, [initialData, categories, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    const parsedAmount = parseFloat(amount.replace(',', '.'));
    if (!description || isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMessage('Por favor, informe a descrição e um valor válido maior que zero.');
      return;
    }

    onSave({
      id: initialData?.id,
      competenceId,
      description,
      categoryId: categoryId || categories[0]?.id || 'cat-1',
      supplier,
      amount: parsedAmount,
      type,
      dueDate,
      status,
      costCenter,
      observation,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200/90 rounded-xl w-full max-w-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-base text-slate-800">
            {initialData ? 'Editar Despesa' : 'Nova Despesa Variável'}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg font-medium">
              {errorMessage}
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Descrição / Histórico da Despesa <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Material de Papelaria / Combustível Visita"
              className="w-full bg-white border border-slate-200 rounded-lg h-10 px-3.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-none"
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
                Fornecedor / Beneficiário
              </label>
              <input
                type="text"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="Ex: Kalunga / Posto Shell"
                className="w-full bg-white border border-slate-200 rounded-lg h-10 px-3.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Valor (R$) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
                className="w-full bg-white border border-slate-200 rounded-lg h-10 px-3.5 text-xs text-slate-800 font-bold focus:ring-2 focus:ring-blue-600 focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Vencimento
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg h-10 px-3 text-xs text-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ExpenseStatus)}
                className="w-full bg-white border border-slate-200 rounded-lg h-10 px-3 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-600 cursor-pointer focus:outline-none"
              >
                <option value="PENDENTE">Pendente</option>
                <option value="PAGO">Pago</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tipo de Despesa
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as ExpenseType)}
                className="w-full bg-white border border-slate-200 rounded-lg h-10 px-3 text-xs text-slate-800 focus:ring-2 focus:ring-blue-600 cursor-pointer focus:outline-none"
              >
                <option value="VARIAVEL">Variável</option>
                <option value="FIXA">Fixa</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Centro de Custo (Opcional)
              </label>
              <input
                type="text"
                value={costCenter}
                onChange={(e) => setCostCenter(e.target.value)}
                placeholder="Ex: Matriz / Vendas"
                className="w-full bg-white border border-slate-200 rounded-lg h-10 px-3.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Observação / Notas para Contador
            </label>
            <textarea
              rows={2}
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              placeholder="Detalhes adicionais sobre a nota ou recibo..."
              className="w-full bg-white border border-slate-200 rounded-lg p-3 text-xs text-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-none"
            />
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
              <span>Salvar Despesa</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
