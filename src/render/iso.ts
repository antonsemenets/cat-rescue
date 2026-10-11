// Isometric projection helpers (2:1 diamonds).
// Grid point (gx, gy) — continuous grid coordinates, cell (x, y) spans [x, x+1]×[y, y+1].

export const TILE_W = 96;
export const TILE_H = 48;
export const HALF_W = TILE_W / 2;
export const HALF_H = TILE_H / 2;

export interface Pt {
  x: number;
  y: number;
}

/** World position of a continuous grid point (z lifts the point up). */
export function gp(gx: number, gy: number, z = 0): Pt {
  return { x: (gx - gy) * HALF_W, y: (gx + gy) * HALF_H - z };
}

/** World position of a cell centre. */
export function cellCenter(x: number, y: number, z = 0): Pt {
  return gp(x + 0.5, y + 0.5, z);
}

/** Inverse projection: world point -> continuous grid coordinates. */
export function worldToGrid(wx: number, wy: number): { gx: number; gy: number } {
  const a = wx / HALF_W;
  const b = wy / HALF_H;
  return { gx: (a + b) / 2, gy: (b - a) / 2 };
}

/** Depth for painter's algorithm: larger x+y is closer to the viewer. */
export function depthOf(x: number, y: number, layer = 0): number {
  return (x + y) * 10 + layer;
}

export function diamond(x: number, y: number, inset = 0, z = 0): Pt[] {
  return [gp(x + inset, y + inset, z), gp(x + 1 - inset, y + inset, z), gp(x + 1 - inset, y + 1 - inset, z), gp(x + inset, y + 1 - inset, z)];
}

/** Board bounds in world coordinates (including some head-room for tall objects). */
export function boardBounds(w: number, h: number, headroom = 110, slab = 40): { x: number; y: number; width: number; height: number } {
  const left = gp(0, h).x;
  const right = gp(w, 0).x;
  const top = gp(0, 0).y - headroom;
  const bottom = gp(w, h).y + slab;
  return { x: left, y: top, width: right - left, height: bottom - top };
}
