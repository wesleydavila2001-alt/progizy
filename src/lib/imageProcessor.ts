import { mergeWatermarkAreas } from './watermarkRemoval';
import { supabase } from '@/integrations/supabase/client';

export interface ProcessingOptions {
  crop: boolean;
  resize: boolean;
  borders: boolean;
  targetWidth: number;
  targetHeight: number;
  borderWidth: number;
  borderRadius: number;
}

export interface ManualCropArea {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface GeneratedPatch {
  img: HTMLImageElement;
  offsetX: number;
  offsetY: number;
  cropW: number;
  cropH: number;
}

type WatermarkTarget = ManualCropArea | ManualCropArea[];

export function processImage(
  file: File,
  options: ProcessingOptions
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const result = applyTransforms(img, options);
        result.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Falha ao gerar imagem'));
          },
          'image/png',
          0.92
        );
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error('Falha ao carregar imagem'));
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Manually crop an image using pixel coordinates on the original image.
 */
export function manualCropImage(
  file: File,
  area: ManualCropArea
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(area.w);
        canvas.height = Math.round(area.h);
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, area.x, area.y, area.w, area.h, 0, 0, area.w, area.h);
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Falha ao recortar imagem'));
          },
          'image/png',
          0.95
        );
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error('Falha ao carregar imagem'));
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Remove áreas de marca d'água usando IA para resultado natural e imperceptível.
 */
export function removeWatermarkAreas(
  file: File,
  areas: ManualCropArea[],
  onProgress?: (percent: number) => void
): Promise<Blob> {
  const mergedAreas = mergeWatermarkAreas(areas);
  const isVideo = file.type.startsWith('video/');
  
  if (isVideo) {
    return removeWatermarkFromVideoWithAI(file, mergedAreas, onProgress);
  }

  // For images, handled by the caller (VisualAdjustmentsView) via enhance-image edge function
  return removeWatermarkFromImageWithAI(file, mergedAreas, onProgress);
}

/**
 * Extract a crop of the watermark area with padding from a canvas.
 */
function getCombinedAreaBounds(areas: ManualCropArea[]): ManualCropArea {
  const left = Math.min(...areas.map((area) => Math.round(area.x)));
  const top = Math.min(...areas.map((area) => Math.round(area.y)));
  const right = Math.max(...areas.map((area) => Math.round(area.x + area.w)));
  const bottom = Math.max(...areas.map((area) => Math.round(area.y + area.h)));

  return {
    x: left,
    y: top,
    w: Math.max(1, right - left),
    h: Math.max(1, bottom - top),
  };
}

function extractAreaCrop(
  sourceCanvas: HTMLCanvasElement,
  area: WatermarkTarget,
  padding: number = 40,
): { canvas: HTMLCanvasElement; offsetX: number; offsetY: number; cropW: number; cropH: number } {
  const targetArea = Array.isArray(area) ? getCombinedAreaBounds(area) : area;
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  const x = Math.max(0, Math.round(targetArea.x) - padding);
  const y = Math.max(0, Math.round(targetArea.y) - padding);
  const cropW = Math.min(w - x, Math.round(targetArea.w) + padding * 2);
  const cropH = Math.min(h - y, Math.round(targetArea.h) + padding * 2);

  const cropCanvas = document.createElement('canvas');
  cropCanvas.width = cropW;
  cropCanvas.height = cropH;
  const ctx = cropCanvas.getContext('2d')!;
  ctx.drawImage(sourceCanvas, x, y, cropW, cropH, 0, 0, cropW, cropH);

  return { canvas: cropCanvas, offsetX: x, offsetY: y, cropW, cropH };
}

/**
 * Create a guide image with the watermark region painted red.
 */
function createGuideImage(
  cropCanvas: HTMLCanvasElement,
  area: WatermarkTarget,
  offsetX: number,
  offsetY: number,
): HTMLCanvasElement {
  const guide = document.createElement('canvas');
  guide.width = cropCanvas.width;
  guide.height = cropCanvas.height;
  const ctx = guide.getContext('2d')!;
  ctx.drawImage(cropCanvas, 0, 0);

  // Paint the watermark region in solid red
  ctx.fillStyle = 'rgba(255, 0, 0, 0.85)';
  const areas = Array.isArray(area) ? area : [area];
  areas.forEach((item) => {
    const localX = Math.round(item.x) - offsetX;
    const localY = Math.round(item.y) - offsetY;
    ctx.fillRect(localX, localY, Math.round(item.w), Math.round(item.h));
  });

  return guide;
}

function canvasToBase64(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/png');
}

async function createGeneratedPatch(
  sourceCanvas: HTMLCanvasElement,
  area: WatermarkTarget,
  paddingRatio: number,
  minPadding: number,
): Promise<GeneratedPatch> {
  const targetArea = Array.isArray(area) ? getCombinedAreaBounds(area) : area;
  const padding = Math.max(minPadding, Math.round(Math.min(targetArea.w, targetArea.h) * paddingRatio));
  const crop = extractAreaCrop(sourceCanvas, area, padding);
  const guide = createGuideImage(crop.canvas, area, crop.offsetX, crop.offsetY);
  const img = await getAICleanPatch(crop.canvas, guide);

  return {
    img,
    offsetX: crop.offsetX,
    offsetY: crop.offsetY,
    cropW: crop.cropW,
    cropH: crop.cropH,
  };
}

/**
 * Send a crop + guide to AI for inpainting and return the clean patch as an Image.
 */
async function getAICleanPatch(
  cropCanvas: HTMLCanvasElement,
  guideCanvas: HTMLCanvasElement,
): Promise<HTMLImageElement> {
  const imageBase64 = canvasToBase64(cropCanvas);
  const guideImageBase64 = canvasToBase64(guideCanvas);

  const { data, error } = await supabase.functions.invoke('enhance-image', {
    body: { imageBase64, guideImageBase64, mode: 'watermark-removal' },
  });

  if (error || !data?.enhancedImage) {
    throw new Error(data?.error || error?.message || 'Falha ao processar com IA');
  }

  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Falha ao carregar patch da IA'));
    img.src = data.enhancedImage;
  });
}

/**
 * Remove watermark from image using AI.
 */
async function removeWatermarkFromImageWithAI(
  file: File,
  areas: ManualCropArea[],
  onProgress?: (percent: number) => void,
): Promise<Blob> {
  if (!areas.length) {
    throw new Error('Selecione ao menos uma área da marca d\'água.');
  }

  onProgress?.(5);

  const img = await loadImage(file);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);

  onProgress?.(24);
  const patch = await createGeneratedPatch(canvas, areas, 0.35, 30);

  onProgress?.(82);
  ctx.drawImage(patch.img, patch.offsetX, patch.offsetY, patch.cropW, patch.cropH);

  onProgress?.(95);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          onProgress?.(100);
          resolve(blob);
        } else reject(new Error('Falha ao gerar imagem'));
      },
      'image/png',
      0.95,
    );
  });
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Falha ao carregar imagem'));
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Remove watermark from video using AI-powered keyframe inpainting.
 * Strategy: Extract one keyframe, get AI clean patch for each area, then paste onto all frames.
 */
async function removeWatermarkFromVideoWithAI(
  file: File,
  areas: ManualCropArea[],
  onProgress?: (percent: number) => void,
): Promise<Blob> {
  if (!areas.length) {
    throw new Error('Selecione ao menos uma área da marca d\'água.');
  }

  onProgress?.(2);

  const video = await loadVideo(file);

  try {
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) throw new Error('Não foi possível ler as dimensões do vídeo.');

    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 1;
    const fps = selectProcessingFrameRate(duration, w, h);
    const totalFrames = Math.max(1, Math.ceil(duration * fps));
    const frameDuration = 1 / fps;
    const lastFrameTime = Math.max(0, duration - Math.max(0.01, frameDuration * 0.5));
    const videoBitrate = selectVideoBitrate(w, h, fps);
    const yieldToUI = () => new Promise<void>(r => setTimeout(r, 0));

    // Step 1: Extract keyframe and get AI clean patches
    onProgress?.(5);
    await seekTo(video, Math.min(0.5, duration * 0.1)); // Seek to a frame where watermark is visible

    const keyframeCanvas = document.createElement('canvas');
    keyframeCanvas.width = w;
    keyframeCanvas.height = h;
    const keyframeCtx = keyframeCanvas.getContext('2d')!;
    keyframeCtx.drawImage(video, 0, 0, w, h);

    onProgress?.(16);
    const patch = await createGeneratedPatch(keyframeCanvas, areas, 0.45, 36);

    onProgress?.(28);

    // Step 2: Process all frames - draw frame, paste clean patches
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;

    const useWebCodecs = typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined';

    if (useWebCodecs) {
      const { Muxer, ArrayBufferTarget } = await import('webm-muxer');
      const target = new ArrayBufferTarget();
      const muxer = new Muxer({
        target,
        video: { codec: 'V_VP9', width: w, height: h, frameRate: fps },
        type: 'webm',
      });

      let encoderError: Error | null = null;
      const encoder = new VideoEncoder({
        output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
        error: (e) => { encoderError = new Error(e.message); },
      });

      encoder.configure({
        codec: 'vp09.00.10.08',
        width: w,
        height: h,
        bitrate: videoBitrate,
        framerate: fps,
        latencyMode: 'realtime',
      });

      const keyFrameInterval = Math.max(1, fps * 4);

      for (let i = 0; i < totalFrames; i++) {
        const time = Math.min(i * frameDuration, lastFrameTime);
        await seekTo(video, time);
        ctx.drawImage(video, 0, 0, w, h);

        ctx.drawImage(patch.img, patch.offsetX, patch.offsetY, patch.cropW, patch.cropH);

        if (encoderError) throw encoderError;

        const frame = new VideoFrame(canvas, {
          timestamp: Math.round(i * frameDuration * 1_000_000),
          duration: Math.round(frameDuration * 1_000_000),
        });
        encoder.encode(frame, { keyFrame: i === 0 || i % keyFrameInterval === 0 });
        frame.close();

        if (i % 5 === 0) {
          onProgress?.(28 + Math.round((i / totalFrames) * 67));
          await yieldToUI();
        }
      }

      await encoder.flush();
      if (encoderError) throw encoderError;
      encoder.close();
      muxer.finalize();
      onProgress?.(100);

      return new Blob([target.buffer], { type: 'video/webm' });
    } else {
      // MediaRecorder fallback
      const stream = canvas.captureStream(0);
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: videoBitrate });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      const recorderReady = new Promise<Blob>((res, rej) => {
        recorder.onstop = () => res(new Blob(chunks, { type: mimeType }));
        recorder.onerror = () => rej(new Error('Erro ao gravar vídeo'));
      });

      recorder.start();

      for (let i = 0; i < totalFrames; i++) {
        const time = Math.min(i * frameDuration, lastFrameTime);
        await seekTo(video, time);
        ctx.drawImage(video, 0, 0, w, h);

        ctx.drawImage(patch.img, patch.offsetX, patch.offsetY, patch.cropW, patch.cropH);

        (stream.getVideoTracks()[0] as any).requestFrame?.();

        if (i % 5 === 0) {
          onProgress?.(28 + Math.round((i / totalFrames) * 67));
          await yieldToUI();
        }
      }

      recorder.stop();
      onProgress?.(100);
      return await recorderReady;
    }
  } finally {
    video.pause();
    video.removeAttribute('src');
    video.load();
  }
}

function loadVideo(file: File): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.muted = true;
    video.preload = 'auto';
    video.playsInline = true;

    video.onloadedmetadata = () => {
      video.onloadedmetadata = null;
      video.onerror = null;
      resolve(video);
    };
    video.onerror = () => {
      video.onloadedmetadata = null;
      video.onerror = null;
      reject(new Error('Falha ao carregar vídeo'));
    };

    video.src = URL.createObjectURL(file);
  });
}
function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    if (Math.abs(video.currentTime - time) < 0.01) {
      resolve();
      return;
    }
    const handler = () => {
      video.removeEventListener('seeked', handler);
      resolve();
    };
    video.addEventListener('seeked', handler);
    video.currentTime = time;
  });
}

function selectProcessingFrameRate(duration: number, width: number, height: number): number {
  const megapixels = (width * height) / 1_000_000;

  if (duration <= 8 && megapixels <= 1) return 16;
  if (duration <= 15 && megapixels <= 2) return 12;
  if (duration <= 30 && megapixels <= 3) return 9;
  if (duration <= 60 && megapixels <= 4) return 7;
  return 5;
}

function selectVideoBitrate(width: number, height: number, fps: number): number {
  const pixelsPerSecond = width * height * fps;

  if (pixelsPerSecond >= 90_000_000) return 6_500_000;
  if (pixelsPerSecond >= 45_000_000) return 5_500_000;
  return 4_500_000;
}

function applyTransforms(
  img: HTMLImageElement,
  opts: ProcessingOptions
): HTMLCanvasElement {
  let srcX = 0, srcY = 0, srcW = img.naturalWidth, srcH = img.naturalHeight;

  if (opts.crop && opts.targetWidth > 0 && opts.targetHeight > 0) {
    const targetRatio = opts.targetWidth / opts.targetHeight;
    const imgRatio = srcW / srcH;
    if (imgRatio > targetRatio) {
      const newW = srcH * targetRatio;
      srcX = (srcW - newW) / 2;
      srcW = newW;
    } else {
      const newH = srcW / targetRatio;
      srcY = (srcH - newH) / 2;
      srcH = newH;
    }
  }

  let outW = srcW, outH = srcH;
  if (opts.resize && opts.targetWidth > 0 && opts.targetHeight > 0) {
    outW = opts.targetWidth;
    outH = opts.targetHeight;
  }

  const bw = opts.borders ? opts.borderWidth : 0;
  const canvasW = outW + bw * 2;
  const canvasH = outH + bw * 2;

  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d')!;

  if (bw > 0) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvasW, canvasH);
  }

  if (opts.borders && opts.borderRadius > 0) {
    const r = opts.borderRadius;
    ctx.beginPath();
    ctx.moveTo(bw + r, bw);
    ctx.lineTo(bw + outW - r, bw);
    ctx.quadraticCurveTo(bw + outW, bw, bw + outW, bw + r);
    ctx.lineTo(bw + outW, bw + outH - r);
    ctx.quadraticCurveTo(bw + outW, bw + outH, bw + outW - r, bw + outH);
    ctx.lineTo(bw + r, bw + outH);
    ctx.quadraticCurveTo(bw, bw + outH, bw, bw + outH - r);
    ctx.lineTo(bw, bw + r);
    ctx.quadraticCurveTo(bw, bw, bw + r, bw);
    ctx.closePath();
    ctx.clip();
  }

  ctx.drawImage(img, srcX, srcY, srcW, srcH, bw, bw, outW, outH);

  return canvas;
}

export function processVideoFrame(
  file: File,
  options: ProcessingOptions,
  timeSeconds = 1
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.muted = true;
    video.preload = 'auto';

    video.onloadedmetadata = () => {
      const seekTime = Math.min(timeSeconds, video.duration - 0.1);
      video.currentTime = Math.max(0, seekTime);
    };

    video.onseeked = () => {
      try {
        const result = applyVideoTransforms(video, options);
        result.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Falha ao gerar frame do vídeo'));
          },
          'image/png',
          0.92
        );
      } catch (e) {
        reject(e);
      } finally {
        URL.revokeObjectURL(video.src);
      }
    };

    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      reject(new Error('Falha ao carregar vídeo'));
    };

    video.src = URL.createObjectURL(file);
  });
}

function applyVideoTransforms(
  video: HTMLVideoElement,
  opts: ProcessingOptions
): HTMLCanvasElement {
  let srcX = 0, srcY = 0, srcW = video.videoWidth, srcH = video.videoHeight;

  if (opts.crop && opts.targetWidth > 0 && opts.targetHeight > 0) {
    const targetRatio = opts.targetWidth / opts.targetHeight;
    const vidRatio = srcW / srcH;
    if (vidRatio > targetRatio) {
      const newW = srcH * targetRatio;
      srcX = (srcW - newW) / 2;
      srcW = newW;
    } else {
      const newH = srcW / targetRatio;
      srcY = (srcH - newH) / 2;
      srcH = newH;
    }
  }

  let outW = srcW, outH = srcH;
  if (opts.resize && opts.targetWidth > 0 && opts.targetHeight > 0) {
    outW = opts.targetWidth;
    outH = opts.targetHeight;
  }

  const bw = opts.borders ? opts.borderWidth : 0;
  const canvasW = outW + bw * 2;
  const canvasH = outH + bw * 2;

  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d')!;

  if (bw > 0) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvasW, canvasH);
  }

  if (opts.borders && opts.borderRadius > 0) {
    const r = opts.borderRadius;
    ctx.beginPath();
    ctx.moveTo(bw + r, bw);
    ctx.lineTo(bw + outW - r, bw);
    ctx.quadraticCurveTo(bw + outW, bw, bw + outW, bw + r);
    ctx.lineTo(bw + outW, bw + outH - r);
    ctx.quadraticCurveTo(bw + outW, bw + outH, bw + outW - r, bw + outH);
    ctx.lineTo(bw + r, bw + outH);
    ctx.quadraticCurveTo(bw, bw + outH, bw, bw + outH - r);
    ctx.lineTo(bw, bw + r);
    ctx.quadraticCurveTo(bw, bw, bw + r, bw);
    ctx.closePath();
    ctx.clip();
  }

  ctx.drawImage(video, srcX, srcY, srcW, srcH, bw, bw, outW, outH);

  return canvas;
}
