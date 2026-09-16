import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Star, Pencil, Trash2, Calendar, Eye, Video, Search, X, LayoutGrid, List, Link2 } from 'lucide-react';
import { UserProfile, VideoEntry } from '@/lib/store';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { PlatformIntegrationsView } from './PlatformIntegrationsView';

const statusColors: Record<string, string> = {
  idea: 'text-muted-foreground bg-muted',
  recording: 'text-yellow-400 bg-yellow-400/10',
  editing: 'text-blue-400 bg-blue-400/10',
  posted: 'text-primary bg-primary/10',
};

const statusLabels: Record<string, string> = {
  idea: 'Ideia',
  recording: 'Gravando',
  editing: 'Editando',
  posted: 'Postado',
};

const categoryLabels: Record<string, string> = {
  crescimento: '📈 Crescimento',
  monetizacao: '💰 Monetização',
  vendas: '🛒 Vendas',
};

const categoryColors: Record<string, string> = {
  crescimento: 'bg-green-500/15 text-green-400 border-green-500/30',
  monetizacao: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  vendas: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
};

const categoryHeaderColors: Record<string, string> = {
  crescimento: 'border-green-500/40 bg-green-500/10',
  monetizacao: 'border-yellow-500/40 bg-yellow-500/10',
  vendas: 'border-blue-500/40 bg-blue-500/10',
};

interface VideosViewProps {
  profile: UserProfile;
  onUpdate: (u: Partial<UserProfile>) => void;
  onXP: (n: number) => void;
}

type ViewMode = 'list' | 'planning';
type TabMode = 'videos' | 'integrations';

export function VideosView({ profile, onUpdate, onXP }: VideosViewProps) {
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState<VideoEntry | null>(null);
  const [title, setTitle] = useState('');
  const [niche, setNiche] = useState('');
  const [category, setCategory] = useState<VideoEntry['category']>('crescimento');
  const [accountId, setAccountId] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterDate, setFilterDate] = useState<string>('');
  const [filterAccountId, setFilterAccountId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [tabMode, setTabMode] = useState<TabMode>('videos');

  const connectedAccounts = profile.accounts.filter(a => a.connected);

  const resetForm = () => {
    setTitle(''); setNiche(''); setCategory('crescimento'); setAccountId('');
  };

  const addVideo = () => {
    if (!title.trim()) { toast.error('Informe o título do vídeo'); return; }
    if (!accountId) { toast.error('Selecione uma conta'); return; }
    const v: VideoEntry = {
      id: Date.now().toString(), title, niche: niche || 'Geral', status: 'idea',
      category, accountId, scheduledDate: new Date().toISOString(),
    };
    onUpdate({ videos: [...profile.videos, v] });
    onXP(2); resetForm(); setOpen(false);
    toast.success('Vídeo adicionado! +2 XP');
  };

  const updateVideo = () => {
    if (!editingVideo) return;
    onUpdate({
      videos: profile.videos.map(v =>
        v.id === editingVideo.id ? { ...v, title, niche, category, accountId: accountId || v.accountId } : v
      ),
    });
    setEditOpen(false); setEditingVideo(null); resetForm();
    toast.success('Vídeo atualizado');
  };

  const startEdit = (v: VideoEntry) => {
    setEditingVideo(v); setTitle(v.title); setNiche(v.niche);
    setCategory(v.category); setAccountId(v.accountId || ''); setEditOpen(true);
  };

  const deleteVideo = (id: string) => {
    onUpdate({ videos: profile.videos.filter(v => v.id !== id) });
    toast.success('Vídeo removido');
  };

  const toggleFavorite = (id: string) => {
    onUpdate({
      videos: profile.videos.map(v => v.id === id ? { ...v, favorite: !(v as any).favorite } : v),
    });
  };

  const updateStatus = (id: string, status: VideoEntry['status']) => {
    onUpdate({ videos: profile.videos.map(v => v.id === id ? { ...v, status } : v) });
    if (status === 'posted') onXP(3);
  };

  // Apply filters
  let filtered = profile.videos;
  if (filterAccountId !== 'all') filtered = filtered.filter(v => v.accountId === filterAccountId);
  if (filterStatus !== 'all') filtered = filtered.filter(v => v.status === filterStatus);
  if (filterCategory !== 'all') filtered = filtered.filter(v => v.category === filterCategory);
  if (filterDate) filtered = filtered.filter(v => v.scheduledDate?.startsWith(filterDate));
  if (searchQuery) filtered = filtered.filter(v => v.title.toLowerCase().includes(searchQuery.toLowerCase()));

  const getAccountById = (id?: string) => profile.accounts.find(a => a.id === id);

  const activeFiltersCount = [
    filterAccountId !== 'all', filterStatus !== 'all', filterCategory !== 'all', !!filterDate
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    setFilterAccountId('all'); setFilterStatus('all'); setFilterCategory('all');
    setFilterDate(''); setSearchQuery('');
  };

  // Video card component used in both views
  const VideoCard = ({ v, compact = false }: { v: VideoEntry; compact?: boolean }) => {
    const account = getAccountById(v.accountId);
    return (
      <div className={`glass-card rounded-xl ${compact ? 'p-3' : 'p-4'} hover:border-primary/30 transition-all`}>
        <div className={`flex ${compact ? 'flex-col gap-2' : 'items-start gap-3'}`}>
          {!compact && (
            <div className="w-14 h-14 rounded-lg bg-secondary border border-border flex items-center justify-center flex-shrink-0">
              {v.thumbnail ? (
                <img src={v.thumbnail} alt="" className="w-full h-full object-cover rounded-lg" />
              ) : (
                <Video className="w-5 h-5 text-muted-foreground/50" />
              )}
            </div>
          )}
          <div className="flex-1 min-w-0 space-y-1">
            <p className={`${compact ? 'text-xs' : 'text-sm'} font-medium text-foreground truncate`}>{v.title}</p>
            {account && (
              <p className="text-[10px] text-muted-foreground truncate">{account.displayName} · {account.username}</p>
            )}
            <p className="text-[10px] text-muted-foreground/70">
              {v.scheduledDate ? new Date(v.scheduledDate).toLocaleDateString('pt-BR') : 'Sem data'}
            </p>
            <div className="flex items-center justify-between gap-1 pt-1">
              <Select value={v.status} onValueChange={(val) => updateStatus(v.id, val as VideoEntry['status'])}>
                <SelectTrigger className={`${compact ? 'w-24 h-6 text-[10px]' : 'w-28 h-7 text-[11px]'} border-0 flex-shrink-0 ${statusColors[v.status]}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {Object.entries(statusLabels).map(([k, l]) => (
                    <SelectItem key={k} value={k} className="text-foreground">{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-0.5">
                <Button variant="ghost" size="sm" onClick={() => toggleFavorite(v.id)}
                  className={`h-6 w-6 p-0 ${(v as any).favorite ? 'text-yellow-400' : 'text-muted-foreground hover:text-yellow-400'}`}>
                  <Star className={`w-3 h-3 ${(v as any).favorite ? 'fill-current' : ''}`} />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => startEdit(v)} className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground">
                  <Pencil className="w-3 h-3" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => deleteVideo(v.id)} className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-wide text-foreground">Vídeos</h2>
          <p className="text-sm text-muted-foreground mt-1">{profile.videos.length} vídeos organizados</p>
        </div>
        {tabMode === 'videos' && (
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gradient-red text-primary-foreground gap-2 glow-red">
              <Plus className="w-4 h-4" /> Novo Vídeo
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader><DialogTitle className="text-foreground">Novo Vídeo</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <Input placeholder="Título do vídeo" value={title} onChange={e => setTitle(e.target.value)} className="bg-secondary border-border" />
              <Input placeholder="Nicho" value={niche} onChange={e => setNiche(e.target.value)} className="bg-secondary border-border" />
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Selecione a conta TikTok" /></SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {connectedAccounts.map(a => (
                    <SelectItem key={a.id} value={a.id} className="text-foreground">{a.displayName} ({a.username})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={category} onValueChange={(v) => setCategory(v as VideoEntry['category'])}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Objetivo" /></SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="crescimento">📈 Crescimento</SelectItem>
                  <SelectItem value="monetizacao">💰 Monetização</SelectItem>
                  <SelectItem value="vendas">🛒 Vendas</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={addVideo} className="w-full gradient-red text-primary-foreground">Criar +2 XP</Button>
            </div>
          </DialogContent>
        </Dialog>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 rounded-lg border border-border bg-secondary/30 p-1">
        <button
          onClick={() => setTabMode('videos')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-medium transition-all flex-1 justify-center ${
            tabMode === 'videos'
              ? 'bg-primary/15 text-primary border border-primary/20'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Video className="w-3.5 h-3.5" /> Meus Vídeos
        </button>
        <button
          onClick={() => setTabMode('integrations')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-medium transition-all flex-1 justify-center ${
            tabMode === 'integrations'
              ? 'bg-primary/15 text-primary border border-primary/20'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Link2 className="w-3.5 h-3.5" /> Integrar Plataformas
        </button>
      </div>

      {tabMode === 'integrations' ? (
        <PlatformIntegrationsView profile={profile} onUpdate={onUpdate} onXP={onXP} />
      ) : (
      <>

      {/* Quick Filters Bar */}
      <div className="glass-card rounded-xl p-4 space-y-3">
        {/* Search + View Toggle */}
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar vídeos..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10 bg-secondary border-border" />
          </div>
          <div className="flex rounded-lg border border-border overflow-hidden flex-shrink-0">
            <button onClick={() => setViewMode('list')}
              className={`px-3 py-2 transition-all ${viewMode === 'list' ? 'bg-primary/15 text-primary' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
              <List className="w-4 h-4" />
            </button>
            <button onClick={() => setViewMode('planning')}
              className={`px-3 py-2 transition-all ${viewMode === 'planning' ? 'bg-primary/15 text-primary' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter rows */}
        <div className="flex gap-2 flex-wrap items-center">
          {/* Account filter */}
          <Select value={filterAccountId} onValueChange={setFilterAccountId}>
            <SelectTrigger className={`w-auto min-w-[140px] h-8 text-xs border ${filterAccountId !== 'all' ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border bg-secondary text-muted-foreground'}`}>
              <SelectValue placeholder="Conta" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="all" className="text-foreground">Todas Contas</SelectItem>
              {connectedAccounts.map(a => (
                <SelectItem key={a.id} value={a.id} className="text-foreground">{a.displayName}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Category chips */}
          {['all', 'crescimento', 'monetizacao', 'vendas'].map(c => (
            <button key={c} onClick={() => setFilterCategory(c)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                filterCategory === c
                  ? (c === 'all' ? 'bg-primary/15 text-primary border-primary/30' : categoryColors[c])
                  : 'bg-secondary text-muted-foreground border-border hover:text-foreground'
              }`}>
              {c === 'all' ? 'Todas' : categoryLabels[c]}
            </button>
          ))}

          {/* Status chips */}
          <div className="w-px h-5 bg-border hidden sm:block" />
          {['all', 'idea', 'recording', 'editing', 'posted'].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                filterStatus === s ? 'bg-primary/15 text-primary border-primary/30' : 'bg-secondary text-muted-foreground border-border hover:text-foreground'
              }`}>
              {s === 'all' ? 'Status' : statusLabels[s]}
            </button>
          ))}

          {/* Date filter */}
          <div className="flex gap-1 items-center">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
            <Input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
              className={`bg-secondary border-border w-[140px] h-8 text-xs ${filterDate ? 'border-primary/40 text-primary' : ''}`} />
            {filterDate && (
              <Button variant="ghost" size="sm" onClick={() => setFilterDate('')} className="h-6 w-6 p-0 text-muted-foreground">
                <X className="w-3 h-3" />
              </Button>
            )}
          </div>

          {/* Clear all */}
          {activeFiltersCount > 0 && (
            <button onClick={clearAllFilters} className="px-3 py-1.5 rounded-lg text-xs font-medium text-destructive bg-destructive/10 border border-destructive/20 hover:bg-destructive/20 transition-all">
              Limpar ({activeFiltersCount})
            </button>
          )}
        </div>
      </div>

      {/* List View */}
      {viewMode === 'list' && (
        <div className="space-y-3">
          {filtered.map((v, i) => (
            <motion.div key={v.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
              <VideoCard v={v} />
            </motion.div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">Nenhum vídeo encontrado</div>
          )}
        </div>
      )}

      {/* Planning View (Kanban by Category) */}
      {viewMode === 'planning' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(['crescimento', 'monetizacao', 'vendas'] as const).map(cat => {
            const catVideos = filtered.filter(v => v.category === cat);
            return (
              <div key={cat} className="space-y-3">
                {/* Column header */}
                <div className={`rounded-xl p-3 border ${categoryHeaderColors[cat]} flex items-center justify-between`}>
                  <span className="text-sm font-semibold">{categoryLabels[cat]}</span>
                  <span className="text-xs text-muted-foreground bg-secondary/60 px-2 py-0.5 rounded-full">{catVideos.length}</span>
                </div>
                {/* Column videos */}
                <div className="space-y-2 min-h-[100px]">
                  <AnimatePresence>
                    {catVideos.map((v, i) => (
                      <motion.div key={v.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: i * 0.03 }}>
                        <VideoCard v={v} compact />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {catVideos.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground/50 text-xs border border-dashed border-border rounded-xl">
                      Nenhum vídeo
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      </>
      )}

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={(v) => { setEditOpen(v); if (!v) { setEditingVideo(null); resetForm(); } }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle className="text-foreground">Editar Vídeo</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <Input placeholder="Título do vídeo" value={title} onChange={e => setTitle(e.target.value)} className="bg-secondary border-border" />
            <Input placeholder="Nicho" value={niche} onChange={e => setNiche(e.target.value)} className="bg-secondary border-border" />
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Selecione a conta TikTok" /></SelectTrigger>
              <SelectContent className="bg-card border-border">
                {connectedAccounts.map(a => (
                  <SelectItem key={a.id} value={a.id} className="text-foreground">{a.displayName} ({a.username})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={category} onValueChange={(v) => setCategory(v as VideoEntry['category'])}>
              <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Objetivo" /></SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="crescimento">📈 Crescimento</SelectItem>
                <SelectItem value="monetizacao">💰 Monetização</SelectItem>
                <SelectItem value="vendas">🛒 Vendas</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={updateVideo} className="w-full gradient-red text-primary-foreground">Salvar Alterações</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
