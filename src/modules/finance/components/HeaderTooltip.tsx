import React from 'react';
import { HelpCircle } from 'lucide-react';

interface HeaderTooltipProps {
  text: string;
}

export const HeaderTooltip: React.FC<HeaderTooltipProps> = ({ text }) => {
  return (
    <div className="group relative inline-flex items-center ml-1.5 cursor-help">
      <HelpCircle size={14} className="text-slate-400 hover:text-indigo-600 transition-colors" />
      <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-72 bg-slate-900 text-white text-xs font-normal p-3 rounded-xl shadow-xl z-50 pointer-events-none border border-slate-800 leading-relaxed">
        {text}
        <div className="absolute top-full left-3 border-4 border-transparent border-t-slate-900" />
      </div>
    </div>
  );
};
