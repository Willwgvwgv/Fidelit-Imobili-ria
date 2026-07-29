import React, { useState } from 'react';
import { LogOut, Bell, ChevronDown, ChevronUp, Menu, X } from 'lucide-react';
import { User } from '../types';
import { NAV_ITEMS } from '../constants';

interface LayoutProps {
  children: React.ReactNode;
  currentUser: User;
  activeView: string;
  setActiveView: (view: string) => void;
  onLogout: () => void;
  dbStatus?: 'connected' | 'error' | 'disconnected';
  isDemoData?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ 
  children, 
  currentUser, 
  activeView, 
  setActiveView,
  onLogout,
  dbStatus = 'connected',
  isDemoData = false
}) => {
  const [expandedItems, setExpandedItems] = useState<string[]>(['financial']);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedItems(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // No drawer mobile o menu nunca aparece recolhido
  const collapsed = isSidebarCollapsed && !isMobileOpen;

  const filteredNavItems = NAV_ITEMS.filter(item => item.roles.includes(currentUser.role));

  // Navega e fecha o drawer no mobile
  const handleNavigate = (view: string) => {
    setActiveView(view);
    setIsMobileOpen(false);
  };

  const sidebarContent = (
    <>
      {/* Logo/Header da sidebar */}
      <div className="h-16 flex items-center justify-between px-5 border-b border-gray-200 shrink-0">
        {!collapsed ? (
          <div>
            <span className="text-base font-bold text-gray-900 select-none">comissOne</span>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider leading-none mt-0.5 select-none">Gestão Imobiliária</p>
          </div>
        ) : (
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-xs mx-auto select-none">C1</div>
        )}

        {/* Botão recolher (desktop) */}
        <button 
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
          className="hidden md:block p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-all"
          title={isSidebarCollapsed ? "Expandir Menu" : "Recolher Menu"}
        >
          <Menu size={16} />
        </button>

        {/* Botão fechar (mobile) */}
        <button
          onClick={() => setIsMobileOpen(false)}
          className="md:hidden p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-all"
          title="Fechar menu"
          aria-label="Fechar menu"
        >
          <X size={18} />
        </button>
      </div>

      <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto custom-scrollbar select-none">
        {filteredNavItems.map((item: any) => {
          const isExpanded = expandedItems.includes(item.id);
          const isActive = activeView === item.id || (item.subItems?.some((sub: any) => sub.id === activeView));

          return (
            <div key={item.id} className="space-y-1">
              <button
                onClick={() => {
                  if (item.subItems) {
                     setExpandedItems(prev => prev.includes(item.id) ? prev.filter(i => i !== item.id) : [...prev, item.id]);
                     if (item.id === 'financial') handleNavigate('financial-extrato');
                     else handleNavigate(item.id);
                  } else {
                     handleNavigate(item.id);
                  }
                }}
                className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg text-sm transition-all duration-200 border-l-4 ${
                  isActive 
                    ? 'text-indigo-700 bg-indigo-50 border-indigo-600 font-semibold' 
                    : 'text-gray-600 border-transparent hover:bg-gray-50 hover:text-gray-900 font-medium'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={isActive ? 'text-indigo-600' : 'text-gray-400 group-hover:text-gray-600'}>
                    {item.icon}
                  </span>
                  {!collapsed && <span className="text-sm">{item.label}</span>}
                </div>
                {item.subItems && !collapsed && (
                  <div onClick={(e) => toggleExpand(item.id, e)} className="p-1 hover:bg-gray-100 rounded-lg text-gray-400">
                     {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </div>
                )}
              </button>

              {item.subItems && isExpanded && !collapsed && (
                <div className="ml-4 pl-4 border-l border-gray-200 space-y-1 mt-1 transition-all">
                  {item.subItems.map((sub: any) => (
                    <button
                      key={sub.id}
                      onClick={() => handleNavigate(sub.id)}
                      className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-xs font-semibold transition-all border-l-4 ${
                        activeView === sub.id 
                          ? 'text-indigo-600 bg-indigo-50/50 border-indigo-500 font-bold' 
                          : 'text-gray-500 border-transparent hover:bg-gray-50 hover:text-gray-800'
                      }`}
                    >
                      <span className={activeView === sub.id ? 'text-indigo-500' : 'text-gray-400'}>
                        {sub.icon}
                      </span>
                      <span className="uppercase tracking-wider text-[10px]">{sub.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer da sidebar (perfil do usuário) */}
      <div className="p-4 border-t border-gray-200 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold text-sm shrink-0">
            {currentUser.name.charAt(0)}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900 truncate leading-tight">{currentUser.name}</p>
              <p className="text-xs text-gray-500 uppercase font-medium">{currentUser.role}</p>
            </div>
          )}
          {!collapsed && (
            <button 
              onClick={onLogout} 
              className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-all shrink-0" 
              title="Sair"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-gray-50" style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Sidebar (desktop) */}
      <aside className={`${isSidebarCollapsed ? 'w-20' : 'w-64'} bg-white border-r border-gray-200 flex-col shrink-0 relative z-20 transition-all duration-300 ease-in-out hidden md:flex h-full`}>
        {sidebarContent}
      </aside>

      {/* Overlay do drawer (mobile) */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-gray-900/50 z-40 md:hidden"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Drawer (mobile) */}
      <aside
        className={`fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-white border-r border-gray-200 flex flex-col z-50 md:hidden transform transition-transform duration-300 ease-in-out ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-hidden={!isMobileOpen}
      >
        {sidebarContent}
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header principal */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-8 z-30">
          <div className="flex items-center gap-3 md:gap-4 min-w-0">
            {/* Botão hambúrguer (mobile) */}
            <button
              onClick={() => setIsMobileOpen(true)}
              className="md:hidden p-2 -ml-1 text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-all shrink-0"
              title="Abrir menu"
              aria-label="Abrir menu"
            >
              <Menu size={20} />
            </button>

            <h2 className="text-base md:text-lg font-bold text-gray-900 truncate">
               {(() => {
                 const mainItem = NAV_ITEMS.find((i: any) => i.id === activeView || i.subItems?.some((s: any) => s.id === activeView));
                 const subItem = (mainItem as any)?.subItems?.find((s: any) => s.id === activeView);
                 return subItem ? subItem.label : mainItem?.label || 'Dashboard';
               })()}
            </h2>
            <div className="hidden sm:flex items-center gap-1.5 ml-2">
              {dbStatus === 'connected' && !isDemoData && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200/60 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Supabase Real
                </span>
              )}
              {dbStatus === 'connected' && isDemoData && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200/60 shadow-sm" title="Conectado ao Supabase, mas exibindo fallbacks de demonstração">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                  Banco Vazio (Demo)
                </span>
              )}
              {dbStatus === 'error' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200/60 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                  Erro Conexão
                </span>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-3 md:gap-6 shrink-0">
            <button className="relative text-gray-400 hover:text-gray-600 transition-colors bg-gray-50 p-2 rounded-lg">
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
            
            <div className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-50 transition-all">
              <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">
                {currentUser.name.charAt(0)}
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-sm font-semibold text-gray-900 leading-none">{currentUser.name}</p>
                <p className="text-[11px] text-gray-500 mt-0.5 leading-none">{currentUser.email}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Fundo do conteúdo principal */}
        <div className="flex-1 bg-gray-50 overflow-y-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Layout;
