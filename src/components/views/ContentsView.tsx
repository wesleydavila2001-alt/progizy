import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Plus, Star, List, LayoutGrid, Search, Filter,
  ExternalLink, ChevronDown, Heart, Eye, Pencil, Trash2, Copy
} from 'lucide-react';
import { UserProfile, ContentEntry } from '@/lib/store';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

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

const statusLabels: Record<string, string> = {
  idea: 'Ideia',
  producing: 'Produzindo',
  ready: 'Pronto',
  posted: 'Postado',
};

const statusColors: Record<string, string> = {
  idea: 'text-muted-foreground bg-muted',
  producing: 'text-yellow-400 bg-yellow-400/10',
  ready: 'text-blue-400 bg-blue-400/10',
  posted: 'text-primary bg-primary/10',
};

const priorityLabels: Record<string, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
};

const priorityColors: Record<string, string> = {
  low: 'text-muted-foreground',
  medium: 'text-yellow-400',
  high: 'text-primary',
};

interface ContentsViewProps {
  profile: UserProfile;
  onUpdate: (u: Partial<UserProfile>) => void;
  onXP: (n: number) => void;
}

const emptyContent: Omit<ContentEntry, 'id' | 'createdAt'> = {
  title: '',
  category: 'crescimento',
  objective: '',
  videoLink: '',
  imageUrl: '',
  description: '',
  hashtags: '',
  cta: '',
  observations: '',
  status: 'idea',
  priority: 'medium',
  accountId: '',
  favorite: false,
};

export function ContentsView({ profile, onUpdate, onXP }: ContentsViewProps) {
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');
  const [open, setOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedContent, setSelectedContent] = useState<ContentEntry | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState(emptyContent);
  const [searchQuery, setSearchQuery] = useState('');

  // Filters
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterAccount, setFilterAccount] = useState('all');
  const [filterFavorite, setFilterFavorite] = useState(false);

  const contents = profile.contents || [];

  const filtered = contents.filter(c => {
    if (filterCategory !== 'all' && c.category !== filterCategory) return false;
    if (filterStatus !== 'all' && c.status !== filterStatus) return false;
    if (filterPriority !== 'all' && c.priority !== filterPriority) return false;
    if (filterAccount !== 'all' && c.accountId !== filterAccount) return false;
    if (filterFavorite && !c.favorite) return false;
    if (searchQuery && !c.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const setField = (key: string, value: string | boolean) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    if (!form.title.trim()) return;
    if (editMode && selectedContent) {
      onUpdate({
        contents: contents.map(c =>
          c.id === selectedContent.id ? { ...c, ...form } : c
        ),
      });
    } else {
      const entry: ContentEntry = {
        ...form,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
      };
      onUpdate({ contents: [...contents, entry] });
      onXP(2);
    }
    setForm(emptyContent);
    setEditMode(false);
    setOpen(false);
  };

  const handleEdit = (c: ContentEntry) => {
    setSelectedContent(c);
    setForm({ ...c });
    setEditMode(true);
    setDetailOpen(false);
    setOpen(true);
  };

  const handleDelete = (id: string) => {
    onUpdate({ contents: contents.filter(c => c.id !== id) });
    setDetailOpen(false);
  };

  const handleDuplicate = (c: ContentEntry) => {
    const duplicate: ContentEntry = {
      ...c,
      id: Date.now().toString(),
      title: `${c.title} (cópia)`,
      createdAt: new Date().toISOString(),
      favorite: false,
    };
    onUpdate({ contents: [...contents, duplicate] });
    onXP(1);
    setDetailOpen(false);
  };

  const toggleFavorite = (id: string) => {
    onUpdate({
      contents: contents.map(c =>
        c.id === id ? { ...c, favorite: !c.favorite } : c
      ),
    });
  };

  const openNew = () => {
    setForm(emptyContent);
    setEditMode(false);
    setOpen(true);
  };

  const openDetail = (c: ContentEntry) => {
    setSelectedContent(c);
    setDetailOpen(true);
  };

  const getAccountName = (accountId: string) => {
    const acc = profile.accounts.find(a => a.id === accountId);
    return acc ? acc.username : '—';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-wide text-foreground">Conteúdos</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {contents.length} conteúdos · {contents.filter(c => c.favorite).length} favoritos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('cards')}
            className={`p-2 rounded-lg transition-all ${viewMode === 'cards' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <List className="w-4 h-4" />
          </button>
          <Button onClick={openNew} className="gradient-red text-primary-foreground gap-2 glow-red">
            <Plus className="w-4 h-4" /> Novo Conteúdo
          </Button>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar conteúdos..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10 bg-secondary border-border"
          />
        </div>

        {/* Category pills */}
        <div className="flex gap-2 flex-wrap">
          {['all', 'crescimento', 'monetizacao', 'vendas'].map(c => (
            <button
              key={c}
              onClick={() => setFilterCategory(c)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filterCategory === c
                  ? (c === 'all' ? 'bg-primary/15 text-primary border border-primary/30' : categoryColors[c] + ' border')
                  : 'bg-secondary text-muted-foreground border border-border hover:text-foreground'
              }`}
            >
              {c === 'all' ? 'Todas' : categoryLabels[c]}
            </button>
          ))}
        </div>

        {/* Extra filters */}
        <div className="flex gap-2 flex-wrap">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-32 h-8 text-xs bg-secondary border-border">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="all">Todos Status</SelectItem>
              {Object.entries(statusLabels).map(([k, l]) => (
                <SelectItem key={k} value={k}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger className="w-32 h-8 text-xs bg-secondary border-border">
              <SelectValue placeholder="Prioridade" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="all">Todas Prioridades</SelectItem>
              {Object.entries(priorityLabels).map(([k, l]) => (
                <SelectItem key={k} value={k}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterAccount} onValueChange={setFilterAccount}>
            <SelectTrigger className="w-40 h-8 text-xs bg-secondary border-border">
              <SelectValue placeholder="Conta" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="all">Todas Contas</SelectItem>
              {profile.accounts.map(a => (
                <SelectItem key={a.id} value={a.id}>{a.username}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <button
            onClick={() => setFilterFavorite(!filterFavorite)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all flex items-center gap-1 ${
              filterFavorite
                ? 'bg-primary/15 text-primary border-primary/30'
                : 'bg-secondary text-muted-foreground border-border hover:text-foreground'
            }`}
          >
            <Star className="w-3 h-3" /> Favoritos
          </button>
        </div>
      </div>

      {/* Content grid / list */}
      {viewMode === 'cards' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass-card rounded-xl overflow-hidden hover:border-primary/30 transition-all cursor-pointer group"
              onClick={() => openDetail(c)}
            >
              {c.imageUrl && (
                <div className="h-32 bg-secondary overflow-hidden">
                  <img src={c.imageUrl} alt={c.title} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-foreground line-clamp-2">{c.title}</h3>
                  <button
                    onClick={e => { e.stopPropagation(); toggleFavorite(c.id); }}
                    className="flex-shrink-0"
                  >
                    <Star className={`w-4 h-4 transition-all ${c.favorite ? 'text-primary fill-primary' : 'text-muted-foreground hover:text-primary'}`} />
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${categoryColors[c.category]}`}>
                    {categoryLabels[c.category]}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusColors[c.status]}`}>
                    {statusLabels[c.status]}
                  </span>
                </div>

                {c.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{c.description}</p>
                )}

                <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border">
                  <span className={priorityColors[c.priority]}>● {priorityLabels[c.priority]}</span>
                  {c.accountId && <span>{getAccountName(c.accountId)}</span>}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className="glass-card rounded-xl p-4 flex items-center gap-4 hover:border-primary/30 transition-all cursor-pointer"
              onClick={() => openDetail(c)}
            >
              <button
                onClick={e => { e.stopPropagation(); toggleFavorite(c.id); }}
                className="flex-shrink-0"
              >
                <Star className={`w-4 h-4 ${c.favorite ? 'text-primary fill-primary' : 'text-muted-foreground'}`} />
              </button>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{c.title}</p>
                <p className="text-xs text-muted-foreground truncate">{c.objective || c.description || '—'}</p>
              </div>

              <span className={`text-[10px] px-2 py-0.5 rounded-full border flex-shrink-0 ${categoryColors[c.category]}`}>
                {categoryLabels[c.category]}
              </span>

              <span className={`text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 ${statusColors[c.status]}`}>
                {statusLabels[c.status]}
              </span>

              <span className={`text-xs flex-shrink-0 ${priorityColors[c.priority]}`}>
                ● {priorityLabels[c.priority]}
              </span>

              {c.accountId && (
                <span className="text-[10px] text-muted-foreground flex-shrink-0 hidden md:block">
                  {getAccountName(c.accountId)}
                </span>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-16 text-muted-foreground text-sm">
          Nenhum conteúdo encontrado
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {editMode ? 'Editar Conteúdo' : 'Novo Conteúdo'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <Input placeholder="Título *" value={form.title} onChange={e => setField('title', e.target.value)} className="bg-secondary border-border" />

            <div className="grid grid-cols-2 gap-3">
              <Select value={form.category} onValueChange={v => setField('category', v)}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="crescimento">📈 Crescimento</SelectItem>
                  <SelectItem value="monetizacao">💰 Monetização</SelectItem>
                  <SelectItem value="vendas">🛒 Vendas</SelectItem>
                </SelectContent>
              </Select>

              <Select value={form.status} onValueChange={v => setField('status', v)}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {Object.entries(statusLabels).map(([k, l]) => (
                    <SelectItem key={k} value={k}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Select value={form.priority} onValueChange={v => setField('priority', v)}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="Prioridade" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {Object.entries(priorityLabels).map(([k, l]) => (
                    <SelectItem key={k} value={k}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={form.accountId || 'none'} onValueChange={v => setField('accountId', v === 'none' ? '' : v)}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="Conta TikTok" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="none">Nenhuma conta</SelectItem>
                  {profile.accounts.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.username}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Input placeholder="Objetivo" value={form.objective} onChange={e => setField('objective', e.target.value)} className="bg-secondary border-border" />
            <Input placeholder="Link do vídeo" value={form.videoLink} onChange={e => setField('videoLink', e.target.value)} className="bg-secondary border-border" />
            <Input placeholder="URL da imagem / print" value={form.imageUrl} onChange={e => setField('imageUrl', e.target.value)} className="bg-secondary border-border" />
            <Textarea placeholder="Descrição" value={form.description} onChange={e => setField('description', e.target.value)} className="bg-secondary border-border min-h-[60px]" />
            <Input placeholder="Hashtags (ex: #tiktok #viral)" value={form.hashtags} onChange={e => setField('hashtags', e.target.value)} className="bg-secondary border-border" />
            <Input placeholder="CTA (Call to Action)" value={form.cta} onChange={e => setField('cta', e.target.value)} className="bg-secondary border-border" />
            <Textarea placeholder="Observações" value={form.observations} onChange={e => setField('observations', e.target.value)} className="bg-secondary border-border min-h-[60px]" />

            <Button onClick={handleSave} className="w-full gradient-red text-primary-foreground">
              {editMode ? 'Salvar alterações' : 'Criar +30 XP'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
          {selectedContent && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between gap-2">
                  <DialogTitle className="text-foreground text-lg">{selectedContent.title}</DialogTitle>
                  <button onClick={() => toggleFavorite(selectedContent.id)}>
                    <Star className={`w-5 h-5 ${selectedContent.favorite ? 'text-primary fill-primary' : 'text-muted-foreground'}`} />
                  </button>
                </div>
              </DialogHeader>

              <div className="space-y-4 mt-2">
                <div className="flex flex-wrap gap-2">
                  <span className={`text-xs px-2.5 py-1 rounded-full border ${categoryColors[selectedContent.category]}`}>
                    {categoryLabels[selectedContent.category]}
                  </span>
                  <span className={`text-xs px-2.5 py-1 rounded-full ${statusColors[selectedContent.status]}`}>
                    {statusLabels[selectedContent.status]}
                  </span>
                  <span className={`text-xs px-2.5 py-1 rounded-full bg-secondary ${priorityColors[selectedContent.priority]}`}>
                    ● {priorityLabels[selectedContent.priority]}
                  </span>
                </div>

                {selectedContent.imageUrl && (
                  <img src={selectedContent.imageUrl} alt={selectedContent.title} className="w-full rounded-lg border border-border" />
                )}

                {selectedContent.objective && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Objetivo</p>
                    <p className="text-sm text-foreground">{selectedContent.objective}</p>
                  </div>
                )}

                {selectedContent.description && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Descrição</p>
                    <p className="text-sm text-foreground">{selectedContent.description}</p>
                  </div>
                )}

                {selectedContent.hashtags && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Hashtags</p>
                    <p className="text-sm text-primary">{selectedContent.hashtags}</p>
                  </div>
                )}

                {selectedContent.cta && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">CTA</p>
                    <p className="text-sm text-foreground">{selectedContent.cta}</p>
                  </div>
                )}

                {selectedContent.videoLink && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Link do Vídeo</p>
                    <a href={selectedContent.videoLink} target="_blank" rel="noopener noreferrer"
                      className="text-sm text-primary flex items-center gap-1 hover:underline">
                      {selectedContent.videoLink} <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}

                {selectedContent.observations && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Observações</p>
                    <p className="text-sm text-foreground">{selectedContent.observations}</p>
                  </div>
                )}

                {selectedContent.accountId && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Conta TikTok</p>
                    <p className="text-sm text-foreground">{getAccountName(selectedContent.accountId)}</p>
                  </div>
                )}

                <div className="flex gap-2 pt-2 border-t border-border">
                  <Button variant="outline" className="flex-1 gap-2" onClick={() => handleDuplicate(selectedContent)}>
                    <Copy className="w-4 h-4" /> Duplicar
                  </Button>
                  <Button variant="outline" className="flex-1 gap-2" onClick={() => handleEdit(selectedContent)}>
                    <Pencil className="w-4 h-4" /> Editar
                  </Button>
                  <Button variant="destructive" className="gap-2" onClick={() => handleDelete(selectedContent.id)}>
                    <Trash2 className="w-4 h-4" /> Excluir
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
