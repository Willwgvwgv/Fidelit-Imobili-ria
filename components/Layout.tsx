
import React, { useState, useRef, useEffect } from 'react';
import { LogOut, User as UserIcon, Building2, Bell, ChevronDown, ChevronUp, Database, Wifi, WifiOff, Menu, Settings, Key, ShieldCheck } from 'lucide-react';
import { User, UserRole } from '../types';
import { NAV_ITEMS } from '../constants';
import UserSettingsModal from './UserSettingsModal';

interface LayoutProps {
  children: React.ReactNode;
  currentUser: User;
  onUserUpdated?: (updatedUser: User) => void;
  activeView: string;
  setActiveView: (view: string) => void;
  onLogout: () => void;
  dbStatus?: 'connected' | 'error' | 'disconnected';
  isDemoData?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ 
  children, 
  currentUser, 
  onUserUpdated,
  activeView, 
  setActiveView,
  onLogout,
  dbStatus = 'connected',
  isDemoData = false
}) => {
  const [expandedItems, setExpandedItems] = useState<string[]>(['financial']);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  // Settings modal state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'profile' | 'password'>('profile');

  const openSettings = (tab: 'profile' | 'password' = 'profile') => {
    setSettingsTab(tab);
    setIsSettingsOpen(true);
  };

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedItems(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const filteredNavItems = NAV_ITEMS.filter(item => item.roles.includes(currentUser.role));

  return (
    <div className="flex h-screen bg-gray-50" style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Sidebar */}
      <aside className={`${isSidebarCollapsed ? 'w-20' : 'w-64'} bg-white border-r border-gray-200 flex flex-col shrink-0 relative z-20 transition-all duration-300 ease-in-out hidden md:flex h-full`}>
        {/* Logo/Header da sidebar */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-gray-200">
          {!isSidebarCollapsed ? (
            <div>
              <span className="text-base font-bold text-gray-900 select-none">comissOne</span>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider leading-none mt-0.5 select-none">Gestão Imobiliária</p>
            </div>
          ) : (
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-xs mx-auto select-none">C1</div>
          )}
          
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
            className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-all"
            title={isSidebarCollapsed ? "Expandir Menu" : "Recolher Menu"}
          >
            <Menu size={16} />
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
                       if (item.id === 'financial') setActiveView('financial-extrato');
                       else setActiveView(item.id);
                    } else {
                       setActiveView(item.id);
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
                    {!isSidebarCollapsed && <span className="text-sm">{item.label}</span>}
                  </div>
                  {item.subItems && !isSidebarCollapsed && (
                    <div onClick={(e) => toggleExpand(item.id, e)} className="p-1 hover:bg-gray-100 rounded-lg text-gray-400">
                       {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </div>
                  )}
                </button>

                {item.subItems && isExpanded && !isSidebarCollapsed && (
                  <div className="ml-4 pl-4 border-l border-gray-200 space-y-1 mt-1 transition-all">
                    {item.subItems.map((sub: any) => (
                      <button
                        key={sub.id}
                        onClick={() => setActiveView(sub.id)}
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
        <div className="p-3 border-t border-gray-200 bg-gray-50/50">
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => openSettings('profile')}
              className="flex items-center gap-2.5 min-w-0 flex-1 p-1.5 rounded-xl hover:bg-gray-200/60 transition-all text-left group cursor-pointer"
              title="Configurações do Perfil"
            >
              {currentUser.avatarUrl ? (
                <img
                  src={currentUser.avatarUrl}
                  alt={currentUser.name}
                  className="w-8 h-8 rounded-full object-cover border border-indigo-200 shrink-0"
                />
              ) : (
                <div className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                  {currentUser.name.charAt(0).toUpperCase()}
                </div>
              )}
              {!isSidebarCollapsed && (
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-gray-900 truncate leading-tight group-hover:text-indigo-600 transition-colors">
                    {currentUser.name}
                  </p>
                  <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">
                    {currentUser.role === 'ADMIN' ? 'Admin' : 'Corretor'}
                  </p>
                </div>
              )}
            </button>

            {!isSidebarCollapsed && (
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => openSettings('profile')}
                  className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer"
                  title="Configurações do Perfil"
                >
                  <Settings size={15} />
                </button>
                <button 
                  onClick={onLogout} 
                  className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer" 
                  title="Sair da Conta"
                >
                  <LogOut size={15} />
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header principal */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 z-30">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold text-gray-900">
               {(() => {
                 const mainItem = NAV_ITEMS.find((i: any) => i.id === activeView || i.subItems?.some((s: any) => s.id === activeView));
                 const subItem = (mainItem as any)?.subItems?.find((s: any) => s.id === activeView);
                 return subItem ? subItem.label : mainItem?.label || 'Dashboard';
               })()}
            </h2>
            <div className="flex items-center gap-1.5 ml-2">
              {dbStatus === 'connected' && !isDemoData && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200/60 shadow-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Supabase Real
                </span>
              )}
              {dbStatus === 'connected' && isDemoData && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200/60 shadow-xs" title="Conectado ao Supabase, mas exibindo fallbacks de demonstração">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                  Banco Vazio (Demo)
                </span>
              )}
              {dbStatus === 'error' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200/60 shadow-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                  Erro Conexão
                </span>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              className="relative text-gray-400 hover:text-gray-600 transition-colors bg-gray-50 p-2 rounded-xl cursor-pointer hover:bg-gray-100"
              title="Notificações"
            >
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>

            <button
              onClick={() => openSettings('profile')}
              className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 bg-gray-50 rounded-xl transition-all cursor-pointer"
              title="Configurações da Conta"
            >
              <Settings size={18} />
            </button>

            {/* Avatar do Usuário */}
            <button
              onClick={() => openSettings('profile')}
              className="flex items-center gap-2 p-1 rounded-full hover:ring-2 hover:ring-indigo-200 transition-all cursor-pointer ml-1"
              title={`${currentUser.name} - Clique para Editar Perfil`}
            >
              {currentUser.avatarUrl ? (
                <img
                  src={currentUser.avatarUrl}
                  alt={currentUser.name}
                  className="w-8 h-8 rounded-full object-cover border border-indigo-200 shadow-2xs"
                />
              ) : (
                <div className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold text-xs shadow-2xs">
                  {currentUser.name.charAt(0).toUpperCase()}
                </div>
              )}
            </button>
          </div>
        </header>

        {/* Fundo do conteúdo principal */}
        <div className="flex-1 bg-gray-50 overflow-y-auto p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>

      {/* Modal de Configurações do Usuário */}
      <UserSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentUser={currentUser}
        onUserUpdated={(updatedUser) => {
          if (onUserUpdated) onUserUpdated(updatedUser);
        }}
        initialTab={settingsTab}
      />
    </div>
  );
};

export default Layout;
