
import React, { useState, useEffect, useRef } from 'react';
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
import LoginScreen from './components/LoginScreen';
import { supabase } from './supabase';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authSession, setAuthSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeView, setActiveView] = useState('dashboard');
  const [sales, setSales] = useState<Sale[]>([]);
  const [team, setTeam] = useState<User[]>([]);
  const teamRef = useRef<User[]>([]);
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
      teamRef.current = finalUsers;
      setSales(finalSales);

      // Sincronizar currentUser baseado na sessão de Auth atual se existir
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        setAuthSession(session);
        if (session?.user?.email) {
          const userProfile = finalUsers.find(u => 
            u.email?.toLowerCase() === session.user.email?.toLowerCase()
          );
          if (userProfile) {
            setCurrentUser(userProfile);
          } else {
            setCurrentUser(null);
          }
          setAuthLoading(false);
        }
      }
    } catch (error) {
      console.error('Failed to load data from Supabase:', error);
      setDbStatus('error');
      setIsDemoData(true);
      setAuthLoading(false);
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
    if (!supabase) {
      setAuthLoading(false);
      return;
    }

    // Verificar sessão inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthSession(session);
      setAuthLoading(false);
      if (session?.user?.email) {
        const userProfile = teamRef.current.find(u => 
          u.email?.toLowerCase() === session.user.email?.toLowerCase()
        );
        if (userProfile) {
          setCurrentUser(userProfile);
        } else {
          setCurrentUser(null);
        }
      }
    });

    // Ouvir mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthSession(session);
      if (session?.user?.email) {
        const userProfile = teamRef.current.find(u => 
          u.email?.toLowerCase() === session.user.email?.toLowerCase()
        );
        if (userProfile) {
          setCurrentUser(userProfile);
        } else {
          setCurrentUser(null);
        }
      } else {
        setCurrentUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

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

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-3">
          <Loader2 className="animate-spin text-blue-600 mx-auto" size={40} />
          <p className="text-sm text-slate-500 font-medium">Verificando credenciais...</p>
        </div>
      </div>
    );
  }

  if (!authSession || !currentUser) {
    return (
      <LoginScreen 
        onLoginSuccess={() => {}} 
        team={team}
        onSeedDatabase={handleSeedDatabase}
        isDemoData={isDemoData}
        dbStatus={dbStatus}
        isSeeding={isSeeding}
        seedMessage={seedMessage}
        authSession={authSession}
      />
    );
  }

  return (
    <Layout 
      currentUser={currentUser} 
      activeView={activeView} 
      setActiveView={setActiveView}
      onLogout={async () => {
        if (supabase) {
          await supabase.auth.signOut();
        }
        setCurrentUser(null);
        setAuthSession(null);
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
