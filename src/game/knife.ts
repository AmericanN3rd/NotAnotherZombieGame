/** The knife is sharp at 100 and useless as it approaches 0. A stone puts an edge back. */

export const KNIFE_MAX = 100;
export const STONE_RESTORE = 55;

export type KnifeBand = 'sharp' | 'worn' | 'dull';
export type MeleeWeapon = 'knife' | 'hatchet' | 'pipe';

export function knifeBand(durability: number): KnifeBand {
  if (durability >= 65) return 'sharp';
  if (durability >= 30) return 'worn';
  return 'dull';
}

export function hone(durability: number): number {
  return Math.min(KNIFE_MAX, Math.max(0, durability) + STONE_RESTORE);
}

export interface Strike {
  durability: number;
  damage: number;
  reach: number;
  cooldown: number;
  glanced: boolean;
}

/**
 * `roll` is 0–1. A glance connects and makes the sound, but deals no damage.
 * Sharpened Knife (a floor buff) treats the blade as sharp, halves wear, and adds 1 damage.
 * A pipe does not take an edge and does not gain that bonus.
 */
export function strike(input: {
  durability: number;
  weapon: MeleeWeapon;
  sharpened: boolean;
  roll: number;
}): Strike {
  if (input.weapon === 'pipe') {
    return { durability: input.durability, damage: 1, reach: 46, cooldown: 0.55, glanced: false };
  }
  const band = input.sharpened ? 'sharp' : knifeBand(input.durability);
  const wear = input.weapon === 'hatchet' ? 12 : 8;
  const next = Math.max(0, input.durability - (input.sharpened ? wear * 0.5 : wear));
  const whiff = band === 'sharp' ? 0 : band === 'worn' ? 0.28 : 0.55;
  const glanced = input.roll < whiff;
  const base = input.weapon === 'hatchet' ? 2 : 1;
  const bonus = input.sharpened ? 1 : 0;
  const dullPenalty = band === 'dull' && input.weapon === 'hatchet' ? 1 : 0;
  return {
    durability: next,
    damage: glanced ? 0 : Math.max(1, base + bonus - dullPenalty),
    reach: input.weapon === 'hatchet' ? 32 : 34,
    cooldown: band === 'dull' ? 0.58 : input.weapon === 'hatchet' ? 0.5 : 0.42,
    glanced,
  };
}
