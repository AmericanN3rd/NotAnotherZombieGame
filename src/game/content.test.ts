import { describe, expect, it } from 'vitest';
import { generateFloor } from './generate';
import { equip, grantGear, incomingDamage, useHealthItem } from './gear';
import { hone, knifeBand, strike } from './knife';
import { lightsAfter, lightsBefore, noiseAfter, noiseBefore, sampleLights } from './hotpath';
import { canReachExit } from './reach';
import { RELOAD_DURATION, beginReload, idleReload, tickReload } from './reload';
import { attemptPurchase, offersFor } from './shop';
import { createRun } from './state';
import { STEADY_WINDOW } from './powerups';
import { powerPrice, stockPowers } from './powerups';

describe('knife', () => {
  it('stays keen, then glances, and a stone puts the edge back', () => {
    expect(knifeBand(100)).toBe('sharp');
    const sharp = strike({ durability: 100, weapon: 'knife', sharpened: false, roll: 0 });
    expect(sharp.damage).toBe(1);
    expect(sharp.glanced).toBe(false);
    expect(sharp.durability).toBe(92);

    const dull = strike({ durability: 20, weapon: 'knife', sharpened: false, roll: 0.1 });
    expect(dull.glanced).toBe(true);
    expect(dull.damage).toBe(0);

    expect(hone(20)).toBe(75);
    expect(knifeBand(hone(20))).toBe('sharp');
  });

  it('lets a pipe ignore wear and a sharpened knife hit harder', () => {
    const pipe = strike({ durability: 10, weapon: 'pipe', sharpened: false, roll: 0 });
    expect(pipe.durability).toBe(10);
    expect(pipe.reach).toBeGreaterThan(34);
    const keen = strike({ durability: 10, weapon: 'knife', sharpened: true, roll: 0 });
    expect(keen.damage).toBe(2);
    expect(keen.glanced).toBe(false);
  });
});

describe('vending powers', () => {
  it('stocks the same three powers for a seed and charges more upstairs', () => {
    const first = stockPowers(4, 42);
    expect(stockPowers(4, 42)).toEqual(first);
    expect(new Set(first).size).toBe(3);
    expect(stockPowers(9, 42)).not.toEqual(first);
    const id = first[0]!;
    expect(powerPrice(id, 12)).toBeGreaterThan(powerPrice(id, 1));
    const run = createRun();
    run.floor = 4;
    run.seed = 42;
    const powers = offersFor(run).filter((offer) => offer.group === 'power');
    expect(powers).toHaveLength(3);
    expect(offersFor(run).some((offer) => offer.id === 'ammo')).toBe(true);
    expect(offersFor(run).some((offer) => offer.id === 'stone')).toBe(true);
  });

  it('keeps the floor spend limit on a power and widens the reload window', () => {
    const run = createRun();
    run.floor = 1;
    run.coins = 80;
    expect(attemptPurchase(run, 'oil', 14).ok).toBe(true);
    expect(run.buffs.oil).toBe(true);
    const early = tickReload(beginReload(idleReload()), 0.05, true, { oil: true });
    expect(early.event).toBe('none');
    expect(early.state.phase).toBe('active');

    const steady = createRun();
    steady.floor = 1;
    steady.coins = 40;
    expect(attemptPurchase(steady, 'steady', 30).ok).toBe(true);
    const state = beginReload(idleReload());
    const at = (STEADY_WINDOW.start + 0.02) * RELOAD_DURATION;
    const primed = tickReload(state, at, false, { window: STEADY_WINDOW });
    expect(tickReload(primed.state, 0, true, { window: STEADY_WINDOW }).event).toBe('perfect');

    const poor = createRun();
    poor.floor = 1;
    poor.coins = 100;
    expect(attemptPurchase(poor, 'flare', 10).ok).toBe(false);
    expect(poor.buffs.flareShells).toBe(0);
  });
});

describe('equipment', () => {
  it('reduces a hit and spends a health item', () => {
    const run = createRun();
    grantGear(run, 'jacket');
    expect(equip(run, 'jacket').ok).toBe(true);
    expect(incomingDamage(2, run.loadout, 'bite', true, 0).damage).toBe(1);
    grantGear(run, 'visor');
    equip(run, 'visor');
    expect(incomingDamage(1, run.loadout, 'macaw', true, 0).damage).toBe(0);
    grantGear(run, 'bandage');
    equip(run, 'bandage');
    run.hp = 2;
    const used = useHealthItem(run);
    expect(used.ok).toBe(true);
    expect(run.hp).toBe(3);
    expect(run.loadout.health).toBeNull();
  });
});

describe('floors above 8', () => {
  it('keeps a path to the exit and gets harsher as you climb', () => {
    for (const floor of [9, 10, 12, 16]) {
      for (const seed of [1, 42, 99991]) {
        const level = generateFloor(floor, seed, []);
        expect(
          canReachExit({
            platforms: level.platforms,
            ladders: level.ladders,
            doors: level.doors,
            terminals: level.terminals,
            spawn: level.spawn,
            exits: level.exits,
          }),
        ).toBe(true);
        expect(level.theme === 'ward' || level.theme === 'machine').toBe(true);
      }
    }
    const mid = generateFloor(9, 42, []);
    const high = generateFloor(16, 42, []);
    expect(high.enemies.filter((enemy) => enemy.kind === 'undead').length).toBeGreaterThanOrEqual(
      mid.enemies.filter((enemy) => enemy.kind === 'undead').length,
    );
    expect(high.spendLimit).toBeLessThanOrEqual(mid.spendLimit);
    expect((high.steam?.length ?? 0) + high.signs.filter((sign) => /STEAM|GRATE|BULBS|WARD/.test(sign.text)).length).toBeGreaterThan(0);
  });
});

describe('hot paths', () => {
  it('redraws fewer lights and reuses noise', () => {
    const lights = sampleLights(80);
    const beforeL = lightsBefore(lights, 400);
    const afterL = lightsAfter(lights, 400);
    const beforeN = noiseBefore(400, 8000);
    const afterN = noiseAfter(400, 8000);
    expect(afterL).toBeLessThan(beforeL);
    expect(afterN).toBeLessThan(beforeN * 0.5);
  });
});
