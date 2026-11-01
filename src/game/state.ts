import { MAG_SIZE, START_COINS, START_MAG, START_RESERVE } from './balance';
import { emptyLoadout, type GearCarrier, type GearId, type Loadout } from './gear';
import { KNIFE_MAX } from './knife';
import { bonuses, metaState } from './meta';
import { emptyBuffs, type Buffs } from './powerups';
import { settings } from './settings';

export interface OwnedUpgrades {
  power: boolean;
  compensator: boolean;
  silencer: boolean;
}

export interface EchoNote {
  id: string;
  text: string;
  floor: number;
}

export interface Checkpoint {
  floor: number;
  x: number;
  y: number;
}

export interface RunState {
  started: boolean;
  floor: number;
  hp: number;
  maxHp: number;
  coins: number;
  mag: number;
  reserve: number;
  magSize: number;
  gunDamage: number;
  owned: OwnedUpgrades;
  notes: EchoNote[];
  /** Coins already paid into each floor's vending cache. */
  spent: Record<number, number>;
  checkpoint: Checkpoint;
  crumbled: boolean;
  reloadTaught: boolean;
  gearWarned: Record<number, boolean>;
  /** Requested procedural seed. Floors 4 and up may retry upward if a layout fails. */
  seed: number;
  builtSeed?: number;
  /** 0 is a ruined edge, 100 is fresh. */
  knife: number;
  bag: Partial<Record<GearId, number>>;
  loadout: Loadout;
  buffs: Buffs;
  /** Workbench: 1 is the stock reload, lower is faster. */
  reloadScale: number;
  /** Added to both sides of the active-reload window. */
  windowWiden: number;
  /** Multiplier on knife wear. */
  wearScale: number;
  /** Salvage pocketed during this climb. Already added to the meta wallet. */
  salvageEarned: number;
}

export function createRun(): RunState {
  const bonus = bonuses(metaState());
  const loadout = emptyLoadout();
  if (bonus.jacket) loadout.armor = 'jacket';
  if (bonus.bandage) loadout.health = 'bandage';
  if (bonus.helm) loadout.helmet = 'helm';
  return {
    started: false,
    floor: 1,
    hp: bonus.maxHp,
    maxHp: bonus.maxHp,
    coins: START_COINS,
    mag: Math.min(bonus.magSize, START_MAG + (bonus.magSize - MAG_SIZE)),
    reserve: START_RESERVE + bonus.reserveBonus,
    magSize: bonus.magSize,
    gunDamage: 1,
    owned: { power: false, compensator: false, silencer: false },
    notes: [],
    spent: {},
    checkpoint: { floor: 1, x: 100, y: 400 },
    crumbled: false,
    reloadTaught: false,
    gearWarned: {},
    seed: settings.seed ?? Math.floor(Math.random() * 900000) + 1,
    knife: KNIFE_MAX,
    bag: {},
    loadout,
    buffs: emptyBuffs(),
    reloadScale: bonus.reloadScale,
    windowWiden: bonus.windowWiden,
    wearScale: bonus.wearScale,
    salvageEarned: 0,
  };
}

export function asCarrier(run: RunState): GearCarrier {
  return run;
}

/** 1 with the starting kit, plus one for each installed gun upgrade. */
export function gearLevel(run: RunState): number {
  return 1 + Number(run.owned.power) + Number(run.owned.compensator) + Number(run.owned.silencer);
}

export function noiseRadius(run: RunState): number {
  return run.owned.silencer ? 64 : 280;
}

export function bulletSpread(run: RunState): number {
  return run.owned.compensator ? 0.018 : 0.1;
}

export function recoilScale(run: RunState): number {
  return run.owned.compensator ? 0.22 : 1;
}
