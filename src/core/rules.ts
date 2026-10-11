// All tuning numbers of the simulation in one place.
// Integers only — the simulation never touches floating point randomness.

import type { Cat, FoodKind } from './types';

export const RULES = {
  /** cost of one step on a safe cell */
  stepCost: 10,
  /** extra cost of an open (unshaded) cell by fearfulness; Infinity = never steps there */
  openPenalty: [0, 3, 12, Infinity] as readonly number[],
  /** extra cost of a cell inside an active noise zone */
  dangerPenaltyBrave: 10,
  dangerPenaltyShy: 40,
  /** extra cost of a cell another cat is standing on */
  crowdPenalty: 25,
  /** a kitten is content within this many cells of its mother */
  followLeash: 2,

  /** turns ground food stays before it goes stale */
  foodTtl: 8,
  /** turns a toy keeps working */
  toyTtl: 5,

  foodBase: 20,
  foodPerHunger: 10,
  preferredBonus: 8,
  tunaBonus: 4,
  /** utility malus for food inside a trap, per point of (fear - trust) */
  trapDistrust: 4,
  toyBase: 22,
  toyPerCuriosity: 10,
  /** stickiness to the current target to avoid flip-flopping */
  commitBonus: 3,
  /** utility lost per cost unit (cost / costDivisor) */
  costDivisor: 5,
} as const;

/** Food kind properties (scent radius bonus etc.). */
export const FOOD_INFO: Record<FoodKind, { radiusBonus: number; name: string }> = {
  kibble: { radiusBonus: 0, name: 'Корм' },
  tuna: { radiusBonus: 2, name: 'Ароматный тунец' },
};

/** How far (Manhattan) a cat can smell a given food. 0 hunger = not interested. */
export function foodNoticeRadius(cat: Pick<Cat, 'hunger'>, kind: FoodKind): number {
  if (cat.hunger <= 0) return -1;
  return cat.hunger + 1 + FOOD_INFO[kind].radiusBonus;
}

/** How far a cat notices an active toy. */
export function toyNoticeRadius(cat: Pick<Cat, 'curiosity'>): number {
  if (cat.curiosity <= 0) return -1;
  return cat.curiosity + 2;
}

/** Turns a cat stays hidden after reaching a hiding spot. */
export function hideDuration(cat: Pick<Cat, 'fear'>): number {
  return cat.fear + 1;
}
