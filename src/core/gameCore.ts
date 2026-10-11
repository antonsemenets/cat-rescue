// GameCore — owns one level session: current state, history (undo),
// action log (replay), previews and dead-end detection.

import { planIntents, type Intent } from './catAI';
import { updateEnvironment } from './environment';
import { createInitialState, totalItems, type LevelDef } from './level';
import { computeResult, type LevelResult } from './scoring';
import { applyAction, cloneState, isTurnError, runTurn, validateAction } from './turnSystem';
import type { Action, ActionResult, GameEvent, GameState } from './types';

export type ActOutcome = { ok: true; events: GameEvent[]; state: GameState; prev: GameState } | { ok: false; reason: string };

export class GameCore {
  readonly def: LevelDef;
  private readonly initial: GameState;
  private history: GameState[];
  private log: Action[];

  constructor(def: LevelDef) {
    this.def = def;
    this.initial = createInitialState(def);
    this.history = [cloneState(this.initial)];
    this.log = [];
  }

  get state(): GameState {
    return this.history[this.history.length - 1];
  }

  get actions(): readonly Action[] {
    return this.log;
  }

  get canUndo(): boolean {
    return this.history.length > 1;
  }

  initialState(): GameState {
    return cloneState(this.initial);
  }

  validate(action: Action): ActionResult {
    return validateAction(this.state, action);
  }

  act(action: Action): ActOutcome {
    const prev = this.state;
    const r = runTurn(prev, action);
    if (isTurnError(r)) return { ok: false, reason: r.error };
    this.history.push(r.state);
    this.log.push(action);
    return { ok: true, events: r.events, state: r.state, prev };
  }

  undo(): GameState | null {
    if (!this.canUndo) return null;
    this.history.pop();
    this.log.pop();
    return this.state;
  }

  restart(): GameState {
    this.history = [cloneState(this.initial)];
    this.log = [];
    return this.state;
  }

  result(): LevelResult | null {
    return computeResult(this.state, this.def.stars);
  }

  /**
   * What cats will try to do on the next turn, optionally assuming the
   * player performs `action` first. Never mutates the session.
   */
  preview(action?: Action): Intent[] {
    const s = cloneState(this.state);
    if (action && validateAction(s, action).ok) applyAction(s, action, []);
    updateEnvironment(s, s.turn + 1, []);
    return planIntents(s);
  }

  /**
   * 'stuck'  — nothing left to change and waiting rescues nobody
   * 'slow'   — way past the turn budget, suggest undo
   * null     — fine
   */
  progressHint(): 'stuck' | 'slow' | null {
    const s = this.state;
    if (s.status !== 'playing') return null;
    const canChange =
      totalItems(s.inventory) > 0 ||
      s.gates.length > 0 ||
      s.noises.some((n) => n.interactive) ||
      s.traps.some((t) => t.rotatable && !t.occupiedBy);
    if (!canChange && !waitingHelps(s, 16)) return 'stuck';
    if (s.turn > this.def.stars.twoStarTurns * 2 + 4) return 'slow';
    return null;
  }
}

/** Does simply waiting rescue at least one more cat within `turns`? */
export function waitingHelps(s0: GameState, turns: number): boolean {
  let s = s0;
  const before = s.rescued.length;
  for (let i = 0; i < turns; i++) {
    const r = runTurn(s, { type: 'wait' });
    if (isTurnError(r)) return false;
    s = r.state;
    if (s.rescued.length > before) return true;
  }
  return false;
}

/** Run a list of actions from a fresh state (used by replay and tests). */
export function simulate(def: LevelDef, actions: Action[]): { state: GameState; events: GameEvent[][]; error?: string; failedAt?: number } {
  let s = createInitialState(def);
  const events: GameEvent[][] = [];
  for (let i = 0; i < actions.length; i++) {
    const r = runTurn(s, actions[i]);
    if (isTurnError(r)) return { state: s, events, error: r.error, failedAt: i };
    s = r.state;
    events.push(r.events);
  }
  return { state: s, events };
}
