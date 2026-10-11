// Procedural cartoon cats as SVG. One generator, many fur patterns and poses —
// the same art is used in the game board (rasterised into Phaser textures)
// and in the shelter (inline SVG with CSS animation hooks).
//
// All poses face right in a 128×128 box, ground line at y≈114.

import type { CatLook } from '../core/types';
import { darken, lighten, luminance, mix } from './color';

export type CatPose =
  | 'sit'
  | 'stand'
  | 'walk1'
  | 'walk2'
  | 'eat'
  | 'curious'
  | 'scared'
  | 'hide'
  | 'sleep'
  | 'groom'
  | 'play';

export const CAT_POSES: CatPose[] = ['sit', 'stand', 'walk1', 'walk2', 'eat', 'curious', 'scared', 'hide', 'sleep', 'groom', 'play'];

type Shape = { t: 'e'; cx: number; cy: number; rx: number; ry: number; rot?: number } | { t: 'p'; d: string };

interface HeadDef {
  cx: number;
  cy: number;
  tilt?: number;
  ears?: 'up' | 'perk' | 'flat' | 'relaxed';
  eyes?: 'open' | 'wide' | 'closed' | 'happy' | 'sparkle';
  mouth?: 'smile' | 'o' | 'tongue' | 'none';
}

interface PoseDef {
  far: Shape[];
  near: Shape[];
  body: Shape[];
  tail: { d: string; w: number } | null;
  tailFront?: boolean;
  head: HeadDef;
  chest: Shape[];
  patchA: Shape[];
  patchB: Shape[];
  stripes: string[];
  paws: Shape[];
  /** extra shapes drawn after the head (raised paw) */
  front?: Shape[];
  /** horizontal shift so the pose fits the 128px box */
  dx?: number;
  /** index in `near` of the near front leg (left out for three-legged cats) */
  nearFront?: number;
}

const e = (cx: number, cy: number, rx: number, ry: number, rot?: number): Shape => ({ t: 'e', cx, cy, rx, ry, rot });
const p = (d: string): Shape => ({ t: 'p', d });

/** Filled capsule between two points — a leg. */
function cap(x1: number, y1: number, x2: number, y2: number, r: number): Shape {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * r;
  const ny = (dx / len) * r;
  const f = (n: number) => n.toFixed(2);
  return p(
    `M${f(x1 + nx)} ${f(y1 + ny)} L${f(x2 + nx)} ${f(y2 + ny)} A${r} ${r} 0 0 0 ${f(x2 - nx)} ${f(y2 - ny)} L${f(x1 - nx)} ${f(y1 - ny)} A${r} ${r} 0 0 0 ${f(x1 + nx)} ${f(y1 + ny)} Z`,
  );
}

const SIT_BODY = [e(47, 100, 16, 14), e(60, 89, 21, 24)];
const SIT_TAIL = { d: 'M44 107 C30 115 15 109 17 95 C18 87 25 85 28 91', w: 9 };

const POSES: Record<CatPose, PoseDef> = {
  sit: {
    nearFront: 0,
    far: [cap(75, 92, 77, 112, 4.6)],
    near: [cap(66, 92, 66, 112, 5), e(42, 112, 9, 4)],
    body: SIT_BODY,
    tail: SIT_TAIL,
    head: { cx: 71, cy: 58 },
    chest: [e(69, 90, 10, 16)],
    patchA: [e(50, 80, 13, 11), e(40, 104, 8, 7)],
    patchB: [e(57, 100, 8, 7)],
    stripes: ['M47 72 q7 4 5 13', 'M41 83 q8 3 7 12', 'M36 96 q8 2 8 10', 'M54 70 q5 5 3 12'],
    paws: [e(66, 112, 6, 4), e(77, 112, 5.5, 3.8), e(42, 112, 9, 4)],
  },
  stand: {
    nearFront: 1,
    far: [cap(42, 92, 43, 112, 4.5), cap(80, 92, 81, 112, 4.5)],
    near: [cap(48, 92, 48, 112, 5), cap(86, 92, 86, 112, 5)],
    body: [e(62, 86, 30, 16)],
    tail: { d: 'M34 82 C23 74 19 60 26 50 C29 45 35 47 33 52', w: 8 },
    head: { cx: 94, cy: 64 },
    chest: [e(84, 90, 10, 10)],
    patchA: [e(52, 78, 14, 9)],
    patchB: [e(72, 82, 8, 7)],
    stripes: ['M50 71 q-3 7 0 14', 'M60 70 q-3 8 0 16', 'M70 71 q-3 7 0 14', 'M40 75 q-2 6 1 12'],
    paws: [e(48, 112, 6, 4), e(86, 112, 6, 4), e(43, 112, 5.5, 3.8), e(81, 112, 5.5, 3.8)],
  },
  walk1: {
    nearFront: 1,
    far: [cap(40, 92, 46, 112, 4.5), cap(80, 92, 74, 112, 4.5)],
    near: [cap(50, 92, 42, 112, 5), cap(86, 92, 94, 112, 5)],
    body: [e(62, 85, 30, 16)],
    tail: { d: 'M34 81 C23 73 19 59 27 49 C30 45 35 47 33 52', w: 8 },
    head: { cx: 94, cy: 63 },
    chest: [e(84, 89, 10, 10)],
    patchA: [e(52, 77, 14, 9)],
    patchB: [e(72, 81, 8, 7)],
    stripes: ['M50 70 q-3 7 0 14', 'M60 69 q-3 8 0 16', 'M70 70 q-3 7 0 14', 'M40 74 q-2 6 1 12'],
    paws: [e(42, 112, 6, 4), e(94, 112, 6, 4), e(46, 112, 5.5, 3.8), e(74, 112, 5.5, 3.8)],
  },
  walk2: {
    nearFront: 1,
    far: [cap(40, 92, 34, 112, 4.5), cap(80, 92, 88, 112, 4.5)],
    near: [cap(50, 92, 56, 112, 5), cap(86, 92, 80, 112, 5)],
    body: [e(62, 87, 30, 16)],
    tail: { d: 'M34 83 C24 76 21 62 25 52 C28 46 34 47 33 53', w: 8 },
    head: { cx: 94, cy: 65 },
    chest: [e(84, 91, 10, 10)],
    patchA: [e(52, 79, 14, 9)],
    patchB: [e(72, 83, 8, 7)],
    stripes: ['M50 72 q-3 7 0 14', 'M60 71 q-3 8 0 16', 'M70 72 q-3 7 0 14', 'M40 76 q-2 6 1 12'],
    paws: [e(56, 112, 6, 4), e(80, 112, 6, 4), e(34, 112, 5.5, 3.8), e(88, 112, 5.5, 3.8)],
  },
  eat: {
    nearFront: 1,
    far: [cap(38, 94, 39, 112, 4.5), cap(76, 96, 78, 112, 4.5)],
    near: [cap(44, 94, 44, 112, 5), cap(82, 96, 84, 112, 5)],
    body: [e(57, 90, 30, 15, 9)],
    tail: { d: 'M30 85 C20 77 18 62 24 53 C27 49 32 50 31 55', w: 8 },
    head: { cx: 93, cy: 91, tilt: 12, eyes: 'happy', mouth: 'tongue' },
    chest: [e(80, 98, 9, 8)],
    patchA: [e(48, 82, 14, 9, 9)],
    patchB: [e(66, 88, 8, 7)],
    stripes: ['M46 75 q-3 7 0 14', 'M56 76 q-3 8 0 16', 'M66 79 q-3 7 0 14', 'M36 76 q-2 6 1 12'],
    paws: [e(44, 112, 6, 4), e(84, 112, 6, 4), e(39, 112, 5.5, 3.8), e(78, 112, 5.5, 3.8)],
  },
  curious: {
    nearFront: 0,
    far: [cap(75, 92, 77, 112, 4.6)],
    near: [cap(66, 92, 66, 112, 5), e(42, 112, 9, 4)],
    body: SIT_BODY,
    tail: { d: 'M44 104 C28 98 25 74 31 61 C35 51 46 52 44 61', w: 8 },
    head: { cx: 72, cy: 55, tilt: -10, ears: 'perk', eyes: 'sparkle' },
    chest: [e(69, 90, 10, 16)],
    patchA: [e(50, 80, 13, 11), e(40, 104, 8, 7)],
    patchB: [e(57, 100, 8, 7)],
    stripes: ['M47 72 q7 4 5 13', 'M41 83 q8 3 7 12', 'M36 96 q8 2 8 10', 'M54 70 q5 5 3 12'],
    paws: [e(66, 112, 6, 4), e(77, 112, 5.5, 3.8), e(42, 112, 9, 4)],
  },
  scared: {
    nearFront: 1,
    far: [cap(38, 94, 35, 113, 4.4), cap(86, 92, 89, 113, 4.4)],
    near: [cap(44, 94, 43, 114, 5), cap(92, 92, 95, 114, 5)],
    body: [p('M30 100 C27 70 50 55 65 56 C82 58 95 72 95 98 C82 88 46 88 30 100 Z')],
    tail: { d: 'M33 92 C21 82 19 66 25 49', w: 15 },
    head: { cx: 99, cy: 75, ears: 'flat', eyes: 'wide', mouth: 'o' },
    chest: [e(90, 92, 7, 9)],
    patchA: [e(56, 66, 14, 9)],
    patchB: [e(76, 70, 8, 6)],
    stripes: ['M50 62 q2 9 -2 16', 'M60 58 q2 9 -1 17', 'M70 59 q3 9 0 17', 'M80 64 q3 8 1 15'],
    paws: [e(43, 113, 6, 4), e(95, 113, 6, 4), e(35, 113, 5.5, 3.8), e(89, 113, 5.5, 3.8)],
    dx: -12,
  },
  hide: {
    nearFront: 0,
    far: [],
    near: [e(84, 112, 8, 4), e(42, 112, 8, 3.5)],
    body: [e(60, 103, 32, 12)],
    tail: { d: 'M30 107 C18 112 10 108 8 100', w: 8 },
    head: { cx: 90, cy: 93, ears: 'flat', eyes: 'wide', mouth: 'none' },
    chest: [e(80, 108, 9, 5)],
    patchA: [e(50, 98, 14, 7)],
    patchB: [e(68, 99, 8, 6)],
    stripes: ['M48 92 q-2 6 0 12', 'M58 91 q-2 7 0 13', 'M68 92 q-2 6 0 12'],
    paws: [e(84, 112, 8, 4), e(42, 112, 8, 3.5)],
    dx: -8,
  },
  sleep: {
    nearFront: 0,
    far: [],
    near: [e(76, 112, 9, 4)],
    body: [e(61, 99, 36, 17)],
    tail: { d: 'M27 101 C25 118 70 122 98 113', w: 9 },
    tailFront: true,
    head: { cx: 88, cy: 94, tilt: 14, ears: 'relaxed', eyes: 'closed', mouth: 'smile' },
    chest: [e(80, 104, 10, 7)],
    patchA: [e(48, 92, 15, 10)],
    patchB: [e(66, 88, 9, 7)],
    stripes: ['M42 85 q-2 8 1 15', 'M52 83 q-2 9 1 17', 'M62 83 q-2 9 1 17', 'M72 85 q-2 8 1 14'],
    paws: [e(76, 112, 9, 4)],
  },
  groom: {
    far: [cap(75, 92, 77, 112, 4.6)],
    near: [e(42, 112, 9, 4)],
    body: SIT_BODY,
    tail: SIT_TAIL,
    head: { cx: 70, cy: 58, tilt: -12, eyes: 'happy', mouth: 'tongue' },
    chest: [e(69, 90, 10, 16)],
    patchA: [e(50, 80, 13, 11), e(40, 104, 8, 7)],
    patchB: [e(57, 100, 8, 7)],
    stripes: ['M47 72 q7 4 5 13', 'M41 83 q8 3 7 12', 'M36 96 q8 2 8 10', 'M54 70 q5 5 3 12'],
    paws: [e(77, 112, 5.5, 3.8), e(42, 112, 9, 4), e(80, 72, 6, 5)],
    front: [cap(66, 94, 80, 73, 5)],
  },
  play: {
    nearFront: 1,
    far: [cap(40, 82, 42, 112, 4.5), cap(80, 98, 92, 112, 4.5)],
    near: [cap(46, 84, 46, 112, 5), cap(84, 100, 99, 112, 5)],
    body: [e(61, 88, 30, 15, 14)],
    tail: { d: 'M35 77 C25 64 35 52 27 40', w: 8 },
    head: { cx: 98, cy: 90, tilt: 8, ears: 'perk', eyes: 'sparkle', mouth: 'smile' },
    chest: [e(84, 98, 9, 8)],
    patchA: [e(52, 80, 14, 9, 14)],
    patchB: [e(70, 90, 8, 7)],
    stripes: ['M47 72 q-1 8 2 14', 'M57 75 q-1 8 2 15', 'M67 80 q-1 8 2 14', 'M38 70 q0 6 2 11'],
    paws: [e(46, 112, 6, 4), e(99, 112, 6, 4), e(42, 112, 5.5, 3.8), e(92, 112, 5.5, 3.8)],
    dx: -7,
  },
};

function shapeEl(s: Shape, attrs: string): string {
  if (s.t === 'e') {
    const rot = s.rot ? ` transform="rotate(${s.rot} ${s.cx} ${s.cy})"` : '';
    return `<ellipse cx="${s.cx}" cy="${s.cy}" rx="${s.rx}" ry="${s.ry}"${rot} ${attrs}/>`;
  }
  return `<path d="${s.d}" ${attrs}/>`;
}

function headShapes(h: HeadDef): Shape[] {
  const { cx, cy } = h;
  return [e(cx, cy, 24, 20), e(cx - 13, cy + 7, 10, 8), e(cx + 16, cy + 7, 10, 8)];
}

type Tri = [number, number, number, number, number, number];

function earTris(h: HeadDef): [Tri, Tri] {
  const { cx, cy } = h;
  switch (h.ears ?? 'up') {
    case 'perk':
      return [
        [cx - 21, cy - 6, cx - 18, cy - 34, cx - 2, cy - 17],
        [cx + 6, cy - 17, cx + 21, cy - 34, cx + 24, cy - 6],
      ];
    case 'flat':
      return [
        [cx - 20, cy - 6, cx - 34, cy - 15, cx - 9, cy - 16],
        [cx + 13, cy - 16, cx + 38, cy - 15, cx + 25, cy - 5],
      ];
    case 'relaxed':
      return [
        [cx - 22, cy - 4, cx - 23, cy - 28, cx - 5, cy - 17],
        [cx + 6, cy - 17, cx + 22, cy - 29, cx + 25, cy - 5],
      ];
    default:
      return [
        [cx - 21, cy - 6, cx - 18, cy - 30, cx - 3, cy - 17],
        [cx + 5, cy - 17, cx + 20, cy - 30, cx + 24, cy - 6],
      ];
  }
}

function triPath(t: Tri): string {
  return `M${t[0]} ${t[1]} L${t[2]} ${t[3]} L${t[4]} ${t[5]} Z`;
}

function innerTri(t: Tri): Tri {
  const mx = (t[0] + t[2] + t[4]) / 3;
  const my = (t[1] + t[3] + t[5]) / 3;
  const k = 0.52;
  const f = (x: number, m: number) => +(m + (x - m) * k).toFixed(2);
  // pull the inner triangle slightly toward the base so it reads as an ear hollow
  return [f(t[0], mx), f(t[1], my) + 1.5, f(t[2], mx), f(t[3], my) + 2, f(t[4], mx), f(t[5], my) + 1.5];
}

export interface CatSvgOptions {
  size?: number;
  /** unique id prefix (needed when several svgs live in one document) */
  uid?: string;
  /** add CSS class hooks (.cat-tail, .cat-head, .cat-body, .cat-eyes) for shelter animations */
  hooks?: boolean;
}

let uidCounter = 0;

function threeLegged(P: PoseDef): PoseDef {
  const near = P.nearFront === undefined ? P.near : P.near.filter((_, i) => i !== P.nearFront);
  // grooming normally lifts the near front paw — without it the cat just tilts its head
  return { ...P, near, front: undefined };
}

export function catSvg(look: CatLook, pose: CatPose, opts: CatSvgOptions = {}): string {
  const P = look.legs === 3 ? threeLegged(POSES[pose]) : POSES[pose];
  const size = opts.size ?? 128;
  const id = opts.uid ?? `cat${++uidCounter}`;
  const base = look.base;
  const dark = luminance(base) < 0.35;
  const outline = mix(base, '#2a1c20', dark ? 0.55 : 0.62);
  const farFill = darken(base, 0.18);
  const ow = 4.2;
  const ink = '#2b2226';
  const pattern = look.pattern;
  const points = look.stripe; // siamese points / tabby stripes / calico dark patches
  const accent = look.accent;
  const H = P.head;

  const earsT = earTris(H);
  const head = headShapes(H);
  const silhouette = [...P.far, ...P.body, ...P.near, ...(P.front ?? [])];

  const strokeAll = (shapes: Shape[], color: string, w: number) =>
    shapes.map((s) => shapeEl(s, `fill="${color}" stroke="${color}" stroke-width="${w}" stroke-linejoin="round"`)).join('');

  const fills = (shapes: Shape[], color: string) => shapes.map((s) => shapeEl(s, `fill="${color}"`)).join('');

  const tailStroke = (w: number, color: string, extra = '', cap: 'round' | 'butt' = 'round') =>
    P.tail ? `<path d="${P.tail.d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="${cap}" stroke-linejoin="round" ${extra}/>` : '';

  // ---- tail -----------------------------------------------------------------
  const tailColor = pattern === 'siamese' || pattern === 'bicolor' ? points : base;
  let tail = '';
  if (P.tail) {
    tail += tailStroke(P.tail.w + ow * 2, outline);
    tail += tailStroke(P.tail.w, tailColor);
    if (pattern === 'tabby') tail += tailStroke(P.tail.w, points, 'stroke-dasharray="4 6" opacity="0.9"', 'butt');
    if (pattern === 'calico') tail += tailStroke(P.tail.w, accent, 'pathLength="100" stroke-dasharray="0 55 45"');
    if (pattern === 'tuxedo') tail += tailStroke(P.tail.w * 0.8, accent, 'pathLength="100" stroke-dasharray="0 88 12"');
    tail += tailStroke(Math.max(2, P.tail.w * 0.35), lighten(tailColor, 0.22), 'opacity="0.35" transform="translate(-1 -1.5)"');
  }

  // ---- ears -------------------------------------------------------------------
  const earColor = pattern === 'siamese' ? points : base;
  // bicolor: the ear on the spotted side is black
  const earFill = (i: number) => (pattern === 'bicolor' && i === 0 ? accent : earColor);
  const innerEar = dark ? '#c98d93' : '#f3a7a5';
  const ears =
    earsT.map((t) => `<path d="${triPath(t)}" fill="${outline}" stroke="${outline}" stroke-width="${ow * 2}" stroke-linejoin="round"/>`).join('') +
    earsT.map((t, i) => `<path d="${triPath(t)}" fill="${earFill(i)}" stroke="${earFill(i)}" stroke-width="2.5" stroke-linejoin="round"/>`).join('') +
    earsT.map((t) => `<path d="${triPath(innerTri(t))}" fill="${innerEar}" stroke="${innerEar}" stroke-width="1.5" stroke-linejoin="round"/>`).join('');

  // ---- patterns on body ------------------------------------------------------
  let bodyPattern = '';
  let headPattern = '';
  const { cx, cy } = H;
  switch (pattern) {
    case 'tabby':
      bodyPattern += P.stripes.map((d) => `<path d="${d}" fill="none" stroke="${points}" stroke-width="4" stroke-linecap="round" opacity="0.85"/>`).join('');
      bodyPattern += fills(P.chest, accent);
      headPattern += [`M${cx - 3} ${cy - 18} l1 7`, `M${cx + 3} ${cy - 19} l0 8`, `M${cx + 9} ${cy - 18} l-1 7`, `M${cx - 24} ${cy + 1} l7 1.5`, `M${cx + 31} ${cy + 1} l-7 1.5`]
        .map((d) => `<path d="${d}" stroke="${points}" stroke-width="2.6" stroke-linecap="round" opacity="0.9"/>`)
        .join('');
      headPattern += `<ellipse cx="${cx + 3}" cy="${cy + 10}" rx="9" ry="6.5" fill="${accent}" opacity="0.9"/>`;
      break;
    case 'tuxedo':
      bodyPattern += fills(P.chest, accent) + fills(P.paws, accent);
      headPattern += `<path d="M${cx + 3} ${cy - 9} C${cx - 2} ${cy + 2} ${cx - 8} ${cy + 8} ${cx - 6} ${cy + 15} L${cx + 13} ${cy + 15} C${cx + 15} ${cy + 8} ${cx + 9} ${cy + 2} ${cx + 3} ${cy - 9} Z" fill="${accent}"/>`;
      headPattern += `<ellipse cx="${cx + 3}" cy="${cy + 11}" rx="11" ry="7" fill="${accent}"/>`;
      break;
    case 'calico':
      bodyPattern += fills(P.patchA, accent) + fills(P.patchB, points);
      headPattern += `<ellipse cx="${cx - 13}" cy="${cy - 9}" rx="13" ry="11" fill="${accent}"/><ellipse cx="${cx + 17}" cy="${cy - 12}" rx="9" ry="8" fill="${points}"/>`;
      break;
    case 'bicolor':
      // white cat with black spots on the back and the head
      bodyPattern += fills(P.patchA, accent) + fills(P.patchB, accent);
      headPattern += `<ellipse cx="${cx - 12}" cy="${cy - 10}" rx="14" ry="11" fill="${accent}"/><ellipse cx="${cx + 14}" cy="${cy - 15}" rx="6" ry="4.5" fill="${accent}"/>`;
      break;
    case 'siamese':
      bodyPattern += fills(P.paws, points);
      bodyPattern += fills(P.chest, lighten(base, 0.35));
      headPattern += `<ellipse cx="${cx + 3}" cy="${cy + 6}" rx="13" ry="11.5" fill="${points}" opacity="0.88"/>`;
      break;
    default:
      bodyPattern += P.chest.map((s) => shapeEl(s, `fill="${accent}" opacity="0.55"`)).join('');
      headPattern += `<ellipse cx="${cx + 3}" cy="${cy + 10}" rx="9" ry="6.5" fill="${accent}" opacity="0.55"/>`;
  }

  // ---- face -------------------------------------------------------------------
  const ex1 = cx - 6;
  const ex2 = cx + 12;
  const ey = cy + 1;
  const eyeMode = H.eyes ?? 'open';
  const eye = (x: number) => {
    switch (eyeMode) {
      case 'closed':
        return `<path d="M${x - 4.5} ${ey} Q${x} ${ey + 3.8} ${x + 4.5} ${ey}" fill="none" stroke="${ink}" stroke-width="1.9" stroke-linecap="round"/>`;
      case 'happy':
        return `<path d="M${x - 4.5} ${ey + 1.5} Q${x} ${ey - 3.5} ${x + 4.5} ${ey + 1.5}" fill="none" stroke="${ink}" stroke-width="1.9" stroke-linecap="round"/>`;
      case 'wide':
        return `<circle cx="${x}" cy="${ey}" r="6" fill="#fffdf6" stroke="${ink}" stroke-width="1.1"/><circle cx="${x + 0.5}" cy="${ey + 0.3}" r="3.6" fill="${look.eyes}"/><circle cx="${x + 0.6}" cy="${ey + 0.4}" r="2.2" fill="${ink}"/><circle cx="${x + 1.8}" cy="${ey - 1.6}" r="1.2" fill="#fff"/>`;
      default: {
        const big = eyeMode === 'sparkle';
        const rx = big ? 5.2 : 4.6;
        const ry = big ? 6.3 : 5.8;
        return (
          `<ellipse cx="${x}" cy="${ey}" rx="${rx}" ry="${ry}" fill="${look.eyes}" stroke="${ink}" stroke-width="1.1"/>` +
          `<ellipse cx="${x + 0.4}" cy="${ey + 0.5}" rx="${big ? 3.2 : 2.5}" ry="${big ? 4.8 : 4.4}" fill="${ink}"/>` +
          `<circle cx="${x + 1.7}" cy="${ey - 2.1}" r="${big ? 2 : 1.7}" fill="#fff"/>` +
          `<circle cx="${x - 1.4}" cy="${ey + 2.3}" r="0.9" fill="#fff" opacity="0.85"/>`
        );
      }
    }
  };
  const noseC = dark ? '#d98f95' : '#e8898c';
  const nose = `<path d="M${cx + 0.4} ${cy + 6.6} Q${cx + 3} ${cy + 5.4} ${cx + 5.6} ${cy + 6.6} L${cx + 3} ${cy + 9.6} Z" fill="${noseC}" stroke="${darken(noseC, 0.3)}" stroke-width="0.6" stroke-linejoin="round"/>`;
  let mouth = '';
  const mouthMode = H.mouth ?? 'smile';
  const ms = `fill="none" stroke="${ink}" stroke-width="1.35" stroke-linecap="round"`;
  if (mouthMode === 'smile' || mouthMode === 'tongue') {
    mouth = `<path d="M${cx + 3} ${cy + 9.6} Q${cx + 1} ${cy + 12.8} ${cx - 1.6} ${cy + 11.2}" ${ms}/><path d="M${cx + 3} ${cy + 9.6} Q${cx + 5} ${cy + 12.8} ${cx + 7.6} ${cy + 11.2}" ${ms}/>`;
    if (mouthMode === 'tongue') mouth += `<ellipse cx="${cx + 3}" cy="${cy + 13.2}" rx="2.1" ry="1.8" fill="#ef8d97"/>`;
  } else if (mouthMode === 'o') {
    mouth = `<ellipse cx="${cx + 3}" cy="${cy + 12.6}" rx="2.3" ry="2.7" fill="#9c4a55" stroke="${ink}" stroke-width="0.9"/>`;
  }
  const blush = `<ellipse cx="${cx - 11}" cy="${cy + 9}" rx="3.8" ry="2.3" fill="#f2878a" opacity="0.42"/><ellipse cx="${cx + 18}" cy="${cy + 9}" rx="3.8" ry="2.3" fill="#f2878a" opacity="0.42"/>`;
  const wc = dark ? 'rgba(255,255,255,0.65)' : 'rgba(60,40,40,0.35)';
  const whiskers = [
    [cx - 9, cy + 8, cx - 25, cy + 5.5],
    [cx - 9, cy + 10.5, cx - 24, cy + 12.5],
    [cx + 15, cy + 8, cx + 31, cy + 5.5],
    [cx + 15, cy + 10.5, cx + 30, cy + 12.5],
  ]
    .map(([a, b, c, d]) => `<line x1="${a}" y1="${b}" x2="${c}" y2="${d}" stroke="${wc}" stroke-width="0.9" stroke-linecap="round"/>`)
    .join('');

  // ---- assemble ---------------------------------------------------------------
  const clipBody = `${id}b`;
  const clipHead = `${id}h`;
  const grad = `${id}g`;
  const hk = (c: string) => (opts.hooks ? ` class="${c}"` : '');
  const tilt = H.tilt ? ` transform="rotate(${H.tilt} ${cx} ${cy + 4})"` : '';

  const defs =
    `<defs>` +
    `<clipPath id="${clipBody}">${fills(silhouette, '#000')}</clipPath>` +
    `<clipPath id="${clipHead}">${fills(head, '#000')}</clipPath>` +
    `<linearGradient id="${grad}" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#fff" stop-opacity="0.24"/><stop offset="0.45" stop-color="#fff" stop-opacity="0"/>` +
    `<stop offset="1" stop-color="#2a1c20" stop-opacity="0.2"/></linearGradient>` +
    `</defs>`;

  const tailGroup = `<g${hk('cat-tail')}>${tail}</g>`;
  const bodyGroup =
    `<g${hk('cat-body')}>` +
    strokeAll(silhouette, outline, ow * 2) +
    fills(P.far, farFill) +
    fills(P.body, base) +
    fills(P.near, base) +
    fills(P.front ?? [], base) +
    `<g clip-path="url(#${clipBody})">${bodyPattern}<rect x="0" y="40" width="128" height="80" fill="url(#${grad})"/></g>` +
    `</g>`;
  const headGroup =
    `<g${hk('cat-head')}${tilt}>` +
    ears +
    strokeAll(head, outline, ow * 2) +
    fills(head, base) +
    `<g clip-path="url(#${clipHead})">${headPattern}<rect x="${cx - 30}" y="${cy - 24}" width="60" height="48" fill="url(#${grad})"/></g>` +
    blush +
    `<g${hk('cat-eyes')}>${eye(ex1)}${eye(ex2)}</g>` +
    nose +
    mouth +
    whiskers +
    `</g>`;
  const frontGroup = P.front
    ? `<g>${strokeAll(P.front, outline, ow * 2)}${fills(P.front, base)}${pattern === 'tuxedo' || pattern === 'siamese' ? fills([P.paws[P.paws.length - 1]], pattern === 'tuxedo' ? accent : points) : ''}</g>`
    : '';

  const order = P.tailFront ? bodyGroup + headGroup + tailGroup : tailGroup + bodyGroup + headGroup + frontGroup;

  const shifted = P.dx ? `<g transform="translate(${P.dx} 0)">${defs}${order}</g>` : defs + order;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="${size}" height="${size}">${shifted}</svg>`;
}

/** Small round portrait (head only) for HUD and cards. */
export function catPortraitSvg(look: CatLook, size = 64, uid?: string): string {
  const full = catSvg(look, 'sit', { size, uid });
  // crop to the head region of the sit pose
  return full.replace('viewBox="0 0 128 128"', 'viewBox="36 22 72 72"');
}
