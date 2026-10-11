// Rooms of the shelter house. Every room is a strip of wall + floor with
// furniture and twelve spots where rescued cats settle in order of arrival.
// Furniture and spots are placed by their centre in % of the room width and
// sized by the room height (cqh), so a room can stretch sideways to fill any
// screen without breaking the layout. Spot `y` is where the cat's feet are,
// in % of the room height (1% == 1cqh).

import type { CatPose } from '../art/cats';

export interface Slot {
  x: string;
  y: number;
  size: number;
  pose: CatPose;
  flip?: boolean;
}

export interface Decor {
  svg: string;
  /** centre, CSS length (usually % of the room width) */
  x: string;
  /** top edge, % of the room height */
  y: number;
  /** height in cqh */
  h: number;
  /** width / height of the svg viewBox */
  ar: number;
  /** stretch to this CSS width instead of keeping the aspect ratio */
  w?: string;
}

export interface Room {
  id: string;
  name: string;
  wall: string;
  floor: string;
  baseboard?: string;
  decor: Decor[];
  slots: Slot[];
}

const WOOD = '#c9966b';
const LINE = '#8a5f3e';

const svg = (vb: string, body: string) => `<svg viewBox="${vb}" aria-hidden="true">${body}</svg>`;

function range(from: number, to: number, step: number): number[] {
  const out: number[] = [];
  for (let v = from; v <= to; v += step) out.push(v);
  return out;
}

/** a string of little things hanging along a sagging cord */
function sagging(n: number, item: (x: number, y: number, i: number) => string): string {
  let out = `<path d="M4 10 Q300 56 596 10" fill="none" stroke="${LINE}" stroke-width="3"/>`;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const x = 4 + 592 * t;
    const y = (1 - t) ** 2 * 10 + 2 * (1 - t) * t * 56 + t * t * 10;
    out += item(x, y, i);
  }
  return out;
}

// ---------------------------------------------------------------------------
// 1. Living room (the original shelter room)

const livingWindow = svg(
  '0 0 300 260',
  `<rect x="10" y="10" width="280" height="220" rx="16" fill="#cfe9f1" stroke="#a7795a" stroke-width="12" />
  <circle cx="220" cy="70" r="28" fill="#fff3c4" />
  <path d="M22 170 C80 130 140 150 200 140 C240 132 270 150 288 146 V222 H22 Z" fill="#b8d79a" />
  <path d="M150 16 V226 M16 120 H286" stroke="#a7795a" stroke-width="8" />
  <path d="M0 0 C40 60 30 160 60 250 L0 250 Z" fill="#f4b9a6" opacity="0.95" />
  <path d="M300 0 C260 60 270 160 240 250 L300 250 Z" fill="#f4b9a6" opacity="0.95" />
  <rect x="-6" y="226" width="312" height="22" rx="8" fill="${WOOD}" stroke="${LINE}" stroke-width="5" />`,
);
const frame = svg(
  '0 0 120 100',
  `<rect x="5" y="5" width="110" height="90" rx="8" fill="#fff6e6" stroke="${WOOD}" stroke-width="8" />
  <path d="M30 70 C30 52 46 44 60 44 C74 44 90 52 90 70 Z" fill="#f2a65a" />
  <path d="M40 48 L44 30 L54 42 Z M66 42 L76 30 L80 48 Z" fill="#f2a65a" />
  <circle cx="52" cy="56" r="3" fill="#4c3b3a" /><circle cx="68" cy="56" r="3" fill="#4c3b3a" />`,
);
const plantShelf = svg(
  '0 0 260 120',
  `<rect x="0" y="86" width="260" height="14" rx="6" fill="${WOOD}" stroke="${LINE}" stroke-width="4" />
  <path d="M40 86 L46 56 L74 56 L80 86 Z" fill="#e8907a" stroke="${LINE}" stroke-width="4" stroke-linejoin="round" />
  <path d="M60 56 C40 30 46 12 58 6 C60 24 62 36 60 56 M60 56 C76 34 90 32 96 38 C82 42 72 48 60 56" fill="#8cbc69" stroke="#4e7a45" stroke-width="3" />
  <rect x="120" y="50" width="34" height="36" rx="4" fill="#8fd0b4" stroke="${LINE}" stroke-width="4" />
  <rect x="158" y="40" width="26" height="46" rx="4" fill="#f2c46d" stroke="${LINE}" stroke-width="4" />
  <path d="M206 86 L210 64 L234 64 L238 86 Z" fill="#a9d6e8" stroke="${LINE}" stroke-width="4" stroke-linejoin="round" />
  <circle cx="222" cy="54" r="14" fill="#f7b2c0" stroke="#d86f7a" stroke-width="3" />`,
);
const catTree = svg(
  '0 0 200 520',
  `<rect x="88" y="90" width="26" height="420" rx="10" fill="#e9d3a6" stroke="${LINE}" stroke-width="5" />
  ${[150, 230, 310, 390, 470].map((y) => `<path d="M88 ${y} H114" stroke="#c9b083" stroke-width="3" />`).join('')}
  <ellipse cx="100" cy="96" rx="80" ry="22" fill="#c4b5ef" stroke="${LINE}" stroke-width="5" />
  <ellipse cx="100" cy="338" rx="72" ry="20" fill="#c4b5ef" stroke="${LINE}" stroke-width="5" />
  <rect x="20" y="490" width="160" height="26" rx="12" fill="#c4b5ef" stroke="${LINE}" stroke-width="5" />
  <circle cx="40" cy="380" r="9" fill="#f48fb1" stroke="${LINE}" stroke-width="3" /><path d="M40 338 V371" stroke="${LINE}" stroke-width="2" />`,
);
const ovalRug = svg(
  '0 0 400 120',
  `<ellipse cx="200" cy="60" rx="196" ry="56" fill="#f6c7a4" stroke="#d9946b" stroke-width="6" />
  <ellipse cx="200" cy="60" rx="150" ry="40" fill="none" stroke="#fde3c6" stroke-width="10" />
  <ellipse cx="200" cy="60" rx="96" ry="24" fill="none" stroke="#f2a65a" stroke-width="6" stroke-dasharray="14 10" />`,
);
const roundBed = (fill: string, rim: string, inner: string) =>
  svg(
    '0 0 240 110',
    `<ellipse cx="120" cy="70" rx="116" ry="38" fill="${fill}" stroke="${rim}" stroke-width="6" />
  <ellipse cx="120" cy="62" rx="88" ry="24" fill="${inner}" />`,
  );
const basket = svg(
  '0 0 240 120',
  `<path d="M14 50 C20 110 220 110 226 50 Z" fill="#d9a46b" stroke="${LINE}" stroke-width="6" stroke-linejoin="round" />
  ${[40, 70, 100, 130, 160, 190].map((x) => `<path d="M${x} 56 L${x + 6} 96" stroke="#b9844f" stroke-width="4" />`).join('')}
  <ellipse cx="120" cy="50" rx="108" ry="22" fill="#f6e7d3" stroke="${LINE}" stroke-width="6" />`,
);
const cushion = (fill: string, rim: string, inner: string) =>
  svg(
    '0 0 200 80',
    `<ellipse cx="100" cy="46" rx="94" ry="28" fill="${fill}" stroke="${rim}" stroke-width="6" />
  <ellipse cx="100" cy="40" rx="66" ry="14" fill="${inner}" />`,
  );
const bowls = svg(
  '0 0 180 60',
  `<ellipse cx="45" cy="38" rx="38" ry="14" fill="#6fa3c9" stroke="#4c3b3a" stroke-width="4" />
  <ellipse cx="45" cy="32" rx="30" ry="9" fill="#b9845a" />
  <ellipse cx="135" cy="38" rx="38" ry="14" fill="#f2a65a" stroke="#4c3b3a" stroke-width="4" />
  <ellipse cx="135" cy="32" rx="30" ry="9" fill="#bfe3ee" />`,
);
const yarn = svg(
  '0 0 80 60',
  `<circle cx="30" cy="30" r="22" fill="#f48fb1" stroke="#4c3b3a" stroke-width="4" />
  <path d="M14 24 q16 -12 32 4 M12 34 q18 -8 34 6" stroke="#fbc6d8" stroke-width="3" fill="none" />
  <path d="M50 42 q20 10 26 -6" stroke="#4c3b3a" stroke-width="3" fill="none" />`,
);

const living: Room = {
  id: 'living',
  name: 'Гостиная',
  wall: `repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.35) 0 22px, transparent 22px 60px),
    radial-gradient(circle at 30px 30px, rgba(242, 166, 90, 0.18) 3px, transparent 4px) 0 0 / 60px 60px,
    linear-gradient(180deg, #fbe9d3, #f6dcbd)`,
  floor: `repeating-linear-gradient(0deg, rgba(120, 80, 50, 0.16) 0 3px, transparent 3px 46px),
    repeating-linear-gradient(90deg, transparent 0 160px, rgba(120, 80, 50, 0.12) 160px 163px),
    linear-gradient(180deg, #d9a979, #c99366)`,
  decor: [
    { svg: livingWindow, x: '19.5%', y: 9, h: 34.2, ar: 300 / 260 },
    { svg: frame, x: '44.5%', y: 14, h: 11.8, ar: 120 / 100 },
    { svg: plantShelf, x: '62%', y: 22, h: 14.6, ar: 260 / 120 },
    { svg: catTree, x: '82%', y: 22, h: 66, ar: 200 / 520 },
    { svg: ovalRug, x: '50%', y: 70, h: 17, ar: 400 / 120 },
    { svg: roundBed('#8fd0b4', '#4fa786', '#dcf3e8'), x: '23%', y: 75, h: 15.9, ar: 240 / 110 },
    { svg: basket, x: '64%', y: 79, h: 16.6, ar: 240 / 120 },
    { svg: cushion('#f29aa3', '#d86f7a', '#fde5e7'), x: '37%', y: 61, h: 10.1, ar: 200 / 80 },
    { svg: bowls, x: '92.5%', y: 92, h: 6.8, ar: 180 / 60 },
    { svg: yarn, x: '62.5%', y: 70, h: 5.9, ar: 80 / 60 },
  ],
  slots: [
    { x: '23%', y: 84, size: 20, pose: 'sleep' },
    { x: '50%', y: 80, size: 21, pose: 'play' },
    { x: '82%', y: 34.8, size: 17, pose: 'sit', flip: true },
    { x: 'calc(19.5% - 9cqh)', y: 39.6, size: 16, pose: 'groom' },
    { x: '64%', y: 88, size: 20, pose: 'sleep', flip: true },
    { x: '37%', y: 66, size: 18, pose: 'sit' },
    { x: '82%', y: 65.4, size: 17, pose: 'curious' },
    { x: '92%', y: 86, size: 19, pose: 'sit', flip: true },
    { x: '7%', y: 90, size: 19, pose: 'curious' },
    { x: '44%', y: 95, size: 19, pose: 'groom', flip: true },
    { x: 'calc(19.5% + 9cqh)', y: 39.6, size: 15, pose: 'sleep', flip: true },
    { x: '11%', y: 71, size: 17, pose: 'sit' }, // under the window
  ],
};

// ---------------------------------------------------------------------------
// 2. Kids' room — a playroom where the kittens romp

const flags = svg(
  '0 0 600 80',
  sagging(10, (x, y, i) => {
    const c = ['#f29aa3', '#f6c46d', '#8fd0b4', '#a9c8f0', '#c4b5ef'][i % 5];
    return `<path d="M${(x - 15).toFixed(1)} ${y.toFixed(1)} L${(x + 15).toFixed(1)} ${y.toFixed(1)} L${x.toFixed(1)} ${(y + 32).toFixed(1)} Z" fill="${c}" stroke="${LINE}" stroke-width="3" stroke-linejoin="round"/>`;
  }),
);
const roundWindowDay = svg(
  '0 0 240 240',
  `<defs><clipPath id="kw-sky"><circle cx="120" cy="120" r="102"/></clipPath></defs>
  <circle cx="120" cy="120" r="108" fill="#cfe9f1" />
  <g clip-path="url(#kw-sky)">
    <ellipse cx="78" cy="92" rx="34" ry="15" fill="#fff"/><ellipse cx="100" cy="82" rx="24" ry="17" fill="#fff"/>
    <ellipse cx="166" cy="134" rx="28" ry="12" fill="#fff"/>
    <path d="M0 176 C60 146 110 168 150 158 C186 150 210 164 240 160 V240 H0 Z" fill="#b8d79a"/>
    <circle cx="70" cy="168" r="10" fill="#8cbc69"/>
  </g>
  <circle cx="120" cy="120" r="104" fill="none" stroke="#a7795a" stroke-width="13" />
  <path d="M120 16 V224 M16 120 H224" stroke="#a7795a" stroke-width="8" />`,
);
const plank = svg(
  '0 0 160 40',
  `<path d="M34 22 L44 38 M126 22 L116 38" stroke="${LINE}" stroke-width="5" stroke-linecap="round"/>
  <rect x="4" y="6" width="152" height="16" rx="7" fill="#e3b77d" stroke="${LINE}" stroke-width="4"/>
  <path d="M20 14 H140" stroke="#f2cf9c" stroke-width="3" stroke-linecap="round"/>`,
);
const castle = svg(
  '0 0 200 220',
  `<rect x="22" y="66" width="156" height="150" rx="6" fill="#e3b77d" stroke="${LINE}" stroke-width="5"/>
  ${[22, 62, 102, 142].map((x) => `<rect x="${x}" y="46" width="36" height="26" rx="3" fill="#e3b77d" stroke="${LINE}" stroke-width="5"/>`).join('')}
  <rect x="26" y="70" width="148" height="10" fill="#d4a568"/>
  <path d="M78 216 V164 A22 22 0 0 1 122 164 V216 Z" fill="#6b4a33" stroke="${LINE}" stroke-width="5"/>
  <path d="M46 104 h22 v22 h-22 Z M132 104 h22 v22 h-22 Z" fill="#6b4a33" stroke="${LINE}" stroke-width="4"/>
  <path d="M160 46 V8" stroke="${LINE}" stroke-width="4"/><path d="M160 10 L188 18 L160 28 Z" fill="#f29aa3" stroke="${LINE}" stroke-width="3" stroke-linejoin="round"/>
  <path d="M40 190 q10 -8 20 0 M136 196 q8 -6 16 0" stroke="#b9844f" stroke-width="3" fill="none"/>`,
);
const tunnel = svg(
  '0 0 300 120',
  `<path d="M60 14 H252 C282 14 296 40 296 64 C296 90 282 114 252 114 H60 Z" fill="#9ed2e6" stroke="#4f8fa8" stroke-width="5"/>
  ${[104, 146, 188, 230].map((x) => `<path d="M${x} 17 C${x + 14} 40 ${x + 14} 88 ${x} 111" stroke="#cdebf5" stroke-width="10" fill="none"/>`).join('')}
  <ellipse cx="60" cy="64" rx="38" ry="50" fill="#9ed2e6" stroke="#4f8fa8" stroke-width="5"/>
  <ellipse cx="60" cy="66" rx="25" ry="37" fill="#3c5b6b"/>`,
);
const radiator = (sling: string, rim: string) =>
  svg(
    '0 0 200 160',
    `<rect x="22" y="126" width="14" height="30" rx="4" fill="#d9d3c9" stroke="${LINE}" stroke-width="4"/>
  <rect x="164" y="126" width="14" height="30" rx="4" fill="#d9d3c9" stroke="${LINE}" stroke-width="4"/>
  <rect x="10" y="8" width="180" height="122" rx="14" fill="#f4f1ec" stroke="${LINE}" stroke-width="5"/>
  ${range(28, 160, 27).map((x) => `<rect x="${x}" y="20" width="15" height="98" rx="7.5" fill="#e4dfd5"/>`).join('')}
  <path d="M14 42 C40 124 160 124 186 42" fill="${sling}" stroke="${rim}" stroke-width="5"/>
  <circle cx="14" cy="42" r="7" fill="${LINE}"/><circle cx="186" cy="42" r="7" fill="${LINE}"/>`,
  );
const rainbowRug = svg(
  '0 0 400 140',
  `<ellipse cx="200" cy="70" rx="196" ry="66" fill="#c4b5ef" stroke="#9b88d8" stroke-width="5"/>
  <ellipse cx="200" cy="70" rx="156" ry="52" fill="#a9c8f0"/>
  <ellipse cx="200" cy="70" rx="116" ry="38" fill="#8fd0b4"/>
  <ellipse cx="200" cy="70" rx="76" ry="25" fill="#f6c46d"/>
  <ellipse cx="200" cy="70" rx="38" ry="12" fill="#f29aa3"/>`,
);
const ball = svg(
  '0 0 60 60',
  `<circle cx="30" cy="30" r="25" fill="#f6c46d" stroke="#4c3b3a" stroke-width="4"/>
  <path d="M8 22 C24 30 36 30 52 22 M10 40 C24 34 36 34 50 40" stroke="#e8907a" stroke-width="5" fill="none"/>`,
);
const mouseToy = svg(
  '0 0 100 50',
  `<path d="M20 34 C6 34 4 20 14 18" stroke="#4c3b3a" stroke-width="3" fill="none"/>
  <ellipse cx="54" cy="30" rx="32" ry="17" fill="#b9b3c4" stroke="#4c3b3a" stroke-width="4"/>
  <circle cx="74" cy="15" r="9" fill="#f7b2c0" stroke="#4c3b3a" stroke-width="3"/>
  <circle cx="80" cy="28" r="3" fill="#4c3b3a"/><circle cx="86" cy="34" r="3" fill="#f48fb1"/>`,
);

const kids: Room = {
  id: 'kids',
  name: 'Детская',
  wall: `radial-gradient(circle at 24px 24px, rgba(255, 255, 255, 0.7) 5px, transparent 6px) 0 0 / 48px 48px,
    linear-gradient(180deg, #dff2ea, #cfeadf)`,
  floor: `repeating-linear-gradient(90deg, rgba(120, 80, 50, 0.14) 0 3px, transparent 3px 120px),
    repeating-linear-gradient(0deg, rgba(120, 80, 50, 0.12) 0 2px, transparent 2px 40px),
    linear-gradient(180deg, #e9c69a, #ddb582)`,
  baseboard: '#f6fbf8',
  decor: [
    { svg: flags, x: '50%', y: 6, h: 11, ar: 600 / 80 },
    { svg: roundWindowDay, x: '17%', y: 12, h: 30, ar: 1 },
    { svg: plank, x: '40%', y: 20, h: 5, ar: 4 },
    { svg: plank, x: '50%', y: 33, h: 5, ar: 4 },
    { svg: plank, x: '41%', y: 46, h: 5, ar: 4 },
    { svg: radiator('#f6b8c4', '#d86f7a'), x: '89%', y: 40, h: 21, ar: 200 / 160 },
    { svg: rainbowRug, x: '52%', y: 74, h: 18, ar: 400 / 140 },
    { svg: castle, x: '71%', y: 50, h: 32, ar: 200 / 220 },
    { svg: tunnel, x: '28%', y: 70, h: 13, ar: 300 / 120 },
    { svg: ball, x: '60%', y: 88, h: 6, ar: 1 },
    { svg: mouseToy, x: '9%', y: 93, h: 4.5, ar: 2 },
  ],
  slots: [
    { x: '40%', y: 21.5, size: 14, pose: 'sit' },
    { x: '71%', y: 61, size: 15, pose: 'curious', flip: true },
    { x: 'calc(28% - 12cqh)', y: 84, size: 15, pose: 'curious' },
    { x: '52%', y: 85, size: 18, pose: 'play' },
    { x: '89%', y: 54.5, size: 15, pose: 'sleep', flip: true },
    { x: '50%', y: 34.5, size: 14, pose: 'groom', flip: true },
    { x: '71%', y: 88, size: 17, pose: 'sit' },
    { x: '41%', y: 47.5, size: 14, pose: 'sleep' },
    { x: '30%', y: 71.5, size: 14, pose: 'sleep', flip: true },
    { x: '7%', y: 82, size: 18, pose: 'sit' },
    { x: '92%', y: 90, size: 18, pose: 'groom', flip: true },
    { x: '36%', y: 95, size: 18, pose: 'play', flip: true },
  ],
};

// ---------------------------------------------------------------------------
// 3. Sunroom — big windows, plants and warm sun spots on the tiles

const bigWindow = svg(
  '0 0 520 240',
  `<defs><linearGradient id="sun-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bfe3f2"/><stop offset="1" stop-color="#e6f5f8"/></linearGradient></defs>
  <rect x="10" y="10" width="500" height="206" rx="14" fill="url(#sun-sky)"/>
  <circle cx="420" cy="62" r="30" fill="#fff3c4"/>
  <path d="M14 168 C90 128 160 156 240 140 C320 126 420 150 506 136 V214 H14 Z" fill="#b8d79a"/>
  <path d="M14 192 C120 170 260 186 506 172 V214 H14 Z" fill="#9cc77e"/>
  <circle cx="96" cy="128" r="26" fill="#8cbc69"/><rect x="92" y="140" width="8" height="30" fill="#8a6a4a"/>
  <circle cx="330" cy="120" r="20" fill="#8cbc69"/><rect x="327" y="130" width="6" height="24" fill="#8a6a4a"/>
  ${[60, 150, 220, 290, 380, 450].map((x, i) => `<circle cx="${x}" cy="${196 - (i % 2) * 6}" r="5" fill="${['#f29aa3', '#f6c46d', '#fff'][i % 3]}"/>`).join('')}
  <rect x="10" y="10" width="500" height="206" rx="14" fill="none" stroke="#fffaf2" stroke-width="12"/>
  <path d="M176 14 V214 M344 14 V214" stroke="#fffaf2" stroke-width="10"/>
  <rect x="10" y="10" width="500" height="206" rx="14" fill="none" stroke="#c7a27e" stroke-width="3"/>
  <rect x="-4" y="212" width="528" height="22" rx="8" fill="#fffaf2" stroke="#c7a27e" stroke-width="4"/>`,
);
const wickerSofa = svg(
  '0 0 300 160',
  `<rect x="34" y="128" width="12" height="28" rx="4" fill="#a87a4e" stroke="${LINE}" stroke-width="4"/>
  <rect x="254" y="128" width="12" height="28" rx="4" fill="#a87a4e" stroke="${LINE}" stroke-width="4"/>
  <path d="M30 96 C24 30 276 30 270 96 Z" fill="#e2b77f" stroke="${LINE}" stroke-width="5"/>
  ${range(52, 248, 18).map((x) => `<path d="M${x} 54 V96" stroke="#c99a62" stroke-width="3"/>`).join('')}
  <rect x="20" y="88" width="260" height="44" rx="16" fill="#e2b77f" stroke="${LINE}" stroke-width="5"/>
  <rect x="46" y="76" width="100" height="26" rx="12" fill="#8fd0b4" stroke="#4fa786" stroke-width="4"/>
  <rect x="154" y="76" width="100" height="26" rx="12" fill="#f6c46d" stroke="#d8a23c" stroke-width="4"/>
  <rect x="8" y="70" width="34" height="62" rx="15" fill="#e2b77f" stroke="${LINE}" stroke-width="5"/>
  <rect x="258" y="70" width="34" height="62" rx="15" fill="#e2b77f" stroke="${LINE}" stroke-width="5"/>`,
);
const eggChair = svg(
  '0 0 160 300',
  `<path d="M80 0 V86" stroke="#9d9389" stroke-width="5" stroke-dasharray="9 5"/>
  <path d="M80 86 C10 92 6 236 80 262 C154 236 150 92 80 86 Z" fill="#e2b77f" stroke="${LINE}" stroke-width="5"/>
  ${range(40, 120, 16).map((x) => `<path d="M${x} 110 C${x - 4} 170 ${x - 4} 210 ${x} 246" stroke="#c99a62" stroke-width="3" fill="none"/>`).join('')}
  <path d="M30 170 C40 120 120 120 130 170 C120 196 40 196 30 170 Z" fill="#7d5a3d" opacity="0.55"/>
  <ellipse cx="80" cy="204" rx="50" ry="20" fill="#f29aa3" stroke="#d86f7a" stroke-width="4"/>`,
);
const leaf = (x: number, y: number, rot: number, s: number, fill: string) =>
  `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})"><path d="M0 0 C-30 -10 -42 -48 -20 -70 C-8 -82 10 -82 20 -70 C42 -48 30 -10 0 0 Z" fill="${fill}" stroke="#4e7a45" stroke-width="4"/><path d="M0 -6 V-62 M0 -24 L-16 -40 M0 -24 L16 -40 M0 -44 L-12 -58 M0 -44 L12 -58" stroke="#4e7a45" stroke-width="3" fill="none" stroke-linecap="round"/></g>`;
const monstera = svg(
  '0 0 160 260',
  `<path d="M80 176 C70 140 44 120 26 112 M80 176 C88 130 112 104 134 96 M80 176 C78 130 74 90 70 58 M80 176 C96 150 120 150 146 150 M80 176 C64 150 40 152 14 156" stroke="#4e7a45" stroke-width="5" fill="none" stroke-linecap="round"/>
  ${leaf(14, 156, -100, 0.85, '#7cb85e')}${leaf(146, 150, 100, 0.85, '#7cb85e')}${leaf(26, 112, -55, 1, '#8cbc69')}${leaf(134, 96, 50, 1, '#8cbc69')}${leaf(70, 58, -8, 1.05, '#6fae55')}${leaf(98, 120, 22, 0.8, '#7cb85e')}
  <path d="M46 176 L54 254 H106 L114 176 Z" fill="#e8907a" stroke="${LINE}" stroke-width="5" stroke-linejoin="round"/>
  <rect x="40" y="166" width="80" height="18" rx="6" fill="#f0a58f" stroke="${LINE}" stroke-width="5"/>`,
);
const sunPatch = svg('0 0 400 110', `<path d="M60 6 H170 L130 104 H10 Z M210 6 H330 L290 104 H160 Z" fill="#fff6c8" opacity="0.6"/>`);
const teaTable = svg(
  '0 0 200 110',
  `<rect x="30" y="40" width="12" height="66" rx="4" fill="#a87a4e" stroke="${LINE}" stroke-width="4"/>
  <rect x="158" y="40" width="12" height="66" rx="4" fill="#a87a4e" stroke="${LINE}" stroke-width="4"/>
  <ellipse cx="100" cy="40" rx="94" ry="18" fill="${WOOD}" stroke="${LINE}" stroke-width="5"/>
  <path d="M74 32 C74 10 118 10 118 32 Z" fill="#a9d6e8" stroke="${LINE}" stroke-width="4"/>
  <path d="M118 22 C130 18 134 30 124 32 M74 24 L62 16" stroke="${LINE}" stroke-width="4" fill="none" stroke-linecap="round"/>
  <ellipse cx="146" cy="34" rx="12" ry="5" fill="#fff" stroke="${LINE}" stroke-width="3"/>`,
);
const flowerCrate = svg(
  '0 0 200 120',
  `<rect x="20" y="56" width="160" height="60" rx="6" fill="#d9a46b" stroke="${LINE}" stroke-width="5"/>
  <path d="M24 86 H176" stroke="#b9844f" stroke-width="4"/>
  ${[44, 74, 104, 134, 160].map((x, i) => `<path d="M${x} 58 V${34 - (i % 2) * 8}" stroke="#4e7a45" stroke-width="4"/><circle cx="${x}" cy="${30 - (i % 2) * 8}" r="11" fill="${['#f29aa3', '#f6c46d', '#c4b5ef'][i % 3]}" stroke="${LINE}" stroke-width="3"/>`).join('')}`,
);

const sunroom: Room = {
  id: 'sunroom',
  name: 'Веранда',
  wall: `repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.45) 0 4px, transparent 4px 44px),
    linear-gradient(180deg, #fff1c9, #fbe3a8)`,
  floor: `conic-gradient(#e7a07a 25%, #dc9068 0 50%, #e7a07a 0 75%, #dc9068 0) 0 0 / 64px 64px`,
  baseboard: '#fffaf2',
  decor: [
    { svg: bigWindow, x: '50%', y: 5, h: 38, ar: 520 / 240 },
    { svg: monstera, x: '9.5%', y: 38, h: 40, ar: 160 / 260 },
    { svg: eggChair, x: '85%', y: 0, h: 54, ar: 160 / 300 },
    { svg: sunPatch, x: '52%', y: 70, h: 18, ar: 400 / 110 },
    { svg: wickerSofa, x: '29%', y: 50, h: 25, ar: 300 / 160 },
    { svg: teaTable, x: '68%', y: 70, h: 13, ar: 200 / 110 },
    { svg: flowerCrate, x: '93%', y: 80, h: 12, ar: 200 / 120 },
  ],
  slots: [
    { x: '36%', y: 39.5, size: 14, pose: 'groom' },
    { x: '24%', y: 64, size: 17, pose: 'sleep' },
    { x: '85%', y: 37, size: 13, pose: 'sleep', flip: true },
    { x: '47%', y: 85, size: 19, pose: 'sleep' },
    { x: '35%', y: 64, size: 16, pose: 'sit', flip: true },
    { x: '64%', y: 39.5, size: 14, pose: 'sit', flip: true },
    { x: '60%', y: 82, size: 17, pose: 'groom', flip: true },
    { x: '13%', y: 92, size: 18, pose: 'curious' },
    { x: '70%', y: 94, size: 18, pose: 'play' },
    { x: '92%', y: 96, size: 18, pose: 'sit', flip: true },
    { x: '30%', y: 90, size: 18, pose: 'play', flip: true },
    { x: '79%', y: 73, size: 15, pose: 'curious' },
  ],
};

// ---------------------------------------------------------------------------
// 4. Attic — a cosy nest under the roof

const roofBeams = svg(
  '0 0 100 60" preserveAspectRatio="none',
  `<path d="M0 0 H18 L0 30 Z M100 0 H82 L100 30 Z" fill="#b5835a"/>
  <path d="M18 0 L0 30 M82 0 L100 30" stroke="#8a5f3e" stroke-width="1.6"/>`,
);
const roundWindowNight = svg(
  '0 0 240 240',
  `<defs><clipPath id="aw-sky"><circle cx="120" cy="120" r="102"/></clipPath></defs>
  <circle cx="120" cy="120" r="108" fill="#3d4f7c"/>
  <g clip-path="url(#aw-sky)">
    <circle cx="150" cy="84" r="30" fill="#fff3c4"/><circle cx="164" cy="74" r="28" fill="#3d4f7c"/>
    ${[
      [60, 70],
      [92, 130],
      [176, 150],
      [56, 150],
      [120, 52],
      [196, 104],
    ]
      .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.5" fill="#fff8d6"/>`)
      .join('')}
    <path d="M0 196 C60 180 130 196 240 184 V240 H0 Z" fill="#2c3a5e"/>
  </g>
  <circle cx="120" cy="120" r="104" fill="none" stroke="#a7795a" stroke-width="13"/>
  <path d="M120 16 V224 M16 120 H224" stroke="#a7795a" stroke-width="8"/>`,
);
const stringLights = svg(
  '0 0 600 80',
  sagging(12, (x, y, i) => {
    const c = ['#fff3a8', '#ffc9a0', '#ffe0f0', '#c9f0ff'][i % 4];
    return `<circle cx="${x.toFixed(1)}" cy="${(y + 10).toFixed(1)}" r="14" fill="${c}" opacity="0.35"/><path d="M${(x - 5).toFixed(1)} ${(y + 1).toFixed(1)} h10 v5 h-10 Z" fill="#6b5a4a"/><ellipse cx="${x.toFixed(1)}" cy="${(y + 12).toFixed(1)}" rx="6" ry="8" fill="${c}" stroke="#b39a6a" stroke-width="2"/>`;
  }),
);
const armchair = svg(
  '0 0 220 200',
  `<rect x="36" y="166" width="14" height="30" rx="4" fill="#8a5f3e"/><rect x="170" y="166" width="14" height="30" rx="4" fill="#8a5f3e"/>
  <path d="M40 120 C30 30 190 30 180 120 Z" fill="#c97b84" stroke="${LINE}" stroke-width="5"/>
  <path d="M70 52 C90 44 130 44 150 52" stroke="#e8a0a8" stroke-width="5" fill="none" stroke-linecap="round"/>
  <rect x="30" y="112" width="160" height="58" rx="18" fill="#c97b84" stroke="${LINE}" stroke-width="5"/>
  <rect x="54" y="104" width="112" height="24" rx="11" fill="#e8a0a8" stroke="${LINE}" stroke-width="4"/>
  <rect x="10" y="86" width="40" height="84" rx="18" fill="#c97b84" stroke="${LINE}" stroke-width="5"/>
  <rect x="170" y="86" width="40" height="84" rx="18" fill="#c97b84" stroke="${LINE}" stroke-width="5"/>`,
);
const suitcases = svg(
  '0 0 180 200',
  `<rect x="14" y="128" width="152" height="66" rx="10" fill="#8fb3c9" stroke="${LINE}" stroke-width="5"/>
  <path d="M30 128 V194 M150 128 V194" stroke="#6d93aa" stroke-width="6"/>
  <rect x="28" y="72" width="124" height="58" rx="10" fill="#e9b26b" stroke="${LINE}" stroke-width="5"/>
  <rect x="78" y="62" width="24" height="12" rx="4" fill="none" stroke="${LINE}" stroke-width="5"/>
  <rect x="40" y="22" width="100" height="52" rx="10" fill="#c4b5ef" stroke="${LINE}" stroke-width="5"/>
  <path d="M40 46 H140" stroke="#a796dc" stroke-width="6"/>
  <circle cx="122" cy="96" r="8" fill="#f29aa3" stroke="${LINE}" stroke-width="3"/>`,
);
const pillows = svg(
  '0 0 320 130',
  `<ellipse cx="160" cy="104" rx="150" ry="24" fill="#d8c3e8" stroke="#a796dc" stroke-width="5"/>
  <ellipse cx="96" cy="76" rx="70" ry="30" fill="#f6c7a4" stroke="#d9946b" stroke-width="5"/>
  <ellipse cx="222" cy="78" rx="68" ry="28" fill="#a9d6e8" stroke="#6fa3c9" stroke-width="5"/>
  <ellipse cx="160" cy="62" rx="56" ry="24" fill="#fde5e7" stroke="#d86f7a" stroke-width="5"/>
  <path d="M130 60 h60 M140 70 h40" stroke="#f29aa3" stroke-width="3" stroke-linecap="round"/>`,
);
const blanketNest = svg(
  '0 0 240 110',
  `<path d="M14 48 C20 108 220 108 226 48 Z" fill="#b98ac9" stroke="${LINE}" stroke-width="6" stroke-linejoin="round"/>
  ${[44, 76, 108, 140, 172, 200].map((x) => `<path d="M${x} 58 q6 14 0 30" stroke="#d7b4e2" stroke-width="5" fill="none"/>`).join('')}
  <ellipse cx="120" cy="48" rx="108" ry="22" fill="#fbe9f3" stroke="${LINE}" stroke-width="6"/>`,
);
const floorLamp = svg(
  '0 0 100 300',
  `<circle cx="50" cy="44" r="46" fill="#fff3c4" opacity="0.35"/>
  <path d="M20 60 L32 12 H68 L80 60 Z" fill="#f6c46d" stroke="${LINE}" stroke-width="5" stroke-linejoin="round"/>
  <path d="M50 60 V284" stroke="${LINE}" stroke-width="6"/>
  <ellipse cx="50" cy="288" rx="30" ry="9" fill="${WOOD}" stroke="${LINE}" stroke-width="5"/>`,
);
const chest = svg(
  '0 0 200 130',
  `<rect x="14" y="40" width="172" height="86" rx="8" fill="#b9844f" stroke="${LINE}" stroke-width="5"/>
  <path d="M14 40 C14 10 186 10 186 40 Z" fill="#c99366" stroke="${LINE}" stroke-width="5"/>
  <path d="M50 18 V126 M150 18 V126" stroke="#7d6a5a" stroke-width="9"/>
  <rect x="88" y="46" width="24" height="22" rx="4" fill="#f2c46d" stroke="${LINE}" stroke-width="4"/>`,
);

const attic: Room = {
  id: 'attic',
  name: 'Чердак',
  wall: `repeating-linear-gradient(90deg, #ecd0a8 0 52px, #dcb98c 52px 55px)`,
  floor: `repeating-linear-gradient(90deg, rgba(90, 60, 40, 0.18) 0 3px, transparent 3px 90px),
    linear-gradient(180deg, #c98f5f, #b97f52)`,
  baseboard: '#f3e2c8',
  decor: [
    { svg: roofBeams, x: '50%', y: 0, h: 60, ar: 100 / 60, w: '100%' },
    { svg: stringLights, x: '50%', y: 7, h: 10, ar: 600 / 80 },
    { svg: roundWindowNight, x: '50%', y: 10, h: 26, ar: 1 },
    { svg: plank, x: '50%', y: 33.5, h: 4.4, ar: 4 },
    { svg: floorLamp, x: '34%', y: 24, h: 50, ar: 100 / 300 },
    { svg: armchair, x: '19%', y: 44, h: 31, ar: 220 / 200 },
    { svg: suitcases, x: '80%', y: 44, h: 31, ar: 180 / 200 },
    { svg: chest, x: '64%', y: 56, h: 15, ar: 200 / 130 },
    { svg: pillows, x: '50%', y: 72, h: 18, ar: 320 / 130 },
    { svg: blanketNest, x: '88%', y: 80, h: 13, ar: 240 / 110 },
  ],
  slots: [
    { x: '19%', y: 62, size: 17, pose: 'sleep' },
    { x: '44%', y: 81, size: 18, pose: 'sleep' },
    { x: '80%', y: 48, size: 14, pose: 'groom', flip: true },
    { x: '88%', y: 87, size: 17, pose: 'sleep', flip: true },
    { x: '57%', y: 80, size: 17, pose: 'sit', flip: true },
    { x: '50%', y: 35, size: 12, pose: 'sit' },
    { x: '64%', y: 59, size: 14, pose: 'curious', flip: true },
    { x: '8%', y: 92, size: 18, pose: 'curious' },
    { x: '30%', y: 94, size: 18, pose: 'play' },
    { x: '71%', y: 95, size: 18, pose: 'groom', flip: true },
    { x: '94%', y: 72, size: 15, pose: 'sit', flip: true },
    { x: '50%', y: 96, size: 18, pose: 'play', flip: true },
  ],
};

// ---------------------------------------------------------------------------
// 5. Kitchen — where everyone gathers at dinner time

const fridge = svg(
  '0 0 140 300',
  `<rect x="10" y="6" width="120" height="288" rx="16" fill="#eef6f7" stroke="${LINE}" stroke-width="5"/>
  <path d="M10 104 H130" stroke="${LINE}" stroke-width="5"/>
  <rect x="104" y="40" width="8" height="40" rx="4" fill="#b9c3c6"/><rect x="104" y="124" width="8" height="60" rx="4" fill="#b9c3c6"/>
  <path d="M34 150 C34 138 50 138 50 150 C50 138 66 138 66 150 C66 164 50 172 50 176 C50 172 34 164 34 150 Z" fill="#f29aa3"/>
  <path d="M30 210 C44 196 70 196 80 210 C70 224 44 224 30 210 Z M80 210 L94 200 V220 Z" fill="#6fa3c9"/>
  <rect x="36" y="40" width="34" height="26" rx="3" fill="#fff" stroke="#d9cfc2" stroke-width="3"/>`,
);
const counter = svg(
  '0 0 360 200',
  `<rect x="14" y="30" width="332" height="166" rx="8" fill="#a9c8f0" stroke="${LINE}" stroke-width="5"/>
  <path d="M124 34 V196 M236 34 V196" stroke="${LINE}" stroke-width="4"/>
  ${[68, 180, 292].map((x) => `<rect x="${x - 26}" y="60" width="52" height="8" rx="4" fill="#6f8fbf"/>`).join('')}
  <rect x="4" y="16" width="352" height="22" rx="8" fill="#f2e6d6" stroke="${LINE}" stroke-width="5"/>
  <path d="M290 16 L296 -14 H330 L336 16 Z" fill="#fff6e6" stroke="${LINE}" stroke-width="4"/>
  <path d="M60 16 C60 -6 96 -6 96 16 Z" fill="#8fd0b4" stroke="${LINE}" stroke-width="4"/>`,
);
const kitchenWindow = svg(
  '0 0 260 200',
  `<rect x="30" y="16" width="200" height="150" rx="10" fill="#cfe9f1" stroke="#fffaf2" stroke-width="10"/>
  <path d="M130 20 V164 M34 92 H226" stroke="#fffaf2" stroke-width="8"/>
  <circle cx="190" cy="54" r="16" fill="#fff3c4"/>
  <path d="M0 6 H260" stroke="${LINE}" stroke-width="6" stroke-linecap="round"/>
  <path d="M6 8 C30 60 14 140 40 190 H0 V8 Z" fill="#8fd0b4" stroke="#4fa786" stroke-width="3"/>
  <path d="M254 8 C230 60 246 140 220 190 H260 V8 Z" fill="#8fd0b4" stroke="#4fa786" stroke-width="3"/>
  <rect x="22" y="164" width="216" height="16" rx="6" fill="#fffaf2" stroke="#c7a27e" stroke-width="3"/>`,
);
const chair = svg(
  '0 0 140 240',
  `<rect x="22" y="10" width="96" height="120" rx="14" fill="#e9b26b" stroke="${LINE}" stroke-width="5"/>
  <path d="M42 40 H98 M42 66 H98 M42 92 H98" stroke="#c98d48" stroke-width="5" stroke-linecap="round"/>
  <rect x="24" y="168" width="12" height="70" rx="4" fill="#c98d48" stroke="${LINE}" stroke-width="4"/>
  <rect x="104" y="168" width="12" height="70" rx="4" fill="#c98d48" stroke="${LINE}" stroke-width="4"/>
  <rect x="10" y="128" width="120" height="42" rx="10" fill="#e9b26b" stroke="${LINE}" stroke-width="5"/>
  <rect x="22" y="122" width="96" height="16" rx="7" fill="#f29aa3" stroke="#d86f7a" stroke-width="3"/>`,
);
const feedingMat = svg(
  '0 0 400 80',
  `<rect x="6" y="22" width="388" height="52" rx="22" fill="#f6c7a4" stroke="#d9946b" stroke-width="5"/>
  ${[70, 160, 250, 336]
    .map(
      (x, i) =>
        `<ellipse cx="${x}" cy="44" rx="34" ry="13" fill="${['#6fa3c9', '#f2a65a', '#8fd0b4', '#f29aa3'][i]}" stroke="#4c3b3a" stroke-width="4"/><ellipse cx="${x}" cy="39" rx="26" ry="8" fill="${i % 2 ? '#bfe3ee' : '#b9845a'}"/>`,
    )
    .join('')}`,
);
const stool = svg(
  '0 0 120 160',
  `<path d="M30 30 L18 156 M90 30 L102 156 M24 110 H96" stroke="${LINE}" stroke-width="7" stroke-linecap="round"/>
  <ellipse cx="60" cy="26" rx="54" ry="18" fill="#8fd0b4" stroke="${LINE}" stroke-width="5"/>`,
);

const kitchen: Room = {
  id: 'kitchen',
  name: 'Кухня',
  wall: `repeating-linear-gradient(0deg, #dbe7ef 0 2px, transparent 2px 38px),
    repeating-linear-gradient(90deg, #dbe7ef 0 2px, transparent 2px 38px),
    linear-gradient(180deg, #fbfdfe, #eef5f9)`,
  floor: `conic-gradient(#ecd3ae 25%, #f6e7cd 0 50%, #ecd3ae 0 75%, #f6e7cd 0) 0 0 / 76px 76px`,
  baseboard: '#fff8ee',
  decor: [
    { svg: kitchenWindow, x: '55%', y: 6, h: 27, ar: 260 / 200 },
    { svg: counter, x: '55%', y: 38, h: 26, ar: 360 / 200 },
    { svg: fridge, x: '86%', y: 16, h: 46, ar: 140 / 300 },
    { svg: radiator('#a9e0c8', '#4fa786'), x: '24%', y: 41, h: 21, ar: 200 / 160 },
    { svg: chair, x: '11%', y: 50, h: 32, ar: 140 / 240 },
    { svg: stool, x: '72%', y: 64, h: 16, ar: 120 / 160 },
    { svg: feedingMat, x: '40%', y: 85, h: 9, ar: 400 / 80 },
  ],
  slots: [
    { x: '86%', y: 16.5, size: 14, pose: 'sit', flip: true },
    { x: '30%', y: 89, size: 17, pose: 'sit' },
    { x: '47%', y: 40.5, size: 15, pose: 'groom' },
    { x: '24%', y: 55.5, size: 15, pose: 'sleep' },
    { x: '11%', y: 68, size: 16, pose: 'sleep' },
    { x: '48%', y: 89, size: 17, pose: 'sit', flip: true },
    { x: '64%', y: 40.5, size: 14, pose: 'sleep', flip: true },
    { x: '72%', y: 66, size: 14, pose: 'curious', flip: true },
    { x: '58%', y: 33, size: 12, pose: 'curious' },
    { x: '90%', y: 92, size: 18, pose: 'groom', flip: true },
    { x: '66%', y: 96, size: 18, pose: 'play' },
    { x: '13%', y: 95, size: 18, pose: 'play', flip: true },
  ],
};

export const ROOMS: Room[] = [living, kids, sunroom, attic, kitchen];

/** Room and spot of the i-th rescued cat (wraps around if the house is full). */
export function spotFor(i: number): { room: number; slot: Slot } {
  let k = i % ROOMS.reduce((n, r) => n + r.slots.length, 0);
  for (let r = 0; r < ROOMS.length; r++) {
    if (k < ROOMS[r].slots.length) return { room: r, slot: ROOMS[r].slots[k] };
    k -= ROOMS[r].slots.length;
  }
  return { room: 0, slot: ROOMS[0].slots[0] };
}

/** How many rooms are open for this many rescued cats (at least one). */
export function roomsOpen(rescued: number): number {
  let need = 0;
  let cap = 0;
  for (const r of ROOMS) {
    if (need > 0 && cap >= rescued) break;
    cap += r.slots.length;
    need++;
  }
  return Math.max(1, need);
}
