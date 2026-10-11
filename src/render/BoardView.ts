// BoardView — owns the Phaser.Game instance and exposes a small, UI-friendly
// API. Svelte components talk only to this class.

import Phaser from 'phaser';
import type { LevelDef } from '../core/level';
import type { Cell, GameEvent, GameState } from '../core/types';
import { BoardScene } from './BoardScene';
import type { BoardCallbacks, Insets, Overlay, RenderSettings } from './types';

export class BoardView {
  private game: Phaser.Game;
  private scene: BoardScene | null = null;
  private readyP: Promise<BoardScene>;
  private ro: ResizeObserver;
  private dpr: number;
  private destroyed = false;

  constructor(
    private parent: HTMLElement,
    cb: BoardCallbacks,
    settings: RenderSettings,
  ) {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const w = Math.max(1, parent.clientWidth);
    const h = Math.max(1, parent.clientHeight);
    const scene = new BoardScene();
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent,
      transparent: true,
      width: w * this.dpr,
      height: h * this.dpr,
      antialias: true,
      banner: false,
      disableContextMenu: true,
      scale: { mode: Phaser.Scale.NONE, zoom: 1 / this.dpr },
      input: { activePointers: 3, touch: { capture: true } },
      render: { powerPreference: 'high-performance', antialiasGL: true },
      scene: [],
      audio: { noAudio: true },
    });
    this.readyP = new Promise((resolve) => {
      this.game.events.once(Phaser.Core.Events.READY, () => {
        this.game.scene.add('board', scene, true, { cb, dpr: this.dpr, settings });
        const check = () => {
          if (scene.sys?.settings?.active) {
            this.scene = scene;
            resolve(scene);
          } else requestAnimationFrame(check);
        };
        check();
      });
    });
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(parent);
    if (import.meta.env.DEV) (window as unknown as { __board: BoardView }).__board = this;
  }

  /** for debugging in dev tools */
  get debugScene(): BoardScene | null {
    return this.scene;
  }

  get debugGame(): Phaser.Game {
    return this.game;
  }

  private resize() {
    if (this.destroyed) return;
    const w = Math.max(1, this.parent.clientWidth);
    const h = Math.max(1, this.parent.clientHeight);
    this.game.scale.resize(w * this.dpr, h * this.dpr);
    this.game.scale.setZoom(1 / this.dpr);
    this.scene?.fitCamera();
  }

  async loadLevel(def: LevelDef, state: GameState): Promise<void> {
    const s = await this.readyP;
    if (this.destroyed) return;
    this.resize();
    await s.loadLevel(def, state);
  }

  applyTurn(prev: GameState, next: GameState, events: GameEvent[]) {
    this.scene?.applyTurn(prev, next, events);
  }

  sync(state: GameState) {
    this.scene?.sync(state);
  }

  setOverlay(o: Overlay) {
    this.scene?.setOverlay(o);
  }

  setSettings(s: RenderSettings) {
    this.scene?.setSettings(s);
  }

  setInsets(i: Insets) {
    this.readyP.then((s) => s.setInsets(i));
  }

  zoomBy(f: number) {
    this.scene?.zoomBy(f);
  }

  resetView() {
    this.scene?.resetView();
  }

  get zoomLevel(): number {
    return this.scene?.zoomLevel ?? 1;
  }

  cellToScreen(c: Cell, z = 0): { x: number; y: number } | null {
    return this.scene ? this.scene.cellToScreen(c, z) : null;
  }

  destroy() {
    this.destroyed = true;
    this.ro.disconnect();
    this.game.destroy(true);
  }
}
