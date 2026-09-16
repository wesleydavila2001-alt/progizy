import { useState, useCallback } from 'react';
import { BookOpen, Sparkles, Loader2, Copy, Check, ChevronDown, ChevronUp, Film, Zap, MessageSquare, AlertCircle, PenLine, Compass, Target, Users, Palette, LayoutTemplate, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const CHANNELS = ['TikTok Ads', 'Meta Ads', 'Reels', 'VSL', 'Landing Page', 'E-mail', 'YouTube Shorts'];
const TONES = ['Empático', 'Urgente', 'Inspiracional', 'Vulnerável', 'Direto', 'Aspiracional', 'Técnico'];
const FRAMEWORKS = [
  "Hero's Journey", 'StoryBrand', 'Epiphany Bridge', 'BAB', 'SSS', 'PAS Narrativo', 'Sparkline', 'Pixar Story Spine', 'Jornada do Cliente', 'Livre'
];
const STORY_TYPES = [
  'Origem', 'Falha e Virada', 'Cliente', 'Inimigo Comum', 'Descoberta', 'Missão', 'Prova', 'Identidade', 'Contraste', 'Futuro'
];

interface StorytellingForm {
  niche: string;
  product: string;
  audience: string;
  channel: string;
  tone: string;
  framework: string;
  storyType: string;
  existingStory: string;
}

interface StorytellingResult {
  // Generate mode
  fullStory?: string;
  shortVersion?: string;
  videoScript?: Record<string, { time: string; visual: string; narration: string }>;
  openings?: { text: string; hookType?: string; objective: string }[];
  integratedCTA?: string;
  frameworkUsed?: string;
  storyTypeUsed?: string;
  emotionalArc?: string;
  // Improve mode
  diagnosis?: string;
  improvedStory?: string;
  changes?: string[];
  alternativeOpenings?: { text: string; objective: string }[];
}

interface Props {
  onXP?: (n: number) => void;
}

export function StorytellingView({ onXP }: Props) {
  const [mode, setMode] = useState<'generate' | 'improve'>('generate');
  const [form, setForm] = useState<StorytellingForm>({
    niche: '', product: '', audience: '', channel: '', tone: '', framework: '', storyType: '', existingStory: '',
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<StorytellingResult | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(true);
  const [isRecommending, setIsRecommending] = useState(false);
  const [recommendedType, setRecommendedType] = useState<{ type: string; reason: string } | null>(null);

  const update = (field: keyof StorytellingForm, value: string) => setForm(f => ({ ...f, [field]: value }));

  const canRecommend = form.niche.trim().length > 0 && form.product.trim().length > 0;

  const handleRecommend = useCallback(async () => {
    if (!canRecommend) {
      toast.error('Preencha o nicho e o produto para receber uma recomendação.');
      return;
    }
    setIsRecommending(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-storytelling', {
        body: { niche: form.niche, product: form.product, audience: form.audience, mode: 'recommend' },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }
      if (data?.recommendedType) {
        const match = STORY_TYPES.find(st => data.recommendedType.toLowerCase().includes(st.toLowerCase()));
        const finalType = match || data.recommendedType;
        setRecommendedType({ type: finalType, reason: data.reason || '' });
        if (match) {
          update('storyType', match);
          toast.success(`IA recomenda: "${match}" — ${data.reason || ''}`);
        } else {
          toast.info(`IA recomenda: "${data.recommendedType}" — ${data.reason || ''}`);
        }
        onXP?.(3);
      }
    } catch (err) {
      console.error('Recommend error:', err);
      toast.error('Erro ao obter recomendação. Tente novamente.');
    } finally {
      setIsRecommending(false);
    }
  }, [canRecommend, form.niche, form.product, form.audience, onXP]);

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
    toast.success('Copiado! +1 XP');
    onXP?.(1);
  };

  const handleGenerate = useCallback(async () => {
    if (mode === 'generate' && (!form.niche || !form.product)) {
      toast.error('Preencha pelo menos o nicho e o produto.');
      return;
    }
    if (mode === 'improve' && !form.existingStory.trim()) {
      toast.error('Cole a história que deseja melhorar.');
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-storytelling', {
        body: {
          niche: form.niche,
          product: form.product,
          audience: form.audience,
          channel: form.channel,
          tone: form.tone,
          framework: form.framework,
          storyType: form.storyType,
          existingStory: mode === 'improve' ? form.existingStory : undefined,
        },
      });

      if (error) {
        const msg = error.message || '';
        if (msg.includes('402')) { toast.error('Créditos de IA insuficientes.'); return; }
        if (msg.includes('429')) { toast.error('Muitas requisições. Aguarde e tente novamente.'); return; }
        throw error;
      }
      if (data?.error) { toast.error(data.error); return; }

      setResult(data);
      toast.success('Storytelling gerado com sucesso! +10 XP');
      onXP?.(10);
    } catch (err) {
      console.error('Generate storytelling error:', err);
      toast.error('Erro ao gerar storytelling. Tente novamente.');
    } finally {
      setIsGenerating(false);
    }
  }, [form, mode, onXP]);

  const renderCopyButton = (text: string, id: string) => (
    <Button size="sm" variant="outline" onClick={() => copyText(text, id)} className="border-border/60 hover:border-primary/40 text-xs">
      {copiedId === id ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
      {copiedId === id ? 'Copiado!' : 'Copiar'}
    </Button>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div>
        <h2 className="text-2xl md:text-3xl font-black tracking-tight">
          <span className="text-gradient-red">Gerador Inteligente</span>
          <span className="text-foreground"> de </span>
          <span className="text-violet-400">Storytelling</span>
        </h2>
        <p className="text-sm text-muted-foreground mt-1">Crie histórias que vendem usando frameworks dos maiores storytellers do mundo</p>
      </div>

      {/* Form Toggle */}
      <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 w-full text-left">
        <Sparkles className="w-5 h-5 text-primary" />
        <span className="font-bold text-foreground">🎭 Gerador de Storytelling IA</span>
        {showForm ? <ChevronUp className="w-4 h-4 text-muted-foreground ml-auto" /> : <ChevronDown className="w-4 h-4 text-muted-foreground ml-auto" />}
      </button>

      {/* Form */}
      {showForm && (
        <Card className="border-border/60 bg-card">
          <CardContent className="pt-6 space-y-5">
            <Tabs value={mode} onValueChange={(v) => setMode(v as 'generate' | 'improve')}>
              <TabsList className="grid w-full grid-cols-2 bg-muted/50">
                <TabsTrigger value="generate" className="text-xs font-bold">
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Gerar do Zero
                </TabsTrigger>
                <TabsTrigger value="improve" className="text-xs font-bold">
                  <PenLine className="w-3.5 h-3.5 mr-1.5" /> Melhorar História
                </TabsTrigger>
              </TabsList>

              <TabsContent value="generate" className="space-y-4 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5 text-xs font-bold"><Compass className="w-3.5 h-3.5 text-primary" /> Nicho *</Label>
                    <Input placeholder="Ex: emagrecimento, renda extra..." value={form.niche} onChange={e => update('niche', e.target.value)} className="bg-background border-border/60" />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5 text-xs font-bold"><Package className="w-3.5 h-3.5 text-primary" /> Produto/Serviço *</Label>
                    <Input placeholder="Nome e descrição breve" value={form.product} onChange={e => update('product', e.target.value)} className="bg-background border-border/60" />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5 text-xs font-bold"><Users className="w-3.5 h-3.5 text-primary" /> Público-alvo</Label>
                    <Input placeholder="Quem é seu cliente ideal?" value={form.audience} onChange={e => update('audience', e.target.value)} className="bg-background border-border/60" />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5 text-xs font-bold"><Target className="w-3.5 h-3.5 text-primary" /> Canal</Label>
                    <Select value={form.channel} onValueChange={v => update('channel', v)}>
                      <SelectTrigger className="bg-background border-border/60"><SelectValue placeholder="Escolha o canal" /></SelectTrigger>
                      <SelectContent>{CHANNELS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5 text-xs font-bold"><Palette className="w-3.5 h-3.5 text-primary" /> Tom</Label>
                    <Select value={form.tone} onValueChange={v => update('tone', v)}>
                      <SelectTrigger className="bg-background border-border/60"><SelectValue placeholder="Tom da história" /></SelectTrigger>
                      <SelectContent>{TONES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5 text-xs font-bold"><LayoutTemplate className="w-3.5 h-3.5 text-primary" /> Framework</Label>
                    <Select value={form.framework} onValueChange={v => update('framework', v)}>
                      <SelectTrigger className="bg-background border-border/60"><SelectValue placeholder="Escolha o framework" /></SelectTrigger>
                      <SelectContent>{FRAMEWORKS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-1.5 text-xs font-bold"><BookOpen className="w-3.5 h-3.5 text-violet-400" /> Tipo de História</Label>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleRecommend}
                      disabled={isRecommending || !canRecommend}
                      className={`text-xs font-bold border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10 transition-all duration-300 ${
                        canRecommend && !isRecommending
                          ? 'animate-pulse shadow-[0_0_12px_2px_hsl(var(--chart-2)/0.4)] border-emerald-400'
                          : 'opacity-50'
                      }`}
                    >
                      {isRecommending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1" />}
                      IA Recomendar
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {STORY_TYPES.map(st => {
                      const isRec = recommendedType?.type === st;
                      const isSel = form.storyType === st;
                      return (
                        <Button key={st} size="sm" variant={isSel ? 'default' : 'outline'}
                          onClick={() => update('storyType', st)}
                          className={
                            isSel
                              ? 'gradient-red text-primary-foreground border-0 text-xs'
                              : isRec
                              ? 'bg-primary/10 border-2 border-primary text-primary text-xs font-bold ring-2 ring-primary/40 shadow-[0_0_15px_-3px_hsl(var(--primary)/0.6)] animate-pulse'
                              : 'border-border/60 text-xs hover:border-primary/40'
                          }>
                          {isRec && !isSel && '🔥 '}{st}
                        </Button>
                      );
                    })}
                  </div>
                  {recommendedType && (
                    <p className="text-xs text-primary font-semibold mt-2">💡 IA recomenda <span className="uppercase">{recommendedType.type}</span>{recommendedType.reason && ` — ${recommendedType.reason}`}</p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="improve" className="space-y-4 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5 text-xs font-bold"><Compass className="w-3.5 h-3.5 text-primary" /> Nicho</Label>
                    <Input placeholder="Ex: emagrecimento..." value={form.niche} onChange={e => update('niche', e.target.value)} className="bg-background border-border/60" />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5 text-xs font-bold"><Palette className="w-3.5 h-3.5 text-primary" /> Tom</Label>
                    <Select value={form.tone} onValueChange={v => update('tone', v)}>
                      <SelectTrigger className="bg-background border-border/60"><SelectValue placeholder="Tom desejado" /></SelectTrigger>
                      <SelectContent>{TONES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5 text-xs font-bold"><PenLine className="w-3.5 h-3.5 text-amber-400" /> História para Melhorar *</Label>
                  <Textarea placeholder="Cole aqui a história ou copy que deseja melhorar..." value={form.existingStory} onChange={e => update('existingStory', e.target.value)}
                    className="bg-background border-border/60 min-h-[150px]" />
                </div>
              </TabsContent>
            </Tabs>

            <Button onClick={handleGenerate} disabled={isGenerating} className="w-full gradient-red text-primary-foreground border-0 font-bold">
              {isGenerating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Gerando Storytelling...</> : <><Sparkles className="w-4 h-4 mr-2" /> Gerar Storytelling com IA</>}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-5">
          {/* Diagnosis (improve mode) */}
          {result.diagnosis && (
            <Card className="border-orange-500/30 bg-card">
              <CardContent className="pt-5 space-y-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-orange-400" />
                  <h3 className="font-bold text-orange-400">🔍 Diagnóstico</h3>
                </div>
                <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line">{result.diagnosis}</p>
              </CardContent>
            </Card>
          )}

          {/* Improved Story */}
          {result.improvedStory && (
            <Card className="border-emerald-500/30 bg-card">
              <CardContent className="pt-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PenLine className="w-5 h-5 text-emerald-400" />
                    <h3 className="font-bold text-emerald-400">✍️ História Melhorada</h3>
                  </div>
                  {renderCopyButton(result.improvedStory, 'improved')}
                </div>
                <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line">{result.improvedStory}</p>
              </CardContent>
            </Card>
          )}

          {/* Changes list */}
          {result.changes && result.changes.length > 0 && (
            <Card className="border-sky-500/30 bg-card">
              <CardContent className="pt-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-sky-400" />
                  <h3 className="font-bold text-sky-400">📋 Mudanças Realizadas</h3>
                </div>
                <ul className="space-y-2">
                  {result.changes.map((c, i) => (
                    <li key={i} className="text-sm text-foreground/90 flex gap-2">
                      <span className="text-sky-400 font-bold shrink-0">{i + 1}.</span>
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Full Story */}
          {result.fullStory && (
            <Card className="border-violet-500/30 bg-card">
              <CardContent className="pt-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-violet-400" />
                    <h3 className="font-bold text-violet-400">📖 História Completa</h3>
                    {result.frameworkUsed && <Badge variant="outline" className="text-[10px] border-violet-500/30 text-violet-300">{result.frameworkUsed}</Badge>}
                    {result.storyTypeUsed && <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-300">{result.storyTypeUsed}</Badge>}
                  </div>
                  {renderCopyButton(result.fullStory, 'full')}
                </div>
                <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line">{result.fullStory}</p>
                {result.emotionalArc && (
                  <div className="mt-3 p-3 rounded-lg bg-violet-500/5 border border-violet-500/20">
                    <p className="text-xs text-violet-300 font-semibold mb-1">🎭 Arco Emocional:</p>
                    <p className="text-xs text-foreground/70">{result.emotionalArc}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Short Version */}
          {result.shortVersion && (
            <Card className="border-pink-500/30 bg-card">
              <CardContent className="pt-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-pink-400" />
                    <h3 className="font-bold text-pink-400">⚡ Versão Curta (Anúncio)</h3>
                  </div>
                  {renderCopyButton(result.shortVersion, 'short')}
                </div>
                <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line">{result.shortVersion}</p>
              </CardContent>
            </Card>
          )}

          {/* Video Script */}
          {result.videoScript && (
            <Card className="border-indigo-500/30 bg-card">
              <CardContent className="pt-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Film className="w-5 h-5 text-indigo-400" />
                  <h3 className="font-bold text-indigo-400">🎬 Roteiro de Vídeo</h3>
                </div>
                <div className="space-y-3">
                  {Object.entries(result.videoScript).map(([key, scene], idx) => (
                    <div key={key} className="p-3 rounded-lg bg-indigo-500/5 border border-indigo-500/20">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30 text-[10px]">Cena {idx + 1}</Badge>
                        <span className="text-[10px] text-muted-foreground">{scene.time}</span>
                      </div>
                      <p className="text-xs text-amber-300 mb-1"><span className="font-semibold">🎥 Visual:</span> {scene.visual}</p>
                      <p className="text-xs text-foreground/80"><span className="font-semibold text-indigo-300">🎤 Narração:</span> {scene.narration}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Openings */}
          {(result.openings || result.alternativeOpenings) && (
            <Card className="border-amber-500/30 bg-card">
              <CardContent className="pt-5 space-y-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-amber-400" />
                  <h3 className="font-bold text-amber-400">🎣 Aberturas Alternativas</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {(result.openings || result.alternativeOpenings || []).map((op, i) => (
                    <div key={i} className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 space-y-2">
                      <div className="flex items-center justify-between">
                        <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px]">
                          {('hookType' in op && (op as any).hookType) ? String((op as any).hookType) : `Abertura ${i + 1}`}
                        </Badge>
                        {renderCopyButton(op.text, `opening-${i}`)}
                      </div>
                      <p className="text-sm text-foreground/90">{op.text}</p>
                      <p className="text-[10px] text-muted-foreground">{op.objective}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Integrated CTA */}
          {result.integratedCTA && (
            <Card className="border-rose-500/30 bg-card">
              <CardContent className="pt-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-rose-400" />
                    <h3 className="font-bold text-rose-400">📣 CTA Integrado</h3>
                  </div>
                  {renderCopyButton(result.integratedCTA, 'cta')}
                </div>
                <p className="text-sm text-foreground/90 leading-relaxed">{result.integratedCTA}</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
