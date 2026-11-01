import { MAG_SIZE, PLAYER_MAX_HP, START_RESERVE } from './balance';
import type { PowerId } from './powerups';

/**
 * Meta progress lives in localStorage under `nazg-meta`.
 * v0.2.0 never stored a run. Brightness, low effects, the intro flag, and a
 * locked seed stay in `nazg-settings` and are not wiped here.
 */
export const META_VERSION = 1;
export const META_KEY = 'nazg-meta';
export const STATION_MAX = 3;

export type StationId = 'workbench' | 'armory' | 'infirmary' | 'radio';

export const STATIONS: readonly StationId[] = ['workbench', 'armory', 'infirmary', 'radio'];

export interface Meta {
  version: number;
  salvage: number;
  stations: Record<StationId, number>;
  tutorialSeen: boolean;
  runs: number;
  bestFloor: number;
}

const COSTS: Record<StationId, readonly number[]> = {
  workbench: [8, 18, 32],
  armory: [10, 20, 36],
  infirmary: [12, 24, 40],
  radio: [14, 28, 48],
};

const NAMES: Record<StationId, string> = {
  workbench: 'Workbench',
  armory: 'Armory',
  infirmary: 'Infirmary',
  radio: 'Radio',
};

const NEXT: Record<StationId, readonly string[]> = {
  workbench: [
    'Reload is quicker, and the green band is wider. Gun Oil enters the caches.',
    'The knife holds an edge longer.',
    'Reload quickens again, and the band opens further.',
  ],
  armory: [
    'The magazine holds one more round, and you start with extra ammunition.',
    'You start the climb in a lined jacket. Hollow points and flare shells enter the caches.',
    'One more round in the magazine, a bandage on your belt, and a helm on your head.',
  ],
  infirmary: [
    'One more point of health. Adrenaline shots enter the caches.',
    'Another point of health.',
    'Another point of health.',
  ],
  radio: [
    'The climb can pass floor 5, up to 8. Birdseed and ferret bait enter the caches.',
    'The climb can pass floor 8, up to 12. Rubber soles enter the caches.',
    'The climb can reach the hatch on 16. Lucky coins enter the caches.',
  ],
};

export function freshMeta(): Meta {
  return {
    version: META_VERSION,
    salvage: 0,
    stations: { workbench: 0, armory: 0, infirmary: 0, radio: 0 },
    tutorialSeen: false,
    runs: 0,
    bestFloor: 1,
  };
}

function clampLevel(value: unknown): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : 0;
  return Math.max(0, Math.min(STATION_MAX, n));
}

function clampCount(value: unknown): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : 0;
  return Math.max(0, n);
}

/** Read any older blob. Unknown future fields are dropped; known numbers are kept. */
export function migrateMeta(raw: unknown): Meta {
  const next = freshMeta();
  if (!raw || typeof raw !== 'object') return next;
  const data = raw as Partial<Meta> & { stations?: Partial<Record<StationId, number>> };
  next.salvage = clampCount(data.salvage);
  next.tutorialSeen = Boolean(data.tutorialSeen);
  next.runs = clampCount(data.runs);
  next.bestFloor = Math.max(1, clampCount(data.bestFloor));
  for (const id of STATIONS) next.stations[id] = clampLevel(data.stations?.[id]);
  next.version = META_VERSION;
  return next;
}

export function loadMeta(): Meta {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return freshMeta();
    return migrateMeta(JSON.parse(raw) as unknown);
  } catch {
    return freshMeta();
  }
}

export function saveMeta(meta: Meta): void {
  meta.version = META_VERSION;
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    // Private mode or a full disk. The climb still runs; progress stays in memory.
  }
  current = meta;
}

let current = loadMeta();

export function metaState(): Meta {
  return current;
}

export function resetMeta(): Meta {
  current = freshMeta();
  saveMeta(current);
  return current;
}

export function addSalvage(amount: number): number {
  if (amount <= 0) return current.salvage;
  current.salvage += Math.floor(amount);
  saveMeta(current);
  return current.salvage;
}

export function stationName(id: StationId): string {
  return NAMES[id];
}

export function stationLevel(meta: Meta, id: StationId): number {
  return meta.stations[id];
}

export function nextCost(meta: Meta, id: StationId): number | null {
  const level = meta.stations[id];
  if (level >= STATION_MAX) return null;
  return COSTS[id][level] ?? null;
}

export function nextBlurb(id: StationId, level: number): string {
  if (level >= STATION_MAX) return 'Nothing left to bolt on.';
  return NEXT[id][level] ?? '';
}

export function buyStation(meta: Meta, id: StationId): { ok: boolean; reason?: string } {
  const cost = nextCost(meta, id);
  if (cost == null) return { ok: false, reason: 'Nothing left to bolt on.' };
  if (meta.salvage < cost) return { ok: false, reason: 'Not enough salvage.' };
  meta.salvage -= cost;
  meta.stations[id] += 1;
  saveMeta(meta);
  return { ok: true };
}

export function totalStationLevels(meta: Meta): number {
  return STATIONS.reduce((sum, id) => sum + meta.stations[id], 0);
}

/** 0 is a bare lobby. 3 is barricaded, lit, and patched. */
export function campTier(meta: Meta): 0 | 1 | 2 | 3 {
  const n = totalStationLevels(meta);
  if (n >= 9) return 3;
  if (n >= 6) return 2;
  if (n >= 3) return 1;
  return 0;
}

/** Radio level decides how far a climb may go. Floor 1 is the camp. */
export function maxUnlockedFloor(meta: Meta): number {
  const radio = meta.stations.radio;
  if (radio >= 3) return 16;
  if (radio >= 2) return 12;
  if (radio >= 1) return 8;
  return 5;
}

export function unlockedPowers(meta: Meta): PowerId[] {
  const ids: PowerId[] = ['steady', 'sharpened', 'hollow'];
  if (meta.stations.workbench >= 1) ids.push('oil');
  if (meta.stations.armory >= 2) ids.push('flare');
  if (meta.stations.infirmary >= 1) ids.push('adrenaline');
  if (meta.stations.radio >= 1) ids.push('birdseed', 'ferret');
  if (meta.stations.radio >= 2) ids.push('rubber');
  if (meta.stations.radio >= 3) ids.push('lucky');
  return ids;
}

export interface RunBonuses {
  maxHp: number;
  magSize: number;
  reserveBonus: number;
  reloadScale: number;
  windowWiden: number;
  wearScale: number;
  jacket: boolean;
  bandage: boolean;
  helm: boolean;
}

export function bonuses(meta: Meta): RunBonuses {
  const armory = meta.stations.armory;
  const workbench = meta.stations.workbench;
  return {
    maxHp: PLAYER_MAX_HP + meta.stations.infirmary,
    magSize: MAG_SIZE + (armory >= 1 ? 1 : 0) + (armory >= 3 ? 1 : 0),
    reserveBonus: armory >= 1 ? 4 : 0,
    reloadScale: 1 - 0.08 * workbench,
    windowWiden: 0.03 * workbench,
    wearScale: workbench >= 3 ? 0.55 : workbench >= 2 ? 0.75 : 1,
    jacket: armory >= 1,
    bandage: armory >= 2,
    helm: armory >= 3,
  };
}

export function salvageFromCoins(amount: number): number {
  return Math.max(0, Math.floor(amount));
}

export function salvageFromClear(floor: number): number {
  return 2 + Math.max(0, floor);
}

export const DEATH_PITY = 2;
export const HATCH_BONUS = 24;

export function widenedWindow(
  base: { start: number; end: number },
  widen: number,
): { start: number; end: number } {
  return {
    start: Math.max(0.15, base.start - widen),
    end: Math.min(0.96, base.end + widen),
  };
}

/** What a full set of stations costs. Used to keep the curve honest in tests. */
export function totalUpgradeCost(): number {
  return STATIONS.reduce((sum, id) => sum + COSTS[id].reduce((a, b) => a + b, 0), 0);
}

export function startingReserve(meta: Meta): number {
  return START_RESERVE + bonuses(meta).reserveBonus;
}
