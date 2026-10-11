// Core data model of the simulation. Pure data — no Phaser, no DOM.

export type Dir = 'N' | 'E' | 'S' | 'W';

export interface Cell {
  x: number;
  y: number;
}

export type Terrain = 'grass' | 'path' | 'dirt' | 'flowers';

/** Static obstacles / features baked into the level map. */
export type Feature =
  | 'wall' // brick wall, blocks, gives cover
  | 'fence' // wooden fence, blocks, gives cover
  | 'tree' // blocks, gives cover
  | 'rock' // blocks, gives cover
  | 'crate' // stacked crates, blocks, gives cover
  | 'shed' // shed / house wall, blocks, gives cover
  | 'water' // pond, blocks, no cover
  | 'bush' // passable, hiding spot, gives cover
  | 'den'; // passable hiding spot (porch, old box), gives cover

export type FoodKind = 'kibble' | 'tuna';

export type ItemKind = 'trap' | 'kibble' | 'tuna' | 'box' | 'toy';

export type Inventory = Record<ItemKind, number>;

export type CatMode = 'idle' | 'interested' | 'cautious' | 'frightened' | 'hiding' | 'trapped';

/** What the cat is visibly doing this turn (drives animation). */
export type CatActivity =
  | 'sit'
  | 'walk'
  | 'eat'
  | 'play'
  | 'sleep'
  | 'groom'
  | 'scared'
  | 'hide'
  | 'hesitate'
  | 'trapped';

export type CatPattern = 'solid' | 'tabby' | 'tuxedo' | 'calico' | 'siamese';

export interface CatLook {
  pattern: CatPattern;
  base: string;
  accent: string;
  stripe: string;
  eyes: string;
}

export interface CatTraits {
  hunger: number; // 0..3
  fear: number; // 0..3
  curiosity: number; // 0..3
  trust: number; // 0..3
}

export type TargetKind = 'food' | 'toy' | 'hide' | 'patrol' | 'home' | 'flee';

export interface Target {
  kind: TargetKind;
  /** id of food/toy when relevant */
  id?: string;
  cell: Cell;
}

export interface Cat {
  id: string;
  name: string;
  pos: Cell;
  hunger: number;
  fear: number;
  curiosity: number;
  trust: number;
  preferredFood: FoodKind | null;
  mode: CatMode;
  activity: CatActivity;
  target: Target | null;
  /** turns left in the hiding state */
  timer: number;
  patrol: Cell[];
  patrolIndex: number;
  home: Cell;
  homeArea: { x: number; y: number; w: number; h: number } | null;
  trappedIn: string | null;
  required: boolean;
}

export interface Trap {
  id: string;
  /** the inner cell with the trigger plate (where bait lies) */
  back: Cell;
  /** direction the entrance faces, i.e. front = back + dir */
  dir: Dir;
  bait: FoodKind | null;
  occupiedBy: string | null;
  rotatable: boolean;
}

export interface Food {
  id: string;
  kind: FoodKind;
  cell: Cell;
  ttl: number;
}

export interface Box {
  id: string;
  cell: Cell;
}

export interface Toy {
  id: string;
  cell: Cell;
  ttl: number;
}

export interface Gate {
  id: string;
  cell: Cell;
  open: boolean;
  /** spring gate: closes by itself this many turns after opening (0 = stays open) */
  autoClose: number;
  /** turns left until a spring gate shuts */
  openTimer: number;
}

export interface NoiseSchedule {
  /** first turn the noise is active */
  start: number;
  /** how many turns it stays active */
  duration: number;
  /** repeat every N turns (optional) */
  every?: number;
}

export type NoiseKind = 'mower' | 'chimes' | 'radio';

export interface Noise {
  id: string;
  kind: NoiseKind;
  cell: Cell;
  radius: number;
  schedule: NoiseSchedule | null;
  /** player can trigger the noise via `interact` */
  interactive: boolean;
  /** duration of a manual trigger */
  manualDuration: number;
  manualRemaining: number;
  /** derived each turn */
  active: boolean;
}

export interface StarRules {
  twoStarTurns: number;
  threeStarTurns: number;
  threeStarItems: number;
}

export type GameStatus = 'playing' | 'won';

export interface GameState {
  levelId: string;
  width: number;
  height: number;
  terrain: Terrain[]; // index = y * width + x
  features: (Feature | null)[];
  cats: Cat[];
  traps: Trap[];
  foods: Food[];
  boxes: Box[];
  toys: Toy[];
  gates: Gate[];
  noises: Noise[];
  inventory: Inventory;
  used: Inventory;
  turn: number;
  rescued: string[];
  status: GameStatus;
  /** monotonically increasing id counter for player placed entities */
  nextId: number;
}

// ---------------------------------------------------------------------------
// Actions

export type Action =
  | { type: 'placeTrap'; cell: Cell; dir: Dir }
  | { type: 'rotateTrap'; trapId: string; dir: Dir }
  | { type: 'placeFood'; kind: FoodKind; cell: Cell }
  | { type: 'placeBox'; cell: Cell }
  | { type: 'placeToy'; cell: Cell }
  | { type: 'interact'; objectId: string }
  | { type: 'wait' };

export type ActionResult =
  | { ok: true }
  | { ok: false; reason: string };

// ---------------------------------------------------------------------------
// Events emitted for the renderer / audio

export type Emote = 'food' | 'question' | 'alert' | 'heart' | 'toy' | 'sleep';

export type GameEvent =
  | { type: 'placed'; item: ItemKind; id: string; cell: Cell; inTrap?: string }
  | { type: 'trapRotated'; trapId: string; dir: Dir }
  | { type: 'gateToggled'; gateId: string; open: boolean }
  | { type: 'noiseStart'; noiseId: string }
  | { type: 'noiseEnd'; noiseId: string }
  | { type: 'emote'; catId: string; emote: Emote }
  | { type: 'catMove'; catId: string; from: Cell; to: Cell }
  | { type: 'catBlocked'; catId: string }
  | { type: 'catEat'; catId: string; foodId: string; cell: Cell }
  | { type: 'trustUp'; catId: string; trust: number }
  | { type: 'catPlay'; catId: string; toyId: string }
  | { type: 'catHide'; catId: string }
  | { type: 'catCalm'; catId: string }
  | { type: 'catScared'; catId: string }
  | { type: 'catTrapped'; catId: string; trapId: string }
  | { type: 'foodExpired'; foodId: string }
  | { type: 'toyExpired'; toyId: string }
  | { type: 'won' };

export interface TurnResult {
  state: GameState;
  events: GameEvent[];
}
