import { AMMO_PACK } from './balance';
import { hone } from './knife';
import {
  ADRENALINE_TIME,
  BIRD_DISTRACT,
  FERRET_DISTRACT,
  isPowerId,
  powerDef,
  powerPrice,
  stockPowers,
  type PowerId,
} from './powerups';
import type { RunState } from './state';

export type ClassicId = 'ammo' | 'power' | 'compensator' | 'silencer' | 'stone';
export type ItemId = ClassicId | PowerId;

export interface ShopItem {
  id: ClassicId;
  name: string;
  detail: string;
  cost: number;
  repeatable: boolean;
}

export const SHOP_ITEMS: readonly ShopItem[] = [
  { id: 'ammo', name: 'Pistol rounds', detail: `+${AMMO_PACK} rounds`, cost: 8, repeatable: true },
  { id: 'stone', name: 'Sharpening stone', detail: 'Puts an edge back on the knife', cost: 6, repeatable: true },
  { id: 'compensator', name: 'Compensator', detail: 'Tighter shots, less kick', cost: 12, repeatable: false },
  { id: 'power', name: 'Power', detail: 'Shots hit harder', cost: 15, repeatable: false },
  { id: 'silencer', name: 'Silencer', detail: 'Gunshots carry a shorter way', cost: 18, repeatable: false },
];

export interface Offer {
  id: ItemId;
  name: string;
  detail: string;
  cost: number;
  owned: boolean;
  group: 'staple' | 'power' | 'gun';
}

export interface PurchaseResult {
  ok: boolean;
  reason?: string;
}

export function spentOn(run: RunState, floor: number): number {
  return run.spent[floor] ?? 0;
}

const GUN_PARTS = new Set<ClassicId>(['power', 'compensator', 'silencer']);

/** Staples, up to three seeded powers the camp has heard of, then unowned gun parts. */
export function offersFor(run: RunState, unlocked?: readonly PowerId[]): Offer[] {
  const floor = run.floor;
  const offers: Offer[] = [];
  for (const item of SHOP_ITEMS) {
    if (item.id !== 'ammo' && item.id !== 'stone') continue;
    offers.push({ ...item, owned: false, group: 'staple' });
  }
  for (const id of stockPowers(floor, run.seed, unlocked)) {
    const def = powerDef(id);
    offers.push({
      id,
      name: def.name,
      detail: def.detail,
      cost: powerPrice(id, floor),
      owned: false,
      group: 'power',
    });
  }
  for (const item of SHOP_ITEMS) {
    if (!GUN_PARTS.has(item.id)) continue;
    const owned = run.owned[item.id as 'power' | 'compensator' | 'silencer'];
    if (owned) continue;
    offers.push({ ...item, owned: false, group: 'gun' });
  }
  return offers;
}

function pay(run: RunState, cost: number, floorLimit: number): PurchaseResult | null {
  if (run.coins < cost) return { ok: false, reason: 'Not enough coins.' };
  const spent = spentOn(run, run.floor);
  if (spent + cost > floorLimit) {
    return { ok: false, reason: `This floor only gives ${floorLimit} coins of gear.` };
  }
  run.coins -= cost;
  run.spent[run.floor] = spent + cost;
  return null;
}

function applyPower(run: RunState, id: PowerId): void {
  if (id === 'steady') run.buffs.steady = true;
  if (id === 'oil') run.buffs.oil = true;
  if (id === 'hollow') run.buffs.hollow = true;
  if (id === 'sharpened') run.buffs.sharpened = true;
  if (id === 'rubber') run.buffs.rubber = true;
  if (id === 'birdseed') run.buffs.birdseed = BIRD_DISTRACT;
  if (id === 'ferret') run.buffs.ferret = FERRET_DISTRACT;
  if (id === 'adrenaline') {
    run.hp = Math.min(run.maxHp, run.hp + 2);
    run.buffs.adrenaline = ADRENALINE_TIME;
  }
  if (id === 'flare') run.buffs.flareShells += 1;
  if (id === 'lucky') run.buffs.lucky += 1;
}

/**
 * Spend coins from the stub wallet into the current floor's cache.
 * Mutates `run` only when the purchase succeeds.
 */
export function attemptPurchase(run: RunState, itemId: ItemId, floorLimit: number): PurchaseResult {
  if (isPowerId(itemId)) {
    const cost = powerPrice(itemId, run.floor);
    const refused = pay(run, cost, floorLimit);
    if (refused) return refused;
    applyPower(run, itemId);
    return { ok: true };
  }

  const item = SHOP_ITEMS.find((entry) => entry.id === itemId);
  if (!item) return { ok: false, reason: 'That slot is empty.' };
  if (!item.repeatable && item.id !== 'ammo' && item.id !== 'stone' && run.owned[item.id as 'power']) {
    return { ok: false, reason: 'Already on the gun.' };
  }
  if (item.id === 'power' && run.owned.power) return { ok: false, reason: 'Already on the gun.' };
  if (item.id === 'compensator' && run.owned.compensator) return { ok: false, reason: 'Already on the gun.' };
  if (item.id === 'silencer' && run.owned.silencer) return { ok: false, reason: 'Already on the gun.' };

  const refused = pay(run, item.cost, floorLimit);
  if (refused) return refused;

  if (item.id === 'ammo') run.reserve += AMMO_PACK;
  if (item.id === 'stone') run.knife = hone(run.knife);
  if (item.id === 'power') {
    run.owned.power = true;
    run.gunDamage = 2;
  }
  if (item.id === 'compensator') run.owned.compensator = true;
  if (item.id === 'silencer') run.owned.silencer = true;
  return { ok: true };
}
