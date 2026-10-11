import { describe, expect, it } from 'vitest';
import { makeSnapshot, catStepCost } from '../src/core/catAI';
import { findPath, buildCostMap, costTo } from '../src/core/pathfinding';
import { canStep } from '../src/core/world';
import { catDef, state, catOf } from './helpers';

describe('pathfinding', () => {
  it('finds the shortest route around walls', () => {
    const s = state({
      map: ['.....', '.###.', '.....', '.....', '.....'],
      cats: [catDef('a', [0, 0])],
    });
    const cost = catStepCost(makeSnapshot(s), catOf(s, 'a'));
    const r = findPath(s.width, s.height, { x: 2, y: 0 }, { x: 2, y: 2 }, cost)!;
    expect(r).not.toBeNull();
    expect(r.path.length).toBe(6);
    for (const c of r.path) expect(s.features[c.y * s.width + c.x]).toBeNull();
  });

  it('never walks through obstacles, fences or water', () => {
    const s = state({
      map: ['..F..', '..F..', '..~..', '..F..', '..T..'],
      cats: [catDef('a', [0, 0])],
    });
    const cost = catStepCost(makeSnapshot(s), catOf(s, 'a'));
    expect(findPath(s.width, s.height, { x: 0, y: 0 }, { x: 4, y: 0 }, cost)).toBeNull();
  });

  it('is deterministic for equal-cost alternatives', () => {
    const s = state({ map: ['.....', '.....', '.....', '.....', '.....'], cats: [catDef('a', [0, 0])] });
    const cost = catStepCost(makeSnapshot(s), catOf(s, 'a'));
    const a = findPath(5, 5, { x: 0, y: 0 }, { x: 3, y: 3 }, cost)!;
    for (let i = 0; i < 20; i++) expect(findPath(5, 5, { x: 0, y: 0 }, { x: 3, y: 3 }, cost)).toEqual(a);
  });

  it('a very shy cat (fear 3) never enters open cells', () => {
    // fence column on the left: x=1 is shaded, everything else open
    const s = state({ map: ['F....', 'F....', 'F....', 'F....', 'F....'], cats: [catDef('shy', [1, 0], { fear: 3 })] });
    const map = buildCostMap(5, 5, { x: 1, y: 0 }, catStepCost(makeSnapshot(s), catOf(s, 'shy')));
    expect(costTo(map, { x: 1, y: 4 })).toBe(40);
    expect(costTo(map, { x: 2, y: 0 })).toBe(Infinity);
  });

  it('fearful cats pay extra for open cells and prefer shade', () => {
    const s = state({ map: ['#####', '.....', '.....', '.....'], cats: [catDef('f2', [0, 1], { fear: 2 })] });
    const cost = catStepCost(makeSnapshot(s), catOf(s, 'f2'));
    const r = findPath(5, 4, { x: 0, y: 2 }, { x: 4, y: 2 }, cost)!;
    // going up into the shaded row and back down is cheaper than crossing the sun
    expect(r.path.some((c) => c.y === 1)).toBe(true);
  });

  it('respects trap walls: entry only through the door', () => {
    const s = state({
      map: ['.....', '.....', '.....'],
      cats: [catDef('a', [0, 0])],
      traps: [{ id: 't', pos: [1, 1], dir: 'E' }], // back (1,1), front (2,1), approach (3,1)
    });
    expect(canStep(s, { x: 2, y: 0 }, { x: 2, y: 1 })).toBe(false); // side of front
    expect(canStep(s, { x: 1, y: 0 }, { x: 1, y: 1 })).toBe(false); // side of back
    expect(canStep(s, { x: 0, y: 1 }, { x: 1, y: 1 })).toBe(false); // rear wall
    expect(canStep(s, { x: 3, y: 1 }, { x: 2, y: 1 })).toBe(true); // through the door
    expect(canStep(s, { x: 2, y: 1 }, { x: 1, y: 1 })).toBe(true); // deeper inside
    expect(canStep(s, { x: 2, y: 1 }, { x: 2, y: 2 })).toBe(false); // no side exit
  });
});
