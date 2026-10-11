// TurnSystem — one player action followed by one simulation step.
//
//  1. apply the player's action
//  2. update environment & scheduled events
//  3. every cat perceives and decides from ONE snapshot of the world
//  4. resolve movement conflicts
//  5. move cats
//  6. eating, trap captures, hiding, playing
//  7. tick timers (food, toys, hiding, manual noises)
//  8. check victory
//  9. return events for the renderer
//
// runTurn is pure: it clones the input state and never mutates it.

import { decideAll, makeSnapshot, type Intent } from './catAI';
import { applyInteract, tickEnvironment, updateEnvironment, validateInteract } from './environment';
import { eq } from './grid';
import { ageItems, applyPlaceBox, applyPlaceFood, applyPlaceToy, processEating, validatePlaceBox, validatePlaceFood, validatePlaceToy } from './itemSystem';
import { resolveMoves } from './movement';
import { hideDuration } from './rules';
import { applyPlaceTrap, applyRotateTrap, processCaptures, validatePlaceTrap, validateRotateTrap } from './trapSystem';
import type { Action, ActionResult, GameEvent, GameState, TurnResult } from './types';
import { computeDanger, isHidingSpot, toyAt } from './world';

export function cloneState(s: GameState): GameState {
  return structuredClone(s);
}

export function validateAction(s: GameState, a: Action): ActionResult {
  if (s.status !== 'playing') return { ok: false, reason: 'Уровень завершён' };
  switch (a.type) {
    case 'placeTrap':
      return validatePlaceTrap(s, a.cell, a.dir);
    case 'rotateTrap':
      return validateRotateTrap(s, a.trapId, a.dir);
    case 'placeFood':
      return validatePlaceFood(s, a.kind, a.cell);
    case 'placeBox':
      return validatePlaceBox(s, a.cell);
    case 'placeToy':
      return validatePlaceToy(s, a.cell);
    case 'interact':
      return validateInteract(s, a.objectId);
    case 'wait':
      return { ok: true };
  }
}

/** Step 1 only — used for previews of a hypothetical action. */
export function applyAction(s: GameState, a: Action, events: GameEvent[]): void {
  switch (a.type) {
    case 'placeTrap':
      return applyPlaceTrap(s, a.cell, a.dir, events);
    case 'rotateTrap':
      return applyRotateTrap(s, a.trapId, a.dir, events);
    case 'placeFood':
      return applyPlaceFood(s, a.kind, a.cell, events);
    case 'placeBox':
      return applyPlaceBox(s, a.cell, events);
    case 'placeToy':
      return applyPlaceToy(s, a.cell, events);
    case 'interact':
      return applyInteract(s, a.objectId, events);
    case 'wait':
      return;
  }
}

function commitIntent(s: GameState, it: Intent, events: GameEvent[]): void {
  const cat = s.cats.find((c) => c.id === it.catId)!;
  if (cat.mode === 'trapped') return;
  const wasMode = cat.mode;
  cat.mode = it.mode;
  cat.activity = it.activity;
  cat.target = it.target;
  cat.patrolIndex = it.patrolIndex;
  cat.timer = it.timer;
  for (const e of it.emotes) events.push({ type: 'emote', catId: cat.id, emote: e });
  if (it.mode === 'frightened' && wasMode !== 'frightened') events.push({ type: 'catScared', catId: cat.id });
  if (it.startsHiding) events.push({ type: 'catHide', catId: cat.id });
  if (it.trustGain > 0 && cat.trust < 3) {
    cat.trust = Math.min(3, cat.trust + it.trustGain);
    events.push({ type: 'trustUp', catId: cat.id, trust: cat.trust });
  }
}

/**
 * Execute a full turn. Returns null-like error result if the action is invalid
 * (invalid actions never consume a turn).
 */
export function runTurn(prev: GameState, action: Action): TurnResult | { error: string } {
  const check = validateAction(prev, action);
  if (!check.ok) return { error: check.reason };

  const s = cloneState(prev);
  const events: GameEvent[] = [];

  // 1. action
  applyAction(s, action, events);
  s.turn += 1;

  // 2. environment
  updateEnvironment(s, s.turn, events);

  // 3. perception + decisions from a single snapshot
  const snap = makeSnapshot(cloneState(s));
  const intents = decideAll(snap);

  // 4. conflicts
  const { moves, blocked } = resolveMoves(snap.s, intents);

  // commit decisions (mode / target / emotes)
  for (const it of intents) commitIntent(s, it, events);

  // 5. movement
  const moved = new Set<string>();
  const catsSorted = [...s.cats].sort((a, b) => (a.id < b.id ? -1 : 1));
  for (const cat of catsSorted) {
    const to = moves.get(cat.id);
    if (to) {
      events.push({ type: 'catMove', catId: cat.id, from: { ...cat.pos }, to: { ...to } });
      cat.pos = { ...to };
      moved.add(cat.id);
    } else if (blocked.has(cat.id)) {
      events.push({ type: 'catBlocked', catId: cat.id });
      if (cat.activity === 'walk') cat.activity = 'sit';
    }
  }

  // 6. interactions
  processCaptures(s, moved, events);
  processEating(s, moved, events);
  const dangerNow = computeDanger(s);
  for (const cat of catsSorted) {
    if (cat.mode === 'trapped') continue;
    if (cat.mode === 'frightened' && moved.has(cat.id) && cat.target?.kind === 'hide' && eq(cat.pos, cat.target.cell)) {
      if (isHidingSpot(s, cat.pos) && !dangerNow[cat.pos.y * s.width + cat.pos.x]) {
        cat.mode = 'hiding';
        cat.activity = 'hide';
        cat.timer = hideDuration(cat);
        events.push({ type: 'catHide', catId: cat.id });
      }
    }
    if (cat.mode === 'interested' && cat.target?.kind === 'toy') {
      const toy = toyAt(s, cat.pos);
      if (toy && toy.id === cat.target.id) {
        cat.activity = 'play';
        events.push({ type: 'catPlay', catId: cat.id, toyId: toy.id });
      }
    }
  }

  // 7. timers
  ageItems(s, events);
  for (const it of intents) {
    if (!it.hideStay) continue;
    const cat = s.cats.find((c) => c.id === it.catId)!;
    if (cat.mode !== 'hiding') continue;
    cat.timer = Math.max(0, cat.timer - 1);
    if (cat.timer === 0) {
      cat.mode = 'idle';
      cat.activity = 'sit';
      cat.target = null;
      events.push({ type: 'catCalm', catId: cat.id });
    }
  }
  tickEnvironment(s, events);

  // 8. victory
  const required = s.cats.filter((c) => c.required);
  if (required.length > 0 && required.every((c) => c.mode === 'trapped')) {
    s.status = 'won';
    events.push({ type: 'won' });
  }

  return { state: s, events };
}

export function isTurnError(r: TurnResult | { error: string }): r is { error: string } {
  return 'error' in r;
}
