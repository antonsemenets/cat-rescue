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

describe('cat AI — special traits', () => {
  const MAP = ['.......', '.......', '.......', '.......', '.......'];

  it('a slow cat (pace 2) steps only every second turn', () => {
    let s = state({ map: MAP, cats: [catDef('slow', [0, 2], { hunger: 0 }, { patrol: [[0, 2], [6, 2]], pace: 2 })] });
    const xs: number[] = [];
    for (let i = 0; i < 6; i++) {
      s = step(s, { type: 'wait' }).state;
      xs.push(catOf(s, 'slow').pos.x);
    }
    expect(xs).toEqual([1, 1, 2, 2, 3, 3]);
    expect(catOf(s, 'slow').activity).toBe('rest');
  });

  it('an independent cat ignores food pushed under its nose but finds it from afar', () => {
    const near = state({ map: MAP, cats: [catDef('proud', [3, 2], { hunger: 2 }, { minNotice: 3 })] });
    near.foods.push({ id: 'f', kind: 'kibble', cell: { x: 4, y: 2 }, ttl: 9 });
    expect(planIntents(near)[0].target?.kind).not.toBe('food');

    const far = state({ map: MAP, cats: [catDef('proud', [0, 2], { hunger: 2 }, { minNotice: 3 })] });
    far.foods.push({ id: 'f', kind: 'kibble', cell: { x: 3, y: 2 }, ttl: 9 });
    expect(planIntents(far)[0].target?.id).toBe('f');
    // once noticed it keeps going even when it gets close
    let s = step(far, { type: 'wait' }).state;
    expect(catOf(s, 'proud').target?.id).toBe('f');
    s = step(s, { type: 'wait' }).state;
    expect(catOf(s, 'proud').target?.id).toBe('f');
  });

  it('a picky eater ignores everything but its favourite food', () => {
    const s = state({ map: MAP, cats: [catDef('picky', [3, 2], { hunger: 3 }, { preferredFood: 'tuna', picky: true })] });
    s.foods.push({ id: 'k', kind: 'kibble', cell: { x: 4, y: 2 }, ttl: 9 });
    expect(planIntents(s)[0].target?.kind).not.toBe('food');
    s.foods.push({ id: 't', kind: 'tuna', cell: { x: 0, y: 2 }, ttl: 9 });
    expect(planIntents(s)[0].target?.id).toBe('t');
  });

  it('a kitten trails its mother and waits beside her trap', () => {
    let s = state({
      map: ['.........', '.........', '.........'],
      cats: [catDef('mum', [2, 1], { hunger: 0 }, { patrol: [[2, 1], [8, 1]] }), catDef('kit', [0, 1], { hunger: 0 }, { follows: 'mum' })],
    });
    const gaps: number[] = [];
    for (let i = 0; i < 6; i++) {
      s = step(s, { type: 'wait' }).state;
      gaps.push(catOf(s, 'mum').pos.x - catOf(s, 'kit').pos.x);
    }
    expect(Math.max(...gaps)).toBeLessThanOrEqual(3);
    expect(catOf(s, 'kit').target?.kind).toBe('follow');

    // mum sits in a trap at the far end: the kitten comes over and stays close
    s = state({
      map: ['.........', '.........', '.........'],
      cats: [catDef('mum', [8, 0], { hunger: 0 }), catDef('kit', [0, 1], { hunger: 0 }, { follows: 'mum' })],
      traps: [{ id: 't', pos: [8, 1], dir: 'W' }],
    });
    s.cats[0].pos = { x: 8, y: 1 };
    s.cats[0].mode = 'trapped';
    s.cats[0].trappedIn = 't';
    s.traps[0].occupiedBy = 'mum';
    s = play(s, waits(12)).state;
    const kit = catOf(s, 'kit');
    expect(Math.min(Math.abs(kit.pos.x - 8), Math.abs(kit.pos.x - 7)) + Math.abs(kit.pos.y - 1)).toBeLessThanOrEqual(2);
    expect(kit.activity).not.toBe('walk');
  });

  it('a kitten never blocks its mother in a narrow corridor', () => {
    // 1-wide shaded corridor; mum patrols back and forth, the kitten rests behind her
    let s = state({
      map: ['#########', '.........', '#########'],
      cats: [catDef('mum', [4, 1], { hunger: 0, fear: 2 }, { patrol: [[7, 1], [1, 1]] }), catDef('kit', [3, 1], { hunger: 0 }, { follows: 'mum' })],
    });
    const xs: number[] = [];
    for (let i = 0; i < 24; i++) {
      s = step(s, { type: 'wait' }).state;
      xs.push(catOf(s, 'mum').pos.x);
    }
    // she reaches both ends of her patrol
    expect(Math.max(...xs)).toBe(7);
    expect(Math.min(...xs)).toBe(1);
  });
});
