import type { CampDressing, CampStation, LevelData, LightSpec } from './types';

/**
 * The lobby is floor 1 and the main menu. Nobody else is here.
 * Tier 0 is a bare room. Tier 3 is barricaded, sandbagged, and patched.
 */
export function campLevel(tier: 0 | 1 | 2 | 3): LevelData {
  const lights: LightSpec[] = [
    { x: 220, y: 250, color: 0xc4b49a, radius: 120, dead: false, flicker: tier < 2 },
    { x: 480, y: 220, color: 0xd7a15f, radius: 110, dead: tier < 1, flicker: tier < 3 },
    { x: 760, y: 210, color: 0xc45a4a, radius: 80, dead: tier < 2, flicker: true },
    { x: 1040, y: 230, color: 0x9aa4d0, radius: 100, dead: tier < 2 },
    { x: 1360, y: 200, color: 0xe0b15a, radius: 120, dead: tier < 3 },
  ];

  const dressing: CampDressing[] = [{ kind: 'rubble', x: 80, y: 372, w: 70, h: 28 }];
  if (tier >= 1) dressing.push({ kind: 'barricade', x: 40, y: 348, w: 120, h: 52 });
  if (tier >= 2) {
    dressing.push({ kind: 'sandbag', x: 560, y: 368, w: 90, h: 32 });
    dressing.push({ kind: 'sandbag', x: 980, y: 368, w: 90, h: 32 });
  }
  if (tier >= 3) {
    dressing.push({ kind: 'barricade', x: 300, y: 250, w: 140, h: 36 });
    dressing.push({ kind: 'patch', x: 700, y: 160, w: 180, h: 48 });
    dressing.push({ kind: 'patch', x: 1100, y: 140, w: 160, h: 40 });
    dressing.push({ kind: 'sandbag', x: 1280, y: 360, w: 100, h: 36 });
  }

  const stations: CampStation[] = [
    { id: 'notices', x: 200, y: 400 },
    { id: 'workbench', x: 460, y: 400 },
    { id: 'armory', x: 720, y: 400 },
    { id: 'infirmary', x: 980, y: 400 },
    { id: 'radio', x: 1220, y: 400 },
    { id: 'climb', x: 1640, y: 304 },
  ];

  return {
    id: 1,
    name: 'Lobby',
    enter: tier >= 3 ? 'The lobby holds' : 'The lobby, still open',
    width: 1760,
    height: 560,
    spawn: { x: 120, y: 400 },
    spendLimit: 0,
    platforms: [
      { x: 0, y: 400, w: 1400, h: 160 },
      { x: 1400, y: 384, w: 56, h: 176 },
      { x: 1456, y: 360, w: 56, h: 200 },
      { x: 1512, y: 336, w: 56, h: 224 },
      { x: 1568, y: 304, w: 160, h: 256 },
    ],
    walls: [],
    ladders: [],
    spikes: [],
    pits: [],
    crumble: null,
    notes: [
      {
        id: 'camp-inside',
        x: 320,
        y: 400,
        text: "they're inside, be careful.",
      },
    ],
    coins: [],
    medkits: [],
    shop: null,
    terminals: [],
    doors: [],
    signs: [
      { x: 200, y: 330, text: 'NOTICES' },
      { x: 460, y: 330, text: 'WORKBENCH' },
      { x: 720, y: 330, text: 'ARMORY' },
      { x: 980, y: 330, text: 'INFIRMARY' },
      { x: 1220, y: 330, text: 'RADIO' },
      { x: 1600, y: 250, text: 'STAIRS — THE CLIMB' },
    ],
    lights,
    enemies: [],
    checkpoints: [{ x: 120, y: 400 }],
    exits: [],
    stations,
    dressing,
    theme: 'tenement',
  };
}
