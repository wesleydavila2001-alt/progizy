import { useState, useMemo, useEffect } from 'react';
import { Target, Flame, CheckCircle2, Trophy, Zap, Star, Calendar, TrendingUp, BookOpen, MessageSquare, Image, FileText, BarChart3, Download, UserSearch, Languages, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { playSound } from '@/lib/sounds';
import { useCelebration } from '@/components/CelebrationOverlay';
import type { MasterProfile } from '@/lib/store';

interface Mission {
  id: string;
  title: string;
  description: string;
  xpReward: number;
  icon: React.ElementType;
  type: 'daily' | 'weekly' | 'challenge';
  target: number;
  color: string; // title color
  bg?: string;   // icon container bg
  ring?: string; // card ring/border accent
  /** Function to compute current progress from profile data */
  compute: (profile: MasterProfile, today: string, weekStart: string) => number;
}

function countByDate(items: { createdAt?: string; date?: string }[] | undefined, dateStr: string) {
  return (items || []).filter(i => (i.createdAt || i.date || '').startsWith(dateStr)).length;
}

function countByWeek(items: { createdAt?: string; date?: string }[] | undefined, weekStart: string) {
  const ws = new Date(weekStart).getTime();
  const we = ws + 7 * 24 * 60 * 60 * 1000;
  return (items || []).filter(i => {
    const d = new Date(i.createdAt || i.date || '').getTime();
    return d >= ws && d < we;
  }).length;
}

function countByStatus(items: { status?: string }[] | undefined, status: string) {
  return (items || []).filter(i => i.status === status).length;
}

const DAILY_MISSIONS: Mission[] = [
  {
    id: 'd1', title: 'Interagir no Chat IA', description: 'Faça 1 pesquisa com a IA',
    xpReward: 5, icon: MessageSquare, type: 'daily', target: 1, color: 'text-cyan-400', bg: 'bg-cyan-500/15', ring: 'border-cyan-500/30 hover:border-cyan-400/60',
    compute: () => {
      try { return parseInt(localStorage.getItem('progcontrol-ai-chats-today') || '0', 10); } catch { return 0; }
    },
  },
  {
    id: 'd2', title: 'Revisar Hooks', description: 'Copie ou favorite 2 hooks',
    xpReward: 5, icon: BookOpen, type: 'daily', target: 2, color: 'text-yellow-400', bg: 'bg-yellow-500/15', ring: 'border-yellow-500/30 hover:border-yellow-400/60',
    compute: () => {
      try { return parseInt(localStorage.getItem('progcontrol-hooks-actions-today') || '0', 10); } catch { return 0; }
    },
  },
  {
    id: 'd3', title: 'Gerar Hooks & CTAs', description: 'Gere 1 copy com o gerador de hooks',
    xpReward: 5, icon: Zap, type: 'daily', target: 1, color: 'text-primary', bg: 'bg-primary/15', ring: 'border-primary/30 hover:border-primary/60',
    compute: () => {
      try { return parseInt(localStorage.getItem('progcontrol-hooks-generated-today') || '0', 10); } catch { return 0; }
    },
  },
  {
    id: 'd4', title: 'Explorar Bíblia dos Hooks', description: 'Copie 3 hooks da Bíblia dos Hooks',
    xpReward: 3, icon: BookOpen, type: 'daily', target: 3, color: 'text-violet-400', bg: 'bg-violet-500/15', ring: 'border-violet-500/30 hover:border-violet-400/60',
    compute: () => {
      try { return parseInt(localStorage.getItem('progcontrol-biblia-copies-today') || '0', 10); } catch { return 0; }
    },
  },
  {
    id: 'd5', title: 'Analisar Perfil', description: 'Faça 1 análise de perfil com a IA',
    xpReward: 5, icon: UserSearch, type: 'daily', target: 1, color: 'text-sky-400', bg: 'bg-sky-500/15', ring: 'border-sky-500/30 hover:border-sky-400/60',
    compute: () => {
      try { return parseInt(localStorage.getItem('progcontrol-profile-analysis-today') || '0', 10); } catch { return 0; }
    },
  },
  {
    id: 'd6', title: 'Usar Detector Viral', description: 'Analise 1 conteúdo no detector viral',
    xpReward: 5, icon: Flame, type: 'daily', target: 1, color: 'text-orange-400', bg: 'bg-orange-500/15', ring: 'border-orange-500/30 hover:border-orange-400/60',
    compute: () => {
      try { return parseInt(localStorage.getItem('progcontrol-viral-detector-today') || '0', 10); } catch { return 0; }
    },
  },
  {
    id: 'd7', title: 'Transcrever Vídeo', description: 'Transcreva 1 vídeo',
    xpReward: 5, icon: Languages, type: 'daily', target: 1, color: 'text-emerald-400', bg: 'bg-emerald-500/15', ring: 'border-emerald-500/30 hover:border-emerald-400/60',
    compute: () => {
      try { return parseInt(localStorage.getItem('progcontrol-transcriptions-today') || '0', 10); } catch { return 0; }
    },
  },
];

const WEEKLY_MISSIONS: Mission[] = [
  {
    id: 'w1', title: 'Gerar 10 Copies', description: 'Gere 10 copies com hooks & CTAs na semana',
    xpReward: 25, icon: Zap, type: 'weekly', target: 10, color: 'text-primary', bg: 'bg-primary/15', ring: 'border-primary/30 hover:border-primary/60',
    compute: () => {
      try { return parseInt(localStorage.getItem('progcontrol-hooks-generated-week') || '0', 10); } catch { return 0; }
    },
  },
  {
    id: 'w2', title: 'Pesquisar 5x na IA', description: 'Use o chat IA 5 vezes na semana',
    xpReward: 20, icon: MessageSquare, type: 'weekly', target: 5, color: 'text-cyan-400', bg: 'bg-cyan-500/15', ring: 'border-cyan-500/30 hover:border-cyan-400/60',
    compute: () => {
      try { return parseInt(localStorage.getItem('progcontrol-ai-chats-week') || '0', 10); } catch { return 0; }
    },
  },
  {
    id: 'w3', title: 'Analisar 3 Perfis', description: 'Faça 3 análises de perfil na semana',
    xpReward: 20, icon: UserSearch, type: 'weekly', target: 3, color: 'text-sky-400', bg: 'bg-sky-500/15', ring: 'border-sky-500/30 hover:border-sky-400/60',
    compute: () => {
      try { return parseInt(localStorage.getItem('progcontrol-profile-analysis-week') || '0', 10); } catch { return 0; }
    },
  },
  {
    id: 'w4', title: 'Detectar 3 Virais', description: 'Use o detector viral 3 vezes na semana',
    xpReward: 15, icon: Flame, type: 'weekly', target: 3, color: 'text-orange-400', bg: 'bg-orange-500/15', ring: 'border-orange-500/30 hover:border-orange-400/60',
    compute: () => {
      try { return parseInt(localStorage.getItem('progcontrol-viral-detector-week') || '0', 10); } catch { return 0; }
    },
  },
];

const CHALLENGES: Mission[] = [
  {
    id: 'c1', title: '7 Dias Seguidos', description: 'Acesse o app por 7 dias consecutivos',
    xpReward: 50, icon: Flame, type: 'challenge', target: 7, color: 'text-orange-400', bg: 'bg-orange-500/15', ring: 'border-orange-500/30 hover:border-orange-400/60',
    compute: (p) => p.streak || 0,
  },
  {
    id: 'c2', title: '30 Dias de Streak', description: 'Mantenha um streak de 30 dias',
    xpReward: 150, icon: Star, type: 'challenge', target: 30, color: 'text-yellow-300', bg: 'bg-yellow-500/15', ring: 'border-yellow-500/30 hover:border-yellow-400/60',
    compute: (p) => p.streak || 0,
  },
  {
    id: 'c3', title: 'Creator Consistente', description: 'Publique 20 conteúdos no total',
    xpReward: 100, icon: Trophy, type: 'challenge', target: 20, color: 'text-amber-400', bg: 'bg-amber-500/15', ring: 'border-amber-500/30 hover:border-amber-400/60',
    compute: (p) => (p.contents || []).filter(c => c.status === 'posted').length,
  },
];

const STORAGE_KEY = 'progcontrol-missions';

interface MissionCompletion {
  [missionId: string]: { completedAt: string; rewarded: boolean };
}

interface MissionState {
  completions: MissionCompletion;
  lastDailyReset: string;
  lastWeeklyReset: string;
  totalXPEarned: number;
  totalCompleted: number;
}

function getToday() {
  return new Date().toISOString().split('T')[0];
}

function getWeekStart() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff)).toISOString().split('T')[0];
}

function loadState(): MissionState {
  const defaults: MissionState = { completions: {}, lastDailyReset: getToday(), lastWeeklyReset: getWeekStart(), totalXPEarned: 0, totalCompleted: 0 };
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const state: MissionState = { ...defaults, ...JSON.parse(saved) };
      if (!state.completions || typeof state.completions !== 'object') state.completions = {};
      const today = getToday();
      const weekStart = getWeekStart();
      if (state.lastDailyReset !== today) {
        DAILY_MISSIONS.forEach(m => { delete state.completions[m.id]; });
        state.lastDailyReset = today;
      }
      if (state.lastWeeklyReset !== weekStart) {
        WEEKLY_MISSIONS.forEach(m => { delete state.completions[m.id]; });
        state.lastWeeklyReset = weekStart;
      }
      return state;
    }
  } catch { /* fallback */ }
  return defaults;
}

interface MissionsViewProps {
  profile: MasterProfile;
  onXP?: (amount: number) => void;
}

export function MissionsView({ profile, onXP }: MissionsViewProps) {
  const [state, setState] = useState<MissionState>(loadState);
  const [activeType, setActiveType] = useState<'daily' | 'weekly' | 'challenge'>('daily');
  const { celebrate } = useCelebration();

  const today = getToday();
  const weekStart = getWeekStart();

  // Save state
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  // Auto-check mission completion
  useEffect(() => {
    const allMissions = [...DAILY_MISSIONS, ...WEEKLY_MISSIONS, ...CHALLENGES];
    let changed = false;
    const nextState = { ...state, completions: { ...state.completions } };

    allMissions.forEach(mission => {
      if (nextState.completions[mission.id]?.rewarded) return;
      const current = mission.compute(profile, today, weekStart);
      if (current >= mission.target) {
        if (!nextState.completions[mission.id]) {
          // First time completing
          nextState.completions[mission.id] = { completedAt: new Date().toISOString(), rewarded: true };
          nextState.totalXPEarned += mission.xpReward;
          nextState.totalCompleted += 1;
          changed = true;
          onXP?.(mission.xpReward);
          celebrate({ title: mission.title, xp: mission.xpReward, icon: mission.icon, sound: 'missionComplete' });
        }
      }
    });

    if (changed) {
      setState(nextState);
    }
  }, [profile, today, weekStart]);

  const getMissionList = () => {
    switch (activeType) {
      case 'daily': return DAILY_MISSIONS;
      case 'weekly': return WEEKLY_MISSIONS;
      case 'challenge': return CHALLENGES;
    }
  };

  const missions = getMissionList();

  const getProgress = (mission: Mission) => {
    const current = Math.min(mission.compute(profile, today, weekStart), mission.target);
    const completed = !!state.completions[mission.id]?.rewarded;
    return { current, completed };
  };

  const completedCount = missions.filter(m => state.completions[m.id]?.rewarded).length;
  const totalProgress = missions.length > 0 ? (completedCount / missions.length) * 100 : 0;

  const dailyCompleted = DAILY_MISSIONS.filter(m => state.completions[m.id]?.rewarded).length;
  const weeklyCompleted = WEEKLY_MISSIONS.filter(m => state.completions[m.id]?.rewarded).length;

  const tabs = [
    { id: 'daily' as const, label: 'Diárias', icon: Target, count: `${dailyCompleted}/${DAILY_MISSIONS.length}` },
    { id: 'weekly' as const, label: 'Semanais', icon: Calendar, count: `${weeklyCompleted}/${WEEKLY_MISSIONS.length}` },
    { id: 'challenge' as const, label: 'Desafios', icon: Trophy, count: `${CHALLENGES.filter(m => state.completions[m.id]?.rewarded).length}/${CHALLENGES.length}` },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div>
        <h2 className="text-2xl md:text-3xl font-black tracking-tight">
          <span className="text-gradient-red">Missões</span>
        </h2>
        <p className="text-sm text-muted-foreground mt-1">Missões são concluídas automaticamente conforme você usa o app. Continue produzindo!</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Streak', value: `${profile.streak} dias`, icon: Flame, accent: 'text-orange-400' },
          { label: 'XP em Missões', value: state.totalXPEarned.toString(), icon: Zap, accent: 'text-primary' },
          { label: 'Concluídas', value: state.totalCompleted.toString(), icon: CheckCircle2, accent: 'text-emerald-400' },
          { label: 'Nível', value: `Lv ${profile.level}`, icon: Star, accent: 'text-amber-400' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border/60 rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <s.icon className={`w-5 h-5 ${s.accent}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-lg font-bold text-foreground">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {tabs.map(tab => (
          <Button
            key={tab.id}
            size="sm"
            variant={activeType === tab.id ? 'default' : 'outline'}
            onClick={() => setActiveType(tab.id)}
            className={activeType === tab.id ? 'gradient-red text-primary-foreground border-0' : 'border-border/60'}
          >
            <tab.icon className="w-4 h-4 mr-1.5" />
            {tab.label}
            <Badge variant="outline" className="ml-2 text-[10px] border-current/30">{tab.count}</Badge>
          </Button>
        ))}
      </div>

      {/* Progress Bar */}
      <div className="bg-card border border-border/60 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-foreground">
            Progresso {activeType === 'daily' ? 'do Dia' : activeType === 'weekly' ? 'da Semana' : 'dos Desafios'}
          </p>
          <p className="text-xs text-muted-foreground">{completedCount}/{missions.length} concluídas</p>
        </div>
        <Progress value={totalProgress} className="h-2.5" />
        {totalProgress === 100 && (
          <p className="text-xs text-emerald-400 mt-2 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Todas as missões concluídas! 🔥
          </p>
        )}
      </div>

      {/* Missions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {missions.map(mission => {
          const { current, completed } = getProgress(mission);
          const pct = (current / mission.target) * 100;
          const Icon = mission.icon;
          return (
            <div
              key={mission.id}
              className={`bg-card border rounded-xl p-4 transition-all duration-300 ${
                completed
                  ? 'border-emerald-500/30 bg-emerald-500/5'
                  : `${mission.ring || 'border-border/60 hover:border-primary/30'} hover:shadow-[0_0_20px_hsl(var(--primary)/0.08)]`
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                  completed ? 'bg-emerald-500/15' : (mission.bg || 'bg-primary/10')
                }`}>
                  {completed
                    ? <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    : <Icon className={`w-5 h-5 ${mission.color}`} />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className={`text-sm font-bold ${completed ? 'text-emerald-400 line-through' : mission.color}`}>
                      {mission.title}
                    </h3>
                    <Badge variant="outline" className="text-[10px] shrink-0 border-primary/30 text-primary">
                      +{mission.xpReward} XP
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{mission.description}</p>
                  <div className="mt-3 flex items-center gap-3">
                    <Progress value={pct} className="h-1.5 flex-1" />
                    <span className="text-[10px] text-muted-foreground font-medium shrink-0">{current}/{mission.target}</span>
                  </div>
                  {completed && (
                    <p className="text-[10px] text-emerald-400/70 mt-2 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Concluída automaticamente ✓
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
