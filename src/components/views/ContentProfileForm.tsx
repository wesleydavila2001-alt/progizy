import { useState, useRef } from 'react';
import { GeneratedContentDisplay, type GeneratedContent } from './GeneratedContentDisplay';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Camera, User, Target, Users, Compass, Sparkles, X, Loader2, Megaphone, Palette, LayoutTemplate, Package, PenLine, ImagePlus, FileText, Zap, Heart, Shield, Eye, Film, ChevronDown, UserCircle2, ShoppingBag, Settings2 } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

export interface ContentProfile {
  photos: string[];
  description: string;
  niche: string;
  audience: string;
  objective: string;
  product: string;
  channel: string;
  tone: string;
  framework: string;
  existingCopy: string;
  productPhotos: string[];
  productDetails: string;
  // New TikTok Shop visual hooks fields
  tema: string;
  estiloVisual: string;
  mecanismo: string;
  desejo: string;
  dor: string;
  objecao: string;
}

interface ContentProfileFormProps {
  profile: ContentProfile;
  onChange: (profile: ContentProfile) => void;
  onGenerate: (kind?: 'textual' | 'visual') => void;
  isGenerating: boolean;
  generatingKind?: 'textual' | 'visual' | 'improve' | null;
  textualResult?: GeneratedContent | null;
  visualResult?: GeneratedContent | null;
  onXP?: (n: number) => void;
  mode: 'generate' | 'improve';
}

const CHANNELS = ['TikTok Ads', 'TikTok Shop', 'Meta Ads', 'Reels', 'Landing Page', 'E-mail', 'WhatsApp', 'YouTube Shorts'];
const TONES = ['Agressivo', 'Leve', 'Inspiracional', 'Urgente', 'Empático', 'Técnico', 'Aspiracional'];
const FRAMEWORKS = ['AIDA', 'PAS', 'PASTOR', 'BAB', 'Hook+Prova+CTA', 'Hook+Story+Offer', '4Ps', 'FAB', 'SSS', 'APP', 'Livre'];
const VISUAL_STYLES = [
  'UGC Realista', 'Macro / Close-up', 'Antes e Depois', 'Demonstração', 'Unboxing',
  'Storytelling Visual', 'Review Autêntico', 'Comparativo', 'Cinematic', 'Lo-fi / Celular',
];

type StepKey = '1' | '2' | '3';

export function ContentProfileForm({ profile, onChange, onGenerate, isGenerating, generatingKind, textualResult, visualResult, onXP, mode }: ContentProfileFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const productFileInputRef = useRef<HTMLInputElement>(null);
  const [activeStep, setActiveStep] = useState<StepKey>('1');

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).slice(0, 4 - profile.photos.length).forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const result = ev.target?.result as string;
        if (result) onChange({ ...profile, photos: [...profile.photos, result] });
      };
      reader.readAsDataURL(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleProductPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const currentPhotos = profile.productPhotos || [];
    Array.from(files).slice(0, 4 - currentPhotos.length).forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const result = ev.target?.result as string;
        if (result) onChange({ ...profile, productPhotos: [...(profile.productPhotos || []), result] });
      };
      reader.readAsDataURL(file);
    });
    if (productFileInputRef.current) productFileInputRef.current.value = '';
  };

  const removePhoto = (index: number) => {
    onChange({ ...profile, photos: profile.photos.filter((_, i) => i !== index) });
  };

  const removeProductPhoto = (index: number) => {
    onChange({ ...profile, productPhotos: (profile.productPhotos || []).filter((_, i) => i !== index) });
  };

  const update = (field: keyof ContentProfile, value: string) => {
    onChange({ ...profile, [field]: value });
  };

  const canGenerate = mode === 'improve'
    ? !!profile.existingCopy?.trim()
    : !!(profile.niche.trim() && profile.audience.trim() && profile.objective.trim());

  const productPhotos = profile.productPhotos || [];

  const ProductPhotoSection = () => (
    <div className="space-y-2">
      <Label className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
        <ImagePlus className="w-3.5 h-3.5" /> Fotos do produto (opcional, até 4)
      </Label>
      <div className="flex flex-wrap gap-3">
        {productPhotos.map((photo, i) => (
          <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-border/60 group">
            <img src={photo} alt={`Produto ${i + 1}`} className="w-full h-full object-cover" />
            <button
              onClick={() => removeProductPhoto(i)}
              className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
        {productPhotos.length < 4 && (
          <button
            onClick={() => productFileInputRef.current?.click()}
            className="w-16 h-16 rounded-lg border-2 border-dashed border-border/60 hover:border-primary/40 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
          >
            <ImagePlus className="w-5 h-5" />
          </button>
        )}
      </div>
      <input ref={productFileInputRef} type="file" accept="image/*" multiple onChange={handleProductPhotoUpload} className="hidden" />
    </div>
  );

  const ProductDetailsSection = () => (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
        <FileText className="w-3.5 h-3.5" /> Detalhes e características únicas do produto (opcional)
      </Label>
      <Textarea
        placeholder="Descreva detalhes do seu produto: ingredientes, diferenciais, benefícios exclusivos, resultados comprovados, garantias, preço, bônus..."
        value={profile.productDetails || ''}
        onChange={e => update('productDetails', e.target.value)}
        className="bg-background border-border/60 text-sm min-h-[80px]"
        maxLength={1000}
      />
    </div>
  );

  return (
    <Card className="border-border/60 bg-card overflow-hidden">
      <CardContent className="p-0">
        {/* Sticky header */}
        <div className="sticky top-0 z-10 bg-gradient-to-b from-card via-card to-card/95 backdrop-blur border-b border-border/50 p-5 pb-4">
          <div className="flex items-start gap-3">
            <div className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${mode === 'generate' ? 'bg-primary/15 text-primary' : 'bg-amber-500/15 text-amber-400'}`}>
              {mode === 'generate' ? <Sparkles className="w-5 h-5" /> : <PenLine className="w-5 h-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-black leading-tight bg-gradient-to-r from-primary via-rose-400 to-amber-400 bg-clip-text text-transparent">
                {mode === 'generate' ? 'Gerar Hooks Visuais & Textuais para TikTok Shop' : 'Melhorar Copy Existente'}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                {mode === 'generate'
                  ? 'Preencha em 3 etapas: identidade, produto e estratégia'
                  : 'Cole sua copy e a IA vai analisar e sugerir melhorias'}
              </p>
            </div>
            {mode === 'generate' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onChange({ ...profile, photos: [], description: '', niche: '', audience: '', objective: '', product: '', tema: '', estiloVisual: '', mecanismo: '', desejo: '', dor: '', objecao: '', productPhotos: [], productDetails: '' })}
                className="shrink-0 h-8 gap-1 text-[11px] text-destructive border-destructive/30 hover:bg-destructive/10"
              >
                <X className="w-3 h-3" /> Limpar tudo
              </Button>
            )}
          </div>
        </div>

        <div className="p-5 space-y-4">
        {mode === 'generate' ? (
          <div className="space-y-4">
            {/* ============ STEP SWITCHER (1.0 / 2.0 / 3.0) ============ */}
            <div className="grid grid-cols-3 gap-2 p-1 rounded-xl bg-background/60 border border-border/60">
              {([
                { key: '1', label: 'Identidade', icon: UserCircle2 },
                { key: '2', label: 'Produto', icon: ShoppingBag },
                { key: '3', label: 'Estratégia', icon: Eye },
              ] as { key: StepKey; label: string; icon: any }[]).map(({ key, label, icon: Icon }) => {
                const active = activeStep === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveStep(key)}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                      active
                        ? 'bg-primary text-primary-foreground shadow-md'
                        : 'text-muted-foreground hover:text-foreground hover:bg-background'
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black ${active ? 'bg-primary-foreground/20' : 'bg-primary/15 text-primary'}`}>{key}</span>
                    <Icon className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                );
              })}
            </div>

            {/* ============== STEP 1 — IDENTIDADE ============== */}
            {activeStep === '1' && (
            <section className="rounded-xl border border-border/60 bg-background/40 p-4 space-y-4">
              <header className="flex items-center gap-2">
                <UserCircle2 className="w-4 h-4 text-primary" />
                <h4 className="text-sm font-bold text-foreground">Identidade do criador</h4>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onChange({ ...profile, photos: [], description: '' })}
                  className="ml-auto h-6 gap-1 text-[10px] text-muted-foreground hover:text-destructive hover:bg-destructive/10 px-2"
                >
                  <X className="w-3 h-3" /> Limpar
                </Button>
              </header>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5" /> Fotos do perfil <span className="text-muted-foreground font-normal">(opcional, até 4)</span>
                </Label>
                <div className="flex flex-wrap gap-3">
                  {profile.photos.map((photo, i) => (
                    <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-border/60 group">
                      <img src={photo} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                      <button
                        onClick={() => removePhoto(i)}
                        className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {profile.photos.length < 4 && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-16 h-16 rounded-lg border-2 border-dashed border-border/60 hover:border-primary/40 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
                    >
                      <Camera className="w-5 h-5" />
                    </button>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handlePhotoUpload} className="hidden" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" /> Descrição do perfil
                </Label>
                <Textarea
                  placeholder="Descreva seu perfil, estilo de conteúdo, personalidade..."
                  value={profile.description}
                  onChange={e => update('description', e.target.value)}
                  className="bg-background border-border/60 text-sm min-h-[70px]"
                  maxLength={500}
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button size="sm" variant="outline" onClick={() => setActiveStep('2')} className="gap-1 text-xs">
                  Próximo: Produto →
                </Button>
              </div>
            </section>
            )}

            {/* ============== STEP 2 — PRODUTO ============== */}
            {activeStep === '2' && (
            <section className="rounded-xl border border-border/60 bg-background/40 p-4 space-y-4">
              <header className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-primary" />
                <h4 className="text-sm font-bold text-foreground">Produto e oferta</h4>
                <Badge variant="destructive" className="ml-auto text-[9px] px-1.5 py-0">campos obrigatórios</Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onChange({ ...profile, niche: '', product: '', tema: '', audience: '', objective: '', productPhotos: [], productDetails: '' })}
                  className="h-6 gap-1 text-[10px] text-muted-foreground hover:text-destructive hover:bg-destructive/10 px-2"
                >
                  <X className="w-3 h-3" /> Limpar
                </Button>
              </header>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5" /> Nicho <span className="text-destructive">*</span>
                  </Label>
                  <Input placeholder="Ex: fitness, beleza, utilidade doméstica..." value={profile.niche} onChange={e => update('niche', e.target.value)} className="bg-background border-border/60 text-sm" maxLength={100} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5" /> Produto/Serviço
                  </Label>
                  <Input placeholder="Ex: suplemento barriga, escova alisadora..." value={profile.product} onChange={e => update('product', e.target.value)} className="bg-background border-border/60 text-sm" maxLength={200} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
                  <Film className="w-3.5 h-3.5" /> Tema do vídeo
                </Label>
                <Input placeholder="Ex: 12kg em 30 dias, pele de porcelana em 7 dias..." value={profile.tema || ''} onChange={e => update('tema', e.target.value)} className="bg-background border-border/60 text-sm" maxLength={200} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" /> Público-alvo <span className="text-destructive">*</span>
                  </Label>
                  <Input placeholder="Ex: homens 25-40, mulheres acima de 30..." value={profile.audience} onChange={e => update('audience', e.target.value)} className="bg-background border-border/60 text-sm" maxLength={200} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5" /> Objetivo <span className="text-destructive">*</span>
                  </Label>
                  <Input placeholder="Ex: vender no TikTok Shop, gerar leads..." value={profile.objective} onChange={e => update('objective', e.target.value)} className="bg-background border-border/60 text-sm" maxLength={200} />
                </div>
              </div>

              <ProductPhotoSection />
              <ProductDetailsSection />

              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <Button size="sm" variant="ghost" onClick={() => setActiveStep('1')} className="gap-1 text-xs sm:mr-auto">← Identidade</Button>
                <Button
                  onClick={() => onGenerate('textual')}
                  disabled={!canGenerate || isGenerating}
                  className="gradient-red text-primary-foreground border-0 font-bold gap-2"
                >
                  {generatingKind === 'textual' ? <Loader2 className="w-4 h-4 animate-spin" /> : <PenLine className="w-4 h-4" />}
                  {generatingKind === 'textual' ? 'Gerando...' : 'Gerar Textuais com IA'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setActiveStep('3')} className="gap-1 text-xs">Próximo: Estratégia →</Button>
              </div>

              {textualResult && (
                <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    <h5 className="text-sm font-bold text-emerald-400">Resultado Textual Gerado</h5>
                  </div>
                  <GeneratedContentDisplay content={textualResult} onXP={onXP} />
                </div>
              )}
            </section>
            )}
            {activeStep === '3' && (
            <section className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
              <header className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-primary" />
                <h4 className="text-sm font-bold text-primary flex-1">Estratégia para Hooks Visuais 3s</h4>
                <Badge className="text-[9px] px-1.5 py-0 bg-primary/20 text-primary border-primary/30 hover:bg-primary/20">recomendado</Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onChange({ ...profile, estiloVisual: '', mecanismo: '', desejo: '', dor: '', objecao: '' })}
                  className="h-6 gap-1 text-[10px] text-muted-foreground hover:text-destructive hover:bg-destructive/10 px-2"
                >
                  <X className="w-3 h-3" /> Limpar
                </Button>
              </header>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5" /> Estilo visual
                  </Label>
                  <Select value={profile.estiloVisual || ''} onValueChange={v => update('estiloVisual', v)}>
                    <SelectTrigger className="bg-background border-border/60 text-sm"><SelectValue placeholder="Selecione o estilo..." /></SelectTrigger>
                    <SelectContent>{VISUAL_STYLES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5" /> Mecanismo / Promessa
                  </Label>
                  <Input placeholder="Ex: termogênico que queima gordura..." value={profile.mecanismo || ''} onChange={e => update('mecanismo', e.target.value)} className="bg-background border-border/60 text-sm" maxLength={300} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
                    <Heart className="w-3.5 h-3.5 text-rose-400" /> Desejo
                  </Label>
                  <Input placeholder="Ex: barriga chapada..." value={profile.desejo || ''} onChange={e => update('desejo', e.target.value)} className="bg-background border-border/60 text-sm" maxLength={150} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-amber-400" /> Dor
                  </Label>
                  <Input placeholder="Ex: vergonha na praia..." value={profile.dor || ''} onChange={e => update('dor', e.target.value)} className="bg-background border-border/60 text-sm" maxLength={150} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-cyan-400" /> Objeção
                  </Label>
                  <Input placeholder="Ex: já tentei de tudo..." value={profile.objecao || ''} onChange={e => update('objecao', e.target.value)} className="bg-background border-border/60 text-sm" maxLength={150} />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <Button size="sm" variant="ghost" onClick={() => setActiveStep('2')} className="gap-1 text-xs sm:mr-auto">← Produto</Button>
                <Button
                  onClick={() => onGenerate('visual')}
                  disabled={!canGenerate || isGenerating}
                  className="gradient-red text-primary-foreground border-0 font-bold gap-2"
                >
                  {generatingKind === 'visual' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                  {generatingKind === 'visual' ? 'Gerando...' : 'Gerar Hooks Visuais 3s com IA'}
                </Button>
              </div>

              {visualResult && (
                <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-primary" />
                    <h5 className="text-sm font-bold text-primary">Resultado Hooks Visuais 3s</h5>
                  </div>
                  <GeneratedContentDisplay content={visualResult} onXP={onXP} />
                </div>
              )}
            </section>
            )}
            <Collapsible className="rounded-xl border border-border/60 bg-background/40 overflow-hidden">
              <CollapsibleTrigger className="w-full p-4 flex items-center gap-2 hover:bg-background/60 transition-colors group">
                <Settings2 className="w-4 h-4 text-muted-foreground" />
                <h4 className="text-sm font-bold text-foreground text-left flex-1">Configurações avançadas</h4>
                <span className="text-[10px] text-muted-foreground">canal, tom, framework</span>
                <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="px-4 pb-4 pt-3 border-t border-border/60">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5"><Megaphone className="w-3.5 h-3.5" /> Canal</Label>
                    <Select value={profile.channel} onValueChange={v => update('channel', v)}>
                      <SelectTrigger className="bg-background border-border/60 text-sm"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>{CHANNELS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5"><Palette className="w-3.5 h-3.5" /> Tom</Label>
                    <Select value={profile.tone} onValueChange={v => update('tone', v)}>
                      <SelectTrigger className="bg-background border-border/60 text-sm"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>{TONES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5"><LayoutTemplate className="w-3.5 h-3.5" /> Framework</Label>
                    <Select value={profile.framework} onValueChange={v => update('framework', v)}>
                      <SelectTrigger className="bg-background border-border/60 text-sm"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>{FRAMEWORKS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
                <PenLine className="w-3.5 h-3.5" /> Cole sua copy aqui <Badge variant="destructive" className="text-[9px] px-1.5 py-0">obrigatório</Badge>
              </Label>
              <Textarea
                placeholder="Cole aqui a copy que você deseja melhorar..."
                value={profile.existingCopy}
                onChange={e => update('existingCopy', e.target.value)}
                className="bg-background border-border/60 text-sm min-h-[120px]"
                maxLength={2000}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5" /> Nome do Produto (opcional)
              </Label>
              <Input placeholder="Ex: Método XYZ, Curso Acelerador, Suplemento Vita..." value={profile.product} onChange={e => update('product', e.target.value)} className="bg-background border-border/60 text-sm" maxLength={200} />
            </div>

            <ProductPhotoSection />
            <ProductDetailsSection />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground/80">Nicho (opcional)</Label>
                <Input placeholder="Ex: fitness, finanças..." value={profile.niche} onChange={e => update('niche', e.target.value)} className="bg-background border-border/60 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground/80">Público (opcional)</Label>
                <Input placeholder="Ex: jovens 18-25..." value={profile.audience} onChange={e => update('audience', e.target.value)} className="bg-background border-border/60 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground/80">Tom (opcional)</Label>
                <Select value={profile.tone} onValueChange={v => update('tone', v)}>
                  <SelectTrigger className="bg-background border-border/60 text-sm"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{TONES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {mode === 'improve' && (
          <Button
            onClick={() => onGenerate()}
            disabled={!canGenerate || isGenerating}
            className="w-full gradient-red text-primary-foreground border-0 font-bold"
            size="lg"
          >
            {isGenerating ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analisando e melhorando...</>
            ) : (
              <><Sparkles className="w-4 h-4 mr-2" />Melhorar Minha Copy</>
            )}
          </Button>
        )}
        </div>
      </CardContent>
    </Card>
  );
}
