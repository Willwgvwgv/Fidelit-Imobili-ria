
import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Sales from './components/Sales';
import Commissions from './components/Commissions';
import Team from './components/Team';
import Reports from './components/Reports';
import Financial from './components/Financial';
import { User, Sale, UserRole, CommissionStatus, SplitRole } from './types';
import { LogIn, Key, Loader2, Database, AlertTriangle, Check } from 'lucide-react';
import { supabaseService } from './services/supabaseService';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeView, setActiveView] = useState('dashboard');
  const [sales, setSales] = useState<Sale[]>([]);
  const [team, setTeam] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDemoData, setIsDemoData] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedMessage, setSeedMessage] = useState<string | null>(null);
  const [dbStatus, setDbStatus] = useState<'connected' | 'error' | 'disconnected'>('disconnected');

  // Supabase Data Fetching
  const loadData = async () => {
    setIsLoading(true);
    try {
      const fetchedUsers = await supabaseService.getUsers();
      const fetchedSales = await supabaseService.getSales();
      
      let finalUsers = fetchedUsers || [];
      const hasRealUsers = finalUsers.length > 0;

      if (!hasRealUsers) {
        setIsDemoData(true);
        setDbStatus('connected');
        finalUsers = [
          {
            id: 'admin-1',
            name: 'Williangyn (Administrador)',
            email: 'williangyn10@gmail.com',
            role: UserRole.ADMIN,
            agencyId: 'agency-1',
            phone: '62999999999'
          },
          {
            id: 'broker-1',
            name: 'Ana Silva (Corretor)',
            email: 'ana.silva@comissone.com.br',
            role: UserRole.BROKER,
            agencyId: 'agency-1',
            phone: '62988888888'
          },
          {
            id: 'broker-2',
            name: 'Carlos Oliveira (Corretor)',
            email: 'carlos.oliveira@comissone.com.br',
            role: UserRole.BROKER,
            agencyId: 'agency-1',
            phone: '62977777777'
          }
        ];
      } else {
        setIsDemoData(false);
        setDbStatus('connected');
      }

      let finalSales = fetchedSales || [];
      if (finalSales.length === 0) {
        finalSales = [
          {
            id: 'sale-1',
            agencyId: 'agency-1',
            saleDate: '2026-05-10',
            propertyAddress: 'Av. T-10, Ed. Metropolitan, Ap 1502',
            buyerName: 'Marcos Souza',
            sellerName: 'Roberto Alves',
            vgv: 850000,
            commissionPercentage: 5,
            totalCommissionValue: 42500,
            invoiceIssued: true,
            invoiceNumber: '00124',
            notes: 'Venda de apartamento de alto padrão no Setor Bueno.',
            status: 'APPROVED' as any,
            splits: [
              {
                id: 'split-1',
                sale_id: 'sale-1',
                brokerId: 'broker-1',
                brokerName: 'Ana Silva',
                percentage: 40,
                calculatedValue: 17000,
                status: CommissionStatus.PAID,
                role: SplitRole.BROKER,
                paymentDate: '2026-05-15',
                paymentMethod: 'PIX',
                forecastDate: '2026-05-15'
              },
              {
                id: 'split-2',
                sale_id: 'sale-1',
                brokerId: 'broker-2',
                brokerName: 'Carlos Oliveira',
                percentage: 40,
                calculatedValue: 17000,
                status: CommissionStatus.PENDING,
                role: SplitRole.BROKER,
                forecastDate: '2026-06-30'
              }
            ]
          },
          {
            id: 'sale-2',
            agencyId: 'agency-1',
            saleDate: '2026-06-01',
            propertyAddress: 'Rua 145, Qd 52, Casa 04, Setor Marista',
            buyerName: 'Julia Pinheiro',
            sellerName: 'Flavio Mendes',
            vgv: 1200000,
            commissionPercentage: 6,
            totalCommissionValue: 72000,
            invoiceIssued: false,
            notes: 'Casa duplex, excelente localização.',
            status: 'APPROVED' as any,
            splits: [
              {
                id: 'split-3',
                sale_id: 'sale-2',
                brokerId: 'broker-1',
                brokerName: 'Ana Silva',
                percentage: 50,
                calculatedValue: 36000,
                status: CommissionStatus.PENDING,
                role: SplitRole.BROKER,
                forecastDate: '2026-07-15'
              }
            ]
          }
        ];
      }
      
      setTeam(finalUsers);
      setSales(finalSales);

      // Check if there is a saved user for persistence (simple simulation)
      const savedUserId = localStorage.getItem('comissone_current_user_id');
      if (savedUserId && !currentUser) {
        const user = finalUsers.find(u => u.id === savedUserId);
        if (user) setCurrentUser(user);
      }
    } catch (error) {
      console.error('Failed to load data from Supabase:', error);
      setDbStatus('error');
      setIsDemoData(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSeedDatabase = async () => {
    setIsSeeding(true);
    setSeedMessage(null);
    try {
      const result = await supabaseService.seedDefaultData();
      if (result.success) {
        setSeedMessage('Sucesso! Dados inseridos com êxito no Supabase.');
        await loadData();
      } else {
        setSeedMessage('Ocorreu um erro ao popular: ' + result.message);
      }
    } catch (e: any) {
      setSeedMessage('Erro na operação: ' + e.message);
    } finally {
      setIsSeeding(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('comissone_current_user_id', currentUser.id);
    } else {
      localStorage.removeItem('comissone_current_user_id');
    }
  }, [currentUser]);

  const handleUpdateCommissionStatus = async (saleId: string, brokerId: string, newStatus: CommissionStatus, receiptData?: string) => {
    // Find the split in state to get its actual DB id
    const sale = sales.find(s => s.id === saleId);
    const split = sale?.splits.find(sp => sp.brokerId === brokerId);

    if (split?.id) {
      const paymentData = newStatus === CommissionStatus.PAID ? {
        date: new Date().toISOString().split('T')[0],
        method: 'PIX',
        receipt: receiptData
      } : undefined;

      const success = await supabaseService.updateSplitStatus(split.id, newStatus, paymentData);
      if (success) {
        // Optimistic update or refetch
        loadData();
      }
    }
  };

  const handleUpdateForecast = async (saleId: string, brokerId: string, newForecastDate: string) => {
    const sale = sales.find(s => s.id === saleId);
    const split = sale?.splits.find(sp => sp.brokerId === brokerId);

    if (split?.id) {
      const success = await supabaseService.updateForecastDate(split.id, newForecastDate);
      if (success) {
        loadData();
      }
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="animate-spin text-blue-600" size={48} />
            <p className="text-slate-500 font-medium">Carregando inteligência de comissões...</p>
          </div>
        </div>
      );
    }

    if (!currentUser) return null;

    switch (activeView) {
      case 'dashboard':
        return <Dashboard sales={sales} team={team} currentUser={currentUser} />;
      case 'sales':
        return <Sales sales={sales} onRefresh={loadData} currentUser={currentUser} team={team} />;
      case 'commissions':
        return (
          <Commissions 
            sales={sales} 
            team={team}
            currentUser={currentUser} 
            onUpdateStatus={handleUpdateCommissionStatus}
            onUpdateForecast={handleUpdateForecast}
          />
        );
      case 'reports':
        return <Reports sales={sales} team={team} currentUser={currentUser} />;
      case 'financial':
      case 'financial-extrato':
      case 'financial-fluxo':
      case 'financial-cartoes':
      case 'financial-contas':
      case 'financial-conciliacao':
      case 'financial-categorias':
        return <Financial currentUser={currentUser} activeView={activeView} />;
      case 'team':
        return <Team team={team} setTeam={setTeam} currentUser={currentUser} />;
      default:
        return <Dashboard sales={sales} team={team} currentUser={currentUser} />;
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center p-3 bg-blue-600 rounded-2xl shadow-xl shadow-blue-200 mb-6">
              <LogIn className="text-white" size={32} />
            </div>
            <h1 className="text-3xl font-extrabold text-slate-800">ComissOne</h1>
            <p className="text-slate-500 mt-2">Gestão de Inteligência em Comissões</p>
          </div>
          
          <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-2xl shadow-slate-200/60">
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Key size={20} className="text-blue-500" /> Escolha seu Perfil
              </h2>
              <div className="grid grid-cols-1 gap-4">
                {team.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => setCurrentUser(user)}
                    className="w-full group flex items-center justify-between p-5 bg-slate-50 border border-slate-100 rounded-2xl hover:border-blue-400 hover:bg-white hover:shadow-lg transition-all text-left"
                  >
                    <div>
                      <p className="font-bold text-slate-800 group-hover:text-blue-600 transition-colors">{user.name}</p>
                      <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">{user.role}</p>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-slate-100 group-hover:bg-blue-600 group-hover:border-blue-600 transition-all">
                      <LogIn size={18} className="text-slate-400 group-hover:text-white transition-colors" />
                    </div>
                  </button>
                ))}
              </div>

              {/* Database Status Alert Box in Login */}
              {isDemoData && dbStatus === 'connected' && (
                <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200/70 text-amber-900 text-xs space-y-3">
                  <div className="flex items-start gap-2.5">
                    <Database size={16} className="text-amber-600 shrink-0 mt-0.5 animate-pulse" />
                    <div>
                      <h4 className="font-bold text-amber-900">Banco de Dados Supabase Pronto!</h4>
                      <p className="text-amber-700/90 mt-1 leading-relaxed">
                        Conectado com êxito à base do comissone, mas as tabelas estão vazias. Ative o painel real populando registros iniciais (usuários, vendas e splits) agora mesmo:
                      </p>
                    </div>
                  </div>
                  
                  <button
                    onClick={handleSeedDatabase}
                    disabled={isSeeding}
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2"
                  >
                    {isSeeding ? (
                      <>
                        <Loader2 className="animate-spin" size={14} />
                        Inserindo registros...
                      </>
                    ) : (
                      <>
                        Popular Supabase com Dados Padrão
                      </>
                    )}
                  </button>
                  
                  {seedMessage && (
                    <p className="text-center font-bold text-[10px] uppercase tracking-wide text-emerald-600 animate-pulse mt-1">
                      {seedMessage}
                    </p>
                  )}
                </div>
              )}

              {!isDemoData && dbStatus === 'connected' && (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200/70 text-emerald-950 text-xs">
                  <div className="flex items-center gap-2.5">
                    <Check size={16} className="text-emerald-600 shrink-0" />
                    <div>
                      <p className="font-bold text-emerald-950">Ambiente de Produção Ativo</p>
                      <p className="text-emerald-700 text-[10px]">Lendo e persistindo dados diretamente de sua conta Supabase.</p>
                    </div>
                  </div>
                </div>
              )}

              {dbStatus === 'error' && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200/70 text-rose-950 text-xs">
                  <div className="flex items-center gap-2.5">
                    <AlertTriangle size={16} className="text-rose-600 shrink-0" />
                    <div>
                      <p className="font-bold text-rose-950">Aviso: Modo de Demonstração Local</p>
                      <p className="text-rose-700 text-[10px]">Verifique suas credenciais em seu arquivo .env ou no painel de controle.</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-slate-100">
                <p className="text-xs text-center text-slate-400">
                  Ambiente de demonstração multi-tenant.<br/>
                  Dados isolados por agência.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Layout 
      currentUser={currentUser} 
      activeView={activeView} 
      setActiveView={setActiveView}
      onLogout={() => {
        setCurrentUser(null);
        setActiveView('dashboard');
      }}
      dbStatus={dbStatus}
      isDemoData={isDemoData}
    >
      {renderContent()}
    </Layout>
  );
};

export default App;
