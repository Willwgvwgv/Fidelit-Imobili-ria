import React, { useEffect } from 'react';
import { AlertTriangle, Trash2, Info, X } from 'lucide-react';

export interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: React.ReactNode;
  onConfirm?: () => void | Promise<void>;
  onCancel: () => void;
  variant?: 'danger' | 'warning' | 'info';
  confirmText?: string;
  cancelText?: string;
  showCancel?: boolean;
  isLoading?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  open,
  title,
  message,
  onConfirm,
  onCancel,
  variant = 'danger',
  confirmText,
  cancelText = 'Cancelar',
  showCancel = true,
  isLoading = false,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          iconBg: 'bg-red-100 text-red-600',
          icon: <Trash2 size={24} />,
          btnConfirm: 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-200',
          defaultConfirmText: 'Excluir',
        };
      case 'warning':
        return {
          iconBg: 'bg-amber-100 text-amber-600',
          icon: <AlertTriangle size={24} />,
          btnConfirm: 'bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-200',
          defaultConfirmText: 'Entendido',
        };
      case 'info':
      default:
        return {
          iconBg: 'bg-indigo-100 text-indigo-600',
          icon: <Info size={24} />,
          btnConfirm: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200',
          defaultConfirmText: 'Confirmar',
        };
    }
  };

  const styles = getVariantStyles();
  const finalConfirmText = confirmText || styles.defaultConfirmText;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm transition-opacity">
      {/* Backdrop click handler */}
      <div 
        className="absolute inset-0" 
        onClick={onCancel}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 z-10 transition-all transform scale-100">
        {/* Close Button */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          title="Fechar"
        >
          <X size={18} />
        </button>

        <div className="flex flex-col items-center text-center">
          {/* Icon Badge */}
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${styles.iconBg}`}>
            {styles.icon}
          </div>

          {/* Title */}
          <h3 className="text-xl font-bold text-slate-800 mb-2">
            {title}
          </h3>

          {/* Message */}
          <div className="text-sm text-slate-600 leading-relaxed mb-6">
            {message}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 w-full">
            {showCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={isLoading}
                className="flex-1 py-3 px-4 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all disabled:opacity-50"
              >
                {cancelText}
              </button>
            )}

            {onConfirm && (
              <button
                type="button"
                onClick={onConfirm}
                disabled={isLoading}
                className={`flex-1 py-3 px-4 text-sm font-semibold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 ${styles.btnConfirm}`}
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  finalConfirmText
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
