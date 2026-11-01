import { describe, expect, it } from 'vitest';
import { generateFloor } from './generate';
import { canReachExit, platformLink } from './reach';
import { NOTE_POOL } from './notes';

const surface = 400;

describe('reachability', () => {
  it('allows a flat running jump and refuses a gulf', () => {
    const left = { x: 0, y: surface, w: 120, h: 40 };
    const close = { x: 180, y: surface, w: 120, h: 40 };
    const far = { x: 400, y: surface, w: 120, h: 40 };
    expect(platformLink(left, close)).toBe(true);
    expect(platformLink(left, far)).toBe(false);
  });

  it('requires the lock to be bypassed before the far side counts', () => {
    const blocked = canReachExit({
      platforms: [{ x: 0, y: surface, w: 400, h: 40 }],
      ladders: [],
      doors: [{ id: 'lock', x: 180, y: surface - 70, w: 18, h: 70 }],
      terminals: [],
      spawn: { x: 40, y: surface },
      exits: [{ x: 320, y: surface - 60, w: 60, h: 60 }],
    });
    const openable = canReachExit({
      platforms: [{ x: 0, y: surface, w: 400, h: 40 }],
      ladders: [],
      doors: [{ id: 'lock', x: 180, y: surface - 70, w: 18, h: 70 }],
      terminals: [{ doorId: 'lock', x: 80, y: surface }],
      spawn: { x: 40, y: surface },
      exits: [{ x: 320, y: surface - 60, w: 60, h: 60 }],
    });
    expect(blocked).toBe(false);
    expect(openable).toBe(true);
  });
});

describe('procedural floors 4–8', () => {
  const seeds = [1, 7, 42, 99, 256, 1024, 4096, 99991];

  it('builds a reachable floor for every seed and floor, with rising pressure', () => {
    for (const floor of [4, 5, 6, 7, 8]) {
      for (const seed of seeds) {
        const level = generateFloor(floor, seed, []);
        expect(level.builtSeed).toBeTypeOf('number');
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
        expect(level.enemies.length).toBeGreaterThan(0);
      }
    }
    const low = generateFloor(4, 42, []);
    const high = generateFloor(8, 42, []);
    const lowUndead = low.enemies.filter((enemy) => enemy.kind === 'undead').length;
    const highUndead = high.enemies.filter((enemy) => enemy.kind === 'undead').length;
    expect(highUndead).toBeGreaterThanOrEqual(lowUndead);
    expect(high.spikes.length + high.pits.length).toBeGreaterThan(low.spikes.length + low.pits.length - 1);
    expect(high.medkits.length).toBeLessThanOrEqual(low.medkits.length);
  });

  it('keeps floor 6 skippable and puts the wager off the only path', () => {
    for (const seed of seeds) {
      const level = generateFloor(6, seed, []);
      expect(level.challenge).toBeTruthy();
      const deck = level.challenge!.y;
      const main = level.platforms.filter((platform) => platform.y <= deck + 24);
      const shaftLadders = level.ladders.filter((ladder) => ladder.y + ladder.h <= deck + 40);
      expect(
        canReachExit({
          platforms: main,
          ladders: shaftLadders,
          doors: level.doors,
          terminals: level.terminals,
          spawn: level.spawn,
          exits: level.exits,
        }),
        `seed ${seed}`,
      ).toBe(true);
    }
  });

  it('does not repeat survivor notes', () => {
    const first = generateFloor(4, 3, []);
    const ids = first.notes.map((note) => note.id);
    const second = generateFloor(5, 3, ids);
    for (const note of second.notes) expect(ids).not.toContain(note.id);
    const drained = generateFloor(8, 3, NOTE_POOL.map((note) => note.id));
    expect(drained.notes).toHaveLength(0);
  });
});
