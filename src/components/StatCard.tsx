import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtext?: string;
  icon: LucideIcon;
  iconBgColor?: string;
  iconTextColor?: string;
  badgeText?: string;
  badgeColor?: string;
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtext,
  icon: Icon,
  iconBgColor = 'bg-blue-50 text-blue-600',
  iconTextColor = 'text-blue-600',
  badgeText,
  badgeColor = 'bg-slate-100 text-slate-600',
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className={`bg-white border border-slate-200/90 rounded-xl p-4.5 shadow-2xs transition-all ${
        onClick ? 'hover:border-slate-300 hover:shadow-xs cursor-pointer' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            {title}
          </p>
          <h3 className="text-2xl font-bold text-slate-900 mt-1.5 tracking-tight font-mono">
            {value}
          </h3>
          {subtext && (
            <p className="text-xs text-slate-500 mt-1 font-normal">
              {subtext}
            </p>
          )}
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${iconBgColor}`}>
          <Icon className={`w-5 h-5 ${iconTextColor}`} />
        </div>
      </div>

      {badgeText && (
        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${badgeColor}`}>
            {badgeText}
          </span>
        </div>
      )}
    </div>
  );
};
