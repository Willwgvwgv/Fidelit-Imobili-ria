import React, { useState } from 'react';
import { X, Paperclip, Upload, Trash2, Eye, FileText, Download } from 'lucide-react';
import { ExpenseItem, ReceiptAttachment } from '../../types';

interface ReceiptsModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: ExpenseItem | null;
  onSaveReceipts: (itemId: string, receipts: ReceiptAttachment[]) => void;
}

export const ReceiptsModal: React.FC<ReceiptsModalProps> = ({
  isOpen,
  onClose,
  item,
  onSaveReceipts,
}) => {
  const [selectedPreview, setSelectedPreview] = useState<ReceiptAttachment | null>(null);

  if (!isOpen || !item) return null;

  const currentReceipts = item.receipts || [];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;

    const filesArray: File[] = Array.from(e.target.files);
    filesArray.forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        const newAttachment: ReceiptAttachment = {
          id: `rec-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          dataBase64: base64,
          uploadedAt: new Date().toISOString(),
        };

        const updated = [...currentReceipts, newAttachment];
        onSaveReceipts(item.id, updated);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleDeleteReceipt = (receiptId: string) => {
    const updated = currentReceipts.filter((r) => r.id !== receiptId);
    onSaveReceipts(item.id, updated);
    if (selectedPreview?.id === receiptId) {
      setSelectedPreview(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200/90 rounded-xl w-full max-w-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Paperclip className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="font-bold text-base text-slate-800">
                Comprovantes e Anexos
              </h3>
              <p className="text-[11px] text-slate-500">{item.description}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Upload Drop Area */}
          <label className="border-2 border-dashed border-slate-200 hover:border-blue-500 rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition bg-slate-50/50">
            <Upload className="w-6 h-6 text-blue-600 mb-1" />
            <span className="text-xs font-bold text-slate-700">
              Anexar comprovante / Nota Fiscal (PDF ou Imagem)
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5">
              Salvo localmente em Base64
            </span>
            <input
              type="file"
              multiple
              accept="image/*, application/pdf"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          {/* List of Attachments */}
          {currentReceipts.length === 0 ? (
            <div className="p-6 text-center text-slate-400 text-xs bg-slate-50 rounded-xl">
              Nenhum comprovante anexado a esta despesa.
            </div>
          ) : (
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-700">
                Anexos salvos ({currentReceipts.length}):
              </span>
              <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                {currentReceipts.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                      <span className="truncate font-medium text-slate-800">
                        {r.fileName}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        ({Math.round(r.fileSize / 1024)} KB)
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => setSelectedPreview(r)}
                        className="p-1 rounded-md text-blue-600 hover:bg-blue-100 transition cursor-pointer"
                        title="Visualizar"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <a
                        href={r.dataBase64}
                        download={r.fileName}
                        className="p-1 rounded-md text-emerald-600 hover:bg-emerald-100 transition cursor-pointer"
                        title="Baixar arquivo"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                      <button
                        onClick={() => handleDeleteReceipt(r.id)}
                        className="p-1 rounded-md text-rose-600 hover:bg-rose-100 transition cursor-pointer"
                        title="Excluir anexo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preview Modal Box */}
          {selectedPreview && (
            <div className="p-3 bg-slate-800 rounded-xl text-white space-y-2">
              <div className="flex items-center justify-between text-xs border-b border-slate-700 pb-2">
                <span className="font-bold truncate">{selectedPreview.fileName}</span>
                <button
                  onClick={() => setSelectedPreview(null)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="max-h-60 overflow-auto flex items-center justify-center p-2">
                {selectedPreview.fileType.startsWith('image/') ? (
                  <img
                    src={selectedPreview.dataBase64}
                    alt={selectedPreview.fileName}
                    className="max-h-56 rounded-lg object-contain"
                  />
                ) : (
                  <iframe
                    src={selectedPreview.dataBase64}
                    className="w-full h-52 rounded-lg bg-white"
                    title="PDF Preview"
                  />
                )}
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
            <button
              onClick={onClose}
              className="h-10 flex items-center bg-blue-600 hover:bg-blue-700 text-white px-5 rounded-lg text-xs font-medium transition-all shadow-2xs cursor-pointer"
            >
              <span>Concluído</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
