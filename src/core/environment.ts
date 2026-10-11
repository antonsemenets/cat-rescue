// EnvironmentSystem — interactive objects (gates, noisy machines) and
// scheduled events. New interactive objects plug in through
// validateInteract / applyInteract and updateEnvironment.

import type { ActionResult, GameEvent, GameState } from './types';
import { catAt, isNoiseActiveAt } from './world';

export function validateInteract(s: GameState, objectId: string): ActionResult {
  const gate = s.gates.find((g) => g.id === objectId);
  if (gate) {
    if (gate.open && catAt(s, gate.cell)) return { ok: false, reason: 'В калитке стоит кошка' };
    return { ok: true };
  }
  const noise = s.noises.find((n) => n.id === objectId);
  if (noise) {
    if (!noise.interactive) return { ok: false, reason: 'Этим нельзя управлять' };
    if (noise.active || noise.manualRemaining > 0) return { ok: false, reason: 'Уже шумит' };
    return { ok: true };
  }
  return { ok: false, reason: 'Здесь не с чем взаимодействовать' };
}

export function applyInteract(s: GameState, objectId: string, events: GameEvent[]): void {
  const gate = s.gates.find((g) => g.id === objectId);
  if (gate) {
    gate.open = !gate.open;
    gate.openTimer = gate.open ? gate.autoClose : 0;
    events.push({ type: 'gateToggled', gateId: gate.id, open: gate.open });
    return;
  }
  const noise = s.noises.find((n) => n.id === objectId);
  if (noise) noise.manualRemaining = noise.manualDuration;
}

/** Recompute which noises are active for the turn being simulated. */
export function updateEnvironment(s: GameState, turn: number, events: GameEvent[]): void {
  for (const n of s.noises) {
    const was = n.active;
    n.active = isNoiseActiveAt(n, turn);
    if (n.active && !was) events.push({ type: 'noiseStart', noiseId: n.id });
    if (!n.active && was) events.push({ type: 'noiseEnd', noiseId: n.id });
  }
}

/** End-of-turn ticking of manual triggers and spring gates. */
export function tickEnvironment(s: GameState, events: GameEvent[]): void {
  for (const n of s.noises) if (n.manualRemaining > 0) n.manualRemaining--;
  for (const g of s.gates) {
    if (!g.open || g.autoClose <= 0) continue;
    if (g.openTimer > 0) g.openTimer--;
    if (g.openTimer === 0 && !catAt(s, g.cell)) {
      g.open = false;
      events.push({ type: 'gateToggled', gateId: g.id, open: false });
    }
  }
}
