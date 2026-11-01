import { FLOOR_1_SPEND_LIMIT } from './balance';
import { campLevel } from './camp';
import { generateFloor } from './generate';
import type { LevelData, Rect } from './types';

function stair(x: number, top: number, w: number, bottom: number): Rect {
  return { x, y: top, w, h: bottom - top };
}

const floor1 = (): LevelData => ({
  id: 2,
  name: 'Floor 2',
  enter: 'The first hall',
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
  stones: [{ x: 980, y: 400 }],
  gear: [{ x: 1180, y: 400, id: 'jacket' }],
});

const floor2 = (): LevelData => ({
  id: 3,
  name: 'Floor 3',
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

export function getLevel(
  floor: number,
  opts?: { seed?: number; seenNotes?: readonly string[]; campTier?: 0 | 1 | 2 | 3 },
): LevelData {
  if (floor <= 1) return campLevel(opts?.campTier ?? 0);
  if (floor === 2) return floor1();
  if (floor === 3) return floor2();
  return generateFloor(floor, opts?.seed ?? 1, opts?.seenNotes ?? []);
}

