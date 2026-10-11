import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/level';
import { solve } from '../src/core/solver';
import { simulate } from '../src/core/gameCore';
import { levelById } from '../src/levels';

describe('solver', () => {
  for (const [id, turns] of [
    ['l1', 5],
    ['l2', 5],
    ['l6', 8],
    ['l11', 13],
  ] as const) {
    it(`finds an optimal solution for ${id} (${turns} turns)`, () => {
      const def = levelById(id)!;
      const r = solve(createInitialState(def), { maxTurns: turns + 1 });
      expect(r.solved).toBe(true);
      expect(r.turns).toBe(turns);
      expect(simulate(def, r.actions).state.status).toBe('won');
      // reference star threshold matches the optimum
      expect(def.stars.threeStarTurns).toBe(turns);
    });
  }
});
