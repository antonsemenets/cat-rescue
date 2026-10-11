// GameRenderer — a Phaser scene that visualises GameState snapshots.
// It never changes the simulation: it receives (prev, next, events) and
// animates the difference, and can snap to any state instantly.

import Phaser from 'phaser';
import { catSvg, CAT_POSES, type CatPose } from '../art/cats';
import { hexToNum, lighten } from '../art/color';
import * as Props from '../art/props';
import { DIRS, add, eq, key } from '../core/grid';
import type { LevelDef } from '../core/level';
import type { Cat, Cell, Feature, GameEvent, GameState, Gate, Noise, Trap } from '../core/types';
import { computeCover, computeDanger, turnsUntilNoise } from '../core/world';
import {
  PAL,
  drawBoxBack,
  drawBoxFront,
  drawCrate,
  drawDen,
  drawFence,
  drawGate,
  drawGroundTile,
  drawPathStones,
  drawShed,
  drawSlab,
  drawTrapBack,
  drawTrapFront,
  drawWall,
  drawWater,
  fillCell,
  strokeCell,
  trapGeom,
} from './drawIso';
import { boardBounds, cellCenter, depthOf, gp, worldToGrid } from './iso';
import { ensureTextures, type SvgTexture } from './textures';
import { EMPTY_OVERLAY, type BoardCallbacks, type Ghost, type Insets, type Overlay, type RenderSettings } from './types';

const CAT_SIZE = 100;
const FX_DEPTH = 100000;

type EmoteIcon = Props.EmoteIcon;

interface CatView {
  id: string;
  c: Phaser.GameObjects.Container;
  shadow: Phaser.GameObjects.Ellipse;
  ring: Phaser.GameObjects.Graphics;
  sprite: Phaser.GameObjects.Image;
  status: Phaser.GameObjects.Image;
  statusKind: EmoteIcon | null;
  pose: CatPose;
  left: boolean;
  moving: boolean;
  phase: number;
  baseScale: number;
  cell: Cell;
  zTimer: number;
}

interface TrapView {
  id: string;
  back: Phaser.GameObjects.Graphics;
  front: Phaser.GameObjects.Graphics;
  bait: Phaser.GameObjects.Image | null;
  baitKind: string | null;
  dir: Trap['dir'];
  closed: number;
  occupied: boolean;
  backCell: Cell;
}

interface ItemView {
  id: string;
  obj: Phaser.GameObjects.Image;
  extra: Phaser.GameObjects.GameObject[];
  cell: Cell;
  dying: boolean;
}

interface BoxView {
  id: string;
  back: Phaser.GameObjects.Graphics;
  front: Phaser.GameObjects.Graphics;
  cell: Cell;
}

interface GateView {
  id: string;
  g: Phaser.GameObjects.Graphics;
  axis: 'x' | 'y';
  openT: number;
  cell: Cell;
}

interface NoiseView {
  id: string;
  img: Phaser.GameObjects.Image;
  waves: Phaser.GameObjects.Graphics;
  badge: Phaser.GameObjects.Container;
  badgeText: Phaser.GameObjects.Text;
  active: boolean;
  cell: Cell;
}

interface TallView {
  obj: Phaser.GameObjects.Image | Phaser.GameObjects.Graphics;
  cell: Cell;
}

function hash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) ^ 0x5bd1e995;
  h = (h ^ (h >>> 13)) * 1274126177;
  return (h ^ (h >>> 16)) >>> 0;
}

export function restPose(cat: Cat): CatPose {
  switch (cat.activity) {
    case 'trapped':
      return 'sleep';
    case 'hide':
      return 'hide';
    case 'sleep':
      return 'sleep';
    case 'groom':
      return 'groom';
    case 'eat':
      return 'eat';
    case 'play':
      return 'play';
    case 'scared':
      return 'scared';
    case 'hesitate':
      return 'curious';
    case 'walk':
      return cat.mode === 'frightened' ? 'scared' : 'stand';
    default:
      return cat.mode === 'frightened' ? 'scared' : 'sit';
  }
}

function statusFor(cat: Cat): EmoteIcon | null {
  if (cat.mode === 'trapped') return null;
  if (cat.mode === 'cautious') return 'question';
  if (cat.mode === 'frightened') return 'alert';
  if (cat.mode === 'interested') return cat.target?.kind === 'toy' ? 'toy' : cat.target?.kind === 'food' ? 'food' : null;
  return null;
}

export class BoardScene extends Phaser.Scene {
  private def!: LevelDef;
  private state!: GameState;
  private cb!: BoardCallbacks;
  private settings: RenderSettings = { animSpeed: 1, reducedMotion: false };
  private overlay: Overlay = EMPTY_OVERLAY;
  private insets: Insets = { top: 0, right: 0, bottom: 0, left: 0 };
  private texScale = 2;
  private dpr = 1;
  private ready = false;

  private groundG!: Phaser.GameObjects.Graphics;
  private dangerG!: Phaser.GameObjects.Graphics;
  private overlayG!: Phaser.GameObjects.Graphics;
  private pathG!: Phaser.GameObjects.Graphics;
  private ghostG!: Phaser.GameObjects.Graphics;
  private ghostImgs: Phaser.GameObjects.Image[] = [];
  private shadeImgs: Phaser.GameObjects.Image[] = [];
  private staticObjs: Phaser.GameObjects.GameObject[] = [];
  private tall: TallView[] = [];

  private cats = new Map<string, CatView>();
  private traps = new Map<string, TrapView>();
  private foods = new Map<string, ItemView>();
  private toys = new Map<string, ItemView>();
  private boxes = new Map<string, BoxView>();
  private gates = new Map<string, GateView>();
  private noises = new Map<string, NoiseView>();
  private transient = new Set<Phaser.GameObjects.GameObject>();

  // camera
  private fitZoom = 1;
  private userZoom = 1;
  private pan = { x: 0, y: 0 };
  private pointerDown: { x: number; y: number; t: number; moved: boolean } | null = null;
  private pinch: { dist: number; zoom: number } | null = null;
  private lastHover: string | null = null;

  constructor() {
    super({ key: 'board' });
  }

  // -------------------------------------------------------------------------
  // lifecycle

  init(data: { cb: BoardCallbacks; dpr: number; settings: RenderSettings }) {
    this.cb = data.cb;
    this.dpr = data.dpr;
    this.settings = data.settings;
    this.texScale = Math.max(2, Math.min(3, Math.round(this.dpr * 1.5)));
  }

  create() {
    this.input.mouse?.disableContextMenu();
    this.input.addPointer(2);
    this.input.on('pointerdown', this.onPointerDown, this);
    this.input.on('pointermove', this.onPointerMove, this);
    this.input.on('pointerup', this.onPointerUp, this);
    this.input.on('pointerupoutside', this.onPointerUp, this);
    this.input.on('gameout', () => {
      this.lastHover = null;
      this.cb?.onHover(null);
    });
    this.input.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      this.zoomAt(dy > 0 ? 1 / 1.12 : 1.12, p.x, p.y);
    });
    this.scale.on('resize', () => this.fitCamera());
    this.events.emit('scene-ready');
  }

  async loadLevel(def: LevelDef, state: GameState): Promise<void> {
    this.ready = false;
    this.clearAll();
    this.def = def;
    this.state = state;
    await this.buildTextures(def);
    this.buildStatic();
    this.syncTo(state);
    this.userZoom = 1;
    this.pan = { x: 0, y: 0 };
    this.fitCamera();
    this.ready = true;
  }

  setSettings(s: RenderSettings) {
    this.settings = s;
  }

  setInsets(i: Insets) {
    this.insets = i;
    this.fitCamera();
  }

  private speed(): number {
    return this.settings.animSpeed;
  }

  private dur(ms: number): number {
    const d = ms / this.speed();
    return this.settings.reducedMotion ? Math.min(d, 140) : d;
  }

  // -------------------------------------------------------------------------
  // textures

  private async buildTextures(def: LevelDef) {
    const list: SvgTexture[] = [];
    for (const cat of def.cats) {
      for (const pose of CAT_POSES) list.push({ key: `cat:${cat.id}:${pose}`, svg: catSvg(cat.look, pose, { uid: `t${cat.id}${pose}` }), w: 128, h: 128 });
    }
    const add = (key: string, svg: string, w: number, h: number) => list.push({ key, svg, w, h });
    [0, 1, 2].forEach((v) => add(`bush${v}`, Props.bushSvg(v), 128, 112));
    add('bushFront', Props.bushFrontSvg(), 128, 112);
    add('tree0', Props.treeSvg(0), 128, 184);
    add('tree1', Props.treeSvg(1), 128, 184);
    add('rock', Props.rockSvg(), 96, 72);
    add('kibble', Props.kibbleSvg(), 64, 44);
    add('tuna', Props.tunaSvg(), 64, 48);
    add('toy', Props.toySvg(), 64, 84);
    add('mower', Props.mowerSvg(), 104, 84);
    add('radio', Props.radioSvg(), 88, 96);
    add('chimes', Props.chimesSvg(), 72, 100);
    for (const k of ['food', 'question', 'alert', 'heart', 'toy', 'sleep'] as const) add(`emote:${k}`, Props.emoteSvg(k), 60, 60);
    add('heart', Props.heartSvg(), 32, 32);
    add('sparkle', Props.sparkleSvg(), 24, 24);
    add('zzz', Props.zzzSvg(), 20, 20);
    add('scent', Props.scentSvg(), 24, 40);
    add('shade', Props.shadeSvg(), 120, 60);
    [0, 1, 2, 3].forEach((v) => add(`flower${v}`, Props.flowerSvg(v), 32, 24));
    add('tuft', Props.tuftSvg(), 24, 16);
    add('pebbles', Props.pebblesSvg(), 28, 14);
    await ensureTextures(this, list, this.texScale);
  }

  private img(x: number, y: number, key: string, svgW: number, displayW: number, ox = 0.5, oy = 0.5): Phaser.GameObjects.Image {
    const im = this.add.image(x, y, key).setOrigin(ox, oy);
    im.setScale(displayW / (svgW * this.texScale));
    return im;
  }

  // -------------------------------------------------------------------------
  // static board

  private clearAll() {
    this.tweens.killAll();
    this.time.removeAllEvents();
    for (const o of this.staticObjs) o.destroy();
    this.staticObjs = [];
    this.tall = [];
    for (const v of this.cats.values()) v.c.destroy();
    for (const v of this.traps.values()) this.destroyTrap(v);
    for (const v of this.foods.values()) this.destroyItem(v);
    for (const v of this.toys.values()) this.destroyItem(v);
    for (const v of this.boxes.values()) (v.back.destroy(), v.front.destroy());
    for (const v of this.gates.values()) v.g.destroy();
    for (const v of this.noises.values()) (v.img.destroy(), v.waves.destroy(), v.badge.destroy());
    for (const o of this.transient) o.destroy();
    for (const o of this.shadeImgs) o.destroy();
    for (const o of this.ghostImgs) o.destroy();
    this.shadeImgs = [];
    this.ghostImgs = [];
    this.cats.clear();
    this.traps.clear();
    this.foods.clear();
    this.toys.clear();
    this.boxes.clear();
    this.gates.clear();
    this.noises.clear();
    this.transient.clear();
    this.groundG?.destroy();
    this.dangerG?.destroy();
    this.overlayG?.destroy();
    this.pathG?.destroy();
    this.ghostG?.destroy();
  }

  private featureAt(x: number, y: number): Feature | null {
    const s = this.state;
    if (x < 0 || y < 0 || x >= s.width || y >= s.height) return null;
    return s.features[y * s.width + x];
  }

  private buildStatic() {
    const s = this.state;
    const g = this.add.graphics().setDepth(-10000);
    this.groundG = g;
    drawSlab(g, s.width, s.height);
    for (let y = 0; y < s.height; y++) {
      for (let x = 0; x < s.width; x++) {
        const t = s.terrain[y * s.width + x];
        const f = s.features[y * s.width + x];
        const h = hash(x, y);
        if (f === 'water') {
          drawWater(g, x, y);
          continue;
        }
        if (t === 'path') {
          drawGroundTile(g, x, y, PAL.path);
          drawPathStones(g, x, y, h);
        } else if (t === 'dirt') {
          drawGroundTile(g, x, y, PAL.dirt);
        } else {
          const base = PAL.grass[h % 3];
          drawGroundTile(g, x, y, (x + y) % 2 === 0 ? base : Phaser.Display.Color.ValueToColor(base).lighten(3).color);
        }
      }
    }
    // decorations (flat, on the ground layer)
    for (let y = 0; y < s.height; y++) {
      for (let x = 0; x < s.width; x++) {
        const t = s.terrain[y * s.width + x];
        const f = s.features[y * s.width + x];
        const h = hash(x, y);
        if (f && f !== 'bush' && f !== 'den') continue;
        const at = (ox: number, oy: number) => gp(x + ox, y + oy);
        if (t === 'flowers') {
          for (let i = 0; i < 3; i++) {
            const p = at(0.25 + ((h >> (i * 4)) & 7) / 14, 0.25 + ((h >> (i * 4 + 2)) & 7) / 14);
            this.staticObjs.push(this.img(p.x, p.y, `flower${(h + i) % 4}`, 32, 26, 0.5, 0.9).setDepth(-9990));
          }
        } else if (t === 'grass' && !f) {
          if (h % 3 === 0) {
            const p = at(0.3 + (h & 7) / 20, 0.35 + ((h >> 3) & 7) / 20);
            this.staticObjs.push(this.img(p.x, p.y, 'tuft', 24, 20, 0.5, 0.9).setDepth(-9990).setAlpha(0.9));
          }
          if (h % 11 === 0) {
            const p = at(0.6, 0.55);
            this.staticObjs.push(this.img(p.x, p.y, `flower${h % 4}`, 32, 22, 0.5, 0.9).setDepth(-9990));
          }
        } else if (t === 'dirt' && h % 2 === 0) {
          const p = at(0.5, 0.5);
          this.staticObjs.push(this.img(p.x, p.y, 'pebbles', 28, 24, 0.5, 0.5).setDepth(-9990));
        }
      }
    }
    // features
    for (let y = 0; y < s.height; y++) {
      for (let x = 0; x < s.width; x++) {
        const f = s.features[y * s.width + x];
        if (!f || f === 'water') continue;
        this.buildFeature(f, x, y);
      }
    }
    this.dangerG = this.add.graphics().setDepth(-9400);
    this.overlayG = this.add.graphics().setDepth(-9300);
    this.pathG = this.add.graphics().setDepth(-9200);
    this.ghostG = this.add.graphics().setDepth(FX_DEPTH - 10);
  }

  private connects(x: number, y: number): boolean {
    const f = this.featureAt(x, y);
    if (f === 'fence' || f === 'wall' || f === 'shed') return true;
    return this.state.gates.some((g) => g.cell.x === x && g.cell.y === y);
  }

  private buildFeature(f: Feature, x: number, y: number) {
    const c = cellCenter(x, y);
    const h = hash(x, y);
    const d = depthOf(x, y, 4);
    switch (f) {
      case 'wall':
      case 'shed':
      case 'crate':
      case 'den':
      case 'fence': {
        const g = this.add.graphics().setDepth(f === 'den' ? depthOf(x, y, 3) : d);
        if (f === 'wall') drawWall(g, x, y);
        else if (f === 'shed') drawShed(g, x, y);
        else if (f === 'crate') drawCrate(g, x, y);
        else if (f === 'den') drawDen(g, x, y);
        else drawFence(g, x, y, { n: this.connects(x, y - 1), e: this.connects(x + 1, y), s: this.connects(x, y + 1), w: this.connects(x - 1, y) });
        this.staticObjs.push(g);
        if (f === 'shed') this.tall.push({ obj: g, cell: { x, y } });
        break;
      }
      case 'tree': {
        const im = this.img(c.x, c.y + 6, `tree${h % 2}`, 128, 118, 0.5, 168 / 184).setDepth(d);
        this.staticObjs.push(im);
        this.tall.push({ obj: im, cell: { x, y } });
        break;
      }
      case 'rock':
        this.staticObjs.push(this.img(c.x, c.y + 6, 'rock', 96, 78, 0.5, 58 / 72).setDepth(d));
        break;
      case 'bush': {
        this.staticObjs.push(this.img(c.x, c.y + 8, `bush${h % 3}`, 128, 104, 0.5, 96 / 112).setDepth(depthOf(x, y, 3)));
        this.staticObjs.push(this.img(c.x, c.y + 8, 'bushFront', 128, 104, 0.5, 96 / 112).setDepth(depthOf(x, y, 7)));
        break;
      }
    }
  }

  // -------------------------------------------------------------------------
  // dynamic entities

  private makeCat(cat: Cat): CatView {
    const p = cellCenter(cat.pos.x, cat.pos.y);
    const shadow = this.add.ellipse(0, 0, 50, 18, 0x23331f, 0.2);
    const ring = this.add.graphics();
    ring.lineStyle(3, 0xffffff, 0.95);
    ring.strokeEllipse(0, 0, 70, 30);
    ring.lineStyle(2, 0xf2a65a, 0.9);
    ring.strokeEllipse(0, 0, 76, 34);
    ring.setVisible(false);
    const baseScale = CAT_SIZE / (128 * this.texScale);
    const sprite = this.add.image(0, 4, `cat:${cat.id}:sit`).setOrigin(0.5, 114 / 128).setScale(baseScale);
    const status = this.add.image(0, -CAT_SIZE * 0.78, 'emote:food').setScale(0.42 / this.texScale).setVisible(false);
    const c = this.add.container(p.x, p.y, [shadow, ring, sprite, status]);
    const v: CatView = {
      id: cat.id,
      c,
      shadow,
      ring,
      sprite,
      status,
      statusKind: null,
      pose: 'sit',
      left: hash(cat.pos.x, cat.pos.y) % 2 === 0,
      moving: false,
      phase: (hash(cat.pos.x * 3, cat.pos.y * 7) % 100) / 16,
      baseScale,
      cell: { ...cat.pos },
      zTimer: 0,
    };
    sprite.setFlipX(v.left);
    this.cats.set(cat.id, v);
    return v;
  }

  private setPose(v: CatView, pose: CatPose) {
    v.pose = pose;
    v.sprite.setTexture(`cat:${v.id}:${pose}`);
  }

  private setStatus(v: CatView, kind: EmoteIcon | null) {
    v.statusKind = kind;
    if (!kind) {
      v.status.setVisible(false);
      return;
    }
    v.status.setTexture(`emote:${kind}`).setVisible(true);
  }

  private catDepth(cell: Cell, inTrap: boolean, hiding: boolean): number {
    return depthOf(cell.x, cell.y, inTrap ? 5 : hiding ? 5 : 5);
  }

  private placeCat(v: CatView, cat: Cat) {
    const p = cellCenter(cat.pos.x, cat.pos.y);
    v.c.setPosition(p.x, p.y);
    v.cell = { ...cat.pos };
    v.c.setDepth(this.catDepth(cat.pos, cat.mode === 'trapped', cat.mode === 'hiding'));
    v.c.setVisible(true).setAlpha(1);
    v.sprite.setY(4).setAngle(0);
    const inTrap = cat.mode === 'trapped' || !!this.state.traps.find((t) => eq(t.back, cat.pos) || eq(add(t.back, t.dir), cat.pos));
    v.sprite.setScale(v.baseScale * (inTrap ? 0.82 : 1));
    v.shadow.setVisible(cat.mode !== 'hiding');
    this.setPose(v, restPose(cat));
    this.setStatus(v, statusFor(cat));
    v.moving = false;
  }

  private destroyTrap(v: TrapView) {
    v.back.destroy();
    v.front.destroy();
    v.bait?.destroy();
  }

  private makeTrap(t: Trap): TrapView {
    const v: TrapView = {
      id: t.id,
      back: this.add.graphics(),
      front: this.add.graphics(),
      bait: null,
      baitKind: null,
      dir: t.dir,
      closed: t.occupiedBy ? 1 : 0,
      occupied: !!t.occupiedBy,
      backCell: { ...t.back },
    };
    this.traps.set(t.id, v);
    this.redrawTrap(v, t);
    return v;
  }

  private redrawTrap(v: TrapView, t: Trap) {
    const geom = trapGeom(t.back, t.dir);
    const f = add(t.back, t.dir);
    const minSum = Math.min(t.back.x + t.back.y, f.x + f.y);
    const maxSum = Math.max(t.back.x + t.back.y, f.x + f.y);
    v.back.clear();
    v.front.clear();
    drawTrapBack(v.back, geom, { closed: v.closed });
    drawTrapFront(v.front, geom, { closed: v.closed, occupied: v.occupied && v.closed >= 1 });
    v.back.setDepth(minSum * 10 + 1);
    v.front.setDepth(maxSum * 10 + 8);
    v.dir = t.dir;
    v.backCell = { ...t.back };
    // bait
    if (t.bait !== v.baitKind) {
      v.bait?.destroy();
      v.bait = null;
      if (t.bait) {
        const c = cellCenter(t.back.x, t.back.y);
        v.bait = this.img(c.x, c.y + 4, t.bait, 64, 44, 0.5, t.bait === 'tuna' ? 36 / 48 : 32 / 44).setDepth((t.back.x + t.back.y) * 10 + 2);
      }
      v.baitKind = t.bait;
    }
  }

  private destroyItem(v: ItemView) {
    v.obj.destroy();
    for (const e of v.extra) e.destroy();
  }

  private makeFood(id: string, kind: 'kibble' | 'tuna', cell: Cell): ItemView {
    const c = cellCenter(cell.x, cell.y);
    const obj = this.img(c.x, c.y + 4, kind, 64, 46, 0.5, kind === 'tuna' ? 36 / 48 : 32 / 44).setDepth(depthOf(cell.x, cell.y, 2));
    const extra: Phaser.GameObjects.GameObject[] = [];
    if (kind === 'tuna') {
      for (let i = 0; i < 2; i++) {
        const w = this.img(c.x - 8 + i * 14, c.y - 12, 'scent', 24, 14, 0.5, 1).setDepth(depthOf(cell.x, cell.y, 2)).setAlpha(0);
        extra.push(w);
        if (!this.settings.reducedMotion) {
          this.tweens.add({ targets: w, y: c.y - 34, alpha: { from: 0.9, to: 0 }, duration: 1600, delay: i * 800, repeat: -1 });
        }
      }
    }
    const v: ItemView = { id, obj, extra, cell: { ...cell }, dying: false };
    this.foods.set(id, v);
    return v;
  }

  private makeToy(id: string, cell: Cell): ItemView {
    const c = cellCenter(cell.x, cell.y);
    const obj = this.img(c.x, c.y + 6, 'toy', 64, 46, 0.5, 74 / 84).setDepth(depthOf(cell.x, cell.y, 2));
    if (!this.settings.reducedMotion) this.tweens.add({ targets: obj, angle: { from: -7, to: 7 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const v: ItemView = { id, obj, extra: [], cell: { ...cell }, dying: false };
    this.toys.set(id, v);
    return v;
  }

  private makeBox(id: string, cell: Cell): BoxView {
    const back = this.add.graphics().setDepth(depthOf(cell.x, cell.y, 3));
    const front = this.add.graphics().setDepth(depthOf(cell.x, cell.y, 7));
    drawBoxBack(back, cell.x, cell.y);
    drawBoxFront(front, cell.x, cell.y);
    const v = { id, back, front, cell: { ...cell } };
    this.boxes.set(id, v);
    return v;
  }

  private gateAxis(g: Gate): 'x' | 'y' {
    const { x, y } = g.cell;
    const fx = this.featureAt(x - 1, y) === 'fence' || this.featureAt(x + 1, y) === 'fence';
    return fx ? 'x' : 'y';
  }

  private makeGate(g: Gate): GateView {
    const v: GateView = { id: g.id, g: this.add.graphics().setDepth(depthOf(g.cell.x, g.cell.y, 4)), axis: this.gateAxis(g), openT: g.open ? 1 : 0, cell: { ...g.cell } };
    this.gates.set(g.id, v);
    this.redrawGate(v);
    return v;
  }

  private redrawGate(v: GateView) {
    v.g.clear();
    drawGate(v.g, v.cell.x, v.cell.y, v.axis, v.openT);
  }

  private makeNoise(n: Noise): NoiseView {
    const c = cellCenter(n.cell.x, n.cell.y);
    const key = n.kind === 'mower' ? 'mower' : n.kind === 'radio' ? 'radio' : 'chimes';
    const anchor = Props.ANCHORS[key];
    const svgW = key === 'mower' ? 104 : key === 'radio' ? 88 : 72;
    const svgH = key === 'mower' ? 84 : key === 'radio' ? 96 : 100;
    const img = this.img(c.x, c.y + 8, key, svgW, svgW * 0.82, anchor.x / svgW, anchor.y / svgH).setDepth(depthOf(n.cell.x, n.cell.y, 4));
    const waves = this.add.graphics().setDepth(depthOf(n.cell.x, n.cell.y, 4) + 0.5);
    const bg = this.add.graphics();
    bg.fillStyle(0xfffaf0, 1);
    bg.fillRoundedRect(-17, -13, 34, 26, 12);
    bg.lineStyle(2.5, PAL.ink, 1);
    bg.strokeRoundedRect(-17, -13, 34, 26, 12);
    bg.fillStyle(0xf2a65a, 1);
    bg.fillCircle(-7, 0, 5);
    bg.lineStyle(1.6, PAL.ink, 1);
    bg.lineBetween(-7, 0, -7, -3);
    bg.lineBetween(-7, 0, -5, 1);
    const text = this.add.text(5, 0, '', { fontFamily: 'Nunito Variable, sans-serif', fontSize: '17px', fontStyle: '800', color: '#4c3b3a' }).setOrigin(0.5);
    text.setResolution(this.texScale);
    const badge = this.add.container(c.x + 30, c.y - 70, [bg, text]).setDepth(FX_DEPTH - 20);
    const v: NoiseView = { id: n.id, img, waves, badge, badgeText: text, active: n.active, cell: { ...n.cell } };
    this.noises.set(n.id, v);
    return v;
  }

  private updateNoiseBadge(v: NoiseView, n: Noise) {
    const until = turnsUntilNoise(n, this.state.turn);
    v.active = n.active;
    if (n.active || until === null) {
      v.badge.setVisible(false);
    } else {
      v.badge.setVisible(true);
      v.badgeText.setText(String(until));
    }
  }

  // -------------------------------------------------------------------------
  // full synchronisation

  /** Snap every view to `s` — used after undo/restart and to finish animations. */
  syncTo(s: GameState) {
    this.state = s;
    // cats
    for (const cat of s.cats) {
      const v = this.cats.get(cat.id) ?? this.makeCat(cat);
      this.placeCat(v, cat);
    }
    // traps
    const trapIds = new Set(s.traps.map((t) => t.id));
    for (const [id, v] of this.traps) if (!trapIds.has(id)) (this.destroyTrap(v), this.traps.delete(id));
    for (const t of s.traps) {
      const v = this.traps.get(t.id) ?? this.makeTrap(t);
      v.closed = t.occupiedBy ? 1 : 0;
      v.occupied = !!t.occupiedBy;
      this.redrawTrap(v, t);
    }
    // foods
    const foodIds = new Set(s.foods.map((f) => f.id));
    for (const [id, v] of this.foods) if (!foodIds.has(id)) (this.destroyItem(v), this.foods.delete(id));
    for (const f of s.foods) {
      const v = this.foods.get(f.id) ?? this.makeFood(f.id, f.kind, f.cell);
      v.obj.setAlpha(f.ttl >= 3 ? 1 : f.ttl === 2 ? 0.78 : 0.55).setScale(46 / (64 * this.texScale));
    }
    // toys
    const toyIds = new Set(s.toys.map((t) => t.id));
    for (const [id, v] of this.toys) if (!toyIds.has(id)) (this.destroyItem(v), this.toys.delete(id));
    for (const t of s.toys) {
      const v = this.toys.get(t.id) ?? this.makeToy(t.id, t.cell);
      v.obj.setAlpha(t.ttl >= 3 ? 1 : t.ttl === 2 ? 0.8 : 0.6).setScale(46 / (64 * this.texScale));
    }
    // boxes
    for (const b of s.boxes) if (!this.boxes.has(b.id)) this.makeBox(b.id, b.cell);
    for (const [id, v] of this.boxes) {
      if (!s.boxes.some((b) => b.id === id)) {
        v.back.destroy();
        v.front.destroy();
        this.boxes.delete(id);
      } else {
        v.back.setScale(1).setAlpha(1);
        v.front.setScale(1).setAlpha(1);
      }
    }
    // gates
    for (const g of s.gates) {
      const v = this.gates.get(g.id) ?? this.makeGate(g);
      v.openT = g.open ? 1 : 0;
      this.redrawGate(v);
    }
    // noises
    for (const n of s.noises) {
      const v = this.noises.get(n.id) ?? this.makeNoise(n);
      this.updateNoiseBadge(v, n);
      v.img.setAngle(0);
    }
    this.refreshShade();
    this.refreshDanger();
    this.refreshTallAlpha();
    this.renderOverlay();
  }

  private refreshShade() {
    for (const o of this.shadeImgs) o.destroy();
    this.shadeImgs = [];
    const s = this.state;
    const cover = computeCover(s);
    const alpha = this.shadeAlpha();
    for (let y = 0; y < s.height; y++) {
      for (let x = 0; x < s.width; x++) {
        if (!cover[y * s.width + x]) continue;
        const f = s.features[y * s.width + x];
        if (f && f !== 'bush' && f !== 'den') continue;
        const c = cellCenter(x, y);
        this.shadeImgs.push(this.img(c.x, c.y, 'shade', 120, 112, 0.5, 0.5).setDepth(-9500).setAlpha(alpha));
      }
    }
  }

  /** Shade matters a lot when a shy cat is around — make it clearly readable then. */
  private shadeAlpha(): number {
    const shy = this.state.cats.some((c) => c.fear >= 2 && c.mode !== 'trapped');
    if (this.overlay.emphasizeShade) return 0.5;
    return shy ? 0.34 : 0.16;
  }

  private refreshDanger() {
    const s = this.state;
    const danger = computeDanger(s);
    this.dangerG.clear();
    for (let y = 0; y < s.height; y++) {
      for (let x = 0; x < s.width; x++) {
        if (danger[y * s.width + x]) fillCell(this.dangerG, x, y, 0xff8a5c, 0.3, 0.05);
      }
    }
  }

  private refreshTallAlpha() {
    const catCells = new Set(this.state.cats.filter((c) => c.mode !== 'trapped').map((c) => key(c.pos)));
    for (const t of this.tall) {
      const behind = [
        { x: t.cell.x - 1, y: t.cell.y },
        { x: t.cell.x, y: t.cell.y - 1 },
        { x: t.cell.x - 1, y: t.cell.y - 1 },
      ].some((c) => catCells.has(key(c)));
      t.obj.setAlpha(behind ? 0.55 : 1);
    }
  }

  // -------------------------------------------------------------------------
  // overlay (highlights, previews)

  setOverlay(o: Overlay) {
    const shadeChanged = o.emphasizeShade !== this.overlay.emphasizeShade;
    this.overlay = o;
    if (!this.ready) return;
    if (shadeChanged) for (const im of this.shadeImgs) im.setAlpha(this.shadeAlpha());
    this.renderOverlay();
  }

  private renderOverlay() {
    if (!this.overlayG) return;
    const o = this.overlay;
    const g = this.overlayG;
    g.clear();
    for (const c of o.validCells) {
      const p = cellCenter(c.x, c.y);
      g.fillStyle(0xffffff, 0.55);
      g.fillEllipse(p.x, p.y, 15, 7.5);
    }
    for (const z of o.zones) this.drawZone(g, z.cells, z.color, z.alpha);
    for (const c of o.selectedCells) strokeCell(g, c.x, c.y, 0xf2a65a, 1, 3.5, 0.06);
    if (o.hover) {
      fillCell(g, o.hover.cell.x, o.hover.cell.y, o.hover.ok ? 0x8ee3c8 : 0xf08a7e, 0.45, 0.06);
      strokeCell(g, o.hover.cell.x, o.hover.cell.y, o.hover.ok ? 0x3fae8a : 0xd1574a, 1, 2.5, 0.06);
    }
    for (const v of this.cats.values()) v.ring.setVisible(v.id === o.selectedCatId);
    this.renderPaths();
    this.renderGhosts();
  }

  /** Soft fill plus a crisp outline along the zone border. */
  private drawZone(g: Phaser.GameObjects.Graphics, cells: Cell[], color: number, alpha: number) {
    const set = new Set(cells.map(key));
    for (const c of cells) fillCell(g, c.x, c.y, color, alpha, 0);
    g.lineStyle(3, color, Math.min(1, alpha * 4));
    for (const c of cells) {
      const { x, y } = c;
      if (!set.has(key({ x, y: y - 1 }))) {
        const a = gp(x, y);
        const b = gp(x + 1, y);
        g.lineBetween(a.x, a.y, b.x, b.y);
      }
      if (!set.has(key({ x: x + 1, y }))) {
        const a = gp(x + 1, y);
        const b = gp(x + 1, y + 1);
        g.lineBetween(a.x, a.y, b.x, b.y);
      }
      if (!set.has(key({ x, y: y + 1 }))) {
        const a = gp(x, y + 1);
        const b = gp(x + 1, y + 1);
        g.lineBetween(a.x, a.y, b.x, b.y);
      }
      if (!set.has(key({ x: x - 1, y }))) {
        const a = gp(x, y);
        const b = gp(x, y + 1);
        g.lineBetween(a.x, a.y, b.x, b.y);
      }
    }
  }

  private renderPaths() {
    const g = this.pathG;
    g.clear();
    for (const p of this.overlay.paths) {
      const cat = this.state.cats.find((c) => c.id === p.catId);
      if (!cat || cat.mode === 'trapped') continue;
      const pts = [cat.pos, ...p.cells].map((c) => cellCenter(c.x, c.y));
      const alpha = p.hypothetical ? 1 : 0.75;
      // dotted trail
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        const n = 3;
        for (let k = 1; k <= n; k++) {
          const t = k / (n + 1) + (i === 0 ? 0.05 : 0);
          const x = a.x + (b.x - a.x) * t;
          const y = a.y + (b.y - a.y) * t;
          g.fillStyle(0x4c3b3a, 0.45 * alpha);
          g.fillCircle(x, y + 1.2, 4.2);
          g.fillStyle(p.color, alpha);
          g.fillCircle(x, y, 3.6);
        }
      }
      // next-step arrow
      if (pts.length > 1) {
        const a = pts[0];
        const b = pts[1];
        const ang = Math.atan2(b.y - a.y, b.x - a.x);
        const tip = { x: a.x + (b.x - a.x) * 0.62, y: a.y + (b.y - a.y) * 0.62 };
        const s = 11;
        const p1 = { x: tip.x + Math.cos(ang) * s, y: tip.y + Math.sin(ang) * s };
        const p2 = { x: tip.x + Math.cos(ang + 2.5) * s, y: tip.y + Math.sin(ang + 2.5) * s };
        const p3 = { x: tip.x + Math.cos(ang - 2.5) * s, y: tip.y + Math.sin(ang - 2.5) * s };
        g.fillStyle(0x4c3b3a, alpha);
        g.fillTriangle(p1.x, p1.y + 1.5, p2.x, p2.y + 1.5, p3.x, p3.y + 1.5);
        g.fillStyle(p.color, alpha);
        g.fillTriangle(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
      }
      if (p.target && (p.kind === 'food' || p.kind === 'toy' || p.kind === 'hide')) {
        const c = cellCenter(p.target.x, p.target.y);
        g.lineStyle(3, 0x4c3b3a, 0.35 * alpha);
        g.strokeEllipse(c.x, c.y + 1.5, 58, 28);
        g.lineStyle(3, p.color, alpha);
        g.strokeEllipse(c.x, c.y, 58, 28);
      }
    }
  }

  private renderGhosts() {
    const g = this.ghostG;
    g.clear();
    for (const im of this.ghostImgs) im.destroy();
    this.ghostImgs = [];
    for (const gh of this.overlay.ghosts) this.drawGhost(g, gh);
  }

  private drawGhost(g: Phaser.GameObjects.Graphics, gh: Ghost) {
    if (gh.kind === 'trap') {
      const f = add(gh.back, gh.dir);
      if (!gh.highlighted) {
        // a candidate direction: a round badge with an iso arrow on the future front cell
        const c = cellCenter(f.x, f.y);
        const dv = { x: f.x - gh.back.x, y: f.y - gh.back.y };
        const pv = { x: -dv.y, y: dv.x };
        const cx = f.x + 0.5;
        const cy = f.y + 0.5;
        const P = (a: number, b: number) => gp(cx + dv.x * a + pv.x * b, cy + dv.y * a + pv.y * b);
        g.fillStyle(0x4c3b3a, 0.3);
        g.fillEllipse(c.x, c.y + 3, 50, 26);
        g.fillStyle(0xffffff, 0.95);
        g.fillEllipse(c.x, c.y, 50, 26);
        g.lineStyle(2.5, 0x3fae8a, 1);
        g.strokeEllipse(c.x, c.y, 50, 26);
        const pts = [P(0.34, 0), P(0.02, 0.26), P(0.02, 0.1), P(-0.3, 0.1), P(-0.3, -0.1), P(0.02, -0.1), P(0.02, -0.26)];
        g.fillStyle(0x3fae8a, 1);
        g.fillPoints(pts as Phaser.Types.Math.Vector2Like[], true);
        return;
      }
      const geom = trapGeom(gh.back, gh.dir);
      const alpha = 0.72;
      const tg = this.add.graphics();
      drawTrapBack(tg, geom, { alpha });
      drawTrapFront(tg, geom, { alpha });
      tg.setDepth(Math.max(gh.back.x + gh.back.y, f.x + f.y) * 10 + 9);
      this.ghostImgs.push(tg as unknown as Phaser.GameObjects.Image);
      // entrance arrow
      const appr = add(gh.back, gh.dir, 2);
      const a = cellCenter(appr.x, appr.y);
      const b = cellCenter(f.x, f.y);
      g.lineStyle(4, gh.ok ? 0x3fae8a : 0xd1574a, 0.9);
      g.lineBetween(a.x, a.y, a.x + (b.x - a.x) * 0.55, a.y + (b.y - a.y) * 0.55);
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      const tip = { x: a.x + (b.x - a.x) * 0.62, y: a.y + (b.y - a.y) * 0.62 };
      g.fillStyle(gh.ok ? 0x3fae8a : 0xd1574a, 0.9);
      g.fillTriangle(
        tip.x + Math.cos(ang) * 10,
        tip.y + Math.sin(ang) * 10,
        tip.x + Math.cos(ang + 2.4) * 10,
        tip.y + Math.sin(ang + 2.4) * 10,
        tip.x + Math.cos(ang - 2.4) * 10,
        tip.y + Math.sin(ang - 2.4) * 10,
      );
      return;
    }
    if (!gh.ok) return;
    const c = cellCenter(gh.cell.x, gh.cell.y);
    if (gh.kind === 'box') {
      const bb = this.add.graphics().setDepth(depthOf(gh.cell.x, gh.cell.y, 9));
      drawBoxBack(bb, gh.cell.x, gh.cell.y, 0.55);
      drawBoxFront(bb, gh.cell.x, gh.cell.y, 0.55);
      this.ghostImgs.push(bb as unknown as Phaser.GameObjects.Image);
      return;
    }
    const keyName = gh.kind;
    const svgW = 64;
    const im = this.img(c.x, c.y + 4, keyName, svgW, 46, 0.5, keyName === 'toy' ? 74 / 84 : keyName === 'tuna' ? 36 / 48 : 32 / 44)
      .setAlpha(0.6)
      .setDepth(depthOf(gh.cell.x, gh.cell.y, 9));
    this.ghostImgs.push(im);
  }

  // -------------------------------------------------------------------------
  // turn animation

  /** Instantly finish whatever is animating. */
  private flush() {
    this.tweens.killAll();
    this.time.removeAllEvents();
    for (const o of this.transient) o.destroy();
    this.transient.clear();
    for (const [id, v] of this.foods) if (v.dying) (this.destroyItem(v), this.foods.delete(id));
    for (const [id, v] of this.toys) if (v.dying) (this.destroyItem(v), this.toys.delete(id));
    // restart looping idle tweens after the kill
    for (const v of this.toys.values()) if (!this.settings.reducedMotion) this.tweens.add({ targets: v.obj, angle: { from: -7, to: 7 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    for (const v of this.foods.values())
      v.extra.forEach((w, i) => {
        const im = w as Phaser.GameObjects.Image;
        const c = cellCenter(v.cell.x, v.cell.y);
        im.setPosition(c.x - 8 + i * 14, c.y - 12).setAlpha(0);
        if (!this.settings.reducedMotion) this.tweens.add({ targets: im, y: c.y - 34, alpha: { from: 0.9, to: 0 }, duration: 1600, delay: i * 800, repeat: -1 });
      });
  }

  sync(s: GameState) {
    if (!this.ready) return;
    this.flush();
    this.syncTo(s);
  }

  applyTurn(prev: GameState, next: GameState, events: GameEvent[]) {
    if (!this.ready) return;
    this.flush();
    this.syncTo(prev);
    this.state = next;

    const MOVE = this.dur(380);
    const AFTER = MOVE;
    const reduced = this.settings.reducedMotion;
    const moved = new Set<string>();
    let settleAt = MOVE + this.dur(160);

    // new entities pop in
    for (const ev of events) {
      if (ev.type !== 'placed') continue;
      this.cb.onFx?.('pop');
      if (ev.item === 'trap') {
        const t = next.traps.find((x) => x.id === ev.id)!;
        const v = this.makeTrap(t);
        this.popIn([v.back, v.front]);
      } else if (ev.item === 'kibble' || ev.item === 'tuna') {
        if (ev.inTrap) {
          const t = next.traps.find((x) => x.id === ev.inTrap)!;
          const v = this.traps.get(t.id)!;
          this.redrawTrap(v, t);
          if (v.bait) this.popIn([v.bait]);
        } else {
          const v = this.makeFood(ev.id, ev.item, ev.cell);
          this.popIn([v.obj]);
        }
      } else if (ev.item === 'toy') {
        const v = this.makeToy(ev.id, ev.cell);
        this.popIn([v.obj]);
      } else if (ev.item === 'box') {
        const v = this.makeBox(ev.id, ev.cell);
        this.popIn([v.back, v.front]);
        this.cb.onFx?.('rustle');
      }
    }

    for (const ev of events) {
      switch (ev.type) {
        case 'trapRotated': {
          const t = next.traps.find((x) => x.id === ev.trapId)!;
          const v = this.traps.get(t.id)!;
          this.redrawTrap(v, t);
          this.popIn([v.back, v.front], 0.85);
          this.cb.onFx?.('pop');
          break;
        }
        case 'gateToggled': {
          const v = this.gates.get(ev.gateId)!;
          const from = v.openT;
          const to = ev.open ? 1 : 0;
          const delay = ev.open ? 0 : AFTER;
          this.tweens.addCounter({
            from,
            to,
            duration: this.dur(320),
            delay,
            ease: 'Back.easeOut',
            onUpdate: (tw) => {
              v.openT = tw.getValue() ?? to;
              this.redrawGate(v);
            },
          });
          this.cb.onFx?.('gate');
          break;
        }
        case 'noiseStart': {
          const v = this.noises.get(ev.noiseId)!;
          v.active = true;
          v.badge.setVisible(false);
          this.cb.onFx?.('scared');
          break;
        }
        case 'noiseEnd': {
          const v = this.noises.get(ev.noiseId)!;
          v.active = false;
          break;
        }
        case 'catMove': {
          moved.add(ev.catId);
          this.animateMove(ev.catId, ev.from, ev.to, MOVE, next);
          break;
        }
        case 'catBlocked': {
          const v = this.cats.get(ev.catId);
          if (v && !reduced) this.tweens.add({ targets: v.sprite, x: { from: -3, to: 3 }, duration: 60, yoyo: true, repeat: 2, onComplete: () => v.sprite.setX(0) });
          break;
        }
        case 'emote': {
          const big = ev.emote === 'alert' || ev.emote === 'food' || ev.emote === 'toy' || ev.emote === 'question';
          const delay = ev.emote === 'heart' ? AFTER : 0;
          this.time.delayedCall(delay, () => this.popEmote(ev.catId, ev.emote as EmoteIcon, big));
          if (ev.emote === 'food' || ev.emote === 'toy') {
            this.cb.onFx?.('meow');
            const v = this.cats.get(ev.catId);
            if (v && !reduced) this.tweens.add({ targets: v.sprite, y: { from: 4, to: -10 }, duration: this.dur(140), yoyo: true, ease: 'Quad.easeOut' });
          }
          break;
        }
        case 'catScared': {
          this.cb.onFx?.('scared');
          break;
        }
        case 'catEat': {
          const delay = moved.has(ev.catId) || events.some((e) => e.type === 'catMove' && e.catId === ev.catId) ? AFTER : 0;
          this.time.delayedCall(delay, () => {
            this.cb.onFx?.('eat');
            if (ev.foodId.startsWith('bait:')) {
              const tv = this.traps.get(ev.foodId.slice(5));
              if (tv?.bait) this.tweens.add({ targets: tv.bait, scale: 0, alpha: 0, duration: this.dur(300) });
            } else {
              const fv = this.foods.get(ev.foodId);
              if (fv) {
                fv.dying = true;
                this.tweens.add({ targets: [fv.obj, ...fv.extra], scale: 0, alpha: 0, duration: this.dur(320), delay: this.dur(120) });
              }
            }
            const cv = this.cats.get(ev.catId);
            if (cv) this.setPose(cv, 'eat');
            this.crumbs(ev.cell);
          });
          settleAt = Math.max(settleAt, AFTER + this.dur(480));
          break;
        }
        case 'trustUp': {
          // eating shows its own big heart; hesitating at the door gets a small one
          if (!events.some((e) => e.type === 'catEat' && e.catId === ev.catId)) {
            this.time.delayedCall(this.dur(220), () => {
              const v = this.cats.get(ev.catId);
              if (v) this.burst(v.c.x + (v.left ? -10 : 10), v.c.y - CAT_SIZE * 0.7, 'heart', 1);
            });
          }
          break;
        }
        case 'catHide': {
          const delay = events.some((e) => e.type === 'catMove' && e.catId === ev.catId) ? AFTER : 0;
          this.time.delayedCall(delay, () => {
            const v = this.cats.get(ev.catId);
            if (!v) return;
            this.setPose(v, 'hide');
            v.shadow.setVisible(false);
            this.cb.onFx?.('rustle');
            if (!reduced) this.tweens.add({ targets: v.sprite, y: { from: 0, to: 6 }, duration: this.dur(200) });
          });
          break;
        }
        case 'catTrapped': {
          const delay = AFTER;
          this.time.delayedCall(delay, () => {
            const tv = this.traps.get(ev.trapId);
            const t = next.traps.find((x) => x.id === ev.trapId);
            const cv = this.cats.get(ev.catId);
            if (cv) {
              this.setPose(cv, 'eat');
              this.setStatus(cv, null);
            }
            if (tv && t) {
              this.cb.onFx?.('door');
              this.tweens.addCounter({
                from: 0,
                to: 1,
                duration: this.dur(420),
                ease: 'Bounce.easeOut',
                onUpdate: (tw) => {
                  tv.closed = tw.getValue() ?? 1;
                  tv.occupied = tv.closed >= 1;
                  this.redrawTrap(tv, t);
                },
              });
              const c = cellCenter(t.back.x, t.back.y);
              this.time.delayedCall(this.dur(300), () => {
                this.cb.onFx?.('rescue');
                this.burst(c.x, c.y - 40, 'heart', reduced ? 3 : 7);
                this.burst(c.x, c.y - 40, 'sparkle', reduced ? 0 : 6);
              });
            }
          });
          settleAt = Math.max(settleAt, AFTER + this.dur(1100));
          break;
        }
        case 'foodExpired': {
          const fv = this.foods.get(ev.foodId);
          if (fv) {
            fv.dying = true;
            this.tweens.add({ targets: [fv.obj, ...fv.extra], alpha: 0, duration: this.dur(400), delay: AFTER });
          }
          break;
        }
        case 'toyExpired': {
          const tv = this.toys.get(ev.toyId);
          if (tv) {
            tv.dying = true;
            this.tweens.add({ targets: tv.obj, alpha: 0, scale: 0, duration: this.dur(380), delay: AFTER });
          }
          break;
        }
        case 'won': {
          this.time.delayedCall(AFTER + this.dur(700), () => this.celebrate());
          settleAt = Math.max(settleAt, AFTER + this.dur(1400));
          break;
        }
        default:
          break;
      }
    }

    // stationary cats change pose right away (sleep, groom, hesitate, ...)
    for (const cat of next.cats) {
      const v = this.cats.get(cat.id);
      if (!v || moved.has(cat.id)) continue;
      if (cat.mode === 'trapped' && !events.some((e) => e.type === 'catTrapped' && e.catId === cat.id)) continue;
      if (events.some((e) => (e.type === 'catEat' || e.type === 'catHide' || e.type === 'catTrapped') && e.catId === cat.id)) continue;
      this.setPose(v, restPose(cat));
      this.setStatus(v, statusFor(cat));
      v.shadow.setVisible(cat.mode !== 'hiding');
    }
    // statuses of moving cats update at the start of the move
    for (const id of moved) {
      const cat = next.cats.find((c) => c.id === id);
      const v = this.cats.get(id);
      if (cat && v) this.setStatus(v, statusFor(cat));
    }

    this.refreshShade();
    this.refreshDanger();
    for (const n of next.noises) {
      const v = this.noises.get(n.id);
      if (v) this.updateNoiseBadge(v, n);
    }
    this.renderOverlay();
    this.time.delayedCall(settleAt, () => {
      this.flush();
      this.syncTo(this.state);
    });
  }

  private animateMove(id: string, from: Cell, to: Cell, duration: number, next: GameState) {
    const v = this.cats.get(id);
    if (!v) return;
    const cat = next.cats.find((c) => c.id === id)!;
    const a = cellCenter(from.x, from.y);
    const b = cellCenter(to.x, to.y);
    const screenDx = to.x - from.x - (to.y - from.y);
    v.left = screenDx < 0;
    v.sprite.setFlipX(v.left);
    v.moving = true;
    v.c.setDepth(Math.max(depthOf(from.x, from.y, 5), depthOf(to.x, to.y, 5)));
    const scared = cat.mode === 'frightened';
    const reduced = this.settings.reducedMotion;
    const intoTrap = this.state.traps.some((t) => eq(t.back, to) || eq(add(t.back, t.dir), to));
    let lastFrame = -1;
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration,
      ease: 'Sine.easeInOut',
      onUpdate: (tw) => {
        const t = tw.getValue() ?? 1;
        v.c.setPosition(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
        const frame = Math.floor(t * 4) % 2;
        if (frame !== lastFrame) {
          lastFrame = frame;
          this.setPose(v, frame === 0 ? 'walk1' : 'walk2');
          if (frame === 0) this.cb.onFx?.('step');
        }
        if (!reduced) v.sprite.setY(4 - Math.sin(t * Math.PI) * (scared ? 9 : 5));
        if (intoTrap) v.sprite.setScale(v.baseScale * (1 - 0.18 * t));
      },
      onComplete: () => {
        v.moving = false;
        v.cell = { ...to };
        v.c.setDepth(depthOf(to.x, to.y, 5));
        v.sprite.setY(4);
        this.setPose(v, restPose(cat));
      },
    });
    this.refreshTallAlpha();
  }

  private popIn(objs: Phaser.GameObjects.GameObject[], from = 0) {
    for (const o of objs) {
      const t = o as unknown as Phaser.GameObjects.Components.Transform & Phaser.GameObjects.Components.Alpha;
      const sx = t.scaleX;
      const sy = t.scaleY;
      if (this.settings.reducedMotion) continue;
      if (o instanceof Phaser.GameObjects.Graphics) {
        // graphics are drawn in world space: fade instead of scaling around the origin
        t.setAlpha(0);
        this.tweens.add({ targets: o, alpha: 1, duration: this.dur(220) });
        continue;
      }
      t.setScale(sx * from, sy * from);
      this.tweens.add({ targets: o, scaleX: sx, scaleY: sy, duration: this.dur(300), ease: 'Back.easeOut' });
    }
  }

  private popEmote(catId: string, kind: EmoteIcon, big: boolean) {
    const v = this.cats.get(catId);
    if (!v) return;
    const x = v.c.x + (v.left ? -16 : 16);
    const y = v.c.y - CAT_SIZE * 0.9;
    const im = this.add.image(x, y, `emote:${kind}`).setDepth(FX_DEPTH + 5);
    const s = (big ? 0.82 : 0.66) / this.texScale;
    this.transient.add(im);
    if (this.settings.reducedMotion) {
      im.setScale(s);
      this.tweens.add({ targets: im, alpha: 0, delay: 900, duration: 300, onComplete: () => (im.destroy(), this.transient.delete(im)) });
      return;
    }
    im.setScale(0);
    this.tweens.add({ targets: im, scale: s, y: y - 10, duration: this.dur(260), ease: 'Back.easeOut' });
    this.tweens.add({
      targets: im,
      alpha: 0,
      y: y - 26,
      delay: 1100 / this.speed() + 200,
      duration: 380,
      onComplete: () => {
        im.destroy();
        this.transient.delete(im);
      },
    });
  }

  private burst(x: number, y: number, key: string, n: number) {
    for (let i = 0; i < n; i++) {
      const ang = -Math.PI / 2 + (i - (n - 1) / 2) * 0.42;
      const dist = 34 + (i % 3) * 12;
      const im = this.add.image(x, y, key).setDepth(FX_DEPTH + 10);
      const base = (key === 'heart' ? 22 : 18) / ((key === 'heart' ? 32 : 24) * this.texScale);
      im.setScale(base * 0.4);
      this.transient.add(im);
      this.tweens.add({
        targets: im,
        x: x + Math.cos(ang) * dist,
        y: y + Math.sin(ang) * dist - 10,
        scale: base,
        duration: 520,
        ease: 'Quad.easeOut',
      });
      this.tweens.add({
        targets: im,
        alpha: 0,
        y: `-=${20}`,
        delay: 700,
        duration: 500,
        onComplete: () => {
          im.destroy();
          this.transient.delete(im);
        },
      });
    }
  }

  private crumbs(cell: Cell) {
    if (this.settings.reducedMotion) return;
    const c = cellCenter(cell.x, cell.y);
    for (let i = 0; i < 4; i++) {
      const dot = this.add.circle(c.x + (i - 1.5) * 6, c.y - 4, 2.4, 0xd39a64).setDepth(FX_DEPTH);
      this.transient.add(dot);
      this.tweens.add({
        targets: dot,
        y: c.y - 14 - (i % 2) * 6,
        alpha: 0,
        duration: 420,
        delay: i * 40,
        onComplete: () => {
          dot.destroy();
          this.transient.delete(dot);
        },
      });
    }
  }

  private celebrate() {
    this.cb.onFx?.('win');
    for (const t of this.state.traps) {
      if (!t.occupiedBy) continue;
      const c = cellCenter(t.back.x, t.back.y);
      this.burst(c.x, c.y - 50, 'heart', this.settings.reducedMotion ? 2 : 5);
      this.burst(c.x, c.y - 60, 'sparkle', this.settings.reducedMotion ? 0 : 5);
    }
  }

  // -------------------------------------------------------------------------
  // per-frame idle life

  update(time: number, delta: number) {
    if (!this.ready) return;
    const reduced = this.settings.reducedMotion;
    for (const v of this.cats.values()) {
      if (v.moving) continue;
      const breathing = v.pose === 'sit' || v.pose === 'sleep' || v.pose === 'hide' || v.pose === 'stand' || v.pose === 'curious';
      const k = reduced || !breathing ? 0 : Math.sin(time / (v.pose === 'sleep' ? 700 : 480) + v.phase) * (v.pose === 'sleep' ? 0.025 : 0.014);
      const s = v.sprite.scaleX;
      v.sprite.setScale(s, Math.abs(s) * (1 + k));
      if (v.statusKind) v.status.setY(-CAT_SIZE * 0.78 + (reduced ? 0 : Math.sin(time / 300 + v.phase) * 2));
      if (v.pose === 'sleep' && !reduced) {
        v.zTimer -= delta;
        if (v.zTimer <= 0) {
          v.zTimer = 1500 + (v.phase * 100) % 400;
          this.spawnZ(v);
        }
      }
    }
    // noise waves and danger pulse
    for (const nv of this.noises.values()) {
      nv.waves.clear();
      if (!nv.active) continue;
      const c = cellCenter(nv.cell.x, nv.cell.y);
      if (!reduced) nv.img.setAngle(Math.sin(time / 40) * 2.5);
      for (let i = 0; i < 3; i++) {
        const t = ((time / 900 + i / 3) % 1 + 1) % 1;
        const r = 20 + t * 70;
        nv.waves.lineStyle(3, 0xff8a5c, (1 - t) * 0.8);
        nv.waves.strokeEllipse(c.x, c.y - 26, r * 2, r);
      }
    }
    if (this.dangerG) this.dangerG.setAlpha(reduced ? 1 : 0.75 + Math.sin(time / 260) * 0.25);
  }

  private spawnZ(v: CatView) {
    const im = this.add.image(v.c.x + (v.left ? -22 : 22), v.c.y - 46, 'zzz').setDepth(FX_DEPTH);
    im.setScale(14 / (20 * this.texScale)).setAlpha(0.9);
    this.transient.add(im);
    this.tweens.add({
      targets: im,
      x: im.x + (v.left ? -10 : 10),
      y: im.y - 30,
      alpha: 0,
      scale: 22 / (20 * this.texScale),
      duration: 1600,
      onComplete: () => {
        im.destroy();
        this.transient.delete(im);
      },
    });
  }

  // -------------------------------------------------------------------------
  // camera

  fitCamera() {
    if (!this.state) return;
    const W = this.scale.width / this.dpr;
    const H = this.scale.height / this.dpr;
    const b = boardBounds(this.state.width, this.state.height);
    const availW = Math.max(100, W - this.insets.left - this.insets.right - (W < 520 ? 4 : 16));
    const availH = Math.max(100, H - this.insets.top - this.insets.bottom - 8);
    this.fitZoom = Math.max(0.25, Math.min(1.5, Math.min(availW / b.width, availH / b.height)));
    this.applyCamera();
  }

  private applyCamera() {
    const cam = this.cameras.main;
    const b = boardBounds(this.state.width, this.state.height);
    const z = this.fitZoom * this.userZoom;
    cam.setZoom(z * this.dpr);
    const offX = (this.insets.left - this.insets.right) / 2 / z;
    const offY = (this.insets.top - this.insets.bottom) / 2 / z;
    // clamp panning so the board never leaves the screen
    const maxPanX = (b.width * (this.userZoom - 1)) / 2 / this.userZoom + 40;
    const maxPanY = (b.height * (this.userZoom - 1)) / 2 / this.userZoom + 40;
    this.pan.x = Math.max(-maxPanX, Math.min(maxPanX, this.pan.x));
    this.pan.y = Math.max(-maxPanY, Math.min(maxPanY, this.pan.y));
    cam.centerOn(b.x + b.width / 2 - offX + this.pan.x, b.y + b.height / 2 - offY + this.pan.y);
  }

  zoomBy(f: number) {
    this.userZoom = Math.max(1, Math.min(2.6, this.userZoom * f));
    if (this.userZoom === 1) this.pan = { x: 0, y: 0 };
    this.applyCamera();
  }

  resetView() {
    this.userZoom = 1;
    this.pan = { x: 0, y: 0 };
    this.applyCamera();
  }

  private zoomAt(f: number, sx: number, sy: number) {
    const cam = this.cameras.main;
    const before = cam.getWorldPoint(sx, sy);
    this.zoomBy(f);
    const after = cam.getWorldPoint(sx, sy);
    this.pan.x += before.x - after.x;
    this.pan.y += before.y - after.y;
    this.applyCamera();
  }

  get zoomLevel(): number {
    return this.userZoom;
  }

  // -------------------------------------------------------------------------
  // input

  private cellAt(wx: number, wy: number): Cell | null {
    if (!this.state) return null;
    const { gx, gy } = worldToGrid(wx, wy);
    const x = Math.floor(gx);
    const y = Math.floor(gy);
    if (x < 0 || y < 0 || x >= this.state.width || y >= this.state.height) return null;
    return { x, y };
  }

  private catAtPoint(wx: number, wy: number): string | null {
    let best: { id: string; depth: number } | null = null;
    for (const v of this.cats.values()) {
      const cat = this.state.cats.find((c) => c.id === v.id);
      if (!cat || cat.mode === 'trapped' || !v.c.visible) continue;
      const dx = wx - v.c.x;
      const dy = wy - v.c.y;
      if (Math.abs(dx) < CAT_SIZE * 0.36 && dy < 8 && dy > -CAT_SIZE * 0.72) {
        if (!best || v.c.depth > best.depth) best = { id: v.id, depth: v.c.depth };
      }
    }
    return best?.id ?? null;
  }

  private onPointerDown(p: Phaser.Input.Pointer) {
    const pts = this.input.manager.pointers.filter((q) => q.isDown);
    if (pts.length >= 2) {
      const [a, b] = pts;
      this.pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: this.userZoom };
      this.pointerDown = null;
      return;
    }
    this.pointerDown = { x: p.x, y: p.y, t: p.downTime, moved: false };
  }

  private onPointerMove(p: Phaser.Input.Pointer) {
    if (!this.ready) return;
    if (this.pinch) {
      const pts = this.input.manager.pointers.filter((q) => q.isDown);
      if (pts.length >= 2) {
        const [a, b] = pts;
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        this.userZoom = Math.max(1, Math.min(2.6, (this.pinch.zoom * d) / this.pinch.dist));
        this.applyCamera();
      }
      return;
    }
    if (this.pointerDown && p.isDown) {
      const dx = p.x - this.pointerDown.x;
      const dy = p.y - this.pointerDown.y;
      if (!this.pointerDown.moved && Math.hypot(dx, dy) > 10 * this.dpr) this.pointerDown.moved = true;
      if (this.pointerDown.moved && this.userZoom > 1.001) {
        const z = this.cameras.main.zoom;
        this.pan.x -= (p.x - p.prevPosition.x) / z;
        this.pan.y -= (p.y - p.prevPosition.y) / z;
        this.applyCamera();
        return;
      }
    }
    const cell = this.cellAt(p.worldX, p.worldY);
    const k = cell ? key(cell) : null;
    if (k !== this.lastHover) {
      this.lastHover = k;
      this.cb.onHover(cell);
    }
  }

  private onPointerUp(p: Phaser.Input.Pointer) {
    if (this.pinch) {
      if (this.input.manager.pointers.filter((q) => q.isDown).length < 2) this.pinch = null;
      return;
    }
    const down = this.pointerDown;
    this.pointerDown = null;
    if (!down || down.moved || !this.ready) return;
    if (p.rightButtonReleased?.()) return;
    const catId = this.catAtPoint(p.worldX, p.worldY);
    const cat = catId ? this.state.cats.find((c) => c.id === catId) : null;
    const cell = cat ? cat.pos : this.cellAt(p.worldX, p.worldY);
    if (cell) {
      // touch devices have no hover: report the cell first so previews update
      this.lastHover = key(cell);
      this.cb.onHover(cell);
      this.cb.onTap(cell, catId);
    }
  }

  /** Screen (CSS px, relative to canvas) position of a cell — for HUD bubbles. */
  cellToScreen(c: Cell, z = 0): { x: number; y: number } {
    const cam = this.cameras.main;
    const p = cellCenter(c.x, c.y, z);
    return { x: (p.x - cam.worldView.x) * (cam.zoom / this.dpr), y: (p.y - cam.worldView.y) * (cam.zoom / this.dpr) };
  }

  catColor(id: string): number {
    const def = this.def?.cats.find((c) => c.id === id);
    return def ? hexToNum(lighten(def.look.base, 0.15)) : 0xffffff;
  }

  // neighbours helper for the gate axis when fences are missing
  static dirs = DIRS;
}
