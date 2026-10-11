import { createInitialState, type CatDef, type LevelDef } from '../src/core/level';
import { isTurnError, runTurn } from '../src/core/turnSystem';
import type { Action, GameState, GameEvent } from '../src/core/types';

const LOOK = { pattern: 'solid', base: '#888', accent: '#ccc', stripe: '#444', eyes: '#0a0' } as const;

export function catDef(id: string, pos: [number, number], traits: Partial<CatDef['traits']> = {}, extra: Partial<CatDef> = {}): CatDef {
  return {
    id,
    name: id,
    pos,
    traits: { hunger: 2, fear: 0, curiosity: 0, trust: 3, ...traits },
    look: { ...LOOK },
    personality: '',
    bio: '',
    ...extra,
  };
}

export function level(partial: Partial<LevelDef> & Pick<LevelDef, 'map' | 'cats'>): LevelDef {
  return {
    id: 'test',
    order: 99,
    title: 'test',
    subtitle: '',
    location: 'yard',
    description: '',
    inventory: {},
    stars: { twoStarTurns: 10, threeStarTurns: 5, threeStarItems: 1 },
    solution: [{ type: 'wait' }],
    ...partial,
  };
}

export function state(partial: Partial<LevelDef> & Pick<LevelDef, 'map' | 'cats'>): GameState {
  return createInitialState(level(partial));
}

export function step(s: GameState, a: Action): { state: GameState; events: GameEvent[] } {
  const r = runTurn(s, a);
  if (isTurnError(r)) throw new Error(`action rejected: ${r.error}`);
  return r;
}

export function play(s: GameState, actions: Action[]): { state: GameState; events: GameEvent[][] } {
  const events: GameEvent[][] = [];
  for (const a of actions) {
    if (s.status === 'won') break;
    const r = step(s, a);
    s = r.state;
    events.push(r.events);
  }
  return { state: s, events };
}

export function waits(n: number): Action[] {
  return Array.from({ length: n }, () => ({ type: 'wait' }) as Action);
}

export function catOf(s: GameState, id: string) {
  const c = s.cats.find((k) => k.id === id);
  if (!c) throw new Error(`no cat ${id}`);
  return c;
}
