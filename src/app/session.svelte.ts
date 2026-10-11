// GameSession — glue between the pure GameCore, the Phaser BoardView and the
// Svelte HUD. Turns pointer input into actions, builds preview overlays,
// tracks hints, victory and replay.

import { audio } from '../audio/audio';
import type { Intent } from '../core/catAI';
import { GameCore } from '../core/gameCore';
import { add, eq, inBounds, manhattan } from '../core/grid';
import type { LevelDef } from '../core/level';
import { foodNoticeRadius, toyNoticeRadius } from '../core/rules';
import type { LevelResult } from '../core/scoring';
import { validRotateDirs, validTrapDirs } from '../core/trapSystem';
import { validateAction } from '../core/turnSystem';
import type { Action, Cell, Dir, FoodKind, GameEvent, GameState, ItemKind } from '../core/types';
import { trapAt } from '../core/world';
import type { BoardView } from '../render/BoardView';
import { EMPTY_OVERLAY, type Ghost, type Overlay, type PathPreview, type Zone } from '../render/types';
import { app } from './store.svelte';
import { FOOD_NAMES, ITEM_NAMES, NOISE_ACTION, NOISE_SOUND, gateWords, turnsWord } from './text';

export type Tool = 'trap' | 'rotate' | 'kibble' | 'tuna' | 'box' | 'toy' | 'hand';

export type Selection =
  | { kind: 'cat'; id: string }
  | { kind: 'trap'; id: string }
  | { kind: 'gate'; id: string }
  | { kind: 'noise'; id: string }
  | { kind: 'food'; id: string }
  | { kind: 'toy'; id: string };

export const CAT_COLORS = [0xffb36b, 0x7ec8e3, 0xf48fb1, 0xb9a3f0, 0x8ee3c8];

const TOOL_ITEM: Partial<Record<Tool, ItemKind>> = { trap: 'trap', kibble: 'kibble', tuna: 'tuna', box: 'box', toy: 'toy' };

export class GameSession {
  readonly def: LevelDef;
  readonly core: GameCore;
  state = $state.raw<GameState>(null as unknown as GameState);
  tool = $state<Tool | null>(null);
  pendingTrap = $state<Cell | null>(null);
  pendingRotate = $state<string | null>(null);
  hover = $state<Cell | null>(null);
  selection = $state<Selection | null>(null);
  toast = $state<{ text: string; kind: 'error' | 'info'; id: number } | null>(null);
  hint = $state<string | null>(null);
  result = $state<LevelResult | null>(null);
  showVictory = $state(false);
  progress = $state<'stuck' | 'slow' | null>(null);
  replaying = $state(false);
  loading = $state(true);
  canUndo = $state(false);
  hoverText = $state<string | null>(null);
  /** Sasha's briefing is on screen — the board ignores input meanwhile */
  briefing = $state(false);
  focusTool = $state<Tool | null>(null);
  focusCat = $state<string | null>(null);
  focusCells = $state<Cell[]>([]);

  private view: BoardView | null = null;
  private shownHints = new Set<string>();
  private hintWhen: string | null = null;
  private toastTimer: number | null = null;
  private replayTimer: number | null = null;
  private victoryTimer: number | null = null;
  private plainIntents: Intent[] = [];
  private replayQueue: Action[] = [];
  private replayIndex = 0;

  constructor(def: LevelDef) {
    this.def = def;
    this.core = new GameCore(def);
    this.state = this.core.state;
    this.plainIntents = this.core.preview();
    if (import.meta.env.DEV) (window as unknown as { __session: GameSession }).__session = this;
  }

  catColor(id: string): number {
    const i = this.def.cats.findIndex((c) => c.id === id);
    return CAT_COLORS[(i < 0 ? 0 : i) % CAT_COLORS.length];
  }

  // ---------------------------------------------------------------------------
  // wiring

  async attach(view: BoardView) {
    this.view = view;
    this.loading = true;
    await view.loadLevel(this.def, this.state);
    this.loading = false;
    view.sync(this.state);
    const auto = app.settings.showHints && !!this.def.intro?.length && !app.save.seenBriefings.includes(this.def.id);
    if (auto) this.openBriefing();
    else this.triggerHint('start');
    this.refresh();
  }

  /** Sasha points at a tool, a cat or some cells while she talks. */
  setFocus(f: { tool?: string; cat?: string; cells?: [number, number][] } | undefined) {
    this.focusTool = (f?.tool as Tool) ?? null;
    this.focusCat = f?.cat ?? null;
    this.focusCells = (f?.cells ?? []).map(([x, y]) => ({ x, y }));
    this.refresh();
  }

  openBriefing() {
    if (!this.def.intro?.length) return;
    this.tool = null;
    this.pendingTrap = null;
    this.pendingRotate = null;
    this.hoverText = null;
    this.hint = null;
    this.briefing = true;
    this.refresh();
  }

  closeBriefing() {
    this.briefing = false;
    this.setFocus(undefined);
    // the briefing already covered what the start hint says
    this.shownHints.add('start');
    app.markBriefingSeen(this.def.id);
  }

  detach() {
    this.view = null;
    if (this.toastTimer) clearTimeout(this.toastTimer);
    if (this.replayTimer) clearTimeout(this.replayTimer);
    if (this.victoryTimer) clearTimeout(this.victoryTimer);
  }

  /** Recompute previews and push the overlay to the renderer. */
  refresh() {
    this.canUndo = this.core.canUndo;
    this.view?.setOverlay(this.buildOverlay());
  }

  // ---------------------------------------------------------------------------
  // hints & toasts

  triggerHint(when: string) {
    if (!app.settings.showHints) return;
    const h = this.def.hints?.find((x) => x.when === when);
    if (!h || this.shownHints.has(when)) return;
    this.shownHints.add(when);
    this.hint = h.text;
    this.hintWhen = when;
  }

  dismissHint() {
    this.hint = null;
  }

  say(text: string, kind: 'error' | 'info' = 'error') {
    this.toast = { text, kind, id: Date.now() };
    if (kind === 'error') audio.play('error');
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => (this.toast = null), 2600);
  }

  // ---------------------------------------------------------------------------
  // tools

  toolCount(t: Tool): number | null {
    const item = TOOL_ITEM[t];
    return item ? this.state.inventory[item] : null;
  }

  availableTools(): Tool[] {
    const s = this.core.initialState();
    const out: Tool[] = [];
    if (s.inventory.trap > 0) out.push('trap');
    if (s.traps.some((t) => t.rotatable) || s.inventory.trap > 0) out.push('rotate');
    if (s.inventory.kibble > 0) out.push('kibble');
    if (s.inventory.tuna > 0) out.push('tuna');
    if (s.inventory.box > 0) out.push('box');
    if (s.inventory.toy > 0) out.push('toy');
    if (s.gates.length > 0 || s.noises.some((n) => n.interactive)) out.push('hand');
    return out;
  }

  toolDisabledReason(t: Tool): string | null {
    if (this.state.status !== 'playing' || this.replaying) return 'Уровень завершён';
    const item = TOOL_ITEM[t];
    if (item && this.state.inventory[item] <= 0) return `${ITEM_NAMES[item]}: закончились`;
    if (t === 'rotate' && !this.state.traps.some((tr) => tr.rotatable && !tr.occupiedBy)) return 'Нет ловушек, которые можно повернуть';
    return null;
  }

  selectTool(t: Tool | null) {
    if (this.briefing || this.replaying || this.state.status !== 'playing') return;
    audio.unlock();
    if (t && this.toolDisabledReason(t)) {
      this.say(this.toolDisabledReason(t)!);
      return;
    }
    this.tool = this.tool === t ? null : t;
    this.pendingTrap = null;
    this.pendingRotate = null;
    if (this.tool) {
      audio.play('click');
      this.triggerHint(`tool:${this.tool}`);
    }
    this.hoverText = null;
    this.refresh();
  }

  cancel() {
    if (this.pendingTrap || this.pendingRotate) {
      this.pendingTrap = null;
      this.pendingRotate = null;
    } else if (this.tool) {
      this.tool = null;
    } else {
      this.selection = null;
    }
    this.hoverText = null;
    this.refresh();
  }

  /** The action the current tool would perform on `cell` (for preview & tap). */
  private actionFor(cell: Cell): { action: Action | null; reason?: string; info?: string } {
    const s = this.state;
    switch (this.tool) {
      case 'trap': {
        if (this.pendingTrap) {
          if (eq(cell, this.pendingTrap)) {
            return { action: null, info: 'Выберите клетку со стрелкой — там будет вход' };
          }
          const dir = (['N', 'E', 'S', 'W'] as Dir[]).find((d) => eq(add(this.pendingTrap!, d), cell));
          if (dir) {
            const a: Action = { type: 'placeTrap', cell: this.pendingTrap, dir };
            const v = validateAction(s, a);
            return v.ok ? { action: a, info: 'Вход будет с этой стороны' } : { action: null, reason: v.reason };
          }
        }
        const dirs = validTrapDirs(s, cell);
        if (dirs.length === 0) {
          const v = validateAction(s, { type: 'placeTrap', cell, dir: 'E' });
          return { action: null, reason: v.ok ? 'Здесь ловушка не встанет' : v.reason };
        }
        return { action: null, info: 'Нажмите, чтобы поставить сюда приманку, затем выберите вход' };
      }
      case 'rotate': {
        if (this.pendingRotate) {
          const t = s.traps.find((x) => x.id === this.pendingRotate)!;
          const dir = (['N', 'E', 'S', 'W'] as Dir[]).find((d) => eq(add(t.back, d), cell));
          if (dir && dir !== t.dir) {
            const a: Action = { type: 'rotateTrap', trapId: t.id, dir };
            const v = validateAction(s, a);
            return v.ok ? { action: a, info: 'Развернуть вход сюда' } : { action: null, reason: v.reason };
          }
          const hitSelf = trapAt(s, cell);
          if (hitSelf && hitSelf.trap.id === t.id) return { action: null, info: 'Выберите клетку со стрелкой — туда повернётся вход' };
        }
        const hit = trapAt(s, cell);
        if (!hit) return { action: null, reason: 'Выберите ловушку' };
        if (!hit.trap.rotatable) return { action: null, reason: 'Эта ловушка закреплена' };
        if (validRotateDirs(s, hit.trap.id).length === 0) return { action: null, reason: 'Развернуть некуда' };
        return { action: null, info: 'Нажмите на ловушку, затем — куда развернуть вход' };
      }
      case 'kibble':
      case 'tuna': {
        const a: Action = { type: 'placeFood', kind: this.tool as FoodKind, cell };
        const v = validateAction(s, a);
        if (!v.ok) return { action: null, reason: v.reason };
        const spot = trapAt(s, cell)?.trap.back ?? cell;
        const proud = s.cats.find((c) => c.mode !== 'trapped' && c.minNotice > 0 && manhattan(c.pos, spot) < c.minNotice);
        if (proud) return { action: a, info: `Слишком близко: ${proud.name} не берёт подачки — он заметит еду только издалека` };
        const free = s.cats.filter((c) => c.mode !== 'trapped' && c.hunger > 0);
        const snobs = free.filter((c) => c.picky && c.preferredFood !== this.tool);
        if (free.length > 0 && snobs.length === free.length)
          return { action: a, info: `${snobs.map((c) => c.name).join(' и ')} такое не ест — только ${FOOD_NAMES[snobs[0].preferredFood!]}` };
        return { action: a, info: trapAt(s, cell) ? 'Положить приманку в ловушку' : 'Положить на землю' };
      }
      case 'box': {
        const a: Action = { type: 'placeBox', cell };
        const v = validateAction(s, a);
        return v.ok ? { action: a, info: 'Коробка даст тень этой и соседним клеткам' } : { action: null, reason: v.reason };
      }
      case 'toy': {
        const a: Action = { type: 'placeToy', cell };
        const v = validateAction(s, a);
        return v.ok ? { action: a, info: 'Игрушка будет работать 5 ходов' } : { action: null, reason: v.reason };
      }
      case 'hand': {
        const obj = this.interactiveAt(cell);
        if (!obj) return { action: null, reason: 'Здесь не с чем взаимодействовать' };
        const a: Action = { type: 'interact', objectId: obj };
        const v = validateAction(s, a);
        return v.ok ? { action: a, info: this.interactLabel(obj) } : { action: null, reason: v.reason };
      }
      default:
        return { action: null };
    }
  }

  interactiveAt(cell: Cell): string | null {
    const g = this.state.gates.find((x) => eq(x.cell, cell));
    if (g) return g.id;
    const n = this.state.noises.find((x) => eq(x.cell, cell) && x.interactive);
    return n ? n.id : null;
  }

  interactLabel(id: string): string {
    const g = this.state.gates.find((x) => x.id === id);
    const w = gateWords(this.def.location);
    if (g) return g.open ? `Закрыть ${w.acc}` : g.autoClose ? `Открыть ${w.acc} (${w.slams} через ${turnsWord(g.autoClose)})` : `Открыть ${w.acc}`;
    const n = this.state.noises.find((x) => x.id === id);
    return `${NOISE_ACTION[n?.kind ?? ''] ?? 'Включить'} · ${NOISE_SOUND[n?.kind ?? ''] ?? 'шумит'} ${turnsWord(n?.manualDuration ?? 2)}`;
  }

  // ---------------------------------------------------------------------------
  // pointer input from the board

  onHover(cell: Cell | null) {
    this.hover = cell;
    if (cell && this.tool) {
      const r = this.actionFor(cell);
      this.hoverText = r.reason ?? r.info ?? null;
    } else this.hoverText = null;
    this.refresh();
  }

  onTap(cell: Cell, catId: string | null) {
    if (this.loading || this.briefing || this.replaying) return;
    audio.unlock();
    if (this.state.status !== 'playing') return;
    const s = this.state;

    if (!this.tool) {
      this.selectAt(cell, catId);
      return;
    }

    if (this.tool === 'trap' && !(this.pendingTrap && (eq(cell, this.pendingTrap) || manhattan(cell, this.pendingTrap) === 1))) {
      const dirs = validTrapDirs(s, cell);
      if (dirs.length === 0) {
        const r = this.actionFor(cell);
        this.say(r.reason ?? 'Здесь ловушка не встанет');
        return;
      }
      this.pendingTrap = cell;
      audio.play('click');
      this.refresh();
      return;
    }
    if (this.tool === 'rotate' && !this.pendingRotate) {
      const hit = trapAt(s, cell);
      if (!hit || !hit.trap.rotatable || validRotateDirs(s, hit.trap.id).length === 0) {
        this.say(this.actionFor(cell).reason ?? 'Выберите ловушку');
        return;
      }
      this.pendingRotate = hit.trap.id;
      audio.play('click');
      this.refresh();
      return;
    }
    if (this.tool === 'rotate' && this.pendingRotate) {
      const hit = trapAt(s, cell);
      if (hit && hit.trap.id !== this.pendingRotate && hit.trap.rotatable) {
        this.pendingRotate = hit.trap.id;
        this.refresh();
        return;
      }
    }

    const r = this.actionFor(cell);
    if (!r.action) {
      if (r.reason) this.say(r.reason);
      return;
    }
    this.act(r.action);
  }

  private selectAt(cell: Cell, catId: string | null) {
    const s = this.state;
    let sel: Selection | null = null;
    if (catId) sel = { kind: 'cat', id: catId };
    else {
      const cat = s.cats.find((c) => eq(c.pos, cell) && c.mode !== 'trapped');
      const hit = trapAt(s, cell);
      const gate = s.gates.find((g) => eq(g.cell, cell));
      const noise = s.noises.find((n) => eq(n.cell, cell));
      const food = s.foods.find((f) => eq(f.cell, cell));
      const toy = s.toys.find((t) => eq(t.cell, cell));
      if (cat) sel = { kind: 'cat', id: cat.id };
      else if (hit) sel = { kind: 'trap', id: hit.trap.id };
      else if (gate) sel = { kind: 'gate', id: gate.id };
      else if (noise) sel = { kind: 'noise', id: noise.id };
      else if (food) sel = { kind: 'food', id: food.id };
      else if (toy) sel = { kind: 'toy', id: toy.id };
    }
    if (sel && this.selection && sel.kind === this.selection.kind && sel.id === this.selection.id) sel = null;
    this.selection = sel;
    if (sel) audio.play('click');
    if (sel?.kind === 'cat') audio.play('meow');
    this.refresh();
  }

  /** Context action from an info card (e.g. "open gate"). */
  quickAction(a: Action) {
    this.act(a);
  }

  startRotate(trapId: string) {
    if (this.loading || this.replaying || this.state.status !== 'playing') return;
    this.tool = 'rotate';
    this.pendingRotate = trapId;
    this.triggerHint('tool:rotate');
    this.refresh();
  }

  // ---------------------------------------------------------------------------
  // turn flow

  act(action: Action) {
    if (this.loading || this.briefing || this.replaying || this.state.status !== 'playing') return;
    const out = this.core.act(action);
    if (!out.ok) {
      this.say(out.reason);
      return;
    }
    // tool-specific hints are done once the tool has been used
    if (this.hintWhen?.startsWith('tool:') && action.type !== 'wait') this.hint = null;
    if (action.type !== 'wait') {
      this.tool = null;
      this.pendingTrap = null;
      this.pendingRotate = null;
      this.hoverText = null;
    }
    this.afterTurn(out.prev, out.state, out.events, action);
  }

  private afterTurn(prev: GameState, next: GameState, events: GameEvent[], action: Action) {
    this.state = next;
    this.plainIntents = this.core.preview();
    this.view?.applyTurn(prev, next, events);
    if (this.selection?.kind === 'food' && !next.foods.some((f) => f.id === this.selection!.id)) this.selection = null;
    if (this.selection?.kind === 'toy' && !next.toys.some((f) => f.id === this.selection!.id)) this.selection = null;

    // hints
    if (action.type === 'placeFood') this.triggerHint(`placed:${action.kind}`);
    if (action.type === 'placeTrap') this.triggerHint('placed:trap');
    if (action.type === 'placeToy') this.triggerHint('placed:toy');
    if (action.type === 'placeBox') this.triggerHint('placed:box');
    this.triggerHint(`turn:${next.turn}`);
    if (events.some((e) => e.type === 'gateToggled' && !e.open) && action.type !== 'interact' && next.status === 'playing') this.triggerHint('gateClosed');

    if (next.status === 'won' && !this.replaying) {
      const res = this.core.result()!;
      this.result = res;
      app.recordWin(this.def.id, res, this.def.cats.map((c) => c.id));
      this.hint = null;
      const delay = 1500 / app.settings.animSpeed + 300;
      this.victoryTimer = window.setTimeout(() => (this.showVictory = true), delay);
    }
    this.progress = this.replaying ? null : this.core.progressHint();
    this.refresh();
  }

  skip() {
    audio.unlock();
    this.act({ type: 'wait' });
  }

  undo() {
    if (this.loading || this.briefing || this.replaying || !this.core.canUndo) return;
    const s = this.core.undo();
    if (!s) return;
    audio.play('undo');
    this.state = s;
    this.plainIntents = this.core.preview();
    this.result = null;
    this.showVictory = false;
    if (this.victoryTimer) clearTimeout(this.victoryTimer);
    this.progress = this.core.progressHint();
    this.tool = null;
    this.pendingTrap = null;
    this.pendingRotate = null;
    if (this.selection && this.selection.kind !== 'cat') this.selection = null;
    this.view?.sync(s);
    this.refresh();
  }

  restart() {
    if (this.loading) return;
    this.stopReplay();
    const s = this.core.restart();
    audio.play('undo');
    this.state = s;
    this.plainIntents = this.core.preview();
    this.result = null;
    this.showVictory = false;
    if (this.victoryTimer) clearTimeout(this.victoryTimer);
    this.progress = null;
    this.tool = null;
    this.selection = null;
    this.pendingTrap = null;
    this.pendingRotate = null;
    this.view?.sync(s);
    this.refresh();
  }

  /** Watch the winning sequence again with animations. */
  startReplay() {
    const actions = [...this.core.actions];
    if (actions.length === 0) return;
    this.showVictory = false;
    this.core.restart();
    this.state = this.core.state;
    this.view?.sync(this.state);
    this.replaying = true;
    this.tool = null;
    this.selection = null;
    this.replayQueue = actions;
    this.replayIndex = 0;
    const stepMs = () => 820 / app.settings.animSpeed;
    const tick = () => {
      if (!this.replaying) return;
      if (this.replayIndex >= this.replayQueue.length) {
        this.replaying = false;
        this.result = this.core.result();
        this.victoryTimer = window.setTimeout(() => (this.showVictory = true), 900);
        this.refresh();
        return;
      }
      const a = this.replayQueue[this.replayIndex++];
      const out = this.core.act(a);
      if (out.ok) this.afterTurn(out.prev, out.state, out.events, a);
      this.replayTimer = window.setTimeout(tick, stepMs());
    };
    this.refresh();
    this.replayTimer = window.setTimeout(tick, 500);
  }

  stopReplay() {
    if (!this.replaying) return;
    this.replaying = false;
    if (this.replayTimer) clearTimeout(this.replayTimer);
    // jump straight to the end of the recorded run
    while (this.replayIndex < this.replayQueue.length) this.core.act(this.replayQueue[this.replayIndex++]);
    this.state = this.core.state;
    this.plainIntents = this.core.preview();
    this.view?.sync(this.state);
    this.result = this.core.result();
    if (this.result) this.showVictory = true;
    this.refresh();
  }

  // ---------------------------------------------------------------------------
  // overlay

  private hypothetical(): Action | null {
    if (!this.hover || !this.tool) return null;
    return this.actionFor(this.hover).action;
  }

  private buildOverlay(): Overlay {
    if (!this.state || this.replaying) return { ...EMPTY_OVERLAY, paths: this.replaying ? [] : EMPTY_OVERLAY.paths };
    const s = this.state;
    const o: Overlay = { ...EMPTY_OVERLAY, validCells: [], ghosts: [], paths: [], zones: [], selectedCells: [] };
    if (s.status !== 'playing') return o;
    const hyp = this.hypothetical();

    // valid targets for the current tool
    const cells: Cell[] = [];
    for (let y = 0; y < s.height; y++) for (let x = 0; x < s.width; x++) cells.push({ x, y });
    switch (this.tool) {
      case 'trap':
        if (this.pendingTrap) {
          const dirs = validTrapDirs(s, this.pendingTrap);
          o.selectedCells = [this.pendingTrap];
          o.validCells = dirs.map((d) => add(this.pendingTrap!, d));
          const hd = this.hover ? dirs.find((d) => eq(add(this.pendingTrap!, d), this.hover)) : undefined;
          for (const d of dirs) o.ghosts.push({ kind: 'trap', back: this.pendingTrap, dir: d, ok: true, highlighted: d === hd || (!hd && d === dirs[0]) });
        } else {
          o.validCells = cells.filter((c) => validTrapDirs(s, c).length > 0);
          if (this.hover) {
            const dirs = validTrapDirs(s, this.hover);
            if (dirs.length) o.ghosts.push({ kind: 'trap', back: this.hover, dir: dirs[0], ok: true, highlighted: true });
          }
        }
        break;
      case 'rotate':
        if (this.pendingRotate) {
          const t = s.traps.find((x) => x.id === this.pendingRotate)!;
          const dirs = validRotateDirs(s, t.id);
          o.selectedCells = [t.back, add(t.back, t.dir)];
          o.validCells = dirs.map((d) => add(t.back, d));
          const hd = this.hover ? dirs.find((d) => eq(add(t.back, d), this.hover)) : undefined;
          for (const d of dirs) o.ghosts.push({ kind: 'trap', back: t.back, dir: d, ok: true, highlighted: d === hd });
        } else {
          for (const t of s.traps) if (t.rotatable && validRotateDirs(s, t.id).length) o.validCells.push(t.back, add(t.back, t.dir));
        }
        break;
      case 'kibble':
      case 'tuna':
      case 'box':
      case 'toy': {
        const make = (c: Cell): Action =>
          this.tool === 'box' ? { type: 'placeBox', cell: c } : this.tool === 'toy' ? { type: 'placeToy', cell: c } : { type: 'placeFood', kind: this.tool as FoodKind, cell: c };
        o.validCells = cells.filter((c) => validateAction(s, make(c)).ok);
        if (this.hover && inBounds(this.hover, s.width, s.height)) {
          const ok = validateAction(s, make(this.hover)).ok;
          const hit = trapAt(s, this.hover);
          const cell = hit && (this.tool === 'kibble' || this.tool === 'tuna') ? hit.trap.back : this.hover;
          if (!(hit && (this.tool === 'kibble' || this.tool === 'tuna'))) o.ghosts.push({ kind: this.tool, cell, ok } as Ghost);
          else if (ok) o.selectedCells = [hit.trap.back, add(hit.trap.back, hit.trap.dir)];
        }
        if (this.tool === 'box') {
          o.emphasizeShade = true;
          if (this.hover && validateAction(s, { type: 'placeBox', cell: this.hover }).ok) {
            const h = this.hover;
            const plus = [h, ...(['N', 'E', 'S', 'W'] as Dir[]).map((d) => add(h, d))].filter((c) => inBounds(c, s.width, s.height));
            o.zones.push({ cells: plus, color: 0x3d6b4c, alpha: 0.22 });
          }
        }
        break;
      }
      case 'hand':
        o.validCells = [...s.gates.map((g) => g.cell), ...s.noises.filter((n) => n.interactive).map((n) => n.cell)];
        break;
    }
    if (this.hover && this.tool) {
      const r = this.actionFor(this.hover);
      const neutral = (this.tool === 'trap' && !this.pendingTrap) || (this.tool === 'rotate' && !this.pendingRotate);
      o.hover = { cell: this.hover, ok: !!r.action || (neutral && !r.reason) };
    }

    // Sasha pointing at things during her briefing
    if (this.focusCells.length) {
      o.zones.push({ cells: this.focusCells, color: 0xf2a65a, alpha: 0.32 });
      o.selectedCells = [...o.selectedCells, ...this.focusCells];
    }
    if (this.focusCat) {
      o.selectedCatId = this.focusCat;
      o.focusCatId = this.focusCat;
    }

    // selection
    const sel = this.selection;
    if (sel?.kind === 'cat' && !this.briefing) {
      o.selectedCatId = sel.id;
      const cat = s.cats.find((c) => c.id === sel.id);
      if (cat && cat.mode !== 'trapped') o.zones.push(...this.senseZones(cat.id));
    } else if (sel?.kind === 'trap') {
      const t = s.traps.find((x) => x.id === sel.id);
      if (t) o.selectedCells = [t.back, add(t.back, t.dir)];
    } else if (sel) {
      const obj =
        sel.kind === 'gate' ? s.gates.find((x) => x.id === sel.id) : sel.kind === 'noise' ? s.noises.find((x) => x.id === sel.id) : sel.kind === 'food' ? s.foods.find((x) => x.id === sel.id) : s.toys.find((x) => x.id === sel.id);
      if (obj) o.selectedCells = [obj.cell];
      if (sel.kind === 'noise' && obj) {
        const n = s.noises.find((x) => x.id === sel.id)!;
        o.zones.push({ cells: cells.filter((c) => manhattan(c, n.cell) <= n.radius), color: 0xff8a5c, alpha: 0.22 });
      }
    }
    // food / toy tool: scent zones of cats around the hovered spot
    if ((this.tool === 'kibble' || this.tool === 'tuna' || this.tool === 'toy') && !sel) {
      const free = s.cats.filter((c) => c.mode !== 'trapped');
      if (free.length === 1) o.zones.push(...this.senseZones(free[0].id, this.tool));
    }

    // cat intent paths
    if (app.settings.showPaths) {
      const plain = this.plainIntents;
      const after = hyp ? this.core.preview(hyp) : null;
      for (const it of after ?? plain) {
        const cat = s.cats.find((c) => c.id === it.catId);
        if (!cat || cat.mode === 'trapped') continue;
        const before = plain.find((p) => p.catId === it.catId);
        const changed = !!after && (before?.target?.id !== it.target?.id || before?.target?.kind !== it.target?.kind || !eq(before?.target?.cell, it.target?.cell));
        if (it.path.length === 0 && !changed) continue;
        // keep the board calm: idle wandering is drawn short, purposeful routes in full
        const purposeful = it.target && (it.target.kind === 'food' || it.target.kind === 'toy' || it.target.kind === 'hide' || it.target.kind === 'flee');
        const cellsShown = purposeful || changed ? it.path : it.path.slice(0, 2);
        const p: PathPreview = { catId: it.catId, cells: cellsShown, target: purposeful ? (it.target?.cell ?? null) : null, kind: it.target?.kind ?? null, color: this.catColor(it.catId), hypothetical: changed };
        o.paths.push(p);
      }
    }
    return o;
  }

  /** Cells from which a cat would notice food / toys. */
  senseZones(catId: string, tool?: Tool | null): Zone[] {
    const s = this.state;
    const cat = s.cats.find((c) => c.id === catId);
    if (!cat) return [];
    const cells: Cell[] = [];
    for (let y = 0; y < s.height; y++) for (let x = 0; x < s.width; x++) cells.push({ x, y });
    const zones: Zone[] = [];
    const t = tool ?? null;
    if (t === 'toy' || (!t && cat.curiosity > 0 && cat.hunger === 0)) {
      const r = toyNoticeRadius(cat);
      if (r > 0) zones.push({ cells: cells.filter((c) => manhattan(c, cat.pos) <= r), color: 0xf48fb1, alpha: 0.16 });
      return zones;
    }
    const kind: FoodKind = t === 'tuna' ? 'tuna' : cat.picky && !t && cat.preferredFood ? cat.preferredFood : 'kibble';
    // a picky eater does not care about this kind of food at all
    if (cat.picky && cat.preferredFood !== kind) return zones;
    const r = foodNoticeRadius(cat, kind);
    // an independent cat notices food only in a ring: not too close, not too far
    if (r > 0) zones.push({ cells: cells.filter((c) => manhattan(c, cat.pos) <= r && manhattan(c, cat.pos) >= cat.minNotice), color: this.catColor(cat.id), alpha: 0.2 });
    return zones;
  }
}
