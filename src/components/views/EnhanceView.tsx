import { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Upload, Search, Trash2, Download, Loader2, ImageIcon, VideoIcon, Sparkles, SlidersHorizontal, Eye, Wand2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface EnhanceSettings {
  sharpness: boolean;
  denoise: boolean;
  lighting: boolean;
  contrast: boolean;
  definition: boolean;
  upscale: boolean;
  stabilize: boolean;
}

interface EnhanceHistoryItem {
  id: string;
  name: string;
  type: 'image' | 'video';
  date: string;
  settings: EnhanceSettings;
}

const STORAGE_KEY = 'progcontrol-enhance-history';

function getHistory(): EnhanceHistoryItem[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}
function saveHistory(h: EnhanceHistoryItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(h));
}

const defaultSettings: EnhanceSettings = {
  sharpness: true, denoise: true, lighting: true, contrast: true,
  definition: true, upscale: false, stabilize: false,
};

const settingLabels: Record<keyof EnhanceSettings, { label: string; icon: string }> = {
  sharpness: { label: 'Nitidez', icon: '🔍' },
  denoise: { label: 'Redução de Ruído', icon: '🔇' },
  lighting: { label: 'Iluminação', icon: '💡' },
  contrast: { label: 'Contraste', icon: '🎚️' },
  definition: { label: 'Definição', icon: '✨' },
  upscale: { label: 'Upscale de Resolução', icon: '📐' },
  stabilize: { label: 'Estabilização (vídeo)', icon: '📹' },
};

// ── Canvas-based processing ──

function applyConvolution(imageData: ImageData, kernel: number[], divisor: number) {
  const { width, height, data } = imageData;
  const output = new Uint8ClampedArray(data);
  const kSize = Math.sqrt(kernel.length) | 0;
  const half = (kSize / 2) | 0;

  for (let y = half; y < height - half; y++) {
    for (let x = half; x < width - half; x++) {
      let r = 0, g = 0, b = 0;
      for (let ky = 0; ky < kSize; ky++) {
        for (let kx = 0; kx < kSize; kx++) {
          const px = ((y + ky - half) * width + (x + kx - half)) * 4;
          const w = kernel[ky * kSize + kx];
          r += data[px] * w;
          g += data[px + 1] * w;
          b += data[px + 2] * w;
        }
      }
      const idx = (y * width + x) * 4;
      output[idx] = Math.min(255, Math.max(0, r / divisor));
      output[idx + 1] = Math.min(255, Math.max(0, g / divisor));
      output[idx + 2] = Math.min(255, Math.max(0, b / divisor));
    }
  }
  return new ImageData(output, width, height);
}

function applyCanvasFilters(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  w: number, h: number,
  settings: EnhanceSettings,
) {
  const filters: string[] = [];
  if (settings.contrast) filters.push('contrast(1.15)');
  if (settings.lighting) filters.push('brightness(1.1)');
  if (settings.definition) filters.push('saturate(1.12)');

  ctx.filter = filters.length > 0 ? filters.join(' ') : 'none';
  ctx.drawImage(source, 0, 0, w, h);
  ctx.filter = 'none';

  let imageData = ctx.getImageData(0, 0, w, h);
  if (settings.denoise) {
    imageData = applyConvolution(imageData, [1,1,1,1,2,1,1,1,1], 10);
    ctx.putImageData(imageData, 0, 0);
    imageData = ctx.getImageData(0, 0, w, h);
  }
  if (settings.sharpness) {
    imageData = applyConvolution(imageData, [0,-1,0,-1,5,-1,0,-1,0], 1);
    ctx.putImageData(imageData, 0, 0);
  }
}

function processImageOnCanvas(
  img: HTMLImageElement,
  settings: EnhanceSettings
): string {
  const scale = settings.upscale ? 2 : 1;
  const w = img.naturalWidth * scale;
  const h = img.naturalHeight * scale;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);

  applyCanvasFilters(ctx, canvas, w, h, settings);
  return canvas.toDataURL('image/png');
}

function processVideoWithCanvas(
  file: File,
  settings: EnhanceSettings,
  onProgress?: (pct: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';

    video.onloadedmetadata = () => {
      const w = video.videoWidth;
      const h = video.videoHeight;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;

      const stream = canvas.captureStream();
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? 'video/webm;codecs=vp9'
          : 'video/webm',
        videoBitsPerSecond: 5_000_000,
      });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        resolve(URL.createObjectURL(blob));
      };
      recorder.onerror = () => reject(new Error('Erro ao gravar vídeo'));

      const duration = video.duration;
      const fps = 30;
      const totalFrames = Math.floor(duration * fps);
      let currentFrame = 0;

      recorder.start();

      const processNextFrame = () => {
        if (currentFrame >= totalFrames) {
          recorder.stop();
          URL.revokeObjectURL(video.src);
          return;
        }

        const time = currentFrame / fps;
        video.currentTime = time;
      };

      video.onseeked = () => {
        // Draw original frame
        ctx.drawImage(video, 0, 0, w, h);
        // Apply enhancement filters
        applyCanvasFilters(ctx, canvas, w, h, settings);

        currentFrame++;
        onProgress?.(Math.round((currentFrame / totalFrames) * 100));

        // Small delay to let MediaRecorder capture the frame
        setTimeout(processNextFrame, 1000 / fps);
      };

      processNextFrame();
    };

    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      reject(new Error('Falha ao carregar vídeo'));
    };
    video.src = URL.createObjectURL(file);
  });
}

export function EnhanceView({ onXP }: { onXP?: (amount: number) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [fileType, setFileType] = useState<'image' | 'video' | null>(null);
  const [settings, setSettings] = useState<EnhanceSettings>(defaultSettings);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [history, setHistory] = useState<EnhanceHistoryItem[]>(getHistory);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'enhance' | 'history'>('enhance');

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setDone(false);
    setResultUrl(null);
    setShowComparison(false);
    const isVideo = f.type.startsWith('video/');
    const isImage = f.type.startsWith('image/');
    if (!isVideo && !isImage) {
      toast.error('Formato não suportado. Envie uma imagem ou vídeo.');
      return;
    }
    setFile(f);
    setFileType(isVideo ? 'video' : 'image');
    setPreview(URL.createObjectURL(f));
    setSettings(prev => ({ ...prev, stabilize: isVideo }));
  };

  const fileToBase64 = (f: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(f);
    });
  };

  const processFile = useCallback(async () => {
    if (!file || !preview) return;

    if (fileType === 'video') {
      setProcessing(true);
      setDone(false);
      setProgress(0);
      try {
        const resultBlobUrl = await processVideoWithCanvas(file, settings, (pct) => setProgress(pct));
        setResultUrl(resultBlobUrl);
        setDone(true);
        setShowComparison(true);
        const item: EnhanceHistoryItem = {
          id: Date.now().toString(), name: file.name, type: 'video',
          date: new Date().toISOString(), settings,
        };
        const updated = [item, ...history];
        setHistory(updated);
        saveHistory(updated);
        onXP?.(20);
        toast.success('Vídeo melhorado! +20 XP');
      } catch (err) {
        console.error('Video enhancement error:', err);
        toast.error('Erro ao processar vídeo. Tente novamente.');
      } finally {
        setProcessing(false);
        setProgress(0);
      }
      return;
    }

    // AI-powered image enhancement
    setProcessing(true);
    setDone(false);

    try {
      const base64 = await fileToBase64(file);

      const { data, error } = await supabase.functions.invoke('enhance-image', {
        body: { imageBase64: base64, settings },
      });

      if (error) {
        console.error('Edge function error:', error);
        toast.error('Erro ao melhorar imagem. Tente novamente.');
        setProcessing(false);
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        setProcessing(false);
        return;
      }

      if (data?.enhancedImage) {
        setResultUrl(data.enhancedImage);
        setDone(true);
        setShowComparison(true);

        const item: EnhanceHistoryItem = {
          id: Date.now().toString(), name: file.name, type: 'image',
          date: new Date().toISOString(), settings,
        };
        const updated = [item, ...history];
        setHistory(updated);
        saveHistory(updated);
        onXP?.(20);
        toast.success('Imagem melhorada com IA! +20 XP');
      } else {
        toast.error('Não foi possível melhorar a imagem. Tente novamente.');
      }
    } catch (err) {
      console.error('Enhancement error:', err);
      toast.error('Erro ao processar imagem com IA.');
    } finally {
      setProcessing(false);
    }
  }, [file, preview, fileType, settings, history, onXP]);

  const downloadResult = () => {
    if (!resultUrl || !file) return;
    const a = document.createElement('a');
    a.href = resultUrl;
    const ext = fileType === 'video' ? 'webm' : 'png';
    a.download = `enhanced_${file.name.replace(/\.[^.]+$/, '')}.${ext}`;
    a.click();
    toast.success('Download iniciado!');
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

  const toggleSetting = (key: keyof EnhanceSettings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const filteredHistory = history.filter(h =>
    !searchQuery ||
    h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    h.type.includes(searchQuery.toLowerCase())
  );

  const reset = () => {
    setFile(null);
    setPreview(null);
    setResultUrl(null);
    setFileType(null);
    setDone(false);
    setShowComparison(false);
    setSettings(defaultSettings);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-wide text-foreground">Melhorar Qualidade</h2>
        <p className="text-sm text-muted-foreground mt-1">Processamento avançado de imagens e vídeos via Inteligência Artificial</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(['enhance', 'history'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab
                ? 'bg-primary/15 text-primary border border-primary/30'
                : 'bg-secondary text-muted-foreground border border-border hover:text-foreground'
            }`}
          >
            {tab === 'enhance' ? '✨ Melhorar' : `📋 Histórico (${history.length})`}
          </button>
        ))}
      </div>

      {activeTab === 'enhance' && (
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

                  {/* Before / After comparison */}
                  {preview && (
                    <div className="space-y-3">
                      {showComparison && resultUrl ? (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider text-center">Antes</p>
                            <div className="rounded-lg overflow-hidden border border-border bg-secondary">
                              {fileType === 'image' ? (
                                <img src={preview} alt="original" className="w-full max-h-52 object-contain" />
                              ) : (
                                <video src={preview} controls className="w-full max-h-52" />
                              )}
                            </div>
                          </div>
                          <div>
                            <p className="text-[10px] text-primary mb-1 uppercase tracking-wider text-center font-semibold">Depois</p>
                            <div className="rounded-lg overflow-hidden border border-primary/30 bg-secondary">
                              {fileType === 'image' ? (
                                <img src={resultUrl} alt="enhanced" className="w-full max-h-52 object-contain" />
                              ) : (
                                <video src={resultUrl} controls className="w-full max-h-52" />
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-lg overflow-hidden border border-border bg-secondary max-h-64 flex items-center justify-center">
                          {fileType === 'image' ? (
                            <img src={preview} alt="preview" className="max-h-64 object-contain" />
                          ) : (
                            <video src={preview} controls className="max-h-64 w-full" />
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {done && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-2 text-sm text-primary bg-primary/10 border border-primary/20 rounded-lg p-3"
                    >
                      <Eye className="w-4 h-4" />
                       <span>
                        {fileType === 'image'
                          ? 'Melhoria aplicada via IA! Pronto para download.'
                          : 'Vídeo melhorado com sucesso! Pronto para download.'}
                      </span>
                    </motion.div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Settings */}
          {file && (
            <Card className="bg-card border-border">
              <CardContent className="p-5 space-y-1">
                <div className="flex items-center gap-2 mb-3">
                  <SlidersHorizontal className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">Melhorias</h3>
                </div>
                {(Object.keys(settingLabels) as (keyof EnhanceSettings)[]).map(key => {
                  if (key === 'stabilize' && fileType !== 'video') return null;
                  return (
                    <div key={key} className="flex items-center justify-between py-2.5 border-b border-border/40 last:border-0">
                      <span className="text-sm text-foreground flex items-center gap-2">
                        <span>{settingLabels[key].icon}</span> {settingLabels[key].label}
                      </span>
                      <Switch checked={settings[key]} onCheckedChange={() => toggleSetting(key)} />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          {file && (
            <div className="flex gap-3">
              <Button
                onClick={processFile}
                disabled={processing}
                className="flex-1 gradient-red text-primary-foreground glow-red gap-2"
              >
                {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {processing ? (fileType === 'video' && progress > 0 ? `Processando... ${progress}%` : 'Processando...') : 'Aplicar Melhorias'}
              </Button>
              {done && resultUrl && (
                <Button variant="outline" className="gap-2 border-primary/30 text-primary hover:bg-primary/10" onClick={downloadResult}>
                  <Download className="w-4 h-4" /> Baixar
                </Button>
              )}
            </div>
          )}
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
              <Button variant="outline" size="sm" onClick={clearHistory} className="text-destructive border-destructive/30 hover:bg-destructive/10 gap-1">
                <Trash2 className="w-3.5 h-3.5" /> Limpar
              </Button>
            )}
          </div>

          {filteredHistory.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              {history.length === 0 ? 'Nenhum arquivo melhorado ainda' : 'Nenhum resultado encontrado'}
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
                      <span className="text-[10px] text-primary font-medium">{item.type === 'image' ? 'Imagem' : 'Vídeo'}</span>
                      <span className="text-[10px] text-muted-foreground">{new Date(item.date).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => toast.info('Reprocesse o arquivo para baixar novamente')} className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all" title="Baixar novamente">
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
