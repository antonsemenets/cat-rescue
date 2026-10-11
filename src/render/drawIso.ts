// Procedural isometric drawing of grid-aligned objects with Phaser Graphics.
// Everything is vector, so it stays crisp at any zoom and always lines up
// with the logical grid.

import Phaser from 'phaser';
import type { Dir } from '../core/types';
import { gp, type Pt } from './iso';

type G = Phaser.GameObjects.Graphics;

export const PAL = {
  ink: 0x4c3b3a,
  grass: [0xa9cb86, 0xa3c67f, 0xafd08c],
  grassDark: 0x92b873,
  path: 0xdccfb9,
  pathStone: 0xebe1cf,
  pathStoneEdge: 0xc2b49c,
  dirt: 0xd4b58e,
  water: 0x8cc7d9,
  waterLight: 0xbfe3ee,
  soilL: 0xa77d5c,
  soilR: 0x8e6649,
  lip: 0x8fbb6c,
  woodL: 0xd6a776,
  woodR: 0xb8875a,
  woodTop: 0xe8c193,
  woodDark: 0x8a5f3e,
  brickTop: 0xeec0a3,
  brickL: 0xd99474,
  brickR: 0xbd7a5c,
  mortar: 0xf3d8c6,
  shedL: 0xa9c2d3,
  shedR: 0x8fa9bc,
  roof: 0xcf7c66,
  roofLight: 0xe39a84,
  steel: 0x5e6d79,
  mesh: 0x8796a3,
  meshFill: 0xb4c2cc,
  plate: 0xc8d1d8,
  card: 0xdcaa6e,
  cardDark: 0xc08e55,
  cardTop: 0xebc28c,
  cardInside: 0x9f7444,
};

const lift = (p: Pt, z: number): Pt => ({ x: p.x, y: p.y - z });

function poly(g: G, pts: Pt[], fill: number, alpha = 1, stroke?: number, sw = 2) {
  g.fillStyle(fill, alpha);
  g.fillPoints(pts as Phaser.Types.Math.Vector2Like[], true);
  if (stroke !== undefined) {
    g.lineStyle(sw, stroke, 1);
    g.strokePoints(pts as Phaser.Types.Math.Vector2Like[], true);
  }
}

export interface BoxColors {
  top: number;
  left: number; // +y face
  right: number; // +x face
  outline?: number;
}

/** Axis-aligned iso box. Returns the key corner points for decoration. */
export function isoBox(g: G, x: number, y: number, w: number, d: number, h: number, c: BoxColors, z0 = 0, sw = 2.5) {
  const A = gp(x, y, z0);
  const B = gp(x + w, y, z0);
  const C = gp(x + w, y + d, z0);
  const D = gp(x, y + d, z0);
  const At = lift(A, h);
  const Bt = lift(B, h);
  const Ct = lift(C, h);
  const Dt = lift(D, h);
  poly(g, [B, C, Ct, Bt], c.right);
  poly(g, [D, C, Ct, Dt], c.left);
  poly(g, [At, Bt, Ct, Dt], c.top);
  if (c.outline !== undefined) {
    g.lineStyle(sw, c.outline, 1);
    g.strokePoints([D, C, B, Bt, At, Dt] as Phaser.Types.Math.Vector2Like[], true);
    g.lineBetween(Ct.x, Ct.y, C.x, C.y);
    g.lineBetween(Ct.x, Ct.y, Bt.x, Bt.y);
    g.lineBetween(Ct.x, Ct.y, Dt.x, Dt.y);
  }
  return { A, B, C, D, At, Bt, Ct, Dt };
}

// ---------------------------------------------------------------------------
// Ground

export function drawGroundTile(g: G, x: number, y: number, color: number) {
  // expand by a hair to hide seams between neighbouring diamonds
  const e = 0.012;
  poly(g, [gp(x - e, y - e), gp(x + 1 + e, y - e), gp(x + 1 + e, y + 1 + e), gp(x - e, y + 1 + e)], color);
}

export function drawPathStones(g: G, x: number, y: number, seed: number) {
  const spots = [
    [0.3, 0.3, 0.17],
    [0.7, 0.32, 0.15],
    [0.32, 0.72, 0.15],
    [0.72, 0.7, 0.17],
  ];
  spots.forEach(([sx, sy, r], i) => {
    const jx = (((seed >> (i * 3)) & 7) - 3.5) * 0.012;
    const jy = (((seed >> (i * 3 + 1)) & 7) - 3.5) * 0.012;
    const c = gp(x + sx + jx, y + sy + jy);
    g.fillStyle(PAL.pathStoneEdge, 1);
    g.fillEllipse(c.x, c.y + 1.5, r * 96 + 3, r * 48 + 3);
    g.fillStyle(PAL.pathStone, 1);
    g.fillEllipse(c.x, c.y, r * 96, r * 48);
  });
}

export function drawWater(g: G, x: number, y: number) {
  drawGroundTile(g, x, y, PAL.water);
  const c = gp(x + 0.5, y + 0.5);
  g.fillStyle(PAL.waterLight, 0.9);
  g.fillEllipse(c.x - 12, c.y - 4, 22, 5);
  g.fillEllipse(c.x + 14, c.y + 6, 16, 4);
}

/** The soil slab under the front edges of the board. */
export function drawSlab(g: G, w: number, h: number, depth = 34) {
  const L0 = gp(0, h);
  const M = gp(w, h);
  const R0 = gp(w, 0);
  // soft drop shadow
  g.fillStyle(0x3c3a2a, 0.12);
  g.fillEllipse((L0.x + R0.x) / 2, M.y + depth + 6, (R0.x - L0.x) * 1.02, 46);
  poly(g, [L0, M, lift(M, -depth), lift(L0, -depth)], PAL.soilL);
  poly(g, [M, R0, lift(R0, -depth), lift(M, -depth)], PAL.soilR);
  // soil layers
  g.lineStyle(2, 0x8c6449, 0.5);
  for (const k of [0.45, 0.75]) {
    g.lineBetween(L0.x, L0.y + depth * k, M.x, M.y + depth * k);
    g.lineBetween(M.x, M.y + depth * k, R0.x, R0.y + depth * k);
  }
  // grass lip
  poly(g, [L0, M, lift(M, -9), lift(L0, -9)], PAL.lip);
  poly(g, [M, R0, lift(R0, -9), lift(M, -9)], 0x7fa962);
  g.lineStyle(3, 0x6f5040, 1);
  g.strokePoints([L0, lift(L0, -depth), lift(M, -depth), lift(R0, -depth), R0] as Phaser.Types.Math.Vector2Like[], false);
  g.lineBetween(M.x, M.y, M.x, M.y + depth);
  // pebbles in the soil
  g.fillStyle(0xc9b39a, 0.8);
  for (let i = 0; i < w; i++) {
    const a = gp(i + 0.35, h);
    g.fillEllipse(a.x - 4, a.y + depth * 0.6, 7, 4);
  }
  for (let j = 0; j < h; j++) {
    const a = gp(w, j + 0.6);
    g.fillEllipse(a.x + 3, a.y + depth * 0.62, 6, 3.5);
  }
}

// ---------------------------------------------------------------------------
// Static features

export function drawWall(g: G, x: number, y: number) {
  const H = 36;
  const b = isoBox(g, x, y, 1, 1, H, { top: PAL.brickTop, left: PAL.brickL, right: PAL.brickR }, 0);
  // mortar lines
  g.lineStyle(1.6, PAL.mortar, 0.75);
  for (let z = 9; z < H; z += 9) {
    g.lineBetween(b.D.x, b.D.y - z, b.C.x, b.C.y - z);
    g.lineBetween(b.C.x, b.C.y - z, b.B.x, b.B.y - z);
  }
  for (let row = 0; row < 4; row++) {
    const z0 = row * 9;
    const offs = row % 2 === 0 ? [0.33, 0.83] : [0.08, 0.58];
    for (const t of offs) {
      const p1 = gp(x + t, y + 1);
      const p2 = gp(x + 1, y + t);
      g.lineBetween(p1.x, p1.y - z0, p1.x, p1.y - z0 - 9);
      g.lineBetween(p2.x, p2.y - z0, p2.x, p2.y - z0 - 9);
    }
  }
  // cap
  isoBox(g, x - 0.03, y - 0.03, 1.06, 1.06, 5, { top: 0xf5d2bc, left: 0xe2ab8f, right: 0xcf977b }, H);
}

export function drawShed(g: G, x: number, y: number) {
  const H = 66;
  const b = isoBox(g, x, y, 1, 1, H, { top: PAL.roof, left: PAL.shedL, right: PAL.shedR });
  g.lineStyle(1.4, 0x7b93a6, 0.7);
  for (let t = 0.25; t < 1; t += 0.25) {
    const p1 = gp(x + t, y + 1);
    const p2 = gp(x + 1, y + t);
    g.lineBetween(p1.x, p1.y, p1.x, p1.y - H);
    g.lineBetween(p2.x, p2.y, p2.x, p2.y - H);
  }
  // roof trim
  isoBox(g, x - 0.04, y - 0.04, 1.08, 1.08, 7, { top: PAL.roofLight, left: 0xb86852, right: 0xa55b47 }, H);
  g.lineStyle(1.5, 0xb86852, 0.6);
  const r1 = gp(x + 0.5, y - 0.04, H + 7);
  const r2 = gp(x + 0.5, y + 1.04, H + 7);
  g.lineBetween(r1.x, r1.y, r2.x, r2.y);
  void b;
}

export function drawCrate(g: G, x: number, y: number) {
  const H = 40;
  const b = isoBox(g, x + 0.08, y + 0.08, 0.84, 0.84, H, { top: PAL.woodTop, left: PAL.woodL, right: PAL.woodR, outline: PAL.woodDark }, 0, 2.5);
  g.lineStyle(2, PAL.woodDark, 0.8);
  g.lineBetween(b.D.x, b.D.y, b.Ct.x, b.Ct.y);
  g.lineBetween(b.C.x, b.C.y, b.Dt.x, b.Dt.y);
  g.lineBetween(b.C.x, b.C.y, b.Bt.x, b.Bt.y);
  g.lineBetween(b.B.x, b.B.y, b.Ct.x, b.Ct.y);
  g.lineBetween(b.D.x, b.D.y - H / 2, b.C.x, b.C.y - H / 2);
  g.lineBetween(b.C.x, b.C.y - H / 2, b.B.x, b.B.y - H / 2);
}

export function drawDen(g: G, x: number, y: number) {
  // little wooden cat house in the back half of the cell — the cat sits by its door
  const H = 28;
  const x0 = x + 0.12;
  const y0 = y + 0.04;
  const w = 0.76;
  const d = 0.5;
  isoBox(g, x0, y0, w, d, H, { top: PAL.woodTop, left: PAL.woodL, right: PAL.woodR, outline: PAL.woodDark });
  const c = gp(x0 + w / 2, y0 + d);
  g.fillStyle(0x4a3326, 1);
  g.fillEllipse(c.x, c.y - 11, 18, 18);
  g.fillRect(c.x - 9, c.y - 11, 18, 9);
  // gable roof along x
  const ra = gp(x0 - 0.04, y0 + d / 2, H + 20);
  const rb = gp(x0 + w + 0.04, y0 + d / 2, H + 20);
  const f1 = gp(x0 - 0.04, y0 + d + 0.08, H - 2);
  const f2 = gp(x0 + w + 0.04, y0 + d + 0.08, H - 2);
  const k1 = gp(x0 - 0.04, y0 - 0.08, H - 2);
  const k2 = gp(x0 + w + 0.04, y0 - 0.08, H - 2);
  poly(g, [ra, rb, k2, k1], 0xb86852, 1, PAL.ink, 2);
  poly(g, [ra, rb, f2, f1], PAL.roof, 1, PAL.ink, 2);
  poly(g, [rb, f2, k2], 0xe8c193, 1, PAL.ink, 2);
  // a soft mat in front of the door
  const m = gp(x + 0.5, y + 0.72);
  g.fillStyle(0xf29aa3, 0.9);
  g.fillEllipse(m.x, m.y, 40, 18);
  g.lineStyle(2, 0xd86f7a, 1);
  g.strokeEllipse(m.x, m.y, 40, 18);
}

/** Wooden fence: posts in the cell centre, rails toward connected neighbours. */
export function drawFence(g: G, x: number, y: number, conn: { n: boolean; e: boolean; s: boolean; w: boolean }) {
  const any = conn.n || conn.e || conn.s || conn.w;
  const c = { x: x + 0.5, y: y + 0.5 };
  const rail = (tx: number, ty: number) => {
    for (const z of [11, 25]) {
      const a = gp(c.x, c.y, z);
      const b = gp(tx, ty, z);
      g.lineStyle(7, PAL.woodDark, 1);
      g.lineBetween(a.x, a.y, b.x, b.y);
      g.lineStyle(4, PAL.woodL, 1);
      g.lineBetween(a.x, a.y - 0.5, b.x, b.y - 0.5);
    }
  };
  // behind the post
  if (conn.n) rail(c.x, y);
  if (conn.w) rail(x, c.y);
  if (!any) {
    rail(x + 0.1, c.y);
  }
  isoBox(g, c.x - 0.08, c.y - 0.08, 0.16, 0.16, 36, { top: PAL.woodTop, left: PAL.woodL, right: PAL.woodR, outline: PAL.woodDark }, 0, 2);
  // pointy cap
  const t = gp(c.x, c.y, 42);
  const l = gp(c.x - 0.08, c.y + 0.08, 36);
  const r = gp(c.x + 0.08, c.y - 0.08, 36);
  const m = gp(c.x + 0.08, c.y + 0.08, 36);
  poly(g, [l, m, t], PAL.woodL, 1);
  poly(g, [m, r, t], PAL.woodR, 1);
  if (conn.s) rail(c.x, y + 1);
  if (conn.e) rail(x + 1, c.y);
  if (!any) rail(x + 0.9, c.y);
}

/** Gate: hinge on one side, panel swings 0 (closed) .. 1 (open). */
export function drawGate(g: G, x: number, y: number, axis: 'x' | 'y', openT: number) {
  const hinge = axis === 'x' ? { x, y: y + 0.5 } : { x: x + 0.5, y };
  const ang = (openT * Math.PI) / 2;
  // panel direction rotates from the axis towards "back" (-y for x axis, -x for y axis)
  const dir = axis === 'x' ? { x: Math.cos(ang), y: -Math.sin(ang) } : { x: -Math.sin(ang), y: Math.cos(ang) };
  const L = 0.96;
  const end = { x: hinge.x + dir.x * L, y: hinge.y + dir.y * L };
  const H = 30;
  const p0 = gp(hinge.x, hinge.y, 3);
  const p1 = gp(end.x, end.y, 3);
  const p2 = gp(end.x, end.y, H);
  const p3 = gp(hinge.x, hinge.y, H);
  poly(g, [p0, p1, p2, p3], 0xe2b583, 1, PAL.woodDark, 2.5);
  g.lineStyle(2, 0xb8875a, 0.9);
  for (const t of [0.25, 0.5, 0.75]) {
    const a = gp(hinge.x + dir.x * L * t, hinge.y + dir.y * L * t, 3);
    g.lineBetween(a.x, a.y, a.x, a.y - (H - 3));
  }
  g.lineStyle(4, PAL.woodDark, 1);
  g.lineBetween(p0.x, p0.y - 4, p2.x, p2.y + 4);
  // posts
  const post = (px: number, py: number) =>
    isoBox(g, px - 0.07, py - 0.07, 0.14, 0.14, 40, { top: PAL.woodTop, left: PAL.woodL, right: PAL.woodR, outline: PAL.woodDark }, 0, 2);
  post(hinge.x, hinge.y);
  if (axis === 'x') post(x + 1, y + 0.5);
  else post(x + 0.5, y + 1);
  // latch
  const latch = gp(end.x, end.y, H / 2 + 2);
  g.fillStyle(0x6b7c88, 1);
  g.fillCircle(latch.x, latch.y, 3);
}

// ---------------------------------------------------------------------------
// Humane trap

export interface TrapGeom {
  x0: number;
  y0: number;
  w: number;
  d: number;
  dir: Dir;
}

export function trapGeom(back: { x: number; y: number }, dir: Dir): TrapGeom {
  const fx = back.x + (dir === 'E' ? 1 : dir === 'W' ? -1 : 0);
  const fy = back.y + (dir === 'S' ? 1 : dir === 'N' ? -1 : 0);
  const x0 = Math.min(back.x, fx);
  const y0 = Math.min(back.y, fy);
  const horizontal = dir === 'E' || dir === 'W';
  return { x0, y0, w: horizontal ? 2 : 1, d: horizontal ? 1 : 2, dir };
}

const TRAP_H = 44;
const IN = 0.14; // inset from the cell edges

function trapCorners(t: TrapGeom) {
  const x0 = t.x0 + IN;
  const y0 = t.y0 + IN;
  const x1 = t.x0 + t.w - IN;
  const y1 = t.y0 + t.d - IN;
  return { x0, y0, x1, y1 };
}

function meshFace(g: G, a: { x: number; y: number }, b: { x: number; y: number }, alpha: number, hole: boolean) {
  const steps = Math.round(Math.hypot(b.x - a.x, b.y - a.y) * 6);
  const pA = gp(a.x, a.y);
  const pB = gp(b.x, b.y);
  if (!hole) {
    poly(g, [pA, pB, lift(pB, TRAP_H), lift(pA, TRAP_H)], PAL.meshFill, 0.18 * alpha);
    g.lineStyle(1.2, PAL.mesh, 0.85 * alpha);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const p = gp(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
      g.lineBetween(p.x, p.y, p.x, p.y - TRAP_H);
    }
    for (const z of [TRAP_H / 3, (2 * TRAP_H) / 3]) g.lineBetween(pA.x, pA.y - z, pB.x, pB.y - z);
  }
  g.lineStyle(2.4, PAL.steel, alpha);
  g.lineBetween(pA.x, pA.y, pB.x, pB.y);
  g.lineBetween(pA.x, pA.y - TRAP_H, pB.x, pB.y - TRAP_H);
}

function entranceFace(t: TrapGeom): 'xmin' | 'xmax' | 'ymin' | 'ymax' {
  return t.dir === 'E' ? 'xmax' : t.dir === 'W' ? 'xmin' : t.dir === 'S' ? 'ymax' : 'ymin';
}

function faceEnds(t: TrapGeom, f: 'xmin' | 'xmax' | 'ymin' | 'ymax') {
  const c = trapCorners(t);
  switch (f) {
    case 'xmin':
      return [{ x: c.x0, y: c.y0 }, { x: c.x0, y: c.y1 }];
    case 'xmax':
      return [{ x: c.x1, y: c.y0 }, { x: c.x1, y: c.y1 }];
    case 'ymin':
      return [{ x: c.x0, y: c.y0 }, { x: c.x1, y: c.y0 }];
    case 'ymax':
      return [{ x: c.x0, y: c.y1 }, { x: c.x1, y: c.y1 }];
  }
}

function drawDoor(g: G, t: TrapGeom, closed: number, alpha: number) {
  const [a, b] = faceEnds(t, entranceFace(t));
  const lift0 = (1 - closed) * (TRAP_H - 4);
  const pA = gp(a.x, a.y, lift0 + 2);
  const pB = gp(b.x, b.y, lift0 + 2);
  const h = TRAP_H - 2;
  poly(g, [pA, pB, lift(pB, h), lift(pA, h)], 0x8c9aa6, 0.92 * alpha, PAL.steel, 2.4);
  g.lineStyle(1.2, 0xb8c4cd, alpha);
  for (const k of [0.33, 0.66]) {
    const p = { x: pA.x + (pB.x - pA.x) * k, y: pA.y + (pB.y - pA.y) * k };
    g.lineBetween(p.x, p.y - 3, p.x, p.y - h + 3);
  }
}

/** Back half: floor, plate and the two far walls. */
export function drawTrapBack(g: G, t: TrapGeom, opts: { alpha?: number; closed?: number }) {
  const alpha = opts.alpha ?? 1;
  const closed = opts.closed ?? 0;
  const c = trapCorners(t);
  const floor = [gp(c.x0, c.y0, 1), gp(c.x1, c.y0, 1), gp(c.x1, c.y1, 1), gp(c.x0, c.y1, 1)];
  poly(g, floor, PAL.plate, 0.95 * alpha, PAL.steel, 2);
  // trigger plate on the back cell
  const hole = entranceFace(t);
  const backIsMin = (t.dir === 'E' && true) || (t.dir === 'S' && true);
  const bx = t.w === 2 ? (backIsMin ? t.x0 : t.x0 + 1) : t.x0;
  const by = t.d === 2 ? (backIsMin ? t.y0 : t.y0 + 1) : t.y0;
  const pc = gp(bx + 0.5, by + 0.5, 2);
  g.fillStyle(0xa9b5be, alpha);
  g.fillEllipse(pc.x, pc.y, 34, 17);
  g.lineStyle(1.5, PAL.steel, alpha);
  g.strokeEllipse(pc.x, pc.y, 34, 17);
  for (const f of ['xmin', 'ymin'] as const) {
    const [a, b] = faceEnds(t, f);
    meshFace(g, a, b, alpha, f === hole);
  }
  if (hole === 'xmin' || hole === 'ymin') drawDoor(g, t, closed, alpha);
}

/** Front half: near walls, roof mesh, frame, handle (and the door if it faces us). */
export function drawTrapFront(g: G, t: TrapGeom, opts: { alpha?: number; closed?: number; occupied?: boolean }) {
  const alpha = opts.alpha ?? 1;
  const closed = opts.closed ?? 0;
  const c = trapCorners(t);
  const hole = entranceFace(t);
  for (const f of ['xmax', 'ymax'] as const) {
    const [a, b] = faceEnds(t, f);
    meshFace(g, a, b, alpha, f === hole);
  }
  // roof
  const top = [gp(c.x0, c.y0, TRAP_H), gp(c.x1, c.y0, TRAP_H), gp(c.x1, c.y1, TRAP_H), gp(c.x0, c.y1, TRAP_H)];
  poly(g, top, PAL.meshFill, 0.16 * alpha);
  g.lineStyle(1.1, PAL.mesh, 0.8 * alpha);
  const nx = Math.round((c.x1 - c.x0) * 6);
  const ny = Math.round((c.y1 - c.y0) * 6);
  for (let i = 1; i < nx; i++) {
    const xx = c.x0 + ((c.x1 - c.x0) * i) / nx;
    const a = gp(xx, c.y0, TRAP_H);
    const b = gp(xx, c.y1, TRAP_H);
    g.lineBetween(a.x, a.y, b.x, b.y);
  }
  for (let i = 1; i < ny; i++) {
    const yy = c.y0 + ((c.y1 - c.y0) * i) / ny;
    const a = gp(c.x0, yy, TRAP_H);
    const b = gp(c.x1, yy, TRAP_H);
    g.lineBetween(a.x, a.y, b.x, b.y);
  }
  // vertical frame edges
  g.lineStyle(2.6, PAL.steel, alpha);
  for (const [px, py] of [
    [c.x1, c.y0],
    [c.x1, c.y1],
    [c.x0, c.y1],
  ]) {
    const p = gp(px, py);
    g.lineBetween(p.x, p.y, p.x, p.y - TRAP_H);
  }
  g.strokePoints(top as Phaser.Types.Math.Vector2Like[], true);
  // handle
  const mid = gp((c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2, TRAP_H);
  g.lineStyle(5, PAL.steel, alpha);
  const hx = t.w === 2 ? 14 : 10;
  g.beginPath();
  g.arc(mid.x, mid.y, hx, Math.PI, 0, false);
  g.strokePath();
  g.lineStyle(2.5, 0xa9b5be, alpha);
  g.beginPath();
  g.arc(mid.x, mid.y - 1, hx, Math.PI * 1.1, Math.PI * 1.9, false);
  g.strokePath();
  if (hole === 'xmax' || hole === 'ymax') drawDoor(g, t, closed, alpha);
  if (opts.occupied) {
    const p = gp((c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2, TRAP_H + 18);
    g.fillStyle(0xffffff, 0.95);
    g.fillCircle(p.x, p.y, 9);
    g.lineStyle(2, PAL.ink, 1);
    g.strokeCircle(p.x, p.y, 9);
    g.fillStyle(0xf2777e, 1);
    g.fillCircle(p.x - 2.6, p.y - 1.5, 3);
    g.fillCircle(p.x + 2.6, p.y - 1.5, 3);
    g.fillTriangle(p.x - 5.4, p.y - 0.5, p.x + 5.4, p.y - 0.5, p.x, p.y + 5);
  }
}

// ---------------------------------------------------------------------------
// Cardboard shelter box

export function drawBoxBack(g: G, x: number, y: number, alpha = 1) {
  const i = 0.14;
  const H = 26;
  const x0 = x + i;
  const y0 = y + i;
  const x1 = x + 1 - i;
  const y1 = y + 1 - i;
  poly(g, [gp(x0, y0), gp(x1, y0), gp(x1, y1), gp(x0, y1)], PAL.cardInside, alpha);
  // inner faces of the far walls
  poly(g, [gp(x0, y0), gp(x1, y0), gp(x1, y0, H), gp(x0, y0, H)], 0xb48654, alpha);
  poly(g, [gp(x0, y0), gp(x0, y1), gp(x0, y1, H), gp(x0, y0, H)], 0xa77b4b, alpha);
  // back flaps
  poly(g, [gp(x0, y0, H), gp(x1, y0, H), gp(x1 - 0.05, y0 - 0.3, H + 14), gp(x0 + 0.05, y0 - 0.3, H + 14)], PAL.cardTop, alpha, PAL.ink, 2);
  poly(g, [gp(x0, y0, H), gp(x0, y1, H), gp(x0 - 0.3, y1 - 0.05, H + 14), gp(x0 - 0.3, y0 + 0.05, H + 14)], PAL.card, alpha, PAL.ink, 2);
}

export function drawBoxFront(g: G, x: number, y: number, alpha = 1) {
  const i = 0.14;
  const H = 26;
  const x0 = x + i;
  const y0 = y + i;
  const x1 = x + 1 - i;
  const y1 = y + 1 - i;
  poly(g, [gp(x1, y0), gp(x1, y1), gp(x1, y1, H), gp(x1, y0, H)], PAL.cardDark, alpha);
  poly(g, [gp(x0, y1), gp(x1, y1), gp(x1, y1, H), gp(x0, y1, H)], PAL.card, alpha);
  g.lineStyle(2.4, PAL.ink, alpha);
  g.strokePoints([gp(x0, y1, H), gp(x0, y1), gp(x1, y1), gp(x1, y0), gp(x1, y0, H)] as Phaser.Types.Math.Vector2Like[], false);
  const cc = gp(x1, y1);
  g.lineBetween(cc.x, cc.y, cc.x, cc.y - H);
  // tape
  const ta = gp((x0 + x1) / 2, y1, 0);
  g.lineStyle(5, 0xe9d3a6, alpha);
  g.lineBetween(ta.x, ta.y - 1, ta.x, ta.y - H + 1);
  // front flaps
  poly(g, [gp(x0, y1, H), gp(x1, y1, H), gp(x1 - 0.05, y1 + 0.28, H + 12), gp(x0 + 0.05, y1 + 0.28, H + 12)], PAL.cardTop, alpha, PAL.ink, 2);
  poly(g, [gp(x1, y0, H), gp(x1, y1, H), gp(x1 + 0.28, y1 - 0.05, H + 12), gp(x1 + 0.28, y0 + 0.05, H + 12)], 0xe3b77f, alpha, PAL.ink, 2);
}

// ---------------------------------------------------------------------------
// Overlays

export function fillCell(g: G, x: number, y: number, color: number, alpha: number, inset = 0.04) {
  const pts = [gp(x + inset, y + inset), gp(x + 1 - inset, y + inset), gp(x + 1 - inset, y + 1 - inset), gp(x + inset, y + 1 - inset)];
  g.fillStyle(color, alpha);
  g.fillPoints(pts as Phaser.Types.Math.Vector2Like[], true);
}

export function strokeCell(g: G, x: number, y: number, color: number, alpha: number, width = 2, inset = 0.06) {
  const pts = [gp(x + inset, y + inset), gp(x + 1 - inset, y + inset), gp(x + 1 - inset, y + 1 - inset), gp(x + inset, y + 1 - inset)];
  g.lineStyle(width, color, alpha);
  g.strokePoints(pts as Phaser.Types.Math.Vector2Like[], true);
}
