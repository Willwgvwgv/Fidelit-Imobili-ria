import React, { useState } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import { FinancialAccount } from '../../../../types';
import { parseOFX, parseCSV, ParsedBankTransaction } from '../../../utils/ofxParser';
import { useBankTransactions } from '../../../hooks/useBankTransactions';

interface ImportarExtratoProps {
  accounts: FinancialAccount[];
  agencyId: string;
  onImportDone: () => void;
  showToast?: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const ImportarExtrato: React.FC<ImportarExtratoProps> = ({
  accounts,
  agencyId,
  onImportDone,
  showToast,
}) => {
  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    accounts.length > 0 ? accounts[0].id : ''
  );
  const [selectedBank, setSelectedBank] = useState<string>('Sicoob');
  const [file, setFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [parsedPreview, setParsedPreview] = useState<ParsedBankTransaction[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [fileType, setFileType] = useState<'ofx' | 'csv' | null>(null);

  const { importFromOFX, importFromCSV } = useBankTransactions(agencyId, selectedAccountId);

  const handleFileChange = async (selectedFile: File) => {
    setFile(selectedFile);
    setIsParsing(true);
    setParsedPreview([]);

    const name = selectedFile.name.toLowerCase();
    const isOfx = name.endsWith('.ofx');
    const isCsv = name.endsWith('.csv') || name.endsWith('.txt');
    setFileType(isOfx ? 'ofx' : isCsv ? 'csv' : null);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = (e.target?.result as string) || '';
      setFileContent(content);

      try {
        let transactions: ParsedBankTransaction[] = [];
        if (isOfx) {
          transactions = await parseOFX(content);
        } else {
          transactions = parseCSV(content, selectedAccountId);
        }
        // Attach bank_name to raw_data of each transaction for tracking
        transactions = transactions.map((t) => ({
          ...t,
          raw_data: { ...t.raw_data, bank_name: selectedBank },
        }));
        setParsedPreview(transactions);
      } catch (err) {
        console.error('Error parsing file preview:', err);
        if (showToast) showToast('Erro ao ler arquivo. Verifique o formato OFX/CSV.', 'error');
      } finally {
        setIsParsing(false);
      }
    };
    reader.readAsText(selectedFile, 'ISO-8859-1');
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleConfirmImport = async () => {
    if (!selectedAccountId) {
      if (showToast) showToast('Selecione uma conta bancária.', 'warning');
      return;
    }
    if (!fileContent || !parsedPreview.length) {
      if (showToast) showToast('Nenhuma transação para importar.', 'warning');
      return;
    }

    setIsImporting(true);
    try {
      let result = { inserted: 0, skipped: 0 };
      if (fileType === 'ofx') {
        result = await importFromOFX(fileContent, selectedAccountId, agencyId);
      } else {
        result = await importFromCSV(fileContent, selectedAccountId, agencyId);
      }

      if (showToast) {
        showToast(
          `Importado com sucesso! ${result.inserted} transações novas (${result.skipped} duplicadas/ignoradas).`,
          'success'
        );
      }

      onImportDone();
    } catch (err: any) {
      console.error('Error importing file:', err);
      if (showToast) showToast('Erro ao salvar no banco de dados.', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Upload size={20} className="text-indigo-600" />
            Importar Extrato Bancário
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Selecione o banco, a conta de destino e faça upload do arquivo .OFX ou .CSV de extrato.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Seletor de Banco */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
            1. Banco
          </label>
          <select
            value={selectedBank}
            onChange={(e) => setSelectedBank(e.target.value)}
            className="w-full h-11 px-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 bg-white font-medium"
          >
            <option value="Sicoob">Sicoob</option>
            <option value="Cresol">Cresol</option>
            <option value="Inter">Inter</option>
            <option value="Outro">Outro</option>
          </select>
          <p className="text-[11px] text-slate-500 mt-1">
            {selectedBank === 'Sicoob'
              ? 'Sicoob: aceita arquivos .OFX direto do Internet Banking.'
              : `${selectedBank}: aceita arquivos .OFX ou .CSV.`}
          </p>
        </div>

        {/* Seletor de Conta */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
            2. Conta Bancária de Destino
          </label>
          <select
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className="w-full h-11 px-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 bg-white font-medium"
          >
            {accounts.length === 0 && <option value="">Nenhuma conta cadastrada</option>}
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name} ({acc.type || 'Corrente'})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Dynamic Bank Label */}
      <div className="p-3 bg-indigo-50/60 border border-indigo-100 rounded-xl text-xs text-indigo-900 leading-relaxed flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={16} className="text-indigo-600 shrink-0" />
          <span className="font-bold">Importando extrato do {selectedBank}</span>
        </div>
        <span className="text-[11px] text-indigo-700">OFX / CSV suportados</span>
      </div>

      {/* Dropzone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className="border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/30 rounded-2xl p-8 text-center transition-all cursor-pointer relative"
      >
        <input
          type="file"
          accept=".ofx,.csv,.txt"
          onChange={(e) => e.target.files && e.target.files[0] && handleFileChange(e.target.files[0])}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
        />
        <div className="flex flex-col items-center justify-center gap-2">
          <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center">
            <Upload size={24} />
          </div>
          <p className="text-sm font-bold text-slate-700">
            {file ? file.name : 'Arraste o arquivo OFX ou CSV aqui'}
          </p>
          <p className="text-xs text-slate-500">
            ou clique para selecionar do seu computador (.ofx, .csv)
          </p>
        </div>
      </div>

      {/* Loading state ao ler arquivo */}
      {isParsing && (
        <div className="flex items-center justify-center gap-2 py-6 text-indigo-600 text-sm font-semibold">
          <Loader2 className="animate-spin" size={20} />
          <span>Analisando estrutura do extrato bancário...</span>
        </div>
      )}

      {/* Preview */}
      {!isParsing && parsedPreview.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Prévia das Transações Encontradas ({parsedPreview.length} registros)
            </span>
            <span className="text-xs text-slate-500">Exibindo primeiras 10 transações</span>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                  <th className="p-3">Data</th>
                  <th className="p-3">Descrição</th>
                  <th className="p-3 text-right">Valor (R$)</th>
                  <th className="p-3 text-center">Tipo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {parsedPreview.slice(0, 10).map((item, index) => (
                  <tr key={index} className="hover:bg-slate-50/80">
                    <td className="p-3 font-mono">{item.date}</td>
                    <td className="p-3 font-medium text-slate-800">{item.description}</td>
                    <td className={`p-3 text-right font-bold ${item.type === 'credit' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {item.type === 'credit' ? '+' : '-'} R$ {item.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${item.type === 'credit' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                        {item.type === 'credit' ? 'Crédito' : 'Débito'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end pt-3">
            <button
              onClick={handleConfirmImport}
              disabled={isImporting || !selectedAccountId}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-all shadow-sm flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isImporting ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  <span>Importando para o Supabase...</span>
                </>
              ) : (
                <>
                  <span>Importar {parsedPreview.length} Transações</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
