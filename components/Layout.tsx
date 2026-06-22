
import React, { useState } from 'react';
import { LogOut, User as UserIcon, Building2, Bell, ChevronDown, ChevronUp, Database, Wifi, WifiOff } from 'lucide-react';
import { User, UserRole } from '../types';
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

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedItems(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const filteredNavItems = NAV_ITEMS.filter(item => item.roles.includes(currentUser.role));

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-72 bg-[#1a202c] flex flex-col hidden md:flex h-full shadow-2xl">
        <div className="p-6 flex items-center gap-3 border-b border-slate-700/30">
          <div>
            <h1 className="font-black text-white text-2xl tracking-tighter italic">comissOne</h1>
            <p className="text-[10px] text-slate-400 font-black tracking-[0.2em] uppercase leading-none mt-1">Gestão Imobiliária</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
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
                  className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl transition-all duration-200 border-2 ${
                    isActive 
                      ? 'bg-blue-600 border-blue-600 text-white font-black shadow-lg shadow-blue-900/20' 
                      : 'text-slate-400 border-transparent hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {item.icon}
                    <span className="text-sm font-bold">{item.label}</span>
                  </div>
                  {item.subItems && (
                    <div onClick={(e) => toggleExpand(item.id, e)} className="p-1 hover:bg-white/10 rounded-lg">
                       {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  )}
                </button>

                {item.subItems && isExpanded && (
                  <div className="ml-4 pl-4 border-l border-slate-700/50 space-y-1 mt-1 transition-all">
                    {item.subItems.map((sub: any) => (
                      <button
                        key={sub.id}
                        onClick={() => setActiveView(sub.id)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 ${
                          activeView === sub.id 
                            ? 'bg-blue-600 text-white font-bold shadow-md' 
                            : 'text-slate-500 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        {sub.icon}
                        <span className="text-xs font-bold uppercase tracking-wider">{sub.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-700/30">
          <button 
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:text-white hover:bg-red-600 rounded-xl transition-all font-bold"
          >
            <LogOut size={20} />
            <span className="text-sm font-bold">Sair</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-10 z-10">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-black text-slate-800 flex items-center gap-3">
               {(() => {
                 const mainItem = NAV_ITEMS.find((i: any) => i.id === activeView || i.subItems?.some((s: any) => s.id === activeView));
                 const subItem = (mainItem as any)?.subItems?.find((s: any) => s.id === activeView);
                 return subItem ? subItem.label : mainItem?.label || 'Dashboard';
               })()}
            </h2>
            <div className="flex items-center gap-1.5 ml-2">
              {dbStatus === 'connected' && !isDemoData && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200/60 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse animate-duration-1000"></span>
                  Supabase Real
                </span>
              )}
              {dbStatus === 'connected' && isDemoData && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200/60 shadow-sm" title="Conectado ao Supabase, mas exibindo fallbacks de demonstração pois o banco de dados não tem dados cadastrados">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                  Banco Vazio (Demo)
                </span>
              )}
              {dbStatus === 'error' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200/60 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                  Erro Conexão
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-8">
            <button className="relative text-slate-400 hover:text-slate-600 transition-colors bg-slate-50 p-2 rounded-xl">
              <Bell size={22} />
              <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-black text-slate-800">{currentUser.name}</p>
                <p className="text-xs text-slate-400 font-medium">{currentUser.email}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-700 font-black text-lg shadow-sm border border-blue-200">
                {currentUser.name.charAt(0)}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-10 bg-slate-50/30">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
