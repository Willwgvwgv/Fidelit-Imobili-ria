import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, ArrowRight, X } from 'lucide-react';
import { FinancialAccount, User } from '../../../../types';
import { parseOFX, parseCSV, ParsedBankTransaction } from '../../../utils/ofxParser';
import { useBankTransactions } from '../../../hooks/useBankTransactions';
import { BankLogo, getNormalizedBankCode } from '../../../components/BankLogo';
import { ImportHistoryList } from './ImportHistoryList';

interface ImportarExtratoProps {
  accounts: FinancialAccount[];
  agencyId: string;
  onImportDone: () => void;
  showToast?: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  accountId?: string;
  currentUser?: User;
  onGoToReconcile?: () => void;
}

export const BANK_OPTIONS = [
  { code: 'sicoob', name: 'Sicoob' },
  { code: 'cresol', name: 'Cresol' },
  { code: 'inter', name: 'Inter' },
  { code: 'sicredi', name: 'Sicredi' },
  { code: 'bradesco', name: 'Bradesco' },
  { code: 'itau', name: 'Itaú' },
  { code: 'bb', name: 'Banco do Brasil' },
  { code: 'caixa', name: 'Caixa Econômica' },
  { code: 'santander', name: 'Santander' },
  { code: 'nubank', name: 'Nubank' },
  { code: 'c6', name: 'C6 Bank' },
  { code: 'outros', name: 'Outro' },
];

export const getAccountBankCode = (account: FinancialAccount): string => {
  const code = (account as any).bank_code;
  if (code) return String(code).toLowerCase();
  const nameLower = (account.name || '').toLowerCase();
  if (nameLower.includes('sicoob')) return 'sicoob';
  if (nameLower.includes('cresol')) return 'cresol';
  if (nameLower.includes('inter')) return 'inter';
  if (nameLower.includes('sicredi')) return 'sicredi';
  if (nameLower.includes('bradesco')) return 'bradesco';
  if (nameLower.includes('itaú') || nameLower.includes('itau')) return 'itau';
  if (nameLower.includes('brasil') || nameLower.includes(' bb')) return 'bb';
  if (nameLower.includes('caixa')) return 'caixa';
  if (nameLower.includes('santander')) return 'santander';
  if (nameLower.includes('nubank')) return 'nubank';
  if (nameLower.includes('c6')) return 'c6';
  return 'outros';
};

export const ImportarExtrato: React.FC<ImportarExtratoProps> = ({
  accounts,
  agencyId,
  onImportDone,
  showToast,
  accountId,
  currentUser,
  onGoToReconcile,
}) => {
  // Set default bank and account synchronously from passed accountId or default
  const [selectedBank, setSelectedBank] = useState<string>(() => {
    if (accountId) {
      const targetAcc = accounts.find((a) => a.id === accountId);
      if (targetAcc) return getAccountBankCode(targetAcc);
    }
    if (accounts.length > 0) {
      const def = accounts.find((a) => a.is_default) || accounts[0];
      return getAccountBankCode(def);
    }
    return 'sicoob';
  });

  const [selectedAccountId, setSelectedAccountId] = useState<string>(() => {
    if (accountId) return accountId;
    if (accounts.length > 0) {
      const def = accounts.find((a) => a.is_default) || accounts[0];
      return def.id;
    }
    return '';
  });

  // Sync selectedBank & selectedAccountId if accountId prop or accounts list updates
  useEffect(() => {
    if (accountId) {
      setSelectedAccountId(accountId);
      const targetAcc = accounts.find((a) => a.id === accountId);
      if (targetAcc) {
        setSelectedBank(getAccountBankCode(targetAcc));
      }
    } else if (accounts.length > 0) {
      const currentAccExists = accounts.some((a) => a.id === selectedAccountId);
      if (!currentAccExists) {
        const def = accounts.find((a) => a.is_default) || accounts[0];
        const defBank = getAccountBankCode(def);
        setSelectedBank(defBank);
        setSelectedAccountId(def.id);
      }
    }
  }, [accountId, accounts, selectedAccountId]);

  const [file, setFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [parsedPreview, setParsedPreview] = useState<ParsedBankTransaction[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [fileType, setFileType] = useState<'ofx' | 'csv' | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const { importFromOFX, importFromCSV } = useBankTransactions(agencyId, selectedAccountId);

  // FIX 2: Filter accounts by selected bank
  const filteredAccounts = useMemo(() => {
    return accounts.filter((acc) => getAccountBankCode(acc) === selectedBank);
  }, [accounts, selectedBank]);

  const selectedBankObj = BANK_OPTIONS.find((b) => b.code === selectedBank);
  const selectedBankName = selectedBankObj ? selectedBankObj.name : selectedBank;

  const handleBankChange = (newBankCode: string) => {
    setSelectedBank(newBankCode);

    // Auto-select first account of the newly selected bank
    const matchingAccounts = accounts.filter((acc) => getAccountBankCode(acc) === newBankCode);
    if (matchingAccounts.length > 0) {
      setSelectedAccountId(matchingAccounts[0].id);
    } else {
      setSelectedAccountId('');
    }

    // Reset file and preview when bank changes
    setFile(null);
    setFileContent('');
    setParsedPreview([]);
  };

  // FIX 3: Beforeunload warning during import
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isImporting) {
        e.preventDefault();
        e.returnValue = 'Tem uma importação em andamento. Tem certeza que deseja sair?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isImporting]);

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
          raw_data: { ...t.raw_data, bank_name: selectedBankName },
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

  const handleCancelImport = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsImporting(false);
    setFile(null);
    setFileContent('');
    setParsedPreview([]);
    if (showToast) showToast('Importação cancelada', 'info');
  };

  const handleConfirmImport = async () => {
    if (!selectedAccountId) {
      if (showToast) showToast('Selecione uma conta bancária de destino.', 'warning');
      return;
    }

    // FIX 2d: Validate that selected account belongs to selected bank
    const selectedAcc = accounts.find((a) => a.id === selectedAccountId);
    if (selectedAcc) {
      const accBankCode = getAccountBankCode(selectedAcc);
      if (accBankCode !== selectedBank) {
        if (showToast) {
          showToast(`A conta selecionada não pertence ao banco ${selectedBankName}.`, 'error');
        }
        return;
      }
    }

    if (!fileContent || !parsedPreview.length) {
      if (showToast) showToast('Nenhuma transação para importar.', 'warning');
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsImporting(true);

    try {
      let result = { inserted: 0, skipped: 0 };
      if (fileType === 'ofx') {
        result = await importFromOFX(fileContent, selectedAccountId, agencyId, {
          signal: controller.signal,
        });
      } else {
        result = await importFromCSV(fileContent, selectedAccountId, agencyId, {
          signal: controller.signal,
        });
      }

      if (controller.signal.aborted) {
        if (showToast) showToast('Importação cancelada', 'info');
        return;
      }

      if (result.inserted > 0) {
        if (showToast) {
          showToast(
            `Importado com sucesso! ${result.inserted} transações novas (${result.skipped} duplicadas/ignoradas).`,
            'success'
          );
        }
        onImportDone();
      } else if (result.skipped > 0) {
        if (showToast) {
          showToast(
            `Nenhuma transação nova importada. Todas as ${result.skipped} transações do arquivo já foram importadas anteriormente.`,
            'warning'
          );
        }
        onImportDone();
      } else {
        if (showToast) showToast('Nenhuma transação válida encontrada no arquivo.', 'warning');
      }
    } catch (err: any) {
      if (controller.signal.aborted || err.name === 'AbortError') {
        if (showToast) showToast('Importação cancelada', 'info');
      } else {
        console.error('Error importing file:', err);
        const errMsg = err?.message || String(err) || 'Erro desconhecido ao salvar';
        if (showToast) showToast(`Erro ao salvar no banco de dados: ${errMsg}`, 'error');
      }
    } finally {
      setIsImporting(false);
      abortControllerRef.current = null;
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

      {!accountId ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Seletor de Banco */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
              1. Banco
            </label>
            <select
              value={selectedBank}
              onChange={(e) => handleBankChange(e.target.value)}
              className="w-full h-11 px-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 bg-white font-medium"
            >
              {BANK_OPTIONS.map((b) => (
                <option key={b.code} value={b.code}>
                  {b.name}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500 mt-1">
              {selectedBank === 'sicoob'
                ? 'Sicoob: aceita arquivos .OFX direto do Internet Banking.'
                : `${selectedBankName}: aceita arquivos .OFX ou .CSV.`}
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
              {filteredAccounts.length === 0 && (
                <option value="">Nenhuma conta cadastrada para {selectedBankName}</option>
              )}
              {filteredAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({acc.type || 'Corrente'})
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : (
        <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center p-1.5 shrink-0 shadow-xs">
              <BankLogo code={getNormalizedBankCode(selectedBank)} size={28} />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Conta de Destino</span>
              <h4 className="text-sm font-bold text-slate-800">
                {accounts.find((a) => a.id === accountId)?.name || 'Conta Selecionada'}
              </h4>
            </div>
          </div>
          <span className="px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full text-xs font-bold uppercase tracking-wider">
            {selectedBankName}
          </span>
        </div>
      )}

      {/* Dynamic Bank Label */}
      <div className="p-3 bg-indigo-50/60 border border-indigo-100 rounded-xl text-xs text-indigo-900 leading-relaxed flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={16} className="text-indigo-600 shrink-0" />
          <span className="font-bold">Importando extrato do {selectedBankName}</span>
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
            {isImporting ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-indigo-600 text-xs font-semibold">
                  <Loader2 className="animate-spin" size={18} />
                  <span>Importando para o Supabase...</span>
                </div>
                <button
                  type="button"
                  onClick={handleCancelImport}
                  className="px-5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-sm rounded-xl border border-rose-200 transition-all shadow-xs flex items-center gap-2 cursor-pointer"
                >
                  <X size={16} />
                  <span>Cancelar Importação</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={!selectedAccountId || filteredAccounts.length === 0}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-all shadow-sm flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <span>Importar {parsedPreview.length} Transações</span>
                <ArrowRight size={16} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Histórico de Importações da Conta */}
      {selectedAccountId && (
        <div className="pt-2">
          <ImportHistoryList
            accountId={selectedAccountId}
            agencyId={agencyId}
            currentUserId={currentUser?.id}
            onGoToReconcile={onGoToReconcile}
            onBatchDeleted={onImportDone}
            showToast={showToast}
          />
        </div>
      )}
    </div>
  );
};

