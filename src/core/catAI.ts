// CatAI — small deterministic utility AI.
//
// Every cat decides from the same immutable snapshot of the world, so the
// result never depends on the order of cats in the array. Priorities:
//   1. escape a threat (noise)            -> frightened, run to a hiding spot
//   2. stay hidden until calm             -> hiding
//   3. best of food / toys (utility)      -> interested (or cautious at a trap door)
//   4. habitual activity (follow mum / patrol / home) -> idle

import { compareCells, compareStr, eq, idx, inBounds, manhattan, DIRS, add } from './grid';
import { buildCostMap, costTo, pathTo, type CostMap, type StepCost } from './pathfinding';
import { FOOD_INFO, RULES, foodNoticeRadius, hideDuration, toyNoticeRadius } from './rules';
import type { Cat, CatActivity, CatMode, Cell, Emote, FoodKind, GameState, Target } from './types';
import { canStep, computeCover, computeDanger, isHidingSpot, trapAt, trapApproach, trapCells, catsInsideTrap } from './world';

export interface Snapshot {
  s: GameState;
  cover: boolean[];
  danger: boolean[];
}

export function makeSnapshot(s: GameState): Snapshot {
  return { s, cover: computeCover(s), danger: computeDanger(s) };
}

export interface Intent {
  catId: string;
  mode: CatMode;
  activity: CatActivity;
  target: Target | null;
  /** full planned route (exclusive of current cell) — used for previews */
  path: Cell[];
  /** the single step the cat wants to take this turn */
  move: Cell | null;
  emotes: Emote[];
  trustGain: number;
  patrolIndex: number;
  timer: number;
  /** was already hiding at the start of the turn (timer ticks down) */
  hideStay: boolean;
  /** reached a hiding spot this turn without moving */
  startsHiding: boolean;
  /** priority used for movement conflicts (lower = earlier) */
  priority: number;
  remaining: number;
}

export interface CostOptions {
  /** may the route enter trap cells? Only routes to bait inside a trap do. */
  traps?: boolean;
}

export function catStepCost(snap: Snapshot, cat: Cat, opts: CostOptions = {}): StepCost {
  const { s, cover, danger } = snap;
  const allowTraps = opts.traps !== false;
  // cells held by other cats are costly (not blocked): cats walk around a dozing neighbour
  const others = new Set(s.cats.filter((k) => k.id !== cat.id && k.mode !== 'trapped').map((k) => k.pos.y * s.width + k.pos.x));
  return (from: Cell, to: Cell) => {
    if (!canStep(s, from, to)) return Infinity;
    if (!allowTraps && trapAt(s, to)) return Infinity;
    let c: number = RULES.stepCost;
    const i = idx(to, s.width);
    if (others.has(i)) c += RULES.crowdPenalty;
    if (!cover[i]) {
      const p = RULES.openPenalty[Math.max(0, Math.min(3, cat.fear))];
      if (!Number.isFinite(p)) return Infinity;
      c += p;
    }
    if (danger[i]) c += cat.fear >= 1 ? RULES.dangerPenaltyShy : RULES.dangerPenaltyBrave;
    return c;
  };
}

function idHash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 9973;
  return h;
}

export function restActivity(s: GameState, cat: Cat): CatActivity {
  if (cat.hunger <= 0) return 'sleep';
  return (s.turn + idHash(cat.id)) % 5 === 4 ? 'groom' : 'sit';
}

interface Candidate {
  kind: 'food' | 'toy';
  id: string;
  cell: Cell;
  utility: number;
  cost: number;
  inTrap: boolean;
}

export interface FoodSpot {
  id: string;
  kind: FoodKind;
  cell: Cell;
  inTrap: string | null;
}

/** All food a cat could go for: ground food and bait inside free traps. */
export function foodSpots(s: GameState): FoodSpot[] {
  const out: FoodSpot[] = s.foods.map((f) => ({ id: f.id, kind: f.kind, cell: f.cell, inTrap: null }));
  for (const t of s.traps) {
    if (t.bait && t.occupiedBy === null) out.push({ id: `bait:${t.id}`, kind: t.bait, cell: t.back, inTrap: t.id });
  }
  return out;
}

function evaluateCandidates(snap: Snapshot, cat: Cat, map: CostMap): Candidate[] {
  const { s } = snap;
  const out: Candidate[] = [];
  const commit = (id: string) => (cat.target && cat.target.id === id ? RULES.commitBonus : 0);

  if (cat.hunger >= 1) {
    for (const f of foodSpots(s)) {
      // a picky eater does not even look at anything but its favourite
      if (cat.picky && f.kind !== cat.preferredFood) continue;
      // once a cat has smelled its target it keeps going for it (no flip-flopping at the radius edge)
      const committed = cat.target?.id === f.id;
      const dist = manhattan(cat.pos, f.cell);
      // an independent cat ignores handouts pushed right under its nose
      if (!committed && (dist > foodNoticeRadius(cat, f.kind) || dist < cat.minNotice)) continue;
      const cost = costTo(map, f.cell);
      if (!Number.isFinite(cost)) continue;
      let u: number = RULES.foodBase + RULES.foodPerHunger * cat.hunger;
      if (cat.preferredFood === f.kind) u += RULES.preferredBonus;
      if (f.kind === 'tuna') u += RULES.tunaBonus;
      if (f.inTrap) u -= RULES.trapDistrust * Math.max(0, cat.fear - cat.trust);
      u -= Math.floor(cost / RULES.costDivisor);
      u += commit(f.id);
      out.push({ kind: 'food', id: f.id, cell: f.cell, utility: u, cost, inTrap: !!f.inTrap });
    }
  }
  if (cat.curiosity >= 1) {
    for (const t of s.toys) {
      const committed = cat.target?.id === t.id;
      if (!committed && manhattan(cat.pos, t.cell) > toyNoticeRadius(cat)) continue;
      const cost = costTo(map, t.cell);
      if (!Number.isFinite(cost)) continue;
      let u: number = RULES.toyBase + RULES.toyPerCuriosity * cat.curiosity;
      u -= Math.floor(cost / RULES.costDivisor);
      u += commit(t.id);
      out.push({ kind: 'toy', id: t.id, cell: t.cell, utility: u, cost, inTrap: false });
    }
  }
  return out.filter((c) => c.utility > 0);
}

function pickBest(cands: Candidate[]): Candidate | null {
  if (cands.length === 0) return null;
  const sorted = [...cands].sort(
    (a, b) =>
      b.utility - a.utility ||
      a.cost - b.cost ||
      (a.kind === b.kind ? 0 : a.kind === 'food' ? -1 : 1) ||
      compareStr(a.id, b.id),
  );
  return sorted[0];
}

function inDanger(snap: Snapshot, c: Cell): boolean {
  return snap.danger[idx(c, snap.s.width)];
}

function baseIntent(cat: Cat): Intent {
  return {
    catId: cat.id,
    mode: cat.mode,
    activity: 'sit',
    target: cat.target,
    path: [],
    move: null,
    emotes: [],
    trustGain: 0,
    patrolIndex: cat.patrolIndex,
    timer: cat.timer,
    hideStay: false,
    startsHiding: false,
    priority: 5,
    remaining: 0,
  };
}

/** Decide what a single cat wants to do this turn, from the snapshot. */
export function decideCat(snap: Snapshot, cat: Cat): Intent {
  const { s } = snap;
  const it = baseIntent(cat);
  if (cat.mode === 'trapped') {
    it.activity = 'trapped';
    it.target = null;
    return it;
  }

  // `map` may lead into traps (for bait); `safe` never does (patrol, home, hiding)
  const map = buildCostMap(s.width, s.height, cat.pos, catStepCost(snap, cat));
  const safe = buildCostMap(s.width, s.height, cat.pos, catStepCost(snap, cat, { traps: false }));
  const threatened = cat.fear >= 1 && inDanger(snap, cat.pos);

  // 1. Threat — flee to the nearest safe hiding spot.
  if (threatened || cat.mode === 'frightened') {
    const wasCalm = cat.mode !== 'frightened';
    if (isHidingSpot(s, cat.pos) && !inDanger(snap, cat.pos)) {
      it.mode = 'hiding';
      it.activity = 'hide';
      it.timer = hideDuration(cat);
      it.target = { kind: 'hide', cell: cat.pos };
      it.startsHiding = true;
      return it;
    }
    const occupied = (c: Cell) => s.cats.some((k) => k.id !== cat.id && k.mode !== 'trapped' && eq(k.pos, c));
    let best: { cell: Cell; cost: number } | null = null;
    for (let y = 0; y < s.height; y++) {
      for (let x = 0; x < s.width; x++) {
        const c = { x, y };
        if (!isHidingSpot(s, c) || inDanger(snap, c) || occupied(c)) continue;
        const cost = costTo(safe, c);
        if (!Number.isFinite(cost)) continue;
        if (!best || cost < best.cost || (cost === best.cost && compareCells(c, best.cell) < 0)) best = { cell: c, cost };
      }
    }
    it.mode = 'frightened';
    it.priority = 0;
    if (wasCalm) it.emotes.push('alert');
    if (best) {
      const path = pathTo(safe, best.cell) ?? [];
      it.target = { kind: 'hide', cell: best.cell };
      it.path = path;
      it.move = path[0] ?? null;
      it.activity = it.move ? 'walk' : 'scared';
      it.remaining = path.length;
      return it;
    }
    // No hiding spot reachable: step away from the noise if possible.
    if (threatened) {
      const flee = fleeStep(snap, cat);
      it.target = flee ? { kind: 'flee', cell: flee } : null;
      it.path = flee ? [flee] : [];
      it.move = flee;
      it.activity = flee ? 'walk' : 'scared';
      it.remaining = flee ? 1 : 0;
      return it;
    }
    // Threat is over and nowhere to hide: crouch in place until calm.
    it.mode = 'hiding';
    it.activity = 'hide';
    it.timer = hideDuration(cat);
    it.target = { kind: 'hide', cell: cat.pos };
    it.startsHiding = true;
    return it;
  }

  // 2. Hiding — wait until calm.
  if (cat.mode === 'hiding' && cat.timer > 0) {
    it.activity = 'hide';
    it.hideStay = true;
    it.target = { kind: 'hide', cell: cat.pos };
    return it;
  }

  // 3. Food and toys.
  const best = pickBest(evaluateCandidates(snap, cat, map));
  if (best) {
    const path = pathTo(map, best.cell) ?? [];
    const isNew = !cat.target || cat.target.id !== best.id;
    it.target = { kind: best.kind, id: best.id, cell: best.cell };
    it.path = path;
    it.remaining = path.length;
    it.priority = 2;
    if (path.length === 0) {
      // already there (toy under the paws)
      it.mode = 'interested';
      it.activity = best.kind === 'toy' ? 'play' : 'eat';
      return it;
    }
    const next = path[0];
    const nextTrap = trapAt(s, next);
    // queue politely: never block the doorway while another cat is inside the trap
    const after = path[1] ? trapAt(s, path[1]) : undefined;
    if (!nextTrap && after && after.part === 'front' && eq(next, trapApproach(after.trap)) && catsInsideTrap(s, after.trap).some((k) => k.id !== cat.id)) {
      it.mode = 'interested';
      it.activity = 'sit';
      return it;
    }
    if (nextTrap && nextTrap.part === 'front' && eq(cat.pos, trapApproach(nextTrap.trap))) {
      const others = catsInsideTrap(s, nextTrap.trap).filter((k) => k.id !== cat.id);
      if (others.length > 0) {
        // standing in the doorway: step aside so the cat inside can come out
        const step = sideStep(snap, cat);
        it.mode = 'interested';
        it.activity = step ? 'walk' : 'sit';
        it.move = step;
        it.remaining = step ? 1 : 0;
        return it;
      }
      if (cat.fear > cat.trust) {
        it.mode = 'cautious';
        it.activity = 'hesitate';
        it.emotes.push('question');
        it.trustGain = 1;
        return it;
      }
    }
    it.mode = 'interested';
    it.activity = 'walk';
    it.move = next;
    if (isNew) it.emotes.push(best.kind === 'food' ? 'food' : 'toy');
    return it;
  }

  // 4. Habitual activity.
  it.mode = 'idle';
  it.priority = 4;
  const mum = cat.follows ? s.cats.find((k) => k.id === cat.follows) : undefined;
  if (mum) return followMum(snap, cat, mum, safe, it);
  if (cat.patrol.length > 0) {
    const n = cat.patrol.length;
    let pi = cat.patrolIndex % n;
    if (eq(cat.pos, cat.patrol[pi])) pi = (pi + 1) % n;
    // a waypoint that became unreachable (e.g. a trap was placed on it) is skipped
    for (let k = 0; k < n && !eq(cat.patrol[pi], cat.pos) && !pathTo(safe, cat.patrol[pi]); k++) pi = (pi + 1) % n;
    it.patrolIndex = pi;
    const goal = cat.patrol[pi];
    const path = eq(goal, cat.pos) ? [] : pathTo(safe, goal);
    it.target = { kind: 'patrol', cell: goal };
    if (path && path.length > 0) {
      it.path = path;
      it.move = path[0];
      it.activity = 'walk';
      it.remaining = path.length;
      return it;
    }
    it.activity = restActivity(s, cat);
    return it;
  }
  if (!eq(cat.pos, cat.home)) {
    const path = pathTo(safe, cat.home);
    it.target = { kind: 'home', cell: cat.home };
    if (path && path.length > 0) {
      it.path = path;
      it.move = path[0];
      it.activity = 'walk';
      it.remaining = path.length;
      return it;
    }
  }
  it.target = null;
  it.activity = restActivity(s, cat);
  return it;
}

/** Cells a kitten keeps close to: its mother, or the trap she is sitting in. */
export function followAnchors(s: GameState, mum: Cat): Cell[] {
  const trap = mum.trappedIn ? s.traps.find((t) => t.id === mum.trappedIn) : undefined;
  return trap ? trapCells(trap) : [mum.pos];
}

/** A kitten stays within the leash of its mother; when too far it walks to the nearest free cell beside her. */
function followMum(snap: Snapshot, cat: Cat, mum: Cat, safe: CostMap, it: Intent): Intent {
  const { s } = snap;
  const anchors = followAnchors(s, mum);
  it.target = { kind: 'follow', id: mum.id, cell: { ...anchors[0] } };
  // never block mum: if she is about to walk through the kitten's cell, it steps aside (or trots ahead)
  if (mum.mode !== 'trapped' && !mum.follows) {
    const route = decideCat(snap, mum).path.slice(0, 2);
    if (route.some((c) => eq(c, cat.pos))) {
      const step = makeWay(snap, cat, mum, route);
      if (step) {
        it.path = [step];
        it.move = step;
        it.activity = 'walk';
        it.remaining = 1;
        return it;
      }
    }
  }
  if (anchors.some((a) => manhattan(a, cat.pos) <= RULES.followLeash)) {
    it.activity = restActivity(s, cat);
    return it;
  }
  const taken = (c: Cell) => s.cats.some((k) => k.id !== cat.id && k.mode !== 'trapped' && eq(k.pos, c));
  let best: { cell: Cell; cost: number } | null = null;
  for (const a of anchors) {
    for (const d of DIRS) {
      const c = add(a, d);
      if (!inBounds(c, s.width, s.height) || trapAt(s, c) || taken(c)) continue;
      const cost = costTo(safe, c);
      if (!Number.isFinite(cost)) continue;
      if (!best || cost < best.cost || (cost === best.cost && compareCells(c, best.cell) < 0)) best = { cell: c, cost };
    }
  }
  const path = best ? (pathTo(safe, best.cell) ?? []) : [];
  if (path.length === 0) {
    it.activity = restActivity(s, cat);
    return it;
  }
  it.path = path;
  it.move = path[0];
  it.activity = 'walk';
  it.remaining = path.length;
  return it;
}

/** Where a kitten goes to clear its mother's way: off her route if possible, otherwise further ahead of her. */
function makeWay(snap: Snapshot, cat: Cat, mum: Cat, route: Cell[]): Cell | null {
  const { s } = snap;
  const cost = catStepCost(snap, cat, { traps: false });
  const taken = (c: Cell) => s.cats.some((k) => k.id !== cat.id && k.mode !== 'trapped' && eq(k.pos, c));
  let best: { cell: Cell; key: [number, number] } | null = null;
  for (const d of DIRS) {
    const n = add(cat.pos, d);
    if (!Number.isFinite(cost(cat.pos, n)) || taken(n)) continue;
    // 1st: stay off her next steps; 2nd: off the route — keep close, ahead of her — run further away
    const onRoute = route.some((c) => eq(c, n)) ? 1 : 0;
    const k: [number, number] = onRoute ? [1, -manhattan(n, mum.pos)] : [0, manhattan(n, mum.pos)];
    if (!best || k[0] < best.key[0] || (k[0] === best.key[0] && k[1] < best.key[1]) || (k[0] === best.key[0] && k[1] === best.key[1] && compareCells(n, best.cell) < 0)) best = { cell: n, key: k };
  }
  return best?.cell ?? null;
}

/** Step that increases distance from the nearest active noise (N,E,S,W tie order). */
function fleeStep(snap: Snapshot, cat: Cat): Cell | null {
  const { s } = snap;
  const noises = s.noises.filter((n) => n.active);
  if (noises.length === 0) return null;
  const dist = (c: Cell) => Math.min(...noises.map((n) => manhattan(n.cell, c)));
  const cost = catStepCost({ ...snap, danger: snap.danger.map(() => false) }, cat, { traps: false });
  let best: Cell | null = null;
  let bestD = dist(cat.pos);
  for (const d of DIRS) {
    const n = add(cat.pos, d);
    if (!Number.isFinite(cost(cat.pos, n))) continue;
    const dd = dist(n);
    if (dd > bestD) {
      best = n;
      bestD = dd;
    }
  }
  return best;
}

/** First free neighbour (N, E, S, W) outside any trap — used to clear a doorway. */
function sideStep(snap: Snapshot, cat: Cat): Cell | null {
  const cost = catStepCost(snap, cat, { traps: false });
  for (const d of DIRS) {
    const n = add(cat.pos, d);
    if (Number.isFinite(cost(cat.pos, n))) return n;
  }
  return null;
}

/** Intents of all cats from one snapshot — order independent. */
export function decideAll(snap: Snapshot): Intent[] {
  return snap.s.cats.map((c) => restIfTired(c, decideCat(snap, c)));
}

/** A slow cat (pace > 1) keeps its plan but catches its breath between steps. */
export function restIfTired(cat: Cat, it: Intent): Intent {
  if (cat.mode === 'trapped' || cat.cooldown <= 0 || !it.move) return it;
  return { ...it, move: null, activity: 'rest', emotes: it.emotes };
}

/** Preview helper: what each cat currently plans to do. */
export function planIntents(s: GameState): Intent[] {
  return decideAll(makeSnapshot(s));
}

export { FOOD_INFO };
