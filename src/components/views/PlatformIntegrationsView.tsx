import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link2, ExternalLink, FolderOpen, CheckCircle2, Plus, FileVideo, Image, FileText, Link, X, Import } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { UserProfile, VideoEntry } from '@/lib/store';
import { toast } from 'sonner';

interface Platform {
  id: string;
  name: string;
  icon: string;
  description: string;
  color: string;
  available: boolean;
}

const platforms: Platform[] = [
  { id: 'google-drive', name: 'Google Drive', icon: '📁', description: 'Importe vídeos, roteiros e materiais do Google Drive', color: 'from-yellow-500/20 to-green-500/10 border-yellow-500/20', available: true },
  { id: 'notion', name: 'Notion', icon: '📝', description: 'Sincronize roteiros, planejamentos e bases de conteúdo', color: 'from-foreground/10 to-foreground/5 border-foreground/15', available: true },
  { id: 'dropbox', name: 'Dropbox', icon: '📦', description: 'Acesse arquivos de vídeo e imagens salvos no Dropbox', color: 'from-blue-500/20 to-blue-400/10 border-blue-500/20', available: true },
  { id: 'onedrive', name: 'OneDrive', icon: '☁️', description: 'Conecte ao OneDrive para importar materiais', color: 'from-sky-500/20 to-sky-400/10 border-sky-500/20', available: true },
  { id: 'google-photos', name: 'Google Photos', icon: '📸', description: 'Importe fotos e vídeos da sua galeria do Google', color: 'from-red-500/15 to-yellow-500/10 border-red-500/15', available: true },
  { id: 'other', name: 'Outras', icon: '🔗', description: 'Mais integrações em breve...', color: 'from-muted/40 to-muted/20 border-border', available: false },
];

interface ImportItem {
  id: string;
  name: string;
  type: 'video' | 'image' | 'script' | 'link';
  source: string;
  url: string;
  size?: string;
  date?: string;
}

// Simulated files for demo
const simulatedFiles: Record<string, ImportItem[]> = {
  'google-drive': [
    { id: '1', name: 'Video_Crescimento_01.mp4', type: 'video', source: 'google-drive', url: '#', size: '245 MB', date: '2026-03-25' },
    { id: '2', name: 'Roteiro_Monetização.docx', type: 'script', source: 'google-drive', url: '#', size: '38 KB', date: '2026-03-24' },
    { id: '3', name: 'Thumbnail_Vendas.png', type: 'image', source: 'google-drive', url: '#', size: '1.2 MB', date: '2026-03-22' },
  ],
  'notion': [
    { id: '4', name: 'Planejamento Semanal', type: 'script', source: 'notion', url: '#', date: '2026-03-26' },
    { id: '5', name: 'Banco de Ideias - Março', type: 'script', source: 'notion', url: '#', date: '2026-03-20' },
  ],
  'dropbox': [
    { id: '6', name: 'Video_Editado_Final.mp4', type: 'video', source: 'dropbox', url: '#', size: '520 MB', date: '2026-03-23' },
    { id: '7', name: 'Assets_Visuais.zip', type: 'image', source: 'dropbox', url: '#', size: '89 MB', date: '2026-03-21' },
  ],
  'onedrive': [
    { id: '8', name: 'Compilação_Trends.mp4', type: 'video', source: 'onedrive', url: '#', size: '380 MB', date: '2026-03-24' },
  ],
  'google-photos': [
    { id: '9', name: 'Foto_Bastidor_01.jpg', type: 'image', source: 'google-photos', url: '#', size: '4.5 MB', date: '2026-03-27' },
    { id: '10', name: 'Clip_Stories_02.mp4', type: 'video', source: 'google-photos', url: '#', size: '15 MB', date: '2026-03-26' },
  ],
};

const typeIcons: Record<string, typeof FileVideo> = {
  video: FileVideo,
  image: Image,
  script: FileText,
  link: Link,
};

const typeLabels: Record<string, string> = {
  video: 'Vídeo',
  image: 'Imagem',
  script: 'Roteiro',
  link: 'Link',
};

interface PlatformIntegrationsViewProps {
  profile: UserProfile;
  onUpdate: (u: Partial<UserProfile>) => void;
  onXP: (n: number) => void;
}

export function PlatformIntegrationsView({ profile, onUpdate, onXP }: PlatformIntegrationsViewProps) {
  const [connectedPlatforms, setConnectedPlatforms] = useState<string[]>([]);
  const [browsePlatform, setBrowsePlatform] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importCategory, setImportCategory] = useState<'crescimento' | 'monetizacao' | 'vendas'>('crescimento');
  const [importAccountId, setImportAccountId] = useState('');

  const connectedAccounts = profile.accounts.filter(a => a.connected);

  const handleConnect = (platformId: string) => {
    setConnectedPlatforms(prev => [...prev, platformId]);
    toast.success(`${platforms.find(p => p.id === platformId)?.name} conectado com sucesso!`);
  };

  const handleDisconnect = (platformId: string) => {
    setConnectedPlatforms(prev => prev.filter(id => id !== platformId));
    if (browsePlatform === platformId) setBrowsePlatform(null);
    toast.success('Plataforma desconectada');
  };

  const toggleSelectItem = (id: string) => {
    setSelectedItems(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleImport = () => {
    if (!importAccountId) { toast.error('Selecione uma conta TikTok'); return; }
    if (selectedItems.length === 0) { toast.error('Selecione itens para importar'); return; }

    const files = browsePlatform ? simulatedFiles[browsePlatform] || [] : [];
    const selected = files.filter(f => selectedItems.includes(f.id));

    const newVideos: VideoEntry[] = selected
      .filter(f => f.type === 'video')
      .map(f => ({
        id: Date.now().toString() + Math.random().toString(36).slice(2),
        title: f.name.replace(/\.[^/.]+$/, ''),
        niche: 'Importado',
        status: 'idea' as const,
        category: importCategory,
        accountId: importAccountId,
        scheduledDate: new Date().toISOString(),
      }));

    if (newVideos.length > 0) {
      onUpdate({ videos: [...profile.videos, ...newVideos] });
      onXP(newVideos.length * 2);
    }

    toast.success(`${selectedItems.length} item(ns) importado(s)! +${newVideos.length * 2} XP`);
    setSelectedItems([]);
    setImportDialogOpen(false);
  };

  const currentFiles = browsePlatform ? simulatedFiles[browsePlatform] || [] : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Link2 className="w-5 h-5 text-primary" />
          Integrar Plataformas
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Conecte suas plataformas de armazenamento e importe materiais diretamente
        </p>
      </div>

      {/* Platform Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {platforms.map((platform, i) => {
          const isConnected = connectedPlatforms.includes(platform.id);
          return (
            <motion.div
              key={platform.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`glass-card rounded-xl p-4 relative overflow-hidden transition-all ${
                isConnected ? 'border-primary/25' : ''
              }`}
            >
              {/* Gradient background */}
              <div className={`absolute inset-0 bg-gradient-to-br ${platform.color} opacity-50 pointer-events-none`} />

              <div className="relative z-10 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">{platform.icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{platform.name}</p>
                      {isConnected && (
                        <span className="text-[10px] text-primary flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Conectado
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-muted-foreground leading-relaxed">{platform.description}</p>

                <div className="flex gap-2">
                  {!platform.available ? (
                    <Button variant="outline" size="sm" disabled className="text-xs h-8 w-full opacity-50">
                      Em breve
                    </Button>
                  ) : isConnected ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setBrowsePlatform(platform.id)}
                        className="text-xs h-8 flex-1 gap-1"
                      >
                        <FolderOpen className="w-3.5 h-3.5" /> Explorar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDisconnect(platform.id)}
                        className="text-xs h-8 text-muted-foreground hover:text-destructive"
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => handleConnect(platform.id)}
                      className="text-xs h-8 w-full gap-1 gradient-red text-primary-foreground"
                    >
                      <Plus className="w-3.5 h-3.5" /> Conectar
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* File Browser */}
      <AnimatePresence>
        {browsePlatform && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="glass-card rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{platforms.find(p => p.id === browsePlatform)?.icon}</span>
                  <h4 className="text-sm font-semibold text-foreground">
                    Arquivos — {platforms.find(p => p.id === browsePlatform)?.name}
                  </h4>
                </div>
                <div className="flex items-center gap-2">
                  {selectedItems.length > 0 && (
                    <Button
                      size="sm"
                      onClick={() => setImportDialogOpen(true)}
                      className="text-xs h-8 gap-1 gradient-red text-primary-foreground"
                    >
                      <Import className="w-3.5 h-3.5" /> Importar ({selectedItems.length})
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setBrowsePlatform(null); setSelectedItems([]); }}
                    className="h-8 w-8 p-0 text-muted-foreground"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {currentFiles.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-xs">
                  Nenhum arquivo encontrado nesta plataforma
                </div>
              ) : (
                <div className="space-y-1.5">
                  {currentFiles.map((file, i) => {
                    const TypeIcon = typeIcons[file.type];
                    const isSelected = selectedItems.includes(file.id);
                    return (
                      <motion.button
                        key={file.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        onClick={() => toggleSelectItem(file.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all text-left ${
                          isSelected
                            ? 'bg-primary/10 border border-primary/30'
                            : 'bg-secondary/30 border border-transparent hover:bg-secondary/60'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          isSelected ? 'bg-primary/20' : 'bg-muted'
                        }`}>
                          {isSelected ? (
                            <CheckCircle2 className="w-4 h-4 text-primary" />
                          ) : (
                            <TypeIcon className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{file.name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {typeLabels[file.type]} {file.size ? `· ${file.size}` : ''} {file.date ? `· ${file.date}` : ''}
                          </p>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Import Config Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Importar para Biblioteca</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-xs text-muted-foreground">
              {selectedItems.length} item(ns) selecionado(s) para importação
            </p>

            <Select value={importAccountId} onValueChange={setImportAccountId}>
              <SelectTrigger className="bg-secondary border-border">
                <SelectValue placeholder="Vincular a uma conta TikTok" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {connectedAccounts.map(a => (
                  <SelectItem key={a.id} value={a.id} className="text-foreground">
                    {a.displayName} ({a.username})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={importCategory} onValueChange={(v) => setImportCategory(v as typeof importCategory)}>
              <SelectTrigger className="bg-secondary border-border">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="crescimento">📈 Crescimento</SelectItem>
                <SelectItem value="monetizacao">💰 Monetização</SelectItem>
                <SelectItem value="vendas">🛒 Vendas</SelectItem>
              </SelectContent>
            </Select>

            <Button onClick={handleImport} className="w-full gradient-red text-primary-foreground gap-2">
              <Import className="w-4 h-4" /> Confirmar Importação
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
