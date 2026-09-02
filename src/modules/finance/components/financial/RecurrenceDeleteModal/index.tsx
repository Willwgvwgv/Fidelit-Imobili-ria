import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trash2 } from 'lucide-react';
import { RecurrenceDeleteModalProps } from './types';

export const RecurrenceDeleteModal: React.FC<RecurrenceDeleteModalProps> = ({
  isOpen,
  onClose,
  option,
  onOptionChange,
  onConfirm,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
            onClick={onClose}
          />
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white rounded-3xl w-full max-w-md shadow-2xl relative z-10 p-8 overflow-hidden flex flex-col"
          >
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-6">
              <Trash2 className="text-rose-500" size={24} />
              <h2 className="text-lg font-black text-slate-900 uppercase tracking-wide">
                Excluir lançamento recorrente
              </h2>
            </div>

            <div className="text-sm font-semibold text-slate-500 mb-6 leading-relaxed">
              Este lançamento faz parte de uma série. O que deseja excluir?
              <span className="block mt-2 text-xs font-bold text-emerald-600">
                Lançamentos já pagos nunca são excluídos em massa, mesmo escolhendo "todos".
              </span>
            </div>

            <div className="space-y-3 mb-8">
              <label className={`flex items-center gap-3 p-4 border rounded-2xl cursor-pointer transition-all ${option === 'single' ? 'border-rose-500 bg-rose-50/30' : 'border-slate-100 bg-slate-50/50 hover:bg-slate-50'}`}>
                <input
                  type="radio"
                  name="recurrenceDeleteOption"
                  value="single"
                  checked={option === 'single'}
                  onChange={() => onOptionChange('single')}
                  className="w-4 h-4 text-rose-600 border-slate-300 focus:ring-rose-500"
                />
                <div>
                  <p className="text-sm font-bold text-slate-800">Somente este lançamento</p>
                  <p className="text-xs text-slate-400 mt-0.5">Exclui apenas o lançamento selecionado.</p>
                </div>
              </label>

              <label className={`flex items-center gap-3 p-4 border rounded-2xl cursor-pointer transition-all ${option === 'following' ? 'border-rose-500 bg-rose-50/30' : 'border-slate-100 bg-slate-50/50 hover:bg-slate-50'}`}>
                <input
                  type="radio"
                  name="recurrenceDeleteOption"
                  value="following"
                  checked={option === 'following'}
                  onChange={() => onOptionChange('following')}
                  className="w-4 h-4 text-rose-600 border-slate-300 focus:ring-rose-500"
                />
                <div>
                  <p className="text-sm font-bold text-slate-800">Este e os próximos</p>
                  <p className="text-xs text-slate-400 mt-0.5">Exclui este lançamento e os futuros ainda não pagos.</p>
                </div>
              </label>

              <label className={`flex items-center gap-3 p-4 border rounded-2xl cursor-pointer transition-all ${option === 'all' ? 'border-rose-500 bg-rose-50/30' : 'border-slate-100 bg-slate-50/50 hover:bg-slate-50'}`}>
                <input
                  type="radio"
                  name="recurrenceDeleteOption"
                  value="all"
                  checked={option === 'all'}
                  onChange={() => onOptionChange('all')}
                  className="w-4 h-4 text-rose-600 border-slate-300 focus:ring-rose-500"
                />
                <div>
                  <p className="text-sm font-bold text-slate-800">Todos os pendentes da série</p>
                  <p className="text-xs text-slate-400 mt-0.5">Exclui todos os lançamentos ainda não pagos deste grupo, passados e futuros.</p>
                </div>
              </label>
            </div>

            <div className="flex gap-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 text-slate-500 bg-slate-50 hover:bg-slate-100 font-bold text-sm rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-black py-3 rounded-xl shadow-lg text-sm transition-all cursor-pointer"
              >
                Excluir
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
