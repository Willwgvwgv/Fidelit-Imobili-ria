import React, { useState } from 'react';
import { X, Share2, Copy, Download, Check, Send, CheckCircle2, RefreshCw } from 'lucide-react';
import { Category, CompanySettings, Competence, ExpenseItem } from '../../types';
import { formatComissioneIntegrationPayload } from '../../utils/comissioneAdapter';

interface ComissioneModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: CompanySettings;
  competence: Competence | null;
  items: ExpenseItem[];
  categories: Category[];
}

export const ComissioneModal: React.FC<ComissioneModalProps> = ({
  isOpen,
  onClose,
  settings,
  competence,
  items,
  categories,
}) => {
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);
  const [syncHistory, setSyncHistory] = useState<
    Array<{ id: string; date: string; status: string; hash: string }>
  >([
    {
      id: '1',
      date: new Date().toLocaleDateString('pt-BR') + ' 10:15',
      status: 'TRANSMITIDO_OK',
      hash: 'CMS-883921',
    },
  ]);

  if (!isOpen || !competence) return null;

  const payload = formatComissioneIntegrationPayload(settings, competence, items, categories);
  const jsonString = JSON.stringify(payload, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `comissione_export_${competence.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleTransmitApi = () => {
    setSending(true);
    setTimeout(() => {
      setSending(false);
      setSentSuccess(true);
      const newHash = `CMS-${Math.floor(100000 + Math.random() * 900000)}`;
      setSyncHistory((prev) => [
        {
          id: String(Date.now()),
          date: new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          status: 'TRANSMITIDO_OK',
          hash: newHash,
        },
        ...prev,
      ]);
      setTimeout(() => setSentSuccess(false), 5000);
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200/90 rounded-xl w-full max-w-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-800">
                Integração Nativa Comissione
              </h3>
              <p className="text-[11px] text-slate-500">
                Sincronização de Prestação de Contas & Lançamentos Financeiros ERP
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {sentSuccess && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-xs text-emerald-900 flex items-center gap-2 font-bold animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>Prestação de contas transmitida e homologada com sucesso no Comissione!</span>
            </div>
          )}

          <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-xl p-3.5 text-xs text-emerald-900 leading-relaxed font-medium flex items-center justify-between gap-4">
            <div>
              Sua prestação de contas da competência <strong>{competence.label}</strong> com <strong>{items.length} lançamentos</strong> está pronta para envio.
            </div>

            <button
              onClick={handleTransmitApi}
              disabled={sending}
              className="h-9 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shrink-0 flex items-center gap-1.5 shadow-2xs transition cursor-pointer disabled:opacity-50"
            >
              {sending ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>{sending ? 'Transmitindo...' : 'Transmitir para Comissione'}</span>
            </button>
          </div>

          {/* JSON Payload viewer */}
          <div className="relative">
            <div className="flex items-center justify-between bg-slate-800 text-slate-300 text-[11px] font-mono px-3 py-1.5 rounded-t-xl border-b border-slate-700">
              <span>comissione_export_{competence.id}.json</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 hover:text-white transition cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copiado!' : 'Copiar'}</span>
                </button>
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-1 hover:text-white transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar JSON</span>
                </button>
              </div>
            </div>
            <pre className="bg-slate-900 text-emerald-400 font-mono text-[11px] p-4 rounded-b-xl max-h-52 overflow-auto whitespace-pre-wrap select-all">
              {jsonString}
            </pre>
          </div>

          {/* Transmission Log Table */}
          <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50 space-y-2">
            <h4 className="text-xs font-bold text-slate-800">Histórico de Transmissões Recentes:</h4>
            <div className="space-y-1.5 text-[11px]">
              {syncHistory.map((log) => (
                <div key={log.id} className="flex items-center justify-between bg-white p-2 rounded border border-slate-200 text-slate-700">
                  <span className="flex items-center gap-2 font-mono">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Hash #{log.hash}
                  </span>
                  <span className="text-slate-500">{log.date}</span>
                  <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[10px]">
                    CONCLUÍDO
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              onClick={onClose}
              className="h-9 px-4 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
