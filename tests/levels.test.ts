import { describe, expect, it } from 'vitest';
import { simulate } from '../src/core/gameCore';
import { createInitialState, solutionToActions, validateLevel, type LevelDef } from '../src/core/level';
import { computeResult } from '../src/core/scoring';
import { isTurnError, runTurn } from '../src/core/turnSystem';
import type { Action, GameState } from '../src/core/types';
import { LEVELS, levelById } from '../src/levels';

function runUntilWon(s: GameState, acts: Action[]): GameState {
  for (const a of acts) {
    if (s.status === 'won') break;
    const r = runTurn(s, a);
    if (isTurnError(r)) break;
    s = r.state;
  }
  return s;
}

const waits = (n: number): Action[] => Array.from({ length: n }, () => ({ type: 'wait' }));

describe('levels', () => {
  it('there are at least eight levels in order', () => {
    expect(LEVELS.length).toBeGreaterThanOrEqual(8);
    LEVELS.forEach((l, i) => expect(l.order).toBe(i + 1));
  });

  for (const def of LEVELS) {
    describe(`${def.order}. ${def.title}`, () => {
      it('passes validation', () => {
        expect(validateLevel(def)).toEqual([]);
      });

      it('is solvable with the reference solution and earns three stars', () => {
        const actions = solutionToActions(def.solution);
        const r = simulate(def, actions.slice(0, actions.length));
        // the solution may contain extra waits after victory — simulate stops on error
        const s = runUntilWon(createInitialState(def), actions);
        expect(r.error === undefined || r.error === 'Уровень завершён').toBe(true);
        expect(s.status).toBe('won');
        const res = computeResult(s, def.stars)!;
        expect(res.stars).toBe(3);
        expect(res.rescued).toBe(def.cats.length);
      });

      it('has a briefing by Sasha and a victory line', () => {
        expect(def.intro?.length ?? 0).toBeGreaterThanOrEqual(2);
        expect(def.outro?.trim().length ?? 0).toBeGreaterThan(0);
      });

      it('cannot be solved by just doing nothing', () => {
        const s = runUntilWon(createInitialState(def), waits(40));
        expect(s.status).toBe('playing');
      });

      if (def.order >= 2) {
        it('is not solved by simply baiting the first trap and waiting', () => {
          const start = createInitialState(def);
          for (const t of start.traps) {
            for (const kind of ['kibble', 'tuna'] as const) {
              if (start.inventory[kind] <= 0) continue;
              const s = runUntilWon(start, [{ type: 'placeFood', kind, cell: t.back }, ...waits(40)]);
              expect(s.status, `${kind} in ${t.id}`).toBe('playing');
            }
          }
        });
      }
    });
  }

  it('validation catches a broken briefing', () => {
    const broken = { ...LEVELS[0], intro: [{ pose: 'dance', text: '', focus: { cat: 'nobody', tool: 'laser' } }] } as unknown as LevelDef;
    expect(validateLevel(broken).length).toBeGreaterThanOrEqual(4);
  });

  it('level 4: baiting the shady trap first lets Bublik steal it — a dead end', () => {
    const def = levelById('l4')!;
    const s = runUntilWon(createInitialState(def), [
      { type: 'placeFood', kind: 'kibble', cell: { x: 6, y: 1 } },
      { type: 'placeFood', kind: 'tuna', cell: { x: 2, y: 5 } },
      ...waits(30),
    ]);
    expect(s.status).toBe('playing');
    expect(s.cats.find((c) => c.id === 'bublik')!.trappedIn).toBe('trapA');
  });

  it('level 6: opening the spring gate too early wastes the chance', () => {
    const def = levelById('l6')!;
    const s = runUntilWon(createInitialState(def), [
      { type: 'interact', objectId: 'gate' },
      { type: 'placeFood', kind: 'tuna', cell: { x: 7, y: 4 } },
      ...waits(4),
    ]);
    expect(s.status).toBe('playing');
    expect(s.gates[0].open).toBe(false);
  });

  it('level 8: a toy placed too early is ruined by the radio', () => {
    const def = levelById('l8')!;
    const s = runUntilWon(createInitialState(def), [
      { type: 'placeTrap', cell: { x: 3, y: 6 }, dir: 'W' },
      { type: 'placeFood', kind: 'kibble', cell: { x: 3, y: 6 } },
      { type: 'placeToy', cell: { x: 1, y: 6 } },
      ...waits(20),
    ]);
    expect(s.cats.find((c) => c.id === 'knopka')!.mode).not.toBe('trapped');
  });
});
