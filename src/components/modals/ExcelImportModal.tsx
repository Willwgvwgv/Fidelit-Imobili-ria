import React, { useState } from 'react';
import { X, Upload, FileSpreadsheet, CheckCircle, AlertTriangle } from 'lucide-react';
import { Category, ExpenseItem } from '../../types';
import { importExpensesFromExcel, ImportResult } from '../../utils/excelImporter';

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  competenceId: string;
  categories: Category[];
  onImportComplete: (items: ExpenseItem[]) => void;
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  isOpen,
  onClose,
  competenceId,
  categories,
  onImportComplete,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
    }
  };

  const handleProcessImport = async () => {
    if (!file) return;
    setIsProcessing(true);
    const res = await importExpensesFromExcel(file, competenceId, categories);
    setIsProcessing(false);
    setResult(res);

    if (res.success && res.items.length > 0) {
      onImportComplete(res.items);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200/90 rounded-xl w-full max-w-md shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-base text-slate-800">
              Importar Despesas via Excel
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Selecione uma planilha (.xlsx, .xls ou .csv) contendo colunas como:{' '}
            <strong className="font-bold">Descrição, Valor, Categoria, Fornecedor, Vencimento</strong>.
          </p>

          <label className="border-2 border-dashed border-slate-200 hover:border-emerald-500 rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition bg-slate-50/50">
            <Upload className="w-8 h-8 text-emerald-600 mb-2" />
            <span className="text-xs font-bold text-slate-700">
              {file ? file.name : 'Clique para selecionar a planilha'}
            </span>
            <span className="text-[11px] text-slate-400 mt-1">
              Suporta formato .xlsx e .csv
            </span>
            <input
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>

          {result && (
            <div
              className={`p-3.5 rounded-xl text-xs space-y-2 border ${
                result.success
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              <div className="flex items-center gap-2 font-bold">
                {result.success ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span>{result.importedCount} despesas importadas com sucesso!</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>Falha ao importar a planilha.</span>
                  </>
                )}
              </div>

              {result.errors.length > 0 && (
                <ul className="list-disc list-inside text-[11px] opacity-80 max-h-24 overflow-y-auto pt-1">
                  {result.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              Fechar
            </button>
            <button
              type="button"
              disabled={!file || isProcessing}
              onClick={handleProcessImport}
              className="h-10 flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-5 rounded-lg text-xs font-medium transition-all shadow-2xs cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>{isProcessing ? 'Processando...' : 'Processar Importação'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
