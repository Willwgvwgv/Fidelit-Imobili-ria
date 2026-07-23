import React from 'react';
import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbProps {
  currentTab: string;
  activeCompetenceLabel?: string;
  onNavigateTab: (tab: string) => void;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({
  currentTab,
  activeCompetenceLabel,
  onNavigateTab,
}) => {
  const getBreadcrumbs = () => {
    switch (currentTab) {
      case 'dashboard':
        return [{ label: 'Dashboard', tab: 'dashboard' }];
      case 'competence_detail':
        return [
          { label: 'Competências', tab: 'competencies' },
          { label: activeCompetenceLabel || 'Competência Atual', tab: 'competence_detail' },
        ];
      case 'competencies':
        return [{ label: 'Histórico de Competências', tab: 'competencies' }];
      case 'fixed_expenses':
        return [{ label: 'Despesas Fixas (Matriz)', tab: 'fixed_expenses' }];
      case 'categories':
        return [{ label: 'Categorias de Custo', tab: 'categories' }];
      case 'reports':
        return [{ label: 'Relatórios & Gráficos', tab: 'reports' }];
      case 'settings':
        return [{ label: 'Configurações', tab: 'settings' }];
      default:
        return [{ label: 'Início', tab: 'dashboard' }];
    }
  };

  const crumbs = getBreadcrumbs();

  return (
    <nav className="flex items-center gap-1.5 text-xs text-slate-500 mb-4 select-none">
      <button
        onClick={() => onNavigateTab('dashboard')}
        className="flex items-center gap-1 hover:text-blue-600 transition cursor-pointer font-medium"
      >
        <Home className="w-3.5 h-3.5 text-slate-400" />
        <span>Início</span>
      </button>

      {crumbs.map((crumb, idx) => (
        <React.Fragment key={crumb.tab + idx}>
          <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
          {idx === crumbs.length - 1 ? (
            <span className="font-semibold text-slate-800">{crumb.label}</span>
          ) : (
            <button
              onClick={() => onNavigateTab(crumb.tab)}
              className="hover:text-blue-600 transition cursor-pointer font-medium"
            >
              {crumb.label}
            </button>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};
