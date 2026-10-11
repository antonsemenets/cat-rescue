// Global app state: navigation, progress and settings (Svelte 5 runes).

import { audio } from '../audio/audio';
import type { LevelResult } from '../core/scoring';
import { LEVELS } from '../levels';
import { defaultSave, isLevelUnlocked, loadSave, recordLevelResult, writeSave, type SaveData, type Settings } from '../persistence/save';

export type Screen = 'menu' | 'levels' | 'game' | 'shelter';

/** dev only: ?screen=shelter or ?level=l12 opens a screen / level directly (handy for testing) */
function devParam(name: string): string | null {
  if (!import.meta.env.DEV || typeof location === 'undefined') return null;
  return new URLSearchParams(location.search).get(name);
}
const devLevel = LEVELS.find((l) => l.id === devParam('level'))?.id ?? null;
function startScreen(): Screen {
  if (devLevel) return 'game';
  const s = devParam('screen');
  return s === 'levels' || s === 'shelter' ? s : 'menu';
}

class AppState {
  screen = $state<Screen>(startScreen());
  levelId = $state<string>(devLevel ?? LEVELS[0].id);
  save = $state<SaveData>(loadSave());
  settingsOpen = $state(false);
  /** cats rescued since the shelter was last opened */
  freshCats = $state<string[]>([]);

  get settings(): Settings {
    return this.save.settings;
  }

  persist() {
    writeSave($state.snapshot(this.save) as SaveData);
  }

  updateSettings(patch: Partial<Settings>) {
    this.save.settings = { ...this.save.settings, ...patch };
    this.persist();
    this.applyAudio();
  }

  applyAudio() {
    const s = this.save.settings;
    audio.setVolumes({ sfx: s.sfxVolume, music: s.musicVolume, muted: s.muted });
  }

  go(screen: Screen) {
    audio.unlock();
    this.screen = screen;
  }

  play(levelId: string) {
    audio.unlock();
    this.levelId = levelId;
    this.screen = 'game';
  }

  isUnlocked(id: string): boolean {
    return isLevelUnlocked(this.save, LEVELS.map((l) => l.id), id);
  }

  /** First level that is unlocked but not completed (or the last one). */
  nextToPlay(): string {
    for (const l of LEVELS) if (this.isUnlocked(l.id) && !this.save.levels[l.id]?.completed) return l.id;
    return LEVELS[LEVELS.length - 1].id;
  }

  recordWin(levelId: string, result: LevelResult, catIds: string[]) {
    const fresh = catIds.filter((id) => !this.save.rescued[id]);
    this.save = recordLevelResult($state.snapshot(this.save) as SaveData, levelId, result, catIds);
    if (fresh.length) this.freshCats = [...this.freshCats, ...fresh];
    this.persist();
  }

  pet(catId: string) {
    const r = this.save.rescued[catId];
    if (!r) return;
    this.save.rescued[catId] = { ...r, pets: r.pets + 1 };
    this.persist();
  }

  resetProgress() {
    const settings = this.save.settings;
    this.save = { ...defaultSave(), settings };
    this.freshCats = [];
    this.persist();
  }

  markBriefingSeen(levelId: string) {
    if (this.save.seenBriefings.includes(levelId)) return;
    this.save.seenBriefings = [...this.save.seenBriefings, levelId];
    this.persist();
  }

  markIntroSeen() {
    if (!this.save.seenIntro) {
      this.save.seenIntro = true;
      this.persist();
    }
  }
}

export const app = new AppState();
app.applyAudio();
