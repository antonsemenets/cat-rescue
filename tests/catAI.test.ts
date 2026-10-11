import { describe, expect, it } from 'vitest';
import { planIntents } from '../src/core/catAI';
import { catDef, catOf, play, state, step, waits } from './helpers';

const OPEN7 = ['.......', '.......', '.......', '.......', '.......', '.......', '.......'];

describe('cat AI — target selection', () => {
  it('goes for the closer food when both are equally attractive', () => {
    let s = state({ map: OPEN7, cats: [catDef('a', [3, 3], { hunger: 3 })], inventory: { kibble: 2 } });
    s = step(s, { type: 'placeFood', kind: 'kibble', cell: { x: 0, y: 3 } }).state; // dist 2 after the cat moved? cat decides after placement
    const r = step(s, { type: 'placeFood', kind: 'kibble', cell: { x: 6, y: 3 } });
    const cat = catOf(r.state, 'a');
    expect(cat.target?.cell).toEqual({ x: 0, y: 3 });
  });

  it('prefers its favourite food', () => {
    let s = state({ map: OPEN7, cats: [catDef('a', [3, 3], { hunger: 2 }, { preferredFood: 'tuna' })], inventory: { kibble: 1, tuna: 1 } });
    s = step(s, { type: 'placeFood', kind: 'kibble', cell: { x: 2, y: 3 } }).state;
    // cat already walked onto kibble? kibble was 1 step away — it ate it. Use a fresh layout instead:
    s = state({ map: OPEN7, cats: [catDef('a', [3, 3], { hunger: 2 }, { preferredFood: 'tuna' })], inventory: { kibble: 1, tuna: 1 } });
    const intents = (() => {
      s.foods.push({ id: 'k', kind: 'kibble', cell: { x: 1, y: 3 }, ttl: 5 });
      s.foods.push({ id: 't', kind: 'tuna', cell: { x: 6, y: 3 }, ttl: 5 });
      return planIntents(s);
    })();
    expect(intents[0].target?.id).toBe('t');
  });

  it('a cat with hunger 0 ignores food entirely', () => {
    const s = state({ map: OPEN7, cats: [catDef('a', [3, 3], { hunger: 0 })] });
    s.foods.push({ id: 'k', kind: 'kibble', cell: { x: 3, y: 4 }, ttl: 5 });
    const [it] = planIntents(s);
    expect(it.target?.kind).not.toBe('food');
    expect(it.activity).toBe('sleep');
  });

  it('only notices food inside its scent radius (hunger + 1, tuna +2)', () => {
    const s = state({ map: OPEN7, cats: [catDef('a', [0, 0], { hunger: 1 })] });
    s.foods.push({ id: 'k', kind: 'kibble', cell: { x: 3, y: 0 }, ttl: 5 }); // dist 3 > 2
    expect(planIntents(s)[0].target?.kind).not.toBe('food');
    s.foods.push({ id: 't', kind: 'tuna', cell: { x: 4, y: 0 }, ttl: 5 }); // dist 4 <= 4
    expect(planIntents(s)[0].target?.id).toBe('t');
  });

  it('curious cats choose an active toy over food', () => {
    const s = state({ map: OPEN7, cats: [catDef('a', [3, 3], { hunger: 1, curiosity: 3 })] });
    s.foods.push({ id: 'k', kind: 'kibble', cell: { x: 3, y: 4 }, ttl: 5 });
    s.toys.push({ id: 'toy', cell: { x: 3, y: 0 }, ttl: 5 });
    expect(planIntents(s)[0].target?.id).toBe('toy');
  });

  it('keeps going for a target it has noticed even past the scent radius edge', () => {
    let s = state({ map: OPEN7, cats: [catDef('a', [0, 3], { hunger: 1 })], inventory: { kibble: 1 } });
    s = step(s, { type: 'placeFood', kind: 'kibble', cell: { x: 2, y: 3 } }).state;
    expect(catOf(s, 'a').target?.kind).toBe('food');
  });

  it('idle cats follow their patrol route', () => {
    let s = state({ map: OPEN7, cats: [catDef('a', [0, 0], {}, { patrol: [[0, 0], [0, 3]] })] });
    s = play(s, waits(3)).state;
    expect(catOf(s, 'a').pos).toEqual({ x: 0, y: 3 });
    s = play(s, waits(3)).state;
    expect(catOf(s, 'a').pos).toEqual({ x: 0, y: 0 });
  });
});

describe('cat AI — fear', () => {
  const MAP = ['.......', '.......', '.......', '.......', '.......', '.......', '.....B.'];

  it('noise frightens nearby cats, they flee to a hiding spot and hide', () => {
    let s = state({
      map: MAP,
      cats: [catDef('a', [1, 1], { fear: 2 })],
      noises: [{ id: 'n', kind: 'mower', pos: [0, 0], radius: 3, schedule: { start: 1, duration: 1 } }],
    });
    const r = step(s, { type: 'wait' });
    s = r.state;
    expect(catOf(s, 'a').mode).toBe('frightened');
    expect(r.events.some((e) => e.type === 'emote' && e.emote === 'alert')).toBe(true);
    expect(catOf(s, 'a').target?.cell).toEqual({ x: 5, y: 6 });
    s = play(s, waits(10)).state;
    const cat = catOf(s, 'a');
    expect(cat.pos).toEqual({ x: 5, y: 6 });
  });

  it('a hiding cat stays put for fear + 1 turns and then calms down', () => {
    let s = state({
      map: MAP,
      cats: [catDef('a', [4, 6], { fear: 2 })],
      noises: [{ id: 'n', kind: 'mower', pos: [3, 5], radius: 1, schedule: { start: 1, duration: 1 } }],
    });
    s = step(s, { type: 'wait' }).state; // (4,6) is within radius 1 of (3,5)? dist 2 — no
    expect(catOf(s, 'a').mode).toBe('idle');
    s = state({
      map: MAP,
      cats: [catDef('a', [4, 5], { fear: 2 })],
      noises: [{ id: 'n', kind: 'mower', pos: [3, 5], radius: 1, schedule: { start: 1, duration: 1 } }],
    });
    s = step(s, { type: 'wait' }).state; // flees
    s = step(s, { type: 'wait' }).state; // reaches bush (5,6)? path (5,5)->(5,6)
    let guard = 0;
    while (catOf(s, 'a').mode !== 'hiding' && guard++ < 5) s = step(s, { type: 'wait' }).state;
    expect(catOf(s, 'a').mode).toBe('hiding');
    expect(catOf(s, 'a').timer).toBe(3);
    s = play(s, waits(2)).state;
    expect(catOf(s, 'a').mode).toBe('hiding');
    s = step(s, { type: 'wait' }).state;
    expect(catOf(s, 'a').mode).toBe('idle');
  });

  it('brave cats (fear 0) ignore noise', () => {
    let s = state({
      map: MAP,
      cats: [catDef('a', [1, 1], { fear: 0 })],
      noises: [{ id: 'n', kind: 'mower', pos: [0, 0], radius: 3, schedule: { start: 1, duration: 3 } }],
    });
    s = step(s, { type: 'wait' }).state;
    expect(catOf(s, 'a').mode).not.toBe('frightened');
  });

  it('fearful cats hesitate at the trap door until trust catches up', () => {
    let s = state({
      map: ['.....', '.....', '.....'],
      cats: [catDef('a', [4, 1], { fear: 3, trust: 1, hunger: 3 })],
      traps: [{ id: 't', pos: [1, 1], dir: 'E', bait: 'kibble' }], // approach (3,1)
    });
    // map has no cover: give the cat fear-3 shade by using a wall row? keep fear 3 but the
    // approach and the cat cell must be shaded — place walls above
    s = state({
      map: ['#####', '.....', '.....'],
      cats: [catDef('a', [4, 1], { fear: 3, trust: 1, hunger: 3 })],
      traps: [{ id: 't', pos: [1, 1], dir: 'E', bait: 'kibble' }],
    });
    s = step(s, { type: 'wait' }).state; // -> (3,1)
    expect(catOf(s, 'a').pos).toEqual({ x: 3, y: 1 });
    const r1 = step(s, { type: 'wait' });
    expect(catOf(r1.state, 'a').mode).toBe('cautious');
    expect(catOf(r1.state, 'a').trust).toBe(2);
    const r2 = step(r1.state, { type: 'wait' });
    expect(catOf(r2.state, 'a').trust).toBe(3);
    s = play(r2.state, waits(2)).state;
    expect(catOf(s, 'a').mode).toBe('trapped');
  });
});
