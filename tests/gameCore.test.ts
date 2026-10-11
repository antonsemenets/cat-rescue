import { describe, expect, it } from 'vitest';
import { GameCore } from '../src/core/gameCore';
import { solutionToActions } from '../src/core/level';
import { computeResult } from '../src/core/scoring';
import { LEVELS, levelById } from '../src/levels';
import { level, catDef } from './helpers';

describe('GameCore session', () => {
  it('undo restores the exact previous state', () => {
    const g = new GameCore(levelById('l3')!);
    const s0 = JSON.stringify(g.state);
    g.act({ type: 'placeBox', cell: { x: 3, y: 4 } });
    const s1 = JSON.stringify(g.state);
    g.act({ type: 'wait' });
    expect(g.canUndo).toBe(true);
    g.undo();
    expect(JSON.stringify(g.state)).toBe(s1);
    g.undo();
    expect(JSON.stringify(g.state)).toBe(s0);
    expect(g.canUndo).toBe(false);
    expect(g.undo()).toBeNull();
  });

  it('restart returns to the initial state and clears the log', () => {
    const g = new GameCore(levelById('l1')!);
    g.act({ type: 'wait' });
    g.act({ type: 'wait' });
    g.restart();
    expect(g.state.turn).toBe(0);
    expect(g.actions.length).toBe(0);
  });

  it('invalid actions are rejected with a reason and change nothing', () => {
    const g = new GameCore(levelById('l1')!);
    const r = g.act({ type: 'placeBox', cell: { x: 2, y: 2 } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason.length).toBeGreaterThan(0);
    expect(g.state.turn).toBe(0);
  });

  it('preview shows the effect of a hypothetical action without mutating', () => {
    const g = new GameCore(levelById('l2')!);
    g.act({ type: 'wait' });
    g.act({ type: 'wait' });
    const before = JSON.stringify(g.state);
    const plain = g.preview();
    expect(plain[0].target?.kind).toBe('patrol');
    const withBait = g.preview({ type: 'rotateTrap', trapId: 'trapA', dir: 'E' });
    expect(withBait.length).toBe(1);
    expect(JSON.stringify(g.state)).toBe(before);
  });

  it('replay: the action log reproduces the final state', () => {
    const def = levelById('l4')!;
    const g = new GameCore(def);
    for (const a of solutionToActions(def.solution)) {
      if (g.state.status === 'won') break;
      g.act(a);
    }
    const replay = new GameCore(def);
    for (const a of g.actions) replay.act(a);
    expect(replay.state).toEqual(g.state);
  });

  it('awards stars by per-level thresholds', () => {
    const def = level({
      map: ['.....', '.....', '.....'],
      cats: [catDef('a', [4, 1], { hunger: 2 })],
      traps: [{ id: 't', pos: [1, 1], dir: 'E' }],
      inventory: { kibble: 2 },
      stars: { twoStarTurns: 5, threeStarTurns: 3, threeStarItems: 1 },
    });
    const g = new GameCore(def);
    g.act({ type: 'placeFood', kind: 'kibble', cell: { x: 1, y: 1 } });
    g.act({ type: 'wait' });
    g.act({ type: 'wait' });
    expect(g.state.status).toBe('won');
    expect(g.result()!.stars).toBe(3);

    const s = structuredClone(g.state);
    s.turn = 4;
    expect(computeResult(s, def.stars)!.stars).toBe(2);
    s.turn = 3;
    s.used.kibble = 2;
    expect(computeResult(s, def.stars)!.stars).toBe(2);
    s.turn = 9;
    expect(computeResult(s, def.stars)!.stars).toBe(1);
  });

  it('detects a dead end (nothing left to try) and suggests undo', () => {
    const def = level({
      map: ['.....', '.....', '.....'],
      cats: [catDef('a', [4, 1], { hunger: 0 })],
      traps: [{ id: 't', pos: [1, 1], dir: 'E', rotatable: false }],
      inventory: { kibble: 1 },
    });
    const g = new GameCore(def);
    expect(g.progressHint()).toBeNull();
    g.act({ type: 'placeFood', kind: 'kibble', cell: { x: 1, y: 1 } });
    expect(g.progressHint()).toBe('stuck');
  });

  it('every level starts in a valid playable state', () => {
    for (const def of LEVELS) {
      const g = new GameCore(def);
      expect(g.state.status).toBe('playing');
      expect(g.preview().length).toBe(def.cats.length);
    }
  });
});
