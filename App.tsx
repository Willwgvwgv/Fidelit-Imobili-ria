
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
      setIsDemoData(false);
      setDbStatus('connected');

      let finalSales = fetchedSales || [];
      
      setTeam(finalUsers);
      teamRef.current = finalUsers;
      setSales(finalSales);
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
    if (!supabase) {
      setAuthLoading(false);
      setIsLoading(false);
      return;
    }

    let subscription: { unsubscribe: () => void } | null = null;

    const bootstrap = async () => {
      // 1. Carregar dados primeiro (usuários, vendas)
      await loadData();

      // 2. Só depois verificar a sessão atual
      const { data: { session } } = await supabase.auth.getSession();
      setAuthSession(session);

      if (session?.user?.email) {
        const userProfile = teamRef.current.find(u =>
          u.email?.toLowerCase() === session.user.email?.toLowerCase()
        );
        setCurrentUser(userProfile || null);
      }

      setAuthLoading(false);

      // 3. Ouvir mudanças futuras de auth (login/logout)
      const { data } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
        setAuthSession(newSession);

        if (newSession?.user?.email) {
          // Se teamRef já está populado, usar direto
          let userProfile = teamRef.current.find(u =>
            u.email?.toLowerCase() === newSession.user.email?.toLowerCase()
          );

          // Se não encontrou (primeiro login após OAuth redirect), recarregar dados
          if (!userProfile) {
            await loadData();
            userProfile = teamRef.current.find(u =>
              u.email?.toLowerCase() === newSession.user.email?.toLowerCase()
            );
          }

          setCurrentUser(userProfile || null);
        } else {
          setCurrentUser(null);
        }
      });

      subscription = data.subscription;
    };

    bootstrap();

    return () => {
      subscription?.unsubscribe();
    };
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
      case 'financial-pagamentos':
      case 'financial-centrocusto':
      case 'financial-relatorios':
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
