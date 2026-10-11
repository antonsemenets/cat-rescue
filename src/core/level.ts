// LevelSystem — level JSON format, validation and creation of the initial state.

import { add, inBounds, DIRS } from './grid';
import type {
  Action,
  Cat,
  CatLook,
  CatTraits,
  Cell,
  Dir,
  Feature,
  FoodKind,
  GameState,
  Inventory,
  ItemKind,
  NoiseKind,
  NoiseSchedule,
  StarRules,
  Terrain,
} from './types';

export type XY = [number, number];

export interface CatDef {
  id: string;
  name: string;
  pos: XY;
  traits: CatTraits;
  preferredFood?: FoodKind | null;
  patrol?: XY[];
  home?: XY;
  look: CatLook;
  personality: string;
  bio: string;
  required?: boolean;
}

export interface TrapDef {
  id: string;
  pos: XY; // back cell
  dir: Dir;
  bait?: FoodKind | null;
  rotatable?: boolean;
}

export interface GateDef {
  id: string;
  pos: XY;
  open?: boolean;
  /** spring gate — shuts itself N turns after opening */
  autoClose?: number;
}

export interface NoiseDef {
  id: string;
  kind: NoiseKind;
  pos: XY;
  radius: number;
  schedule?: NoiseSchedule;
  interactive?: boolean;
  manualDuration?: number;
}

export interface FoodDef {
  kind: FoodKind;
  pos: XY;
}

export type HintTrigger = 'start' | 'gateClosed' | `turn:${number}` | `tool:${string}` | `placed:${string}`;

export interface HintDef {
  when: HintTrigger;
  text: string;
}

export type SashaPose = 'wave' | 'hold' | 'hug' | 'pet';

/** One line of Sasha's briefing before a level. */
export interface IntroLine {
  pose: SashaPose;
  text: string;
  /** what to point at while the line is shown */
  focus?: { tool?: string; cat?: string; cells?: XY[] };
}

export type SolutionStep =
  | { type: 'placeTrap'; cell: XY; dir: Dir }
  | { type: 'rotateTrap'; trapId: string; dir: Dir }
  | { type: 'placeFood'; kind: FoodKind; cell: XY }
  | { type: 'placeBox'; cell: XY }
  | { type: 'placeToy'; cell: XY }
  | { type: 'interact'; objectId: string }
  | { type: 'wait'; times?: number };

export interface LevelDef {
  id: string;
  order: number;
  title: string;
  subtitle: string;
  location: 'yard' | 'park' | 'garages' | 'garden';
  description: string;
  /** rows of the map, one char per cell — see LEGEND */
  map: string[];
  cats: CatDef[];
  traps?: TrapDef[];
  gates?: GateDef[];
  noises?: NoiseDef[];
  foods?: FoodDef[];
  inventory: Partial<Inventory>;
  stars: StarRules;
  hints?: HintDef[];
  /** Sasha's short briefing shown before the level */
  intro?: IntroLine[];
  /** Sasha's line on the victory screen */
  outro?: string;
  /** a known winning sequence — verified by the test-suite */
  solution: SolutionStep[];
}

/** Map legend: char -> terrain and optional feature. */
export const LEGEND: Record<string, { terrain: Terrain; feature: Feature | null; gate?: boolean }> = {
  '.': { terrain: 'grass', feature: null },
  ',': { terrain: 'path', feature: null },
  ':': { terrain: 'dirt', feature: null },
  '*': { terrain: 'flowers', feature: null },
  '#': { terrain: 'grass', feature: 'wall' },
  F: { terrain: 'grass', feature: 'fence' },
  T: { terrain: 'grass', feature: 'tree' },
  R: { terrain: 'grass', feature: 'rock' },
  C: { terrain: 'path', feature: 'crate' },
  S: { terrain: 'path', feature: 'shed' },
  '~': { terrain: 'grass', feature: 'water' },
  B: { terrain: 'grass', feature: 'bush' },
  D: { terrain: 'path', feature: 'den' },
  G: { terrain: 'path', feature: null, gate: true },
};

const xy = (p: XY): Cell => ({ x: p[0], y: p[1] });

export function emptyInventory(): Inventory {
  return { trap: 0, kibble: 0, tuna: 0, box: 0, toy: 0 };
}

export function validateLevel(def: LevelDef): string[] {
  const errors: string[] = [];
  const h = def.map.length;
  const w = def.map[0]?.length ?? 0;
  if (w < 3 || h < 3 || w > 12 || h > 12) errors.push(`map size ${w}x${h} out of range 3..12`);
  def.map.forEach((row, y) => {
    if (row.length !== w) errors.push(`row ${y} has length ${row.length}, expected ${w}`);
    for (const ch of row) if (!LEGEND[ch]) errors.push(`unknown map char '${ch}' in row ${y}`);
  });
  if (def.cats.length === 0) errors.push('level has no cats');
  const ids = new Set<string>();
  const occupied = new Set<string>();
  const charAt = (p: XY) => def.map[p[1]]?.[p[0]];
  const isSolidChar = (p: XY) => {
    const ch = charAt(p);
    if (ch === undefined) return true;
    const f = LEGEND[ch]?.feature;
    return !!f && f !== 'bush' && f !== 'den';
  };
  for (const c of def.cats) {
    if (ids.has(c.id)) errors.push(`duplicate id ${c.id}`);
    ids.add(c.id);
    if (!inBounds(xy(c.pos), w, h)) errors.push(`cat ${c.id} out of bounds`);
    else if (isSolidChar(c.pos)) errors.push(`cat ${c.id} starts inside an obstacle`);
    for (const k of ['hunger', 'fear', 'curiosity', 'trust'] as const) {
      const v = c.traits[k];
      if (!Number.isInteger(v) || v < 0 || v > 3) errors.push(`cat ${c.id} ${k}=${v} must be 0..3`);
    }
    occupied.add(c.pos.join(','));
    for (const p of c.patrol ?? []) if (!inBounds(xy(p), w, h) || isSolidChar(p)) errors.push(`cat ${c.id} patrol point ${p} invalid`);
  }
  for (const t of def.traps ?? []) {
    if (ids.has(t.id)) errors.push(`duplicate id ${t.id}`);
    ids.add(t.id);
    const back = xy(t.pos);
    const front = add(back, t.dir);
    for (const c of [back, front]) {
      if (!inBounds(c, w, h)) errors.push(`trap ${t.id} out of bounds`);
      else if (LEGEND[charAt([c.x, c.y])!]?.feature) errors.push(`trap ${t.id} overlaps an obstacle`);
      if (occupied.has(`${c.x},${c.y}`)) errors.push(`trap ${t.id} overlaps another object`);
      occupied.add(`${c.x},${c.y}`);
    }
  }
  for (const g of def.gates ?? []) {
    if (charAt(g.pos) !== 'G') errors.push(`gate ${g.id} not on a G cell`);
    if (ids.has(g.id)) errors.push(`duplicate id ${g.id}`);
    ids.add(g.id);
  }
  def.map.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === 'G' && !(def.gates ?? []).some((g) => g.pos[0] === x && g.pos[1] === y)) errors.push(`G at ${x},${y} has no gate definition`);
    });
  });
  for (const n of def.noises ?? []) {
    if (ids.has(n.id)) errors.push(`duplicate id ${n.id}`);
    ids.add(n.id);
    if (!inBounds(xy(n.pos), w, h)) errors.push(`noise ${n.id} out of bounds`);
    if (!n.schedule && !n.interactive) errors.push(`noise ${n.id} is never active`);
  }
  const s = def.stars;
  if (!(s.twoStarTurns >= s.threeStarTurns)) errors.push('twoStarTurns must be >= threeStarTurns');
  if (def.solution.length === 0) errors.push('level has no reference solution');
  const tools = ['trap', 'rotate', 'kibble', 'tuna', 'box', 'toy', 'hand'];
  for (const line of def.intro ?? []) {
    if (!['wave', 'hold', 'hug', 'pet'].includes(line.pose)) errors.push(`intro pose '${line.pose}' unknown`);
    if (!line.text.trim()) errors.push('intro line without text');
    if (line.focus?.tool && !tools.includes(line.focus.tool)) errors.push(`intro focus tool '${line.focus.tool}' unknown`);
    if (line.focus?.cat && !def.cats.some((c) => c.id === line.focus!.cat)) errors.push(`intro focus cat '${line.focus.cat}' unknown`);
    for (const c of line.focus?.cells ?? []) if (!inBounds(xy(c), w, h)) errors.push(`intro focus cell ${c} out of bounds`);
  }
  return errors;
}

export function createInitialState(def: LevelDef): GameState {
  const errors = validateLevel(def);
  if (errors.length) throw new Error(`Level ${def.id} invalid:\n  ${errors.join('\n  ')}`);
  const height = def.map.length;
  const width = def.map[0].length;
  const terrain: Terrain[] = [];
  const features: (Feature | null)[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const l = LEGEND[def.map[y][x]];
      terrain.push(l.terrain);
      features.push(l.feature);
    }
  }
  const cats: Cat[] = def.cats.map((c) => ({
    id: c.id,
    name: c.name,
    pos: xy(c.pos),
    hunger: c.traits.hunger,
    fear: c.traits.fear,
    curiosity: c.traits.curiosity,
    trust: c.traits.trust,
    preferredFood: c.preferredFood ?? null,
    mode: 'idle',
    activity: 'sit',
    target: null,
    timer: 0,
    patrol: (c.patrol ?? []).map(xy),
    patrolIndex: 0,
    home: xy(c.home ?? c.pos),
    homeArea: null,
    trappedIn: null,
    required: c.required !== false,
  }));
  const inventory = { ...emptyInventory(), ...def.inventory };
  return {
    levelId: def.id,
    width,
    height,
    terrain,
    features,
    cats,
    traps: (def.traps ?? []).map((t) => ({
      id: t.id,
      back: xy(t.pos),
      dir: t.dir,
      bait: t.bait ?? null,
      occupiedBy: null,
      rotatable: t.rotatable !== false,
    })),
    foods: (def.foods ?? []).map((f, i) => ({ id: `lvlfood${i}`, kind: f.kind, cell: xy(f.pos), ttl: 99 })),
    boxes: [],
    toys: [],
    gates: (def.gates ?? []).map((g) => ({ id: g.id, cell: xy(g.pos), open: !!g.open, autoClose: g.autoClose ?? 0, openTimer: g.open ? (g.autoClose ?? 0) : 0 })),
    noises: (def.noises ?? []).map((n) => ({
      id: n.id,
      kind: n.kind,
      cell: xy(n.pos),
      radius: n.radius,
      schedule: n.schedule ?? null,
      interactive: !!n.interactive,
      manualDuration: n.manualDuration ?? 2,
      manualRemaining: 0,
      active: false,
    })),
    inventory,
    used: emptyInventory(),
    turn: 0,
    rescued: [],
    status: 'playing',
    nextId: 1,
  };
}

/** Expand compact JSON solution steps into engine actions. */
export function solutionToActions(steps: SolutionStep[]): Action[] {
  const out: Action[] = [];
  for (const st of steps) {
    switch (st.type) {
      case 'wait':
        for (let i = 0; i < (st.times ?? 1); i++) out.push({ type: 'wait' });
        break;
      case 'placeTrap':
        out.push({ type: 'placeTrap', cell: xy(st.cell), dir: st.dir });
        break;
      case 'placeFood':
        out.push({ type: 'placeFood', kind: st.kind, cell: xy(st.cell) });
        break;
      case 'placeBox':
        out.push({ type: 'placeBox', cell: xy(st.cell) });
        break;
      case 'placeToy':
        out.push({ type: 'placeToy', cell: xy(st.cell) });
        break;
      default:
        out.push(st);
    }
  }
  return out;
}

export function totalItems(inv: Inventory): number {
  return (Object.keys(inv) as ItemKind[]).reduce((n, k) => n + inv[k], 0);
}

export { DIRS };
