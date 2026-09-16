import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isReady: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  isReady: false,
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    const applySession = (nextSession: Session | null) => {
      if (!mounted) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
    };

    const markReady = () => {
      if (!mounted) return;
      setLoading(false);
      setIsReady(true);
    };

    const ensureLocalAccount = async () => {
      // Auto-login local: cria/usa uma conta determinística salva em localStorage,
      // assim o usuário entra direto no perfil mestre sem precisar de login.
      const STORAGE_KEY = 'progcontrol-local-account';
      let creds = localStorage.getItem(STORAGE_KEY);
      let parsed: { email: string; password: string } | null = creds ? JSON.parse(creds) : null;

      if (!parsed) {
        const rand = crypto.randomUUID();
        parsed = {
          email: `local-${rand}@progcontrol.local`,
          password: `pw-${rand}-${Date.now()}`,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      }

      // tenta login; se falhar, faz signup e tenta de novo
      let { error: signInError } = await supabase.auth.signInWithPassword(parsed);
      if (signInError) {
        const { error: signUpError } = await supabase.auth.signUp({
          email: parsed.email,
          password: parsed.password,
        });
        if (!signUpError) {
          await supabase.auth.signInWithPassword(parsed);
        }
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      applySession(nextSession);
    });

    (async () => {
      // Marca como pronto rapidamente para não travar a UI; auth roda em background
      markReady();
      try {
        const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T> =>
          Promise.race([
            p,
            new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)),
          ]);

        let initialSession: Session | null = null;
        try {
          const { data } = await withTimeout(supabase.auth.getSession(), 4000);
          initialSession = data.session;
        } catch {
          // sessão corrompida ou rede fora — limpa e recria
          try {
            Object.keys(localStorage)
              .filter((k) => k.startsWith('sb-') || k.includes('supabase.auth'))
              .forEach((k) => localStorage.removeItem(k));
          } catch {}
        }

        if (initialSession) {
          applySession(initialSession);
        } else {
          try {
            await withTimeout(ensureLocalAccount(), 8000);
            const { data } = await supabase.auth.getSession();
            applySession(data.session);
          } catch (e) {
            console.warn('Auto-login em background falhou, seguindo offline:', e);
          }
        }
      } catch (err) {
        console.error('Auto-login falhou:', err);
      }
    })();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isReady, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
