import { describe, expect, it } from 'vitest';
import { validatePlaceTrap, validateRotateTrap } from '../src/core/trapSystem';
import { validateAction } from '../src/core/turnSystem';
import { catDef, catOf, play, state, step, waits } from './helpers';

const OPEN = ['.......', '.......', '.......', '.......', '.......'];

describe('humane traps', () => {
  it('catches a cat that walks in through the entrance onto the plate', () => {
    let s = state({
      map: OPEN,
      cats: [catDef('a', [4, 2], { hunger: 2 })],
      traps: [{ id: 't', pos: [1, 2], dir: 'E' }], // back (1,2) front (2,2) approach (3,2)
      inventory: { kibble: 1 },
    });
    s = step(s, { type: 'placeFood', kind: 'kibble', cell: { x: 1, y: 2 } }).state;
    const r = play(s, waits(5));
    const cat = catOf(r.state, 'a');
    expect(cat.mode).toBe('trapped');
    expect(cat.pos).toEqual({ x: 1, y: 2 });
    expect(r.state.traps[0].occupiedBy).toBe('a');
    expect(r.state.traps[0].bait).toBeNull();
    expect(r.state.status).toBe('won');
  });

  it('a cat on the far side walks around to the entrance — never through the side', () => {
    let s = state({
      map: OPEN,
      cats: [catDef('a', [1, 0], { hunger: 3 })],
      traps: [{ id: 't', pos: [1, 2], dir: 'S' }], // back (1,2) front (1,3) approach (1,4)
      inventory: { kibble: 1 },
    });
    s = step(s, { type: 'placeFood', kind: 'kibble', cell: { x: 1, y: 2 } }).state;
    const visited: string[] = [];
    for (let i = 0; i < 12 && s.status !== 'won'; i++) {
      s = step(s, { type: 'wait' }).state;
      const c = catOf(s, 'a');
      visited.push(`${c.pos.x},${c.pos.y}`);
    }
    expect(s.status).toBe('won');
    const idxFront = visited.indexOf('1,3');
    expect(visited[idxFront - 1]).toBe('1,4'); // entered the front from the approach cell
  });

  it('does not catch a cat that only touches the trap from the side', () => {
    let s = state({
      map: OPEN,
      cats: [catDef('a', [0, 1], { hunger: 0 }, { patrol: [[0, 1], [4, 1]] })],
      traps: [{ id: 't', pos: [2, 2], dir: 'S' }],
    });
    s = play(s, waits(8)).state;
    expect(catOf(s, 'a').mode).not.toBe('trapped');
  });

  it('an occupied trap cannot catch a second cat', () => {
    let s = state({
      map: OPEN,
      cats: [catDef('a', [4, 2], { hunger: 3 }), catDef('b', [6, 2], { hunger: 3 })],
      traps: [{ id: 't', pos: [1, 2], dir: 'E', bait: 'kibble' }],
      inventory: { kibble: 1 },
    });
    s = play(s, waits(4)).state;
    expect(s.traps[0].occupiedBy).toBe('a');
    expect(validateAction(s, { type: 'placeFood', kind: 'kibble', cell: { x: 1, y: 2 } }).ok).toBe(false);
    s = play(s, waits(6)).state;
    expect(catOf(s, 'b').mode).not.toBe('trapped');
    expect(s.status).toBe('playing');
  });

  it('placement needs two free cells and a reachable entrance', () => {
    const s = state({
      map: ['.R.....', '.......', '.......', '.......', '.......'],
      cats: [catDef('a', [3, 3])],
      inventory: { trap: 1 },
    });
    expect(validatePlaceTrap(s, { x: 1, y: 2 }, 'N').ok).toBe(false); // approach is a rock
    expect(validatePlaceTrap(s, { x: 6, y: 2 }, 'E').ok).toBe(false); // off the board
    expect(validatePlaceTrap(s, { x: 3, y: 2 }, 'S').ok).toBe(false); // front on the cat
    expect(validatePlaceTrap(s, { x: 1, y: 2 }, 'S').ok).toBe(true);
  });

  it('rotation changes the entrance side; blocked when occupied', () => {
    let s = state({
      map: OPEN,
      cats: [catDef('a', [6, 4], { hunger: 0 })],
      traps: [{ id: 't', pos: [3, 2], dir: 'W' }],
    });
    expect(validateRotateTrap(s, 't', 'W').ok).toBe(false);
    s = step(s, { type: 'rotateTrap', trapId: 't', dir: 'E' }).state;
    expect(s.traps[0].dir).toBe('E');
    s.traps[0].occupiedBy = 'a';
    expect(validateRotateTrap(s, 't', 'N').ok).toBe(false);
  });

  it('fixed traps cannot be rotated', () => {
    const s = state({ map: OPEN, cats: [catDef('a', [6, 4])], traps: [{ id: 't', pos: [3, 2], dir: 'W', rotatable: false }] });
    expect(validateRotateTrap(s, 't', 'E').ok).toBe(false);
  });
});
