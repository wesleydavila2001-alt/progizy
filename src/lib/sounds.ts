// Synthesized game-like sound effects using Web Audio API

export type SoundEffect =
  | 'missionComplete'
  | 'levelUp'
  | 'achievementUnlock'
  | 'dailyGoal'
  | 'saveContent'
  | 'taskComplete';

interface SoundSettings {
  enabled: boolean;
  volume: number; // 0–1
}

const STORAGE_KEY = 'progcontrol-sound-settings';

const DEFAULT_SETTINGS: SoundSettings = { enabled: true, volume: 0.5 };

export function getSoundSettings(): SoundSettings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSoundSettings(s: SoundSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

function playTone(
  freq: number,
  duration: number,
  type: OscillatorType,
  volume: number,
  startTime: number,
  ctx: AudioContext,
  gain: GainNode,
) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);
  osc.connect(gain);
  osc.start(startTime);
  osc.stop(startTime + duration);
}

function envelope(gain: GainNode, start: number, attack: number, hold: number, release: number, vol: number) {
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(vol, start + attack);
  gain.gain.setValueAtTime(vol, start + attack + hold);
  gain.gain.linearRampToValueAtTime(0, start + attack + hold + release);
}

// ── Sound Definitions ──

function playMissionComplete(ctx: AudioContext, vol: number) {
  const g = ctx.createGain();
  g.connect(ctx.destination);
  const t = ctx.currentTime;
  envelope(g, t, 0.01, 0.08, 0.15, vol * 0.4);
  playTone(523, 0.1, 'sine', vol, t, ctx, g);       // C5
  playTone(659, 0.1, 'sine', vol, t + 0.1, ctx, g);  // E5
  playTone(784, 0.15, 'sine', vol, t + 0.2, ctx, g);  // G5
  envelope(g, t, 0.01, 0.25, 0.2, vol * 0.4);
}

function playLevelUp(ctx: AudioContext, vol: number) {
  const g = ctx.createGain();
  g.connect(ctx.destination);
  const t = ctx.currentTime;
  envelope(g, t, 0.01, 0.4, 0.3, vol * 0.35);
  const notes = [523, 587, 659, 784, 880, 1047]; // C5 D5 E5 G5 A5 C6
  notes.forEach((f, i) => playTone(f, 0.12, 'sine', vol, t + i * 0.07, ctx, g));
}

function playAchievementUnlock(ctx: AudioContext, vol: number) {
  const g = ctx.createGain();
  g.connect(ctx.destination);
  const t = ctx.currentTime;
  envelope(g, t, 0.01, 0.35, 0.25, vol * 0.35);
  playTone(440, 0.12, 'triangle', vol, t, ctx, g);       // A4
  playTone(554, 0.12, 'triangle', vol, t + 0.1, ctx, g);  // C#5
  playTone(659, 0.12, 'triangle', vol, t + 0.2, ctx, g);  // E5
  playTone(880, 0.2, 'sine', vol, t + 0.3, ctx, g);       // A5
}

function playDailyGoal(ctx: AudioContext, vol: number) {
  const g = ctx.createGain();
  g.connect(ctx.destination);
  const t = ctx.currentTime;
  envelope(g, t, 0.01, 0.2, 0.15, vol * 0.3);
  playTone(698, 0.08, 'square', vol, t, ctx, g);     // F5
  playTone(880, 0.15, 'sine', vol, t + 0.08, ctx, g); // A5
}

function playSaveContent(ctx: AudioContext, vol: number) {
  const g = ctx.createGain();
  g.connect(ctx.destination);
  const t = ctx.currentTime;
  envelope(g, t, 0.01, 0.08, 0.1, vol * 0.25);
  playTone(880, 0.06, 'sine', vol, t, ctx, g);
  playTone(1047, 0.1, 'sine', vol, t + 0.06, ctx, g);
}

function playTaskComplete(ctx: AudioContext, vol: number) {
  const g = ctx.createGain();
  g.connect(ctx.destination);
  const t = ctx.currentTime;
  envelope(g, t, 0.01, 0.12, 0.12, vol * 0.3);
  playTone(659, 0.08, 'sine', vol, t, ctx, g);     // E5
  playTone(784, 0.12, 'sine', vol, t + 0.08, ctx, g); // G5
}

const SOUND_MAP: Record<SoundEffect, (ctx: AudioContext, vol: number) => void> = {
  missionComplete: playMissionComplete,
  levelUp: playLevelUp,
  achievementUnlock: playAchievementUnlock,
  dailyGoal: playDailyGoal,
  saveContent: playSaveContent,
  taskComplete: playTaskComplete,
};

export function playSound(effect: SoundEffect) {
  const settings = getSoundSettings();
  if (!settings.enabled || settings.volume <= 0) return;

  try {
    const ctx = getCtx();
    if (ctx.state === 'suspended') ctx.resume();
    SOUND_MAP[effect](ctx, settings.volume);
  } catch {
    // Silently fail — audio not critical
  }
}
