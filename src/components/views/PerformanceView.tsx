import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Plus, Eye, Heart, MessageCircle, Share2, Bookmark, TrendingUp, TrendingDown, BarChart3, Target, Filter } from 'lucide-react';
import { UserProfile, PerformanceEntry } from '@/lib/store';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';

interface PerformanceViewProps {
  profile: UserProfile;
  onUpdate: (u: Partial<UserProfile>) => void;
  onXP: (n: number) => void;
}

const catConfig: Record<string, { label: string; color: string; hex: string }> = {
  crescimento: { label: '📈 Crescimento', color: 'text-green-400', hex: '#4ade80' },
  monetizacao: { label: '💰 Monetização', color: 'text-purple-400', hex: '#c084fc' },
  vendas: { label: '🛒 Vendas', color: 'text-orange-400', hex: '#fb923c' },
};

const PIE_COLORS = ['#4ade80', '#c084fc', '#fb923c'];

function engagementRate(e: PerformanceEntry): number {
  if (!e.views) return 0;
  return ((e.likes + e.comments + e.shares + e.saves) / e.views) * 100;
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
}

const emptyEntry = (): Omit<PerformanceEntry, 'id'> => ({
  title: '', accountId: '', category: 'crescimento', date: new Date().toISOString().slice(0, 10),
  views: 0, likes: 0, comments: 0, shares: 0, saves: 0, objective: '', result: '',
});

export function PerformanceView({ profile, onUpdate, onXP }: PerformanceViewProps) {
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<PerformanceEntry, 'id'>>(emptyEntry());
  const [filterAccount, setFilterAccount] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [sortBy, setSortBy] = useState<'date' | 'best' | 'worst'>('date');

  const perf = profile.performance || [];

  const filtered = useMemo(() => {
    let list = [...perf];
    if (filterAccount !== 'all') list = list.filter(e => e.accountId === filterAccount);
    if (filterCategory !== 'all') list = list.filter(e => e.category === filterCategory);
    if (sortBy === 'best') list.sort((a, b) => b.views - a.views);
    else if (sortBy === 'worst') list.sort((a, b) => a.views - b.views);
    else list.sort((a, b) => b.date.localeCompare(a.date));
    return list;
  }, [perf, filterAccount, filterCategory, sortBy]);

  // Aggregates
  const totals = useMemo(() => {
    const t = { views: 0, likes: 0, comments: 0, shares: 0, saves: 0 };
    filtered.forEach(e => { t.views += e.views; t.likes += e.likes; t.comments += e.comments; t.shares += e.shares; t.saves += e.saves; });
    return t;
  }, [filtered]);

  const avgEngagement = useMemo(() => {
    if (!filtered.length) return 0;
    return filtered.reduce((s, e) => s + engagementRate(e), 0) / filtered.length;
  }, [filtered]);

  // Chart data
  const barData = useMemo(() =>
    filtered.slice(0, 8).reverse().map(e => ({
      name: e.title.length > 15 ? e.title.slice(0, 15) + '…' : e.title,
      views: e.views,
      engagement: +engagementRate(e).toFixed(1),
    })), [filtered]);

  const pieData = useMemo(() => {
    const cats: Record<string, number> = {};
    filtered.forEach(e => { cats[e.category] = (cats[e.category] || 0) + e.views; });
    return Object.entries(cats).map(([k, v]) => ({ name: catConfig[k]?.label || k, value: v }));
  }, [filtered]);

  const areaData = useMemo(() =>
    [...filtered].sort((a, b) => a.date.localeCompare(b.date)).map(e => ({
      date: e.date.slice(5),
      views: e.views,
      likes: e.likes,
    })), [filtered]);

  const openNew = () => { setEditId(null); setForm(emptyEntry()); setOpen(true); };
  const openEdit = (e: PerformanceEntry) => { setEditId(e.id); const { id, ...rest } = e; setForm(rest); setOpen(true); };

  const save = () => {
    if (!form.title.trim()) return;
    if (editId) {
      onUpdate({ performance: perf.map(p => p.id === editId ? { ...p, ...form } : p) });
    } else {
      onUpdate({ performance: [...perf, { id: Date.now().toString(), ...form }] });
      onXP(2);
    }
    setOpen(false);
  };

  const remove = (id: string) => {
    onUpdate({ performance: perf.filter(p => p.id !== id) });
  };

  const accountName = (id: string) => profile.accounts.find(a => a.id === id)?.username || 'Sem conta';

  const best = filtered.length ? filtered.reduce((a, b) => a.views > b.views ? a : b) : null;
  const worst = filtered.length ? filtered.reduce((a, b) => a.views < b.views ? a : b) : null;

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl md:text-2xl font-bold tracking-wide text-foreground flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" /> Performance
          </h2>
          <p className="text-xs text-muted-foreground mt-1">Analise o desempenho dos seus conteúdos</p>
        </div>
        <Button onClick={openNew} className="gradient-red text-primary-foreground gap-2 glow-red" size="sm">
          <Plus className="w-4 h-4" /> Registrar Métrica
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="w-3.5 h-3.5 text-muted-foreground" />
        <Select value={filterAccount} onValueChange={setFilterAccount}>
          <SelectTrigger className="w-[150px] h-8 text-xs bg-secondary border-border"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas contas</SelectItem>
            {profile.accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.username}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[140px] h-8 text-xs bg-secondary border-border"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            <SelectItem value="crescimento">📈 Crescimento</SelectItem>
            <SelectItem value="monetizacao">💰 Monetização</SelectItem>
            <SelectItem value="vendas">🛒 Vendas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={v => setSortBy(v as any)}>
          <SelectTrigger className="w-[150px] h-8 text-xs bg-secondary border-border"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Mais recentes</SelectItem>
            <SelectItem value="best">Melhor desempenho</SelectItem>
            <SelectItem value="worst">Pior desempenho</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {[
          { icon: Eye, label: 'Views', value: formatNum(totals.views), color: 'text-foreground' },
          { icon: Heart, label: 'Curtidas', value: formatNum(totals.likes), color: 'text-primary' },
          { icon: MessageCircle, label: 'Comentários', value: formatNum(totals.comments), color: 'text-blue-400' },
          { icon: Share2, label: 'Compartilhamentos', value: formatNum(totals.shares), color: 'text-green-400' },
          { icon: Bookmark, label: 'Salvamentos', value: formatNum(totals.saves), color: 'text-yellow-400' },
          { icon: TrendingUp, label: 'Engajamento', value: avgEngagement.toFixed(1) + '%', color: 'text-primary' },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
            className="glass-card rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <s.icon className={`w-3.5 h-3.5 ${s.color}`} />
              <span className="text-[9px] text-muted-foreground uppercase tracking-widest">{s.label}</span>
            </div>
            <p className={`text-lg font-bold font-mono-alt ${s.color}`}>{s.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Best / Worst */}
      {best && worst && filtered.length > 1 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="glass-card rounded-lg p-4 border-green-500/20">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-green-400" />
              <span className="text-[10px] text-green-400 uppercase tracking-widest font-semibold">Melhor Desempenho</span>
            </div>
            <p className="text-sm font-semibold text-foreground truncate">{best.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{formatNum(best.views)} views • {engagementRate(best).toFixed(1)}% engajamento</p>
            {best.result && <p className="text-[10px] text-green-400 mt-1">🎯 {best.result}</p>}
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="glass-card rounded-lg p-4 border-red-500/20">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="w-4 h-4 text-red-400" />
              <span className="text-[10px] text-red-400 uppercase tracking-widest font-semibold">Menor Desempenho</span>
            </div>
            <p className="text-sm font-semibold text-foreground truncate">{worst.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{formatNum(worst.views)} views • {engagementRate(worst).toFixed(1)}% engajamento</p>
            {worst.result && <p className="text-[10px] text-orange-400 mt-1">📊 {worst.result}</p>}
          </motion.div>
        </div>
      )}

      {/* Charts */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* Bar Chart */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card rounded-lg p-4 lg:col-span-2">
            <h3 className="text-xs font-semibold text-foreground mb-3 uppercase tracking-wider flex items-center gap-2">
              <BarChart3 className="w-3.5 h-3.5 text-primary" /> Views por Conteúdo
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={barData}>
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'hsl(0 0% 50%)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: 'hsl(0 0% 50%)' }} axisLine={false} tickLine={false} tickFormatter={formatNum} />
                <Tooltip
                  contentStyle={{ background: 'hsl(0 0% 6%)', border: '1px solid hsl(0 0% 13%)', borderRadius: 8, fontSize: 11 }}
                  labelStyle={{ color: 'hsl(0 0% 93%)' }}
                  formatter={(v: number) => [formatNum(v), 'Views']}
                />
                <Bar dataKey="views" fill="hsl(0 90% 48%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Pie Chart */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="glass-card rounded-lg p-4">
            <h3 className="text-xs font-semibold text-foreground mb-3 uppercase tracking-wider flex items-center gap-2">
              <Target className="w-3.5 h-3.5 text-primary" /> Views por Categoria
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value" stroke="none">
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ background: 'hsl(0 0% 6%)', border: '1px solid hsl(0 0% 13%)', borderRadius: 8, fontSize: 11 }}
                  formatter={(v: number) => [formatNum(v), 'Views']}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-3 mt-1">
              {pieData.map((d, i) => (
                <div key={d.name} className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="text-[9px] text-muted-foreground">{d.name}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      )}

      {/* Area Chart */}
      {areaData.length > 1 && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card rounded-lg p-4">
          <h3 className="text-xs font-semibold text-foreground mb-3 uppercase tracking-wider flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-primary" /> Evolução de Views e Curtidas
          </h3>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={areaData}>
              <defs>
                <linearGradient id="viewsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(0 90% 48%)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(0 90% 48%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="likesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#c084fc" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#c084fc" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'hsl(0 0% 50%)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: 'hsl(0 0% 50%)' }} axisLine={false} tickLine={false} tickFormatter={formatNum} />
              <Tooltip
                contentStyle={{ background: 'hsl(0 0% 6%)', border: '1px solid hsl(0 0% 13%)', borderRadius: 8, fontSize: 11 }}
                formatter={(v: number) => [formatNum(v)]}
              />
              <Area type="monotone" dataKey="views" stroke="hsl(0 90% 48%)" fill="url(#viewsGrad)" strokeWidth={2} />
              <Area type="monotone" dataKey="likes" stroke="#c084fc" fill="url(#likesGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>
      )}

      {/* Content List */}
      <div>
        <h3 className="text-xs font-semibold text-foreground mb-3 uppercase tracking-wider">
          Conteúdos ({filtered.length})
        </h3>
        <div className="space-y-2">
          {filtered.map((e, i) => {
            const cat = catConfig[e.category];
            const eng = engagementRate(e);
            return (
              <motion.div key={e.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                className="glass-card rounded-lg p-3 sm:p-4 cursor-pointer hover:border-primary/20 transition-all group"
                onClick={() => openEdit(e)}
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-foreground truncate">{e.title}</p>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-md ${cat?.color === 'text-green-400' ? 'bg-green-500/15 text-green-400' : cat?.color === 'text-purple-400' ? 'bg-purple-500/15 text-purple-400' : 'bg-orange-500/15 text-orange-400'}`}>
                        {cat?.label}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{accountName(e.accountId)} • {e.date}</p>
                    {e.result && <p className="text-[10px] text-primary mt-0.5">🎯 {e.result}</p>}
                  </div>
                  <div className="flex items-center gap-3 text-[10px] flex-shrink-0">
                    <div className="text-center">
                      <p className="font-bold text-foreground font-mono-alt text-xs">{formatNum(e.views)}</p>
                      <p className="text-muted-foreground">Views</p>
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-primary font-mono-alt text-xs">{formatNum(e.likes)}</p>
                      <p className="text-muted-foreground">Likes</p>
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-blue-400 font-mono-alt text-xs">{formatNum(e.comments)}</p>
                      <p className="text-muted-foreground">Coment.</p>
                    </div>
                    <div className="text-center">
                      <p className={`font-bold font-mono-alt text-xs ${eng > 10 ? 'text-green-400' : eng > 5 ? 'text-yellow-400' : 'text-red-400'}`}>{eng.toFixed(1)}%</p>
                      <p className="text-muted-foreground">Eng.</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
          {filtered.length === 0 && (
            <div className="glass-card rounded-lg p-8 text-center">
              <BarChart3 className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Nenhuma métrica registrada</p>
              <p className="text-[10px] text-muted-foreground mt-1">Clique em "Registrar Métrica" para começar</p>
            </div>
          )}
        </div>
      </div>

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-border max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground text-base">{editId ? 'Editar Métrica' : 'Registrar Métrica'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <Input placeholder="Título do conteúdo" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="bg-secondary border-border h-9" />
            <div className="grid grid-cols-2 gap-2">
              <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="bg-secondary border-border h-9" />
              <Select value={form.accountId || '_none'} onValueChange={v => setForm({ ...form, accountId: v === '_none' ? '' : v })}>
                <SelectTrigger className="bg-secondary border-border h-9"><SelectValue placeholder="Conta" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Sem conta</SelectItem>
                  {profile.accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.username}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Select value={form.category} onValueChange={v => setForm({ ...form, category: v as any })}>
              <SelectTrigger className="bg-secondary border-border h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="crescimento">📈 Crescimento</SelectItem>
                <SelectItem value="monetizacao">💰 Monetização</SelectItem>
                <SelectItem value="vendas">🛒 Vendas</SelectItem>
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-muted-foreground uppercase mb-1 block">Views</label>
                <Input type="number" value={form.views || ''} onChange={e => setForm({ ...form, views: +e.target.value })} className="bg-secondary border-border h-8 text-xs" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase mb-1 block">Curtidas</label>
                <Input type="number" value={form.likes || ''} onChange={e => setForm({ ...form, likes: +e.target.value })} className="bg-secondary border-border h-8 text-xs" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase mb-1 block">Comentários</label>
                <Input type="number" value={form.comments || ''} onChange={e => setForm({ ...form, comments: +e.target.value })} className="bg-secondary border-border h-8 text-xs" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase mb-1 block">Compartilh.</label>
                <Input type="number" value={form.shares || ''} onChange={e => setForm({ ...form, shares: +e.target.value })} className="bg-secondary border-border h-8 text-xs" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase mb-1 block">Salvamentos</label>
                <Input type="number" value={form.saves || ''} onChange={e => setForm({ ...form, saves: +e.target.value })} className="bg-secondary border-border h-8 text-xs" />
              </div>
            </div>
            <Input placeholder="Objetivo (ex: Ganhar seguidores)" value={form.objective || ''} onChange={e => setForm({ ...form, objective: e.target.value })} className="bg-secondary border-border h-9" />
            <Input placeholder="Resultado obtido (ex: +2.4k seguidores)" value={form.result || ''} onChange={e => setForm({ ...form, result: e.target.value })} className="bg-secondary border-border h-9" />
            <Button onClick={save} className="w-full gradient-red text-primary-foreground h-9 text-sm">
              {editId ? 'Salvar' : 'Registrar +2 XP'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
