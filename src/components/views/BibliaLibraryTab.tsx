import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Copy, Check, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import { BIBLIA_HOOKS, BIBLIA_CATEGORIES, type BibliaCategory } from '@/lib/bibliaHooksData';
import { BIBLIA_HOOKS_V2 } from '@/lib/bibliaHooksV2Data';
import { supabase } from '@/integrations/supabase/client';

export function BibliaLibraryTab() {
  const [search, setSearch] = useState('');
  const [activeCat, setActiveCat] = useState<BibliaCategory | 'all'>('all');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [translations, setTranslations] = useState<Record<number, string>>({});
  const [visibleCount, setVisibleCount] = useState(40);
  const [version, setVersion] = useState<'1.0' | '2.0'>('1.0');

  const CAT_COLORS: Record<string, { active: string; inactive: string }> = {
    lista:       { active: 'bg-blue-500 hover:bg-blue-600 text-white border-0',           inactive: 'border-blue-500/40 text-blue-300 hover:bg-blue-500/10' },
    dor:         { active: 'bg-rose-500 hover:bg-rose-600 text-white border-0',           inactive: 'border-rose-500/40 text-rose-300 hover:bg-rose-500/10' },
    historia:    { active: 'bg-amber-500 hover:bg-amber-600 text-white border-0',         inactive: 'border-amber-500/40 text-amber-300 hover:bg-amber-500/10' },
    revelacao:   { active: 'bg-violet-500 hover:bg-violet-600 text-white border-0',       inactive: 'border-violet-500/40 text-violet-300 hover:bg-violet-500/10' },
    urgencia:    { active: 'bg-orange-500 hover:bg-orange-600 text-white border-0',       inactive: 'border-orange-500/40 text-orange-300 hover:bg-orange-500/10' },
    curiosidade: { active: 'bg-cyan-500 hover:bg-cyan-600 text-white border-0',           inactive: 'border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10' },
    experiencia: { active: 'bg-emerald-500 hover:bg-emerald-600 text-white border-0',     inactive: 'border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10' },
    tutorial:    { active: 'bg-pink-500 hover:bg-pink-600 text-white border-0',           inactive: 'border-pink-500/40 text-pink-300 hover:bg-pink-500/10' },
    autoridade:  { active: 'bg-yellow-500 hover:bg-yellow-600 text-black border-0',       inactive: 'border-yellow-500/40 text-yellow-300 hover:bg-yellow-500/10' },
  };

  const CARD_COLORS: Record<string, { border: string; badge: string; objBorder: string }> = {
    lista:       { border: 'border-l-blue-500',    badge: 'bg-blue-500/15 text-blue-300 border-blue-500/40',         objBorder: 'border-blue-500/50' },
    dor:         { border: 'border-l-rose-500',    badge: 'bg-rose-500/15 text-rose-300 border-rose-500/40',         objBorder: 'border-rose-500/50' },
    historia:    { border: 'border-l-amber-500',   badge: 'bg-amber-500/15 text-amber-300 border-amber-500/40',      objBorder: 'border-amber-500/50' },
    revelacao:   { border: 'border-l-violet-500',  badge: 'bg-violet-500/15 text-violet-300 border-violet-500/40',   objBorder: 'border-violet-500/50' },
    urgencia:    { border: 'border-l-orange-500',  badge: 'bg-orange-500/15 text-orange-300 border-orange-500/40',   objBorder: 'border-orange-500/50' },
    curiosidade: { border: 'border-l-cyan-500',    badge: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40',         objBorder: 'border-cyan-500/50' },
    experiencia: { border: 'border-l-emerald-500', badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',objBorder: 'border-emerald-500/50' },
    tutorial:    { border: 'border-l-pink-500',    badge: 'bg-pink-500/15 text-pink-300 border-pink-500/40',         objBorder: 'border-pink-500/50' },
    autoridade:  { border: 'border-l-yellow-500', badge: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/40',    objBorder: 'border-yellow-500/50' },
  };

  const dataset = version === '2.0' ? BIBLIA_HOOKS_V2 : BIBLIA_HOOKS;

  const filtered = useMemo(() => {
    let list = dataset;
    if (activeCat !== 'all') list = list.filter(h => h.category === activeCat);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(h => h.text.toLowerCase().includes(q));
    }
    return list;
  }, [activeCat, search, dataset]);

  const visible = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

  // Reset ao filtrar / trocar versão
  useEffect(() => { setVisibleCount(40); setActiveCat('all'); setSearch(''); }, [version]);
  useEffect(() => { setVisibleCount(40); }, [activeCat, search]);

  // Carrega traduções do cache (DB) para os hooks visíveis. Sem chamadas de IA.
  useEffect(() => {
    const ids = visible.map(h => h.id).filter(id => !translations[id]);
    if (ids.length === 0) return;

    let cancelled = false;
    (async () => {
      const { data: cached } = await (supabase as any)
        .from('biblia_hooks_translations')
        .select('hook_id, text_en')
        .in('hook_id', ids);
      if (cancelled) return;
      const cachedMap: Record<number, string> = {};
      (cached || []).forEach((r: any) => { cachedMap[r.hook_id] = r.text_en; });
      if (Object.keys(cachedMap).length) {
        setTranslations(prev => ({ ...cachedMap, ...prev }));
      }
    })();

    return () => { cancelled = true; };
  }, [visible]);

  const copy = async (key: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
    toast.success('Hook copiado!');
  };

  return (
    <div className="space-y-4">
      <Card className="border-border/60 bg-card">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <BookOpen className="w-5 h-5 text-violet-400" />
            <h3 className="font-bold text-sm">Biblioteca de Hooks — {version}</h3>
            <Badge className="bg-violet-500/15 text-violet-300 border-violet-500/30 text-[10px]">
              {dataset.length} hooks
            </Badge>
            <div className="ml-auto inline-flex rounded-md border border-border/60 overflow-hidden">
              <Button
                size="sm"
                variant={version === '1.0' ? 'default' : 'ghost'}
                onClick={() => setVersion('1.0')}
                className={`h-7 px-3 text-xs rounded-none ${version === '1.0' ? 'gradient-red text-primary-foreground border-0' : ''}`}
              >
                1.0
              </Button>
              <Button
                size="sm"
                variant={version === '2.0' ? 'default' : 'ghost'}
                onClick={() => setVersion('2.0')}
                className={`h-7 px-3 text-xs rounded-none ${version === '2.0' ? 'gradient-red text-primary-foreground border-0' : ''}`}
              >
                2.0
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Use <code className="text-primary">(___)</code> para personalizar. {version === '1.0' && <>Versão em inglês traduzida automaticamente.</>}
          </p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar hooks..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 bg-background border-border/60"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Button
              size="sm"
              variant={activeCat === 'all' ? 'default' : 'outline'}
              onClick={() => setActiveCat('all')}
              className={activeCat === 'all' ? 'gradient-red text-primary-foreground border-0 text-xs h-8' : 'border-border/60 text-xs h-8'}
            >
              Todos ({dataset.length})
            </Button>
            {BIBLIA_CATEGORIES.map(cat => {
              const count = dataset.filter(h => h.category === cat.id).length;
              const colors = CAT_COLORS[cat.id];
              const isActive = activeCat === cat.id;
              return (
                <Button
                  key={cat.id}
                  size="sm"
                  variant={isActive ? 'default' : 'outline'}
                  onClick={() => setActiveCat(cat.id)}
                  className={`text-xs h-8 ${isActive ? colors.active : colors.inactive}`}
                >
                  <span className="mr-1">{cat.emoji}</span>
                  {cat.label} ({count})
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>


      <p className="text-xs text-muted-foreground px-1">
        {filtered.length} {filtered.length === 1 ? 'resultado' : 'resultados'} {visibleCount < filtered.length && `· mostrando ${visibleCount}`}
      </p>

      {filtered.length === 0 ? (
        <Card className="border-border/60">
          <CardContent className="text-center py-12 text-muted-foreground text-sm">
            Nenhum hook encontrado.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {visible.map(hook => {
              const cat = BIBLIA_CATEGORIES.find(c => c.id === hook.category);
              const displayText = hook.text;
              const en = translations[hook.id];
              const catColor = CARD_COLORS[hook.category];

              const renderWithExamples = (txt: string) =>
                txt.split(/(\(ex:[^)]*\))/gi).map((part, i) =>
                  /^\(ex:/i.test(part) ? (
                    <span key={i} className="text-red-500 font-semibold">{part}</span>
                  ) : (
                    <span key={i}>{part}</span>
                  )
                );

              return (
                <Card key={hook.id} className={`group border-border/60 hover:border-primary/30 transition-all border-l-4 ${catColor.border}`}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex gap-3">
                      <div className="flex flex-col items-center gap-1 shrink-0">
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 ${catColor.badge}`}>
                          #{hook.id}
                        </Badge>
                        <span className="text-base">{cat?.emoji}</span>
                      </div>
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="space-y-1.5">
                          <div className="flex items-start gap-2">
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-border/60 shrink-0 mt-0.5">PT</Badge>
                            <p className="text-sm text-foreground/90 leading-snug flex-1">{renderWithExamples(displayText)}</p>
                          </div>
                          <div className="flex items-start gap-2">
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-sky-500/40 text-sky-300 shrink-0 mt-0.5">EN</Badge>
                            {en && (
                              <p className="text-sm text-sky-100/85 leading-snug flex-1 italic">{renderWithExamples(en)}</p>
                            )}
                          </div>
                        </div>
                        {cat?.objetivo && (
                          <p className={`text-[11px] text-muted-foreground italic leading-snug border-l-2 pl-2 ${catColor.objBorder}`}>
                            🎯 <span className="font-semibold text-foreground/70">Objetivo:</span> {cat.objetivo}
                          </p>
                        )}
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <Badge className={`text-[10px] border ${catColor.badge}`}>{cat?.label}</Badge>
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => copy(`h-${hook.id}-pt`, displayText)}
                              className="h-7 px-2 text-xs gap-1"
                              title="Copiar PT"
                            >
                              {copiedKey === `h-${hook.id}-pt` ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                              <span className="text-[10px]">PT</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => en && copy(`h-${hook.id}-en`, en)}
                              disabled={!en}
                              className="h-7 px-2 text-xs gap-1 text-sky-400 hover:text-sky-300"
                              title="Copiar EN"
                            >
                              {copiedKey === `h-${hook.id}-en` ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                              <span className="text-[10px]">EN</span>
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>

                  </CardContent>
                </Card>
              );
            })}
          </div>

          {visibleCount < filtered.length && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setVisibleCount(c => c + 40)}
                className="border-border/60"
              >
                Carregar mais ({filtered.length - visibleCount} restantes)
              </Button>
            </div>
          )}
        </>
      )}
      
    </div>
  );
}
