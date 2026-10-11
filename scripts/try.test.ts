import { it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createInitialState, solutionToActions, type LevelDef, type SolutionStep } from '../src/core/level';
import { runTurn, isTurnError } from '../src/core/turnSystem';
import { renderAscii } from '../src/core/debug';
const id = process.env.LEVEL ?? 'l1';
const def = JSON.parse(readFileSync(new URL(`../src/levels/${id}.json`, import.meta.url), 'utf8')) as LevelDef;
it('try', () => {
  const steps = JSON.parse(process.env.STEPS ?? '[]') as SolutionStep[];
  let s = createInitialState(def);
  for (const a of solutionToActions(steps)) {
    const r = runTurn(s, a);
    if (isTurnError(r)) { console.log('ERR', r.error); break; }
    s = r.state;
    if (process.env.V) console.log(renderAscii(s));
    if (s.status === 'won') break;
  }
  console.log(renderAscii(s));
});
