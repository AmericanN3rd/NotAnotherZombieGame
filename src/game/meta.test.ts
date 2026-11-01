import { beforeEach, describe, expect, it } from 'vitest';
import { bonuses, buyStation, campTier, freshMeta, maxUnlockedFloor, migrateMeta, resetMeta, salvageFromClear, saveMeta, totalUpgradeCost, unlockedPowers } from './meta';
import { createRun } from './state';

describe('meta save', () => {
  beforeEach(() => {
    resetMeta();
  });

  it('starts bare and migrates a v0.2.0 world that had no meta blob', () => {
    expect(migrateMeta(null).salvage).toBe(0);
    expect(migrateMeta({}).stations.radio).toBe(0);
    const kept = migrateMeta({ version: 1, salvage: 12, stations: { radio: 2 }, bestFloor: 9, tutorialSeen: true });
    expect(kept.salvage).toBe(12);
    expect(kept.stations.radio).toBe(2);
    expect(kept.stations.workbench).toBe(0);
    expect(kept.version).toBe(1);
  });

  it('sells stations in order and gates the upper floors', () => {
    const meta = freshMeta();
    meta.salvage = 30;
    expect(maxUnlockedFloor(meta)).toBe(5);
    expect(buyStation(meta, 'radio').ok).toBe(true);
    expect(meta.salvage).toBe(16);
    expect(maxUnlockedFloor(meta)).toBe(8);
    expect(campTier(meta)).toBe(0);
    meta.stations.workbench = 3;
    meta.stations.armory = 3;
    meta.stations.infirmary = 3;
    meta.stations.radio = 3;
    expect(campTier(meta)).toBe(3);
    expect(maxUnlockedFloor(meta)).toBe(16);
    expect(buyStation(meta, 'radio').ok).toBe(false);
  });

  it('puts the bought kit on the next run and keeps a full camp under a few clears', () => {
    const meta = freshMeta();
    meta.stations.infirmary = 2;
    meta.stations.armory = 3;
    meta.stations.workbench = 2;
    saveMeta(meta);
    const run = createRun();
    expect(run.maxHp).toBe(bonuses(meta).maxHp);
    expect(run.magSize).toBe(8);
    expect(run.loadout.armor).toBe('jacket');
    expect(run.loadout.health).toBe('bandage');
    expect(run.loadout.helmet).toBe('helm');
    expect(run.wearScale).toBeLessThan(1);
    expect(run.reloadScale).toBeLessThan(1);
    const powers = unlockedPowers(meta);
    expect(powers).toContain('oil');
    expect(powers).toContain('flare');
    expect(powers).not.toContain('lucky');
    const perClear = [2, 3, 4, 5].reduce((sum, floor) => sum + salvageFromClear(floor), 0);
    expect(totalUpgradeCost()).toBeGreaterThan(perClear * 8);
    expect(totalUpgradeCost()).toBeLessThan(perClear * 16);
  });
});
