// World queries shared by every system: what stands on a cell, can a cat step
// from A to B, which cells are covered, which are inside a noise zone.

import { add, DIRS, eq, idx, inBounds, manhattan } from './grid';
import type { Cat, Cell, Feature, Food, GameState, Gate, Noise, Toy, Trap, Box } from './types';

const SOLID_FEATURES: ReadonlySet<Feature> = new Set(['wall', 'fence', 'tree', 'rock', 'crate', 'shed', 'water']);
const COVER_FEATURES: ReadonlySet<Feature> = new Set(['wall', 'fence', 'tree', 'rock', 'crate', 'shed', 'bush', 'den']);
const HIDING_FEATURES: ReadonlySet<Feature> = new Set(['bush', 'den']);

export function featureAt(s: GameState, c: Cell): Feature | null {
  if (!inBounds(c, s.width, s.height)) return null;
  return s.features[idx(c, s.width)];
}

export function isSolidFeature(f: Feature | null): boolean {
  return !!f && SOLID_FEATURES.has(f);
}

export function gateAt(s: GameState, c: Cell): Gate | undefined {
  return s.gates.find((g) => eq(g.cell, c));
}

export function noiseAt(s: GameState, c: Cell): Noise | undefined {
  return s.noises.find((n) => eq(n.cell, c));
}

export function foodAt(s: GameState, c: Cell): Food | undefined {
  return s.foods.find((f) => eq(f.cell, c));
}

export function boxAt(s: GameState, c: Cell): Box | undefined {
  return s.boxes.find((b) => eq(b.cell, c));
}

export function toyAt(s: GameState, c: Cell): Toy | undefined {
  return s.toys.find((t) => eq(t.cell, c));
}

export function catAt(s: GameState, c: Cell): Cat | undefined {
  return s.cats.find((k) => k.mode !== 'trapped' && eq(k.pos, c));
}

// ---------------------------------------------------------------------------
// Traps

export function trapFront(t: Pick<Trap, 'back' | 'dir'>): Cell {
  return add(t.back, t.dir);
}

/** The outside cell a cat must stand on to walk into the trap. */
export function trapApproach(t: Pick<Trap, 'back' | 'dir'>): Cell {
  return add(t.back, t.dir, 2);
}

export function trapCells(t: Pick<Trap, 'back' | 'dir'>): [Cell, Cell] {
  return [t.back, trapFront(t)];
}

export interface TrapHit {
  trap: Trap;
  part: 'front' | 'back';
}

export function trapAt(s: GameState, c: Cell): TrapHit | undefined {
  for (const trap of s.traps) {
    if (eq(trap.back, c)) return { trap, part: 'back' };
    if (eq(trapFront(trap), c)) return { trap, part: 'front' };
  }
  return undefined;
}

export function catsInsideTrap(s: GameState, t: Trap): Cat[] {
  const [b, f] = trapCells(t);
  return s.cats.filter((k) => eq(k.pos, b) || eq(k.pos, f));
}

// ---------------------------------------------------------------------------
// Passability

/** Cell blocked for walking regardless of where you come from. */
export function isBlocked(s: GameState, c: Cell): boolean {
  if (!inBounds(c, s.width, s.height)) return true;
  if (isSolidFeature(featureAt(s, c))) return true;
  const gate = gateAt(s, c);
  if (gate && !gate.open) return true;
  if (noiseAt(s, c)) return true;
  return false;
}

/**
 * Can a cat move from `from` to the adjacent cell `to`?
 * Trap rules: the front cell may only be entered from the approach cell,
 * the back cell only from the front cell, and a cat inside the trap can only
 * go deeper or back out through the entrance. Side walls are solid.
 */
export function canStep(s: GameState, from: Cell, to: Cell): boolean {
  if (isBlocked(s, to)) return false;
  const fromTrap = trapAt(s, from);
  const toTrap = trapAt(s, to);

  if (fromTrap) {
    const t = fromTrap.trap;
    if (fromTrap.part === 'back') return false;
    // from front: only to back or to approach
    if (toTrap && toTrap.trap === t && toTrap.part === 'back') return t.occupiedBy === null;
    return !toTrap && eq(to, trapApproach(t));
  }

  if (toTrap) {
    const t = toTrap.trap;
    if (t.occupiedBy !== null) return false;
    if (toTrap.part === 'front') return eq(from, trapApproach(t));
    return false; // back cell only reachable from front (handled above)
  }
  return true;
}

// ---------------------------------------------------------------------------
// Cover ("shade") and danger maps

/** Things that cast cover on themselves and their 4 neighbours. */
export function castsCover(s: GameState, c: Cell): boolean {
  const f = featureAt(s, c);
  if (f && COVER_FEATURES.has(f)) return true;
  if (gateAt(s, c)) return true;
  if (noiseAt(s, c)) return true;
  if (boxAt(s, c)) return true;
  return false;
}

export function isHidingSpot(s: GameState, c: Cell): boolean {
  const f = featureAt(s, c);
  if (f && HIDING_FEATURES.has(f)) return true;
  return !!boxAt(s, c);
}

/** covered[i] === true means the cell is in shade: shy cats feel safe there. */
export function computeCover(s: GameState): boolean[] {
  const out = new Array<boolean>(s.width * s.height).fill(false);
  const casters: boolean[] = new Array<boolean>(s.width * s.height).fill(false);
  for (let y = 0; y < s.height; y++) {
    for (let x = 0; x < s.width; x++) {
      casters[y * s.width + x] = castsCover(s, { x, y });
    }
  }
  for (let y = 0; y < s.height; y++) {
    for (let x = 0; x < s.width; x++) {
      const c = { x, y };
      const i = y * s.width + x;
      if (casters[i] || trapAt(s, c)) {
        out[i] = true;
        continue;
      }
      for (const d of DIRS) {
        const n = add(c, d);
        if (inBounds(n, s.width, s.height) && casters[n.y * s.width + n.x]) {
          out[i] = true;
          break;
        }
      }
    }
  }
  return out;
}

export function isNoiseActiveAt(n: Noise, turn: number): boolean {
  if (n.manualRemaining > 0) return true;
  const sch = n.schedule;
  if (!sch || turn < sch.start) return false;
  const since = turn - sch.start;
  if (sch.every && sch.every > 0) return since % sch.every < sch.duration;
  return since < sch.duration;
}

export function computeDanger(s: GameState): boolean[] {
  const out = new Array<boolean>(s.width * s.height).fill(false);
  for (const n of s.noises) {
    if (!n.active) continue;
    for (let y = 0; y < s.height; y++) {
      for (let x = 0; x < s.width; x++) {
        if (manhattan(n.cell, { x, y }) <= n.radius) out[y * s.width + x] = true;
      }
    }
  }
  return out;
}

/** Turns until the next scheduled activation (0 = active now, null = never). */
export function turnsUntilNoise(n: Noise, currentTurn: number): number | null {
  if (n.active) return 0;
  const sch = n.schedule;
  if (!sch) return null;
  for (let t = currentTurn + 1; t <= currentTurn + 60; t++) {
    if (isNoiseActiveAt({ ...n, manualRemaining: 0 }, t)) return t - currentTurn;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Placement helpers

/** Plain empty ground: no feature, entity, cat, trap. */
export function isEmptyGround(s: GameState, c: Cell): boolean {
  if (!inBounds(c, s.width, s.height)) return false;
  if (featureAt(s, c)) return false;
  if (gateAt(s, c) || noiseAt(s, c)) return false;
  if (trapAt(s, c)) return false;
  if (foodAt(s, c) || boxAt(s, c) || toyAt(s, c)) return false;
  if (catAt(s, c)) return false;
  return true;
}
