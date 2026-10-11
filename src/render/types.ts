// Contract between the UI layer and the renderer. The renderer only ever
// receives game states, events and an overlay description — it never
// decides anything about the game.

import type { Cell, Dir, ItemKind, TargetKind } from '../core/types';

export type GhostKind = Exclude<ItemKind, 'trap'>;

export type Ghost =
  | { kind: 'trap'; back: Cell; dir: Dir; ok: boolean; highlighted?: boolean }
  | { kind: GhostKind; cell: Cell; ok: boolean; inTrap?: boolean };

export interface PathPreview {
  catId: string;
  cells: Cell[];
  target: Cell | null;
  kind: TargetKind | null;
  color: number;
  hypothetical: boolean;
}

export interface Zone {
  cells: Cell[];
  color: number;
  alpha: number;
}

export interface Overlay {
  validCells: Cell[];
  hover: { cell: Cell; ok: boolean } | null;
  ghosts: Ghost[];
  paths: PathPreview[];
  selectedCatId: string | null;
  selectedCells: Cell[];
  zones: Zone[];
  emphasizeShade: boolean;
}

export const EMPTY_OVERLAY: Overlay = {
  validCells: [],
  hover: null,
  ghosts: [],
  paths: [],
  selectedCatId: null,
  selectedCells: [],
  zones: [],
  emphasizeShade: false,
};

export interface RenderSettings {
  animSpeed: 1 | 2 | 3;
  reducedMotion: boolean;
}

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface BoardCallbacks {
  onHover(cell: Cell | null): void;
  onTap(cell: Cell, catId: string | null): void;
  /** fired for sound hooks when animations reach notable moments */
  onFx?(fx: 'step' | 'door' | 'pop' | 'eat' | 'rescue' | 'meow' | 'scared' | 'rustle' | 'gate' | 'win'): void;
}
