import { useState, useCallback } from 'react';
import { playSound } from '@/lib/sounds';

export interface TikTokAccount {
  id: string;
  username: string;
  displayName: string;
  niche: string;
  followers: number;
  avatar?: string;
  connected: boolean;
  isPrimary: boolean;
  category: 'crescimento' | 'monetizacao' | 'vendas' | 'geral';
}

export interface VideoEntry {
  id: string;
  title: string;
  niche: string;
  status: 'idea' | 'recording' | 'editing' | 'posted';
  category: 'crescimento' | 'monetizacao' | 'vendas';
  scheduledDate?: string;
  accountId?: string;
  thumbnail?: string;
}

export type InspirationCategory = 'crescimento' | 'monetizacao' | 'vendas';
export type InspirationRefType = 'hook' | 'roteiro' | 'cta' | 'oferta' | 'storytelling' | 'tendencia' | 'edicao' | 'thumbnail';
export type InspirationFormat = 'link' | 'image' | 'idea' | 'observation';

export interface ReferenceItem {
  id: string;
  type: InspirationFormat;
  url: string;
  title: string;
  niche: string;
  category?: InspirationCategory;
  refType?: InspirationRefType;
  description?: string;
  createdAt?: string;
  favorite?: boolean;
}

export interface ContentEntry {
  id: string;
  title: string;
  category: 'crescimento' | 'monetizacao' | 'vendas';
  objective: string;
  videoLink: string;
  imageUrl: string;
  description: string;
  hashtags: string;
  cta: string;
  observations: string;
  status: 'idea' | 'producing' | 'ready' | 'posted';
  priority: 'low' | 'medium' | 'high';
  accountId: string;
  favorite: boolean;
  createdAt: string;
}

export interface ScheduleEntry {
  id: string;
  videoId?: string;
  accountId?: string;
  date: string;
  time: string;
  title: string;
  description?: string;
  hashtags?: string;
  category?: 'crescimento' | 'monetizacao' | 'vendas';
  objective?: string;
  status: 'idea' | 'producing' | 'ready' | 'scheduled' | 'posted';
  postedAt?: string;
}


export interface PerformanceEntry {
  id: string;
  contentId?: string;
  title: string;
  accountId: string;
  category: 'crescimento' | 'monetizacao' | 'vendas';
  date: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  objective?: string;
  result?: string;
}

export interface MasterProfile {
  id: string;
  name: string;
  avatar?: string;
  selectedTitle?: string; // Custom title from unlocked rank tiers
  createdAt: string;
  xp: number;
  level: number;
  streak: number;
  totalVideos: number;
  interactions: number;
  accounts: TikTokAccount[];
  videos: VideoEntry[];
  references: ReferenceItem[];
  schedule: ScheduleEntry[];
  contents: ContentEntry[];
  performance: PerformanceEntry[];
}

// ── Rank tiers (rarity system) ──
export interface RankTier {
  name: string;
  minLevel: number;
  maxLevel: number;
  color: string;       // tailwind text color token
  bgColor: string;     // tailwind bg token
  rarity: string;
}

export const RANK_TIERS: RankTier[] = [
  // ── Comum ──
  { name: 'Iniciante',              minLevel: 1,   maxLevel: 5,    color: 'text-zinc-400',    bgColor: 'bg-zinc-500/20',    rarity: 'Comum' },
  { name: 'Amador',                 minLevel: 6,   maxLevel: 12,   color: 'text-zinc-400',    bgColor: 'bg-zinc-500/20',    rarity: 'Comum' },
  { name: 'Aprendiz',               minLevel: 13,  maxLevel: 20,   color: 'text-stone-400',   bgColor: 'bg-stone-500/20',   rarity: 'Comum' },
  { name: 'Observador',             minLevel: 21,  maxLevel: 30,   color: 'text-stone-400',   bgColor: 'bg-stone-500/20',   rarity: 'Comum' },
  // ── Incomum ──
  { name: 'Explorador',             minLevel: 31,  maxLevel: 45,   color: 'text-green-400',   bgColor: 'bg-green-500/20',   rarity: 'Incomum' },
  { name: 'Operador',               minLevel: 46,  maxLevel: 60,   color: 'text-green-400',   bgColor: 'bg-green-500/20',   rarity: 'Incomum' },
  { name: 'Soldado',                minLevel: 61,  maxLevel: 80,   color: 'text-teal-400',    bgColor: 'bg-teal-500/20',    rarity: 'Incomum' },
  { name: 'Estrategista',           minLevel: 81,  maxLevel: 100,  color: 'text-teal-400',    bgColor: 'bg-teal-500/20',    rarity: 'Incomum' },
  // ── Raro ──
  { name: 'Guerreiro',              minLevel: 101, maxLevel: 130,  color: 'text-blue-400',    bgColor: 'bg-blue-500/20',    rarity: 'Raro' },
  { name: 'Creator Tático',         minLevel: 131, maxLevel: 160,  color: 'text-blue-400',    bgColor: 'bg-blue-500/20',    rarity: 'Raro' },
  { name: 'Caçador de Almas',       minLevel: 161, maxLevel: 200,  color: 'text-indigo-400',  bgColor: 'bg-indigo-500/20',  rarity: 'Raro' },
  // ── Épico ──
  { name: 'Conquistador',           minLevel: 201, maxLevel: 250,  color: 'text-violet-400',  bgColor: 'bg-violet-500/20',  rarity: 'Épico' },
  { name: 'Creator Dominante',      minLevel: 251, maxLevel: 300,  color: 'text-violet-400',  bgColor: 'bg-violet-500/20',  rarity: 'Épico' },
  { name: 'Glutão da Criação',      minLevel: 301, maxLevel: 350,  color: 'text-purple-400',  bgColor: 'bg-purple-500/20',  rarity: 'Épico' },
  { name: 'Mestre da Conversão',    minLevel: 351, maxLevel: 400,  color: 'text-purple-400',  bgColor: 'bg-purple-500/20',  rarity: 'Épico' },
  // ── Lendário ──
  { name: 'Rei do Conteúdo',        minLevel: 401, maxLevel: 450,  color: 'text-orange-400',  bgColor: 'bg-orange-500/20',  rarity: 'Lendário' },
  { name: 'Senhor do Caos',         minLevel: 451, maxLevel: 500,  color: 'text-orange-400',  bgColor: 'bg-orange-500/20',  rarity: 'Lendário' },
  { name: 'Soberano da Ira',        minLevel: 501, maxLevel: 550,  color: 'text-rose-400',    bgColor: 'bg-rose-500/20',    rarity: 'Lendário' },
  { name: 'Imperador Viking',       minLevel: 551, maxLevel: 600,  color: 'text-rose-400',    bgColor: 'bg-rose-500/20',    rarity: 'Lendário' },
  // ── Mítico ──
  { name: 'Berserker Imortal',      minLevel: 601, maxLevel: 660,  color: 'text-amber-400',   bgColor: 'bg-amber-500/20',   rarity: 'Mítico' },
  { name: 'Arauto de Odin',         minLevel: 661, maxLevel: 720,  color: 'text-amber-400',   bgColor: 'bg-amber-500/20',   rarity: 'Mítico' },
  { name: 'Filho de Fenrir',        minLevel: 721, maxLevel: 780,  color: 'text-yellow-400',  bgColor: 'bg-yellow-400/20',  rarity: 'Mítico' },
  { name: 'Portador do Ragnarök',   minLevel: 781, maxLevel: 840,  color: 'text-yellow-300',  bgColor: 'bg-yellow-400/20',  rarity: 'Mítico' },
  // ── Imortal ──
  { name: 'Deus da Criação',        minLevel: 841, maxLevel: 900,  color: 'text-red-400',     bgColor: 'bg-red-500/20',     rarity: 'Imortal' },
  { name: 'Lenda Nórdica',          minLevel: 901, maxLevel: 950,  color: 'text-red-400',     bgColor: 'bg-red-500/20',     rarity: 'Imortal' },
  { name: 'Entidade Suprema',       minLevel: 951, maxLevel: 1000, color: 'text-red-300',     bgColor: 'bg-red-400/20',     rarity: 'Imortal' },
];

const RARITY_COLORS: Record<string, string> = {
  'Comum':     'text-zinc-400',
  'Incomum':   'text-teal-400',
  'Raro':      'text-indigo-400',
  'Épico':     'text-purple-400',
  'Lendário':  'text-orange-400',
  'Mítico':    'text-yellow-300',
  'Imortal':   'text-red-400',
};

export function getRarityColor(rarity: string) {
  return RARITY_COLORS[rarity] || 'text-muted-foreground';
}

// ── Visual identity per 25-level band ──
export interface LevelBand {
  minLevel: number;
  maxLevel: number;
  textColor: string;
  bgColor: string;
  borderColor: string;
  gradient: string; // CSS gradient for badge/bar
  label: string;
}

export const LEVEL_BANDS: LevelBand[] = [
  // 1–100: Cold, muted, subdued
  { minLevel: 1,   maxLevel: 25,   textColor: 'text-zinc-500',    bgColor: 'bg-zinc-600/20',    borderColor: 'border-zinc-600/30',    gradient: 'linear-gradient(135deg, #52525b, #71717a)', label: 'Cinza Opaco' },
  { minLevel: 26,  maxLevel: 50,   textColor: 'text-slate-400',   bgColor: 'bg-slate-500/20',   borderColor: 'border-slate-500/30',   gradient: 'linear-gradient(135deg, #64748b, #94a3b8)', label: 'Azul Gelo' },
  { minLevel: 51,  maxLevel: 75,   textColor: 'text-blue-400',    bgColor: 'bg-blue-500/15',    borderColor: 'border-blue-500/30',    gradient: 'linear-gradient(135deg, #3b82f6, #60a5fa)', label: 'Azul Frio' },
  { minLevel: 76,  maxLevel: 100,  textColor: 'text-blue-300',    bgColor: 'bg-blue-400/20',    borderColor: 'border-blue-400/40',    gradient: 'linear-gradient(135deg, #2563eb, #3b82f6)', label: 'Azul Intenso' },
  // 101–200: Getting warmer, starting to glow
  { minLevel: 101, maxLevel: 125,  textColor: 'text-indigo-400',  bgColor: 'bg-indigo-500/20',  borderColor: 'border-indigo-500/40',  gradient: 'linear-gradient(135deg, #6366f1, #818cf8)', label: 'Índigo' },
  { minLevel: 126, maxLevel: 150,  textColor: 'text-violet-400',  bgColor: 'bg-violet-500/20',  borderColor: 'border-violet-500/40',  gradient: 'linear-gradient(135deg, #7c3aed, #8b5cf6)', label: 'Violeta' },
  { minLevel: 151, maxLevel: 175,  textColor: 'text-purple-400',  bgColor: 'bg-purple-500/20',  borderColor: 'border-purple-500/40',  gradient: 'linear-gradient(135deg, #9333ea, #a855f7)', label: 'Roxo' },
  { minLevel: 176, maxLevel: 200,  textColor: 'text-fuchsia-400', bgColor: 'bg-fuchsia-500/20', borderColor: 'border-fuchsia-500/40', gradient: 'linear-gradient(135deg, #c026d3, #d946ef)', label: 'Fúcsia' },
  // 201–325: Red-hot intensity
  { minLevel: 201, maxLevel: 225,  textColor: 'text-pink-400',    bgColor: 'bg-pink-500/20',    borderColor: 'border-pink-500/40',    gradient: 'linear-gradient(135deg, #ec4899, #f472b6)', label: 'Rosa Forte' },
  { minLevel: 226, maxLevel: 250,  textColor: 'text-rose-400',    bgColor: 'bg-rose-500/20',    borderColor: 'border-rose-500/40',    gradient: 'linear-gradient(135deg, #f43f5e, #fb7185)', label: 'Rosê' },
  { minLevel: 251, maxLevel: 275,  textColor: 'text-red-400',     bgColor: 'bg-red-500/15',     borderColor: 'border-red-500/40',     gradient: 'linear-gradient(135deg, #dc2626, #ef4444)', label: 'Vermelho' },
  { minLevel: 276, maxLevel: 300,  textColor: 'text-red-300',     bgColor: 'bg-red-400/20',     borderColor: 'border-red-400/50',     gradient: 'linear-gradient(135deg, #b91c1c, #dc2626)', label: 'Carmesim' },
  { minLevel: 301, maxLevel: 325,  textColor: 'text-red-300',     bgColor: 'bg-red-500/25',     borderColor: 'border-red-500/50',     gradient: 'linear-gradient(135deg, #991b1b, #ef4444)', label: 'Sangue' },
  // 326–500: Fire & Magma
  { minLevel: 326, maxLevel: 350,  textColor: 'text-orange-400',  bgColor: 'bg-orange-500/20',  borderColor: 'border-orange-500/40',  gradient: 'linear-gradient(135deg, #ea580c, #f97316)', label: 'Laranja Vivo' },
  { minLevel: 351, maxLevel: 375,  textColor: 'text-orange-300',  bgColor: 'bg-orange-400/20',  borderColor: 'border-orange-400/50',  gradient: 'linear-gradient(135deg, #c2410c, #fb923c)', label: 'Fogo' },
  { minLevel: 376, maxLevel: 400,  textColor: 'text-amber-400',   bgColor: 'bg-amber-500/20',   borderColor: 'border-amber-500/40',   gradient: 'linear-gradient(135deg, #d97706, #f59e0b)', label: 'Âmbar' },
  { minLevel: 401, maxLevel: 425,  textColor: 'text-amber-300',   bgColor: 'bg-amber-400/20',   borderColor: 'border-amber-400/50',   gradient: 'linear-gradient(135deg, #b45309, #fbbf24)', label: 'Bronze Ardente' },
  { minLevel: 426, maxLevel: 450,  textColor: 'text-yellow-400',  bgColor: 'bg-yellow-500/20',  borderColor: 'border-yellow-500/40',  gradient: 'linear-gradient(135deg, #ca8a04, #facc15)', label: 'Ouro Antigo' },
  { minLevel: 451, maxLevel: 475,  textColor: 'text-yellow-300',  bgColor: 'bg-yellow-400/20',  borderColor: 'border-yellow-400/50',  gradient: 'linear-gradient(135deg, #eab308, #fde047)', label: 'Ouro' },
  { minLevel: 476, maxLevel: 500,  textColor: 'text-yellow-200',  bgColor: 'bg-yellow-300/20',  borderColor: 'border-yellow-300/50',  gradient: 'linear-gradient(135deg, #facc15, #fef08a)', label: 'Ouro Reluzente' },
  // 501–700: Legendary auras
  { minLevel: 501, maxLevel: 525,  textColor: 'text-lime-400',    bgColor: 'bg-lime-500/15',    borderColor: 'border-lime-500/40',    gradient: 'linear-gradient(135deg, #65a30d, #a3e635)', label: 'Veneno' },
  { minLevel: 526, maxLevel: 550,  textColor: 'text-emerald-400', bgColor: 'bg-emerald-500/15', borderColor: 'border-emerald-500/40', gradient: 'linear-gradient(135deg, #059669, #34d399)', label: 'Esmeralda' },
  { minLevel: 551, maxLevel: 575,  textColor: 'text-teal-300',    bgColor: 'bg-teal-400/20',    borderColor: 'border-teal-400/40',    gradient: 'linear-gradient(135deg, #0d9488, #5eead4)', label: 'Glacial' },
  { minLevel: 576, maxLevel: 600,  textColor: 'text-cyan-300',    bgColor: 'bg-cyan-400/20',    borderColor: 'border-cyan-400/40',    gradient: 'linear-gradient(135deg, #06b6d4, #67e8f9)', label: 'Gelo Elétrico' },
  { minLevel: 601, maxLevel: 625,  textColor: 'text-sky-300',     bgColor: 'bg-sky-400/20',     borderColor: 'border-sky-400/40',     gradient: 'linear-gradient(135deg, #0ea5e9, #7dd3fc)', label: 'Trovão Azul' },
  { minLevel: 626, maxLevel: 650,  textColor: 'text-blue-300',    bgColor: 'bg-blue-400/25',    borderColor: 'border-blue-300/50',    gradient: 'linear-gradient(135deg, #2563eb, #93c5fd)', label: 'Raio Celestial' },
  { minLevel: 651, maxLevel: 675,  textColor: 'text-indigo-300',  bgColor: 'bg-indigo-400/25',  borderColor: 'border-indigo-300/50',  gradient: 'linear-gradient(135deg, #4f46e5, #a5b4fc)', label: 'Nebulosa' },
  { minLevel: 676, maxLevel: 700,  textColor: 'text-violet-300',  bgColor: 'bg-violet-400/25',  borderColor: 'border-violet-300/50',  gradient: 'linear-gradient(135deg, #7c3aed, #c4b5fd)', label: 'Arcano' },
  // 701–850: Mythic glow
  { minLevel: 701, maxLevel: 725,  textColor: 'text-purple-300',  bgColor: 'bg-purple-400/25',  borderColor: 'border-purple-300/50',  gradient: 'linear-gradient(135deg, #9333ea, #d8b4fe)', label: 'Vórtex' },
  { minLevel: 726, maxLevel: 750,  textColor: 'text-fuchsia-300', bgColor: 'bg-fuchsia-400/25', borderColor: 'border-fuchsia-300/50', gradient: 'linear-gradient(135deg, #c026d3, #f0abfc)', label: 'Eclipse' },
  { minLevel: 751, maxLevel: 775,  textColor: 'text-pink-300',    bgColor: 'bg-pink-400/25',    borderColor: 'border-pink-300/50',    gradient: 'linear-gradient(135deg, #db2777, #f9a8d4)', label: 'Aurora Boreal' },
  { minLevel: 776, maxLevel: 800,  textColor: 'text-rose-300',    bgColor: 'bg-rose-400/25',    borderColor: 'border-rose-300/50',    gradient: 'linear-gradient(135deg, #e11d48, #fda4af)', label: 'Supernova' },
  { minLevel: 801, maxLevel: 825,  textColor: 'text-orange-300',  bgColor: 'bg-orange-400/25',  borderColor: 'border-orange-300/50',  gradient: 'linear-gradient(135deg, #ea580c, #fdba74)', label: 'Sol Negro' },
  { minLevel: 826, maxLevel: 850,  textColor: 'text-amber-200',   bgColor: 'bg-amber-300/25',   borderColor: 'border-amber-300/50',   gradient: 'linear-gradient(135deg, #d97706, #fde68a)', label: 'Coroa Solar' },
  // 851–1000: Immortal radiance
  { minLevel: 851, maxLevel: 875,  textColor: 'text-yellow-200',  bgColor: 'bg-yellow-200/20',  borderColor: 'border-yellow-200/50',  gradient: 'linear-gradient(135deg, #eab308, #fef9c3)', label: 'Divino' },
  { minLevel: 876, maxLevel: 900,  textColor: 'text-amber-100',   bgColor: 'bg-amber-200/20',   borderColor: 'border-amber-200/50',   gradient: 'linear-gradient(135deg, #f59e0b, #fef3c7)', label: 'Sagrado' },
  { minLevel: 901, maxLevel: 925,  textColor: 'text-yellow-100',  bgColor: 'bg-yellow-100/20',  borderColor: 'border-yellow-100/50',  gradient: 'linear-gradient(135deg, #ca8a04, #fef9c3, #f59e0b)', label: 'Ascendente' },
  { minLevel: 926, maxLevel: 950,  textColor: 'text-red-300',     bgColor: 'bg-red-300/25',     borderColor: 'border-red-300/60',     gradient: 'linear-gradient(135deg, #dc2626, #fca5a5, #f97316)', label: 'Ragnarök' },
  { minLevel: 951, maxLevel: 975,  textColor: 'text-rose-200',    bgColor: 'bg-rose-200/25',    borderColor: 'border-rose-200/60',    gradient: 'linear-gradient(135deg, #e11d48, #fecdd3, #facc15)', label: 'Eterno' },
  { minLevel: 976, maxLevel: 1000, textColor: 'text-yellow-100',  bgColor: 'bg-yellow-100/25',  borderColor: 'border-yellow-100/60',  gradient: 'linear-gradient(135deg, #fbbf24, #fef3c7, #ef4444, #fbbf24)', label: 'Supremo' },
];

export function getLevelBand(level: number): LevelBand {
  for (let i = LEVEL_BANDS.length - 1; i >= 0; i--) {
    if (level >= LEVEL_BANDS[i].minLevel) return LEVEL_BANDS[i];
  }
  return LEVEL_BANDS[0];
}

// XP required to reach a given level (quadratic curve)
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  // Gentle quadratic: level 2 = 10 XP, level 100 ≈ 5000, level 1000 ≈ 500k
  return Math.floor(5 * (level - 1) * (level - 1) * 0.1 + 5 * (level - 1));
}

export function getRankTier(level: number): RankTier {
  for (let i = RANK_TIERS.length - 1; i >= 0; i--) {
    if (level >= RANK_TIERS[i].minLevel) return RANK_TIERS[i];
  }
  return RANK_TIERS[0];
}

// Keep LEVELS export for backward compat (used in GamificationView roadmap)
export const LEVELS = RANK_TIERS;

export interface LevelInfo {
  level: number;
  name: string;
  rarity: string;
  color: string;
  bgColor: string;
  progress: number;
  xpInLevel: number;
  xpNeeded: number;
  isMax: boolean;
  nextName?: string;
  totalXPForCurrent: number;
  totalXPForNext: number;
}

export function getLevelInfo(xp: number): LevelInfo {
  // Binary-search for level from XP
  let lo = 1, hi = 1000;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi + 1) / 2);
    if (xpForLevel(mid) <= xp) lo = mid; else hi = mid - 1;
  }
  const level = Math.min(lo, 1000);
  const isMax = level >= 1000;
  const currentXP = xpForLevel(level);
  const nextXP = isMax ? currentXP : xpForLevel(level + 1);
  const xpInLevel = xp - currentXP;
  const xpNeeded = isMax ? 1 : nextXP - currentXP;
  const progress = isMax ? 100 : Math.min((xpInLevel / xpNeeded) * 100, 100);
  const tier = getRankTier(level);
  const nextTier = isMax ? undefined : getRankTier(level + 1);

  return {
    level,
    name: tier.name,
    rarity: tier.rarity,
    color: tier.color,
    bgColor: tier.bgColor,
    progress,
    xpInLevel,
    xpNeeded,
    isMax,
    nextName: nextTier?.name,
    totalXPForCurrent: currentXP,
    totalXPForNext: nextXP,
  };
}

// Milestone levels that get special visual treatment
export const MILESTONES = [10, 25, 50, 100, 150, 200, 300, 400, 500, 600, 700, 800, 900, 1000];

const createDefaultProfile = (name: string): MasterProfile => ({
  id: Date.now().toString(),
  name,
  createdAt: new Date().toISOString(),
  xp: 0,
  level: 1,
  streak: 0,
  totalVideos: 0,
  interactions: 0,
  accounts: [],
  videos: [],
  references: [],
  schedule: [],
  contents: [],
  performance: [],
});

const sampleProfile: MasterProfile = {
  id: 'sample-progizyn',
  name: 'ProgizyN',
  createdAt: '2026-01-01T00:00:00Z',
  xp: 504495,
  level: 1000,
  streak: 12,
  totalVideos: 48,
  interactions: 42,
  accounts: [
    { id: '1', username: '@progizyn.growth', displayName: 'ProgizyN Growth', niche: 'Marketing Digital', followers: 15200, connected: true, isPrimary: true, category: 'crescimento' },
    { id: '2', username: '@progizyn.tech', displayName: 'ProgizyN Tech', niche: 'Tech Reviews', followers: 8700, connected: true, isPrimary: false, category: 'monetizacao' },
    { id: '3', username: '@progizyn.lifestyle', displayName: 'ProgizyN Life', niche: 'Lifestyle', followers: 3200, connected: false, isPrimary: false, category: 'vendas' },
  ],
  videos: [
    { id: '1', title: '5 Hacks para TikTok Shop', niche: 'Marketing Digital', status: 'posted', category: 'vendas' },
    { id: '2', title: 'Review iPhone 16 Pro', niche: 'Tech Reviews', status: 'editing', category: 'monetizacao' },
    { id: '3', title: 'Rotina de Creator', niche: 'Lifestyle', status: 'recording', category: 'crescimento' },
    { id: '4', title: 'Como viralizar em 2025', niche: 'Marketing Digital', status: 'idea', category: 'crescimento' },
    { id: '5', title: 'Setup Tour 2025', niche: 'Tech Reviews', status: 'idea', category: 'monetizacao' },
  ],
  references: [
    { id: '1', type: 'link', url: '#', title: 'TikTok Trends Q1 2026', niche: 'Marketing Digital' },
    { id: '2', type: 'link', url: '#', title: 'Hook Frameworks', niche: 'Marketing Digital' },
    { id: '3', type: 'image', url: '', title: 'Print viral exemplo', niche: 'Marketing Digital' },
  ],
  schedule: [
    { id: '1', date: '2026-03-27', time: '09:00', title: '5 Hacks TikTok Shop', category: 'vendas', accountId: '1', description: 'Dicas para vender mais', hashtags: '#tiktokshop #vendas', status: 'ready' },
    { id: '2', date: '2026-03-27', time: '14:00', title: 'Review iPhone', category: 'monetizacao', accountId: '2', description: 'Análise completa', hashtags: '#review #tech', status: 'producing' },
    { id: '3', date: '2026-03-28', time: '10:00', title: 'Rotina Creator', category: 'crescimento', accountId: '1', description: 'Um dia na vida', hashtags: '#rotina #creator', status: 'idea' },
    { id: '4', date: '2026-03-29', time: '11:00', title: 'Viralizar 2026', category: 'crescimento', accountId: '1', description: 'Estratégias atuais', hashtags: '#viral #tiktok', status: 'idea' },
  ],
  contents: [
    { id: 'c1', title: '5 Hacks para TikTok Shop', category: 'vendas', objective: 'Aumentar vendas na TikTok Shop', videoLink: '', imageUrl: '', description: 'Dicas práticas para vender mais', hashtags: '#tiktokshop #vendas', cta: 'Link na bio', observations: '', status: 'posted', priority: 'high', accountId: '1', favorite: true, createdAt: '2026-03-20T10:00:00Z' },
    { id: 'c2', title: 'Como viralizar em 2026', category: 'crescimento', objective: 'Ganhar seguidores', videoLink: '', imageUrl: '', description: 'Estratégias de viralização', hashtags: '#viral #tiktok', cta: 'Siga para mais', observations: 'Testar formato dueto', status: 'idea', priority: 'medium', accountId: '1', favorite: false, createdAt: '2026-03-22T14:00:00Z' },
    { id: 'c3', title: 'Review iPhone 16 Pro', category: 'monetizacao', objective: 'Gerar receita com afiliados', videoLink: '', imageUrl: '', description: 'Análise completa do iPhone', hashtags: '#review #tech', cta: 'Link de compra na bio', observations: '', status: 'producing', priority: 'high', accountId: '2', favorite: true, createdAt: '2026-03-25T09:00:00Z' },
  ],
  performance: [
    { id: 'p1', title: '5 Hacks para TikTok Shop', accountId: '1', category: 'vendas', date: '2026-03-20', views: 45200, likes: 3800, comments: 420, shares: 890, saves: 1200, objective: 'Vendas TikTok Shop', result: '32 vendas diretas' },
    { id: 'p2', title: 'Como viralizar em 2026', accountId: '1', category: 'crescimento', date: '2026-03-22', views: 128000, likes: 12500, comments: 1800, shares: 4200, saves: 3100, objective: 'Ganhar seguidores', result: '+2.4k seguidores' },
    { id: 'p3', title: 'Review iPhone 16 Pro', accountId: '2', category: 'monetizacao', date: '2026-03-25', views: 67500, likes: 5400, comments: 780, shares: 1500, saves: 2800, objective: 'Receita afiliados', result: 'R$ 1.200 em comissões' },
    { id: 'p4', title: 'Rotina de Creator', accountId: '1', category: 'crescimento', date: '2026-03-18', views: 23400, likes: 2100, comments: 310, shares: 450, saves: 680, objective: 'Engajamento', result: 'Taxa 12.8%' },
    { id: 'p5', title: 'Setup Tour 2026', accountId: '2', category: 'monetizacao', date: '2026-03-15', views: 89000, likes: 7200, comments: 920, shares: 2100, saves: 3400, objective: 'Afiliados tech', result: 'R$ 890 em vendas' },
    { id: 'p6', title: 'Trend de dança viral', accountId: '3', category: 'crescimento', date: '2026-03-12', views: 340000, likes: 42000, comments: 5600, shares: 18000, saves: 8900, objective: 'Viralizar', result: '+8.2k seguidores' },
  ],
};

// For backward compat
export type UserProfile = MasterProfile;

interface AppState {
  profiles: MasterProfile[];
  activeProfileId: string | null;
}

const getInitialState = (): AppState => {
  const saved = localStorage.getItem('progcontrol-state');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch { /* fallback */ }
  }
  // Migrate old single-profile data
  const oldProfile = localStorage.getItem('progcontrol-profile');
  if (oldProfile) {
    try {
      const parsed = JSON.parse(oldProfile);
      const migrated: MasterProfile = {
        ...sampleProfile,
        ...parsed,
        id: 'migrated-' + Date.now(),
        displayName: parsed.displayName || parsed.name,
        createdAt: new Date().toISOString(),
        accounts: (parsed.accounts || []).map((a: any) => ({
          ...a,
          displayName: a.displayName || a.username,
          connected: a.connected ?? true,
          isPrimary: a.isPrimary ?? false,
          category: a.category || 'geral',
        })),
        videos: (parsed.videos || []).map((v: any) => ({
          ...v,
          category: v.category || 'crescimento',
        })),
      };
      localStorage.removeItem('progcontrol-profile');
      const state: AppState = { profiles: [migrated], activeProfileId: migrated.id };
      localStorage.setItem('progcontrol-state', JSON.stringify(state));
      return state;
    } catch { /* fallback */ }
  }
  // Default with sample
  return { profiles: [sampleProfile], activeProfileId: sampleProfile.id };
};

function saveState(state: AppState) {
  localStorage.setItem('progcontrol-state', JSON.stringify(state));
}

export function useAppState() {
  const [state, setState] = useState<AppState>(getInitialState);

  const activeProfile = state.profiles.find(p => p.id === state.activeProfileId) || null;

  const setActiveProfile = useCallback((id: string) => {
    setState(prev => {
      const next = { ...prev, activeProfileId: id };
      saveState(next);
      return next;
    });
  }, []);

  const createProfile = useCallback((name: string) => {
    const newP = createDefaultProfile(name);
    setState(prev => {
      const next = { profiles: [...prev.profiles, newP], activeProfileId: newP.id };
      saveState(next);
      return next;
    });
    return newP;
  }, []);

  const deleteProfile = useCallback((id: string) => {
    setState(prev => {
      const filtered = prev.profiles.filter(p => p.id !== id);
      const next = {
        profiles: filtered,
        activeProfileId: prev.activeProfileId === id ? (filtered[0]?.id || null) : prev.activeProfileId,
      };
      saveState(next);
      return next;
    });
  }, []);

  const updateProfile = useCallback((updates: Partial<MasterProfile>) => {
    setState(prev => {
      const next = {
        ...prev,
        profiles: prev.profiles.map(p =>
          p.id === prev.activeProfileId ? { ...p, ...updates } : p
        ),
      };
      saveState(next);
      return next;
    });
    playSound('saveContent');
  }, []);

  const addXP = useCallback((amount: number) => {
    setState(prev => {
      const next = {
        ...prev,
        profiles: prev.profiles.map(p => {
          if (p.id !== prev.activeProfileId) return p;
          const oldLevel = p.level;
          const newXP = p.xp + amount;
          const newInteractions = (p.interactions || 0) + 1;
          const bonus = newInteractions % 8 === 0 ? 5 : 0;
          const finalXP = newXP + bonus;
          const info = getLevelInfo(finalXP);
          // Play level up sound if level increased
          if (info.level > oldLevel) {
            setTimeout(() => playSound('levelUp'), 100);
          }
          return { ...p, xp: finalXP, level: info.level, interactions: newInteractions };
        }),
      };
      saveState(next);
      return next;
    });
  }, []);

  const logout = useCallback(() => {
    setState(prev => {
      const next = { ...prev, activeProfileId: null };
      saveState(next);
      return next;
    });
  }, []);

  return {
    profiles: state.profiles,
    activeProfile,
    profile: activeProfile, // alias for backward compat
    setActiveProfile,
    createProfile,
    deleteProfile,
    updateProfile,
    addXP,
    logout,
  };
}

// Keep old hook name working
export const useProfile = useAppState;
