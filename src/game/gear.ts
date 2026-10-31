import { PLAYER_MAX_HP } from './balance';

export type Slot = 'helmet' | 'armor' | 'weapon' | 'health';

export type GearId =
  | 'cloth'
  | 'helm'
  | 'visor'
  | 'jacket'
  | 'vest'
  | 'plate'
  | 'hatchet'
  | 'pipe'
  | 'bandage'
  | 'stim'
  | 'kit';

export interface GearDef {
  id: GearId;
  slot: Slot;
  name: string;
  detail: string;
}

export const GEAR: readonly GearDef[] = [
  { id: 'cloth', slot: 'helmet', name: 'Cloth wrap', detail: 'A hit shakes you less. I-frames last longer.' },
  { id: 'helm', slot: 'helmet', name: 'Scavenged helm', detail: 'Once every few seconds, a hit loses a point of damage.' },
  { id: 'visor', slot: 'helmet', name: 'Riot visor', detail: 'A macaw cannot hurt you.' },
  { id: 'jacket', slot: 'armor', name: 'Lined jacket', detail: 'Hits deal 1 less damage, and still at least 1.' },
  { id: 'vest', slot: 'armor', name: 'Trauma vest', detail: 'One more point of health while it is on.' },
  { id: 'plate', slot: 'armor', name: 'Scrap plate', detail: 'Hits deal 1 less damage. You run a little slower.' },
  { id: 'hatchet', slot: 'weapon', name: 'Hatchet', detail: 'Hits harder and dulls faster than the knife.' },
  { id: 'pipe', slot: 'weapon', name: 'Pipe', detail: 'Longer reach. It does not take an edge.' },
  { id: 'bandage', slot: 'health', name: 'Bandage', detail: 'Use it to heal 1.' },
  { id: 'stim', slot: 'health', name: 'Stim', detail: 'Use it to heal 2 and sprint for a moment.' },
  { id: 'kit', slot: 'health', name: 'Field kit', detail: 'Use it to heal 3.' },
];

export const GEAR_IDS = GEAR.map((entry) => entry.id);

export function gearDef(id: GearId): GearDef {
  const found = GEAR.find((entry) => entry.id === id);
  if (!found) throw new Error(`Unknown gear ${id}`);
  return found;
}

export interface Loadout {
  helmet: GearId | null;
  armor: GearId | null;
  weapon: GearId | null;
  health: GearId | null;
}

/** A null weapon is the starting knife. Found weapons replace it. */
export function emptyLoadout(): Loadout {
  return { helmet: null, armor: null, weapon: null, health: null };
}

export interface GearCarrier {
  hp: number;
  maxHp: number;
  bag: Partial<Record<GearId, number>>;
  loadout: Loadout;
}

export function maxHpFor(loadout: Loadout): number {
  return PLAYER_MAX_HP + (loadout.armor === 'vest' ? 1 : 0);
}

export function syncVitals(carrier: GearCarrier): void {
  const next = maxHpFor(carrier.loadout);
  if (next > carrier.maxHp) carrier.hp += next - carrier.maxHp;
  carrier.maxHp = next;
  if (carrier.hp > carrier.maxHp) carrier.hp = carrier.maxHp;
}

export function grantGear(carrier: GearCarrier, id: GearId): void {
  carrier.bag[id] = (carrier.bag[id] ?? 0) + 1;
}

export function equip(carrier: GearCarrier, id: GearId): { ok: boolean; reason?: string } {
  const item = gearDef(id);
  const have = carrier.bag[id] ?? 0;
  if (have <= 0) return { ok: false, reason: 'It is not in the bag.' };
  carrier.bag[id] = have - 1;
  if (carrier.bag[id] === 0) delete carrier.bag[id];
  const prev = carrier.loadout[item.slot];
  if (prev && prev !== id) carrier.bag[prev] = (carrier.bag[prev] ?? 0) + 1;
  carrier.loadout[item.slot] = id;
  syncVitals(carrier);
  return { ok: true };
}

export function clearSlot(carrier: GearCarrier, slot: Slot): void {
  const prev = carrier.loadout[slot];
  if (!prev) return;
  carrier.bag[prev] = (carrier.bag[prev] ?? 0) + 1;
  carrier.loadout[slot] = null;
  syncVitals(carrier);
}

export interface HealthUse {
  ok: boolean;
  heal: number;
  sprint: number;
  reason?: string;
}

export function useHealthItem(carrier: GearCarrier): HealthUse {
  const id = carrier.loadout.health;
  if (!id) return { ok: false, heal: 0, sprint: 0, reason: 'Nothing in the health slot.' };
  const heal = id === 'bandage' ? 1 : id === 'stim' ? 2 : 3;
  const sprint = id === 'stim' ? 4 : 0;
  const spare = carrier.bag[id] ?? 0;
  if (spare > 0) {
    carrier.bag[id] = spare - 1;
    if (carrier.bag[id] === 0) delete carrier.bag[id];
  } else {
    carrier.loadout.health = null;
  }
  carrier.hp = Math.min(carrier.maxHp, carrier.hp + heal);
  return { ok: true, heal, sprint };
}

export type HitSource = 'bite' | 'macaw' | 'hazard';

export function incomingDamage(
  amount: number,
  loadout: Loadout,
  source: HitSource,
  helmReady: boolean,
  lucky: number,
): { damage: number; helmUsed: boolean; luckyUsed: boolean } {
  if (lucky > 0) return { damage: 0, helmUsed: false, luckyUsed: true };
  let damage = amount;
  let helmUsed = false;
  if (loadout.helmet === 'visor' && source === 'macaw') damage = 0;
  if (loadout.helmet === 'helm' && helmReady && damage > 0) {
    damage = Math.max(0, damage - 1);
    helmUsed = true;
  }
  if ((loadout.armor === 'jacket' || loadout.armor === 'plate') && damage > 0) {
    damage = Math.max(1, damage - 1);
  }
  return { damage, helmUsed, luckyUsed: false };
}

export function iframeBonus(loadout: Loadout): number {
  return loadout.helmet === 'cloth' ? 0.35 : 0;
}

export function speedScale(loadout: Loadout, adrenaline: number): number {
  let scale = adrenaline > 0 ? 1.28 : 1;
  if (loadout.armor === 'plate') scale *= 0.88;
  return scale;
}

export function slotLabel(loadout: Loadout, slot: Slot): string {
  const id = loadout[slot];
  if (slot === 'weapon' && !id) return 'Knife';
  if (!id) return 'Empty';
  return gearDef(id).name;
}
