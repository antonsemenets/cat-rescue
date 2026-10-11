// Deterministic Dijkstra on the logical grid with per-step costs.
// Ties are broken by insertion order (neighbours are expanded N, E, S, W),
// so the same world always produces the same route.

import { add, DIRS, inBounds } from './grid';
import type { Cell } from './types';

export type StepCost = (from: Cell, to: Cell) => number;

export interface CostMap {
  width: number;
  height: number;
  start: Cell;
  cost: Float64Array; // Infinity = unreachable
  parent: Int32Array; // -1 = none
}

interface HeapItem {
  cost: number;
  seq: number;
  i: number;
}

class MinHeap {
  private a: HeapItem[] = [];
  get size(): number {
    return this.a.length;
  }
  private less(x: HeapItem, y: HeapItem): boolean {
    return x.cost < y.cost || (x.cost === y.cost && x.seq < y.seq);
  }
  push(item: HeapItem): void {
    const a = this.a;
    a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.less(a[i], a[p])) break;
      [a[i], a[p]] = [a[p], a[i]];
      i = p;
    }
  }
  pop(): HeapItem | undefined {
    const a = this.a;
    if (a.length === 0) return undefined;
    const top = a[0];
    const last = a.pop()!;
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && this.less(a[l], a[m])) m = l;
        if (r < a.length && this.less(a[r], a[m])) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]];
        i = m;
      }
    }
    return top;
  }
}

/** Full single-source cost map from `start`. */
export function buildCostMap(width: number, height: number, start: Cell, stepCost: StepCost): CostMap {
  const n = width * height;
  const cost = new Float64Array(n).fill(Infinity);
  const parent = new Int32Array(n).fill(-1);
  const done = new Uint8Array(n);
  const heap = new MinHeap();
  let seq = 0;
  const si = start.y * width + start.x;
  cost[si] = 0;
  heap.push({ cost: 0, seq: seq++, i: si });

  while (heap.size > 0) {
    const cur = heap.pop()!;
    if (done[cur.i]) continue;
    done[cur.i] = 1;
    const c = { x: cur.i % width, y: Math.floor(cur.i / width) };
    for (const d of DIRS) {
      const nb = add(c, d);
      if (!inBounds(nb, width, height)) continue;
      const ni = nb.y * width + nb.x;
      if (done[ni]) continue;
      const step = stepCost(c, nb);
      if (!Number.isFinite(step)) continue;
      const nc = cur.cost + step;
      if (nc < cost[ni]) {
        cost[ni] = nc;
        parent[ni] = cur.i;
        heap.push({ cost: nc, seq: seq++, i: ni });
      }
    }
  }
  return { width, height, start, cost, parent };
}

export function costTo(map: CostMap, c: Cell): number {
  return map.cost[c.y * map.width + c.x];
}

/** Path from start (exclusive) to goal (inclusive). Empty when goal === start. */
export function pathTo(map: CostMap, goal: Cell): Cell[] | null {
  const gi = goal.y * map.width + goal.x;
  if (!Number.isFinite(map.cost[gi])) return null;
  const out: Cell[] = [];
  let i = gi;
  const si = map.start.y * map.width + map.start.x;
  while (i !== si) {
    out.push({ x: i % map.width, y: Math.floor(i / map.width) });
    i = map.parent[i];
    if (i < 0) return null;
  }
  out.reverse();
  return out;
}

/** Convenience: shortest path between two cells. */
export function findPath(
  width: number,
  height: number,
  start: Cell,
  goal: Cell,
  stepCost: StepCost,
): { path: Cell[]; cost: number } | null {
  const map = buildCostMap(width, height, start, stepCost);
  const path = pathTo(map, goal);
  if (!path) return null;
  return { path, cost: costTo(map, goal) };
}
