import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Upload, Search, Trash2, Download, Loader2, ImageIcon, VideoIcon,
  Crop, Move, Maximize2, Square, Eraser, Crosshair, FileOutput,
  AlertTriangle, CheckCircle2, ShieldCheck
} from 'lucide-react';
import { processImage, processVideoFrame, manualCropImage, removeWatermarkAreas } from '@/lib/imageProcessor';
import { ManualImageEditor } from '@/components/views/ManualImageEditor';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

type Preset = { label: string; w: number; h: number };

const socialPresets: Preset[] = [
  { label: 'TikTok / Reels (9:16)', w: 1080, h: 1920 },
  { label: 'Feed Instagram (1:1)', w: 1080, h: 1080 },
  { label: 'Story (9:16)', w: 1080, h: 1920 },
  { label: 'YouTube (16:9)', w: 1920, h: 1080 },
  { label: 'Twitter/X (16:9)', w: 1200, h: 675 },
  { label: 'Personalizado', w: 0, h: 0 },
];

interface AdjustSettings {
  crop: boolean;
  reframe: boolean;
  resize: boolean;
  borders: boolean;
  removeElements: boolean;
  repositioning: boolean;
}

interface HistoryItem {
  id: string;
  name: string;
  type: 'image' | 'video';
  date: string;
  preset: string;
}

const STORAGE_KEY = 'progcontrol-visual-adjustments-history';
function getHistory(): HistoryItem[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}
function saveHistory(h: HistoryItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(h));
}

const defaultSettings: AdjustSettings = {
  crop: false, reframe: false, resize: false,
  borders: false, removeElements: false, repositioning: false,
};

const settingsMeta: Record<keyof AdjustSettings, { label: string; desc: string; icon: React.ReactNode }> = {
  crop: { label: 'Recortar', desc: 'Cortar áreas indesejadas', icon: <Crop className="w-4 h-4" /> },
  reframe: { label: 'Reenquadrar', desc: 'Ajustar enquadramento do conteúdo', icon: <Move className="w-4 h-4" /> },
  resize: { label: 'Redimensionar', desc: 'Formato para redes sociais', icon: <Maximize2 className="w-4 h-4" /> },
  borders: { label: 'Ajustar Bordas', desc: 'Adicionar ou ajustar bordas', icon: <Square className="w-4 h-4" /> },
  removeElements: { label: 'Remover Elementos', desc: 'Remover elementos visuais pequenos', icon: <Eraser className="w-4 h-4" /> },
  repositioning: { label: 'Reposicionar', desc: 'Corrigir posição na tela', icon: <Crosshair className="w-4 h-4" /> },
};



interface ManualEditorContentProps {
  file: File;
  fileType: 'image' | 'video' | null;
  originalPreview: string | null;
  preview: string | null;
  done: boolean;
  resultBlob: Blob | null;
  processing: boolean;
  onReset: () => void;
  onProcessing: (v: boolean) => void;
  onResultBlob: (b: Blob | null) => void;
  onPreview: (u: string) => void;
  onOriginalPreview: (u: string) => void;
  onFile: (f: File) => void;
  onDone: (v: boolean) => void;
  onXP?: (amount: number) => void;
  onDownload: () => void;
}

function ManualEditorContent({
  file, fileType, originalPreview, preview, done, resultBlob, processing,
  onReset, onProcessing, onResultBlob, onPreview, onOriginalPreview, onFile, onDone, onXP, onDownload
}: ManualEditorContentProps) {
  const isVideo = fileType === 'video';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isVideo ? <VideoIcon className="w-4 h-4 text-primary" /> : <ImageIcon className="w-4 h-4 text-primary" />}
          <span className="text-sm font-medium text-foreground truncate max-w-[200px]">{file.name}</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
            {isVideo ? 'Vídeo' : 'Imagem'}
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={onReset} className="text-muted-foreground text-xs">Trocar</Button>
      </div>

      <ManualImageEditor
        {...(isVideo ? { videoSrc: originalPreview! } : { imageSrc: originalPreview! })}
        onCropApply={async (sel) => {
          try {
            onProcessing(true);
            const blob = await manualCropImage(file, sel);
            onResultBlob(blob);
            onPreview(URL.createObjectURL(blob));
            onDone(true);
            onXP?.(10);
            toast.success('Recorte aplicado! +10 XP');
          } catch (err) {
            toast.error('Erro ao recortar: ' + (err instanceof Error ? err.message : 'desconhecido'));
          } finally {
            onProcessing(false);
          }
        }}
        onWatermarkApply={async (areas) => {
          try {
            onProcessing(true);
            let lastProgress = 0;
            const progressToastId = 'watermark-removal-progress';
            toast.loading(isVideo ? 'Preparando remoção da marca d\'água... 0%' : 'Removendo marca d\'água... 0%', {
              id: progressToastId,
              duration: Infinity,
            });

            const blob = await removeWatermarkAreas(file, areas, (percent) => {
              if (percent - lastProgress < 5 && percent < 100) return;
              lastProgress = percent;

              const msg = isVideo
                ? percent < 28
                  ? `Gerando patch limpo com IA... ${percent}%`
                  : percent < 95
                  ? `Aplicando remoção no vídeo... ${percent}%`
                  : `Finalizando vídeo... ${percent}%`
                : percent < 82
                ? `Reconstruindo área marcada... ${percent}%`
                : `Finalizando imagem... ${percent}%`;

              toast.loading(msg, { id: progressToastId, duration: Infinity });
            });

            toast.dismiss(progressToastId);
            onResultBlob(blob);
            const url = URL.createObjectURL(blob);
            onPreview(url);

            if (!isVideo) {
              onOriginalPreview(url);
              onFile(new File([blob], file.name, { type: blob.type || 'image/png' }));
            }

            onDone(true);
            onXP?.(15);
            toast.success('Marca d\'água removida com IA! +15 XP');
          } catch (err) {
            toast.dismiss('watermark-removal-progress');
            toast.error('Erro ao remover marca d\'água: ' + (err instanceof Error ? err.message : 'desconhecido'));
          } finally {
            onProcessing(false);
          }
        }}
      />

      {done && resultBlob && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-primary bg-primary/10 border border-primary/20 rounded-lg p-3">
            <CheckCircle2 className="w-4 h-4" />
            <span>{isVideo ? 'Vídeo processado! Resultado pronto para download.' : 'Edição aplicada! Resultado pronto para download.'}</span>
          </div>
          <div className="rounded-lg overflow-hidden border border-primary/30 bg-secondary max-h-64 flex items-center justify-center">
            {isVideo ? (
              <video src={preview!} controls className="max-h-64 object-contain" />
            ) : (
              <img src={preview!} alt="resultado" className="max-h-64 object-contain" />
            )}
          </div>
          <Button variant="outline" className="gap-2 border-primary/30 text-primary hover:bg-primary/10" onClick={onDownload}>
            <Download className="w-4 h-4" /> Baixar Resultado
          </Button>
        </motion.div>
      )}
    </div>
  );
}


export function VisualAdjustmentsView({ onXP }: { onXP?: (amount: number) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [originalPreview, setOriginalPreview] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileType, setFileType] = useState<'image' | 'video' | null>(null);
  const [settings, setSettings] = useState<AdjustSettings>(defaultSettings);
  const [selectedPreset, setSelectedPreset] = useState<number>(0);
  const [borderRadius, setBorderRadius] = useState([0]);
  const [borderWidth, setBorderWidth] = useState([0]);
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>(getHistory);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'adjust' | 'manual' | 'history'>('adjust');

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setDone(false);
    const isVideo = f.type.startsWith('video/');
    const isImage = f.type.startsWith('image/');
    if (!isVideo && !isImage) {
      toast.error('Formato não suportado. Envie uma imagem ou vídeo.');
      return;
    }
    setFile(f);
    setFileType(isVideo ? 'video' : 'image');
    const url = URL.createObjectURL(f);
    setOriginalPreview(url);
    setPreview(url);
  };

  const processFile = async () => {
    if (!file) return;
    if (settings.removeElements && !rightsConfirmed) {
      toast.error('Confirme que você possui os direitos do conteúdo para remover elementos.');
      return;
    }
    setProcessing(true);
    setDone(false);
    setResultBlob(null);

    try {
      const preset = socialPresets[selectedPreset];
      const processingOpts = {
        crop: settings.crop,
        resize: settings.resize,
        borders: settings.borders,
        targetWidth: preset.w,
        targetHeight: preset.h,
        borderWidth: borderWidth[0],
        borderRadius: borderRadius[0],
      };

      if (fileType === 'image') {
        const blob = await processImage(file, processingOpts);
        setResultBlob(blob);
        setPreview(URL.createObjectURL(blob));
      } else if (fileType === 'video') {
        const blob = await processVideoFrame(file, processingOpts, 1);
        setResultBlob(blob);
        setPreview(URL.createObjectURL(blob));
      }
      setDone(true);
      const item: HistoryItem = {
        id: Date.now().toString(),
        name: file.name,
        type: fileType!,
        date: new Date().toISOString(),
        preset: socialPresets[selectedPreset].label,
      };
      const updated = [item, ...history];
      setHistory(updated);
      saveHistory(updated);
      onXP?.(10);
      toast.success('Ajustes aplicados com sucesso! +10 XP');
    } catch (err) {
      toast.error('Erro ao processar imagem: ' + (err instanceof Error ? err.message : 'desconhecido'));
    } finally {
      setProcessing(false);
    }
  };

  const downloadResult = () => {
    const blob = resultBlob || (file ? file : null);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const isVideoResult = blob.type.startsWith('video/');
    const ext = isVideoResult ? '.webm' : '.png';
    a.download = file ? file.name.replace(/\.[^.]+$/, '_edited' + ext) : 'edited' + ext;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Download iniciado!');
  };

  const deleteItem = (id: string) => {
    const updated = history.filter(h => h.id !== id);
    setHistory(updated);
    saveHistory(updated);
    toast.success('Item removido');
  };

  const toggleSetting = (key: keyof AdjustSettings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const filteredHistory = history.filter(h =>
    !searchQuery ||
    h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    h.preset.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const reset = () => {
    setFile(null);
    setOriginalPreview(null);
    setPreview(null);
    setFileType(null);
    setDone(false);
    setResultBlob(null);
    setSettings(defaultSettings);
    setRightsConfirmed(false);
  };

  const anySettingActive = Object.values(settings).some(Boolean);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-wide text-foreground">Ajustes Visuais</h2>
        <p className="text-sm text-muted-foreground mt-1">Recorte, redimensione e prepare seus conteúdos para publicação</p>
      </div>

      {/* Responsible use warning */}
      <Alert className="border-primary/30 bg-primary/5">
        <ShieldCheck className="w-4 h-4 text-primary" />
        <AlertDescription className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">Uso responsável:</span> Edite apenas arquivos de sua autoria ou que você tenha autorização para modificar. 
          O uso indevido de conteúdos protegidos por direitos autorais é de responsabilidade do usuário.
        </AlertDescription>
      </Alert>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {(['adjust', 'manual', 'history'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab
                ? 'bg-primary/15 text-primary border border-primary/30'
                : 'bg-secondary text-muted-foreground border border-border hover:text-foreground'
            }`}
          >
            {tab === 'adjust' ? '✂️ Automático' : tab === 'manual' ? '✋ Manual' : `📋 Histórico (${history.length})`}
          </button>
        ))}
      </div>

      {activeTab === 'adjust' && (
        <div className="space-y-5">
          {/* Upload */}
          <Card className="bg-card border-border">
            <CardContent className="p-5">
              <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFile} />
              {!file ? (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full border-2 border-dashed border-border rounded-xl p-10 flex flex-col items-center gap-3 hover:border-primary/40 transition-colors"
                >
                  <Upload className="w-10 h-10 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Clique para enviar imagem ou vídeo</span>
                  <span className="text-[10px] text-muted-foreground/60">JPG, PNG, WEBP, MP4, MOV</span>
                </button>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {fileType === 'image' ? <ImageIcon className="w-4 h-4 text-primary" /> : <VideoIcon className="w-4 h-4 text-primary" />}
                      <span className="text-sm font-medium text-foreground truncate max-w-[200px]">{file.name}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                        {fileType === 'image' ? 'Imagem' : 'Vídeo'}
                      </span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={reset} className="text-muted-foreground text-xs">Trocar</Button>
                  </div>

                  {fileType === 'image' && originalPreview && (
                    done && resultBlob ? (
                      /* Before / After side by side */
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="px-2 py-0.5 rounded bg-secondary border border-border">Antes</span>
                          <span className="flex-1 border-t border-border" />
                          <span className="px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">Depois</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-lg overflow-hidden border border-border bg-secondary flex items-center justify-center max-h-56">
                            <img src={originalPreview} alt="antes" className="max-h-56 object-contain w-full" />
                          </div>
                          <div className="rounded-lg overflow-hidden border border-primary/30 bg-secondary flex items-center justify-center max-h-56">
                            <img src={preview!} alt="depois" className="max-h-56 object-contain w-full" />
                          </div>
                        </div>
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                          className="flex items-center gap-2 text-sm text-primary bg-primary/10 border border-primary/20 rounded-lg p-3"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Ajustes aplicados! Arquivo pronto para exportação.</span>
                        </motion.div>
                      </div>
                    ) : (
                      <div className="rounded-lg overflow-hidden border border-border bg-secondary max-h-64 flex items-center justify-center">
                        <img src={originalPreview} alt="preview" className="max-h-64 object-contain" />
                      </div>
                    )
                  )}
                  {fileType === 'video' && preview && (
                    done && resultBlob ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="px-2 py-0.5 rounded bg-secondary border border-border">Frame Original</span>
                          <span className="flex-1 border-t border-border" />
                          <span className="px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">Depois</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-lg overflow-hidden border border-border bg-secondary flex items-center justify-center max-h-56">
                            <video src={originalPreview!} className="max-h-56 object-contain w-full" />
                          </div>
                          <div className="rounded-lg overflow-hidden border border-primary/30 bg-secondary flex items-center justify-center max-h-56">
                            <img src={preview} alt="depois" className="max-h-56 object-contain w-full" />
                          </div>
                        </div>
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                          className="flex items-center gap-2 text-sm text-primary bg-primary/10 border border-primary/20 rounded-lg p-3"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Frame processado! Arquivo pronto para exportação.</span>
                        </motion.div>
                      </div>
                    ) : (
                      <div className="rounded-lg overflow-hidden border border-border bg-secondary max-h-64 flex items-center justify-center">
                        <video src={preview} controls className="max-h-64 w-full" />
                      </div>
                    )
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Adjustment settings */}
          {file && (
            <Card className="bg-card border-border">
              <CardContent className="p-5 space-y-1">
                <div className="flex items-center gap-2 mb-3">
                  <Crop className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">Ajustes Disponíveis</h3>
                </div>
                {(Object.keys(settingsMeta) as (keyof AdjustSettings)[]).map(key => (
                  <div key={key} className="flex items-center justify-between py-2.5 border-b border-border/40 last:border-0">
                    <div className="flex items-center gap-3">
                      <span className="text-primary">{settingsMeta[key].icon}</span>
                      <div>
                        <span className="text-sm text-foreground">{settingsMeta[key].label}</span>
                        <p className="text-[10px] text-muted-foreground">{settingsMeta[key].desc}</p>
                      </div>
                    </div>
                    <Switch checked={settings[key]} onCheckedChange={() => toggleSetting(key)} />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Rights confirmation for remove elements */}
          {file && settings.removeElements && (
            <Card className="bg-card border-border border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="rights"
                    checked={rightsConfirmed}
                    onCheckedChange={(v) => setRightsConfirmed(v === true)}
                    className="mt-0.5"
                  />
                  <label htmlFor="rights" className="text-sm text-foreground cursor-pointer leading-relaxed">
                    <span className="font-semibold flex items-center gap-1.5 mb-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-primary" /> Declaração de Direitos
                    </span>
                    Confirmo que sou o autor ou tenho autorização para editar e remover elementos deste conteúdo.
                  </label>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Social presets */}
          {file && settings.resize && (
            <Card className="bg-card border-border">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Maximize2 className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">Formato de Saída</h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {socialPresets.map((p, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedPreset(i)}
                      className={`text-left px-3 py-2.5 rounded-lg text-xs font-medium transition-all border ${
                        selectedPreset === i
                          ? 'bg-primary/15 text-primary border-primary/30'
                          : 'bg-secondary text-muted-foreground border-border hover:text-foreground hover:border-border'
                      }`}
                    >
                      {p.label}
                      {p.w > 0 && <span className="block text-[10px] mt-0.5 opacity-70">{p.w}×{p.h}</span>}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Border settings */}
          {file && settings.borders && (
            <Card className="bg-card border-border">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <Square className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">Configuração de Bordas</h3>
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-xs text-muted-foreground">Espessura</span>
                      <span className="text-xs text-primary font-medium">{borderWidth[0]}px</span>
                    </div>
                    <Slider value={borderWidth} onValueChange={setBorderWidth} max={20} step={1} />
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-xs text-muted-foreground">Arredondamento</span>
                      <span className="text-xs text-primary font-medium">{borderRadius[0]}px</span>
                    </div>
                    <Slider value={borderRadius} onValueChange={setBorderRadius} max={50} step={1} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          {file && (
            <div className="flex gap-3">
              <Button
                onClick={processFile}
                disabled={processing || !anySettingActive}
                className="flex-1 gradient-red text-primary-foreground glow-red gap-2"
              >
                {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileOutput className="w-4 h-4" />}
                {processing ? 'Processando...' : 'Aplicar Ajustes e Exportar'}
              </Button>
              {done && (
                <Button variant="outline" className="gap-2 border-primary/30 text-primary hover:bg-primary/10" onClick={downloadResult}>
                  <Download className="w-4 h-4" /> Baixar
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'manual' && (
        <div className="space-y-5">
          {/* Upload for manual editing */}
          <Card className="bg-card border-border">
            <CardContent className="p-5">
              <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFile} />
              {!file ? (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full border-2 border-dashed border-border rounded-xl p-10 flex flex-col items-center gap-3 hover:border-primary/40 transition-colors"
                >
                  <Upload className="w-10 h-10 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Envie uma imagem ou vídeo para editar manualmente</span>
                  <span className="text-[10px] text-muted-foreground/60">JPG, PNG, WEBP, MP4, MOV — Recorte livre e remoção de marca d'água</span>
                </button>
              ) : originalPreview ? (
                <ManualEditorContent
                  file={file}
                  fileType={fileType}
                  originalPreview={originalPreview}
                  preview={preview}
                  done={done}
                  resultBlob={resultBlob}
                  processing={processing}
                  onReset={reset}
                  onProcessing={setProcessing}
                  onResultBlob={setResultBlob}
                  onPreview={setPreview}
                  onOriginalPreview={setOriginalPreview}
                  onFile={setFile}
                  onDone={setDone}
                  onXP={onXP}
                  onDownload={downloadResult}
                />
              ) : null}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="flex gap-3 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar no histórico..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10 bg-secondary border-border" />
            </div>
            {history.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => { setHistory([]); saveHistory([]); toast.success('Histórico limpo'); }} className="text-destructive border-destructive/30 hover:bg-destructive/10 gap-1">
                <Trash2 className="w-3.5 h-3.5" /> Limpar
              </Button>
            )}
          </div>

          {filteredHistory.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              {history.length === 0 ? 'Nenhum ajuste realizado ainda' : 'Nenhum resultado encontrado'}
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
                  {item.type === 'image' ? <ImageIcon className="w-5 h-5 text-primary flex-shrink-0" /> : <VideoIcon className="w-5 h-5 text-primary flex-shrink-0" />}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                    <div className="flex gap-2 mt-0.5 flex-wrap">
                      <span className="text-[10px] text-primary font-medium">{item.preset}</span>
                      <span className="text-[10px] text-muted-foreground">{new Date(item.date).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => toast.info('Download simulado')} className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all" title="Baixar novamente">
                    <Download className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteItem(item.id)} className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all" title="Excluir">
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
