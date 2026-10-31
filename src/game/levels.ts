import { FLOOR_1_SPEND_LIMIT } from './balance';
import { generateFloor } from './generate';
import type { LevelData, Rect } from './types';

function stair(x: number, top: number, w: number, bottom: number): Rect {
  return { x, y: top, w, h: bottom - top };
}

const floor1 = (): LevelData => ({
  id: 1,
  name: 'Floor 1',
  enter: 'Quiet',
  width: 2400,
  height: 520,
  spawn: { x: 100, y: 400 },
  spendLimit: FLOOR_1_SPEND_LIMIT,
  platforms: [
    { x: 0, y: 400, w: 2060, h: 120 },
    { x: 300, y: 340, w: 96, h: 16 },
    { x: 540, y: 300, w: 170, h: 20 },
    { x: 760, y: 248, w: 240, h: 18 },
    { x: 1280, y: 250, w: 300, h: 16 },
    stair(2040, 384, 56, 520),
    stair(2080, 368, 56, 520),
    stair(2120, 352, 56, 520),
    stair(2160, 336, 56, 520),
    stair(2200, 320, 56, 520),
    stair(2240, 304, 60, 520),
    { x: 2288, y: 304, w: 112, h: 216 },
  ],
  walls: [
    { x: 1280, y: 148, w: 14, h: 102 },
    { x: 1566, y: 148, w: 14, h: 102 },
    { x: 1280, y: 148, w: 300, h: 12 },
  ],
  ladders: [],
  spikes: [],
  pits: [],
  crumble: null,
  notes: [
    { id: 'f1-inside', x: 470, y: 400, text: "they're inside, be careful." },
    { id: 'f1-wake', x: 860, y: 248, text: "I can't wake up." },
    { id: 'f1-coins', x: 1620, y: 400, text: 'The machine still takes coins. I never see who fills it.' },
  ],
  coins: [
    { x: 348, y: 340, amount: 3 },
    { x: 610, y: 300, amount: 4 },
  ],
  medkits: [],
  shop: { x: 1848, y: 400 },
  terminals: [],
  doors: [],
  signs: [
    { x: 1430, y: 138, text: 'WARD — DO NOT WAKE' },
    { x: 1864, y: 330, text: 'SUPPLY' },
    { x: 2140, y: 360, text: 'STAIRWELL' },
  ],
  lights: [
    { x: 180, y: 250, color: 0xc4b49a, radius: 150 },
    { x: 700, y: 180, color: 0xc4b49a, radius: 130 },
    { x: 1340, y: 200, color: 0x8f2d2d, radius: 90, flicker: true },
    { x: 1860, y: 300, color: 0xd7a15f, radius: 120 },
    { x: 2320, y: 220, color: 0xc4b49a, radius: 110 },
  ],
  enemies: [{ kind: 'undead', x: 1420, y: 250, minX: 1310, maxX: 1548, dormant: true, leash: 150 }],
  checkpoints: [
    { x: 100, y: 400 },
    { x: 1960, y: 400 },
    { x: 2320, y: 304 },
  ],
  exits: [{ x: 2310, y: 230, w: 80, h: 74 }],
});

const floor2 = (): LevelData => ({
  id: 2,
  name: 'Floor 2',
  enter: 'Two ways up',
  width: 3000,
  height: 700,
  spawn: { x: 2860, y: 520 },
  spendLimit: 24,
  platforms: [
    { x: 0, y: 520, w: 656, h: 180 },
    { x: 720, y: 520, w: 396, h: 180 },
    { x: 1180, y: 520, w: 516, h: 180 },
    { x: 1760, y: 520, w: 396, h: 180 },
    { x: 2220, y: 520, w: 780, h: 180 },
    { x: 200, y: 320, w: 2300, h: 22 },
    { x: 250, y: 236, w: 2000, h: 32 },
    { x: 2660, y: 468, w: 160, h: 22 },
    { x: 2500, y: 396, w: 150, h: 22 },
    { x: 2360, y: 320, w: 170, h: 22 },
    stair(220, 504, 56, 700),
    stair(176, 488, 56, 700),
    stair(132, 472, 56, 700),
    stair(88, 456, 60, 700),
    { x: 16, y: 456, w: 84, h: 244 },
    { x: 0, y: 360, w: 230, h: 22 },
    stair(168, 304, 56, 340),
    stair(128, 288, 56, 330),
    stair(88, 272, 56, 320),
    stair(48, 256, 56, 310),
    { x: 12, y: 256, w: 48, h: 70 },
  ],
  walls: [],
  ladders: [],
  spikes: [
    { x: 1380, y: 496, w: 130, h: 26 },
    { x: 1880, y: 496, w: 110, h: 26 },
  ],
  pits: [
    { x: 656, y: 548, w: 64, h: 150 },
    { x: 1116, y: 548, w: 64, h: 150 },
    { x: 1696, y: 548, w: 64, h: 150 },
    { x: 2156, y: 548, w: 64, h: 150 },
  ],
  crumble: null,
  notes: [
    { id: 'f2-vent', x: 1500, y: 320, text: 'The vent is faster. I heard them moving behind the lock.' },
    { id: 'f2-opened', x: 250, y: 320, text: "I opened it. I shouldn't have opened it." },
    { id: 'f2-spikes', x: 1460, y: 520, text: "Spikes don't get tired." },
  ],
  coins: [
    { x: 1560, y: 520, amount: 4 },
    { x: 1760, y: 320, amount: 2 },
  ],
  medkits: [{ x: 980, y: 520, heal: 2 }],
  shop: null,
  terminals: [{ id: 'term-lock', doorId: 'lock', x: 530, y: 320 }],
  doors: [{ id: 'lock', x: 468, y: 250, w: 18, h: 70 }],
  signs: [
    { x: 2700, y: 500, text: 'VENT ↑  faster' },
    { x: 2420, y: 500, text: '← long way, nothing walks' },
    { x: 560, y: 292, text: 'LOCK — HOLD TO BYPASS' },
    { x: 70, y: 430, text: 'STAIRWELL' },
    { x: 70, y: 236, text: 'STAIRWELL' },
  ],
  lights: [
    { x: 2860, y: 430, color: 0xc4b49a, radius: 120 },
    { x: 1600, y: 200, color: 0x6a7384, radius: 80 },
    { x: 360, y: 250, color: 0x8f2d2d, radius: 110, flicker: true },
    { x: 80, y: 400, color: 0xc4b49a, radius: 90 },
    { x: 1400, y: 430, color: 0x8f2d2d, radius: 70, flicker: true },
  ],
  enemies: [
    { kind: 'undead', x: 280, y: 320, minX: 230, maxX: 440, dormant: true, behindDoor: 'lock', leash: 210 },
    { kind: 'undead', x: 370, y: 320, minX: 250, maxX: 450, dormant: true, behindDoor: 'lock', leash: 210 },
    { kind: 'ferret', x: 320, y: 320, minX: 230, maxX: 450, dormant: true, behindDoor: 'lock', leash: 190 },
  ],
  checkpoints: [
    { x: 2860, y: 520 },
    { x: 1500, y: 520 },
    { x: 48, y: 456 },
    { x: 860, y: 320 },
    { x: 36, y: 256 },
  ],
  exits: [
    { x: 18, y: 420, w: 100, h: 46 },
    { x: 12, y: 176, w: 80, h: 84 },
  ],
});

const floor3 = (): LevelData => ({
  id: 3,
  name: 'Floor 3',
  enter: 'Hollow floors',
  width: 2600,
  height: 1180,
  spawn: { x: 110, y: 640 },
  spendLimit: 24,
  platforms: [
    { x: 0, y: 1000, w: 2600, h: 180 },
    { x: 0, y: 640, w: 1120, h: 48 },
    { x: 1580, y: 640, w: 1020, h: 48 },
    { x: 500, y: 500, w: 210, h: 20 },
    { x: 1880, y: 450, w: 680, h: 24 },
    { x: 2140, y: 270, w: 460, h: 24 },
  ],
  walls: [],
  ladders: [
    { x: 548, y: 468, w: 44, h: 190 },
    { x: 1668, y: 608, w: 48, h: 410 },
    { x: 1908, y: 418, w: 44, h: 250 },
    { x: 2188, y: 238, w: 44, h: 230 },
  ],
  spikes: [
    { x: 340, y: 614, w: 150, h: 28 },
    { x: 2240, y: 614, w: 130, h: 28 },
    { x: 40, y: 974, w: 240, h: 28 },
  ],
  pits: [],
  crumble: { x: 1120, y: 640, w: 460, h: 26 },
  notes: [
    { id: 'f3-hollow', x: 210, y: 640, text: 'This stretch of floor sounds hollow.' },
    { id: 'f3-up', x: 620, y: 500, text: 'Up is the only way that still opens.' },
    { id: 'f3-fall', x: 1360, y: 1000, text: 'I fell and kept the gun. Small mercy.' },
    { id: 'f3-birds', x: 2080, y: 450, text: "I can't tell if the birds are warning me or calling them." },
    { id: 'f3-answer', x: 2340, y: 270, text: "Something upstairs keeps answering. I hope it isn't me." },
  ],
  coins: [{ x: 1460, y: 1000, amount: 6 }],
  medkits: [
    { x: 680, y: 500, heal: 2 },
    { x: 2460, y: 270, heal: 2 },
  ],
  shop: null,
  terminals: [],
  doors: [],
  signs: [
    { x: 600, y: 478, text: 'LADDER' },
    { x: 1280, y: 610, text: 'HOLLOW' },
    { x: 1692, y: 960, text: 'CLIMB' },
    { x: 2400, y: 248, text: 'ROOF ACCESS' },
  ],
  lights: [
    { x: 200, y: 520, color: 0x8f2d2d, radius: 120, flicker: true },
    { x: 900, y: 520, color: 0x6a7384, radius: 100 },
    { x: 1360, y: 860, color: 0x8f2d2d, radius: 140, flicker: true },
    { x: 2100, y: 520, color: 0x8f2d2d, radius: 110, flicker: true },
    { x: 2360, y: 200, color: 0xc4b49a, radius: 120 },
  ],
  enemies: [
    { kind: 'undead', x: 720, y: 640, minX: 560, maxX: 880 },
    { kind: 'undead', x: 990, y: 640, minX: 900, maxX: 1100 },
    { kind: 'ferret', x: 1040, y: 640, minX: 900, maxX: 1100 },
    { kind: 'undead', x: 400, y: 1000, minX: 200, maxX: 640, leash: 360 },
    { kind: 'ferret', x: 520, y: 1000, minX: 280, maxX: 720, leash: 320 },
    { kind: 'undead', x: 1960, y: 640, minX: 1720, maxX: 2280 },
    { kind: 'undead', x: 2340, y: 640, minX: 2080, maxX: 2540 },
    { kind: 'ferret', x: 2480, y: 640, minX: 2200, maxX: 2560 },
    { kind: 'macaw', x: 2080, y: 540, minX: 1880, maxX: 2460, leash: 640 },
  ],
  checkpoints: [
    { x: 110, y: 640 },
    { x: 1360, y: 1000 },
    { x: 1760, y: 640 },
    { x: 2060, y: 450 },
    { x: 2320, y: 270 },
  ],
  exits: [{ x: 2380, y: 160, w: 180, h: 112 }],
});

const LEVELS = [floor1, floor2, floor3];

export function getLevel(floor: number, opts?: { seed?: number; seenNotes?: readonly string[] }): LevelData {
  if (floor >= 4 && floor <= 8) return generateFloor(floor, opts?.seed ?? 1, opts?.seenNotes ?? []);
  const build = LEVELS[Math.min(Math.max(floor, 1), 3) - 1] ?? floor1;
  return build();
}
