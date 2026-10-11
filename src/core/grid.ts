import type { Cell, Dir } from './types';

/** Fixed neighbour order — keeps every search deterministic. */
export const DIRS: readonly Dir[] = ['N', 'E', 'S', 'W'];

export const DIR_VEC: Record<Dir, Cell> = {
  N: { x: 0, y: -1 },
  E: { x: 1, y: 0 },
  S: { x: 0, y: 1 },
  W: { x: -1, y: 0 },
};

export const OPPOSITE: Record<Dir, Dir> = { N: 'S', S: 'N', E: 'W', W: 'E' };

export function cell(x: number, y: number): Cell {
  return { x, y };
}

export function add(c: Cell, d: Dir, n = 1): Cell {
  const v = DIR_VEC[d];
  return { x: c.x + v.x * n, y: c.y + v.y * n };
}

export function eq(a: Cell | null | undefined, b: Cell | null | undefined): boolean {
  return !!a && !!b && a.x === b.x && a.y === b.y;
}

export function key(c: Cell): string {
  return `${c.x},${c.y}`;
}

export function manhattan(a: Cell, b: Cell): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function inBounds(c: Cell, width: number, height: number): boolean {
  return c.x >= 0 && c.y >= 0 && c.x < width && c.y < height;
}

export function idx(c: Cell, width: number): number {
  return c.y * width + c.x;
}

export function neighbors(c: Cell): Cell[] {
  return DIRS.map((d) => add(c, d));
}

/** Direction from a to an adjacent cell b, or null if not adjacent. */
export function dirBetween(a: Cell, b: Cell): Dir | null {
  for (const d of DIRS) {
    const n = add(a, d);
    if (n.x === b.x && n.y === b.y) return d;
  }
  return null;
}

/** Stable ordering for cells: row-major. */
export function compareCells(a: Cell, b: Cell): number {
  return a.y - b.y || a.x - b.x;
}

export function compareStr(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
