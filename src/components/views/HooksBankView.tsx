import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Copy, Heart, Search, TrendingUp, DollarSign, ShoppingBag, HelpCircle, ArrowLeftRight, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useHooksFavorites } from '@/hooks/useHooksFavorites';

type HookCategory = 'crescimento' | 'monetizacao' | 'vendas' | 'curiosidade' | 'comparacao';

interface Hook {
  id: string;
  text: string;
  category: HookCategory;
}

const HOOKS: Hook[] = [
  // Crescimento
  { id: 'c1', text: 'Se você não fizer isso, vai perder seguidores toda semana.', category: 'crescimento' },
  { id: 'c2', text: 'Eu saí de 0 para 10k seguidores em 30 dias fazendo isso.', category: 'crescimento' },
  { id: 'c3', text: 'O algoritmo do TikTok mudou — e ninguém tá falando sobre isso.', category: 'crescimento' },
  { id: 'c4', text: '3 erros que estão matando seu alcance agora mesmo.', category: 'crescimento' },
  { id: 'c5', text: 'Para de postar assim se quer crescer no TikTok.', category: 'crescimento' },
  { id: 'c6', text: 'Isso aqui me fez viralizar 5 vezes no último mês.', category: 'crescimento' },
  { id: 'c7', text: 'Se seu vídeo não passa de 500 views, assiste até o final.', category: 'crescimento' },
  { id: 'c8', text: 'O melhor horário para postar não é o que você pensa.', category: 'crescimento' },
  { id: 'c9', text: 'Você tá ignorando a funcionalidade mais poderosa do TikTok.', category: 'crescimento' },
  { id: 'c10', text: 'Fiz um teste por 7 dias e o resultado foi surreal.', category: 'crescimento' },
  { id: 'c11', text: 'Se você tem menos de 1k seguidores, esse vídeo é pra você.', category: 'crescimento' },
  { id: 'c12', text: 'Todo creator deveria saber disso antes de postar.', category: 'crescimento' },

  // Monetização
  { id: 'm1', text: 'Eu ganho dinheiro no TikTok sem mostrar o rosto — veja como.', category: 'monetizacao' },
  { id: 'm2', text: '3 formas de monetizar seu TikTok mesmo com poucos seguidores.', category: 'monetizacao' },
  { id: 'm3', text: 'Esse tipo de vídeo me rendeu R$5.000 em uma semana.', category: 'monetizacao' },
  { id: 'm4', text: 'Você sabia que dá pra ganhar dinheiro só respondendo comentários?', category: 'monetizacao' },
  { id: 'm5', text: 'O TikTok tá pagando creators — mas só quem faz isso.', category: 'monetizacao' },
  { id: 'm6', text: 'Como transformar visualizações em dinheiro de verdade.', category: 'monetizacao' },
  { id: 'm7', text: 'Essa estratégia de monetização mudou minha vida como creator.', category: 'monetizacao' },
  { id: 'm8', text: 'Afiliados no TikTok: o método que ninguém ensina.', category: 'monetizacao' },
  { id: 'm9', text: 'Quanto eu ganho por mês com o TikTok? Vou abrir os números.', category: 'monetizacao' },
  { id: 'm10', text: 'Se você não tá usando o TikTok Shop, tá perdendo dinheiro.', category: 'monetizacao' },

  // Vendas
  { id: 'v1', text: 'Esse produto esgotou em 24 horas depois desse vídeo.', category: 'vendas' },
  { id: 'v2', text: 'Achei o produto que todo mundo tá procurando.', category: 'vendas' },
  { id: 'v3', text: 'Comprei pra testar e não esperava ISSO.', category: 'vendas' },
  { id: 'v4', text: 'Se você não comprar agora, vai se arrepender depois.', category: 'vendas' },
  { id: 'v5', text: 'Esse é o melhor custo-benefício que eu já encontrei.', category: 'vendas' },
  { id: 'v6', text: 'Tá em promoção e pouca gente sabe — corre!', category: 'vendas' },
  { id: 'v7', text: 'Review honesto: vale a pena ou é cilada?', category: 'vendas' },
  { id: 'v8', text: 'Eu testei por 30 dias e esse foi o resultado.', category: 'vendas' },
  { id: 'v9', text: 'O link tá na bio — mas corre porque acaba rápido.', category: 'vendas' },
  { id: 'v10', text: '5 motivos pra comprar isso agora mesmo.', category: 'vendas' },

  // Curiosidade
  { id: 'cu1', text: 'Você nunca vai acreditar no que aconteceu...', category: 'curiosidade' },
  { id: 'cu2', text: 'Eu descobri algo que vai mudar tudo pra você.', category: 'curiosidade' },
  { id: 'cu3', text: 'Ninguém fala sobre isso, mas deveria.', category: 'curiosidade' },
  { id: 'cu4', text: 'Presta atenção no final — você vai se surpreender.', category: 'curiosidade' },
  { id: 'cu5', text: 'Isso aqui é proibido na maioria dos países.', category: 'curiosidade' },
  { id: 'cu6', text: 'Eu guardei esse segredo por anos, mas agora vou contar.', category: 'curiosidade' },
  { id: 'cu7', text: 'O que eu vou mostrar agora vai explodir sua mente.', category: 'curiosidade' },
  { id: 'cu8', text: '99% das pessoas não sabem disso.', category: 'curiosidade' },
  { id: 'cu9', text: 'Se eu te contar, você não vai acreditar.', category: 'curiosidade' },
  { id: 'cu10', text: 'Esse é o truque que os grandes creators escondem de você.', category: 'curiosidade' },

  // Comparação
  { id: 'co1', text: 'Produto de R$20 vs produto de R$200 — qual é melhor?', category: 'comparacao' },
  { id: 'co2', text: 'Expectativa vs realidade: a verdade que ninguém mostra.', category: 'comparacao' },
  { id: 'co3', text: 'Versão barata vs versão cara — o resultado me chocou.', category: 'comparacao' },
  { id: 'co4', text: 'Antes e depois: a transformação é real.', category: 'comparacao' },
  { id: 'co5', text: 'Creator iniciante vs creator profissional — a diferença.', category: 'comparacao' },
  { id: 'co6', text: 'iPhone vs Android pra gravar conteúdo: qual ganha?', category: 'comparacao' },
  { id: 'co7', text: 'Eu testei os dois e só um vale a pena.', category: 'comparacao' },
  { id: 'co8', text: 'TikTok vs Reels vs Shorts: onde crescer mais rápido?', category: 'comparacao' },
  { id: 'co9', text: 'O primeiro vs o último — a evolução é absurda.', category: 'comparacao' },
  { id: 'co10', text: 'Fiz o mesmo vídeo de dois jeitos — veja qual viralizou.', category: 'comparacao' },
];

const CATEGORY_INFO: Record<HookCategory, { label: string; icon: React.ElementType; color: string }> = {
  crescimento: { label: 'Crescimento', icon: TrendingUp, color: 'text-emerald-500' },
  monetizacao: { label: 'Monetização', icon: DollarSign, color: 'text-amber-500' },
  vendas: { label: 'Vendas', icon: ShoppingBag, color: 'text-blue-500' },
  curiosidade: { label: 'Curiosidade', icon: HelpCircle, color: 'text-purple-500' },
  comparacao: { label: 'Comparação', icon: ArrowLeftRight, color: 'text-rose-500' },
};

export function HooksBankView({ onXP }: { onXP: (n: number) => void }) {
  const [search, setSearch] = useState('');
  const { favorites, toggleFavorite: toggleFav } = useHooksFavorites();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('all');
  const { toast } = useToast();

  const handleToggleFavorite = async (id: string) => {
    const added = await toggleFav(id);
    if (added) onXP(5);
  };

  const copyHook = async (hook: Hook) => {
    await navigator.clipboard.writeText(hook.text);
    setCopiedId(hook.id);
    setTimeout(() => setCopiedId(null), 1500);
    onXP(3);
    toast({ title: '📋 Hook copiado! +3 XP' });
  };

  const filtered = useMemo(() => {
    let list = HOOKS;
    if (activeTab === 'favorites') list = list.filter(h => favorites.has(h.id));
    else if (activeTab !== 'all') list = list.filter(h => h.category === activeTab);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(h => h.text.toLowerCase().includes(q));
    }
    return list;
  }, [activeTab, search, favorites]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-primary" />
          Banco de Hooks
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          Frases de abertura prontas para usar. Copie, favorite e produza vídeos com maior retenção.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar hooks..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="all">Todos ({HOOKS.length})</TabsTrigger>
          <TabsTrigger value="favorites">
            <Heart className="w-3 h-3 mr-1" /> Favoritos ({favorites.size})
          </TabsTrigger>
          {(Object.entries(CATEGORY_INFO) as [HookCategory, typeof CATEGORY_INFO[HookCategory]][]).map(([key, info]) => (
            <TabsTrigger key={key} value={key}>
              <info.icon className="w-3 h-3 mr-1" /> {info.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="mt-4 space-y-2">
          {filtered.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Nenhum hook encontrado.
              </CardContent>
            </Card>
          ) : (
            filtered.map(hook => {
              const info = CATEGORY_INFO[hook.category];
              const Icon = info.icon;
              const isFav = favorites.has(hook.id);
              const isCopied = copiedId === hook.id;

              return (
                <Card key={hook.id} className="group hover:border-primary/30 transition-colors">
                  <CardContent className="py-3 px-4 flex items-center gap-3">
                    <Icon className={`w-4 h-4 shrink-0 ${info.color}`} />
                    <p className="flex-1 text-sm text-foreground leading-relaxed">{hook.text}</p>
                    <Badge variant="secondary" className="text-[10px] shrink-0 hidden sm:inline-flex">
                      {info.label}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => handleToggleFavorite(hook.id)}
                    >
                      <Heart className={`w-4 h-4 ${isFav ? 'fill-primary text-primary' : 'text-muted-foreground'}`} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => copyHook(hook)}
                    >
                      {isCopied ? (
                        <Check className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <Copy className="w-4 h-4 text-muted-foreground" />
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </Tabs>
    </div>
  );
}
