import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Check, Clock, ChevronLeft, ChevronRight, Trash2, Bell, BellOff, Settings2, Volume2, VolumeX, Vibrate } from 'lucide-react';
import { UserProfile, ScheduleEntry } from '@/lib/store';
import { getNotifSettings, saveNotifSettings, type NotificationSettings } from '@/components/views/NotificationSettingsView';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/sonner';

interface ScheduleViewProps {
  profile: UserProfile;
  onUpdate: (u: Partial<UserProfile>) => void;
  onXP: (n: number) => void;
}

const statusConfig: Record<ScheduleEntry['status'], { label: string; color: string; icon: string }> = {
  idea: { label: 'Ideia', color: 'bg-muted text-muted-foreground', icon: '💡' },
  producing: { label: 'Em Produção', color: 'bg-yellow-500/20 text-yellow-400', icon: '🎬' },
  ready: { label: 'Pronto', color: 'bg-blue-500/20 text-blue-400', icon: '✅' },
  scheduled: { label: 'Agendado', color: 'bg-purple-500/20 text-purple-400', icon: '📅' },
  posted: { label: 'Postado', color: 'bg-primary/20 text-primary', icon: '📤' },
};

const categoryConfig: Record<string, { label: string; color: string }> = {
  crescimento: { label: 'Crescimento', color: 'bg-green-500/20 text-green-400' },
  monetizacao: { label: 'Monetização', color: 'bg-purple-500/20 text-purple-400' },
  vendas: { label: 'Vendas', color: 'bg-orange-500/20 text-orange-400' },
};

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function getWeekDates(baseDate: Date): Date[] {
  const day = baseDate.getDay();
  const start = new Date(baseDate);
  start.setDate(start.getDate() - day);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function getMonthDates(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const startDay = first.getDay();
  const dates: Date[] = [];
  for (let i = -startDay; i < 42 - startDay; i++) {
    dates.push(new Date(year, month, 1 + i));
  }
  return dates;
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function fmtDisplay(d: Date): string {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}


const emptyEntry = (): Omit<ScheduleEntry, 'id'> => ({
  title: '', date: fmtDate(new Date()), time: '12:00', status: 'idea',
  description: '', hashtags: '', category: 'crescimento', accountId: '', objective: '',
});

// ─── Notification Settings Panel ───
function NotifSettingsPanel({ settings, onChange }: { settings: NotificationSettings; onChange: (s: NotificationSettings) => void }) {
  const update = (patch: Partial<NotificationSettings>) => {
    const next = { ...settings, ...patch };
    onChange(next);
    saveNotifSettings(next);
  };

  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="glass-card rounded-xl p-4 space-y-4">
      <h3 className="text-sm font-bold text-foreground flex items-center gap-2"><Bell className="w-4 h-4 text-primary" /> Configurações de Notificação</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-secondary/50">
          <Label className="text-xs text-muted-foreground flex items-center gap-1.5"><Bell className="w-3.5 h-3.5" /> Notificações</Label>
          <Switch checked={settings.enabled} onCheckedChange={v => update({ enabled: v })} />
        </div>
        <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-secondary/50">
          <Label className="text-xs text-muted-foreground flex items-center gap-1.5"><Vibrate className="w-3.5 h-3.5" /> Vibração</Label>
          <Switch checked={settings.vibration} onCheckedChange={v => update({ vibration: v })} />
        </div>
        <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-secondary/50">
          <Label className="text-xs text-muted-foreground flex items-center gap-1.5">{settings.sound ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />} Som</Label>
          <Switch checked={settings.sound} onCheckedChange={v => update({ sound: v })} />
        </div>
        <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-secondary/50">
          <Label className="text-xs text-muted-foreground flex items-center gap-1.5"><Check className="w-3.5 h-3.5" /> Confirmar postagem</Label>
          <Switch checked={settings.confirmPosted} onCheckedChange={v => update({ confirmPosted: v })} />
        </div>
      </div>
      <div className="flex items-center gap-3 p-2 rounded-lg bg-secondary/50">
        <Label className="text-xs text-muted-foreground whitespace-nowrap">Lembrar antes:</Label>
        <Select value={String(settings.reminderMinutes)} onValueChange={v => update({ reminderMinutes: Number(v) })}>
          <SelectTrigger className="bg-background border-border h-8 text-xs w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[5, 10, 15, 30, 60].map(m => <SelectItem key={m} value={String(m)}>{m} min</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </motion.div>
  );
}

// ─── Main View ───
export function ScheduleView({ profile, onUpdate, onXP }: ScheduleViewProps) {
  const [view, setView] = useState<'week' | 'month'>('week');
  const [baseDate, setBaseDate] = useState(new Date());
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<ScheduleEntry, 'id'>>(emptyEntry());
  const [showSettings, setShowSettings] = useState(false);
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>(getNotifSettings);

  const navigate = (dir: number) => {
    const d = new Date(baseDate);
    if (view === 'week') d.setDate(d.getDate() + dir * 7);
    else d.setMonth(d.getMonth() + dir);
    setBaseDate(d);
  };

  const scheduleMap = useMemo(() => {
    const map: Record<string, ScheduleEntry[]> = {};
    profile.schedule.forEach(s => { (map[s.date] = map[s.date] || []).push(s); });
    return map;
  }, [profile.schedule]);

  // Simple in-app notification check
  useEffect(() => {
    if (!notifSettings.enabled) return;
    const interval = setInterval(() => {
      const now = new Date();
      const nowStr = fmtDate(now);
      const nowMinutes = now.getHours() * 60 + now.getMinutes();

      profile.schedule.forEach(entry => {
        if (entry.date !== nowStr) return;
        if (entry.status === 'posted') return;
        const [h, m] = entry.time.split(':').map(Number);
        const entryMinutes = h * 60 + m;
        const diff = entryMinutes - nowMinutes;

        if (diff === notifSettings.reminderMinutes) {
          toast(`⏰ Lembrete: "${entry.title}" em ${notifSettings.reminderMinutes} min!`);
          if (notifSettings.vibration && navigator.vibrate) navigator.vibrate(200);
        }
        if (diff === 0) {
          toast(`🚀 Hora de postar: "${entry.title}"!`);
          if (notifSettings.vibration && navigator.vibrate) navigator.vibrate([200, 100, 200]);
        }
        if (diff < -15 && entry.status === 'scheduled') {
          toast(`⚠️ Postagem pendente: "${entry.title}" não foi confirmada.`);
        }
      });
    }, 60000);
    return () => clearInterval(interval);
  }, [profile.schedule, notifSettings]);

  const openNew = (date?: string) => {
    setEditId(null);
    setForm({ ...emptyEntry(), date: date || fmtDate(new Date()) });
    setOpen(true);
  };

  const openEdit = (entry: ScheduleEntry) => {
    setEditId(entry.id);
    const { id, ...rest } = entry;
    setForm(rest);
    setOpen(true);
  };

  const save = () => {
    if (!form.title.trim() || !form.date) return;
    if (editId) {
      onUpdate({ schedule: profile.schedule.map(s => s.id === editId ? { ...s, ...form } : s) });
    } else {
      const entry: ScheduleEntry = { id: Date.now().toString(), ...form };
      onUpdate({ schedule: [...profile.schedule, entry] });
      onXP(2);
    }
    setOpen(false);
    setForm(emptyEntry());
    setEditId(null);
  };

  const remove = (id: string) => {
    onUpdate({ schedule: profile.schedule.filter(s => s.id !== id) });
  };

  const markAsPosted = useCallback((id: string) => {
    const now = new Date().toISOString();
    onUpdate({
      schedule: profile.schedule.map(s =>
        s.id === id ? { ...s, status: 'posted' as const, postedAt: now } : s
      ),
    });
    onXP(5);
    if (notifSettings.confirmPosted) {
      toast('✅ Postagem confirmada! +5 XP');
    }
    if (notifSettings.vibration && navigator.vibrate) navigator.vibrate(100);
  }, [profile.schedule, onUpdate, onXP, notifSettings]);

  const cycleStatus = (id: string) => {
    const order: ScheduleEntry['status'][] = ['idea', 'producing', 'ready', 'scheduled', 'posted'];
    const entry = profile.schedule.find(s => s.id === id);
    if (!entry) return;
    const nextIdx = (order.indexOf(entry.status) + 1) % order.length;
    const next = order[nextIdx];
    if (next === 'posted') {
      markAsPosted(id);
    } else {
      onUpdate({
        schedule: profile.schedule.map(s => s.id === id ? { ...s, status: next } : s),
      });
    }
  };

  const weekDates = getWeekDates(baseDate);
  const monthDates = getMonthDates(baseDate.getFullYear(), baseDate.getMonth());
  const currentMonth = baseDate.getMonth();
  const headerLabel = view === 'week'
    ? `${fmtDisplay(weekDates[0])} — ${fmtDisplay(weekDates[6])}`
    : baseDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const accountName = (id?: string) => profile.accounts.find(a => a.id === id)?.username || '';

  const renderEntry = (entry: ScheduleEntry, compact = false) => {
    const st = statusConfig[entry.status] || statusConfig.idea;
    const cat = entry.category ? categoryConfig[entry.category] : null;
    return (
      <motion.div
        key={entry.id}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`glass-card rounded-lg ${compact ? 'p-1.5' : 'p-3'} cursor-pointer hover:border-primary/30 transition-all group`}
        onClick={() => openEdit(entry)}
      >
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0 flex-1">
            <p className={`font-medium text-foreground truncate ${compact ? 'text-[10px]' : 'text-sm'}`}>{entry.title}</p>
            {!compact && (
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                <Clock className="w-3 h-3" /> {entry.time}
                {accountName(entry.accountId) && <span>• {accountName(entry.accountId)}</span>}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
            {entry.status !== 'posted' && (
              <button onClick={() => markAsPosted(entry.id)} className="p-1 rounded hover:bg-primary/20" title="Marcar como postado">
                <Check className="w-3 h-3 text-primary" />
              </button>
            )}
            <button onClick={() => cycleStatus(entry.id)} className="p-1 rounded hover:bg-secondary" title="Mudar status">
              <Clock className="w-3 h-3 text-muted-foreground" />
            </button>
            <button onClick={() => remove(entry.id)} className="p-1 rounded hover:bg-destructive/20" title="Remover">
              <Trash2 className="w-3 h-3 text-muted-foreground" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1 mt-1 flex-wrap">
          <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${st.color}`}>{st.icon} {st.label}</span>
          {cat && <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${cat.color}`}>{cat.label}</span>}
        </div>
        {entry.status === 'posted' && entry.postedAt && !compact && (
          <p className="text-[9px] text-muted-foreground mt-1">Postado: {new Date(entry.postedAt).toLocaleString('pt-BR')}</p>
        )}
      </motion.div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-wide text-foreground">Cronograma de Postagens</h2>
          <p className="text-sm text-muted-foreground mt-1">Planeje, organize e mantenha consistência</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setShowSettings(!showSettings)} className={showSettings ? 'text-primary' : 'text-muted-foreground'}>
            {notifSettings.enabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
          </Button>
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button onClick={() => setView('week')} className={`px-3 py-1.5 text-xs font-medium transition-colors ${view === 'week' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'}`}>Semanal</button>
            <button onClick={() => setView('month')} className={`px-3 py-1.5 text-xs font-medium transition-colors ${view === 'month' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'}`}>Mensal</button>
          </div>
          <Button onClick={() => openNew()} className="gradient-red text-primary-foreground gap-2 glow-red" size="sm">
            <Plus className="w-4 h-4" /> Agendar
          </Button>
        </div>
      </div>

      {/* Notification Settings */}
      <AnimatePresence>
        {showSettings && <NotifSettingsPanel settings={notifSettings} onChange={setNotifSettings} />}
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ChevronLeft className="w-4 h-4" /></Button>
        <p className="text-sm font-semibold text-foreground capitalize">{headerLabel}</p>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => setBaseDate(new Date())} className="text-xs text-primary">Hoje</Button>
          <Button variant="ghost" size="icon" onClick={() => navigate(1)}><ChevronRight className="w-4 h-4" /></Button>
        </div>
      </div>

      {/* Week View */}
      {view === 'week' && (
        <div className="grid grid-cols-7 gap-2">
          {weekDates.map(d => {
            const key = fmtDate(d);
            const entries = scheduleMap[key] || [];
            const isToday = key === fmtDate(new Date());
            return (
              <div key={key} className="min-h-[140px]">
                <div className={`text-center py-1.5 rounded-t-lg text-xs font-semibold ${isToday ? 'bg-primary/15 text-primary' : 'bg-secondary text-muted-foreground'}`}>
                  <div>{WEEKDAYS[d.getDay()]}</div>
                  <div className={`text-lg ${isToday ? 'text-primary' : 'text-foreground'}`}>{d.getDate()}</div>
                </div>
                <div className="space-y-1 mt-1">
                  {entries.sort((a, b) => a.time.localeCompare(b.time)).map(e => renderEntry(e, true))}
                  <button onClick={() => openNew(key)} className="w-full text-center py-1 text-muted-foreground hover:text-primary text-xs rounded hover:bg-secondary/50 transition-colors">
                    <Plus className="w-3 h-3 inline" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Month View */}
      {view === 'month' && (
        <div>
          <div className="grid grid-cols-7 gap-px mb-1">
            {WEEKDAYS.map(w => (
              <div key={w} className="text-center text-[10px] font-semibold text-muted-foreground py-1">{w}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px">
            {monthDates.map(d => {
              const key = fmtDate(d);
              const entries = scheduleMap[key] || [];
              const isToday = key === fmtDate(new Date());
              const isCurrentMonth = d.getMonth() === currentMonth;
              return (
                <div
                  key={key}
                  className={`min-h-[90px] p-1 rounded border transition-colors cursor-pointer hover:border-primary/30 ${isToday ? 'border-primary/50 bg-primary/5' : 'border-border'} ${!isCurrentMonth ? 'opacity-40' : ''}`}
                  onClick={() => openNew(key)}
                >
                  <div className={`text-[10px] font-medium mb-1 ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>{d.getDate()}</div>
                  <div className="space-y-0.5" onClick={e => e.stopPropagation()}>
                    {entries.slice(0, 2).map(e => {
                      const st = statusConfig[e.status] || statusConfig.idea;
                      return (
                        <div key={e.id} onClick={() => openEdit(e)} className={`text-[9px] truncate px-1 py-0.5 rounded cursor-pointer hover:opacity-80 ${st.color}`}>
                          {e.title}
                        </div>
                      );
                    })}
                    {entries.length > 2 && <div className="text-[9px] text-muted-foreground px-1">+{entries.length - 2}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Status Legend */}
      <div className="flex items-center gap-3 flex-wrap pt-2">
        {Object.entries(statusConfig).map(([k, v]) => (
          <div key={k} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${v.color.split(' ')[0]}`} />
            <span className="text-[10px] text-muted-foreground">{v.icon} {v.label}</span>
          </div>
        ))}
      </div>

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-border max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground">{editId ? 'Editar Postagem' : 'Agendar Postagem'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <Input placeholder="Título" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="bg-secondary border-border" />
            <div className="grid grid-cols-2 gap-2">
              <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="bg-secondary border-border" />
              <Input type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} className="bg-secondary border-border" />
            </div>
            <Select value={form.accountId || '_none'} onValueChange={v => setForm({ ...form, accountId: v === '_none' ? '' : v })}>
              <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Conta TikTok" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Sem conta</SelectItem>
                {profile.accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.username}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={form.category || 'crescimento'} onValueChange={v => setForm({ ...form, category: v as any })}>
              <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="crescimento">📈 Crescimento</SelectItem>
                <SelectItem value="monetizacao">💰 Monetização</SelectItem>
                <SelectItem value="vendas">🛒 Vendas</SelectItem>
              </SelectContent>
            </Select>
            <Select value={form.status} onValueChange={v => setForm({ ...form, status: v as any })}>
              <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(statusConfig).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.icon} {v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input placeholder="Objetivo do vídeo (ex: gerar leads)" value={form.objective || ''} onChange={e => setForm({ ...form, objective: e.target.value })} className="bg-secondary border-border" />
            <Textarea placeholder="Descrição (opcional)" value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} className="bg-secondary border-border" rows={2} />
            <Input placeholder="Hashtags (ex: #tiktok #viral)" value={form.hashtags || ''} onChange={e => setForm({ ...form, hashtags: e.target.value })} className="bg-secondary border-border" />
            <Button onClick={save} className="w-full gradient-red text-primary-foreground">
              {editId ? 'Salvar' : 'Agendar +20 XP'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
