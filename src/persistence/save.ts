// Persistence — progress, rescued cats and settings in localStorage.
// Storage is injectable so it can be tested without a browser.

import type { LevelResult } from '../core/scoring';

export const SAVE_KEY = 'cat-rescue-save-v1';

export interface Settings {
  sfxVolume: number; // 0..1
  musicVolume: number; // 0..1
  muted: boolean;
  /** 1 = normal, 2 = fast, 3 = very fast */
  animSpeed: 1 | 2 | 3;
  reducedMotion: boolean;
  showPaths: boolean;
  showHints: boolean;
}

export interface LevelProgress {
  completed: boolean;
  stars: number;
  bestTurns: number | null;
}

export interface RescuedCat {
  levelId: string;
  rescuedAt: number;
  pets: number;
}

export interface SaveData {
  version: 1;
  levels: Record<string, LevelProgress>;
  rescued: Record<string, RescuedCat>;
  settings: Settings;
  seenIntro: boolean;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function defaultSettings(): Settings {
  const reduced =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;
  return {
    sfxVolume: 0.7,
    musicVolume: 0.4,
    muted: false,
    animSpeed: 1,
    reducedMotion: reduced,
    showPaths: true,
    showHints: true,
  };
}

export function defaultSave(): SaveData {
  return { version: 1, levels: {}, rescued: {}, settings: defaultSettings(), seenIntro: false };
}

function memoryStorage(): StorageLike {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
}

let fallback: StorageLike | null = null;

export function browserStorage(): StorageLike {
  try {
    if (typeof localStorage !== 'undefined') {
      const probe = '__cat_rescue_probe__';
      localStorage.setItem(probe, '1');
      localStorage.removeItem(probe);
      return localStorage;
    }
  } catch {
    // private mode / blocked storage — fall through
  }
  fallback ??= memoryStorage();
  return fallback;
}

/** Cat ids that were renamed — old saves keep their rescued cats. */
const LEGACY_CAT_IDS: Record<string, string> = { ten: 'dartik' };

const clamp01 = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : d);

/** Parse and sanitize — never trust what is in storage. */
export function parseSave(raw: string | null): SaveData {
  const base = defaultSave();
  if (!raw) return base;
  try {
    const d = JSON.parse(raw) as Partial<SaveData>;
    if (!d || typeof d !== 'object' || d.version !== 1) return base;
    const levels: Record<string, LevelProgress> = {};
    for (const [id, p] of Object.entries(d.levels ?? {})) {
      if (!p || typeof p !== 'object') continue;
      levels[id] = {
        completed: !!p.completed,
        stars: Math.max(0, Math.min(3, Math.floor(Number(p.stars) || 0))),
        bestTurns: typeof p.bestTurns === 'number' && p.bestTurns > 0 ? Math.floor(p.bestTurns) : null,
      };
    }
    const rescued: Record<string, RescuedCat> = {};
    for (const [id, r] of Object.entries(d.rescued ?? {})) {
      if (!r || typeof r !== 'object' || typeof r.levelId !== 'string') continue;
      rescued[LEGACY_CAT_IDS[id] ?? id] = { levelId: r.levelId, rescuedAt: Number(r.rescuedAt) || 0, pets: Math.max(0, Math.floor(Number(r.pets) || 0)) };
    }
    const s = (d.settings ?? {}) as Partial<Settings>;
    const settings: Settings = {
      sfxVolume: clamp01(s.sfxVolume, base.settings.sfxVolume),
      musicVolume: clamp01(s.musicVolume, base.settings.musicVolume),
      muted: !!s.muted,
      animSpeed: s.animSpeed === 2 || s.animSpeed === 3 ? s.animSpeed : 1,
      reducedMotion: typeof s.reducedMotion === 'boolean' ? s.reducedMotion : base.settings.reducedMotion,
      showPaths: s.showPaths !== false,
      showHints: s.showHints !== false,
    };
    return { version: 1, levels, rescued, settings, seenIntro: !!d.seenIntro };
  } catch {
    return base;
  }
}

export function loadSave(storage: StorageLike = browserStorage()): SaveData {
  try {
    return parseSave(storage.getItem(SAVE_KEY));
  } catch {
    return defaultSave();
  }
}

export function writeSave(data: SaveData, storage: StorageLike = browserStorage()): void {
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // quota / blocked — progress simply is not persisted
  }
}

/** Merge a level result into the save (keeps best stars / turns). */
export function recordLevelResult(data: SaveData, levelId: string, result: LevelResult, catIds: string[], now = Date.now()): SaveData {
  const prev = data.levels[levelId];
  const levels = {
    ...data.levels,
    [levelId]: {
      completed: true,
      stars: Math.max(prev?.stars ?? 0, result.stars),
      bestTurns: prev?.bestTurns ? Math.min(prev.bestTurns, result.turns) : result.turns,
    },
  };
  const rescued = { ...data.rescued };
  for (const id of catIds) if (!rescued[id]) rescued[id] = { levelId, rescuedAt: now, pets: 0 };
  return { ...data, levels, rescued };
}

export function isLevelUnlocked(data: SaveData, orderedIds: string[], id: string): boolean {
  const i = orderedIds.indexOf(id);
  if (i <= 0) return i === 0;
  return !!data.levels[orderedIds[i - 1]]?.completed;
}

export function totalStars(data: SaveData): number {
  return Object.values(data.levels).reduce((n, l) => n + l.stars, 0);
}
