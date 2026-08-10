import React from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface ConfirmModalProps {
  isOpen?: boolean;
  open?: boolean;
  onClose?: () => void;
  onCancel?: () => void;
  onConfirm: () => void;
  title: string;
  description?: React.ReactNode;
  message?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'info' | 'warning' | 'primary';
  isLoading?: boolean;
  showCancel?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  open,
  onClose,
  onCancel,
  onConfirm,
  title,
  description,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'info',
  isLoading = false,
  showCancel = true,
}) => {
  const isVisible = open !== undefined ? open : (isOpen ?? false);
  const handleClose = onCancel || onClose || (() => {});
  const bodyText = message || description;

  if (!isVisible) return null;

  const getConfirmBtnColor = () => {
    switch (variant) {
      case 'danger':
        return 'bg-rose-600 hover:bg-rose-700 text-white';
      case 'warning':
        return 'bg-amber-600 hover:bg-amber-700 text-white';
      case 'info':
      case 'primary':
      default:
        return 'bg-blue-600 hover:bg-blue-700 text-white';
    }
  };

  const getIcon = () => {
    switch (variant) {
      case 'danger':
        return <AlertCircle className="text-rose-500 shrink-0" size={24} />;
      case 'warning':
        return <AlertCircle className="text-amber-500 shrink-0" size={24} />;
      case 'info':
      case 'primary':
      default:
        return <CheckCircle2 className="text-blue-600 shrink-0" size={24} />;
    }
  };

  return (
    <div className="fixed inset-0 z-[99] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" 
        onClick={handleClose}
      />
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl relative z-10 p-6 overflow-hidden flex flex-col space-y-4 border border-slate-100">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
          {getIcon()}
          <h2 className="text-base font-bold text-slate-900 tracking-wide">
            {title}
          </h2>
        </div>

        <div className="text-xs font-medium text-slate-600 leading-relaxed">
          {bodyText}
        </div>

        <div className="flex gap-3 pt-2">
          {showCancel && (
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="flex-1 py-2.5 text-slate-600 bg-slate-100 hover:bg-slate-200 font-bold text-xs rounded-xl transition-all cursor-pointer"
            >
              {cancelText}
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`flex-1 py-2.5 font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50 ${getConfirmBtnColor()}`}
          >
            {isLoading ? 'Processando...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
