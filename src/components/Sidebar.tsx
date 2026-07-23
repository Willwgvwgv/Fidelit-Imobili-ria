import React from 'react';
import {
  LayoutDashboard,
  CalendarDays,
  Repeat,
  FolderTree,
  BarChart3,
  Settings,
  Building2,
  Share2,
  FileSpreadsheet,
  Moon,
  Sun,
  PlusCircle,
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  activeCompetenceLabel: string;
  onNewCompetence: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  activeCompetenceLabel,
  onNewCompetence,
  darkMode,
  onToggleDarkMode,
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'competence_detail', label: 'Competência Atual', icon: CalendarDays, badge: activeCompetenceLabel },
    { id: 'competencies', label: 'Competências', icon: FileSpreadsheet },
    { id: 'fixed_expenses', label: 'Despesas Fixas', icon: Repeat },
    { id: 'categories', label: 'Categorias', icon: FolderTree },
    { id: 'reports', label: 'Relatórios', icon: BarChart3 },
    { id: 'settings', label: 'Configurações', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-white text-slate-700 flex flex-col h-screen border-r border-slate-200/90 shrink-0 select-none shadow-2xs">
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-xs">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <h1 className="font-bold text-slate-800 text-xs tracking-tight leading-none">Prestação de Contas</h1>
            <p className="text-[10px] text-slate-500 mt-1 font-medium">Software Financeiro ERP</p>
          </div>
        </div>
      </div>

      {/* Quick Competence Action (40px height) */}
      <div className="px-3 py-3">
        <button
          onClick={onNewCompetence}
          className="w-full h-10 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs px-3 rounded-lg transition-all shadow-2xs cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Nova Competência</span>
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-1 space-y-1 overflow-y-auto">
        <div className="px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5 mt-1">
          Menu Principal
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full h-9 flex items-center justify-between px-3 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                isActive
                  ? 'bg-blue-50 text-blue-600 font-semibold border-r-2 border-blue-600 rounded-r-none'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  isActive ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer / Theme & Comissione Integration */}
      <div className="p-3 border-t border-slate-100 space-y-2 bg-slate-50/50">
        <button
          onClick={() => onSelectTab('comissione')}
          className="w-full h-9 flex items-center gap-2 px-3 rounded-lg text-xs bg-white hover:bg-slate-50 text-slate-700 transition border border-slate-200 cursor-pointer shadow-2xs"
        >
          <Share2 className="w-3.5 h-3.5 text-emerald-600" />
          <span className="font-medium text-slate-700">Integrar com Comissione</span>
        </button>

        <div className="flex items-center justify-between text-xs text-slate-500 pt-1 px-1">
          <span className="text-[11px] font-medium">Modo Escuro</span>
          <button
            onClick={onToggleDarkMode}
            className="p-1 rounded-md hover:bg-slate-200/60 text-slate-500 transition cursor-pointer"
            title="Alternar tema"
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </aside>
  );
};

