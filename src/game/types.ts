export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type EnemyKind = 'undead' | 'ferret' | 'macaw';

export interface EnemySpec {
  kind: EnemyKind;
  x: number;
  y: number;
  minX: number;
  maxX: number;
  /** Slumped until a gunshot, a screech, or a door opens. */
  dormant?: boolean;
  behindDoor?: string;
  leash?: number;
  /** Extra hit points on later floors. */
  bonusHp?: number;
}

export interface NoteSpec {
  id: string;
  x: number;
  y: number;
  text: string;
}

export interface CoinSpec {
  x: number;
  y: number;
  amount: number;
}

export interface MedkitSpec {
  x: number;
  y: number;
  heal: number;
}

export interface TerminalSpec {
  id: string;
  doorId: string;
  x: number;
  y: number;
}

export interface DoorSpec {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SignSpec {
  x: number;
  y: number;
  text: string;
}

export interface LightSpec {
  x: number;
  y: number;
  color: number;
  radius: number;
  flicker?: boolean;
  /** A bulb that is still in the ceiling and does not light. */
  dead?: boolean;
}

export interface LevelData {
  id: number;
  name: string;
  enter: string;
  width: number;
  height: number;
  spawn: { x: number; y: number };
  /** How many coins the vending machine on this floor will accept. */
  spendLimit: number;
  platforms: Rect[];
  walls: Rect[];
  ladders: Rect[];
  spikes: Rect[];
  pits: Rect[];
  crumble: Rect | null;
  notes: NoteSpec[];
  coins: CoinSpec[];
  medkits: MedkitSpec[];
  shop: { x: number; y: number } | null;
  terminals: TerminalSpec[];
  doors: DoorSpec[];
  signs: SignSpec[];
  lights: LightSpec[];
  enemies: EnemySpec[];
  checkpoints: { x: number; y: number }[];
  /** Every rect sends the player up a floor. Floor 2 has one per route. */
  exits: Rect[];
  /** Floor 6 wager machine. The stairs up do not go through it. */
  challenge?: { x: number; y: number } | null;
  /** Seed that actually built a procedural floor, after any retry. */
  builtSeed?: number;
}
