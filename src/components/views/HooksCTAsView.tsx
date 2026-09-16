import { useState, useMemo, useCallback } from 'react';
import { Copy, Heart, Search, Sparkles, MessageSquareText, Target, TrendingUp, DollarSign, ShoppingCart, Zap, Eye, Award, Flame, AlertTriangle, Lightbulb, Unlock, Clock, ChevronDown, ChevronUp, BookOpen, PenLine, Film, MessageSquare, AlertCircle, Compass, Users, Palette, LayoutTemplate, Package, Loader2, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ContentProfileForm, type ContentProfile } from './ContentProfileForm';
import { GeneratedContentDisplay, type GeneratedContent } from './GeneratedContentDisplay';
import { supabase } from '@/integrations/supabase/client';
import { BibliaLibraryTab } from './BibliaLibraryTab';

type HookCategory =
  | 'hooks-crescimento'
  | 'hooks-monetizacao'
  | 'hooks-vendas'
  | 'ctas-engajamento'
  | 'ctas-conversao'
  | 'estruturas-video'
  | 'frases-retencao'
  | 'frases-curiosidade'
  | 'frases-prova-social';

type CTASubcategory = 'curiosidade' | 'revelacao' | 'dor' | 'urgencia' | 'autoridade' | 'transformacao';

interface HookItem {
  id: string;
  title: string;
  text: string;
  category: HookCategory;
  objective: string;
  observation?: string;
  subcategory?: CTASubcategory;
  nicheTemplate?: boolean;
}

const CTA_SUBCATEGORIES: { id: CTASubcategory; label: string; icon: React.ElementType; color: string; gradient: string }[] = [
  { id: 'curiosidade', label: 'Curiosidade', icon: Zap, color: 'text-yellow-400', gradient: 'from-yellow-500/20 to-amber-500/10' },
  { id: 'revelacao', label: 'Revelação', icon: Lightbulb, color: 'text-cyan-400', gradient: 'from-cyan-500/20 to-blue-500/10' },
  { id: 'dor', label: 'Dor', icon: AlertTriangle, color: 'text-rose-400', gradient: 'from-rose-500/20 to-red-500/10' },
  { id: 'urgencia', label: 'Urgência', icon: Clock, color: 'text-orange-400', gradient: 'from-orange-500/20 to-amber-500/10' },
  { id: 'autoridade', label: 'Autoridade', icon: Award, color: 'text-emerald-400', gradient: 'from-emerald-500/20 to-green-500/10' },
  { id: 'transformacao', label: 'Transformação', icon: Unlock, color: 'text-violet-400', gradient: 'from-violet-500/20 to-purple-500/10' },
];

const NICHES = [
  'Fitness', 'Finanças', 'Marketing Digital', 'Beleza', 'Culinária',
  'Tecnologia', 'Moda', 'Educação', 'Saúde', 'Empreendedorismo',
  'Games', 'Viagens', 'Desenvolvimento Pessoal', 'Relacionamentos', 'Música',
  'Direito', 'Arquitetura', 'Psicologia', 'Nutrição', 'Fotografia',
  'Design', 'Imóveis', 'Automotivo', 'Pets', 'Maternidade',
  'Espiritualidade', 'Produtividade', 'Investimentos', 'E-commerce', 'Dropshipping',
];

const STORYTELLING_CHANNELS = ['TikTok Ads', 'Meta Ads', 'Reels', 'VSL', 'Landing Page', 'E-mail', 'YouTube Shorts'];
const STORYTELLING_TONES = ['Empático', 'Urgente', 'Inspiracional', 'Vulnerável', 'Direto', 'Aspiracional', 'Técnico'];
const STORYTELLING_FRAMEWORKS: { id: string; description: string }[] = [
  { id: "Hero's Journey", description: 'Herói chamado à aventura → conflito → transformação → retorno vitorioso' },
  { id: 'StoryBrand', description: 'Cliente como herói → problema → guia (marca) → plano → CTA → sucesso' },
  { id: 'Epiphany Bridge', description: 'Antes → evento revelador → descoberta → nova identidade → oferta natural' },
  { id: 'BAB', description: 'Before (antes) → After (depois) → Bridge (o que tornou possível)' },
  { id: 'SSS', description: 'Star (personagem) → Story (conflito real) → Solution (solução)' },
  { id: 'PAS Narrativo', description: 'Problema real → aprofunda dor com emoção → história de virada → solução' },
  { id: 'Sparkline', description: 'Realidade atual ↔ mundo possível → alternância cria tensão → CTA' },
  { id: 'Pixar Story Spine', description: 'Era uma vez... / Todo dia... / Até que um dia... / Por causa disso... / Até que finalmente...' },
  { id: 'Jornada do Cliente', description: 'Dor máxima → decisão → primeira ação → resultado → nova identidade' },
  { id: 'Livre', description: 'A IA escolhe o framework mais adequado para seu nicho e produto' },
];

const STORY_TYPES_DATA = [
  { id: 'Origem', description: 'Como tudo começou — sua jornada de fundação', example: '"Eu era um professor frustrado ganhando R$2.500. Até que um dia..."', color: 'text-violet-400', border: 'border-violet-500/30', bg: 'bg-violet-500/5' },
  { id: 'Falha e Virada', description: 'Um momento de fracasso que levou à grande transformação', example: '"Perdi tudo aos 30. Minha empresa faliu e eu voltei pra casa dos meus pais..."', color: 'text-rose-400', border: 'border-rose-500/30', bg: 'bg-rose-500/5' },
  { id: 'Cliente', description: 'A história de sucesso real de um cliente', example: '"A Maria chegou pesando 90kg, sem energia, quase desistindo..."', color: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/5' },
  { id: 'Inimigo Comum', description: 'Una seu público contra um problema/vilão compartilhado', example: '"A indústria alimentícia não quer que você saiba disso..."', color: 'text-orange-400', border: 'border-orange-500/30', bg: 'bg-orange-500/5' },
  { id: 'Descoberta', description: 'O momento da revelação que mudou tudo', example: '"Depois de 3 anos tentando, descobri um método que ninguém ensina..."', color: 'text-cyan-400', border: 'border-cyan-500/30', bg: 'bg-cyan-500/5' },
  { id: 'Missão', description: 'Sua missão maior — o porquê do que você faz', example: '"Minha missão é fazer 10.000 famílias terem liberdade financeira..."', color: 'text-amber-400', border: 'border-amber-500/30', bg: 'bg-amber-500/5' },
  { id: 'Prova', description: 'Evidências concretas de que seu método funciona', example: '"427 alunos. 89% tiveram resultado em 30 dias. Os números não mentem."', color: 'text-sky-400', border: 'border-sky-500/30', bg: 'bg-sky-500/5' },
  { id: 'Identidade', description: 'Faça o público se ver como parte de um grupo', example: '"Se você é do tipo que acorda às 5h, esse conteúdo é pra você..."', color: 'text-pink-400', border: 'border-pink-500/30', bg: 'bg-pink-500/5' },
  { id: 'Contraste', description: 'Compare o antes e depois de forma impactante', example: '"Há 1 ano eu nem sabia o que era tráfego pago. Hoje faturo 6 dígitos."', color: 'text-indigo-400', border: 'border-indigo-500/30', bg: 'bg-indigo-500/5' },
  { id: 'Futuro', description: 'Pinte o futuro ideal que seu público deseja', example: '"Imagine acordar sem despertador, abrindo o notebook à beira da piscina..."', color: 'text-teal-400', border: 'border-teal-500/30', bg: 'bg-teal-500/5' },
];

const normalizeStoryType = (value: string) =>
  value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

const CATEGORIES: { id: HookCategory; label: string; icon: React.ElementType; color: string; titleColor: string }[] = [
  { id: 'hooks-crescimento', label: 'Hooks Crescimento', icon: TrendingUp, color: 'text-emerald-400', titleColor: 'text-emerald-400' },
  { id: 'hooks-monetizacao', label: 'Hooks Monetização', icon: DollarSign, color: 'text-amber-400', titleColor: 'text-amber-400' },
  { id: 'hooks-vendas', label: 'Hooks Vendas', icon: ShoppingCart, color: 'text-primary', titleColor: 'text-primary' },
  { id: 'ctas-engajamento', label: 'CTAs Engajamento', icon: MessageSquareText, color: 'text-sky-400', titleColor: 'text-sky-400' },
  { id: 'ctas-conversao', label: 'CTAs Conversão', icon: Target, color: 'text-rose-400', titleColor: 'text-rose-400' },
  { id: 'estruturas-video', label: 'Estruturas de Vídeo', icon: Sparkles, color: 'text-violet-400', titleColor: 'text-violet-400' },
  { id: 'frases-retencao', label: 'Frases Retenção', icon: Eye, color: 'text-cyan-400', titleColor: 'text-cyan-400' },
  { id: 'frases-curiosidade', label: 'Frases Curiosidade', icon: Zap, color: 'text-yellow-400', titleColor: 'text-yellow-400' },
  { id: 'frases-prova-social', label: 'Frases Prova Social', icon: Award, color: 'text-emerald-400', titleColor: 'text-emerald-400' },
];

const PRESET_ITEMS: HookItem[] = [
  { id: 'h1', title: 'Erro Fatal', text: 'Se você faz isso no TikTok, está perdendo seguidores todos os dias...', category: 'hooks-crescimento', objective: 'Parar o scroll e gerar curiosidade', observation: 'Funciona muito bem nos primeiros 2 segundos' },
  { id: 'h2', title: 'Revelação', text: 'Ninguém te conta isso, mas é assim que os creators crescem rápido...', category: 'hooks-crescimento', objective: 'Gerar autoridade e curiosidade' },
  { id: 'h3', title: 'Desafio Direto', text: 'Eu aposto que você não sabia disso sobre o algoritmo...', category: 'hooks-crescimento', objective: 'Provocar e engajar' },
  { id: 'h4', title: 'Prova Rápida', text: 'Ganhei 10k seguidores em 7 dias fazendo isso...', category: 'hooks-crescimento', objective: 'Mostrar resultado real' },
  { id: 'h5', title: 'Dinheiro com TikTok', text: 'Fiz R$ 5.000 em uma semana usando só o TikTok. Vou te mostrar como.', category: 'hooks-monetizacao', objective: 'Gerar interesse em monetização' },
  { id: 'h6', title: 'Renda Extra', text: 'Se você tem mais de 1.000 seguidores, está sentado em cima de dinheiro...', category: 'hooks-monetizacao', objective: 'Despertar ganância e ação' },
  { id: 'h7', title: 'Método Simples', text: 'Essa é a forma mais simples de ganhar dinheiro com conteúdo em 2026...', category: 'hooks-monetizacao', objective: 'Simplificar a monetização' },
  { id: 'h8', title: 'Produto Viral', text: 'Esse produto vendeu 1.000 unidades em 24h no TikTok Shop...', category: 'hooks-vendas', objective: 'Gerar urgência de compra' },
  { id: 'h9', title: 'Oferta Irresistível', text: 'Para de scrollar! Essa oferta acaba hoje e você precisa ver...', category: 'hooks-vendas', objective: 'Criar urgência', observation: 'Usar com countdown visual' },
  { id: 'h10', title: 'Prova de Resultado', text: 'Meus clientes estão tendo ESSES resultados. E o próximo pode ser você.', category: 'hooks-vendas', objective: 'Social proof + vendas' },
  { id: 'c1', title: 'Comenta Aqui', text: 'Comenta "EU QUERO" que eu te mando no privado!', category: 'ctas-engajamento', objective: 'Gerar comentários' },
  { id: 'c2', title: 'Salva esse vídeo', text: 'Salva esse vídeo pra não esquecer. Você vai precisar.', category: 'ctas-engajamento', objective: 'Gerar salvamentos' },
  { id: 'c3', title: 'Manda pra alguém', text: 'Marca aquele amigo que precisa ver isso urgente!', category: 'ctas-engajamento', objective: 'Gerar compartilhamentos' },
  { id: 'c4', title: 'Qual você prefere?', text: 'Opção A ou Opção B? Comenta aqui qual você escolhe!', category: 'ctas-engajamento', objective: 'Gerar interação via escolha' },
  { id: 'c5', title: 'Link na Bio', text: 'Clica no link da bio e garante o seu antes que acabe!', category: 'ctas-conversao', objective: 'Direcionar para compra' },
  { id: 'c6', title: 'DM para Acesso', text: 'Me manda "ACESSO" no direct que eu te envio o material completo.', category: 'ctas-conversao', objective: 'Gerar leads via DM' },
  { id: 'c7', title: 'Últimas Vagas', text: 'Só restam 3 vagas. Se você está vendo isso, ainda dá tempo. Link na bio.', category: 'ctas-conversao', objective: 'Criar escassez', observation: 'Usar com timer ou contador' },
  { id: 'e1', title: 'Problema → Solução', text: '1. Apresente o problema (2s)\n2. Agite a dor (3s)\n3. Mostre a solução (5s)\n4. CTA forte (2s)', category: 'estruturas-video', objective: 'Vídeo de conversão rápida' },
  { id: 'e2', title: 'Lista de 3', text: '1. Hook impactante\n2. Dica 1 (rápida)\n3. Dica 2 (valor)\n4. Dica 3 (surpreendente)\n5. CTA', category: 'estruturas-video', objective: 'Vídeo educativo viral' },
  { id: 'e3', title: 'Storytelling', text: '1. Situação inicial\n2. Conflito/problema\n3. Virada/descoberta\n4. Resultado\n5. Lição + CTA', category: 'estruturas-video', objective: 'Gerar conexão emocional' },
  { id: 'r1', title: 'Espera até o final', text: 'Mas espera, o melhor ainda está por vir...', category: 'frases-retencao', objective: 'Manter no vídeo' },
  { id: 'r2', title: 'Não sai ainda', text: 'Se você sair agora, vai perder a parte mais importante...', category: 'frases-retencao', objective: 'Aumentar watch time' },
  { id: 'r3', title: 'Plot Twist', text: 'E quando eu achei que não ia funcionar... aconteceu isso.', category: 'frases-retencao', objective: 'Criar suspense' },
  { id: 'cu1', title: 'Segredo Revelado', text: 'Eu não deveria estar te contando isso, mas...', category: 'frases-curiosidade', objective: 'Gerar exclusividade' },
  { id: 'cu2', title: 'Descoberta Recente', text: 'Descobri algo que muda tudo que você sabia sobre...', category: 'frases-curiosidade', objective: 'Quebrar crenças' },
  { id: 'cu3', title: 'O que ninguém fala', text: 'Todo mundo fala de X, mas ninguém menciona Y...', category: 'frases-curiosidade', objective: 'Posicionar como diferente' },
  { id: 'ps1', title: 'Resultado de Aluno', text: 'Meu aluno aplicou isso e em 30 dias saiu de 0 para 50k seguidores...', category: 'frases-prova-social', objective: 'Validar método' },
  { id: 'ps2', title: 'Números Reais', text: 'Mais de 2.000 pessoas já usaram esse método. Os resultados falam por si.', category: 'frases-prova-social', objective: 'Gerar confiança com volume' },
  { id: 'ps3', title: 'Depoimento', text: '"Eu não acreditava, mas em 2 semanas já tinha resultado." — @usuario', category: 'frases-prova-social', objective: 'Prova social direta' },
];

function generateNicheCTAs(nicho: string): HookItem[] {
  return [
    { id: `n-cur-1`, title: 'Segredo do Nicho', text: `Você não vai acreditar no que eu descobri sobre ${nicho}...`, category: 'ctas-engajamento', objective: 'Gerar curiosidade sobre o nicho', subcategory: 'curiosidade', nicheTemplate: true },
    { id: `n-cur-2`, title: 'Ninguém Sabe', text: `99% das pessoas de ${nicho} não sabem disso. E você?`, category: 'ctas-engajamento', objective: 'Provocar e gerar cliques', subcategory: 'curiosidade', nicheTemplate: true },
    { id: `n-cur-3`, title: 'Pergunta Matadora', text: `Se você trabalha com ${nicho}, me responde: por que ninguém fala sobre isso?`, category: 'ctas-engajamento', objective: 'Gerar comentários por curiosidade', subcategory: 'curiosidade', nicheTemplate: true },
    { id: `n-cur-4`, title: 'Teste Rápido', text: `Faça esse teste de 10 segundos e descubra seu nível em ${nicho}...`, category: 'ctas-engajamento', objective: 'Gerar interação gamificada', subcategory: 'curiosidade', nicheTemplate: true },
    { id: `n-cur-5`, title: 'Erro Invisível', text: `Tem um erro em ${nicho} que 90% das pessoas cometem sem perceber. Será que você comete?`, category: 'hooks-crescimento', objective: 'Ativar medo + curiosidade', subcategory: 'curiosidade', nicheTemplate: true },
    { id: `n-rev-1`, title: 'A Verdade Sobre', text: `A verdade sobre ${nicho} que ninguém tem coragem de falar...`, category: 'frases-curiosidade', objective: 'Quebrar mitos do nicho', subcategory: 'revelacao', nicheTemplate: true },
    { id: `n-rev-2`, title: 'Método Oculto', text: `Existe um método de ${nicho} que os top players usam e nunca compartilham.`, category: 'frases-curiosidade', objective: 'Posicionar como insider', subcategory: 'revelacao', nicheTemplate: true },
    { id: `n-rev-3`, title: 'Bastidores', text: `Vou te mostrar os bastidores de ${nicho} — prepare-se.`, category: 'frases-curiosidade', objective: 'Gerar expectativa de conteúdo exclusivo', subcategory: 'revelacao', nicheTemplate: true },
    { id: `n-rev-4`, title: 'Mito Derrubado', text: `Tudo que te ensinaram sobre ${nicho} está errado. Vou provar agora.`, category: 'frases-curiosidade', objective: 'Quebrar crença + autoridade', subcategory: 'revelacao', nicheTemplate: true },
    { id: `n-rev-5`, title: 'Confissão', text: `Eu trabalhei anos em ${nicho} e nunca contei isso pra ninguém. Até agora.`, category: 'frases-curiosidade', objective: 'Gerar exclusividade e intimidade', subcategory: 'revelacao', nicheTemplate: true },
    { id: `n-dor-1`, title: 'Erro que Dói', text: `Se você está em ${nicho} e faz isso, está se sabotando...`, category: 'hooks-crescimento', objective: 'Ativar dor e medo de perda', subcategory: 'dor', nicheTemplate: true },
    { id: `n-dor-2`, title: 'Frustração Real', text: `Cansado de não ter resultado em ${nicho}? O problema não é você...`, category: 'hooks-crescimento', objective: 'Gerar identificação com a frustração', subcategory: 'dor', nicheTemplate: true },
    { id: `n-dor-3`, title: 'Tempo Perdido', text: `Quanto tempo você já perdeu em ${nicho} sem ver resultado?`, category: 'hooks-crescimento', objective: 'Provocar reflexão sobre perda', subcategory: 'dor', nicheTemplate: true },
    { id: `n-dor-4`, title: 'Comparação Dolorosa', text: `Enquanto você tenta sozinho em ${nicho}, outros estão lucrando com esse método...`, category: 'hooks-monetizacao', objective: 'Gerar inveja positiva e ação', subcategory: 'dor', nicheTemplate: true },
    { id: `n-dor-5`, title: 'Ciclo Vicioso', text: `Você estuda ${nicho}, aplica, não funciona, desiste... e recomeça. Quer sair desse ciclo?`, category: 'hooks-crescimento', objective: 'Identificação profunda com a jornada', subcategory: 'dor', nicheTemplate: true },
    { id: `n-urg-1`, title: 'Agora ou Nunca', text: `Se você é de ${nicho}, precisa fazer isso HOJE. Amanhã pode ser tarde.`, category: 'ctas-conversao', objective: 'Criar senso de urgência', subcategory: 'urgencia', nicheTemplate: true },
    { id: `n-urg-2`, title: 'Janela Fechando', text: `Essa oportunidade em ${nicho} está acabando. Não perca.`, category: 'ctas-conversao', objective: 'Gerar ação imediata', subcategory: 'urgencia', nicheTemplate: true },
    { id: `n-urg-3`, title: 'Última Chance', text: `Quem não se adaptar agora em ${nicho} vai ficar pra trás. É sério.`, category: 'ctas-conversao', objective: 'Medo de ficar obsoleto', subcategory: 'urgencia', nicheTemplate: true },
    { id: `n-urg-4`, title: 'Contagem Regressiva', text: `Em 48h essa estratégia de ${nicho} vai explodir. Quem chegar primeiro leva.`, category: 'ctas-conversao', objective: 'FOMO + exclusividade temporal', subcategory: 'urgencia', nicheTemplate: true },
    { id: `n-urg-5`, title: 'Alerta de Tendência', text: `${nicho} está mudando AGORA. Se você não acompanhar, vai ficar invisível.`, category: 'hooks-crescimento', objective: 'Urgência por mudança de mercado', subcategory: 'urgencia', nicheTemplate: true },
    { id: `n-aut-1`, title: 'Experiência Comprovada', text: `Depois de anos em ${nicho}, posso te dizer: esse é o caminho.`, category: 'frases-prova-social', objective: 'Demonstrar expertise', subcategory: 'autoridade', nicheTemplate: true },
    { id: `n-aut-2`, title: 'Resultado Real', text: `Meus alunos de ${nicho} estão faturando. Quer saber como?`, category: 'frases-prova-social', objective: 'Validar com resultados de terceiros', subcategory: 'autoridade', nicheTemplate: true },
    { id: `n-aut-3`, title: 'Mentor Reconhecido', text: `Já ajudei mais de 500 pessoas em ${nicho}. Esse é o conselho que eu daria pra mim no início.`, category: 'frases-prova-social', objective: 'Autoridade por volume', subcategory: 'autoridade', nicheTemplate: true },
    { id: `n-aut-4`, title: 'Caso de Sucesso', text: `Um dos meus mentorados de ${nicho} saiu do zero e hoje fatura 6 dígitos. O que ele fez:`, category: 'frases-prova-social', objective: 'Prova social + storytelling', subcategory: 'autoridade', nicheTemplate: true },
    { id: `n-trans-1`, title: 'Antes e Depois', text: `Antes eu sofria em ${nicho}. Hoje eu domino. Quer saber o que mudou?`, category: 'hooks-crescimento', objective: 'Gerar curiosidade pela jornada', subcategory: 'transformacao', nicheTemplate: true },
    { id: `n-trans-2`, title: 'Virada de Chave', text: `Esse único conselho mudou minha carreira em ${nicho}. Assiste até o final.`, category: 'hooks-crescimento', objective: 'Reter até o final', subcategory: 'transformacao', nicheTemplate: true },
    { id: `n-trans-3`, title: 'De Zero a Pro', text: `Saí do zero em ${nicho} e em 6 meses já vivia disso. O segredo:`, category: 'hooks-monetizacao', objective: 'Inspirar e gerar desejo', subcategory: 'transformacao', nicheTemplate: true },
    { id: `n-trans-4`, title: 'Ponto de Virada', text: `Eu quase desisti de ${nicho}. Até que descobri isso e tudo mudou.`, category: 'hooks-crescimento', objective: 'Storytelling + conexão emocional', subcategory: 'transformacao', nicheTemplate: true },
    { id: `n-trans-5`, title: 'Evolução Visível', text: `Meu primeiro conteúdo de ${nicho} era horrível. Olha onde cheguei. A diferença:`, category: 'hooks-crescimento', objective: 'Humanizar + inspirar iniciantes', subcategory: 'transformacao', nicheTemplate: true },
  ];
}

interface HooksCTAsViewProps {
  onXP?: (amount: number) => void;
}

export function HooksCTAsView({ onXP }: HooksCTAsViewProps) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<HookCategory | 'all'>('all');
  const [activeSubcategory, setActiveSubcategory] = useState<CTASubcategory | 'all'>('all');
  const [selectedNiche, setSelectedNiche] = useState('');
  const [customNiche, setCustomNiche] = useState('');
  const [showNicheSelector, setShowNicheSelector] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('progcontrol-hooks-favs');
      return saved ? new Set(JSON.parse(saved)) : new Set<string>();
    } catch { return new Set<string>(); }
  });
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  const defaultProfile: ContentProfile = { photos: [], description: '', niche: '', audience: '', objective: '', product: '', channel: '', tone: '', framework: '', existingCopy: '', productPhotos: [], productDetails: '', tema: '', estiloVisual: '', mecanismo: '', desejo: '', dor: '', objecao: '' };
  const [contentProfile, setContentProfile] = useState<ContentProfile>(() => {
    try {
      const saved = localStorage.getItem('progcontrol-content-profile');
      return saved ? { ...defaultProfile, ...JSON.parse(saved) } : defaultProfile;
    } catch { return defaultProfile; }
  });
  const [generatedTextual, setGeneratedTextual] = useState<GeneratedContent | null>(() => {
    try { const s = localStorage.getItem('progcontrol-generated-textual'); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  const [generatedVisual, setGeneratedVisual] = useState<GeneratedContent | null>(() => {
    try { const s = localStorage.getItem('progcontrol-generated-visual'); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  const [generatedImprove, setGeneratedImprove] = useState<GeneratedContent | null>(() => {
    try { const s = localStorage.getItem('progcontrol-generated-improve'); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  const [generatingKind, setGeneratingKind] = useState<'textual' | 'visual' | 'improve' | null>(null);
  const isGenerating = generatingKind !== null;
  const [mainTab, setMainTab] = useState<string>('ai-generator');

  // Storytelling state
  const [stMode, setStMode] = useState<'generate' | 'improve'>('generate');
  const [stForm, setStForm] = useState(() => {
    try { const s = localStorage.getItem('progcontrol-st-form'); return s ? JSON.parse(s) : { niche: '', product: '', audience: '', channel: '', tone: '', framework: '', storyType: '', existingStory: '' }; }
    catch { return { niche: '', product: '', audience: '', channel: '', tone: '', framework: '', storyType: '', existingStory: '' }; }
  });
  const [stResult, setStResult] = useState<any>(() => {
    try { const s = localStorage.getItem('progcontrol-st-result'); return s ? JSON.parse(s) : null; }
    catch { return null; }
  });
  const [stGenerating, setStGenerating] = useState(false);
  const [stCopiedId, setStCopiedId] = useState<string | null>(null);
  const [stRecommended, setStRecommended] = useState<{ type: string; reason: string } | null>(null);
  const [stRecommending, setStRecommending] = useState(false);

  const stUpdate = (field: string, value: string) => {
    setStForm((f: any) => {
      const next = { ...f, [field]: value };
      localStorage.setItem('progcontrol-st-form', JSON.stringify(next));
      return next;
    });
  };

  // Fetch AI recommendation on demand (button click)
  const handleRecommend = useCallback(async () => {
    const niche = stForm.niche.trim();
    const product = stForm.product.trim();
    if (!niche || !product) { toast.error('Preencha nicho e produto para receber recomendação.'); return; }
    setStRecommending(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-storytelling', {
        body: { niche, product, audience: stForm.audience, mode: 'recommend' },
      });
      if (error) {
        const msg = error.message || '';
        if (msg.includes('402')) { toast.error('Créditos de IA insuficientes. Adicione créditos em Settings → Workspace → Usage.'); return; }
        if (msg.includes('429')) { toast.error('Muitas requisições. Aguarde.'); return; }
        throw error;
      }
      if (data?.error) {
        if (data.error.includes('402') || data.error.includes('Créditos')) { toast.error('Créditos de IA insuficientes.'); return; }
        toast.error(data.error); return;
      }
      if (data?.recommendedType) {
        const matchedType = STORY_TYPES_DATA.find((item) => normalizeStoryType(data.recommendedType).includes(normalizeStoryType(item.id)))?.id ?? data.recommendedType;
        setStRecommended({ type: matchedType, reason: data.reason || '' });
        stUpdate('storyType', matchedType);
        toast.success('Recomendação gerada!');
      }
    } catch { toast.error('Erro ao buscar recomendação.'); }
    finally { setStRecommending(false); }
  }, [stForm.niche, stForm.product, stForm.audience]);

  const stCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setStCopiedId(id);
    setTimeout(() => setStCopiedId(null), 1500);
    toast.success('Copiado! +1 XP');
    onXP?.(1);
  };

  const handleStGenerate = useCallback(async () => {
    if (stMode === 'generate' && (!stForm.niche || !stForm.product)) {
      toast.error('Preencha pelo menos o nicho e o produto.');
      return;
    }
    if (stMode === 'improve' && !stForm.existingStory.trim()) {
      toast.error('Cole a história que deseja melhorar.');
      return;
    }
    setStGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-storytelling', {
        body: {
          ...stForm,
          existingStory: stMode === 'improve' ? stForm.existingStory : undefined,
        },
      });
      if (error) {
        const msg = error.message || '';
        if (msg.includes('402')) { toast.error('Créditos de IA insuficientes.'); return; }
        if (msg.includes('429')) { toast.error('Muitas requisições. Aguarde.'); return; }
        throw error;
      }
      if (data?.error) { toast.error(data.error); return; }
      setStResult(data);
      localStorage.setItem('progcontrol-st-result', JSON.stringify(data));
      toast.success('Storytelling gerado! +10 XP');
      onXP?.(10);
    } catch (err) {
      console.error('Storytelling error:', err);
      toast.error('Erro ao gerar storytelling.');
    } finally { setStGenerating(false); }
  }, [stForm, stMode, onXP]);

  const stRenderCopy = (text: string, id: string) => (
    <Button size="sm" variant="outline" onClick={() => stCopy(text, id)} className="border-border/60 hover:border-primary/40 text-xs">
      {stCopiedId === id ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
      {stCopiedId === id ? 'Copiado!' : 'Copiar'}
    </Button>
  );

  const currentNiche = selectedNiche || customNiche;

  const saveFavorites = (next: Set<string>) => {
    setFavorites(next);
    localStorage.setItem('progcontrol-hooks-favs', JSON.stringify([...next]));
  };

  const toggleFavorite = (id: string) => {
    const next = new Set(favorites);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
      onXP?.(1);
      toast.success('Salvo nos favoritos! +1 XP');
    }
    saveFavorites(next);
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado para a área de transferência!');
    onXP?.(1);
  };

  const handleProfileChange = useCallback((profile: ContentProfile) => {
    setContentProfile(profile);
    localStorage.setItem('progcontrol-content-profile', JSON.stringify(profile));
  }, []);

  const handleGenerate = useCallback(async (kind: 'textual' | 'visual' | 'improve' = 'textual') => {
    setGeneratingKind(kind);
    try {
      const { data, error } = await supabase.functions.invoke('generate-hooks', {
        body: {
          kind,
          profileDescription: contentProfile.description,
          niche: contentProfile.niche,
          audience: contentProfile.audience,
          objective: contentProfile.objective,
          product: contentProfile.product,
          channel: contentProfile.channel,
          tone: contentProfile.tone,
          framework: contentProfile.framework,
          existingCopy: contentProfile.existingCopy,
          productDetails: contentProfile.productDetails || '',
          tema: contentProfile.tema || '',
          estiloVisual: contentProfile.estiloVisual || '',
          mecanismo: contentProfile.mecanismo || '',
          desejo: contentProfile.desejo || '',
          dor: contentProfile.dor || '',
          objecao: contentProfile.objecao || '',
          photoDescriptions: contentProfile.photos.length > 0
            ? [`${contentProfile.photos.length} foto(s) de perfil enviadas pelo creator`]
            : [],
          productPhotoDescriptions: (contentProfile.productPhotos || []).length > 0
            ? [`${contentProfile.productPhotos.length} foto(s) do produto enviadas`]
            : [],
        },
      });

      if (error) {
        const errorMsg = error.message || '';
        if (errorMsg.includes('402') || errorMsg.includes('Créditos insuficientes')) {
          toast.error('Créditos de IA insuficientes. Adicione créditos em Settings → Cloud & AI balance.');
          return;
        }
        if (errorMsg.includes('429') || errorMsg.includes('Limite de requisições')) {
          toast.error('Muitas requisições. Aguarde alguns segundos e tente novamente.');
          return;
        }
        throw error;
      }

      if (data?.error) {
        if (data.error.includes('Créditos') || data.error.includes('402')) {
          toast.error('Créditos de IA insuficientes. Adicione créditos em Settings → Cloud & AI balance.');
        } else if (data.error.includes('429') || data.error.includes('Limite')) {
          toast.error('Muitas requisições. Aguarde alguns segundos e tente novamente.');
        } else {
          toast.error(data.error);
        }
        return;
      }

      if (kind === 'textual') {
        setGeneratedTextual(data);
        localStorage.setItem('progcontrol-generated-textual', JSON.stringify(data));
      } else if (kind === 'visual') {
        setGeneratedVisual(data);
        localStorage.setItem('progcontrol-generated-visual', JSON.stringify(data));
      } else {
        setGeneratedImprove(data);
        localStorage.setItem('progcontrol-generated-improve', JSON.stringify(data));
      }
      toast.success('Conteúdo personalizado gerado com sucesso! +10 XP');
      onXP?.(10);
    } catch (err: any) {
      console.error('Generate error:', err);
      toast.error('Erro ao gerar conteúdo. Tente novamente.');
    } finally {
      setGeneratingKind(null);
    }
  }, [contentProfile, onXP]);

  const nicheCTAs = useMemo(() => {
    if (!currentNiche) return [];
    return generateNicheCTAs(currentNiche);
  }, [currentNiche]);

  const allItems = useMemo(() => [...PRESET_ITEMS, ...nicheCTAs], [nicheCTAs]);

  const filtered = useMemo(() => {
    return allItems.filter(item => {
      if (activeCategory !== 'all' && item.category !== activeCategory) return false;
      if (activeSubcategory !== 'all' && item.subcategory !== activeSubcategory) return false;
      if (showFavoritesOnly && !favorites.has(item.id)) return false;
      if (search) {
        const q = search.toLowerCase();
        return item.title.toLowerCase().includes(q) || item.text.toLowerCase().includes(q) || item.objective.toLowerCase().includes(q);
      }
      return true;
    });
  }, [activeCategory, activeSubcategory, search, showFavoritesOnly, favorites, allItems]);

  const getCategoryInfo = (cat: HookCategory) => CATEGORIES.find(c => c.id === cat)!;

  const handleSelectNiche = (nicho: string) => {
    setSelectedNiche(nicho);
    setCustomNiche('');
    setShowNicheSelector(false);
    toast.success(`Nicho "${nicho}" selecionado! CTAs personalizados gerados.`);
    onXP?.(3);
  };

  const handleCustomNiche = () => {
    if (!customNiche.trim()) return;
    setSelectedNiche('');
    setShowNicheSelector(false);
    toast.success(`Nicho "${customNiche}" aplicado! CTAs personalizados gerados.`);
    onXP?.(3);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div>
        <h2 className="text-2xl md:text-3xl font-black tracking-tight">
          <span className="text-gradient-red">Gerador Inteligente</span>
          <span className="text-foreground"> de </span>
          <span className="text-amber-400">Hooks, CTAs</span>
          <span className="text-foreground"> & </span>
          <span className="text-violet-400">Storytelling</span>
        </h2>
        <p className="text-sm text-muted-foreground mt-1">Crie conteúdo personalizado com IA, explore hooks prontos ou gere storytelling</p>
      </div>

      {/* Main Tabs */}
      <Tabs value={mainTab} onValueChange={setMainTab} className="w-full">
        <TabsList className="w-full grid grid-cols-5 h-12 bg-card border border-border/60">
          <TabsTrigger value="ai-generator" className="gap-1.5 text-xs sm:text-sm font-semibold data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
            <Sparkles className="w-4 h-4" />
            <span className="hidden sm:inline">Gerar</span>
            <span className="sm:hidden">Gerar</span>
          </TabsTrigger>
          <TabsTrigger value="improve-copy" className="gap-1.5 text-xs sm:text-sm font-semibold data-[state=active]:bg-amber-500/15 data-[state=active]:text-amber-400">
            <PenLine className="w-4 h-4" />
            <span className="hidden sm:inline">Melhorar</span>
            <span className="sm:hidden">Melhorar</span>
          </TabsTrigger>
          <TabsTrigger value="storytelling" className="gap-1.5 text-xs sm:text-sm font-semibold data-[state=active]:bg-violet-500/15 data-[state=active]:text-violet-400">
            <BookOpen className="w-4 h-4" />
            <span className="hidden sm:inline">Story</span>
            <span className="sm:hidden">Story</span>
          </TabsTrigger>
          <TabsTrigger value="biblia-library" className="gap-1.5 text-xs sm:text-sm font-semibold data-[state=active]:bg-violet-500/15 data-[state=active]:text-violet-400">
            <BookOpen className="w-4 h-4" />
            <span className="hidden sm:inline">Biblioteca</span>
            <span className="sm:hidden">Bíblia</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="biblia-library" className="space-y-5 mt-5">
          <BibliaLibraryTab />
        </TabsContent>

        {/* ───── Generate from Scratch Tab ───── */}
        <TabsContent value="ai-generator" className="space-y-5 mt-5">
          <ContentProfileForm
            profile={contentProfile}
            onChange={handleProfileChange}
            onGenerate={handleGenerate}
            isGenerating={isGenerating}
            generatingKind={generatingKind}
            textualResult={generatedTextual}
            visualResult={generatedVisual}
            onXP={onXP}
            mode="generate"
          />
        </TabsContent>

        {/* ───── Improve Copy Tab ───── */}
        <TabsContent value="improve-copy" className="space-y-5 mt-5">
          <ContentProfileForm
            profile={contentProfile}
            onChange={handleProfileChange}
            onGenerate={handleGenerate}
            isGenerating={isGenerating}
            generatingKind={generatingKind}
            mode="improve"
          />

          {generatedImprove && (
            <Card className="border-border/60 bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <PenLine className="w-4 h-4 text-amber-400" />
                  Copy Melhorada
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <GeneratedContentDisplay content={generatedImprove} onXP={onXP} />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ───── Storytelling Tab ───── */}
        <TabsContent value="storytelling" className="space-y-5 mt-5">
          <Card className="border-border/60 bg-card">
            <CardContent className="pt-6 space-y-5">
              <Tabs value={stMode} onValueChange={(v) => setStMode(v as 'generate' | 'improve')}>
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
                      <Input placeholder="Ex: emagrecimento, renda extra..." value={stForm.niche} onChange={e => stUpdate('niche', e.target.value)} className="bg-background border-border/60" />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5 text-xs font-bold"><Package className="w-3.5 h-3.5 text-primary" /> Produto/Serviço *</Label>
                      <Input placeholder="Nome e descrição breve" value={stForm.product} onChange={e => stUpdate('product', e.target.value)} className="bg-background border-border/60" />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5 text-xs font-bold"><Users className="w-3.5 h-3.5 text-primary" /> Público-alvo</Label>
                      <Input placeholder="Quem é seu cliente ideal?" value={stForm.audience} onChange={e => stUpdate('audience', e.target.value)} className="bg-background border-border/60" />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5 text-xs font-bold"><Target className="w-3.5 h-3.5 text-primary" /> Canal</Label>
                      <Select value={stForm.channel} onValueChange={v => stUpdate('channel', v)}>
                        <SelectTrigger className="bg-background border-border/60"><SelectValue placeholder="Escolha o canal" /></SelectTrigger>
                        <SelectContent>{STORYTELLING_CHANNELS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5 text-xs font-bold"><Palette className="w-3.5 h-3.5 text-primary" /> Tom</Label>
                      <Select value={stForm.tone} onValueChange={v => stUpdate('tone', v)}>
                        <SelectTrigger className="bg-background border-border/60"><SelectValue placeholder="Tom da história" /></SelectTrigger>
                        <SelectContent>{STORYTELLING_TONES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5 text-xs font-bold"><LayoutTemplate className="w-3.5 h-3.5 text-primary" /> Framework</Label>
                      <Select value={stForm.framework} onValueChange={v => stUpdate('framework', v)}>
                        <SelectTrigger className="bg-background border-border/60"><SelectValue placeholder="Escolha o framework" /></SelectTrigger>
                        <SelectContent>
                          {STORYTELLING_FRAMEWORKS.map(f => (
                            <SelectItem key={f.id} value={f.id}>
                              <div>
                                <span className="font-semibold">{f.id}</span>
                                <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{f.description}</p>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Story Type Selection with examples */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Label className="flex items-center gap-1.5 text-xs font-bold"><BookOpen className="w-3.5 h-3.5 text-violet-400" /> Tipo de História</Label>
                      <Button size="sm" variant="outline" onClick={handleRecommend} disabled={stRecommending || !stForm.niche.trim() || !stForm.product.trim()}
                        className="text-[10px] h-7 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10">
                        {stRecommending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
                        {stRecommending ? 'Analisando...' : 'IA Recomendar'}
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {STORY_TYPES_DATA.map(st => {
                        const isSelected = stForm.storyType === st.id;
                        const isRecommended = stRecommended?.type === st.id;
                        const isHighlighted = isSelected || isRecommended;
                        return (
                          <button
                            key={st.id}
                            onClick={() => stUpdate('storyType', isSelected ? '' : st.id)}
                            className={`text-left p-3 rounded-lg border transition-all duration-200 ${
                              isHighlighted
                                ? 'border-primary bg-primary/15 ring-2 ring-offset-1 ring-offset-background ring-primary shadow-[0_0_24px_-4px_hsl(var(--primary)/0.6)]'
                                : 'border-border/40 hover:border-border/80 bg-card'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className={`text-sm font-bold uppercase tracking-wide ${isHighlighted ? 'text-primary' : st.color}`}>{st.id}</span>
                              {isRecommended && (
                                <Badge className="bg-primary text-primary-foreground border-primary text-[10px] shrink-0 font-bold">
                                  🔥 IA RECOMENDA
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mb-1.5">{st.description}</p>
                            <p className="text-[11px] text-foreground/60 italic">{st.example}</p>
                            {isRecommended && stRecommended?.reason && (
                              <p className="text-[10px] text-primary mt-1.5 font-semibold">💡 {stRecommended.reason}</p>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="improve" className="space-y-4 mt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5 text-xs font-bold"><Compass className="w-3.5 h-3.5 text-primary" /> Nicho</Label>
                      <Input placeholder="Ex: emagrecimento..." value={stForm.niche} onChange={e => stUpdate('niche', e.target.value)} className="bg-background border-border/60" />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5 text-xs font-bold"><Palette className="w-3.5 h-3.5 text-primary" /> Tom</Label>
                      <Select value={stForm.tone} onValueChange={v => stUpdate('tone', v)}>
                        <SelectTrigger className="bg-background border-border/60"><SelectValue placeholder="Tom desejado" /></SelectTrigger>
                        <SelectContent>{STORYTELLING_TONES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5 text-xs font-bold"><PenLine className="w-3.5 h-3.5 text-amber-400" /> História para Melhorar *</Label>
                    <Textarea placeholder="Cole aqui a história ou copy que deseja melhorar..." value={stForm.existingStory} onChange={e => stUpdate('existingStory', e.target.value)}
                      className="bg-background border-border/60 min-h-[150px]" />
                  </div>
                </TabsContent>
              </Tabs>

              <Button onClick={handleStGenerate} disabled={stGenerating} className="w-full gradient-red text-primary-foreground border-0 font-bold">
                {stGenerating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Gerando Storytelling...</> : <><Sparkles className="w-4 h-4 mr-2" /> Gerar Storytelling com IA</>}
              </Button>
            </CardContent>
          </Card>

          {/* Storytelling Results */}
          {stResult && (
            <div className="space-y-5">
              {stResult.diagnosis && (
                <Card className="border-orange-500/30 bg-card">
                  <CardContent className="pt-5 space-y-3">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-orange-400" />
                      <h3 className="font-bold text-orange-400">🔍 Diagnóstico</h3>
                    </div>
                    <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line">{stResult.diagnosis}</p>
                  </CardContent>
                </Card>
              )}
              {stResult.improvedStory && (
                <Card className="border-emerald-500/30 bg-card">
                  <CardContent className="pt-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <PenLine className="w-5 h-5 text-emerald-400" />
                        <h3 className="font-bold text-emerald-400">✍️ História Melhorada</h3>
                      </div>
                      {stRenderCopy(stResult.improvedStory, 'st-improved')}
                    </div>
                    <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line">{stResult.improvedStory}</p>
                  </CardContent>
                </Card>
              )}
              {stResult.changes && stResult.changes.length > 0 && (
                <Card className="border-sky-500/30 bg-card">
                  <CardContent className="pt-5 space-y-3">
                    <div className="flex items-center gap-2">
                      <Zap className="w-5 h-5 text-sky-400" />
                      <h3 className="font-bold text-sky-400">📋 Mudanças Realizadas</h3>
                    </div>
                    <ul className="space-y-2">
                      {stResult.changes.map((c: string, i: number) => (
                        <li key={i} className="text-sm text-foreground/90 flex gap-2">
                          <span className="text-sky-400 font-bold shrink-0">{i + 1}.</span>
                          <span>{c}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
              {stResult.fullStory && (
                <Card className="border-violet-500/30 bg-card">
                  <CardContent className="pt-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-violet-400" />
                        <h3 className="font-bold text-violet-400">📖 História Completa</h3>
                        {stResult.frameworkUsed && <Badge variant="outline" className="text-[10px] border-violet-500/30 text-violet-300">{stResult.frameworkUsed}</Badge>}
                        {stResult.storyTypeUsed && <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-300">{stResult.storyTypeUsed}</Badge>}
                      </div>
                      {stRenderCopy(stResult.fullStory, 'st-full')}
                    </div>
                    <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line">{stResult.fullStory}</p>
                    {stResult.emotionalArc && (
                      <div className="mt-3 p-3 rounded-lg bg-violet-500/5 border border-violet-500/20">
                        <p className="text-xs text-violet-300 font-semibold mb-1">🎭 Arco Emocional:</p>
                        <p className="text-xs text-foreground/70">{stResult.emotionalArc}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
              {stResult.shortVersion && (
                <Card className="border-pink-500/30 bg-card">
                  <CardContent className="pt-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Zap className="w-5 h-5 text-pink-400" />
                        <h3 className="font-bold text-pink-400">⚡ Versão Curta (Anúncio)</h3>
                      </div>
                      {stRenderCopy(stResult.shortVersion, 'st-short')}
                    </div>
                    <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line">{stResult.shortVersion}</p>
                  </CardContent>
                </Card>
              )}
              {stResult.videoScript && (
                <Card className="border-indigo-500/30 bg-card">
                  <CardContent className="pt-5 space-y-3">
                    <div className="flex items-center gap-2">
                      <Film className="w-5 h-5 text-indigo-400" />
                      <h3 className="font-bold text-indigo-400">🎬 Roteiro de Vídeo</h3>
                    </div>
                    <div className="space-y-3">
                      {Object.entries(stResult.videoScript).map(([key, scene]: [string, any], idx: number) => (
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
              {(stResult.openings || stResult.alternativeOpenings) && (
                <Card className="border-amber-500/30 bg-card">
                  <CardContent className="pt-5 space-y-3">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-5 h-5 text-amber-400" />
                      <h3 className="font-bold text-amber-400">🎣 Aberturas Alternativas</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {(stResult.openings || stResult.alternativeOpenings || []).map((op: any, i: number) => (
                        <div key={i} className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 space-y-2">
                          <div className="flex items-center justify-between">
                            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px]">
                              {op.hookType || `Abertura ${i + 1}`}
                            </Badge>
                            {stRenderCopy(op.text, `st-opening-${i}`)}
                          </div>
                          <p className="text-sm text-foreground/90">{op.text}</p>
                          <p className="text-[10px] text-muted-foreground">{op.objective}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
              {stResult.integratedCTA && (
                <Card className="border-rose-500/30 bg-card">
                  <CardContent className="pt-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Target className="w-5 h-5 text-rose-400" />
                        <h3 className="font-bold text-rose-400">📣 CTA Integrado</h3>
                      </div>
                      {stRenderCopy(stResult.integratedCTA, 'st-cta')}
                    </div>
                    <p className="text-sm text-foreground/90 leading-relaxed">{stResult.integratedCTA}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

      </Tabs>
    </div>
  );
}
