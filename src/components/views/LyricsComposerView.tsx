import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Music, Sparkles, Wand2, Repeat, Copy, Check, Loader2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

type Mode = 'create' | 'improve' | 'adapt';

const GENRES = ['Pop', 'Sertanejo', 'Funk', 'Rap/Trap', 'Rock', 'MPB', 'Forró', 'Pagode', 'Eletrônica', 'Reggae', 'Gospel', 'Indie'];
const MOODS = ['Energético', 'Melancólico', 'Romântico', 'Festivo', 'Reflexivo', 'Raivoso', 'Esperançoso', 'Sensual'];
const LANGS = ['Português (BR)', 'Inglês', 'Espanhol'];
const STRUCTURES = [
  'Verso-Refrão-Verso-Refrão-Ponte-Refrão',
  'Verso-Pré-Refrão-Refrão-Verso-Pré-Refrão-Refrão',
  'Intro-Verso-Refrão-Verso-Refrão-Outro',
  'Verso-Refrão (curta/viral)',
];
const RHYMES = ['AABB (pareadas)', 'ABAB (alternadas)', 'ABBA (interpolada)', 'Livre'];

interface Props { onXP?: (amount: number) => void }

export function LyricsComposerView({ onXP }: Props) {
  const [mode, setMode] = useState<Mode>('create');
  const [theme, setTheme] = useState('');
  const [genre, setGenre] = useState('Pop');
  const [mood, setMood] = useState('Energético');
  const [language, setLanguage] = useState('Português (BR)');
  const [structure, setStructure] = useState(STRUCTURES[0]);
  const [rhyme, setRhyme] = useState(RHYMES[0]);
  const [lyrics, setLyrics] = useState('');
  const [targetGenre, setTargetGenre] = useState('Sertanejo');
  const [notes, setNotes] = useState('');

  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [output]);

  const handleGenerate = async () => {
    if (mode === 'create' && !theme.trim()) {
      toast.error('Descreva o tema da música');
      return;
    }
    if ((mode === 'improve' || mode === 'adapt') && !lyrics.trim()) {
      toast.error('Cole a letra original');
      return;
    }

    setLoading(true);
    setOutput('');
    abortRef.current = new AbortController();

    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lyrics-composer`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ mode, theme, genre, mood, language, structure, rhyme, lyrics, targetGenre, notes }),
        signal: abortRef.current.signal,
      });

      if (resp.status === 429) { toast.error('Muitas requisições. Aguarde um momento.'); setLoading(false); return; }
      if (resp.status === 402) { toast.error('Créditos esgotados. Adicione créditos em Settings → Workspace.'); setLoading(false); return; }
      if (!resp.ok || !resp.body) throw new Error('Falha ao iniciar geração');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let done = false;
      while (!done) {
        const { value, done: d } = await reader.read();
        if (d) break;
        buf += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf('\n')) !== -1) {
          let line = buf.slice(0, idx);
          buf = buf.slice(idx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const json = line.slice(6).trim();
          if (json === '[DONE]') { done = true; break; }
          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) setOutput((p) => p + delta);
          } catch {
            buf = line + '\n' + buf;
            break;
          }
        }
      }
      onXP?.(20);
      toast.success('Letra pronta! +20 XP');
    } catch (e: any) {
      if (e.name !== 'AbortError') toast.error(e.message || 'Erro ao gerar letra');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    toast.success('Letra copiada!');
    setTimeout(() => setCopied(false), 1500);
  };

  const handleDownload = () => {
    const blob = new Blob([output], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `letra-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const modeMeta = {
    create: { icon: Sparkles, label: 'Criar do Zero', desc: 'Gere uma letra completa a partir de um tema' },
    improve: { icon: Wand2, label: 'Melhorar Letra', desc: 'Refine métrica, rimas e ganchos' },
    adapt: { icon: Repeat, label: 'Adaptar Gênero', desc: 'Reescreva sua letra em outro estilo musical' },
  } as const;

  return (
    <div className="space-y-5 max-w-7xl">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-xl md:text-2xl font-bold tracking-wide leading-tight flex items-center gap-2">
          <Music className="w-5 h-5 text-primary" />
          <span className="text-gradient-red">Compositor</span>
          <span className="text-foreground">de Letras</span>
        </h2>
        <p className="text-muted-foreground text-xs mt-1">
          Crie, melhore e adapte letras prontas para <span className="text-foreground/70 font-medium">Suno AI</span> e outras plataformas
        </p>
      </motion.div>

      <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)} className="w-full">
        <TabsList className="grid grid-cols-3 w-full bg-card/40 border border-border/60">
          {(['create', 'improve', 'adapt'] as Mode[]).map((m) => {
            const M = modeMeta[m];
            return (
              <TabsTrigger key={m} value={m} className="data-[state=active]:bg-primary/15 data-[state=active]:text-primary gap-2">
                <M.icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{M.label}</span>
                <span className="sm:hidden">{m === 'create' ? 'Criar' : m === 'improve' ? 'Melhorar' : 'Adaptar'}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
          {/* Painel de Configuração */}
          <div className="rounded-xl p-5 border border-border/60 bg-card/40 backdrop-blur-sm space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-border/40">
              {(() => { const I = modeMeta[mode].icon; return <I className="w-4 h-4 text-primary" />; })()}
              <div>
                <p className="text-sm font-bold uppercase tracking-wider text-foreground">{modeMeta[mode].label}</p>
                <p className="text-[11px] text-muted-foreground">{modeMeta[mode].desc}</p>
              </div>
            </div>

            <TabsContent value="create" className="space-y-3 mt-0">
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Tema / Mensagem</Label>
                <Textarea value={theme} onChange={(e) => setTheme(e.target.value)} rows={3}
                  placeholder="Ex: Superação após um término, voltando mais forte..."
                  className="bg-background/60 border-border/60 resize-none text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Gênero" value={genre} onChange={setGenre} options={GENRES} />
                <Field label="Vibe" value={mood} onChange={setMood} options={MOODS} />
                <Field label="Idioma" value={language} onChange={setLanguage} options={LANGS} />
                <Field label="Rimas" value={rhyme} onChange={setRhyme} options={RHYMES} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Estrutura</Label>
                <Select value={structure} onValueChange={setStructure}>
                  <SelectTrigger className="bg-background/60 border-border/60 text-sm h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{STRUCTURES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </TabsContent>

            <TabsContent value="improve" className="space-y-3 mt-0">
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Letra Original</Label>
                <Textarea value={lyrics} onChange={(e) => setLyrics(e.target.value)} rows={8}
                  placeholder="Cole sua letra aqui..."
                  className="bg-background/60 border-border/60 resize-none text-sm font-mono" />
              </div>
              <Field label="Idioma" value={language} onChange={setLanguage} options={LANGS} />
            </TabsContent>

            <TabsContent value="adapt" className="space-y-3 mt-0">
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Letra Original</Label>
                <Textarea value={lyrics} onChange={(e) => setLyrics(e.target.value)} rows={6}
                  placeholder="Cole sua letra aqui..."
                  className="bg-background/60 border-border/60 resize-none text-sm font-mono" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Novo Gênero" value={targetGenre} onChange={setTargetGenre} options={GENRES} />
                <Field label="Idioma" value={language} onChange={setLanguage} options={LANGS} />
              </div>
            </TabsContent>

            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Observações (opcional)</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: incluir nome 'Ana', evitar palavrões..."
                className="bg-background/60 border-border/60 h-9 text-sm" />
            </div>

            <Button onClick={handleGenerate} disabled={loading}
              className="w-full gradient-red text-primary-foreground font-bold uppercase tracking-wider glow-red">
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Compondo...</> : <><Sparkles className="w-4 h-4 mr-2" />Gerar Letra</>}
            </Button>
          </div>

          {/* Painel de Saída */}
          <div className="rounded-xl border border-border/60 bg-card/40 backdrop-blur-sm flex flex-col min-h-[400px]">
            <div className="flex items-center justify-between p-4 border-b border-border/40">
              <div className="flex items-center gap-2">
                <Music className="w-4 h-4 text-primary" />
                <p className="text-sm font-bold uppercase tracking-wider">Letra Gerada</p>
              </div>
              {output && (
                <div className="flex items-center gap-1.5">
                  <Button size="sm" variant="ghost" onClick={handleCopy} className="h-7 px-2">
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={handleDownload} className="h-7 px-2">
                    <Download className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
            </div>
            <div ref={outputRef} className="flex-1 overflow-y-auto p-5">
              {output ? (
                <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed text-foreground/90">{output}</pre>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground gap-3 py-12">
                  <Music className="w-10 h-10 opacity-30" />
                  <p className="text-xs uppercase tracking-wider">Sua letra aparecerá aqui</p>
                  <p className="text-[11px] max-w-xs">Configure ao lado e clique em <span className="text-primary font-semibold">Gerar Letra</span></p>
                </div>
              )}
            </div>
          </div>
        </div>
      </Tabs>
    </div>
  );
}

function Field({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="bg-background/60 border-border/60 text-sm h-9"><SelectValue /></SelectTrigger>
        <SelectContent>{options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}
