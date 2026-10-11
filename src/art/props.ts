// SVG props in the same soft cartoon language as the cats: chunky outlines,
// pastel fills, one highlight per shape. Every function returns a full <svg>.
// `ANCHORS` gives the pixel inside each svg that sits on the cell centre.

const svg = (w: number, h: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body}</svg>`;

const O = '#4c3b3a'; // generic ink

function blobs(list: [number, number, number][], fill: string, stroke: string, sw: number): string {
  const out = list.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${stroke}" stroke="${stroke}" stroke-width="${sw}"/>`).join('');
  return out + list.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`).join('');
}

export function bushSvg(variant = 0): string {
  const back: [number, number, number][] = [
    [38, 60, 25],
    [90, 60, 25],
    [64, 46, 29],
  ];
  const front: [number, number, number][] = [
    [30, 80, 21],
    [64, 82, 25],
    [98, 80, 21],
  ];
  const berries = ['#f7b2c0', '#fff1a8', '#f6c7e8'][variant % 3];
  return svg(
    128,
    112,
    `<ellipse cx="64" cy="100" rx="52" ry="11" fill="#2f4a2c" opacity="0.22"/>` +
      blobs(back, '#7aab5e', '#4e7a45', 6) +
      blobs(front, '#8cbc69', '#4e7a45', 6) +
      `<ellipse cx="56" cy="36" rx="12" ry="7" fill="#b5d98f" opacity="0.8"/>` +
      `<ellipse cx="26" cy="70" rx="8" ry="5" fill="#b5d98f" opacity="0.7"/>` +
      `<ellipse cx="92" cy="70" rx="8" ry="5" fill="#b5d98f" opacity="0.7"/>` +
      `<ellipse cx="58" cy="74" rx="10" ry="6" fill="#a8d082" opacity="0.7"/>` +
      [
        [46, 56],
        [80, 50],
        [74, 78],
        [36, 86],
        [96, 88],
      ]
        .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.2" fill="${berries}" stroke="#4e7a45" stroke-width="1"/>`)
        .join(''),
  );
}

/** Lower leaves only — drawn in front of a hiding cat. */
export function bushFrontSvg(): string {
  const front: [number, number, number][] = [
    [30, 84, 19],
    [64, 88, 21],
    [98, 84, 19],
  ];
  return svg(
    128,
    112,
    blobs(front, '#8cbc69', '#4e7a45', 5) +
      `<ellipse cx="58" cy="80" rx="10" ry="5" fill="#a8d082" opacity="0.7"/><ellipse cx="94" cy="78" rx="7" ry="4" fill="#a8d082" opacity="0.7"/>` +
      `<circle cx="40" cy="90" r="3" fill="#f7b2c0" stroke="#4e7a45" stroke-width="1"/><circle cx="82" cy="92" r="3" fill="#fff1a8" stroke="#4e7a45" stroke-width="1"/>`,
  );
}

export function treeSvg(variant = 0): string {
  const leaf = variant % 2 === 0 ? ['#6f9f57', '#86b768', '#a9d184'] : ['#78a65a', '#93c06f', '#b8da8f'];
  const canopy: [number, number, number][] = [
    [64, 74, 40],
    [34, 92, 28],
    [94, 92, 28],
    [64, 42, 30],
    [42, 60, 22],
    [88, 60, 22],
  ];
  return svg(
    128,
    184,
    `<ellipse cx="64" cy="172" rx="40" ry="10" fill="#2f4a2c" opacity="0.25"/>` +
      `<path d="M56 172 C58 150 58 132 54 116 L74 116 C70 132 70 150 72 172 Z" fill="#9b6b4a" stroke="#5e3f2c" stroke-width="5" stroke-linejoin="round"/>` +
      `<path d="M62 168 C63 150 63 134 61 120" stroke="#b8845f" stroke-width="3" fill="none" stroke-linecap="round"/>` +
      blobs(canopy, leaf[0], '#46703f', 6) +
      canopy.map(([x, y, r]) => `<circle cx="${x}" cy="${y - 3}" r="${r - 5}" fill="${leaf[1]}"/>`).join('') +
      `<ellipse cx="54" cy="34" rx="14" ry="8" fill="${leaf[2]}"/><ellipse cx="36" cy="82" rx="9" ry="6" fill="${leaf[2]}"/><ellipse cx="86" cy="54" rx="9" ry="6" fill="${leaf[2]}"/><ellipse cx="70" cy="70" rx="11" ry="6" fill="${leaf[2]}" opacity="0.8"/>` +
      (variant % 2 === 0
        ? `<circle cx="44" cy="100" r="4" fill="#f28b74" stroke="#46703f" stroke-width="1.5"/><circle cx="84" cy="44" r="4" fill="#f28b74" stroke="#46703f" stroke-width="1.5"/><circle cx="92" cy="96" r="4" fill="#f28b74" stroke="#46703f" stroke-width="1.5"/>`
        : ''),
  );
}

export function rockSvg(): string {
  return svg(
    96,
    72,
    `<ellipse cx="48" cy="62" rx="38" ry="9" fill="#2f4a2c" opacity="0.22"/>` +
      `<path d="M14 58 C10 40 22 22 42 20 C62 16 84 28 84 46 C86 56 80 62 70 62 L24 62 C18 62 15 61 14 58 Z" fill="#a8a29a" stroke="#5f5a55" stroke-width="5" stroke-linejoin="round"/>` +
      `<path d="M24 34 C30 26 44 24 52 26" stroke="#cdc8c0" stroke-width="5" fill="none" stroke-linecap="round"/>` +
      `<path d="M58 58 C66 54 74 50 78 44" stroke="#8d877f" stroke-width="3" fill="none" stroke-linecap="round"/>` +
      `<ellipse cx="34" cy="56" rx="12" ry="5" fill="#8fb86e"/><ellipse cx="70" cy="30" rx="8" ry="4" fill="#8fb86e" opacity="0.9"/>`,
  );
}

export function kibbleSvg(): string {
  const kib = [
    [24, 20],
    [31, 17],
    [38, 20],
    [28, 23],
    [35, 23],
    [42, 22],
    [21, 24],
    [32, 20],
  ];
  return svg(
    64,
    44,
    `<ellipse cx="32" cy="36" rx="26" ry="7" fill="#2f4a2c" opacity="0.22"/>` +
      `<path d="M8 22 L12 32 C16 38 48 38 52 32 L56 22 Z" fill="#6fa3c9" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>` +
      `<path d="M12 30 C20 35 44 35 52 30" stroke="#92c0de" stroke-width="2.5" fill="none" stroke-linecap="round"/>` +
      `<ellipse cx="32" cy="22" rx="24" ry="8" fill="#9ccbe6" stroke="${O}" stroke-width="3"/>` +
      `<ellipse cx="32" cy="22" rx="18" ry="5.5" fill="#b9845a"/>` +
      kib.map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="3.2" ry="2.3" fill="#d39a64" stroke="#8a5a36" stroke-width="1"/>`).join(''),
  );
}

export function tunaSvg(): string {
  return svg(
    64,
    48,
    `<ellipse cx="32" cy="40" rx="24" ry="6.5" fill="#2f4a2c" opacity="0.22"/>` +
      `<path d="M12 18 L12 34 C14 42 50 42 52 34 L52 18 Z" fill="#cfd8df" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>` +
      `<path d="M12 23 C16 29 48 29 52 23 L52 31 C48 37 16 37 12 31 Z" fill="#5c8fc4"/>` +
      `<path d="M27 29 q5 -4 10 0 q-5 4 -10 0 z M37 29 l4 -3 v6 z" fill="#f6efe0"/>` +
      `<ellipse cx="32" cy="18" rx="20" ry="7" fill="#e6ecf0" stroke="${O}" stroke-width="3"/>` +
      `<ellipse cx="32" cy="18" rx="15" ry="4.6" fill="#f2a091"/>` +
      `<path d="M22 17 q4 -3 8 0 M32 19 q4 -3 8 0" stroke="#f8c6bd" stroke-width="2" fill="none" stroke-linecap="round"/>` +
      `<path d="M44 12 C52 4 58 6 56 12" stroke="${O}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`,
  );
}

export function toySvg(): string {
  return svg(
    64,
    84,
    `<ellipse cx="32" cy="76" rx="20" ry="5.5" fill="#2f4a2c" opacity="0.22"/>` +
      `<ellipse cx="32" cy="72" rx="15" ry="6" fill="#f2c46d" stroke="${O}" stroke-width="3"/>` +
      `<path d="M32 70 C24 62 40 56 32 48 C24 40 40 34 32 26" stroke="#8b7f7a" stroke-width="2.5" fill="none" stroke-linecap="round"/>` +
      `<path d="M32 26 C20 14 16 4 22 2 C28 6 30 16 32 24 Z" fill="#7ec8e3" stroke="${O}" stroke-width="2.2" stroke-linejoin="round"/>` +
      `<path d="M32 26 C44 14 48 4 42 2 C36 6 34 16 32 24 Z" fill="#ef8fa7" stroke="${O}" stroke-width="2.2" stroke-linejoin="round"/>` +
      `<path d="M32 26 C30 12 32 2 34 0 C37 6 36 16 33 25 Z" fill="#ffd166" stroke="${O}" stroke-width="2.2" stroke-linejoin="round"/>` +
      `<circle cx="32" cy="28" r="4.5" fill="#ffe08a" stroke="${O}" stroke-width="2"/>` +
      `<circle cx="18" cy="66" r="7" fill="#f48fb1" stroke="${O}" stroke-width="2.5"/><path d="M13 64 q5 -4 10 2 M13 68 q5 -2 9 2" stroke="#fbc6d8" stroke-width="1.6" fill="none"/>`,
  );
}

export function mowerSvg(): string {
  return svg(
    104,
    84,
    `<ellipse cx="52" cy="74" rx="40" ry="8" fill="#2f4a2c" opacity="0.25"/>` +
      `<path d="M58 44 L86 8" stroke="${O}" stroke-width="9" stroke-linecap="round"/><path d="M58 44 L86 8" stroke="#8a8f96" stroke-width="4" stroke-linecap="round"/>` +
      `<path d="M78 8 L96 14" stroke="${O}" stroke-width="9" stroke-linecap="round"/><path d="M78 8 L96 14" stroke="#3a3f45" stroke-width="4" stroke-linecap="round"/>` +
      `<path d="M14 54 C14 38 28 32 50 32 C72 32 84 40 84 54 L84 60 L14 60 Z" fill="#e06c5a" stroke="${O}" stroke-width="4" stroke-linejoin="round"/>` +
      `<path d="M22 44 C30 38 46 37 58 38" stroke="#f29a8a" stroke-width="4" fill="none" stroke-linecap="round"/>` +
      `<rect x="40" y="24" width="20" height="10" rx="4" fill="#4a4f56" stroke="${O}" stroke-width="3"/>` +
      `<rect x="10" y="56" width="78" height="8" rx="4" fill="#5f6670" stroke="${O}" stroke-width="3"/>` +
      `<circle cx="24" cy="66" r="9" fill="#3a3f45" stroke="${O}" stroke-width="3"/><circle cx="24" cy="66" r="3.5" fill="#c9cdd2"/>` +
      `<circle cx="76" cy="66" r="9" fill="#3a3f45" stroke="${O}" stroke-width="3"/><circle cx="76" cy="66" r="3.5" fill="#c9cdd2"/>`,
  );
}

export function radioSvg(): string {
  return svg(
    88,
    96,
    `<ellipse cx="44" cy="88" rx="30" ry="7" fill="#2f4a2c" opacity="0.25"/>` +
      `<path d="M24 60 L18 88 M64 60 L70 88 M44 62 L44 88" stroke="#8a5f3e" stroke-width="6" stroke-linecap="round"/>` +
      `<ellipse cx="44" cy="60" rx="30" ry="8" fill="#c2925d" stroke="${O}" stroke-width="3.5"/>` +
      `<path d="M56 22 L70 4" stroke="${O}" stroke-width="3" stroke-linecap="round"/><circle cx="70" cy="4" r="3" fill="#e06c5a" stroke="${O}" stroke-width="2"/>` +
      `<rect x="14" y="20" width="60" height="38" rx="10" fill="#6cc3b5" stroke="${O}" stroke-width="4"/>` +
      `<rect x="20" y="27" width="28" height="24" rx="6" fill="#f6efe0" stroke="${O}" stroke-width="2.5"/>` +
      [31, 37, 43].map((y) => `<path d="M24 ${y} H44" stroke="#c9bfae" stroke-width="2.2" stroke-linecap="round"/>`).join('') +
      `<circle cx="61" cy="33" r="6" fill="#f2c46d" stroke="${O}" stroke-width="2.5"/><circle cx="61" cy="47" r="4" fill="#e06c5a" stroke="${O}" stroke-width="2.2"/>`,
  );
}

export function chimesSvg(): string {
  return svg(
    72,
    100,
    `<ellipse cx="36" cy="92" rx="20" ry="5" fill="#2f4a2c" opacity="0.25"/>` +
      `<path d="M36 92 V10" stroke="#8a5f3e" stroke-width="6" stroke-linecap="round"/>` +
      `<path d="M14 18 H58" stroke="${O}" stroke-width="5" stroke-linecap="round"/><path d="M14 18 H58" stroke="#c2925d" stroke-width="2.5" stroke-linecap="round"/>` +
      [18, 28, 44, 54].map((x, i) => `<path d="M${x} 18 V${30 + i * 6}" stroke="#7a7a7a" stroke-width="1.2"/><rect x="${x - 3}" y="${30 + i * 6}" width="6" height="${20 - i * 2}" rx="3" fill="#c9d3db" stroke="${O}" stroke-width="2"/>`).join(''),
  );
}

// ---------------------------------------------------------------------------
// Emotes

export type EmoteIcon = 'food' | 'question' | 'alert' | 'heart' | 'toy' | 'sleep';

const BUBBLE_TINT: Record<EmoteIcon, string> = {
  food: '#fffaf0',
  question: '#f1f6ff',
  alert: '#fff0ec',
  heart: '#fff0f3',
  toy: '#fff6fb',
  sleep: '#f2f4ff',
};

function emoteIcon(kind: EmoteIcon): string {
  switch (kind) {
    case 'food':
      return `<path d="M15 25 C19 17 31 16 37 24 L44 19 L44 31 L37 26 C31 34 19 33 15 25 Z" fill="#f4a261" stroke="${O}" stroke-width="2.4" stroke-linejoin="round"/><circle cx="21" cy="24" r="1.8" fill="${O}"/>`;
    case 'question':
      return `<path d="M22 19 C22 11 38 11 38 19 C38 25 30 25 30 31" fill="none" stroke="#4f86d6" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="30" cy="38" r="3.2" fill="#4f86d6"/>`;
    case 'alert':
      return `<rect x="26.5" y="10" width="7" height="20" rx="3.5" fill="#e8604f"/><circle cx="30" cy="37" r="3.6" fill="#e8604f"/>`;
    case 'heart':
      return `<path d="M30 38 C18 30 14 24 16 19 C18 13 26 12 30 19 C34 12 42 13 44 19 C46 24 42 30 30 38 Z" fill="#f2777e" stroke="${O}" stroke-width="2.2" stroke-linejoin="round"/><ellipse cx="22" cy="20" rx="3" ry="2" fill="#fff" opacity="0.7"/>`;
    case 'toy':
      return `<circle cx="28" cy="25" r="11" fill="#f48fb1" stroke="${O}" stroke-width="2.4"/><path d="M20 21 q8 -6 16 2 M19 27 q8 -4 17 3" stroke="#fbc6d8" stroke-width="2" fill="none"/><path d="M38 31 q6 4 4 8" stroke="${O}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
    case 'sleep':
      return `<path d="M19 15 H31 L19 30 H31" fill="none" stroke="#7d8bc9" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M34 22 H41 L34 31 H41" fill="none" stroke="#9aa6dc" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
}

export function emoteSvg(kind: EmoteIcon): string {
  return svg(
    60,
    60,
    `<path d="M10 6 H50 C55 6 58 9 58 14 V38 C58 43 55 46 50 46 H36 L30 55 L24 46 H10 C5 46 2 43 2 38 V14 C2 9 5 6 10 6 Z" fill="${BUBBLE_TINT[kind]}" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>` +
      `<g transform="translate(0 2)">${emoteIcon(kind)}</g>`,
  );
}

export function heartSvg(color = '#f2777e'): string {
  return svg(
    32,
    32,
    `<path d="M16 28 C6 21 2 16 4 10 C6 5 13 4 16 10 C19 4 26 5 28 10 C30 16 26 21 16 28 Z" fill="${color}" stroke="${O}" stroke-width="2.2" stroke-linejoin="round"/><ellipse cx="10" cy="11" rx="2.6" ry="1.8" fill="#fff" opacity="0.75"/>`,
  );
}

export function sparkleSvg(color = '#ffe08a'): string {
  return svg(24, 24, `<path d="M12 1 C13 8 16 11 23 12 C16 13 13 16 12 23 C11 16 8 13 1 12 C8 11 11 8 12 1 Z" fill="${color}" stroke="${O}" stroke-width="1.4" stroke-linejoin="round"/>`);
}

export function zzzSvg(): string {
  return svg(20, 20, `<path d="M4 4 H15 L4 16 H15" fill="none" stroke="#7d8bc9" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`);
}

export function scentSvg(): string {
  return svg(24, 40, `<path d="M12 38 C4 30 20 24 12 16 C6 10 14 6 12 2" fill="none" stroke="#f6d7a7" stroke-width="3.5" stroke-linecap="round" opacity="0.9"/>`);
}

/** Soft diamond of shade used to mark covered (shaded) cells. */
export function shadeSvg(): string {
  return svg(
    120,
    60,
    `<defs><filter id="sb" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3.2"/></filter></defs>` +
      `<polygon points="8,30 60,4 112,30 60,56" fill="#25412f" opacity="0.82" filter="url(#sb)"/>`,
  );
}

export function sunSvg(): string {
  return svg(
    120,
    60,
    `<defs><radialGradient id="sun" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff6c9" stop-opacity="0.9"/><stop offset="1" stop-color="#fff6c9" stop-opacity="0"/></radialGradient></defs><ellipse cx="60" cy="30" rx="60" ry="30" fill="url(#sun)"/>`,
  );
}

export function flowerSvg(variant = 0): string {
  const colors = [
    ['#f7b2c0', '#fff1a8'],
    ['#fff6e0', '#f2c46d'],
    ['#c9b6f2', '#fff1a8'],
    ['#f6a28b', '#fff6e0'],
  ][variant % 4];
  const f = (x: number, y: number, c: string) =>
    [0, 72, 144, 216, 288].map((a) => `<ellipse cx="${x + Math.cos((a * Math.PI) / 180) * 3}" cy="${y + Math.sin((a * Math.PI) / 180) * 2}" rx="2.6" ry="1.9" fill="${c}"/>`).join('') +
    `<circle cx="${x}" cy="${y}" r="1.5" fill="${colors[1]}"/>`;
  return svg(
    32,
    24,
    `<path d="M9 22 V14 M21 22 V11 M15 22 V16" stroke="#6f9f57" stroke-width="1.6" stroke-linecap="round"/>` +
      `<ellipse cx="12" cy="20" rx="3" ry="1.4" fill="#6f9f57"/><ellipse cx="19" cy="19" rx="3" ry="1.4" fill="#6f9f57"/>` +
      f(9, 12, colors[0]) +
      f(21, 9, colors[0]) +
      f(15, 15, colors[0]),
  );
}

export function tuftSvg(): string {
  return svg(24, 16, `<path d="M4 15 C5 9 6 7 8 4 M9 15 C9 9 11 6 13 2 M14 15 C14 10 16 8 19 6 M17 15 C18 12 20 11 22 10" stroke="#7fa862" stroke-width="2" fill="none" stroke-linecap="round"/>`);
}

export function pebblesSvg(): string {
  return svg(28, 14, `<ellipse cx="8" cy="9" rx="5" ry="3" fill="#cfc4b4" stroke="#a89c8b" stroke-width="1.2"/><ellipse cx="18" cy="6" rx="4" ry="2.5" fill="#ddd3c5" stroke="#a89c8b" stroke-width="1.2"/><ellipse cx="22" cy="11" rx="3" ry="2" fill="#c6baa9" stroke="#a89c8b" stroke-width="1"/>`);
}

/** Pixel inside each prop svg that sits on the cell centre. */
export const ANCHORS = {
  bush: { x: 64, y: 96 },
  tree: { x: 64, y: 168 },
  rock: { x: 48, y: 58 },
  kibble: { x: 32, y: 32 },
  tuna: { x: 32, y: 36 },
  toy: { x: 32, y: 74 },
  mower: { x: 52, y: 70 },
  radio: { x: 44, y: 86 },
  chimes: { x: 36, y: 90 },
} as const;
