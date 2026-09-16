import { motion } from 'framer-motion';
import {
  Trophy, Flame, Target, Star, Zap, Crown, Video, FileText, Lightbulb, Users,
  Calendar, Gift, Shield, Award, TrendingUp, Mic, Eye, Bookmark, Lock, Skull,
  Swords, Heart, Sparkles, Gem, Medal, BadgeCheck, CircleDot, Rocket, Brain
} from 'lucide-react';
import { UserProfile, getLevelInfo, RANK_TIERS, getRankTier, getRarityColor, MILESTONES, xpForLevel, getLevelBand } from '@/lib/store';
import { XPBar } from '../XPBar';
import { useMemo, useState, useEffect, useRef } from 'react';
import type { LucideIcon } from 'lucide-react';
import { useCelebration } from '@/components/CelebrationOverlay';

interface GamificationViewProps {
  profile: UserProfile;
  onUpdate?: (updates: Partial<UserProfile>) => void;
}

type AchievementRarity = 'Comum' | 'Incomum' | 'Rara' | 'Épica' | 'Lendária' | 'Mítica';

interface Achievement {
  icon: LucideIcon;
  title: string;
  desc: string;
  unlocked: boolean;
  rarity: AchievementRarity;
  xpBonus: number;
  category: string;
}

const RARITY_BG: Record<string, string> = {
  'Comum':     'bg-gradient-to-br from-zinc-500/40 via-slate-500/20 to-zinc-500/5 border-zinc-400/60 shadow-[0_0_30px_-6px_hsl(220_9%_60%/0.7)]',
  'Incomum':   'bg-gradient-to-br from-teal-500/45 via-emerald-500/20 to-teal-500/5 border-teal-400/70 shadow-[0_0_30px_-6px_hsl(172_66%_50%/0.8)]',
  'Rara':      'bg-gradient-to-br from-indigo-500/45 via-blue-500/20 to-indigo-500/5 border-indigo-400/70 shadow-[0_0_30px_-6px_hsl(239_84%_67%/0.8)]',
  'Épica':     'bg-gradient-to-br from-purple-500/45 via-fuchsia-500/25 to-purple-500/5 border-purple-400/70 shadow-[0_0_35px_-6px_hsl(271_91%_65%/0.85)]',
  'Lendária':  'bg-gradient-to-br from-orange-500/45 via-amber-500/25 to-red-500/10 border-orange-400/70 shadow-[0_0_35px_-6px_hsl(25_95%_53%/0.85)]',
  'Mítica':    'bg-gradient-to-br from-yellow-500/50 via-amber-400/30 to-orange-500/10 border-yellow-400/80 shadow-[0_0_40px_-4px_hsl(48_96%_53%/0.9)]',
};

const RARITY_BADGE_COLOR: Record<string, string> = {
  'Comum':     'text-zinc-400',
  'Incomum':   'text-teal-400',
  'Rara':      'text-indigo-400',
  'Épica':     'text-purple-400',
  'Lendária':  'text-orange-400',
  'Mítica':    'text-yellow-300',
};

const RARITY_ICON_BG: Record<string, string> = {
  'Comum':     'bg-zinc-500/30',
  'Incomum':   'bg-teal-500/30',
  'Rara':      'bg-indigo-500/30',
  'Épica':     'bg-purple-500/30',
  'Lendária':  'bg-orange-500/30',
  'Mítica':    'bg-gradient-to-br from-yellow-500/40 to-amber-500/40',
};

// Get special CSS class for mythic/immortal tiers
function getTierEffectClass(rarity: string, unlocked: boolean): string {
  if (!unlocked) return '';
  if (rarity === 'Imortal') return 'immortal-card immortal-particles';
  if (rarity === 'Mítico') return 'mythic-card mythic-particles';
  return '';
}

function getTierTextClass(rarity: string, unlocked: boolean): string {
  if (!unlocked) return '';
  if (rarity === 'Imortal') return 'immortal-text';
  if (rarity === 'Mítico') return 'mythic-text';
  return '';
}

function getAchievementEffectClass(rarity: AchievementRarity, unlocked: boolean): string {
  if (!unlocked) return '';
  if (rarity === 'Mítica') return 'mythic-card mythic-particles';
  return '';
}

function getAchievements(profile: UserProfile): Achievement[] {
  const contents = profile.contents || [];
  const videos = profile.videos || [];
  const references = profile.references || [];
  const schedule = profile.schedule || [];
  const accounts = profile.accounts || [];
  const interactions = profile.interactions || 0;
  const streak = profile.streak || 0;
  const info = getLevelInfo(profile.xp || 0);
  const postedCount = schedule.filter(s => s.status === 'posted').length;

  return [
    // ── Ações Iniciais (Comum) ──
    { icon: Users,      title: 'Primeira Conta',          desc: 'Vincule sua primeira conta TikTok',                 unlocked: accounts.length >= 1,   rarity: 'Comum',     xpBonus: 5,   category: 'Ações' },
    { icon: Video,      title: 'Primeiro Vídeo',          desc: 'Envie seu primeiro vídeo',                          unlocked: videos.length >= 1,     rarity: 'Comum',     xpBonus: 5,   category: 'Ações' },
    { icon: Target,     title: 'Primeiro Conteúdo',       desc: 'Cadastre seu primeiro conteúdo',                    unlocked: contents.length >= 1,   rarity: 'Comum',     xpBonus: 5,   category: 'Ações' },
    { icon: Lightbulb,  title: 'Primeira Inspiração',     desc: 'Salve sua primeira inspiração',                     unlocked: references.length >= 1, rarity: 'Comum',     xpBonus: 5,   category: 'Ações' },
    { icon: Calendar,   title: 'Primeira Agenda',         desc: 'Agende sua primeira postagem',                      unlocked: schedule.length >= 1,   rarity: 'Comum',     xpBonus: 5,   category: 'Ações' },
    { icon: Star,       title: 'Primeira Conclusão',      desc: 'Marque uma postagem como concluída',                unlocked: postedCount >= 1,       rarity: 'Comum',     xpBonus: 5,   category: 'Ações' },

    // ── Produtividade (Incomum) ──
    { icon: Video,      title: 'Produtor Ativo',          desc: 'Cadastre 10 vídeos',                                unlocked: videos.length >= 10,    rarity: 'Incomum',   xpBonus: 10,  category: 'Produtividade' },
    { icon: Lightbulb,  title: 'Caçador de Ideias',       desc: 'Salve 5 inspirações',                               unlocked: references.length >= 5, rarity: 'Incomum',   xpBonus: 10,  category: 'Produtividade' },
    { icon: Calendar,   title: 'Planejador',              desc: 'Agende 5 postagens',                                unlocked: schedule.length >= 5,   rarity: 'Incomum',   xpBonus: 10,  category: 'Produtividade' },
    { icon: Users,      title: 'Multi-Conta',             desc: 'Tenha 3+ contas TikTok vinculadas',                 unlocked: accounts.length >= 3,   rarity: 'Incomum',   xpBonus: 10,  category: 'Produtividade' },
    { icon: FileText,   title: 'Organizador',             desc: 'Tenha 10+ conteúdos cadastrados',                   unlocked: contents.length >= 10,  rarity: 'Incomum',   xpBonus: 10,  category: 'Produtividade' },

    // ── Consistência (Rara) ──
    { icon: Flame,      title: 'Streak de Fogo',          desc: '7 dias seguidos usando o app',                      unlocked: streak >= 7,            rarity: 'Rara',      xpBonus: 20,  category: 'Consistência' },
    { icon: Gift,       title: 'Bônus de Interação',      desc: 'Faça 100 interações no app',                        unlocked: interactions >= 100,     rarity: 'Rara',      xpBonus: 20,  category: 'Consistência' },
    { icon: Star,       title: 'Finalizador',             desc: 'Marque 5 postagens como concluídas',                unlocked: postedCount >= 5,       rarity: 'Rara',      xpBonus: 20,  category: 'Consistência' },
    { icon: Bookmark,   title: 'Colecionador',            desc: 'Salve 20 inspirações',                              unlocked: references.length >= 20,rarity: 'Rara',      xpBonus: 20,  category: 'Consistência' },
    { icon: CircleDot,  title: 'Nível Raro',              desc: 'Alcance o primeiro nível raro (101+)',               unlocked: info.level >= 101,      rarity: 'Rara',      xpBonus: 25,  category: 'Consistência' },

    // ── Volume (Épica) ──
    { icon: Flame,      title: 'Chama Imortal',           desc: '30 dias seguidos usando o app',                     unlocked: streak >= 30,           rarity: 'Épica',     xpBonus: 50,  category: 'Volume' },
    { icon: Video,      title: 'Fábrica de Vídeos',       desc: 'Cadastre 50 vídeos',                                unlocked: videos.length >= 50,    rarity: 'Épica',     xpBonus: 50,  category: 'Volume' },
    { icon: Lightbulb,  title: '100 Ideias',              desc: 'Organize 100 ideias/inspirações',                   unlocked: references.length >= 100,rarity: 'Épica',    xpBonus: 50,  category: 'Volume' },
    { icon: Zap,        title: '500 Interações',          desc: 'Faça 500 interações no app',                        unlocked: interactions >= 500,     rarity: 'Épica',     xpBonus: 50,  category: 'Volume' },
    { icon: Shield,     title: 'Mudança de Cor',          desc: 'Alcance a primeira mudança de cor de nível (26+)',   unlocked: info.level >= 26,       rarity: 'Épica',     xpBonus: 30,  category: 'Volume' },
    { icon: BadgeCheck, title: 'Mestre da Agenda',        desc: 'Agende 25 postagens',                               unlocked: schedule.length >= 25,  rarity: 'Épica',     xpBonus: 40,  category: 'Volume' },

    // ── Marcos de Nível (Lendária) ──
    { icon: Crown,      title: 'Creator Dominante',       desc: 'Alcance nível 221+',                                unlocked: info.level >= 221,      rarity: 'Lendária',  xpBonus: 100, category: 'Marcos' },
    { icon: Award,      title: 'Meio Milhar',             desc: 'Alcance nível 500',                                 unlocked: info.level >= 500,      rarity: 'Lendária',  xpBonus: 150, category: 'Marcos' },
    { icon: Swords,     title: 'Guerreiro Imparável',     desc: 'Marque 20 postagens como concluídas',               unlocked: postedCount >= 20,      rarity: 'Lendária',  xpBonus: 100, category: 'Marcos' },
    { icon: Gem,        title: 'Título Especial',         desc: 'Desbloqueie a classificação "Rei do Conteúdo" (401+)',unlocked: info.level >= 401,     rarity: 'Lendária',  xpBonus: 100, category: 'Marcos' },
    { icon: Rocket,     title: 'Produção Massiva',        desc: 'Tenha 50+ conteúdos cadastrados',                   unlocked: contents.length >= 50,  rarity: 'Lendária',  xpBonus: 100, category: 'Marcos' },

    // ── Supremas (Mítica) ──
    { icon: Trophy,     title: 'Elite Creator',           desc: 'Alcance nível 661+',                                unlocked: info.level >= 661,      rarity: 'Mítica',    xpBonus: 200, category: 'Supremas' },
    { icon: Skull,      title: 'Conquista Secreta',       desc: '???',                                               unlocked: interactions >= 1000 && streak >= 30, rarity: 'Mítica', xpBonus: 300, category: 'Supremas' },
    { icon: Sparkles,   title: 'Lenda Nórdica',           desc: 'Alcance nível 901+',                                unlocked: info.level >= 901,      rarity: 'Mítica',    xpBonus: 500, category: 'Supremas' },
    { icon: Brain,      title: 'Mente Suprema',           desc: 'Tenha 200+ inspirações salvas',                     unlocked: references.length >= 200,rarity: 'Mítica',   xpBonus: 300, category: 'Supremas' },
    { icon: Medal,      title: 'Entidade Suprema',        desc: 'Alcance nível 951+',                                unlocked: info.level >= 951,      rarity: 'Mítica',    xpBonus: 1000,category: 'Supremas' },
  ];
}

const xpActions = [
  { action: 'Gerar Hook ou CTA', xp: '+3 XP', icon: Lightbulb, color: 'text-yellow-300', bg: 'bg-gradient-to-r from-yellow-500/20 via-amber-500/10 to-transparent border-yellow-400/40' },
  { action: 'Gerar Storytelling', xp: '+4 XP', icon: FileText, color: 'text-pink-300', bg: 'bg-gradient-to-r from-pink-500/20 via-rose-500/10 to-transparent border-pink-400/40' },
  { action: 'Transcrever vídeo', xp: '+5 XP', icon: Mic, color: 'text-cyan-300', bg: 'bg-gradient-to-r from-cyan-500/20 via-sky-500/10 to-transparent border-cyan-400/40' },
  { action: 'Baixar vídeo viral', xp: '+2 XP', icon: Video, color: 'text-purple-300', bg: 'bg-gradient-to-r from-purple-500/20 via-violet-500/10 to-transparent border-purple-400/40' },
  { action: 'Pesquisar com AI Chat', xp: '+2 XP', icon: Brain, color: 'text-emerald-300', bg: 'bg-gradient-to-r from-emerald-500/20 via-green-500/10 to-transparent border-emerald-400/40' },
  { action: 'Favoritar hook (Bíblia)', xp: '+1 XP', icon: Star, color: 'text-blue-300', bg: 'bg-gradient-to-r from-blue-500/20 via-indigo-500/10 to-transparent border-blue-400/40' },
  { action: 'Concluir missão diária', xp: '+10 XP', icon: Target, color: 'text-orange-300', bg: 'bg-gradient-to-r from-orange-500/20 via-red-500/10 to-transparent border-orange-400/40' },
  { action: 'Bônus de streak diário', xp: '+5 XP', icon: Flame, color: 'text-red-300', bg: 'bg-gradient-to-r from-red-500/20 via-rose-500/10 to-transparent border-red-400/40' },
];

const RARITY_ORDER: AchievementRarity[] = ['Comum', 'Incomum', 'Rara', 'Épica', 'Lendária', 'Mítica'];
const CATEGORY_ORDER = ['Ações', 'Produtividade', 'Consistência', 'Volume', 'Marcos', 'Supremas'];

export function GamificationView({ profile, onUpdate }: GamificationViewProps) {
  const achievements = useMemo(() => getAchievements(profile), [profile]);
  const unlockedCount = achievements.filter(a => a.unlocked).length;
  const info = getLevelInfo(profile.xp);
  const [filterRarity, setFilterRarity] = useState<AchievementRarity | 'Todas'>('Todas');
  const { celebrate } = useCelebration();
  const prevUnlockedRef = useRef<Set<string>>(new Set(achievements.filter(a => a.unlocked).map(a => a.title)));

  // Detect newly unlocked achievements
  useEffect(() => {
    const currentUnlocked = achievements.filter(a => a.unlocked);
    const newlyUnlocked = currentUnlocked.filter(a => !prevUnlockedRef.current.has(a.title));
    if (newlyUnlocked.length > 0) {
      newlyUnlocked.forEach((a, i) => {
        setTimeout(() => {
          celebrate({ title: a.title, xp: a.xpBonus, icon: a.icon, sound: 'achievementUnlock' });
        }, i * 2500);
      });
    }
    prevUnlockedRef.current = new Set(currentUnlocked.map(a => a.title));
  }, [achievements, celebrate]);

  const filteredAchievements = filterRarity === 'Todas'
    ? achievements
    : achievements.filter(a => a.rarity === filterRarity);

  const nextMilestone = MILESTONES.find(m => info.level < m);

  // Unlocked titles from rank tiers
  const unlockedTitles = useMemo(() => {
    return RANK_TIERS.filter(tier => info.level >= tier.minLevel);
  }, [info.level]);

  const selectedTitle = profile.selectedTitle || info.name;

  const handleSelectTitle = (title: string) => {
    onUpdate?.({ selectedTitle: title });
  };

  // Group by category for display
  const groupedAchievements = useMemo(() => {
    const groups: Record<string, Achievement[]> = {};
    for (const a of filteredAchievements) {
      if (!groups[a.category]) groups[a.category] = [];
      groups[a.category].push(a);
    }
    return CATEGORY_ORDER
      .filter(c => groups[c])
      .map(c => ({ category: c, items: groups[c] }));
  }, [filteredAchievements]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-wide text-foreground flex items-center gap-2">
          <Trophy className="w-6 h-6 text-primary" /> <span className="text-gradient-red">Gamificação</span>
        </h2>
        <p className="text-sm text-muted-foreground mt-1">Suba de nível criando conteúdo consistente — 1000 níveis de evolução</p>
      </div>

      <XPBar xp={profile.xp} level={profile.level} />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Nível', value: info.level.toString(), color: 'text-cyan-300', grad: 'from-cyan-500/30 via-sky-500/10 to-transparent', ring: 'border-cyan-400/50', glow: 'shadow-[0_0_25px_-10px_hsl(189_94%_43%/0.6)]' },
          { label: 'Classificação', value: info.name, color: 'text-purple-300', grad: 'from-purple-500/30 via-fuchsia-500/10 to-transparent', ring: 'border-purple-400/50', glow: 'shadow-[0_0_25px_-10px_hsl(271_91%_65%/0.6)]' },
          { label: 'Faixa Visual', value: getLevelBand(info.level).label, color: 'text-pink-300', grad: 'from-pink-500/30 via-rose-500/10 to-transparent', ring: 'border-pink-400/50', glow: 'shadow-[0_0_25px_-10px_hsl(330_81%_60%/0.6)]' },
          { label: 'Streak', value: `${profile.streak} dias`, color: 'text-orange-300', grad: 'from-orange-500/30 via-red-500/10 to-transparent', ring: 'border-orange-400/50', glow: 'shadow-[0_0_25px_-10px_hsl(25_95%_53%/0.6)]' },
          { label: 'Conquistas', value: `${unlockedCount}/${achievements.length}`, color: 'text-yellow-300', grad: 'from-yellow-500/30 via-amber-500/10 to-transparent', ring: 'border-yellow-400/50', glow: 'shadow-[0_0_25px_-10px_hsl(48_96%_53%/0.6)]' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className={`rounded-xl p-4 text-center border ${stat.ring} ${stat.glow} bg-gradient-to-br ${stat.grad} bg-card/40 backdrop-blur-sm`}
          >
            <p className={`text-lg font-black ${stat.color} drop-shadow-[0_0_10px_currentColor] truncate`}>{stat.value}</p>
            <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider font-semibold">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Rank Tiers Roadmap + Title Selector */}
      <div className="glass-card rounded-xl p-5">
        <div className="mb-4">
          <h3 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
            <Crown className="w-4 h-4 text-primary" /> <span className="text-gradient-red">Título do Perfil</span>
          </h3>
          <p className="text-[11px] text-muted-foreground mb-3">
            Escolha um título desbloqueado para exibir no seu perfil. Títulos são conquistados ao atingir novas classificações.
          </p>
          <div className="inline-flex items-center gap-2 p-2 px-3 rounded-lg bg-secondary/40 border border-border">
            <Crown className="w-4 h-4 text-primary shrink-0" />
            <div className="text-left">
              <p className="text-[10px] text-muted-foreground">Título ativo</p>
              <p className={`text-sm font-bold ${getRankTier(info.level).color}`}>{selectedTitle}</p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {RANK_TIERS.map((tier, i) => {
            const isUnlocked = info.level >= tier.minLevel;
            const isSelected = selectedTitle === tier.name;
            const isCurrent = info.name === tier.name;
            const tierEffect = isUnlocked
              ? tier.rarity === 'Imortal' ? 'immortal-card' : tier.rarity === 'Mítico' ? 'mythic-card' : ''
              : '';
            return (
              <motion.button
                key={tier.name}
                disabled={!isUnlocked}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: Math.min(i * 0.02, 0.4) }}
                whileHover={isUnlocked ? { scale: 1.03 } : undefined}
                whileTap={isUnlocked ? { scale: 0.97 } : undefined}
                onClick={() => isUnlocked && handleSelectTitle(tier.name)}
                className={`rounded-xl p-3 text-center border backdrop-blur-sm transition-all ${tierEffect} ${tier.bgColor} ${tier.color} shadow-[0_0_25px_-6px_currentColor] ${
                  isSelected
                    ? `border-primary/60 ring-2 ring-primary/40 shadow-[0_0_40px_-4px_hsl(var(--primary)/0.8)]`
                    : isUnlocked
                      ? `border-current/50 hover:shadow-[0_0_35px_-4px_currentColor] cursor-pointer`
                      : `border-current/30 opacity-70 saturate-[0.75] cursor-not-allowed`
                }`}
              >
                <p className={`text-xs font-black ${tier.color} ${isUnlocked ? 'drop-shadow-[0_0_8px_currentColor]' : ''} ${isUnlocked && tier.rarity === 'Imortal' ? 'immortal-text' : isUnlocked && tier.rarity === 'Mítico' ? 'mythic-text' : ''}`}>
                  {!isUnlocked && <Lock className="inline w-3 h-3 mr-1 opacity-60" />}
                  {tier.name}
                </p>
                <p className="text-[9px] text-muted-foreground mt-1">Nível {tier.minLevel}–{tier.maxLevel}</p>
                <span className={`text-[8px] px-1 py-0.5 rounded ${getRarityColor(tier.rarity)} font-semibold`}>
                  {tier.rarity}
                </span>
                {isSelected && <p className="text-[9px] text-primary mt-1 font-semibold">✓ Ativo</p>}
                {isCurrent && !isSelected && <p className="text-[9px] text-primary mt-1 font-semibold">← Você está aqui</p>}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Milestones */}
      <div className="glass-card rounded-xl p-5">
        <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
          <Award className="w-4 h-4 text-primary" /> <span className="text-gradient-red">Marcos Especiais</span>
        </h3>
        <div className="flex flex-wrap gap-2">
          {MILESTONES.map(m => {
            const reached = info.level >= m;
            const tier = getRankTier(m);
            return (
              <motion.div
                key={m}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`px-3 py-2 rounded-lg text-center border backdrop-blur-sm transition-all ${tier.bgColor} ${tier.color} shadow-[0_0_20px_-6px_currentColor] hover:shadow-[0_0_30px_-4px_currentColor] ${
                  reached ? `border-current/50` : `border-current/30 opacity-70 saturate-[0.7]`
                }`}
              >
                <p className={`text-sm font-black ${tier.color} ${reached ? 'drop-shadow-[0_0_6px_currentColor]' : ''}`}>{m}</p>
                <p className="text-[8px] text-muted-foreground">nível</p>
              </motion.div>
            );
          })}
        </div>
        {nextMilestone && (
          <p className="text-xs text-muted-foreground mt-3">
            Próximo marco: <span className="text-foreground font-semibold">Nível {nextMilestone}</span> — faltam {nextMilestone - info.level} níveis
          </p>
        )}
      </div>

      {/* XP Actions */}
      <div className="glass-card rounded-xl p-5">
        <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" /> <span className="text-gradient-red">Como ganhar XP</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {xpActions.map(item => (
            <div key={item.action} className={`flex items-center justify-between py-2.5 px-3 rounded-lg border ${item.bg} backdrop-blur-sm`}>
              <div className="flex items-center gap-2">
                <item.icon className={`w-4 h-4 ${item.color} drop-shadow-[0_0_6px_currentColor]`} />
                <span className="text-sm text-foreground">{item.action}</span>
              </div>
              <span className={`text-xs font-mono font-bold ${item.color}`}>{item.xp}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Achievements */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Star className="w-4 h-4 text-primary" /> <span className="text-gradient-red">Conquistas</span> ({unlockedCount}/{achievements.length})
          </h3>
        </div>

        {/* Rarity filter */}
        <div className="flex flex-wrap gap-2 mb-5">
          {(['Todas', ...RARITY_ORDER] as const).map(r => {
            const colorMap: Record<string, string> = {
              'Todas': 'border-primary/50 text-primary shadow-[0_0_15px_-4px_hsl(var(--primary))]',
              'Comum': 'border-zinc-400/50 text-zinc-300 shadow-[0_0_15px_-4px_hsl(220_9%_60%)]',
              'Incomum': 'border-teal-400/50 text-teal-300 shadow-[0_0_15px_-4px_hsl(172_66%_50%)]',
              'Rara': 'border-indigo-400/50 text-indigo-300 shadow-[0_0_15px_-4px_hsl(239_84%_67%)]',
              'Épica': 'border-purple-400/50 text-purple-300 shadow-[0_0_15px_-4px_hsl(271_91%_65%)]',
              'Lendária': 'border-orange-400/50 text-orange-300 shadow-[0_0_15px_-4px_hsl(25_95%_53%)]',
              'Mítica': 'border-yellow-400/50 text-yellow-300 shadow-[0_0_15px_-4px_hsl(48_96%_53%)]',
            };
            const isActive = filterRarity === r;
            return (
              <button
                key={r}
                onClick={() => setFilterRarity(r)}
                className={`text-[10px] px-2.5 py-1 rounded-full font-bold border bg-background/40 backdrop-blur-sm transition-all ${colorMap[r]} ${
                  isActive ? 'ring-2 ring-current/40 scale-105' : 'opacity-60 hover:opacity-100'
                }`}
              >
                {r}
              </button>
            );
          })}
        </div>

        {/* Grouped achievements */}
        {groupedAchievements.map(({ category, items }) => (
          <div key={category} className="mb-6">
            <p className="text-xs font-bold text-gradient-red uppercase tracking-wider mb-3">{category}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {items.map((a, i) => {
                const rarityBg = RARITY_BG[a.rarity] || '';
                const rarityIconBg = RARITY_ICON_BG[a.rarity] || 'bg-secondary';
                const rarityTextColor = RARITY_BADGE_COLOR[a.rarity] || 'text-muted-foreground';
                return (
                  <motion.div
                    key={a.title}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className={`rounded-xl p-4 border backdrop-blur-sm transition-all ${getAchievementEffectClass(a.rarity, a.unlocked)} ${rarityBg} ${
                      a.unlocked ? '' : 'opacity-60 saturate-[0.7]'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${rarityIconBg}`}>
                        <a.icon className={`w-4 h-4 ${rarityTextColor} ${a.unlocked ? 'drop-shadow-[0_0_6px_currentColor]' : ''}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className={`text-sm font-bold truncate ${a.unlocked ? rarityTextColor : 'text-foreground/80'}`}>{a.title}</p>
                          {a.unlocked && <BadgeCheck className="w-3.5 h-3.5 text-primary shrink-0" />}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{a.desc}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${rarityTextColor} bg-current/10`}>{a.rarity}</span>
                          <span className="text-[9px] text-primary font-mono font-bold">+{a.xpBonus} XP</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
