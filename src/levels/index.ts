// Level registry. Each level is a plain JSON file (lN.json) validated by
// LevelSystem; every file in this folder is picked up automatically.
import type { LevelDef } from '../core/level';

const files = import.meta.glob<LevelDef>('./l*.json', { eager: true, import: 'default' });

export const LEVELS: LevelDef[] = Object.values(files).sort((a, b) => a.order - b.order);

export interface Chapter {
  title: string;
  subtitle: string;
  /** first and last level order in the chapter */
  from: number;
  to: number;
}

export const CHAPTERS: Chapter[] = [
  { title: 'Первые шаги', subtitle: 'Знакомство с ловушками и котиками', from: 1, to: 9 },
  { title: 'Новые соседи', subtitle: 'Котята, колокольчики и привереды', from: 10, to: 19 },
  { title: 'Мастер спасения', subtitle: 'Самые хитрые дворы города', from: 20, to: 99 },
];

export function chapterOf(order: number): Chapter {
  return CHAPTERS.find((c) => order >= c.from && order <= c.to) ?? CHAPTERS[CHAPTERS.length - 1];
}

export function levelById(id: string): LevelDef | undefined {
  return LEVELS.find((l) => l.id === id);
}

export function nextLevel(id: string): LevelDef | undefined {
  const i = LEVELS.findIndex((l) => l.id === id);
  return i >= 0 ? LEVELS[i + 1] : undefined;
}
