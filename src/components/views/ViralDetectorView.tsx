import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Zap, Link2, Loader2, RotateCcw, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useToast } from '@/hooks/use-toast';

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/viral-detector`;

function detectPlatform(url: string): string {
  if (/tiktok\.com/i.test(url)) return 'TikTok';
  if (/youtube\.com|youtu\.be/i.test(url)) return 'YouTube';
  if (/instagram\.com/i.test(url)) return 'Instagram';
  return 'Desconhecida';
}

export function ViralDetectorView({ onXP }: { onXP: (n: number) => void }) {
  const [url, setUrl] = useState('');
  const [report, setReport] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const analyze = useCallback(async () => {
    const trimmed = url.trim();
    if (!trimmed) {
      toast({ title: 'Cole um link de vídeo', variant: 'destructive' });
      return;
    }

    setReport('');
    setLoading(true);

    try {
      const platform = detectPlatform(trimmed);
      const resp = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ url: trimmed, platform }),
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
  }, [url, onXP, toast]);

  const reset = () => {
    setUrl('');
    setReport('');
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Zap className="w-6 h-6 text-primary" />
          Detector de Vídeo Viral
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          Cole o link de um vídeo do TikTok, YouTube ou Instagram e descubra por que ele tem potencial viral.
        </p>
      </div>

      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="w-4 h-4 text-primary" />
            Link do Vídeo
          </CardTitle>
          <CardDescription>Suporte: TikTok, YouTube Shorts, Instagram Reels</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="https://www.tiktok.com/@user/video/..."
              value={url}
              onChange={e => setUrl(e.target.value)}
              disabled={loading}
              className="flex-1"
              onKeyDown={e => e.key === 'Enter' && !loading && analyze()}
            />
            <Button onClick={analyze} disabled={loading || !url.trim()} className="gap-2 min-w-[140px]">
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
          {url.trim() && (
            <p className="text-xs text-muted-foreground mt-2">
              Plataforma detectada: <span className="font-medium text-primary">{detectPlatform(url)}</span>
            </p>
          )}
        </CardContent>
      </Card>

      {(report || loading) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Relatório de Análise Viral
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{report || '⏳ Gerando análise...'}</ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
