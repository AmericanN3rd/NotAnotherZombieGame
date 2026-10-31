import { AMMO_PACK } from './balance';
import type { RunState } from './state';

export type ItemId = 'ammo' | 'power' | 'compensator' | 'silencer';

export interface ShopItem {
  id: ItemId;
  name: string;
  detail: string;
  cost: number;
  repeatable: boolean;
}

export const SHOP_ITEMS: readonly ShopItem[] = [
  { id: 'ammo', name: 'Pistol rounds', detail: `+${AMMO_PACK} rounds`, cost: 8, repeatable: true },
  { id: 'compensator', name: 'Compensator', detail: 'Tighter shots, less kick', cost: 12, repeatable: false },
  { id: 'power', name: 'Power', detail: 'Shots hit harder', cost: 15, repeatable: false },
  { id: 'silencer', name: 'Silencer', detail: 'Gunshots carry a shorter way', cost: 18, repeatable: false },
];

export interface PurchaseResult {
  ok: boolean;
  reason?: string;
}

export function spentOn(run: RunState, floor: number): number {
  return run.spent[floor] ?? 0;
}

/**
 * Spend coins from the stub wallet into the current floor's cache.
 * Mutates `run` only when the purchase succeeds.
 */
export function attemptPurchase(run: RunState, itemId: ItemId, floorLimit: number): PurchaseResult {
  const item = SHOP_ITEMS.find((entry) => entry.id === itemId);
  if (!item) return { ok: false, reason: 'That slot is empty.' };
  if (!item.repeatable && item.id !== 'ammo' && run.owned[item.id]) {
    return { ok: false, reason: 'Already on the gun.' };
  }
  if (run.coins < item.cost) return { ok: false, reason: 'Not enough coins.' };
  const spent = spentOn(run, run.floor);
  if (spent + item.cost > floorLimit) {
    return { ok: false, reason: `This floor only gives ${floorLimit} coins of gear.` };
  }

  run.coins -= item.cost;
  run.spent[run.floor] = spent + item.cost;

  if (item.id === 'ammo') run.reserve += AMMO_PACK;
  if (item.id === 'power') {
    run.owned.power = true;
    run.gunDamage = 2;
  }
  if (item.id === 'compensator') run.owned.compensator = true;
  if (item.id === 'silencer') run.owned.silencer = true;
  return { ok: true };
}
