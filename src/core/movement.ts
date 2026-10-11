// Simultaneous movement resolution. Every cat declared one step from the same
// snapshot; here we decide which steps actually happen. The result is
// independent of the order of cats in the array:
//  - a step into a cell held by a cat that stays put fails
//  - two cats wanting the same cell: the one with better priority wins
//    (frightened > interested > idle, then shorter remaining route, then id)
//  - two cats swapping cells both stay
//  - only one cat may be inside a trap at a time

import { compareStr, eq, key } from './grid';
import type { Intent } from './catAI';
import type { Cat, Cell, GameState } from './types';
import { trapAt, catsInsideTrap } from './world';

export interface MoveResolution {
  moves: Map<string, Cell>;
  blocked: Set<string>;
}

function better(a: Intent, b: Intent): number {
  return a.priority - b.priority || a.remaining - b.remaining || compareStr(a.catId, b.catId);
}

export function resolveMoves(s: GameState, intents: Intent[]): MoveResolution {
  const byId = new Map<string, Cat>(s.cats.map((c) => [c.id, c]));
  const moving = new Map<string, Intent>();
  const blocked = new Set<string>();

  for (const it of intents) {
    if (!it.move) continue;
    const cat = byId.get(it.catId)!;
    if (cat.mode === 'trapped') continue;
    // trap exclusivity: nobody else may be inside the trap we are entering
    const hit = trapAt(s, it.move);
    if (hit && hit.part === 'front' && !trapAt(s, cat.pos)) {
      if (catsInsideTrap(s, hit.trap).some((k) => k.id !== cat.id)) {
        blocked.add(it.catId);
        continue;
      }
    }
    moving.set(it.catId, it);
  }

  const stop = (id: string) => {
    moving.delete(id);
    blocked.add(id);
  };

  let changed = true;
  while (changed) {
    changed = false;

    // 1. cells held by cats that are not moving
    const stationaryCells = new Set<string>();
    for (const c of s.cats) {
      if (c.mode === 'trapped') continue;
      if (!moving.has(c.id)) stationaryCells.add(key(c.pos));
    }
    for (const [id, it] of [...moving]) {
      if (stationaryCells.has(key(it.move!))) {
        stop(id);
        changed = true;
      }
    }
    if (changed) continue;

    // 2. contested destinations
    const claims = new Map<string, Intent[]>();
    for (const it of moving.values()) {
      const k = key(it.move!);
      const list = claims.get(k) ?? [];
      list.push(it);
      claims.set(k, list);
    }
    for (const list of claims.values()) {
      if (list.length < 2) continue;
      list.sort(better);
      for (const loser of list.slice(1)) stop(loser.catId);
      changed = true;
    }
    if (changed) continue;

    // 3. head-on swaps
    for (const [id, it] of [...moving]) {
      const me = byId.get(id)!;
      for (const [oid, other] of moving) {
        if (oid === id) continue;
        const o = byId.get(oid)!;
        if (eq(it.move, o.pos) && eq(other.move, me.pos)) {
          stop(id);
          stop(oid);
          changed = true;
          break;
        }
      }
      if (changed) break;
    }
  }

  const moves = new Map<string, Cell>();
  for (const [id, it] of moving) moves.set(id, it.move!);
  return { moves, blocked };
}
