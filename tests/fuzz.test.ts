import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/level';
import { candidateActions } from '../src/core/solver';
import { isTurnError, runTurn } from '../src/core/turnSystem';
import type { GameState } from '../src/core/types';
import { isBlocked, trapAt } from '../src/core/world';
import { LEVELS } from '../src/levels';

/** Deterministic PRNG for reproducible fuzzing. */
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function checkInvariants(s: GameState, where: string) {
  const free = s.cats.filter((c) => c.mode !== 'trapped');
  const cells = new Set(free.map((c) => `${c.pos.x},${c.pos.y}`));
  expect(cells.size, `${where}: two cats share a cell`).toBe(free.length);
  for (const c of free) {
    expect(isBlocked(s, c.pos), `${where}: ${c.id} stands inside an obstacle`).toBe(false);
    const hit = trapAt(s, c.pos);
    if (hit) expect(hit.part, `${where}: free cat ${c.id} on a trap plate`).toBe('front');
  }
  for (const c of s.cats.filter((k) => k.mode === 'trapped')) {
    const hit = trapAt(s, c.pos);
    expect(hit?.part, `${where}: trapped ${c.id} not on a plate`).toBe('back');
    expect(hit?.trap.occupiedBy).toBe(c.id);
  }
  for (const v of Object.values(s.inventory)) expect(v).toBeGreaterThanOrEqual(0);
  expect(s.rescued.length).toBe(s.cats.filter((c) => c.mode === 'trapped').length);
  for (const c of s.cats) {
    for (const k of ['hunger', 'fear', 'curiosity', 'trust'] as const) {
      expect(c[k]).toBeGreaterThanOrEqual(0);
      expect(c[k]).toBeLessThanOrEqual(3);
    }
  }
}

describe('fuzzing random play', () => {
  for (const def of LEVELS) {
    it(`${def.title}: random valid actions never break the world`, () => {
      const rnd = lcg(def.order * 7919);
      for (let game = 0; game < 25; game++) {
        let s = createInitialState(def);
        for (let t = 0; t < 30 && s.status === 'playing'; t++) {
          const acts = candidateActions(s);
          // bias towards waiting so cats get time to act on what was placed
          const a = rnd() < 0.45 ? { type: 'wait' as const } : acts[Math.floor(rnd() * acts.length)];
          const r = runTurn(s, a);
          expect(isTurnError(r), `candidate action rejected: ${JSON.stringify(a)}`).toBe(false);
          if (isTurnError(r)) break;
          s = r.state;
          checkInvariants(s, `${def.id} game ${game} turn ${t}`);
        }
      }
    });
  }
});
