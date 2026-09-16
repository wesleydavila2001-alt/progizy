import { Zap, Trophy, Flame, BookOpen, Target, Languages, Download, MessageSquare, TrendingUp, ArrowRight } from 'lucide-react';
import { XPBar } from '../XPBar';
import { UserProfile, getLevelInfo } from '@/lib/store';
import { motion } from 'framer-motion';

interface DashboardViewProps {
  profile: UserProfile;
  onNavigate?: (tab: string) => void;
}

export function DashboardView({ profile, onNavigate }: DashboardViewProps) {
  const levelInfo = getLevelInfo(profile.xp);
  const nextLevelXP = (levelInfo.level) * 1000;
  const xpToNext = Math.max(0, nextLevelXP - profile.xp);

  const stats = [
    { icon: Zap, label: 'XP Total', value: profile.xp.toLocaleString(), text: 'text-yellow-300', grad: 'from-yellow-500/25 via-amber-500/10 to-transparent', ring: 'border-yellow-500/40', glow: 'shadow-[0_0_30px_-10px_hsl(48_96%_53%/0.6)]' },
    { icon: Trophy, label: 'Nível', value: levelInfo.name, text: 'text-orange-300', grad: 'from-orange-500/25 via-orange-500/10 to-transparent', ring: 'border-orange-500/40', glow: 'shadow-[0_0_30px_-10px_hsl(25_95%_53%/0.6)]' },
    { icon: Flame, label: 'Streak', value: `${profile.streak}d`, text: 'text-red-300', grad: 'from-red-500/30 via-rose-500/10 to-transparent', ring: 'border-red-500/40', glow: 'shadow-[0_0_30px_-10px_hsl(0_84%_60%/0.6)]' },
    { icon: TrendingUp, label: 'Próx. Nível', value: `${xpToNext} XP`, text: 'text-cyan-300', grad: 'from-cyan-500/25 via-sky-500/10 to-transparent', ring: 'border-cyan-500/40', glow: 'shadow-[0_0_30px_-10px_hsl(189_94%_43%/0.6)]' },
  ];

  const tools = [
    { id: 'hooks-ctas', icon: BookOpen, label: 'Hooks & CTAs', desc: 'Gere hooks virais', text: 'text-primary', grad: 'from-primary/25 via-primary/10 to-transparent', ring: 'border-primary/40', iconBg: 'bg-primary/20' },
    { id: 'transcription', icon: Languages, label: 'Transcrição', desc: 'Transcreva vídeos', text: 'text-cyan-300', grad: 'from-cyan-500/25 via-sky-500/10 to-transparent', ring: 'border-cyan-500/40', iconBg: 'bg-cyan-500/20' },
    { id: 'downloads', icon: Download, label: 'Downloads', desc: 'Baixe vídeos virais', text: 'text-purple-300', grad: 'from-purple-500/25 via-violet-500/10 to-transparent', ring: 'border-purple-500/40', iconBg: 'bg-purple-500/20' },
    { id: 'ai-chat', icon: MessageSquare, label: 'Pesquisa AI', desc: 'Tire dúvidas com IA', text: 'text-emerald-300', grad: 'from-emerald-500/25 via-green-500/10 to-transparent', ring: 'border-emerald-500/40', iconBg: 'bg-emerald-500/20' },
    { id: 'missions', icon: Target, label: 'Missões', desc: 'Ganhe XP diário', text: 'text-amber-300', grad: 'from-amber-500/25 via-yellow-500/10 to-transparent', ring: 'border-amber-500/40', iconBg: 'bg-amber-500/20' },
    { id: 'gamification', icon: Trophy, label: 'Gamificação', desc: 'Veja sua progressão', text: 'text-orange-300', grad: 'from-orange-500/25 via-red-500/10 to-transparent', ring: 'border-orange-500/40', iconBg: 'bg-orange-500/20' },
  ];

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-xl md:text-2xl font-bold tracking-wide leading-tight">
          Olá, <span className="text-gradient-red">{profile.name}</span>{' '}
          <Flame className="inline w-5 h-5 text-orange-400 mb-1" />
        </h2>
        <p className="text-muted-foreground text-xs mt-1">
          Bem-vindo ao seu <span className="text-foreground/70 font-medium">núcleo de criador</span>
        </p>
      </motion.div>

      <XPBar xp={profile.xp} level={profile.level} />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.03 + i * 0.04 }}
            className={`relative rounded-xl p-4 border ${s.ring} ${s.glow} bg-gradient-to-br ${s.grad} bg-card/40 backdrop-blur-sm overflow-hidden group`}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">{s.label}</p>
              <div className={`w-8 h-8 rounded-lg ${s.ring} border bg-background/40 flex items-center justify-center`}>
                <s.icon className={`w-4 h-4 ${s.text}`} />
              </div>
            </div>
            <p className={`text-2xl font-black truncate ${s.text} drop-shadow-[0_0_10px_currentColor]`}>{s.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Tools Grid */}
      <div>
        <h3 className="text-xs font-semibold mb-3 uppercase tracking-wider flex items-center gap-2">
          <span className="text-gradient-red">Ferramentas</span> <span className="text-foreground/70">Ativas</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {tools.map((t, i) => (
            <motion.button
              key={t.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.04 }}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onNavigate?.(t.id)}
              className={`relative text-left rounded-xl p-4 border ${t.ring} bg-gradient-to-br ${t.grad} bg-card/40 backdrop-blur-sm hover:shadow-[0_8px_30px_-10px_hsl(var(--primary)/0.3)] transition-all group overflow-hidden`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className={`w-8 h-8 rounded-lg ${t.iconBg} flex items-center justify-center shrink-0`}>
                      <t.icon className={`w-4 h-4 ${t.text}`} />
                    </div>
                    <p className={`text-sm font-black ${t.text} uppercase tracking-wide drop-shadow-[0_0_8px_currentColor]`}>{t.label}</p>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{t.desc}</p>
                </div>
                <ArrowRight className={`w-4 h-4 ${t.text} opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-all flex-shrink-0`} />
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
