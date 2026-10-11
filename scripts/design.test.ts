// Level design harness (not part of `npm test`).
//   DESIGN=1 LEVEL=l1 npx vitest run scripts/design.test.ts --config scripts/vitest.config.ts
import { describe, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createInitialState, solutionToActions, validateLevel, type LevelDef } from '../src/core/level';
import { computeResult } from '../src/core/scoring';
import type { Action, GameState } from '../src/core/types';
import { runTurn, isTurnError } from '../src/core/turnSystem';
import { renderAscii } from '../src/core/debug';
import { solve, describeAction, candidateActions, stateKey } from '../src/core/solver';

const id = process.env.LEVEL ?? 'l1';
const def = JSON.parse(readFileSync(new URL(`../src/levels/${id}.json`, import.meta.url), 'utf8')) as LevelDef;

function runUntilWon(s: GameState, acts: Action[]): GameState {
  for (const a of acts) {
    if (s.status === 'won') break;
    const r = runTurn(s, a);
    if (isTurnError(r)) break;
    s = r.state;
  }
  return s;
}
const waitN = (n: number): Action[] => Array.from({ length: n }, () => ({ type: 'wait' }) as Action);

describe('design', () => {
  it('checks', () => {
    const errors = validateLevel(def);
    console.log('VALIDATION', errors.length ? errors.join('; ') : 'ok');
    if (errors.length) return;
    const start = createInitialState(def);
    const ref = runUntilWon(start, solutionToActions(def.solution));
    const res = computeResult(ref, def.stars);
    console.log('REFERENCE', ref.status, 'turns', ref.turn, 'items', JSON.stringify(ref.used), 'stars', res?.stars ?? 0);
    console.log('IDLE (40 waits)', runUntilWon(start, waitN(40)).status);
    for (const t of start.traps) {
      for (const kind of ['kibble', 'tuna'] as const) {
        if (start.inventory[kind] <= 0) continue;
        const s = runUntilWon(start, [{ type: 'placeFood', kind, cell: t.back }, ...waitN(40)]);
        console.log(`NAIVE ${kind} in ${t.id}:`, s.status, s.status === 'won' ? `(turn ${s.turn}) <-- must be 'playing'` : '');
      }
    }
  });

  it.runIf(process.env.TRACE)('reference solution', () => {
    let s = createInitialState(def);
    console.log(renderAscii(s));
    for (const a of solutionToActions(def.solution)) {
      const r = runTurn(s, a);
      if (isTurnError(r)) {
        console.log('ERROR', describeAction(a), r.error);
        return;
      }
      s = r.state;
      console.log('>>', describeAction(a), r.events.filter((e) => e.type !== 'catMove').map((e) => e.type + ('catId' in e ? ':' + e.catId : '') + ('emote' in e ? ':' + e.emote : '')).join(' '));
      console.log(renderAscii(s));
      if (s.status === 'won') break;
    }
    console.log('RESULT', s.status, 'turns', s.turn, 'used', JSON.stringify(s.used));
  });
  it.runIf(process.env.SOLVE)('solver', () => {
    const t0 = Date.now();
    const r = solve(createInitialState(def), { maxTurns: Number(process.env.MAXT ?? 14), maxStates: Number(process.env.MAXS ?? 300000), maxItems: process.env.MAXI ? Number(process.env.MAXI) : undefined });
    console.log('SOLVER', r.solved, r.turns, r.actions.map(describeAction).join(' | '), 'explored', r.explored, 'exhausted', r.exhausted, (Date.now() - t0) + 'ms');
  }, 600000);
  it.runIf(process.env.NAIVE)('naive: bait first trap then wait', () => {
    let s = createInitialState(def);
    const t = s.traps[0];
    if (!t) return;
    const acts = [{ type: 'placeFood', kind: s.inventory.tuna > 0 ? 'tuna' : 'kibble', cell: t.back }, ...Array(30).fill({ type: 'wait' })] as never[];
    for (const a of acts) {
      const r = runTurn(s, a);
      if (isTurnError(r)) break;
      s = r.state;
      if (s.status === 'won') break;
    }
    console.log('NAIVE', s.status, s.turn);
  });

  // Faster upper-bound search for big levels: BFS over the first MAXD turns,
  // and after every placement simply wait and see (rollout up to MAXT turns).
  //   ROLL=1 MAXD=8 MAXT=30 [MAXI=items] LEVEL=l12 npx vitest run scripts/design.test.ts --config scripts/vitest.config.ts --reporter=verbose
  it.runIf(process.env.ROLL)('rollout search', () => {
    const t0 = Date.now();
    const maxD = Number(process.env.MAXD ?? 8);
    const maxT = Number(process.env.MAXT ?? 30);
    const maxI = process.env.MAXI ? Number(process.env.MAXI) : Infinity;
    const maxS = Number(process.env.MAXS ?? 200000);
    const start = createInitialState(def);
    const withTurn = start.noises.some((n) => n.schedule);
    interface N { s: GameState; acts: Action[] }
    let best: { turns: number; acts: Action[]; items: number } | null = null;
    const items = (s: GameState) => s.used.trap + s.used.kibble + s.used.tuna + s.used.box + s.used.toy;
    const rollout = (n: N) => {
      let s = n.s;
      const acts = [...n.acts];
      while (s.status === 'playing' && s.turn < maxT && (!best || s.turn < best.turns)) {
        const r = runTurn(s, { type: 'wait' });
        if (isTurnError(r)) return;
        s = r.state;
        acts.push({ type: 'wait' });
      }
      if (s.status === 'won' && (!best || s.turn < best.turns || (s.turn === best.turns && items(s) < best.items))) best = { turns: s.turn, acts, items: items(s) };
    };
    const seen = new Set<string>();
    let frontier: N[] = [{ s: start, acts: [] }];
    rollout(frontier[0]);
    for (let d = 0; d < maxD && frontier.length; d++) {
      const next: N[] = [];
      for (const n of frontier) {
        if (best && n.s.turn + 1 >= best.turns) continue;
        for (const a of candidateActions(n.s)) {
          const r = runTurn(n.s, a);
          if (isTurnError(r)) continue;
          if (items(r.state) > maxI) continue;
          const child = { s: r.state, acts: [...n.acts, a] };
          if (r.state.status === 'won') {
            if (!best || r.state.turn < best.turns) best = { turns: r.state.turn, acts: child.acts, items: items(r.state) };
            continue;
          }
          const k = stateKey(r.state, withTurn);
          if (seen.has(k)) continue;
          seen.add(k);
          if (a.type !== 'wait') rollout(child);
          next.push(child);
        }
        if (seen.size > maxS) break;
      }
      frontier = next;
      const b = best as { turns: number; acts: Action[]; items: number } | null;
      console.log(`depth ${d + 1}: frontier ${frontier.length}, seen ${seen.size}, best ${b ? b.turns : '-'} (${Date.now() - t0}ms)`);
      if (seen.size > maxS) break;
    }
    const b = best as { turns: number; acts: Action[]; items: number } | null;
    if (!b) console.log('ROLLOUT no solution found');
    else {
      const trimmed = b.acts.slice(0, b.turns);
      console.log('ROLLOUT best', b.turns, 'turns, items', b.items, '|', trimmed.map(describeAction).join(' | '));
    }
  }, 600000);
});
