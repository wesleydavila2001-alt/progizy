import { motion } from 'framer-motion';
import { Plus, Link as LinkIcon, ImageIcon, Lightbulb, StickyNote, Search, Star, X, Filter } from 'lucide-react';
import { UserProfile, ReferenceItem, InspirationCategory, InspirationRefType, InspirationFormat } from '@/lib/store';
import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

interface ReferencesViewProps {
  profile: UserProfile;
  onUpdate: (u: Partial<UserProfile>) => void;
  onXP: (n: number) => void;
}

const categoryLabels: Record<InspirationCategory, string> = {
  crescimento: 'Crescimento',
  monetizacao: 'Monetização',
  vendas: 'Vendas',
};

const refTypeLabels: Record<InspirationRefType, string> = {
  hook: 'Hook',
  roteiro: 'Estrutura de Roteiro',
  cta: 'CTA',
  oferta: 'Oferta',
  storytelling: 'Storytelling',
  tendencia: 'Tendência',
  edicao: 'Edição',
  thumbnail: 'Thumbnail',
};

const formatIcons: Record<InspirationFormat, typeof LinkIcon> = {
  link: LinkIcon,
  image: ImageIcon,
  idea: Lightbulb,
  observation: StickyNote,
};

const formatLabels: Record<InspirationFormat, string> = {
  link: 'Link',
  image: 'Imagem / Print',
  idea: 'Ideia Rápida',
  observation: 'Observação',
};

export function ReferencesView({ profile, onUpdate, onXP }: ReferencesViewProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<InspirationFormat>('link');
  const [category, setCategory] = useState<InspirationCategory>('crescimento');
  const [refType, setRefType] = useState<InspirationRefType>('hook');

  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<InspirationCategory | 'all'>('all');
  const [filterRefType, setFilterRefType] = useState<InspirationRefType | 'all'>('all');
  const [filterFav, setFilterFav] = useState(false);

  const resetForm = () => {
    setTitle(''); setUrl(''); setDescription(''); setType('link'); setCategory('crescimento'); setRefType('hook');
  };

  const addRef = () => {
    if (!title.trim()) return;
    const r: ReferenceItem = {
      id: Date.now().toString(), type, url, title, niche: categoryLabels[category],
      category, refType, description, createdAt: new Date().toISOString(), favorite: false,
    };
    onUpdate({ references: [...profile.references, r] });
    onXP(1);
    resetForm();
    setOpen(false);
  };

  const toggleFav = (id: string) => {
    onUpdate({
      references: profile.references.map(r => r.id === id ? { ...r, favorite: !r.favorite } : r),
    });
  };

  const deleteRef = (id: string) => {
    onUpdate({ references: profile.references.filter(r => r.id !== id) });
  };

  const filtered = useMemo(() => {
    return profile.references.filter(r => {
      if (search && !r.title.toLowerCase().includes(search.toLowerCase()) && !(r.description || '').toLowerCase().includes(search.toLowerCase())) return false;
      if (filterCategory !== 'all' && r.category !== filterCategory) return false;
      if (filterRefType !== 'all' && r.refType !== filterRefType) return false;
      if (filterFav && !r.favorite) return false;
      return true;
    });
  }, [profile.references, search, filterCategory, filterRefType, filterFav]);

  const hasActiveFilters = filterCategory !== 'all' || filterRefType !== 'all' || filterFav || search;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-wide text-foreground">Inspirações</h2>
          <p className="text-sm text-muted-foreground mt-1">Biblioteca de referências e ideias</p>
        </div>
        <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gradient-red text-primary-foreground gap-2 glow-red">
              <Plus className="w-4 h-4" /> Nova Inspiração
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="text-foreground">Adicionar Inspiração</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              {/* Format */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">Formato</label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(formatLabels) as InspirationFormat[]).map(f => {
                    const Icon = formatIcons[f];
                    return (
                      <button key={f} onClick={() => setType(f)} className={`py-2 px-3 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors ${type === f ? 'bg-primary/15 text-primary border border-primary/30' : 'bg-secondary text-muted-foreground border border-border'}`}>
                        <Icon className="w-3.5 h-3.5" /> {formatLabels[f]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Input placeholder="Título" value={title} onChange={e => setTitle(e.target.value)} className="bg-secondary border-border" />

              {(type === 'link' || type === 'image') && (
                <Input placeholder={type === 'link' ? 'URL do link / vídeo' : 'URL da imagem'} value={url} onChange={e => setUrl(e.target.value)} className="bg-secondary border-border" />
              )}

              <Textarea placeholder="Descrição / Anotação" value={description} onChange={e => setDescription(e.target.value)} className="bg-secondary border-border min-h-[80px]" />

              {/* Category */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">Categoria</label>
                <div className="flex gap-2">
                  {(Object.keys(categoryLabels) as InspirationCategory[]).map(c => (
                    <button key={c} onClick={() => setCategory(c)} className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${category === c ? 'bg-primary/15 text-primary border border-primary/30' : 'bg-secondary text-muted-foreground border border-border'}`}>
                      {categoryLabels[c]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Ref Type */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">Tipo de Referência</label>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(refTypeLabels) as InspirationRefType[]).map(t => (
                    <button key={t} onClick={() => setRefType(t)} className={`py-1.5 px-3 rounded-full text-[11px] font-medium transition-colors ${refType === t ? 'bg-primary/15 text-primary border border-primary/30' : 'bg-secondary text-muted-foreground border border-border'}`}>
                      {refTypeLabels[t]}
                    </button>
                  ))}
                </div>
              </div>

              <Button onClick={addRef} className="w-full gradient-red text-primary-foreground">Salvar +15 XP</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search & Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar inspirações..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 bg-secondary border-border" />
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <Filter className="w-4 h-4 text-muted-foreground" />

          {/* Category filter */}
          {(['all', ...Object.keys(categoryLabels)] as (InspirationCategory | 'all')[]).map(c => (
            <button key={c} onClick={() => setFilterCategory(c)} className={`px-3 py-1 rounded-full text-[11px] font-medium transition-colors ${filterCategory === c ? 'bg-primary/15 text-primary border border-primary/30' : 'bg-secondary text-muted-foreground border border-border'}`}>
              {c === 'all' ? 'Todas' : categoryLabels[c]}
            </button>
          ))}

          <div className="w-px h-5 bg-border" />

          <button onClick={() => setFilterFav(!filterFav)} className={`px-3 py-1 rounded-full text-[11px] font-medium flex items-center gap-1 transition-colors ${filterFav ? 'bg-primary/15 text-primary border border-primary/30' : 'bg-secondary text-muted-foreground border border-border'}`}>
            <Star className="w-3 h-3" /> Favoritos
          </button>

          {hasActiveFilters && (
            <button onClick={() => { setSearch(''); setFilterCategory('all'); setFilterRefType('all'); setFilterFav(false); }} className="px-3 py-1 rounded-full text-[11px] font-medium text-destructive bg-destructive/10 border border-destructive/20 flex items-center gap-1">
              <X className="w-3 h-3" /> Limpar
            </button>
          )}
        </div>

        {/* Ref type filter */}
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setFilterRefType('all')} className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors ${filterRefType === 'all' ? 'bg-primary/15 text-primary border border-primary/30' : 'bg-secondary text-muted-foreground border border-border'}`}>
            Todos tipos
          </button>
          {(Object.keys(refTypeLabels) as InspirationRefType[]).map(t => (
            <button key={t} onClick={() => setFilterRefType(t)} className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors ${filterRefType === t ? 'bg-primary/15 text-primary border border-primary/30' : 'bg-secondary text-muted-foreground border border-border'}`}>
              {refTypeLabels[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <p className="text-xs text-muted-foreground">{filtered.length} inspiração(ões)</p>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((ref, i) => {
          const Icon = formatIcons[ref.type] || LinkIcon;
          return (
            <motion.div
              key={ref.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.03 }}
              className="glass-card rounded-xl p-5 hover:border-primary/30 transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Icon className="w-4 h-4 text-primary shrink-0" />
                  {ref.category && (
                    <Badge variant="outline" className="text-[10px] px-2 py-0 border-primary/30 text-primary">
                      {categoryLabels[ref.category]}
                    </Badge>
                  )}
                  {ref.refType && (
                    <Badge variant="secondary" className="text-[10px] px-2 py-0">
                      {refTypeLabels[ref.refType]}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => toggleFav(ref.id)} className="p-1 rounded hover:bg-primary/10">
                    <Star className={`w-3.5 h-3.5 ${ref.favorite ? 'text-primary fill-primary' : 'text-muted-foreground'}`} />
                  </button>
                  <button onClick={() => deleteRef(ref.id)} className="p-1 rounded hover:bg-destructive/10">
                    <X className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              </div>
              <p className="text-sm font-medium text-foreground">{ref.title}</p>
              {ref.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{ref.description}</p>}
              {ref.url && (
                <a href={ref.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary/70 hover:text-primary mt-2 block truncate">
                  {ref.url}
                </a>
              )}
            </motion.div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <Lightbulb className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhuma inspiração encontrada</p>
        </div>
      )}
    </div>
  );
}
