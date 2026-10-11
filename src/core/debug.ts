// ASCII rendering of a state — handy for tests, level design and bug reports.

import { eq } from './grid';
import type { GameState } from './types';
import { computeCover, computeDanger, trapFront } from './world';

const FEATURE_CH: Record<string, string> = {
  wall: '#',
  fence: 'F',
  tree: 'T',
  rock: 'R',
  crate: 'C',
  shed: 'S',
  water: '~',
  bush: 'B',
  den: 'D',
};
const ARROW: Record<string, string> = { N: '^', E: '>', S: 'v', W: '<' };

export function renderAscii(s: GameState): string {
  const cover = computeCover(s);
  const danger = computeDanger(s);
  const rows: string[] = [];
  for (let y = 0; y < s.height; y++) {
    let row = '';
    for (let x = 0; x < s.width; x++) {
      const c = { x, y };
      const i = y * s.width + x;
      let ch = cover[i] ? '-' : '.';
      if (danger[i]) ch = '!';
      const f = s.features[i];
      if (f) ch = FEATURE_CH[f];
      const gate = s.gates.find((g) => eq(g.cell, c));
      if (gate) ch = gate.open ? 'g' : 'G';
      const noise = s.noises.find((n) => eq(n.cell, c));
      if (noise) ch = noise.active ? 'N' : 'n';
      for (const t of s.traps) {
        if (eq(t.back, c)) ch = t.occupiedBy ? '@' : t.bait ? (t.bait === 'tuna' ? '$' : '%') : '=';
        if (eq(trapFront(t), c)) ch = ARROW[t.dir];
      }
      if (s.boxes.some((b) => eq(b.cell, c))) ch = 'X';
      if (s.toys.some((t) => eq(t.cell, c))) ch = 'o';
      const food = s.foods.find((f2) => eq(f2.cell, c));
      if (food) ch = food.kind === 'tuna' ? 't' : 'k';
      const cat = s.cats.find((k) => k.mode !== 'trapped' && eq(k.pos, c));
      if (cat) ch = cat.id[0].toUpperCase();
      row += ch;
    }
    rows.push(row);
  }
  const cats = s.cats
    .map((c) => `${c.id}@${c.pos.x},${c.pos.y} ${c.mode}/${c.activity} h${c.hunger} f${c.fear} c${c.curiosity} t${c.trust}${c.target ? ` ->${c.target.kind}${c.target.id ? ':' + c.target.id : ''}(${c.target.cell.x},${c.target.cell.y})` : ''}${c.timer ? ` timer${c.timer}` : ''}`)
    .join('\n  ');
  return `turn ${s.turn} ${s.status}\n${rows.join('\n')}\n  ${cats}`;
}
