import { mulberry32 } from './rng';

/**
 * Floor buffs sold by the vending cache. Three of these are stocked per floor,
 * chosen from the climb seed. Prices climb with the floor. They leave when you
 * take the stairs, except Lucky Coin charges and unused Flare Shells.
 */
export type PowerId =
  | 'steady'
  | 'oil'
  | 'hollow'
  | 'sharpened'
  | 'rubber'
  | 'birdseed'
  | 'ferret'
  | 'adrenaline'
  | 'flare'
  | 'lucky';

export interface PowerDef {
  id: PowerId;
  name: string;
  detail: string;
  base: number;
}

export const POWERS: readonly PowerDef[] = [
  { id: 'steady', name: 'Steady Hands', detail: 'The reload window is wider on this floor.', base: 10 },
  { id: 'oil', name: 'Gun Oil', detail: 'A bad reload tap will not jam the gun on this floor.', base: 14 },
  { id: 'hollow', name: 'Hollow Points', detail: 'Shots deal one more damage on this floor.', base: 16 },
  { id: 'sharpened', name: 'Sharpened Knife', detail: 'The blade stays keen and hits harder on this floor.', base: 12 },
  { id: 'rubber', name: 'Rubber Soles', detail: 'Hard landings stay quiet on this floor.', base: 11 },
  { id: 'birdseed', name: 'Birdseed', detail: 'Macaws ignore you for a short while.', base: 9 },
  { id: 'ferret', name: 'Ferret Bait', detail: 'Ferrets lose interest for a short while.', base: 9 },
  { id: 'adrenaline', name: 'Adrenaline Shot', detail: 'Heal 2 and move faster for a few seconds.', base: 13 },
  { id: 'flare', name: 'Flare Shell', detail: 'One flare. It stuns whatever is close. Kept until you fire it.', base: 18 },
  { id: 'lucky', name: 'Lucky Coin', detail: 'The next hit that would land does not. Kept until it spends.', base: 8 },
];

export const POWER_IDS = POWERS.map((entry) => entry.id);

export function isPowerId(id: string): id is PowerId {
  return (POWER_IDS as string[]).includes(id);
}

export function powerDef(id: PowerId): PowerDef {
  const found = POWERS.find((entry) => entry.id === id);
  if (!found) throw new Error(`Unknown power ${id}`);
  return found;
}

/** About +12% per floor above the first. */
export function powerPrice(id: PowerId, floor: number): number {
  const base = powerDef(id).base;
  const scaled = Math.round(base * (1 + Math.max(0, floor - 1) * 0.12));
  return Math.max(base, scaled);
}

/** Stable three-item stock for a floor. The same seed always fills the same slots. */
export function stockPowers(floor: number, seed: number): [PowerId, PowerId, PowerId] {
  const rng = mulberry32((Math.imul(seed, 997) + Math.imul(floor, 131)) >>> 0);
  const bag = [...POWER_IDS];
  const picked: PowerId[] = [];
  while (picked.length < 3) {
    const index = Math.floor(rng() * bag.length);
    const [id] = bag.splice(index, 1);
    if (id) picked.push(id);
  }
  return [picked[0]!, picked[1]!, picked[2]!];
}

export interface Buffs {
  steady: boolean;
  oil: boolean;
  hollow: boolean;
  sharpened: boolean;
  rubber: boolean;
  /** Seconds of distraction left. Applied to the matching animals when bought. */
  birdseed: number;
  ferret: number;
  adrenaline: number;
  flareShells: number;
  lucky: number;
}

export function emptyBuffs(): Buffs {
  return {
    steady: false,
    oil: false,
    hollow: false,
    sharpened: false,
    rubber: false,
    birdseed: 0,
    ferret: 0,
    adrenaline: 0,
    flareShells: 0,
    lucky: 0,
  };
}

/** Drop everything that was only for the floor you are leaving. */
export function clearFloorBuffs(buffs: Buffs): void {
  buffs.steady = false;
  buffs.oil = false;
  buffs.hollow = false;
  buffs.sharpened = false;
  buffs.rubber = false;
  buffs.birdseed = 0;
  buffs.ferret = 0;
  buffs.adrenaline = 0;
}

export const STEADY_WINDOW = { start: 0.42, end: 0.94 };
export const BIRD_DISTRACT = 12;
export const FERRET_DISTRACT = 12;
export const ADRENALINE_TIME = 8;
