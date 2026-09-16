import { useState, useRef, useCallback, useEffect } from 'react';
import { Crop, Eraser, Hand, RotateCcw, Check, ZoomIn, ZoomOut, MousePointer, Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Mode = 'crop' | 'watermark' | 'eraser' | 'pan';

interface Selection {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface ManualImageEditorProps {
  imageSrc?: string;
  videoSrc?: string;
  onCropApply: (selection: Selection, naturalW: number, naturalH: number) => void;
  onWatermarkApply: (areas: Selection[], naturalW: number, naturalH: number) => void;
}

export function ManualImageEditor({ imageSrc, videoSrc, onCropApply, onWatermarkApply }: ManualImageEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const animFrameRef = useRef<number>(0);

  const isVideo = !!videoSrc;

  const [mode, setMode] = useState<Mode>('watermark');
  const [drawing, setDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentSel, setCurrentSel] = useState<Selection | null>(null);
  const [watermarkAreas, setWatermarkAreas] = useState<Selection[]>([]);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);

  // Get natural dimensions
  const getNatural = useCallback(() => {
    if (isVideo && videoRef.current) {
      return { w: videoRef.current.videoWidth, h: videoRef.current.videoHeight };
    }
    if (!isVideo && imgRef.current) {
      return { w: imgRef.current.naturalWidth, h: imgRef.current.naturalHeight };
    }
    return { w: 1, h: 1 };
  }, [isVideo]);

  // Load image
  useEffect(() => {
    if (isVideo) return;
    if (!imageSrc) return;
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setReady(true);
      setCurrentSel(null);
      setWatermarkAreas([]);
      setZoom(1);
      setPan({ x: 0, y: 0 });
    };
    img.src = imageSrc;
  }, [imageSrc, isVideo]);

  // Load video
  useEffect(() => {
    if (!isVideo || !videoSrc) return;
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';
    video.src = videoSrc;
    video.onloadeddata = () => {
      videoRef.current = video;
      video.pause();
      setPlaying(false);
      setReady(true);
      setCurrentSel(null);
      setWatermarkAreas([]);
      setZoom(1);
      setPan({ x: 0, y: 0 });
    };
    return () => {
      video.pause();
      video.src = '';
    };
  }, [videoSrc, isVideo]);

  // Draw
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const source = isVideo ? videoRef.current : imgRef.current;
    if (!source) return;

    const cw = container.clientWidth;
    const ch = Math.min(500, container.clientWidth * 0.75);
    canvas.width = cw;
    canvas.height = ch;

    const nat = getNatural();
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, cw, ch);

    const scale = Math.min(cw / nat.w, ch / nat.h) * zoom;
    const drawW = nat.w * scale;
    const drawH = nat.h * scale;
    const ox = (cw - drawW) / 2 + pan.x;
    const oy = (ch - drawH) / 2 + pan.y;

    ctx.drawImage(source as CanvasImageSource, ox, oy, drawW, drawH);

    // Draw watermark areas
    watermarkAreas.forEach((area, i) => {
      const rx = ox + area.x * scale;
      const ry = oy + area.y * scale;
      const rw = area.w * scale;
      const rh = area.h * scale;
      ctx.fillStyle = 'rgba(239, 68, 68, 0.35)';
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.strokeRect(rx, ry, rw, rh);
      ctx.setLineDash([]);
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(`${i + 1}`, rx + 4, ry + 14);
    });

    // Current selection
    if (currentSel) {
      const rx = ox + currentSel.x * scale;
      const ry = oy + currentSel.y * scale;
      const rw = currentSel.w * scale;
      const rh = currentSel.h * scale;

      if (mode === 'crop') {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, cw, ry);
        ctx.fillRect(0, ry, rx, rh);
        ctx.fillRect(rx + rw, ry, cw - rx - rw, rh);
        ctx.fillRect(0, ry + rh, cw, ch - ry - rh);
        ctx.strokeStyle = 'hsl(var(--primary))';
        ctx.lineWidth = 2;
        ctx.strokeRect(rx, ry, rw, rh);
        const hs = 8;
        ctx.fillStyle = 'hsl(var(--primary))';
        [[rx, ry], [rx + rw, ry], [rx, ry + rh], [rx + rw, ry + rh]].forEach(([cx, cy]) => {
          ctx.fillRect(cx - hs / 2, cy - hs / 2, hs, hs);
        });
      } else if (mode === 'watermark') {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.35)';
        ctx.fillRect(rx, ry, rw, rh);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 3]);
        ctx.strokeRect(rx, ry, rw, rh);
        ctx.setLineDash([]);
      }
    }
  }, [ready, zoom, pan, currentSel, watermarkAreas, mode, isVideo, getNatural]);

  // Redraw loop for video (renders every frame while playing)
  useEffect(() => {
    if (!isVideo) return;
    let running = true;
    const loop = () => {
      if (!running) return;
      draw();
      animFrameRef.current = requestAnimationFrame(loop);
    };
    if (playing) {
      loop();
    } else {
      draw(); // draw paused frame
    }
    return () => {
      running = false;
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [isVideo, playing, draw]);

  // Static draw for images
  useEffect(() => {
    if (!isVideo) draw();
  }, [draw, isVideo]);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const obs = new ResizeObserver(() => draw());
    obs.observe(container);
    return () => obs.disconnect();
  }, [draw]);

  const canvasToImage = (cx: number, cy: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const nat = getNatural();
    const cw = canvas.width;
    const ch = canvas.height;
    const scale = Math.min(cw / nat.w, ch / nat.h) * zoom;
    const ox = (cw - nat.w * scale) / 2 + pan.x;
    const oy = (ch - nat.h * scale) / 2 + pan.y;
    return { x: (cx - ox) / scale, y: (cy - oy) / scale };
  };

  const getCanvasPos = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (mode === 'eraser') {
      const pos = getCanvasPos(e);
      const imgPos = canvasToImage(pos.x, pos.y);
      const idx = watermarkAreas.findIndex(a =>
        imgPos.x >= a.x && imgPos.x <= a.x + a.w &&
        imgPos.y >= a.y && imgPos.y <= a.y + a.h
      );
      if (idx !== -1) setWatermarkAreas(prev => prev.filter((_, i) => i !== idx));
      return;
    }
    if (mode === 'pan') {
      setDrawing(true);
      setStartPos(getCanvasPos(e));
      return;
    }
    const pos = getCanvasPos(e);
    const imgPos = canvasToImage(pos.x, pos.y);
    setDrawing(true);
    setStartPos(imgPos);
    setCurrentSel({ x: imgPos.x, y: imgPos.y, w: 0, h: 0 });
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!drawing) return;
    if (mode === 'pan') {
      const pos = getCanvasPos(e);
      setPan(prev => ({ x: prev.x + (pos.x - startPos.x), y: prev.y + (pos.y - startPos.y) }));
      setStartPos(pos);
      return;
    }
    if (mode === 'eraser') return;
    const pos = getCanvasPos(e);
    const imgPos = canvasToImage(pos.x, pos.y);
    const nat = getNatural();
    const x = Math.max(0, Math.min(startPos.x, imgPos.x));
    const y = Math.max(0, Math.min(startPos.y, imgPos.y));
    const w = Math.min(Math.abs(imgPos.x - startPos.x), nat.w - x);
    const h = Math.min(Math.abs(imgPos.y - startPos.y), nat.h - y);
    setCurrentSel({ x, y, w, h });
  };

  const onMouseUp = () => {
    if (!drawing) return;
    setDrawing(false);
    if (mode === 'watermark' && currentSel && currentSel.w > 5 && currentSel.h > 5) {
      setWatermarkAreas(prev => [...prev, currentSel]);
      setCurrentSel(null);
    }
  };

  // Video controls
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setPlaying(true);
    } else {
      video.pause();
      setPlaying(false);
    }
  };

  const skipFrames = (dir: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    setPlaying(false);
    video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + dir * (1 / 30)));
  };

  // Get current frame as file for processing
  const captureFrameAsFile = (): File | null => {
    const video = videoRef.current;
    if (!video) return null;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/png');
    const arr = dataUrl.split(',');
    const bstr = atob(arr[1]);
    const u8arr = new Uint8Array(bstr.length);
    for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i);
    return new File([u8arr], 'frame.png', { type: 'image/png' });
  };

  const applyCrop = () => {
    if (!currentSel) return;
    if (currentSel.w < 5 || currentSel.h < 5) return;
    const nat = getNatural();
    // For video, pause first
    if (isVideo && videoRef.current) { videoRef.current.pause(); setPlaying(false); }
    onCropApply(currentSel, nat.w, nat.h);
  };

  const applyWatermark = () => {
    if (watermarkAreas.length === 0) return;
    const nat = getNatural();
    if (isVideo && videoRef.current) { videoRef.current.pause(); setPlaying(false); }
    onWatermarkApply(watermarkAreas, nat.w, nat.h);
  };

  const resetAll = () => {
    setCurrentSel(null);
    setWatermarkAreas([]);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  if (!ready) return null;

  const cursorClass = mode === 'pan'
    ? (drawing ? 'cursor-grabbing' : 'cursor-grab')
    : mode === 'eraser' ? 'cursor-pointer' : 'cursor-crosshair';

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        {([
          { key: 'crop' as Mode, icon: Crop, label: 'Recortar' },
          { key: 'watermark' as Mode, icon: Eraser, label: 'Marcar Área' },
          { key: 'eraser' as Mode, icon: MousePointer, label: 'Borracha' },
          { key: 'pan' as Mode, icon: Hand, label: 'Mover' },
        ]).map(({ key, icon: Icon, label }) => (
          <Button
            key={key}
            variant={mode === key ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setMode(key); setCurrentSel(null); }}
            className={`gap-1.5 text-xs ${mode === key ? 'bg-primary text-primary-foreground' : 'border-border text-muted-foreground'}`}
          >
            <Icon className="w-3.5 h-3.5" /> {label}
          </Button>
        ))}

        <div className="flex-1" />

        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}>
          <ZoomOut className="w-4 h-4" />
        </Button>
        <span className="text-xs text-muted-foreground min-w-[40px] text-center">{Math.round(zoom * 100)}%</span>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => setZoom(z => Math.min(3, z + 0.25))}>
          <ZoomIn className="w-4 h-4" />
        </Button>

        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={resetAll}>
          <RotateCcw className="w-4 h-4" />
        </Button>
      </div>

      {/* Video controls */}
      {isVideo && (
        <div className="flex items-center justify-center gap-2">
          <Button size="sm" variant="outline" onClick={() => skipFrames(-1)} className="text-xs gap-1 border-border text-muted-foreground">
            <SkipBack className="w-3.5 h-3.5" /> -1 frame
          </Button>
          <Button size="sm" variant={playing ? 'default' : 'outline'} onClick={togglePlay} className="gap-1.5 text-xs">
            {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {playing ? 'Pausar' : 'Play'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => skipFrames(1)} className="text-xs gap-1 border-border text-muted-foreground">
            +1 frame <SkipForward className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      {/* Canvas */}
      <div ref={containerRef} className="rounded-lg border border-border bg-secondary overflow-hidden">
        <canvas
          ref={canvasRef}
          className={`w-full ${cursorClass}`}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        />
      </div>

      {/* Hints */}
      {isVideo && playing && (
        <p className="text-xs text-primary text-center animate-pulse">
          ▶ Reproduzindo — pause o vídeo para selecionar áreas de marca d'água
        </p>
      )}
      {mode === 'eraser' && (
        <p className="text-xs text-muted-foreground">
          Clique sobre uma área marcada (em vermelho) para removê-la.
          {watermarkAreas.length > 0 && ` ${watermarkAreas.length} área(s) marcada(s).`}
        </p>
      )}

      {/* Info & actions */}
      <div className="flex items-center gap-2 flex-wrap">
        {mode === 'crop' && currentSel && currentSel.w > 5 && (
          <>
            <span className="text-xs text-muted-foreground">
              Seleção: {Math.round(currentSel.w)}×{Math.round(currentSel.h)}px
            </span>
            <Button size="sm" onClick={applyCrop} className="gap-1.5 bg-primary text-primary-foreground text-xs">
              <Check className="w-3.5 h-3.5" /> Aplicar Recorte
            </Button>
          </>
        )}
        {(mode === 'watermark' || mode === 'eraser') && (
          <>
            <span className="text-xs text-muted-foreground">
              {watermarkAreas.length} área(s) selecionada(s)
            </span>
            {watermarkAreas.length > 0 && (
              <>
                <Button size="sm" variant="outline" onClick={() => setWatermarkAreas(prev => prev.slice(0, -1))} className="text-xs border-border text-muted-foreground">
                  Desfazer última
                </Button>
                <Button size="sm" onClick={applyWatermark} className="gap-1.5 bg-primary text-primary-foreground text-xs">
                  <Check className="w-3.5 h-3.5" /> Remover Marcas
                </Button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Utility: capture the current video frame as a File (used by parent components)
export function captureVideoFrame(videoElement: HTMLVideoElement): File {
  const canvas = document.createElement('canvas');
  canvas.width = videoElement.videoWidth;
  canvas.height = videoElement.videoHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(videoElement, 0, 0);
  const dataUrl = canvas.toDataURL('image/png');
  const arr = dataUrl.split(',');
  const bstr = atob(arr[1]);
  const u8arr = new Uint8Array(bstr.length);
  for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i);
  return new File([u8arr], 'frame.png', { type: 'image/png' });
}
