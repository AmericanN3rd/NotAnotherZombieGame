import { MAG_SIZE, PLAYER_MAX_HP, START_COINS, START_MAG, START_RESERVE } from './balance';
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
  /** Requested procedural seed. Floors 4–8 may retry upward if a layout fails. */
  seed: number;
  builtSeed?: number;
}

export function createRun(): RunState {
  return {
    started: false,
    floor: 1,
    hp: PLAYER_MAX_HP,
    maxHp: PLAYER_MAX_HP,
    coins: START_COINS,
    mag: START_MAG,
    reserve: START_RESERVE,
    magSize: MAG_SIZE,
    gunDamage: 1,
    owned: { power: false, compensator: false, silencer: false },
    notes: [],
    spent: {},
    checkpoint: { floor: 1, x: 100, y: 400 },
    crumbled: false,
    reloadTaught: false,
    gearWarned: {},
    seed: settings.seed ?? Math.floor(Math.random() * 900000) + 1,
  };
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
