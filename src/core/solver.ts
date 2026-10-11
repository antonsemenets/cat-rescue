// Breadth-first puzzle solver used by tests and level design.
// Finds the minimum number of turns to rescue every cat (within limits) by
// exploring all relevant actions with state de-duplication.

import { DIRS, manhattan } from './grid';
import { foodNoticeRadius, toyNoticeRadius } from './rules';
import { validRotateDirs, validTrapDirs } from './trapSystem';
import { isTurnError, runTurn, validateAction } from './turnSystem';
import type { Action, Cell, FoodKind, GameState } from './types';
import { computeCover, trapCells } from './world';

export interface SolveOptions {
  maxTurns: number;
  maxStates?: number;
  /** restrict item usage (e.g. for 3-star checks) */
  maxItems?: number;
}

export interface SolveResult {
  solved: boolean;
  actions: Action[];
  turns: number;
  explored: number;
  exhausted: boolean;
}

function stateKey(s: GameState, withTurn: boolean): string {
  const cats = s.cats
    .map((c) => `${c.id}:${c.pos.x},${c.pos.y},${c.hunger},${c.trust},${c.mode},${c.timer},${c.patrolIndex},${c.target?.id ?? ''}`)
    .join('|');
  const traps = s.traps.map((t) => `${t.back.x},${t.back.y},${t.dir},${t.bait ?? ''},${t.occupiedBy ?? ''}`).join('|');
  const foods = s.foods
    .map((f) => `${f.kind}@${f.cell.x},${f.cell.y}:${f.ttl}`)
    .sort()
    .join('|');
  const boxes = s.boxes
    .map((b) => `${b.cell.x},${b.cell.y}`)
    .sort()
    .join('|');
  const toys = s.toys
    .map((t) => `${t.cell.x},${t.cell.y}:${t.ttl}`)
    .sort()
    .join('|');
  const gates = s.gates.map((g) => (g.open ? `o${g.openTimer}` : 'c')).join('');
  const noises = s.noises.map((n) => n.manualRemaining).join(',');
  const inv = `${s.inventory.trap},${s.inventory.kibble},${s.inventory.tuna},${s.inventory.box},${s.inventory.toy}`;
  return `${withTurn ? s.turn : ''}#${cats}#${traps}#${foods}#${boxes}#${toys}#${gates}#${noises}#${inv}`;
}

function itemsUsed(s: GameState): number {
  const u = s.used;
  return u.trap + u.kibble + u.tuna + u.box + u.toy;
}

/** Candidate actions — prunes placements that cannot matter. */
export function candidateActions(s: GameState): Action[] {
  const out: Action[] = [{ type: 'wait' }];
  const free = s.cats.filter((c) => c.mode !== 'trapped');
  const cells: Cell[] = [];
  for (let y = 0; y < s.height; y++) for (let x = 0; x < s.width; x++) cells.push({ x, y });

  // food: inside traps, or on ground a cat could smell soon
  for (const kind of ['kibble', 'tuna'] as FoodKind[]) {
    if (s.inventory[kind] <= 0) continue;
    for (const t of s.traps) {
      if (t.bait || t.occupiedBy) continue;
      const a: Action = { type: 'placeFood', kind, cell: t.back };
      if (validateAction(s, a).ok) out.push(a);
    }
    for (const c of cells) {
      if (!free.some((k) => k.hunger > 0 && manhattan(k.pos, c) <= foodNoticeRadius(k, kind) + 2)) continue;
      const a: Action = { type: 'placeFood', kind, cell: c };
      if (s.traps.some((t) => trapCells(t).some((tc) => tc.x === c.x && tc.y === c.y))) continue;
      if (validateAction(s, a).ok) out.push(a);
    }
  }
  // toys near curious cats
  if (s.inventory.toy > 0) {
    for (const c of cells) {
      if (!free.some((k) => k.curiosity > 0 && manhattan(k.pos, c) <= toyNoticeRadius(k))) continue;
      const a: Action = { type: 'placeToy', cell: c };
      if (validateAction(s, a).ok) out.push(a);
    }
  }
  // boxes only where they create new shade
  if (s.inventory.box > 0) {
    const cover = computeCover(s);
    for (const c of cells) {
      const a: Action = { type: 'placeBox', cell: c };
      if (!validateAction(s, a).ok) continue;
      const near = [c, ...DIRS.map((d) => ({ x: c.x + (d === 'E' ? 1 : d === 'W' ? -1 : 0), y: c.y + (d === 'S' ? 1 : d === 'N' ? -1 : 0) }))];
      const helps = near.some((n) => n.x >= 0 && n.y >= 0 && n.x < s.width && n.y < s.height && !cover[n.y * s.width + n.x]);
      if (helps) out.push(a);
    }
  }
  // traps
  if (s.inventory.trap > 0) {
    for (const c of cells) for (const dir of validTrapDirs(s, c)) out.push({ type: 'placeTrap', cell: c, dir });
  }
  for (const t of s.traps) for (const dir of validRotateDirs(s, t.id)) out.push({ type: 'rotateTrap', trapId: t.id, dir });
  for (const g of s.gates) {
    const a: Action = { type: 'interact', objectId: g.id };
    if (validateAction(s, a).ok) out.push(a);
  }
  for (const n of s.noises) {
    if (!n.interactive) continue;
    const a: Action = { type: 'interact', objectId: n.id };
    if (validateAction(s, a).ok) out.push(a);
  }
  return out;
}

export function solve(start: GameState, opts: SolveOptions): SolveResult {
  const maxStates = opts.maxStates ?? 400_000;
  const withTurn = start.noises.some((n) => n.schedule);
  interface Node {
    s: GameState;
    parent: Node | null;
    action: Action | null;
  }
  const seen = new Set<string>([stateKey(start, withTurn)]);
  let frontier: Node[] = [{ s: start, parent: null, action: null }];
  let explored = 0;

  const unwind = (n: Node): Action[] => {
    const acts: Action[] = [];
    let cur: Node | null = n;
    while (cur && cur.action) {
      acts.push(cur.action);
      cur = cur.parent;
    }
    return acts.reverse();
  };

  for (let depth = 0; depth < opts.maxTurns; depth++) {
    const next: Node[] = [];
    for (const node of frontier) {
      for (const a of candidateActions(node.s)) {
        const r = runTurn(node.s, a);
        explored++;
        if (isTurnError(r)) continue;
        if (opts.maxItems !== undefined && itemsUsed(r.state) > opts.maxItems) continue;
        const child: Node = { s: r.state, parent: node, action: a };
        if (r.state.status === 'won') {
          const actions = unwind(child);
          return { solved: true, actions, turns: actions.length, explored, exhausted: false };
        }
        const k = stateKey(r.state, withTurn);
        if (seen.has(k)) continue;
        seen.add(k);
        next.push(child);
        if (seen.size > maxStates) return { solved: false, actions: [], turns: -1, explored, exhausted: false };
      }
    }
    frontier = next;
    if (frontier.length === 0) break;
  }
  return { solved: false, actions: [], turns: -1, explored, exhausted: frontier.length === 0 };
}

/** Human readable action, for logs and the solution viewer. */
export function describeAction(a: Action): string {
  switch (a.type) {
    case 'placeTrap':
      return `trap @${a.cell.x},${a.cell.y} ${a.dir}`;
    case 'rotateTrap':
      return `rotate ${a.trapId} ${a.dir}`;
    case 'placeFood':
      return `${a.kind} @${a.cell.x},${a.cell.y}`;
    case 'placeBox':
      return `box @${a.cell.x},${a.cell.y}`;
    case 'placeToy':
      return `toy @${a.cell.x},${a.cell.y}`;
    case 'interact':
      return `interact ${a.objectId}`;
    case 'wait':
      return 'wait';
  }
}
