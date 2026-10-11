// Toolbar artwork — the same chunky style as the in-game props.
import { kibbleSvg, toySvg, tunaSvg } from './props';

const O = '#4c3b3a';
const svg = (w: number, h: number, body: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body}</svg>`;

export function trapIconSvg(): string {
  const bars = [16, 24, 32, 40, 48].map((x) => `<path d="M${x} 20 V44" stroke="#8796a3" stroke-width="2"/>`).join('');
  return svg(
    64,
    56,
    `<ellipse cx="32" cy="50" rx="26" ry="4" fill="#2f4a2c" opacity="0.18"/>` +
      `<rect x="8" y="18" width="48" height="28" rx="3" fill="#dfe6eb" stroke="${O}" stroke-width="3"/>` +
      bars +
      `<path d="M8 30 H56" stroke="#8796a3" stroke-width="2"/>` +
      `<rect x="48" y="10" width="10" height="22" rx="2" fill="#8c9aa6" stroke="${O}" stroke-width="2.5"/>` +
      `<path d="M22 18 C22 8 42 8 42 18" stroke="${O}" stroke-width="3.5" fill="none" stroke-linecap="round"/>` +
      `<ellipse cx="20" cy="40" rx="6" ry="3" fill="#d39a64" stroke="${O}" stroke-width="1.5"/>`,
  );
}

export function rotateIconSvg(): string {
  return svg(
    64,
    56,
    `<rect x="14" y="22" width="36" height="20" rx="3" fill="#dfe6eb" stroke="${O}" stroke-width="3"/>` +
      [22, 30, 38].map((x) => `<path d="M${x} 22 V42" stroke="#8796a3" stroke-width="2"/>`).join('') +
      `<path d="M10 18 C16 4 46 4 54 16" stroke="#f2a65a" stroke-width="5" fill="none" stroke-linecap="round"/>` +
      `<path d="M47 8 L55 17 L45 20" fill="none" stroke="#f2a65a" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<path d="M54 40 C48 52 18 52 10 42" stroke="#7ec8e3" stroke-width="5" fill="none" stroke-linecap="round"/>` +
      `<path d="M17 50 L9 41 L19 38" fill="none" stroke="#7ec8e3" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`,
  );
}

export function boxIconSvg(): string {
  return svg(
    64,
    56,
    `<ellipse cx="32" cy="50" rx="24" ry="4" fill="#2f4a2c" opacity="0.18"/>` +
      `<path d="M10 22 L32 30 L54 22 L54 44 L32 52 L10 44 Z" fill="#dcaa6e" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>` +
      `<path d="M32 30 V52" stroke="${O}" stroke-width="2.5"/><path d="M32 30 L54 22 L54 44 L32 52 Z" fill="#c08e55"/>` +
      `<path d="M10 22 L4 12 L26 18 L32 30 Z" fill="#ebc28c" stroke="${O}" stroke-width="2.5" stroke-linejoin="round"/>` +
      `<path d="M54 22 L60 12 L38 18 L32 30 Z" fill="#e3b77f" stroke="${O}" stroke-width="2.5" stroke-linejoin="round"/>` +
      `<path d="M21 26 V48" stroke="#e9d3a6" stroke-width="4"/>`,
  );
}

export function pawIconSvg(): string {
  return svg(
    64,
    56,
    `<ellipse cx="32" cy="34" rx="13" ry="11" fill="#f6c5c9" stroke="${O}" stroke-width="3"/>` +
      [
        [14, 22],
        [24, 12],
        [40, 12],
        [50, 22],
      ]
        .map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="5.5" ry="6.5" fill="#f6c5c9" stroke="${O}" stroke-width="3"/>`)
        .join(''),
  );
}

export const TOOL_ART = {
  trap: trapIconSvg(),
  rotate: rotateIconSvg(),
  kibble: kibbleSvg(),
  tuna: tunaSvg(),
  box: boxIconSvg(),
  toy: toySvg(),
  hand: pawIconSvg(),
} as const;
