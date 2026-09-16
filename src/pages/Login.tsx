import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Shield, Zap, Mail, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type AuthMode = 'login' | 'signup' | 'forgot';

const Login = () => {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (authMode === 'forgot') {
      if (!email) {
        setError('Preencha seu e-mail.');
        return;
      }
      setLoading('email');
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        setError(error.message);
      } else {
        setSuccessMsg('Link de recuperação enviado! Verifique seu e-mail.');
      }
      setLoading(null);
      return;
    }

    if (!email || !password) {
      setError('Preencha todos os campos.');
      return;
    }
    setLoading('email');

    if (authMode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) {
        setError(error.message);
      } else {
        setError(null);
        setAuthMode('login');
        alert('Verifique seu e-mail para confirmar a conta.');
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
      }
    }
    setLoading(null);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8 text-center">
        {/* Logo / Title */}
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight font-[Orbitron] text-primary">
            CreatorCore
          </h1>
          <p className="text-muted-foreground text-sm">
            Seu centro de comando criativo
          </p>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-border bg-card p-8 space-y-6 shadow-lg">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">
              {authMode === 'forgot' ? 'Recuperar senha' : 'Bem-vindo'}
            </h2>
            <p className="text-muted-foreground text-sm">
              {authMode === 'forgot'
                ? 'Insira seu e-mail para receber o link de recuperação.'
                : 'Faça login para acessar seu centro de comando. Conteúdos, cronograma, gamificação e mais — tudo em um só lugar.'}
            </p>
          </div>


          {/* Email/Password Form */}
          <form onSubmit={handleEmailAuth} className="space-y-3">
            <Input
              type="email"
              placeholder="Seu e-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12"
              disabled={!!loading}
            />
            {authMode !== 'forgot' && (
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="Sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 pr-12"
                disabled={!!loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            )}
            {authMode === 'login' && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => { setAuthMode('forgot'); setError(null); setSuccessMsg(null); }}
                  className="text-muted-foreground hover:text-primary text-xs transition-colors"
                >
                  Esqueci minha senha
                </button>
              </div>
            )}
            <Button
              type="submit"
              disabled={!!loading}
              className="w-full h-12 text-base gap-3"
            >
              <Mail className="w-5 h-5" />
              {loading === 'email'
                ? 'Processando...'
                : authMode === 'forgot'
                  ? 'Enviar link de recuperação'
                  : authMode === 'login'
                    ? 'Entrar com E-mail'
                    : 'Criar conta'}
            </Button>
          </form>

          {/* Toggle auth mode */}
          <p className="text-muted-foreground text-sm">
            {authMode === 'forgot' ? (
              <button
                type="button"
                onClick={() => { setAuthMode('login'); setError(null); setSuccessMsg(null); }}
                className="text-primary hover:underline font-medium"
              >
                ← Voltar ao login
              </button>
            ) : (
              <>
                {authMode === 'login' ? 'Não tem conta?' : 'Já tem conta?'}{' '}
                <button
                  type="button"
                  onClick={() => { setAuthMode(authMode === 'login' ? 'signup' : 'login'); setError(null); setSuccessMsg(null); }}
                  className="text-primary hover:underline font-medium"
                >
                  {authMode === 'login' ? 'Criar conta' : 'Fazer login'}
                </button>
              </>
            )}
          </p>

          {error && <p className="text-destructive text-sm">{error}</p>}
          {successMsg && <p className="text-primary text-sm">{successMsg}</p>}

          {/* Security info */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <Shield className="w-4 h-4 text-primary shrink-0" />
              <span>Autenticação segura com criptografia de ponta</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <Zap className="w-4 h-4 text-primary shrink-0" />
              <span>Progresso, XP e conquistas salvos automaticamente</span>
            </div>
          </div>
        </div>

        <p className="text-muted-foreground/60 text-xs">
          Ao entrar, você concorda com os termos de uso do CreatorCore.
        </p>
      </div>
    </div>
  );
};

export default Login;
