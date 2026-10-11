// TrapSystem — placing and rotating humane traps, and capturing cats that
// walk all the way inside onto the trigger plate.

import { add, eq, inBounds } from './grid';
import type { ActionResult, Cell, Dir, GameEvent, GameState, Trap } from './types';
import { catAt, catsInsideTrap, featureAt, gateAt, isEmptyGround, isSolidFeature, noiseAt, trapAt, trapApproach } from './world';

function approachOk(s: GameState, c: Cell, ignore?: Trap): string | null {
  if (!inBounds(c, s.width, s.height)) return 'Вход ловушки смотрит за край двора';
  if (isSolidFeature(featureAt(s, c)) || noiseAt(s, c)) return 'Вход ловушки упирается в препятствие';
  const g = gateAt(s, c);
  if (g) return 'Вход не может смотреть в калитку';
  const hit = trapAt(s, c);
  if (hit && hit.trap !== ignore) return 'Вход загорожен другой ловушкой';
  return null;
}

/** Would a trap body on these cells wall off another trap's entrance? */
function blocksOtherEntrance(s: GameState, cells: Cell[], ignore?: Trap): boolean {
  return s.traps.some((t) => t !== ignore && cells.some((c) => eq(c, trapApproach(t))));
}

export function validatePlaceTrap(s: GameState, back: Cell, dir: Dir): ActionResult {
  if (s.inventory.trap <= 0) return { ok: false, reason: 'Ловушки закончились' };
  const front = add(back, dir);
  for (const c of [back, front]) {
    if (!inBounds(c, s.width, s.height)) return { ok: false, reason: 'Ловушка не помещается здесь' };
    if (catAt(s, c)) return { ok: false, reason: 'Нельзя ставить ловушку на кошку — она испугается' };
    if (!isEmptyGround(s, c)) return { ok: false, reason: 'Ловушке нужны две свободные клетки' };
  }
  if (blocksOtherEntrance(s, [back, front])) return { ok: false, reason: 'Так ловушка загородит вход другой ловушки' };
  const why = approachOk(s, add(back, dir, 2));
  if (why) return { ok: false, reason: why };
  return { ok: true };
}

export function applyPlaceTrap(s: GameState, back: Cell, dir: Dir, events: GameEvent[]): void {
  const id = `trap${s.nextId++}`;
  s.traps.push({ id, back: { ...back }, dir, bait: null, occupiedBy: null, rotatable: true });
  s.inventory.trap--;
  s.used.trap++;
  events.push({ type: 'placed', item: 'trap', id, cell: { ...back } });
}

export function validateRotateTrap(s: GameState, trapId: string, dir: Dir): ActionResult {
  const t = s.traps.find((x) => x.id === trapId);
  if (!t) return { ok: false, reason: 'Ловушка не найдена' };
  if (!t.rotatable) return { ok: false, reason: 'Эта ловушка закреплена' };
  if (t.occupiedBy) return { ok: false, reason: 'В ловушке уже сидит кошка' };
  if (catsInsideTrap(s, t).length > 0) return { ok: false, reason: 'Внутри кошка — подождите' };
  if (t.dir === dir) return { ok: false, reason: 'Ловушка уже смотрит в эту сторону' };
  const front = add(t.back, dir);
  if (!inBounds(front, s.width, s.height)) return { ok: false, reason: 'Ловушка не помещается так' };
  const oldFront = add(t.back, t.dir);
  if (!eq(front, oldFront)) {
    if (catAt(s, front)) return { ok: false, reason: 'Мешает кошка' };
    if (!isEmptyGround(s, front)) return { ok: false, reason: 'Для разворота нужна свободная клетка' };
  }
  if (blocksOtherEntrance(s, [front], t)) return { ok: false, reason: 'Так ловушка загородит вход другой ловушки' };
  const why = approachOk(s, add(t.back, dir, 2), t);
  if (why) return { ok: false, reason: why };
  return { ok: true };
}

export function applyRotateTrap(s: GameState, trapId: string, dir: Dir, events: GameEvent[]): void {
  const t = s.traps.find((x) => x.id === trapId)!;
  t.dir = dir;
  events.push({ type: 'trapRotated', trapId, dir });
}

/** Directions a trap anchored at `back` could face (for placement previews). */
export function validTrapDirs(s: GameState, back: Cell): Dir[] {
  return (['N', 'E', 'S', 'W'] as Dir[]).filter((d) => validatePlaceTrap(s, back, d).ok);
}

export function validRotateDirs(s: GameState, trapId: string): Dir[] {
  return (['N', 'E', 'S', 'W'] as Dir[]).filter((d) => validateRotateTrap(s, trapId, d).ok);
}

/** Capture cats standing on a trap plate. Sorted by id for determinism. */
export function processCaptures(s: GameState, movedIds: Set<string>, events: GameEvent[]): void {
  const cats = [...s.cats].sort((a, b) => (a.id < b.id ? -1 : 1));
  for (const cat of cats) {
    if (cat.mode === 'trapped' || !movedIds.has(cat.id)) continue;
    const hit = trapAt(s, cat.pos);
    if (!hit || hit.part !== 'back' || hit.trap.occupiedBy) continue;
    const t = hit.trap;
    t.occupiedBy = cat.id;
    if (t.bait) {
      events.push({ type: 'catEat', catId: cat.id, foodId: `bait:${t.id}`, cell: { ...t.back } });
      t.bait = null;
    }
    cat.mode = 'trapped';
    cat.activity = 'trapped';
    cat.trappedIn = t.id;
    cat.target = null;
    s.rescued.push(cat.id);
    events.push({ type: 'catTrapped', catId: cat.id, trapId: t.id });
    events.push({ type: 'emote', catId: cat.id, emote: 'heart' });
  }
}
