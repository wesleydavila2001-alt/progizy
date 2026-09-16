import { useState } from 'react';
import { motion } from 'framer-motion';
import { Download, Search, Link2, Trash2, RefreshCw, Loader2, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface DownloadHistoryItem {
  id: string;
  title: string;
  platform: string;
  url: string;
  date: string;
}

const platformIcons: Record<string, string> = {
  youtube: '🎬',
  tiktok: '🎵',
  instagram: '📸',
  kwai: '🎥',
  other: '🌐',
};

function detectPlatform(url: string): string {
  if (/youtube\.com|youtu\.be/i.test(url)) return 'youtube';
  if (/tiktok\.com/i.test(url)) return 'tiktok';
  if (/instagram\.com/i.test(url)) return 'instagram';
  if (/kwai\.com/i.test(url)) return 'kwai';
  return 'other';
}

const platformLabels: Record<string, string> = {
  youtube: 'YouTube',
  tiktok: 'TikTok',
  instagram: 'Instagram',
  kwai: 'Kwai',
  other: 'Outro',
};

const STORAGE_KEY = 'progcontrol-downloads';

function getHistory(): DownloadHistoryItem[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch { return []; }
}
function saveHistory(h: DownloadHistoryItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(h));
}

export function DownloadsView() {
  const [url, setUrl] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [history, setHistory] = useState<DownloadHistoryItem[]>(getHistory);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'download' | 'history'>('download');

  const handleDownload = async () => {
    const trimmed = url.trim();
    if (!trimmed) {
      toast.error('Cole um link válido');
      return;
    }

    const platform = detectPlatform(trimmed);

    if (platform === 'youtube') {
      toast.error('YouTube temporariamente indisponível', {
        description: 'Instâncias públicas não suportam YouTube por restrições de segurança.',
      });
      return;
    }

    setDownloading(true);

    try {
      const { data, error } = await supabase.functions.invoke('download-video', {
        body: { url: trimmed },
      });

      if (error) throw new Error(error.message);
      if (!data?.downloadUrl) throw new Error(data?.error || 'Não foi possível obter o link de download');

      // Trigger browser download
      const a = document.createElement('a');
      a.href = data.downloadUrl;
      a.download = data.filename || 'video.mp4';
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // Save to history
      const item: DownloadHistoryItem = {
        id: Date.now().toString(),
        title: `${platformLabels[platform]} - ${data.filename || 'video.mp4'}`,
        platform,
        url: trimmed,
        date: new Date().toISOString(),
      };
      const updated = [item, ...history].slice(0, 10);
      setHistory(updated);
      saveHistory(updated);

      toast.success('Download iniciado!');
    } catch (err: any) {
      console.error('Download error:', err);
      toast.error('Falha no download', { description: err.message });
    } finally {
      setDownloading(false);
    }
  };

  const deleteItem = (id: string) => {
    const updated = history.filter(h => h.id !== id);
    setHistory(updated);
    saveHistory(updated);
    toast.success('Item removido');
  };

  const clearHistory = () => {
    setHistory([]);
    saveHistory([]);
    toast.success('Histórico limpo');
  };

  const filteredHistory = history.filter(h =>
    !searchQuery || h.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    platformLabels[h.platform]?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-wide text-foreground"><span className="text-gradient-red">Download</span> de Vídeos</h2>
        <p className="text-sm text-muted-foreground mt-1">Baixe vídeos de plataformas públicas</p>
      </div>

      <div className="flex gap-2">
        {(['download', 'history'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab
                ? 'bg-primary/15 text-primary border border-primary/30'
                : 'bg-secondary text-muted-foreground border border-border hover:text-foreground'
            }`}
          >
            {tab === 'download' ? '⬇️ Download' : `📋 Histórico (${history.length})`}
          </button>
        ))}
      </div>

      {activeTab === 'download' && (
        <div className="space-y-6">
          <Card className="bg-card border-border">
            <CardContent className="p-5 space-y-4">
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Cole o link do vídeo aqui..."
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    className="pl-10 bg-secondary border-border"
                    onKeyDown={e => e.key === 'Enter' && handleDownload()}
                  />
                </div>
                <Button
                  onClick={handleDownload}
                  disabled={downloading || !url.trim()}
                  className="gradient-red text-primary-foreground glow-red gap-2"
                >
                  {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  {downloading ? 'Baixando...' : 'Baixar'}
                </Button>
              </div>

              <div className="flex gap-2 flex-wrap">
                {Object.entries(platformLabels).map(([k, v]) => (
                  <span
                    key={k}
                    className={`text-[10px] px-2 py-1 rounded-full border border-border flex items-center gap-1 ${
                      k === 'youtube'
                        ? 'bg-destructive/10 text-muted-foreground line-through'
                        : 'bg-secondary text-muted-foreground'
                    }`}
                  >
                    {platformIcons[k]} {v}
                    {k === 'youtube' && <AlertTriangle className="w-3 h-3 text-destructive" />}
                  </span>
                ))}
              </div>

              {detectPlatform(url) === 'youtube' && url.trim() && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  YouTube está temporariamente indisponível nas instâncias públicas.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="flex gap-3 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar no histórico..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-10 bg-secondary border-border"
              />
            </div>
            {history.length > 0 && (
              <Button variant="outline" size="sm" onClick={clearHistory} className="text-destructive border-destructive/30 hover:bg-destructive/10 gap-1">
                <Trash2 className="w-3.5 h-3.5" /> Limpar
              </Button>
            )}
          </div>

          {filteredHistory.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              {history.length === 0 ? 'Nenhum download realizado ainda' : 'Nenhum resultado encontrado'}
            </div>
          )}

          <div className="space-y-3">
            {filteredHistory.map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className="glass-card rounded-xl p-4 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="text-xl flex-shrink-0">{platformIcons[item.platform] || '🌐'}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                    <div className="flex gap-2 mt-0.5 flex-wrap">
                      <span className="text-[10px] text-muted-foreground">{platformLabels[item.platform]}</span>
                      <span className="text-[10px] text-muted-foreground">{new Date(item.date).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button
                    onClick={() => { setUrl(item.url); setActiveTab('download'); }}
                    className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
                    title="Baixar novamente"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteItem(item.id)}
                    className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                    title="Excluir"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
