// Level design harness (not part of `npm test`).
//   DESIGN=1 LEVEL=l1 npx vitest run scripts/design.test.ts --config scripts/vitest.config.ts
import { describe, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createInitialState, solutionToActions, type LevelDef } from '../src/core/level';
import { runTurn, isTurnError } from '../src/core/turnSystem';
import { renderAscii } from '../src/core/debug';
import { solve, describeAction } from '../src/core/solver';

const id = process.env.LEVEL ?? 'l1';
const def = JSON.parse(readFileSync(new URL(`../src/levels/${id}.json`, import.meta.url), 'utf8')) as LevelDef;

describe('design', () => {
  it('reference solution', () => {
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
});
