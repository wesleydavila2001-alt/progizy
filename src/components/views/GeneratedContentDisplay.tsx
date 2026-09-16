import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, Heart, TrendingUp, DollarSign, ShoppingCart, MessageSquareText, Lightbulb, Eye, Rocket, Check, FileText, Video, PenLine, AlertCircle, Layers, Combine } from 'lucide-react';
import { toast } from 'sonner';

export interface VisualHook {
  nome: string;
  ideiaVisual: string;
  frame1: string;
  ate1_5s: string;
  ate3s: string;
  produtoAparece: string;
  beneficioVisual: string;
  gatilho: string;
  overlay: string;
  tipoAbertura: string;
  promptVisual: string;
  porqueFunciona: string;
}

export interface TextualHook {
  linhaPrincipal: string;
  variacaoAgressiva: string;
  variacaoCuriosa: string;
  variacaoTikTokShop: string;
  gatilho: string;
}

export interface HookCombination {
  ganchoVisual: string;
  hookTextual: string;
  motivoEstrategico: string;
  nivelConsciencia: string;
  estiloCreator: string;
}

export interface GeneratedContent {
  // New TikTok Shop visual hooks format
  leituraEstrategica?: string;
  ganchosVisuais?: VisualHook[];
  hooksTextuais?: TextualHook[];
  melhoresCombinacoes?: HookCombination[];
  // Legacy fields
  hooks?: { text: string; objective: string; hookType?: string }[];
  ctas?: { text: string; objective: string }[];
  videoIdeas?: { title: string; description: string; structure?: string }[];
  retentionPhrases?: { text: string; whenToUse: string }[];
  growthApproaches?: { title: string; description: string; steps?: string[] }[];
  monetizationApproaches?: { title: string; description: string; steps?: string[] }[];
  salesApproaches?: { title: string; description: string; steps?: string[] }[];
  fullCopy?: string;
  shortVersion?: string;
  videoScript?: { hookVisual: string; narration: string; ctaFalado: string };
  diagnosis?: string;
  improvedCopy?: string;
  changes?: string[];
  alternativeHooks?: { text: string; objective: string }[];
}

type SectionKey = 'leituraEstrategica' | 'ganchosVisuais' | 'hooksTextuais' | 'melhoresCombinacoes' | 'diagnosis' | 'improvedCopy' | 'fullCopy' | 'shortVersion' | 'videoScript' | 'hooks' | 'ctas' | 'videoIdeas' | 'retentionPhrases' | 'growthApproaches' | 'monetizationApproaches' | 'salesApproaches' | 'alternativeHooks';

const SECTIONS: { key: SectionKey; label: string; icon: React.ElementType; color: string; isArray: boolean }[] = [
  { key: 'leituraEstrategica', label: 'Leitura Estratégica', icon: Lightbulb, color: 'text-amber-400', isArray: false },
  { key: 'ganchosVisuais', label: 'Ganchos Visuais 3s', icon: Eye, color: 'text-primary', isArray: true },
  { key: 'hooksTextuais', label: 'Hooks Textuais', icon: FileText, color: 'text-cyan-400', isArray: true },
  { key: 'melhoresCombinacoes', label: 'Melhores Combinações', icon: Combine, color: 'text-violet-400', isArray: true },
  { key: 'diagnosis', label: 'Diagnóstico', icon: AlertCircle, color: 'text-orange-400', isArray: false },
  { key: 'improvedCopy', label: 'Copy Melhorada', icon: PenLine, color: 'text-emerald-400', isArray: false },
  { key: 'fullCopy', label: 'Copy Completa', icon: FileText, color: 'text-violet-400', isArray: false },
  { key: 'shortVersion', label: 'Versão Curta', icon: FileText, color: 'text-pink-400', isArray: false },
  { key: 'videoScript', label: 'Roteiro Vídeo', icon: Video, color: 'text-indigo-400', isArray: false },
  { key: 'hooks', label: 'Hooks', icon: TrendingUp, color: 'text-emerald-400', isArray: true },
  { key: 'alternativeHooks', label: 'Hooks Alternativos', icon: TrendingUp, color: 'text-teal-400', isArray: true },
  { key: 'ctas', label: 'CTAs', icon: MessageSquareText, color: 'text-sky-400', isArray: true },
  { key: 'videoIdeas', label: 'Ideias de Vídeos', icon: Lightbulb, color: 'text-amber-400', isArray: true },
  { key: 'retentionPhrases', label: 'Frases Retenção', icon: Eye, color: 'text-cyan-400', isArray: true },
  { key: 'growthApproaches', label: 'Crescimento', icon: Rocket, color: 'text-green-400', isArray: true },
  { key: 'monetizationApproaches', label: 'Monetização', icon: DollarSign, color: 'text-yellow-400', isArray: true },
  { key: 'salesApproaches', label: 'Vendas', icon: ShoppingCart, color: 'text-rose-400', isArray: true },
];

interface Props {
  content: GeneratedContent;
  onXP?: (n: number) => void;
}

export function GeneratedContentDisplay({ content, onXP }: Props) {
  const availableSections = SECTIONS.filter(s => {
    const val = content[s.key as keyof GeneratedContent];
    if (val === undefined || val === null) return false;
    if (s.isArray) return Array.isArray(val) && val.length > 0;
    if (typeof val === 'string') return val.trim().length > 0;
    if (typeof val === 'object') return true;
    return false;
  });

  const [activeSection, setActiveSection] = useState<SectionKey>(availableSections[0]?.key || 'ganchosVisuais');
  const [copiedIdx, setCopiedIdx] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('progcontrol-generated-favs');
      return saved ? new Set(JSON.parse(saved)) : new Set<string>();
    } catch { return new Set<string>(); }
  });

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(id);
    setTimeout(() => setCopiedIdx(null), 1500);
    toast.success('Copiado! +1 XP');
    onXP?.(1);
  };

  const toggleFav = (id: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else { next.add(id); onXP?.(1); }
      localStorage.setItem('progcontrol-generated-favs', JSON.stringify([...next]));
      return next;
    });
  };

  const formatBoldText = (text: string) => {
    const parts = text.split(/\*\*(.+?)\*\*/g);
    return parts.map((part, i) =>
      i % 2 === 1 ? <span key={i} className="uppercase font-bold text-primary">{part}</span> : <span key={i}>{part}</span>
    );
  };

  const renderTextBlock = (text: string, id: string, label?: string) => (
    <Card className="border-border/60">
      <CardContent className="p-4 space-y-3">
        {label && <Badge variant="secondary" className="text-xs">{label}</Badge>}
        <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line">{formatBoldText(text)}</p>
        <Button size="sm" variant="outline" onClick={() => copyText(text, id)} className="text-xs border-border/60">
          {copiedIdx === id ? <Check className="w-3 h-3 mr-1 text-emerald-500" /> : <Copy className="w-3 h-3 mr-1" />}
          {copiedIdx === id ? 'Copiado!' : 'Copiar'}
        </Button>
      </CardContent>
    </Card>
  );

  // ─── Visual Hooks ───
  const renderVisualHooks = () => {
    const hooks = content.ganchosVisuais;
    if (!hooks || hooks.length === 0) return null;

    return (
      <div className="space-y-4">
        {hooks.map((hook, i) => {
          const id = `visual-${i}`;
          const isFav = favorites.has(id);
          const fullText = `🎬 ${hook.nome}\n\n💡 ${hook.ideiaVisual}\n\n🎥 Frame 1: ${hook.frame1}\n⏱️ Até 1.5s: ${hook.ate1_5s}\n⏱️ Até 3s: ${hook.ate3s}\n\n📦 Produto aparece como: ${hook.produtoAparece}\n✨ Benefício visual: ${hook.beneficioVisual}\n🧠 Gatilho: ${hook.gatilho}\n📝 Overlay: ${hook.overlay}\n🎯 Tipo: ${hook.tipoAbertura}\n\n🖼️ Prompt IA: ${hook.promptVisual}\n\n💡 Por que funciona: ${hook.porqueFunciona}`;

          return (
            <Card key={id} className="border-primary/20 hover:border-primary/40 transition-colors bg-primary/5">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-primary/20 text-primary border-primary/30 text-xs font-bold">#{i + 1}</Badge>
                    <h4 className="text-sm font-bold text-foreground">{hook.nome}</h4>
                  </div>
                  <Badge className="bg-violet-500/15 text-violet-400 border-violet-500/30 text-[10px] shrink-0">{hook.tipoAbertura}</Badge>
                </div>

                <p className="text-sm text-primary font-medium italic">"{hook.ideiaVisual}"</p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <div className="bg-background/50 rounded-md p-2 border border-border/40">
                    <span className="font-bold text-amber-400 block mb-1">🎥 Frame 1</span>
                    <span className="text-foreground/80">{hook.frame1}</span>
                  </div>
                  <div className="bg-background/50 rounded-md p-2 border border-border/40">
                    <span className="font-bold text-sky-400 block mb-1">⏱️ Até 1.5s</span>
                    <span className="text-foreground/80">{hook.ate1_5s}</span>
                  </div>
                  <div className="bg-background/50 rounded-md p-2 border border-border/40">
                    <span className="font-bold text-emerald-400 block mb-1">⏱️ Até 3s</span>
                    <span className="text-foreground/80">{hook.ate3s}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div><span className="font-semibold text-foreground/70">📦 Produto:</span> <span className="text-foreground/80">{hook.produtoAparece}</span></div>
                  <div><span className="font-semibold text-foreground/70">✨ Benefício:</span> <span className="text-foreground/80">{hook.beneficioVisual}</span></div>
                  <div><span className="font-semibold text-foreground/70">🧠 Gatilho:</span> <span className="text-foreground/80">{hook.gatilho}</span></div>
                  <div><span className="font-semibold text-foreground/70">📝 Overlay:</span> <span className="text-primary font-medium">"{hook.overlay}"</span></div>
                </div>

                <div className="bg-background/50 rounded-md p-2 border border-border/40 text-xs">
                  <span className="font-bold text-violet-400 block mb-1">🖼️ Prompt para IA</span>
                  <span className="text-foreground/80">{hook.promptVisual}</span>
                </div>

                <p className="text-xs text-muted-foreground italic">💡 {hook.porqueFunciona}</p>

                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={() => copyText(fullText, id)} className="flex-1 text-xs border-border/60">
                    {copiedIdx === id ? <Check className="w-3 h-3 mr-1 text-emerald-500" /> : <Copy className="w-3 h-3 mr-1" />}
                    {copiedIdx === id ? 'Copiado!' : 'Copiar Tudo'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => copyText(hook.promptVisual, `prompt-${id}`)} className="text-xs border-border/60">
                    {copiedIdx === `prompt-${id}` ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                    Prompt IA
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => toggleFav(id)} className="px-2">
                    <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-primary text-primary' : 'text-muted-foreground'}`} />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  // ─── Textual Hooks ───
  const renderTextualHooks = () => {
    const hooks = content.hooksTextuais;
    if (!hooks || hooks.length === 0) return null;

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {hooks.map((hook, i) => {
          const id = `textual-${i}`;
          const isFav = favorites.has(id);
          const fullText = `🔹 Principal: ${hook.linhaPrincipal}\n🔥 Agressiva: ${hook.variacaoAgressiva}\n🤔 Curiosa: ${hook.variacaoCuriosa}\n🛒 TikTok Shop: ${hook.variacaoTikTokShop}\n🧠 Gatilho: ${hook.gatilho}`;

          return (
            <Card key={id} className="border-cyan-500/20 hover:border-cyan-500/40 transition-colors">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge className="bg-cyan-500/15 text-cyan-400 border-cyan-500/30 text-xs font-bold">#{i + 1}</Badge>
                  <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px]">{hook.gatilho}</Badge>
                </div>

                <p className="text-sm font-bold text-foreground">{hook.linhaPrincipal}</p>

                <div className="space-y-1 text-xs">
                  <div><span className="font-semibold text-rose-400">🔥 Agressiva:</span> <span className="text-foreground/80">{hook.variacaoAgressiva}</span></div>
                  <div><span className="font-semibold text-amber-400">🤔 Curiosa:</span> <span className="text-foreground/80">{hook.variacaoCuriosa}</span></div>
                  <div><span className="font-semibold text-primary">🛒 TikTok Shop:</span> <span className="text-foreground/80">{hook.variacaoTikTokShop}</span></div>
                </div>

                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={() => copyText(fullText, id)} className="flex-1 text-xs border-border/60">
                    {copiedIdx === id ? <Check className="w-3 h-3 mr-1 text-emerald-500" /> : <Copy className="w-3 h-3 mr-1" />}
                    {copiedIdx === id ? 'Copiado!' : 'Copiar'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => toggleFav(id)} className="px-2">
                    <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-primary text-primary' : 'text-muted-foreground'}`} />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  // ─── Best Combinations ───
  const renderCombinations = () => {
    const combos = content.melhoresCombinacoes;
    if (!combos || combos.length === 0) return null;

    return (
      <div className="space-y-3">
        {combos.map((combo, i) => {
          const id = `combo-${i}`;
          const isFav = favorites.has(id);
          const fullText = `🎬 Visual: ${combo.ganchoVisual}\n📝 Textual: ${combo.hookTextual}\n💡 Motivo: ${combo.motivoEstrategico}\n🎯 Nível de consciência: ${combo.nivelConsciencia}\n👤 Estilo: ${combo.estiloCreator}`;

          return (
            <Card key={id} className="border-violet-500/20 hover:border-violet-500/40 transition-colors bg-violet-500/5">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Badge className="bg-violet-500/20 text-violet-400 border-violet-500/30 text-xs font-bold">Combo #{i + 1}</Badge>
                  <Badge className="bg-sky-500/15 text-sky-400 border-sky-500/30 text-[10px]">{combo.estiloCreator}</Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="bg-background/50 rounded-md p-2 border border-border/40">
                    <span className="font-bold text-primary block mb-1">🎬 Gancho Visual</span>
                    <span className="text-foreground/80">{combo.ganchoVisual}</span>
                  </div>
                  <div className="bg-background/50 rounded-md p-2 border border-border/40">
                    <span className="font-bold text-cyan-400 block mb-1">📝 Hook Textual</span>
                    <span className="text-foreground/80">{combo.hookTextual}</span>
                  </div>
                </div>

                <p className="text-xs text-foreground/80"><span className="font-semibold text-foreground/70">💡 Motivo:</span> {combo.motivoEstrategico}</p>
                <p className="text-xs text-muted-foreground"><span className="font-semibold">🎯 Consciência:</span> {combo.nivelConsciencia}</p>

                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={() => copyText(fullText, id)} className="flex-1 text-xs border-border/60">
                    {copiedIdx === id ? <Check className="w-3 h-3 mr-1 text-emerald-500" /> : <Copy className="w-3 h-3 mr-1" />}
                    {copiedIdx === id ? 'Copiado!' : 'Copiar'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => toggleFav(id)} className="px-2">
                    <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-primary text-primary' : 'text-muted-foreground'}`} />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  // ─── Legacy renderers ───
  const getHookTypeColor = (hookType: string): { text: string; bg: string; border: string } => {
    const lower = hookType.toLowerCase();
    if (lower.includes('dor') || lower.includes('pas')) return { text: 'text-rose-400', bg: 'bg-rose-500/15', border: 'border-rose-500/30' };
    if (lower.includes('benefício') || lower.includes('fab')) return { text: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30' };
    if (lower.includes('urgência')) return { text: 'text-orange-400', bg: 'bg-orange-500/15', border: 'border-orange-500/30' };
    return { text: 'text-purple-400', bg: 'bg-purple-500/15', border: 'border-purple-500/30' };
  };

  const renderSimpleItems = (items: { text: string; objective?: string; whenToUse?: string; hookType?: string }[], prefix: string) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {items.map((item, i) => {
        const id = `${prefix}-${i}`;
        const isFav = favorites.has(id);
        const hookColors = item.hookType ? getHookTypeColor(item.hookType) : null;
        return (
          <Card key={id} className="border-border/60 hover:border-primary/30 transition-colors">
            <CardContent className="p-4 space-y-2">
              {item.hookType && hookColors && (
                <Badge className={`text-[10px] font-semibold ${hookColors.text} ${hookColors.bg} ${hookColors.border} border`}>{item.hookType}</Badge>
              )}
              <p className="text-sm text-foreground/90 leading-relaxed">{item.text}</p>
              {(item.objective || item.whenToUse) && (
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground/70">{item.whenToUse ? 'Quando usar:' : 'Objetivo:'}</span> {item.whenToUse || item.objective}
                </p>
              )}
              <div className="flex gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={() => copyText(item.text, id)} className="flex-1 text-xs border-border/60">
                  {copiedIdx === id ? <Check className="w-3 h-3 mr-1 text-emerald-500" /> : <Copy className="w-3 h-3 mr-1" />}
                  {copiedIdx === id ? 'Copiado!' : 'Copiar'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => toggleFav(id)} className="px-2">
                  <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-primary text-primary' : 'text-muted-foreground'}`} />
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );

  const renderVideoIdeas = (items: { title: string; description: string; structure?: string }[]) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {items.map((item, i) => {
        const id = `video-${i}`;
        const isFav = favorites.has(id);
        const fullText = `${item.title}\n${item.description}${item.structure ? '\n\nEstrutura:\n' + item.structure : ''}`;
        return (
          <Card key={id} className="border-border/60 hover:border-primary/30 transition-colors">
            <CardContent className="p-4 space-y-2">
              <h4 className="text-sm font-bold text-amber-400">{item.title}</h4>
              <p className="text-xs text-foreground/80 leading-relaxed">{item.description}</p>
              {item.structure && (
                <p className="text-xs text-muted-foreground whitespace-pre-line border-t border-border/40 pt-2 mt-2">
                  <span className="font-semibold text-foreground/70">Estrutura:</span> {item.structure}
                </p>
              )}
              <div className="flex gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={() => copyText(fullText, id)} className="flex-1 text-xs border-border/60">
                  {copiedIdx === id ? <Check className="w-3 h-3 mr-1 text-emerald-500" /> : <Copy className="w-3 h-3 mr-1" />}
                  {copiedIdx === id ? 'Copiado!' : 'Copiar'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => toggleFav(id)} className="px-2">
                  <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-primary text-primary' : 'text-muted-foreground'}`} />
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );

  const renderApproaches = (items: { title: string; description: string; steps?: string[] }[], prefix: string) => (
    <div className="space-y-3">
      {items.map((item, i) => {
        const id = `${prefix}-${i}`;
        const isFav = favorites.has(id);
        const fullText = `${item.title}\n${item.description}${item.steps?.length ? '\n\nPassos:\n' + item.steps.map((s, j) => `${j + 1}. ${s}`).join('\n') : ''}`;
        return (
          <Card key={id} className="border-border/60 hover:border-primary/30 transition-colors">
            <CardContent className="p-4 space-y-2">
              <h4 className="text-sm font-bold text-violet-400">{item.title}</h4>
              <p className="text-xs text-foreground/80 leading-relaxed">{item.description}</p>
              {item.steps && item.steps.length > 0 && (
                <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside border-t border-border/40 pt-2 mt-2">
                  {item.steps.map((step, j) => <li key={j}>{step}</li>)}
                </ol>
              )}
              <div className="flex gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={() => copyText(fullText, id)} className="flex-1 text-xs border-border/60">
                  {copiedIdx === id ? <Check className="w-3 h-3 mr-1 text-emerald-500" /> : <Copy className="w-3 h-3 mr-1" />}
                  {copiedIdx === id ? 'Copiado!' : 'Copiar'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => toggleFav(id)} className="px-2">
                  <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-primary text-primary' : 'text-muted-foreground'}`} />
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );

  const renderVideoScript = () => {
    const vs = content.videoScript;
    if (!vs) return null;
    const fullText = `🪝 Hook Visual: ${vs.hookVisual}\n\n🎙️ Narração: ${vs.narration}\n\n📣 CTA Falado: ${vs.ctaFalado}`;
    return (
      <Card className="border-border/60">
        <CardContent className="p-4 space-y-3">
          <div className="space-y-2">
            <div><Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-[10px]">🪝 Hook Visual</Badge><p className="text-sm text-foreground/90 mt-1">{vs.hookVisual}</p></div>
            <div><Badge className="bg-sky-500/20 text-sky-400 border-sky-500/30 text-[10px]">🎙️ Narração</Badge><p className="text-sm text-foreground/90 mt-1">{vs.narration}</p></div>
            <div><Badge className="bg-rose-500/20 text-rose-400 border-rose-500/30 text-[10px]">📣 CTA Falado</Badge><p className="text-sm text-foreground/90 mt-1">{vs.ctaFalado}</p></div>
          </div>
          <Button size="sm" variant="outline" onClick={() => copyText(fullText, 'videoScript')} className="text-xs border-border/60">
            {copiedIdx === 'videoScript' ? <Check className="w-3 h-3 mr-1 text-emerald-500" /> : <Copy className="w-3 h-3 mr-1" />}
            {copiedIdx === 'videoScript' ? 'Copiado!' : 'Copiar Roteiro'}
          </Button>
        </CardContent>
      </Card>
    );
  };

  const renderDiagnosis = () => {
    if (!content.diagnosis) return null;
    return (
      <div className="space-y-3">
        {renderTextBlock(content.diagnosis, 'diagnosis', '🔍 Diagnóstico')}
        {content.changes && content.changes.length > 0 && (
          <Card className="border-border/60">
            <CardContent className="p-4 space-y-2">
              <Badge variant="secondary" className="text-xs">📋 Mudanças Aplicadas</Badge>
              <ol className="text-xs text-foreground/80 space-y-2 list-decimal list-inside">
                {content.changes.map((c, i) => <li key={i}>{formatBoldText(c)}</li>)}
              </ol>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  const renderContent = () => {
    const section = activeSection;
    if (section === 'leituraEstrategica') return content.leituraEstrategica ? renderTextBlock(content.leituraEstrategica, 'leitura', '🎯 Leitura Estratégica') : null;
    if (section === 'ganchosVisuais') return renderVisualHooks();
    if (section === 'hooksTextuais') return renderTextualHooks();
    if (section === 'melhoresCombinacoes') return renderCombinations();
    if (section === 'diagnosis') return renderDiagnosis();
    if (section === 'improvedCopy') return content.improvedCopy ? renderTextBlock(content.improvedCopy, 'improvedCopy', '✍️ Copy Melhorada') : null;
    if (section === 'fullCopy') return content.fullCopy ? renderTextBlock(content.fullCopy, 'fullCopy', '📝 Copy Completa') : null;
    if (section === 'shortVersion') return content.shortVersion ? renderTextBlock(content.shortVersion, 'shortVersion', '📱 Versão Curta') : null;
    if (section === 'videoScript') return renderVideoScript();
    if (section === 'alternativeHooks') return content.alternativeHooks ? renderSimpleItems(content.alternativeHooks, 'altHook') : null;

    const data = content[section as keyof GeneratedContent];
    if (!data || (Array.isArray(data) && data.length === 0)) {
      return <p className="text-sm text-muted-foreground text-center py-8">Nenhum conteúdo gerado nesta categoria.</p>;
    }

    if (section === 'hooks' || section === 'ctas' || section === 'retentionPhrases') return renderSimpleItems(data as any, section);
    if (section === 'videoIdeas') return renderVideoIdeas(data as any);
    return renderApproaches(data as any, section);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">✨ Gerado por IA</Badge>
        <span className="text-xs text-muted-foreground">Hooks visuais e textuais para TikTok Shop</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {availableSections.map(s => {
          const Icon = s.icon;
          const count = s.isArray ? ((content[s.key as keyof GeneratedContent] as any[])?.length || 0) : null;
          return (
            <Button
              key={s.key}
              size="sm"
              variant={activeSection === s.key ? 'default' : 'outline'}
              onClick={() => setActiveSection(s.key)}
              className={activeSection === s.key ? 'gradient-red text-primary-foreground border-0 text-xs' : 'border-border/60 text-xs'}
            >
              <Icon className={`w-3.5 h-3.5 mr-1 ${activeSection === s.key ? '' : s.color}`} />
              {s.label}{count !== null ? ` (${count})` : ''}
            </Button>
          );
        })}
      </div>

      {renderContent()}
    </div>
  );
}
