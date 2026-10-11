import { describe, expect, it } from 'vitest';
import { cloneState, runTurn, isTurnError } from '../src/core/turnSystem';
import { RULES } from '../src/core/rules';
import type { Action, GameState } from '../src/core/types';
import { LEVELS } from '../src/levels';
import { createInitialState, solutionToActions } from '../src/core/level';
import { catDef, catOf, play, state, step, waits } from './helpers';

const OPEN = ['.......', '.......', '.......', '.......', '.......'];

function strip(s: GameState) {
  // compare simulation-relevant data, independent of array order
  const cats = [...s.cats].sort((a, b) => (a.id < b.id ? -1 : 1));
  return { ...s, cats };
}

describe('turn processing', () => {
  it('is fully deterministic — same actions, same result', () => {
    for (const def of LEVELS) {
      const acts = solutionToActions(def.solution);
      const run = () => {
        let s = createInitialState(def);
        const log: unknown[] = [];
        for (const a of acts) {
          const r = runTurn(s, a);
          if (isTurnError(r)) break;
          s = r.state;
          log.push(r.events);
          if (s.status === 'won') break;
        }
        return { s, log };
      };
      expect(run()).toEqual(run());
    }
  });

  it('does not depend on the order of cats in the array', () => {
    for (const def of LEVELS.filter((l) => l.cats.length > 1)) {
      const acts = solutionToActions(def.solution);
      let a = createInitialState(def);
      let b = createInitialState(def);
      b.cats.reverse();
      for (const act of acts) {
        const ra = runTurn(a, act);
        const rb = runTurn(b, act);
        if (isTurnError(ra) || isTurnError(rb)) break;
        a = ra.state;
        b = rb.state;
        expect(strip(b)).toEqual(strip(a));
        if (a.status === 'won') break;
      }
    }
  });

  it('never mutates the input state', () => {
    const s = createInitialState(LEVELS[0]);
    const before = JSON.stringify(s);
    runTurn(s, { type: 'placeFood', kind: 'kibble', cell: { x: 2, y: 3 } });
    expect(JSON.stringify(s)).toBe(before);
  });

  it('an invalid action is rejected and does not consume a turn', () => {
    const s = state({ map: OPEN, cats: [catDef('a', [0, 0])], inventory: { kibble: 0 } });
    const r = runTurn(s, { type: 'placeFood', kind: 'kibble', cell: { x: 3, y: 3 } });
    expect(isTurnError(r)).toBe(true);
    expect(s.turn).toBe(0);
  });

  it('every successful action consumes exactly one turn', () => {
    let s = state({ map: OPEN, cats: [catDef('a', [0, 0], { hunger: 0 })], inventory: { box: 1 } });
    s = step(s, { type: 'placeBox', cell: { x: 4, y: 4 } }).state;
    expect(s.turn).toBe(1);
    s = step(s, { type: 'wait' }).state;
    expect(s.turn).toBe(2);
  });

  it('consumes resources and counts them as used', () => {
    let s = state({ map: OPEN, cats: [catDef('a', [0, 0], { hunger: 0 })], inventory: { kibble: 2, toy: 1, box: 1 } });
    s = step(s, { type: 'placeFood', kind: 'kibble', cell: { x: 5, y: 4 } }).state;
    s = step(s, { type: 'placeToy', cell: { x: 6, y: 4 } }).state;
    expect(s.inventory.kibble).toBe(1);
    expect(s.inventory.toy).toBe(0);
    expect(s.used.kibble).toBe(1);
    expect(s.used.toy).toBe(1);
    expect(runTurn(s, { type: 'placeToy', cell: { x: 6, y: 3 } })).toEqual({ error: 'Игрушки закончились' });
  });

  it('ground food goes stale after its time-to-live', () => {
    let s = state({ map: OPEN, cats: [catDef('a', [0, 0], { hunger: 0 })], inventory: { kibble: 1 } });
    s = step(s, { type: 'placeFood', kind: 'kibble', cell: { x: 6, y: 4 } }).state;
    s = play(s, waits(RULES.foodTtl - 2)).state;
    expect(s.foods.length).toBe(1);
    s = step(s, { type: 'wait' }).state;
    expect(s.foods.length).toBe(0);
  });

  it('eating ground food lowers hunger and raises trust', () => {
    let s = state({ map: OPEN, cats: [catDef('a', [0, 2], { hunger: 2, trust: 0 })], inventory: { kibble: 1 } });
    s = step(s, { type: 'placeFood', kind: 'kibble', cell: { x: 2, y: 2 } }).state;
    s = step(s, { type: 'wait' }).state;
    const c = catOf(s, 'a');
    expect(c.hunger).toBe(1);
    expect(c.trust).toBe(1);
    expect(s.foods.length).toBe(0);
  });

  it('resolves two cats wanting the same cell without depending on array order', () => {
    // both cats are one step from the food cell, from opposite sides
    const make = (rev: boolean) => {
      const s = state({ map: OPEN, cats: [catDef('a', [1, 2], { hunger: 3 }), catDef('b', [3, 2], { hunger: 3 })] });
      s.foods.push({ id: 'f', kind: 'kibble', cell: { x: 2, y: 2 }, ttl: 5 });
      if (rev) s.cats.reverse();
      return step(s, { type: 'wait' });
    };
    const r1 = make(false);
    const r2 = make(true);
    const eaten1 = r1.events.find((e) => e.type === 'catEat');
    const eaten2 = r2.events.find((e) => e.type === 'catEat');
    expect(eaten1).toEqual(eaten2);
    expect(r1.events.filter((e) => e.type === 'catBlocked').length).toBe(1);
    const posA = catOf(r1.state, 'a').pos;
    const posB = catOf(r1.state, 'b').pos;
    expect(posA).not.toEqual(posB);
  });

  it('cats never swap places through each other', () => {
    const s = state({
      map: ['#######', '.......', '#######'],
      cats: [catDef('a', [2, 1], { hunger: 0 }, { patrol: [[2, 1], [5, 1]] }), catDef('b', [3, 1], { hunger: 0 }, { patrol: [[3, 1], [0, 1]] })],
    });
    const r = step(s, { type: 'wait' });
    expect(catOf(r.state, 'a').pos).toEqual({ x: 2, y: 1 });
    expect(catOf(r.state, 'b').pos).toEqual({ x: 3, y: 1 });
  });

  it('a spring gate shuts by itself and blocks the way', () => {
    let s = state({
      map: ['..F..', '..G..', '..F..'],
      cats: [catDef('a', [0, 0], { hunger: 0 })],
      gates: [{ id: 'g', pos: [2, 1], autoClose: 2 }],
    });
    s = step(s, { type: 'interact', objectId: 'g' }).state;
    expect(s.gates[0].open).toBe(true);
    s = step(s, { type: 'wait' }).state;
    expect(s.gates[0].open).toBe(false);
  });

  it('cloneState creates an independent copy', () => {
    const s = createInitialState(LEVELS[0]);
    const c = cloneState(s);
    c.cats[0].pos.x = 99;
    expect(s.cats[0].pos.x).not.toBe(99);
  });

  it('wins when all required cats are trapped', () => {
    const def = LEVELS[0];
    let s = createInitialState(def);
    const acts: Action[] = solutionToActions(def.solution);
    s = play(s, acts).state;
    expect(s.status).toBe('won');
    expect(s.rescued).toEqual(['ryzhik']);
  });
});
