// Regression tests for bugs found in code review.
import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/level';
import { validatePlaceTrap } from '../src/core/trapSystem';
import { levelById } from '../src/levels';
import { catDef, catOf, play, state, step, waits } from './helpers';

const OPEN3 = ['.......', '.......', '.......'];

describe('regressions', () => {
  it('a cat on its patrol never wanders into an unbaited trap', () => {
    let s = createInitialState(levelById('l8')!);
    s = step(s, { type: 'placeTrap', cell: { x: 1, y: 1 }, dir: 'S' }).state;
    s = play(s, waits(12)).state;
    expect(catOf(s, 'luna').mode).not.toBe('trapped');
  });

  it('a cat waiting at a trap door steps aside so a scared cat can leave', () => {
    let s = state({
      map: OPEN3,
      cats: [catDef('b', [3, 1], { hunger: 2, fear: 1, trust: 1 }), catDef('a', [4, 1], { hunger: 3, fear: 0, trust: 3 })],
      traps: [{ id: 't', pos: [1, 1], dir: 'E', bait: 'kibble' }],
      noises: [{ id: 'n', kind: 'radio', pos: [0, 2], radius: 3, schedule: { start: 2, duration: 2 } }],
    });
    let stuckTurns = 0;
    for (let i = 0; i < 25 && s.status === 'playing'; i++) {
      s = step(s, { type: 'wait' }).state;
      const b = catOf(s, 'b');
      const a = catOf(s, 'a');
      const deadlock = b.mode === 'frightened' && b.pos.x === 2 && a.pos.x === 3 && a.pos.y === 1;
      stuckTurns = deadlock ? stuckTurns + 1 : 0;
      expect(stuckTurns).toBeLessThan(3);
    }
  });

  it('a cat that ends up standing on food eats it once calm', () => {
    let s = state({
      map: OPEN3,
      cats: [catDef('c', [4, 1], { hunger: 2, fear: 1, trust: 1 })],
      noises: [{ id: 'n', kind: 'radio', pos: [0, 1], radius: 4, schedule: { start: 1, duration: 1 } }],
    });
    s.foods.push({ id: 'f', kind: 'kibble', cell: { x: 5, y: 1 }, ttl: 99 });
    s = play(s, waits(8)).state;
    expect(catOf(s, 'c').hunger).toBe(1);
    expect(s.foods.length).toBe(0);
  });

  it('cats walk around a dozing cat instead of waiting forever', () => {
    let s = state({
      map: OPEN3,
      cats: [catDef('sleepy', [3, 1], { hunger: 0 }), catDef('hungry', [5, 1], { hunger: 3 })],
    });
    s.foods.push({ id: 'f', kind: 'kibble', cell: { x: 1, y: 1 }, ttl: 99 });
    s = play(s, waits(8)).state;
    expect(s.foods.length).toBe(0);
    expect(catOf(s, 'hungry').hunger).toBe(2);
  });

  it('a trap cannot be placed on top of another trap entrance', () => {
    const s = state({ map: OPEN3, cats: [catDef('a', [6, 0])], traps: [{ id: 't', pos: [1, 1], dir: 'E' }], inventory: { trap: 1 } });
    expect(validatePlaceTrap(s, { x: 3, y: 1 }, 'S').ok).toBe(false);
    expect(validatePlaceTrap(s, { x: 3, y: 0 }, 'N').ok).toBe(false); // front would be off-board anyway
    expect(validatePlaceTrap(s, { x: 4, y: 0 }, 'E').ok).toBe(true);
  });

  it('a spring gate that starts open closes after its timer, not after one turn', () => {
    let s = state({ map: ['..F..', '..G..', '..F..'], cats: [catDef('a', [0, 0], { hunger: 0 })], gates: [{ id: 'g', pos: [2, 1], open: true, autoClose: 3 }] });
    s = play(s, waits(2)).state;
    expect(s.gates[0].open).toBe(true);
    s = step(s, { type: 'wait' }).state;
    expect(s.gates[0].open).toBe(false);
  });
});
