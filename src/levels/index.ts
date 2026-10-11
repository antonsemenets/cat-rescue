// Level registry. Each level is a plain JSON file validated by LevelSystem.
import type { LevelDef } from '../core/level';
import l1 from './l1.json';
import l2 from './l2.json';
import l3 from './l3.json';
import l4 from './l4.json';
import l5 from './l5.json';
import l6 from './l6.json';
import l7 from './l7.json';
import l8 from './l8.json';
import l9 from './l9.json';

export const LEVELS: LevelDef[] = ([l1, l2, l3, l4, l5, l6, l7, l8, l9] as unknown as LevelDef[]).sort((a, b) => a.order - b.order);

export function levelById(id: string): LevelDef | undefined {
  return LEVELS.find((l) => l.id === id);
}

export function nextLevel(id: string): LevelDef | undefined {
  const i = LEVELS.findIndex((l) => l.id === id);
  return i >= 0 ? LEVELS[i + 1] : undefined;
}
