// ItemSystem — food, shelter boxes and toys: validation, placement, eating,
// expiry. To add a new tool: add an ItemKind, an Action variant, a validator
// and an apply function here, then route it in turnSystem.applyAction.

import { RULES } from './rules';
import type { ActionResult, Cell, FoodKind, GameEvent, GameState } from './types';
import { catAt, catsInsideTrap, foodAt, isEmptyGround, trapAt } from './world';

const FOOD_NAMES: Record<FoodKind, string> = { kibble: 'Корм', tuna: 'Тунец' };

export function validatePlaceFood(s: GameState, kind: FoodKind, c: Cell): ActionResult {
  if (s.inventory[kind] <= 0) return { ok: false, reason: `${FOOD_NAMES[kind]} закончился` };
  const hit = trapAt(s, c);
  if (hit) {
    const t = hit.trap;
    if (t.occupiedBy) return { ok: false, reason: 'В ловушке уже сидит кошка' };
    if (t.bait) return { ok: false, reason: 'В ловушке уже есть приманка' };
    if (catsInsideTrap(s, t).length > 0) return { ok: false, reason: 'Внутри кошка — подождите' };
    return { ok: true };
  }
  if (catAt(s, c)) return { ok: false, reason: 'Здесь сидит кошка' };
  if (!isEmptyGround(s, c)) return { ok: false, reason: 'Корм можно положить только на свободную землю или в ловушку' };
  return { ok: true };
}

export function applyPlaceFood(s: GameState, kind: FoodKind, c: Cell, events: GameEvent[]): void {
  s.inventory[kind]--;
  s.used[kind]++;
  const hit = trapAt(s, c);
  if (hit) {
    hit.trap.bait = kind;
    events.push({ type: 'placed', item: kind, id: `bait:${hit.trap.id}`, cell: { ...hit.trap.back }, inTrap: hit.trap.id });
    return;
  }
  const id = `food${s.nextId++}`;
  s.foods.push({ id, kind, cell: { ...c }, ttl: RULES.foodTtl });
  events.push({ type: 'placed', item: kind, id, cell: { ...c } });
}

export function validatePlaceBox(s: GameState, c: Cell): ActionResult {
  if (s.inventory.box <= 0) return { ok: false, reason: 'Укрытия закончились' };
  if (catAt(s, c)) return { ok: false, reason: 'Здесь сидит кошка' };
  if (!isEmptyGround(s, c)) return { ok: false, reason: 'Укрытие ставится на свободную землю' };
  return { ok: true };
}

export function applyPlaceBox(s: GameState, c: Cell, events: GameEvent[]): void {
  s.inventory.box--;
  s.used.box++;
  const id = `box${s.nextId++}`;
  s.boxes.push({ id, cell: { ...c } });
  events.push({ type: 'placed', item: 'box', id, cell: { ...c } });
}

export function validatePlaceToy(s: GameState, c: Cell): ActionResult {
  if (s.inventory.toy <= 0) return { ok: false, reason: 'Игрушки закончились' };
  if (catAt(s, c)) return { ok: false, reason: 'Здесь сидит кошка' };
  if (trapAt(s, c)) return { ok: false, reason: 'Игрушку нельзя класть в ловушку' };
  if (!isEmptyGround(s, c)) return { ok: false, reason: 'Игрушка кладётся на свободную землю' };
  return { ok: true };
}

export function applyPlaceToy(s: GameState, c: Cell, events: GameEvent[]): void {
  s.inventory.toy--;
  s.used.toy++;
  const id = `toy${s.nextId++}`;
  s.toys.push({ id, cell: { ...c }, ttl: RULES.toyTtl });
  events.push({ type: 'placed', item: 'toy', id, cell: { ...c } });
}

/** Cats that stepped onto ground food eat it: hunger -1, trust +1. */
export function processEating(s: GameState, movedIds: Set<string>, events: GameEvent[]): void {
  const cats = [...s.cats].sort((a, b) => (a.id < b.id ? -1 : 1));
  for (const cat of cats) {
    if (cat.mode === 'trapped' || cat.mode === 'frightened') continue;
    // eat on arrival, or when already standing on the food (e.g. after a scare)
    if (!movedIds.has(cat.id) && cat.activity !== 'eat') continue;
    if (cat.hunger < 1) continue;
    const food = foodAt(s, cat.pos);
    if (!food) continue;
    s.foods = s.foods.filter((f) => f !== food);
    cat.hunger = Math.max(0, cat.hunger - 1);
    cat.activity = 'eat';
    events.push({ type: 'catEat', catId: cat.id, foodId: food.id, cell: { ...food.cell } });
    if (cat.trust < 3) {
      cat.trust++;
      events.push({ type: 'trustUp', catId: cat.id, trust: cat.trust });
      events.push({ type: 'emote', catId: cat.id, emote: 'heart' });
    }
    if (cat.target?.kind === 'food') cat.target = null;
  }
}

/** Food and toys age by one turn; stale ones disappear. */
export function ageItems(s: GameState, events: GameEvent[]): void {
  const keepFood = [];
  for (const f of s.foods) {
    f.ttl--;
    if (f.ttl <= 0) events.push({ type: 'foodExpired', foodId: f.id });
    else keepFood.push(f);
  }
  s.foods = keepFood;
  const keepToys = [];
  for (const t of s.toys) {
    t.ttl--;
    if (t.ttl <= 0) events.push({ type: 'toyExpired', toyId: t.id });
    else keepToys.push(t);
  }
  s.toys = keepToys;
}
