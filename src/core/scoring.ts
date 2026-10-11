import { totalItems } from './level';
import type { GameState, StarRules } from './types';

export interface LevelResult {
  stars: 1 | 2 | 3;
  turns: number;
  itemsUsed: number;
  rescued: number;
  total: number;
  /** which star conditions were met, for the victory screen */
  checks: { rescue: boolean; turns: boolean; efficiency: boolean };
}

export function computeResult(s: GameState, rules: StarRules): LevelResult | null {
  if (s.status !== 'won') return null;
  const itemsUsed = totalItems(s.used);
  const turnsOk = s.turn <= rules.twoStarTurns;
  const effOk = turnsOk && s.turn <= rules.threeStarTurns && itemsUsed <= rules.threeStarItems;
  return {
    stars: effOk ? 3 : turnsOk ? 2 : 1,
    turns: s.turn,
    itemsUsed,
    rescued: s.rescued.length,
    total: s.cats.length,
    checks: { rescue: true, turns: turnsOk, efficiency: effOk },
  };
}
