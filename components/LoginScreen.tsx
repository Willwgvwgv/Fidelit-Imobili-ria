import React, { useState } from 'react';
import { supabase } from '../supabase';
import { LogIn, Mail, Lock, Eye, EyeOff, AlertCircle, RefreshCw } from 'lucide-react';

interface LoginScreenProps {
  onLoginSuccess: () => void;
  team: any[];
  onSeedDatabase: () => Promise<void>;
  isDemoData: boolean;
  dbStatus: string;
  isSeeding: boolean;
  seedMessage: string | null;
  authSession?: any;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ 
  onLoginSuccess,
  team,
  onSeedDatabase,
  isDemoData,
  dbStatus,
  isSeeding,
  seedMessage,
  authSession
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [forgotSent, setForgotSent] = useState(false);

  const handleGoogleLogin = async () => {
    if (!supabase) {
      setError('Supabase não configurado. Verifique as variáveis de ambiente.');
      return;
    }
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });
    if (error) {
      setError('Erro ao entrar com Google. Tente novamente.');
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setError('Supabase não configurado. Verifique as variáveis de ambiente.');
      return;
    }
    if (!email || !password) {
      setError('Preencha e-mail e senha.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError('E-mail ou senha incorretos.');
      setLoading(false);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setError('Supabase não configurado. Verifique as variáveis de ambiente.');
      return;
    }
    if (!email || !password) {
      setError('Preencha e-mail e senha.');
      return;
    }
    if (password.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');

    const { data, error } = await supabase.auth.signUp({ 
      email, 
      password,
      options: {
        emailRedirectTo: window.location.origin
      }
    });

    if (error) {
      setError(error.message || 'Erro ao realizar cadastro.');
      setLoading(false);
    } else {
      setSuccess('Cadastro realizado! Se o Supabase exigir confirmação, verifique sua caixa de entrada. Caso contrário, você já pode fazer login abaixo.');
      setMode('login');
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setError('Supabase não configurado. Verifique as variáveis de ambiente.');
      return;
    }
    if (!email) {
      setError('Digite seu e-mail para recuperar a senha.');
      return;
    }
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    });
    if (error) {
      setError('Erro ao enviar e-mail. Verifique o endereço.');
    } else {
      setForgotSent(true);
    }
    setLoading(false);
  };

  const handleSignOut = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    window.location.reload();
  };

  // Se o usuário está logado via Supabase Auth, mas sem perfil ativo
  if (authSession?.user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 font-sans">
        <div className="w-full max-w-md">
          {/* Logo e título */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center p-3 bg-red-600 rounded-2xl shadow-xl shadow-red-200 mb-5">
              <AlertCircle className="text-white animate-pulse" size={28} />
            </div>
            <h1 className="text-2xl font-extrabold text-slate-800">Acesso Restrito</h1>
            <p className="text-slate-500 mt-1 text-sm">Perfil Não Encontrado</p>
          </div>

          <div className="bg-white p-8 rounded-[28px] border border-slate-100 shadow-2xl shadow-slate-200/50 space-y-6">
            <div className="p-4 bg-amber-50 border border-amber-200/60 rounded-2xl text-amber-900 text-sm leading-relaxed space-y-2">
              <p className="font-bold">E-mail autenticado com sucesso:</p>
              <p className="font-mono text-xs bg-white border border-amber-100 p-2 rounded-lg text-slate-700 select-all">
                {authSession.user.email}
              </p>
              <p className="text-xs text-amber-700/90 pt-1">
                Contudo, esse e-mail não está associado a nenhum corretor ou administrador ativo no sistema do ComissOne. Peça ao gestor para cadastrá-lo com este exato e-mail no painel "Equipe".
              </p>
            </div>

            <button
              onClick={handleSignOut}
              className="w-full h-11 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-xl text-sm transition-all flex items-center justify-center gap-2"
            >
              Fazer Logout / Tentar outro E-mail
            </button>

            {/* Database Setup Alert Box in Login for Seed */}
            {isDemoData && dbStatus === 'connected' && (
              <div className="p-4 rounded-xl bg-orange-50 border border-orange-200/70 text-orange-950 text-xs space-y-2.5">
                <p className="font-bold">Dica do Desenvolvedor:</p>
                <p className="leading-relaxed text-[11px] text-orange-850">
                  Como seu banco do Supabase está lendo dados vazios ou não possui o usuário William, configure o e-mail padrão ao clicar no seed para registrar o corretor dono de forma automática:
                </p>
                <button
                  onClick={onSeedDatabase}
                  disabled={isSeeding}
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-3 rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5 text-xs"
                >
                  {isSeeding ? (
                    <>
                      <RefreshCw className="animate-spin" size={12} />
                      Inserindo registros...
                    </>
                  ) : (
                    <>
                      Criar Corretor William (williangyn10@gmail.com)
                    </>
                  )}
                </button>
                {seedMessage && (
                  <p className="text-center font-bold text-[9px] uppercase tracking-wide text-emerald-600 animate-pulse mt-0.5">
                    {seedMessage}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md">
        {/* Logo e título */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-blue-600 rounded-2xl shadow-xl shadow-blue-200 mb-5">
            <LogIn className="text-white" size={28} />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-800">ComissOne</h1>
          <p className="text-slate-500 mt-1 text-sm">Gestão de Inteligência em Comissões</p>
        </div>

        <div className="bg-white p-8 rounded-[28px] border border-slate-100 shadow-2xl shadow-slate-200/50">
          {mode === 'login' ? (
            <div className="space-y-5">
              <h2 className="text-lg font-bold text-slate-800">Acesse sua conta</h2>

              {/* Erro */}
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600 font-medium">
                  <AlertCircle size={16} className="shrink-0" />
                  {error}
                </div>
              )}

              {/* Sucesso */}
              {success && (
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-sm text-emerald-700 font-medium font-sans">
                  {success}
                </div>
              )}

              {/* Google */}
              <button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 h-11 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all disabled:opacity-50"
              >
                <svg width="18" height="18" viewBox="0 0 18 18">
                  <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
                  <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/>
                  <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18z"/>
                  <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z"/>
                </svg>
                Entrar com Google
              </button>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/50 text-[11px] text-amber-800 leading-normal space-y-1">
                <p className="font-bold flex items-center gap-1 text-amber-900">
                  <AlertCircle size={12} className="text-amber-600" /> Nota sobre Erro 403 (Google)
                </p>
                <p className="text-amber-700">
                  Caso o Login do Google mostre "403: Acesso negado", significa que a API do Google está em modo restrito de desenvolvimento. 
                  <strong> Utilize o botão "Cadastrar nova conta" abaixo</strong> para criar seu login com E-mail + Senha imediatamente!
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-slate-100" />
                <span className="text-xs text-slate-400 font-medium">ou</span>
                <div className="flex-1 h-px bg-slate-100" />
              </div>

              {/* E-mail + Senha */}
              <form onSubmit={handleEmailLogin} className="space-y-3">
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-11 pl-10 pr-4 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition-all"
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Sua senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-11 pl-10 pr-10 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition-all font-sans"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => { setMode('forgot'); setError(''); setSuccess(''); }}
                    className="text-xs text-blue-500 hover:text-blue-700 font-medium font-sans"
                  >
                    Esqueceu a senha?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <RefreshCw className="animate-spin" size={16} />
                  ) : 'Acessar Sistema'}
                </button>
              </form>

              <div className="pt-2 text-center text-xs">
                <span className="text-slate-500">Ainda não tem acesso? </span>
                <button
                  onClick={() => { setMode('register'); setError(''); setSuccess(''); }}
                  className="text-blue-600 font-bold hover:underline"
                >
                  Cadastrar nova conta
                </button>
              </div>
            </div>
          ) : mode === 'register' ? (
            /* Modo cadastro */
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Cadastre sua conta</h2>
                <p className="text-sm text-slate-500 mt-1">Crie seu login utilizando e-mail e senha.</p>
              </div>

              {/* Erro */}
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600 font-medium">
                  <AlertCircle size={16} className="shrink-0" />
                  {error}
                </div>
              )}

              <form onSubmit={handleEmailSignUp} className="space-y-3">
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="email"
                    placeholder="E-mail (ex: seu@email.com)"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-11 pl-10 pr-4 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 transition-all font-sans"
                    required
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Defina uma senha (mín. 6 carecteres)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-11 pl-10 pr-10 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 transition-all font-sans"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                <div className="p-3 bg-indigo-50 border border-indigo-150 rounded-xl text-[11px] text-indigo-900 leading-normal">
                  <strong>ℹ️ Dica Pro:</strong> Após criar a conta, se o seu e-mail não estiver cadastrado no sistema (limbo), você poderá usar o botão especial "Criar Corretor William (williangyn10@gmail.com)" para cadastrar o corretor oficial correspondente ao seu e-mail.
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-sm transition-all disabled:opacity-50 flex items-center justify-center font-sans"
                >
                  {loading ? <RefreshCw className="animate-spin" size={16} /> : 'Finalizar Cadastro'}
                </button>
              </form>

              <button
                onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
                className="w-full text-xs text-slate-500 hover:text-slate-700 font-semibold"
              >
                ← Voltar para o login
              </button>
            </div>
          ) : (
            /* Modo recuperação de senha */
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Recuperar senha</h2>
                <p className="text-sm text-slate-500 mt-1">Digite seu e-mail para receber o link de redefinição.</p>
              </div>

              {forgotSent ? (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700 font-medium text-center">
                  ✅ E-mail enviado! Verifique sua caixa de entrada.
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-3">
                  {error && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
                      <AlertCircle size={16} /> {error}
                    </div>
                  )}
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full h-11 pl-10 pr-4 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 transition-all"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-all disabled:opacity-50"
                  >
                    {loading ? 'Enviando...' : 'Enviar link de recuperação'}
                  </button>
                </form>
              )}

              <button
                onClick={() => { setMode('login'); setError(''); setForgotSent(false); }}
                className="w-full text-sm text-slate-500 hover:text-slate-700 font-medium"
              >
                ← Voltar para o login
              </button>
            </div>
          )}

          {/* Database Setup Alert Box in Login for Seed */}
          {isDemoData && dbStatus === 'connected' && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200/70 text-amber-900 text-xs space-y-3 mt-6">
              <div className="flex items-start gap-2 pt-1 border-t border-slate-100/50">
                <div>
                  <h4 className="font-bold text-amber-900">Popular dados de simulação</h4>
                  <p className="text-amber-700/90 mt-1 leading-relaxed text-[11px]">
                    Caso deseje testar a plataforma imediatamente com registros de teste em seu Supabase (incluindo usuários e vendas fakes), clique abaixo:
                  </p>
                </div>
              </div>
              
              <button
                onClick={onSeedDatabase}
                disabled={isSeeding}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 px-3 rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5 text-xs"
              >
                {isSeeding ? (
                  <>
                    <RefreshCw className="animate-spin" size={12} />
                    Inserindo registros...
                  </>
                ) : (
                  <>
                    Popular Supabase com Dados Padrão
                  </>
                )}
              </button>
              
              {seedMessage && (
                <p className="text-center font-bold text-[9px] uppercase tracking-wide text-emerald-600 animate-pulse mt-1">
                  {seedMessage}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
