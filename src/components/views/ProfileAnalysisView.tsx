import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UserSearch, Loader2, RotateCcw, Sparkles, AtSign } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useToast } from '@/hooks/use-toast';

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/profile-analysis`;

const STORAGE_KEY = 'profile-analysis-cache-v1';

export function ProfileAnalysisView({ onXP }: { onXP: (n: number) => void }) {
  const [username, setUsername] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}').username || ''; } catch { return ''; }
  });
  const [report, setReport] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}').report || ''; } catch { return ''; }
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (report) localStorage.setItem(STORAGE_KEY, JSON.stringify({ username, report }));
  }, [username, report]);

  const analyze = useCallback(async () => {
    const trimmed = username.trim().replace(/^@/, '');
    if (!trimmed) {
      toast({ title: 'Digite um username', variant: 'destructive' });
      return;
    }

    setReport('');
    setLoading(true);

    try {
      const resp = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ username: trimmed }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Erro desconhecido' }));
        throw new Error(err.error || `Erro ${resp.status}`);
      }

      if (!resp.body) throw new Error('Sem resposta do servidor');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let full = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const json = line.slice(6).trim();
          if (json === '[DONE]') break;
          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              full += content;
              setReport(full);
            }
          } catch {
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }

      onXP(30);
      toast({ title: '🎯 Análise concluída! +30 XP' });
    } catch (e: any) {
      toast({ title: e.message || 'Erro na análise', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [username, onXP, toast]);

  const reset = () => {
    setUsername('');
    setReport('');
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <UserSearch className="w-6 h-6 text-primary" />
          Análise de Perfil
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          Insira o username de um perfil TikTok para analisar estratégias, conteúdo e crescimento.
        </p>
      </div>

      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AtSign className="w-4 h-4 text-primary" />
            Username do TikTok
          </CardTitle>
          <CardDescription>Estude concorrentes e descubra estratégias de crescimento</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="@username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              disabled={loading}
              className="flex-1"
              onKeyDown={e => e.key === 'Enter' && !loading && analyze()}
            />
            <Button onClick={analyze} disabled={loading || !username.trim()} className="gap-2 min-w-[140px]">
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analisando...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Analisar
                </>
              )}
            </Button>
            {report && (
              <Button variant="outline" size="icon" onClick={reset} title="Nova análise">
                <RotateCcw className="w-4 h-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {(report || loading) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Relatório de Análise
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown
                components={{
                  h2: ({ children }) => (
                    <h2 className="text-lg font-black uppercase tracking-wide text-primary border-b border-primary/20 pb-2 mt-6 mb-3 first:mt-0">
                      {children}
                    </h2>
                  ),
                  strong: ({ children }) => (
                    <span className="text-primary font-bold uppercase text-xs tracking-wider">
                      {children}
                    </span>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-base font-bold text-accent-foreground mt-4 mb-2">
                      {children}
                    </h3>
                  ),
                }}
              >
                {report || '⏳ Gerando análise...'}
              </ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
