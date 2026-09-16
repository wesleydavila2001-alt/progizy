export interface WatermarkArea {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WatermarkTemporalState {
  patch: Float32Array | null;
  signature: [number, number, number] | null;
  width: number;
  height: number;
  reuseCount: number;
}

interface TextureCandidate {
  x: number;
  y: number;
  distance: number;
}

interface TextureNeighborhoodSample {
  dx: number;
  dy: number;
  weight: number;
}

const FULL_TEXTURE_NEIGHBORHOOD: TextureNeighborhoodSample[] = [
  { dx: 0, dy: 0, weight: 1.8 },
  { dx: -1, dy: 0, weight: 1.15 },
  { dx: 1, dy: 0, weight: 1.15 },
  { dx: 0, dy: -1, weight: 1.15 },
  { dx: 0, dy: 1, weight: 1.15 },
  { dx: -2, dy: 0, weight: 0.35 },
  { dx: 2, dy: 0, weight: 0.35 },
  { dx: 0, dy: -2, weight: 0.35 },
  { dx: 0, dy: 2, weight: 0.35 },
];

const FAST_TEXTURE_NEIGHBORHOOD: TextureNeighborhoodSample[] = [
  { dx: 0, dy: 0, weight: 1.8 },
  { dx: -1, dy: 0, weight: 1 },
  { dx: 1, dy: 0, weight: 1 },
  { dx: 0, dy: -1, weight: 1 },
  { dx: 0, dy: 1, weight: 1 },
];

const DEFAULT_INPAINT_PASSES = 3;
const TEMPORAL_BOOTSTRAP_PASSES = 2;
const TEMPORAL_REUSE_LIMIT = 4;
const TEMPORAL_SIGNATURE_THRESHOLD = 6;

export function createWatermarkTemporalStates(count: number): WatermarkTemporalState[] {
  return Array.from({ length: count }, () => ({
    patch: null,
    signature: null,
    width: 0,
    height: 0,
    reuseCount: 0,
  }));
}

export function mergeWatermarkAreas(areas: WatermarkArea[]): WatermarkArea[] {
  const normalizedAreas = areas
    .map((area) => ({
      x: Math.round(area.x),
      y: Math.round(area.y),
      w: Math.max(1, Math.round(area.w)),
      h: Math.max(1, Math.round(area.h)),
    }))
    .filter((area) => area.w > 0 && area.h > 0)
    .sort((a, b) => a.y - b.y || a.x - b.x);

  if (normalizedAreas.length <= 1) return normalizedAreas;

  const merged = normalizedAreas.slice();
  let didMerge = true;

  while (didMerge) {
    didMerge = false;

    for (let i = 0; i < merged.length; i++) {
      for (let j = i + 1; j < merged.length; j++) {
        if (!areasShouldMerge(merged[i], merged[j])) continue;

        merged[i] = unionAreas(merged[i], merged[j]);
        merged.splice(j, 1);
        didMerge = true;
        break;
      }

      if (didMerge) break;
    }
  }

  return merged;
}

export function applyWatermarkRemovalToCanvas(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  areas: WatermarkArea[],
  temporalStates?: WatermarkTemporalState[],
  strongMode?: boolean,
) {
  const hasTemporalState = Boolean(temporalStates?.length);
  const passes = strongMode
    ? DEFAULT_INPAINT_PASSES + 1
    : hasTemporalState
    ? (temporalStates?.some((state) => state.patch) ? 1 : TEMPORAL_BOOTSTRAP_PASSES)
    : DEFAULT_INPAINT_PASSES;

  for (let pass = 0; pass < passes; pass++) {
    areas.forEach((area, index) => {
      inpaintArea(
        ctx,
        canvas,
        area,
        pass === passes - 1 ? temporalStates?.[index] : undefined,
      );
    });
  }
}

function inpaintArea(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  area: WatermarkArea,
  temporalState?: WatermarkTemporalState
) {
  const coreArea = normalizeArea(area, canvas.width, canvas.height);
  if (!coreArea) return;

  const expandedArea = expandArea(coreArea, canvas.width, canvas.height);
  const { x, y, w, h } = expandedArea;
  const margin = Math.max(24, Math.round(Math.min(w, h) * 0.7));
  const safeX = Math.max(0, x - margin);
  const safeY = Math.max(0, y - margin);
  const safeW = Math.min(canvas.width - safeX, w + margin * 2);
  const safeH = Math.min(canvas.height - safeY, h + margin * 2);
  const offX = x - safeX;
  const offY = y - safeY;

  const imgData = ctx.getImageData(safeX, safeY, safeW, safeH);
  const data = imgData.data;
  const signature = computeEdgeSignature(data, safeW, safeH, offX, offY, w, h);

  if (temporalState) {
    const reusedPatch = tryReuseTemporalPatch(data, safeW, safeH, offX, offY, w, h, temporalState, signature);
    if (reusedPatch) {
      blendPatchIntoFrame(data, reusedPatch, safeW, offX, offY, w, h);
      ctx.putImageData(imgData, safeX, safeY);
      return;
    }
  }

  const smooth = createBoxBlur(data, safeW, safeH);
  const base = buildDirectionalBase(data, safeW, safeH, offX, offY, w, h);
  const relaxedBase = relaxBase(base, w, h, temporalState ? 1 : 2);
  const patch = injectTransferredTexture(data, smooth, relaxedBase, safeW, safeH, offX, offY, w, h, margin, Boolean(temporalState));

  suppressResidualArtifacts(patch, relaxedBase, w, h);

  if (temporalState) {
    applyTemporalStability(patch, w, h, temporalState, signature);
  }

  blendPatchIntoFrame(data, patch, safeW, offX, offY, w, h);
  ctx.putImageData(imgData, safeX, safeY);
}

function normalizeArea(area: WatermarkArea, maxWidth: number, maxHeight: number) {
  const x = clamp(Math.round(area.x), 0, maxWidth - 1);
  const y = clamp(Math.round(area.y), 0, maxHeight - 1);
  const w = clamp(Math.round(area.w), 1, maxWidth - x);
  const h = clamp(Math.round(area.h), 1, maxHeight - y);

  if (w <= 0 || h <= 0) return null;

  return { x, y, w, h };
}

function expandArea(area: WatermarkArea, maxWidth: number, maxHeight: number) {
  const bleed = clamp(Math.round(Math.min(area.w, area.h) * 0.38), 8, 56);
  const left = clamp(area.x - bleed, 0, maxWidth - 1);
  const top = clamp(area.y - bleed, 0, maxHeight - 1);
  const right = clamp(area.x + area.w + bleed, 1, maxWidth);
  const bottom = clamp(area.y + area.h + bleed, 1, maxHeight);

  return {
    x: left,
    y: top,
    w: Math.max(1, right - left),
    h: Math.max(1, bottom - top),
  };
}

function buildDirectionalBase(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  offX: number,
  offY: number,
  w: number,
  h: number
) {
  const base = new Float32Array(w * h * 4);
  const leftX = Math.max(0, offX - 1);
  const rightX = Math.min(width - 1, offX + w);
  const topY = Math.max(0, offY - 1);
  const bottomY = Math.min(height - 1, offY + h);
  const hasLeft = offX > 0;
  const hasRight = offX + w < width;
  const hasTop = offY > 0;
  const hasBottom = offY + h < height;

  for (let py = 0; py < h; py++) {
    const tY = h > 1 ? py / (h - 1) : 0.5;

    for (let px = 0; px < w; px++) {
      const tX = w > 1 ? px / (w - 1) : 0.5;
      const ix = offX + px;
      const iy = offY + py;
      const fi = (py * w + px) * 4;
      const targetIdx = indexOf(width, ix, iy);
      const leftIdx = indexOf(width, leftX, iy);
      const rightIdx = indexOf(width, rightX, iy);
      const topIdx = indexOf(width, ix, topY);
      const bottomIdx = indexOf(width, ix, bottomY);
      const topLeftIdx = indexOf(width, leftX, topY);
      const topRightIdx = indexOf(width, rightX, topY);
      const bottomLeftIdx = indexOf(width, leftX, bottomY);
      const bottomRightIdx = indexOf(width, rightX, bottomY);

      const wL = hasLeft ? Math.pow(1 - tX, 2.1) : 0;
      const wR = hasRight ? Math.pow(tX, 2.1) : 0;
      const wT = hasTop ? Math.pow(1 - tY, 2.1) : 0;
      const wB = hasBottom ? Math.pow(tY, 2.1) : 0;
      const wTL = hasLeft && hasTop ? wL * wT * 0.42 : 0;
      const wTR = hasRight && hasTop ? wR * wT * 0.42 : 0;
      const wBL = hasLeft && hasBottom ? wL * wB * 0.42 : 0;
      const wBR = hasRight && hasBottom ? wR * wB * 0.42 : 0;
      const totalWeight = wL + wR + wT + wB + wTL + wTR + wBL + wBR;

      for (let c = 0; c < 3; c++) {
        if (!totalWeight) {
          base[fi + c] = data[targetIdx + c];
          continue;
        }

        base[fi + c] = (
          data[leftIdx + c] * wL +
          data[rightIdx + c] * wR +
          data[topIdx + c] * wT +
          data[bottomIdx + c] * wB +
          data[topLeftIdx + c] * wTL +
          data[topRightIdx + c] * wTR +
          data[bottomLeftIdx + c] * wBL +
          data[bottomRightIdx + c] * wBR
        ) / totalWeight;
      }

      base[fi + 3] = 255;
    }
  }

  return base;
}

function relaxBase(base: Float32Array, width: number, height: number, iterations: number = 2) {
  let current = base.slice();
  let next = new Float32Array(base.length);

  const effectiveIterations = Math.max(1, iterations);
  for (let iteration = 0; iteration < effectiveIterations; iteration++) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = indexOf(width, x, y);
        const distToEdge = Math.min(x, width - 1 - x, y, height - 1 - y);
        const centerWeight = distToEdge <= 1 ? 0.82 : 0.62;

        for (let c = 0; c < 3; c++) {
          let sum = 0;
          let count = 0;

          if (x > 0) {
            sum += current[indexOf(width, x - 1, y) + c];
            count++;
          }
          if (x + 1 < width) {
            sum += current[indexOf(width, x + 1, y) + c];
            count++;
          }
          if (y > 0) {
            sum += current[indexOf(width, x, y - 1) + c];
            count++;
          }
          if (y + 1 < height) {
            sum += current[indexOf(width, x, y + 1) + c];
            count++;
          }

          const neighborAverage = count ? sum / count : current[idx + c];
          next[idx + c] = current[idx + c] * centerWeight + neighborAverage * (1 - centerWeight);
        }

        next[idx + 3] = 255;
      }
    }

    [current, next] = [next, current];
  }

  return current;
}

function suppressResidualArtifacts(
  patch: Float32Array,
  base: Float32Array,
  width: number,
  height: number
) {
  const polished = relaxBase(patch, width, height, 1);
  const edgeRange = Math.max(2, Math.round(Math.min(width, height) * 0.22));

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = indexOf(width, x, y);
      const distToEdge = Math.min(x, width - 1 - x, y, height - 1 - y);
      const edgeWeight = 1 - smootherstep(0, edgeRange, distToEdge);
      const polishWeight = 0.04 + edgeWeight * 0.12;
      const baseWeight = 0.02 + edgeWeight * 0.06;
      const keepWeight = 1 - polishWeight - baseWeight;

      for (let c = 0; c < 3; c++) {
        patch[idx + c] =
          patch[idx + c] * keepWeight +
          polished[idx + c] * polishWeight +
          base[idx + c] * baseWeight;
      }

      patch[idx + 3] = 255;
    }
  }
}

function injectTransferredTexture(
  data: Uint8ClampedArray,
  smooth: Float32Array,
  base: Float32Array,
  width: number,
  height: number,
  offX: number,
  offY: number,
  w: number,
  h: number,
  margin: number,
  fastMode: boolean = false
) {
  const patch = new Float32Array(base.length);
  const maxSpanLimit = fastMode ? 12 : 20;
  const maxSpanX = Math.max(1, Math.min(margin, maxSpanLimit));
  const maxSpanY = Math.max(1, Math.min(margin, maxSpanLimit));
  const hasLeft = offX > 0;
  const hasRight = offX + w < width;
  const hasTop = offY > 0;
  const hasBottom = offY + h < height;
  const detailGain = estimateTextureGain(data, smooth, width, height, offX, offY, w, h);
  const horizontalSteps = createCandidateSteps(maxSpanX, fastMode ? 2 : 4);
  const verticalSteps = createCandidateSteps(maxSpanY, fastMode ? 2 : 4);
  const horizontalJitter = createPerpendicularOffsets(Math.min(fastMode ? 0 : 2, Math.max(1, Math.round(h * 0.04))));
  const verticalJitter = createPerpendicularOffsets(Math.min(fastMode ? 0 : 2, Math.max(1, Math.round(w * 0.04))));

  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const fi = (py * w + px) * 4;

      const candidates = collectTextureCandidates(
        width,
        height,
        offX,
        offY,
        w,
        h,
        px,
        py,
        hasLeft,
        hasRight,
        hasTop,
        hasBottom,
        horizontalSteps,
        verticalSteps,
        horizontalJitter,
        verticalJitter
      );

      let bestCandidate: TextureCandidate | null = null;
      let bestScore = Number.POSITIVE_INFINITY;
      let bestDetailEnergy = -1;

      for (const candidate of candidates) {
        const candidateScore = scoreTextureCandidate(
          smooth,
          base,
          width,
          height,
          w,
          h,
          px,
          py,
          candidate,
          fastMode
        );

        if (candidateScore < bestScore - 6) {
          bestCandidate = candidate;
          bestScore = candidateScore;
          bestDetailEnergy = fastMode ? -1 : measureLocalDetailEnergy(data, smooth, width, candidate.x, candidate.y);
          continue;
        }

        if (Math.abs(candidateScore - bestScore) <= 6) {
          if (fastMode) {
            continue;
          }

          const candidateDetailEnergy = measureLocalDetailEnergy(data, smooth, width, candidate.x, candidate.y);
          if (!bestCandidate || candidateDetailEnergy > bestDetailEnergy) {
            bestCandidate = candidate;
            bestScore = candidateScore;
            bestDetailEnergy = candidateDetailEnergy;
          }
        }
      }

      if (!bestCandidate) {
        for (let c = 0; c < 3; c++) {
          patch[fi + c] = base[fi + c];
        }
        patch[fi + 3] = 255;
        continue;
      }

      const sourceIdx = indexOf(width, bestCandidate.x, bestCandidate.y);

      for (let c = 0; c < 3; c++) {
        const detail = data[sourceIdx + c] - smooth[sourceIdx + c];
        patch[fi + c] = clamp(base[fi + c] + detail * detailGain, 0, 255);
      }

      patch[fi + 3] = 255;
    }
  }

  return patch;
}

function collectTextureCandidates(
  width: number,
  height: number,
  offX: number,
  offY: number,
  w: number,
  h: number,
  px: number,
  py: number,
  hasLeft: boolean,
  hasRight: boolean,
  hasTop: boolean,
  hasBottom: boolean,
  horizontalSteps: number[],
  verticalSteps: number[],
  horizontalJitter: number[],
  verticalJitter: number[]
) {
  const candidates: TextureCandidate[] = [];

  if (hasLeft) {
    for (const step of horizontalSteps) {
      for (const jitter of horizontalJitter) {
        candidates.push({
          x: clamp(offX - step, 0, width - 1),
          y: clamp(offY + py + jitter, 0, height - 1),
          distance: step,
        });
      }
    }
  }

  if (hasRight) {
    for (const step of horizontalSteps) {
      for (const jitter of horizontalJitter) {
        candidates.push({
          x: clamp(offX + w - 1 + step, 0, width - 1),
          y: clamp(offY + py + jitter, 0, height - 1),
          distance: step,
        });
      }
    }
  }

  if (hasTop) {
    for (const step of verticalSteps) {
      for (const jitter of verticalJitter) {
        candidates.push({
          x: clamp(offX + px + jitter, 0, width - 1),
          y: clamp(offY - step, 0, height - 1),
          distance: step,
        });
      }
    }
  }

  if (hasBottom) {
    for (const step of verticalSteps) {
      for (const jitter of verticalJitter) {
        candidates.push({
          x: clamp(offX + px + jitter, 0, width - 1),
          y: clamp(offY + h - 1 + step, 0, height - 1),
          distance: step,
        });
      }
    }
  }

  if (hasLeft && hasTop) {
    for (const stepX of horizontalSteps) {
      for (const stepY of verticalSteps) {
        candidates.push({
          x: clamp(offX - stepX, 0, width - 1),
          y: clamp(offY - stepY, 0, height - 1),
          distance: stepX + stepY,
        });
      }
    }
  }

  if (hasRight && hasTop) {
    for (const stepX of horizontalSteps) {
      for (const stepY of verticalSteps) {
        candidates.push({
          x: clamp(offX + w - 1 + stepX, 0, width - 1),
          y: clamp(offY - stepY, 0, height - 1),
          distance: stepX + stepY,
        });
      }
    }
  }

  if (hasLeft && hasBottom) {
    for (const stepX of horizontalSteps) {
      for (const stepY of verticalSteps) {
        candidates.push({
          x: clamp(offX - stepX, 0, width - 1),
          y: clamp(offY + h - 1 + stepY, 0, height - 1),
          distance: stepX + stepY,
        });
      }
    }
  }

  if (hasRight && hasBottom) {
    for (const stepX of horizontalSteps) {
      for (const stepY of verticalSteps) {
        candidates.push({
          x: clamp(offX + w - 1 + stepX, 0, width - 1),
          y: clamp(offY + h - 1 + stepY, 0, height - 1),
          distance: stepX + stepY,
        });
      }
    }
  }

  return candidates;
}

function createCandidateSteps(maxSpan: number, samples: number = 4) {
  const ratios = samples <= 3 ? [0, 0.55, 1] : [0, 0.35, 0.7, 1];
  const steps = ratios
    .map((ratio, index) => (index === 0 ? 1 : Math.round(maxSpan * ratio)))
    .map((step) => clamp(step, 1, maxSpan));

  return [...new Set(steps)];
}

function createPerpendicularOffsets(span: number) {
  if (span <= 0) return [0];
  return span === 1 ? [0, -1, 1] : [0, -1, 1, -span, span];
}

function scoreTextureCandidate(
  smooth: Float32Array,
  base: Float32Array,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
  targetX: number,
  targetY: number,
  candidate: TextureCandidate,
  fastMode: boolean = false
) {
  const neighborhood = fastMode ? FAST_TEXTURE_NEIGHBORHOOD : FULL_TEXTURE_NEIGHBORHOOD;

  let score = 0;
  let totalWeight = 0;

  for (const sample of neighborhood) {
    const targetSampleX = targetX + sample.dx;
    const targetSampleY = targetY + sample.dy;
    if (targetSampleX < 0 || targetSampleX >= targetWidth || targetSampleY < 0 || targetSampleY >= targetHeight) {
      continue;
    }

    const sourceSampleX = clamp(candidate.x + sample.dx, 0, sourceWidth - 1);
    const sourceSampleY = clamp(candidate.y + sample.dy, 0, sourceHeight - 1);
    const targetIdx = indexOf(targetWidth, targetSampleX, targetSampleY);
    const sourceIdx = indexOf(sourceWidth, sourceSampleX, sourceSampleY);

    for (let c = 0; c < 3; c++) {
      score += Math.abs(base[targetIdx + c] - smooth[sourceIdx + c]) * sample.weight;
    }

    totalWeight += sample.weight * 3;
  }

  if (!totalWeight) return Number.POSITIVE_INFINITY;
  return score / totalWeight + candidate.distance * 0.18;
}

function measureLocalDetailEnergy(
  data: Uint8ClampedArray,
  smooth: Float32Array,
  width: number,
  x: number,
  y: number
) {
  const idx = indexOf(width, x, y);
  return (
    Math.abs(data[idx] - smooth[idx]) +
    Math.abs(data[idx + 1] - smooth[idx + 1]) +
    Math.abs(data[idx + 2] - smooth[idx + 2])
  ) / 3;
}

function estimateTextureGain(
  data: Uint8ClampedArray,
  smooth: Float32Array,
  width: number,
  height: number,
  offX: number,
  offY: number,
  w: number,
  h: number
) {
  let sum = 0;
  let count = 0;

  const addEnergy = (x: number, y: number) => {
    const idx = indexOf(width, x, y);
    sum += Math.abs(data[idx] - smooth[idx]);
    sum += Math.abs(data[idx + 1] - smooth[idx + 1]);
    sum += Math.abs(data[idx + 2] - smooth[idx + 2]);
    count += 3;
  };

  if (offY > 0) {
    for (let x = offX; x < offX + w; x++) addEnergy(x, offY - 1);
  }
  if (offY + h < height) {
    for (let x = offX; x < offX + w; x++) addEnergy(x, offY + h);
  }
  if (offX > 0) {
    for (let y = offY; y < offY + h; y++) addEnergy(offX - 1, y);
  }
  if (offX + w < width) {
    for (let y = offY; y < offY + h; y++) addEnergy(offX + w, y);
  }

  const averageEnergy = count ? sum / count : 0;
  return clamp(0.74 + averageEnergy / 30, 0.74, 1.08);
}

function computeEdgeSignature(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  offX: number,
  offY: number,
  w: number,
  h: number
): [number, number, number] {
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let count = 0;

  const addSample = (x: number, y: number) => {
    const idx = indexOf(width, x, y);
    sumR += data[idx];
    sumG += data[idx + 1];
    sumB += data[idx + 2];
    count++;
  };

  if (offY > 0) {
    for (let x = offX; x < offX + w; x++) addSample(x, offY - 1);
  }
  if (offY + h < height) {
    for (let x = offX; x < offX + w; x++) addSample(x, offY + h);
  }
  if (offX > 0) {
    for (let y = offY; y < offY + h; y++) addSample(offX - 1, y);
  }
  if (offX + w < width) {
    for (let y = offY; y < offY + h; y++) addSample(offX + w, y);
  }

  if (!count) return [0, 0, 0];
  return [sumR / count, sumG / count, sumB / count];
}

function tryReuseTemporalPatch(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  offX: number,
  offY: number,
  w: number,
  h: number,
  state: WatermarkTemporalState,
  signature: [number, number, number]
) {
  if (!state.patch || state.width !== w || state.height !== h) {
    state.reuseCount = 0;
    return null;
  }

  const signatureDelta = getSignatureDelta(signature, state.signature ?? [0, 0, 0]);
  if (signatureDelta >= TEMPORAL_SIGNATURE_THRESHOLD || state.reuseCount >= TEMPORAL_REUSE_LIMIT) {
    state.reuseCount = 0;
    return null;
  }

  const base = relaxBase(buildDirectionalBase(data, width, height, offX, offY, w, h), w, h, 1);
  const patch = new Float32Array(state.patch.length);
  const centerRange = Math.max(2, Math.round(Math.min(w, h) * 0.26));
  const carry = clamp(0.32 - signatureDelta * 0.04, 0.12, 0.32);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = indexOf(w, x, y);
      const distToEdge = Math.min(x, w - 1 - x, y, h - 1 - y);
      const alpha = carry * smootherstep(0, centerRange, distToEdge);

      for (let c = 0; c < 3; c++) {
        patch[idx + c] = clamp(base[idx + c] * (1 - alpha) + state.patch[idx + c] * alpha, 0, 255);
      }

      patch[idx + 3] = 255;
    }
  }

  storeTemporalPatch(state, patch, signature, w, h, state.reuseCount + 1);
  return patch;
}

function getSignatureDelta(a: [number, number, number], b: [number, number, number]) {
  return (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])) / 3;
}

function storeTemporalPatch(
  state: WatermarkTemporalState,
  patch: Float32Array,
  signature: [number, number, number],
  width: number,
  height: number,
  reuseCount: number
) {
  if (!state.patch || state.patch.length !== patch.length) {
    state.patch = patch.slice();
  } else {
    state.patch.set(patch);
  }

  state.signature = signature;
  state.width = width;
  state.height = height;
  state.reuseCount = reuseCount;
}

function applyTemporalStability(
  patch: Float32Array,
  width: number,
  height: number,
  state: WatermarkTemporalState,
  signature: [number, number, number]
) {
  if (!state.patch || state.width !== width || state.height !== height) {
    storeTemporalPatch(state, patch, signature, width, height, 0);
    return;
  }

  const previousPatch = state.patch;
  const previousSignature = state.signature ?? [0, 0, 0];
  const signatureDelta = getSignatureDelta(signature, previousSignature);

  // Lightweight temporal blending: skip expensive relaxBase calls,
  // blend directly at low alpha for stability
  const stability = clamp(0.12 * (1 - signatureDelta / 50), 0, 0.18);

  if (stability > 0.005) {
    const centerRange = Math.max(2, Math.round(Math.min(width, height) * 0.28));
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = indexOf(width, x, y);
        const distToEdge = Math.min(x, width - 1 - x, y, height - 1 - y);
        const centerWeight = smootherstep(0, centerRange, distToEdge);
        const alpha = stability * centerWeight;

        for (let c = 0; c < 3; c++) {
          patch[idx + c] = clamp(
            patch[idx + c] * (1 - alpha) + previousPatch[idx + c] * alpha,
            0, 255
          );
        }
        patch[idx + 3] = 255;
      }
    }
  }

  storeTemporalPatch(state, patch, signature, width, height, 0);
}

function measurePatchDelta(a: Float32Array, b: Float32Array, width: number, height: number) {
  const step = Math.max(1, Math.round(Math.min(width, height) / 8));
  let sum = 0;
  let count = 0;

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const idx = indexOf(width, x, y);
      sum += Math.abs(a[idx] - b[idx]);
      sum += Math.abs(a[idx + 1] - b[idx + 1]);
      sum += Math.abs(a[idx + 2] - b[idx + 2]);
      count += 3;
    }
  }

  return count ? sum / count : 0;
}

function blendPatchIntoFrame(
  data: Uint8ClampedArray,
  patch: Float32Array,
  width: number,
  offX: number,
  offY: number,
  w: number,
  h: number
) {
  // Use a narrow feather (just 2-3 pixels) so the patch fully replaces
  // the watermarked area. Previous feathering was too wide, leaving
  // semi-transparent watermark pixels visible near edges.
  const feather = Math.max(2, Math.round(Math.min(w, h) * 0.08));

  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const distToEdge = Math.min(px, w - 1 - px, py, h - 1 - py);
      // Minimum alpha raised to 0.65 so even at the very edge we replace
      // most of the original pixel, eliminating watermark ghosts.
      const alpha = 0.65 + 0.35 * smootherstep(0, feather, distToEdge + 0.5);
      const frameIdx = indexOf(width, offX + px, offY + py);
      const patchIdx = indexOf(w, px, py);

      for (let c = 0; c < 3; c++) {
        data[frameIdx + c] = Math.round(patch[patchIdx + c] * alpha + data[frameIdx + c] * (1 - alpha));
      }
    }
  }
}

function areasShouldMerge(a: WatermarkArea, b: WatermarkArea) {
  const gap = Math.max(6, Math.round(Math.min(a.w, a.h, b.w, b.h) * 0.18));
  const aRight = a.x + a.w;
  const aBottom = a.y + a.h;
  const bRight = b.x + b.w;
  const bBottom = b.y + b.h;

  return a.x - gap <= bRight && aRight + gap >= b.x && a.y - gap <= bBottom && aBottom + gap >= b.y;
}

function unionAreas(a: WatermarkArea, b: WatermarkArea): WatermarkArea {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const right = Math.max(a.x + a.w, b.x + b.w);
  const bottom = Math.max(a.y + a.h, b.y + b.h);

  return {
    x,
    y,
    w: right - x,
    h: bottom - y,
  };
}

function createBoxBlur(data: Uint8ClampedArray, width: number, height: number) {
  const blurred = new Float32Array(data.length);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sumR = 0;
      let sumG = 0;
      let sumB = 0;
      let count = 0;

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const sx = clamp(x + dx, 0, width - 1);
          const sy = clamp(y + dy, 0, height - 1);
          const idx = indexOf(width, sx, sy);
          sumR += data[idx];
          sumG += data[idx + 1];
          sumB += data[idx + 2];
          count++;
        }
      }

      const outIdx = indexOf(width, x, y);
      blurred[outIdx] = sumR / count;
      blurred[outIdx + 1] = sumG / count;
      blurred[outIdx + 2] = sumB / count;
      blurred[outIdx + 3] = data[outIdx + 3];
    }
  }

  return blurred;
}

function indexOf(width: number, x: number, y: number) {
  return (y * width + x) * 4;
}

function smootherstep(min: number, max: number, value: number) {
  if (max <= min) return value >= max ? 1 : 0;

  const t = clamp((value - min) / (max - min), 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}