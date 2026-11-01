import type { CoinSpec, DoorSpec, EnemySpec, LevelData, LightSpec, MedkitSpec, NoteSpec, Rect, SignSpec, TerminalSpec } from './types';
import { canReachExit } from './reach';
import { mulberry32, pick } from './rng';
import { takeNotes } from './notes';
import { GEAR_IDS } from './gear';
import { themeFor } from './palette';

const SURFACE = 400;
const FLOOR_H = 720;

interface Draft {
  width: number;
  entryY: number;
  exitY: number;
  platforms: Rect[];
  ladders: Rect[];
  spikes: Rect[];
  pits: Rect[];
  crumble: Rect | null;
  doors: DoorSpec[];
  terminals: TerminalSpec[];
  signs: SignSpec[];
  lights: LightSpec[];
  shop: { x: number; y: number } | null;
  challenge: { x: number; y: number } | null;
  noteSpots: { x: number; y: number }[];
  coinSpots: { x: number; y: number; amount?: number }[];
  medkitSpots: { x: number; y: number }[];
  stoneSpots: { x: number; y: number }[];
  gearSpots: { x: number; y: number }[];
  steam: Rect[];
  enemySpans: { x: number; y: number; minX: number; maxX: number; behind?: string }[];
}

function blank(): Draft {
  return {
    width: 0,
    entryY: SURFACE,
    exitY: SURFACE,
    platforms: [],
    ladders: [],
    spikes: [],
    pits: [],
    crumble: null,
    doors: [],
    terminals: [],
    signs: [],
    lights: [],
    shop: null,
    challenge: null,
    noteSpots: [],
    coinSpots: [],
    medkitSpots: [],
    stoneSpots: [],
    gearSpots: [],
    steam: [],
    enemySpans: [],
  };
}

function slab(x: number, y: number, w: number): Rect {
  return { x, y, w, h: 64 };
}

function corridor(rng: () => number): Draft {
  const draft = blank();
  draft.width = 340 + Math.floor(rng() * 80);
  draft.platforms.push(slab(0, SURFACE, draft.width));
  draft.lights.push({ x: draft.width * 0.5, y: SURFACE - 120, color: 0xc4b49a, radius: 70, flicker: rng() > 0.55, dead: rng() > 0.72 });
  if (rng() > 0.5) draft.enemySpans.push({ x: draft.width * 0.55, y: SURFACE, minX: 40, maxX: draft.width - 40 });
  return draft;
}

function spikes(rng: () => number, floor: number): Draft {
  const draft = corridor(rng);
  const count = 1 + Math.min(3, Math.floor((floor - 4) / 2) + (rng() > 0.5 ? 1 : 0));
  for (let i = 0; i < count; i++) {
    const x = 70 + i * 90;
    if (x + 70 < draft.width - 20) draft.spikes.push({ x, y: SURFACE - 22, w: 64, h: 22 });
  }
  return draft;
}

function pit(): Draft {
  const draft = blank();
  draft.width = 420;
  draft.platforms.push(slab(0, SURFACE, 170), slab(234, SURFACE, 186));
  draft.pits.push({ x: 170, y: SURFACE + 28, w: 64, h: 140 });
  draft.signs.push({ x: 150, y: SURFACE - 28, text: 'MIND THE GAP' });
  draft.enemySpans.push({ x: 300, y: SURFACE, minX: 250, maxX: 400 });
  return draft;
}

function ladderShaft(): Draft {
  const draft = blank();
  draft.width = 420;
  const upper = SURFACE - 130;
  draft.exitY = upper;
  draft.platforms.push(slab(0, SURFACE, 240), { x: 170, y: upper, w: 250, h: 36 });
  draft.ladders.push({ x: 176, y: upper - 8, w: 40, h: SURFACE - upper + 24 });
  draft.signs.push({ x: 200, y: SURFACE - 36, text: 'LADDER — THEY PULL RUNGS' });
  draft.lights.push({ x: 300, y: upper - 80, color: 0x8f2d2d, radius: 60, flicker: true });
  return draft;
}

function vent(): Draft {
  const draft = blank();
  draft.width = 520;
  draft.platforms.push(slab(0, SURFACE, 150), slab(214, SURFACE, 306));
  draft.pits.push({ x: 150, y: SURFACE + 28, w: 64, h: 140 });
  draft.platforms.push({ x: 36, y: SURFACE - 56, w: 90, h: 16 }, { x: 110, y: SURFACE - 108, w: 250, h: 16 });
  draft.signs.push({ x: 70, y: SURFACE - 72, text: 'VENT ↑' });
  draft.signs.push({ x: 250, y: SURFACE - 28, text: 'OR THE PIT' });
  return draft;
}

function lockedDoor(id: string): Draft {
  const draft = blank();
  draft.width = 460;
  draft.platforms.push(slab(0, SURFACE, draft.width));
  draft.doors.push({ id, x: 210, y: SURFACE - 72, w: 18, h: 72 });
  draft.terminals.push({ id: `${id}-term`, doorId: id, x: 150, y: SURFACE });
  draft.signs.push({ x: 150, y: SURFACE - 48, text: 'HOLD TO BYPASS' });
  draft.enemySpans.push({ x: 320, y: SURFACE, minX: 250, maxX: 430, behind: id });
  draft.lights.push({ x: 160, y: SURFACE - 90, color: 0x9cbc6a, radius: 50, flicker: true });
  return draft;
}

function crumbleDrop(): Draft {
  const draft = blank();
  draft.width = 520;
  const basin = SURFACE + 150;
  draft.platforms.push(slab(0, SURFACE, 150), slab(340, SURFACE, 180), slab(60, basin, 360));
  draft.crumble = { x: 150, y: SURFACE, w: 190, h: 22 };
  draft.ladders.push({ x: 348, y: SURFACE - 8, w: 40, h: basin - SURFACE + 28 });
  draft.signs.push({ x: 200, y: SURFACE - 28, text: 'HOLLOW' });
  draft.signs.push({ x: 380, y: basin - 28, text: 'CLIMB' });
  draft.noteSpots.push({ x: 200, y: basin });
  return draft;
}

function shopAlcove(): Draft {
  const draft = corridor(() => 0.2);
  draft.shop = { x: 180, y: SURFACE };
  draft.signs.push({ x: 180, y: SURFACE - 64, text: 'SUPPLY' });
  draft.lights.push({ x: 180, y: SURFACE - 90, color: 0xd7a15f, radius: 80 });
  return draft;
}

function noteNook(): Draft {
  const draft = corridor(() => 0.4);
  draft.platforms.push({ x: 90, y: SURFACE - 56, w: 110, h: 16 });
  draft.noteSpots.push({ x: 140, y: SURFACE - 56 });
  return draft;
}

/** Main deck stays flat. Three wager lanes hang below it and are not required. */
function challengeHall(): Draft {
  const draft = blank();
  draft.width = 760;
  draft.platforms.push(slab(0, SURFACE, draft.width));
  draft.challenge = { x: 120, y: SURFACE };
  draft.signs.push({ x: 120, y: SURFACE - 64, text: 'WAGER — OPTIONAL' });
  draft.lights.push({ x: 120, y: SURFACE - 100, color: 0xe0b15a, radius: 70, flicker: true });
  const lanes = [
    { x: 40, label: 'SHORT · 8', spikes: 1, pit: false, coins: 8 },
    { x: 250, label: 'HARSH · 16', spikes: 2, pit: true, coins: 16 },
    { x: 470, label: 'BRUTAL · 28', spikes: 3, pit: true, coins: 28 },
  ];
  const laneY = SURFACE + 160;
  for (const lane of lanes) {
    draft.platforms.push(slab(lane.x, laneY, 200));
    draft.ladders.push({ x: lane.x + 16, y: SURFACE - 4, w: 36, h: laneY - SURFACE + 16 });
    draft.signs.push({ x: lane.x + 100, y: laneY - 30, text: lane.label });
    for (let s = 0; s < lane.spikes; s++) {
      draft.spikes.push({ x: lane.x + 50 + s * 42, y: laneY - 20, w: 36, h: 20 });
    }
    if (lane.pit) {
      draft.platforms[draft.platforms.length - 1] = slab(lane.x, laneY, 70);
      draft.platforms.push(slab(lane.x + 134, laneY, 66));
      draft.pits.push({ x: lane.x + 70, y: laneY + 24, w: 64, h: 100 });
    }
    draft.coinSpots.push({ x: lane.x + 160, y: laneY, amount: lane.coins });
  }
  draft.signs.push({ x: 520, y: SURFACE - 28, text: 'STAIRS ARE THIS WAY →' });
  return draft;
}

function steamHall(rng: () => number): Draft {
  const draft = corridor(rng);
  draft.steam.push({ x: draft.width * 0.45, y: SURFACE - 48, w: 36, h: 48 });
  draft.signs.push({ x: draft.width * 0.45, y: SURFACE - 70, text: 'STEAM' });
  draft.lights.push({ x: draft.width * 0.45, y: SURFACE - 110, color: 0x8fbfa4, radius: 50, flicker: true });
  return draft;
}

function grate(): Draft {
  const draft = blank();
  draft.width = 480;
  draft.platforms.push(slab(0, SURFACE, 90), slab(150, SURFACE, 70), slab(280, SURFACE, 70), slab(400, SURFACE, 80));
  draft.pits.push({ x: 90, y: SURFACE + 20, w: 60, h: 80 }, { x: 220, y: SURFACE + 20, w: 60, h: 80 }, { x: 350, y: SURFACE + 20, w: 50, h: 80 });
  draft.signs.push({ x: 40, y: SURFACE - 28, text: 'GRATE' });
  draft.lights.push({ x: 240, y: SURFACE - 100, color: 0x7aa0c4, radius: 40, dead: true });
  return draft;
}

function blackout(rng: () => number): Draft {
  const draft = corridor(rng);
  for (const light of draft.lights) light.dead = true;
  draft.signs.push({ x: 80, y: SURFACE - 36, text: 'BULBS OUT' });
  draft.enemySpans.push({ x: draft.width * 0.7, y: SURFACE, minX: 30, maxX: draft.width - 30 });
  return draft;
}

function alarmHall(): Draft {
  const draft = blank();
  draft.width = 440;
  draft.platforms.push(slab(0, SURFACE, draft.width));
  draft.signs.push({ x: 200, y: SURFACE - 48, text: 'GUNSHOTS WAKE THE WARD' });
  draft.enemySpans.push({ x: 300, y: SURFACE, minX: 180, maxX: 400, behind: undefined });
  draft.enemySpans.push({ x: 140, y: SURFACE, minX: 40, maxX: 220 });
  draft.lights.push({ x: 220, y: SURFACE - 100, color: 0xc45a4a, radius: 40, flicker: true });
  return draft;
}

function exitHall(): Draft {
  const draft = blank();
  draft.width = 280;
  draft.platforms.push(slab(0, SURFACE, draft.width));
  return draft;
}

type ChunkKind =
  | 'corridor'
  | 'spikes'
  | 'pit'
  | 'ladder'
  | 'vent'
  | 'door'
  | 'crumble'
  | 'shop'
  | 'note'
  | 'steam'
  | 'grate'
  | 'blackout'
  | 'alarm';

function buildChunk(kind: ChunkKind, rng: () => number, floor: number, doorSerial: number): Draft {
  if (kind === 'spikes') return spikes(rng, floor);
  if (kind === 'pit') return pit();
  if (kind === 'ladder') return ladderShaft();
  if (kind === 'vent') return vent();
  if (kind === 'door') return lockedDoor(`gen-${doorSerial}`);
  if (kind === 'crumble') return crumbleDrop();
  if (kind === 'shop') return shopAlcove();
  if (kind === 'note') return noteNook();
  if (kind === 'steam') return steamHall(rng);
  if (kind === 'grate') return grate();
  if (kind === 'blackout') return blackout(rng);
  if (kind === 'alarm') return alarmHall();
  return corridor(rng);
}

function shiftDraft(draft: Draft, dx: number, dy: number): void {
  const move = (rect: Rect) => {
    rect.x += dx;
    rect.y += dy;
  };
  draft.platforms.forEach(move);
  draft.ladders.forEach(move);
  draft.spikes.forEach(move);
  draft.pits.forEach(move);
  if (draft.crumble) move(draft.crumble);
  for (const door of draft.doors) {
    door.x += dx;
    door.y += dy;
  }
  for (const terminal of draft.terminals) {
    terminal.x += dx;
    terminal.y += dy;
  }
  for (const sign of draft.signs) {
    sign.x += dx;
    sign.y += dy;
  }
  for (const light of draft.lights) {
    light.x += dx;
    light.y += dy;
  }
  if (draft.shop) {
    draft.shop.x += dx;
    draft.shop.y += dy;
  }
  if (draft.challenge) {
    draft.challenge.x += dx;
    draft.challenge.y += dy;
  }
  for (const spot of draft.noteSpots) {
    spot.x += dx;
    spot.y += dy;
  }
  for (const spot of draft.coinSpots) {
    spot.x += dx;
    spot.y += dy;
  }
  for (const spot of draft.medkitSpots) {
    spot.x += dx;
    spot.y += dy;
  }
  for (const spot of draft.stoneSpots) {
    spot.x += dx;
    spot.y += dy;
  }
  for (const spot of draft.gearSpots) {
    spot.x += dx;
    spot.y += dy;
  }
  for (const jet of draft.steam) {
    jet.x += dx;
    jet.y += dy;
  }
  for (const span of draft.enemySpans) {
    span.x += dx;
    span.y += dy;
    span.minX += dx;
    span.maxX += dx;
  }
}

interface Budget {
  undead: number;
  ferrets: number;
  macaws: number;
  bonusHp: number;
  medkits: number;
  coinPiles: number;
  spendLimit: number;
}

function budgetFor(floor: number): Budget {
  const climb = floor - 4;
  return {
    undead: Math.min(8, 2 + climb),
    ferrets: Math.min(4, Math.max(0, climb)),
    macaws: floor < 6 ? 0 : floor >= 14 ? 3 : floor >= 8 ? 2 : 1,
    bonusHp: floor >= 8 ? Math.min(4, 2 + Math.floor((floor - 8) / 2)) : floor >= 7 ? 1 : 0,
    medkits: floor >= 12 ? 0 : floor >= 7 ? 0 : 1,
    coinPiles: Math.max(1, 6 - Math.floor(climb / 2)),
    spendLimit: floor <= 8 ? Math.max(8, 28 - climb * 4) : Math.max(10, 22 - (floor - 9) * 2),
  };
}

function chooseKinds(floor: number, rng: () => number): ChunkKind[] {
  const count = Math.min(9, 5 + (floor - 4));
  const bag: ChunkKind[] = ['corridor', 'spikes', 'pit', 'ladder', 'vent', 'door', 'crumble', 'note', 'shop'];
  if (floor >= 9) bag.push('steam', 'grate', 'blackout', 'alarm');
  const kinds: ChunkKind[] = ['corridor'];
  if (floor >= 4) kinds.push('ladder');
  if (floor >= 5) kinds.push('spikes');
  if (floor >= 6) kinds.push('pit');
  if (floor >= 7) kinds.push('door');
  if (floor >= 8) kinds.push('crumble');
  if (floor >= 9) kinds.push('steam');
  if (floor >= 11) kinds.push('blackout');
  if (floor >= 13) kinds.push('grate');
  while (kinds.length < count) kinds.push(pick(rng, bag));
  return kinds;
}

function assemble(floor: number, seed: number, seen: ReadonlySet<string>): LevelData {
  const rng = mulberry32(seed);
  const budget = budgetFor(floor);
  const kinds = chooseKinds(floor, rng);
  const parts: Draft[] = [];
  let cursorX = 0;
  let surface = SURFACE;
  let doorSerial = 0;
  const merged = blank();
  merged.entryY = SURFACE;

  const place = (draft: Draft) => {
    const dy = surface - draft.entryY;
    shiftDraft(draft, cursorX, dy);
    surface = draft.exitY + dy;
    cursorX += draft.width;
    parts.push(draft);
  };

  place(corridor(rng));
  if (floor === 6) place(challengeHall());
  for (const kind of kinds) {
    place(buildChunk(kind, rng, floor, doorSerial));
    if (kind === 'door') doorSerial += 1;
  }
  place(exitHall());

  for (const part of parts) {
    merged.platforms.push(...part.platforms);
    merged.ladders.push(...part.ladders);
    merged.spikes.push(...part.spikes);
    merged.pits.push(...part.pits);
    merged.doors.push(...part.doors);
    merged.terminals.push(...part.terminals);
    merged.signs.push(...part.signs);
    merged.lights.push(...part.lights);
    merged.noteSpots.push(...part.noteSpots);
    merged.coinSpots.push(...part.coinSpots);
    merged.stoneSpots.push(...part.stoneSpots);
    merged.gearSpots.push(...part.gearSpots);
    merged.steam.push(...part.steam);
    merged.enemySpans.push(...part.enemySpans);
    if (part.crumble && !merged.crumble) merged.crumble = part.crumble;
    if (part.shop && !merged.shop) merged.shop = part.shop;
    if (part.challenge && !merged.challenge) merged.challenge = part.challenge;
  }

  const notes = takeNotes(seen, 1 + (rng() > 0.45 ? 1 : 0));
  const noteSpecs: NoteSpec[] = [];
  notes.forEach((note, index) => {
    const spot = merged.noteSpots[index] ?? { x: 220 + index * 160, y: SURFACE };
    noteSpecs.push({ ...note, x: spot.x, y: spot.y });
  });

  const coins: CoinSpec[] = merged.coinSpots.map((spot) => ({
    x: spot.x,
    y: spot.y,
    amount: spot.amount ?? 2 + Math.floor(rng() * 3),
  }));
  let piles = 0;
  for (const span of merged.enemySpans) {
    if (piles >= budget.coinPiles) break;
    if (rng() > 0.4) continue;
    coins.push({ x: span.minX + 20, y: span.y, amount: 2 });
    piles += 1;
  }

  const medkits: MedkitSpec[] = [];
  if (budget.medkits > 0) medkits.push({ x: 260, y: SURFACE, heal: 2 });

  if (merged.stoneSpots.length === 0 && rng() > 0.25) merged.stoneSpots.push({ x: 420, y: SURFACE });
  if (merged.gearSpots.length === 0) merged.gearSpots.push({ x: 560, y: SURFACE });
  const stones = merged.stoneSpots.map((spot) => ({ x: spot.x, y: spot.y }));
  const gear = merged.gearSpots.slice(0, 2).map((spot) => ({
    x: spot.x,
    y: spot.y,
    id: pick(rng, GEAR_IDS),
  }));

  const enemies: EnemySpec[] = [];
  const spans = merged.enemySpans.filter((span) => span.maxX - span.minX > 70);
  if (spans.length < budget.undead) {
    for (const platform of merged.platforms) {
      if (platform.w < 140 || platform.h < 30) continue;
      spans.push({
        x: platform.x + platform.w / 2,
        y: platform.y,
        minX: platform.x + 24,
        maxX: platform.x + platform.w - 24,
      });
      if (spans.length >= budget.undead + budget.ferrets) break;
    }
  }
  const pushEnemy = (kind: EnemySpec['kind'], span: (typeof spans)[number], bonus: number) => {
    enemies.push({
      kind,
      x: (span.minX + span.maxX) / 2,
      y: kind === 'macaw' ? span.y - 90 : span.y,
      minX: span.minX,
      maxX: span.maxX,
      dormant: Boolean(span.behind),
      behindDoor: span.behind,
      leash: 220,
      bonusHp: kind === 'undead' ? bonus : 0,
    });
  };
  let undeadLeft = budget.undead;
  let ferretsLeft = budget.ferrets;
  let macawsLeft = budget.macaws;
  for (const span of spans) {
    if (undeadLeft > 0) {
      pushEnemy('undead', span, budget.bonusHp);
      undeadLeft -= 1;
    } else if (ferretsLeft > 0) {
      pushEnemy('ferret', span, 0);
      ferretsLeft -= 1;
    } else if (macawsLeft > 0) {
      pushEnemy('macaw', span, 0);
      macawsLeft -= 1;
    }
  }

  const width = Math.max(800, cursorX + 40);
  const height = Math.max(FLOOR_H, surface + 280);
  const theme = themeFor(floor);
  const enter =
    floor === 16
      ? 'A locked hatch. The roof stays shut.'
      : theme === 'machine'
        ? 'Machinery, and no one running it'
        : theme === 'ward'
          ? 'A ward that was emptied in a hurry'
          : (['The air thins', 'More of them', 'A wager, if you want', 'No kindness left', 'The last halls'][floor - 4] ?? 'Higher');

  return {
    id: floor,
    name: `Floor ${floor}`,
    enter,
    width,
    height,
    spawn: { x: 72, y: SURFACE },
    spendLimit: budget.spendLimit,
    platforms: merged.platforms,
    walls: [],
    ladders: merged.ladders,
    spikes: merged.spikes,
    pits: merged.pits,
    crumble: merged.crumble,
    notes: noteSpecs,
    coins,
    medkits,
    stones,
    gear,
    steam: merged.steam,
    theme,
    shop: merged.shop,
    terminals: merged.terminals,
    doors: merged.doors,
    signs: merged.signs,
    lights: merged.lights,
    enemies,
    checkpoints: [
      { x: 72, y: SURFACE },
      { x: Math.min(width - 200, 700), y: SURFACE },
    ],
    exits: [{ x: width - 150, y: surface - 80, w: 110, h: 84 }],
    challenge: merged.challenge,
    builtSeed: seed,
  };
}

function plainFloor(floor: number, seed: number, seen: ReadonlySet<string>): LevelData {
  const notes = takeNotes(seen, 1).map((note) => ({ ...note, x: 280, y: SURFACE }));
  return {
    id: floor,
    name: `Floor ${floor}`,
    enter: 'A straight hall',
    width: 1500,
    height: FLOOR_H,
    spawn: { x: 72, y: SURFACE },
    spendLimit: budgetFor(floor).spendLimit,
    platforms: [slab(0, SURFACE, 1400)],
    walls: [],
    ladders: [],
    spikes: [{ x: 480, y: SURFACE - 22, w: 70, h: 22 }],
    pits: [],
    crumble: null,
    notes,
    coins: [{ x: 360, y: SURFACE, amount: 3 }],
    medkits: floor >= 7 ? [] : [{ x: 600, y: SURFACE, heal: 2 }],
    stones: [{ x: 480, y: SURFACE }],
    gear: [{ x: 800, y: SURFACE, id: 'bandage' }],
    steam: floor >= 9 ? [{ x: 900, y: SURFACE - 48, w: 36, h: 48 }] : [],
    theme: themeFor(floor),
    shop: null,
    terminals: [],
    doors: [],
    signs: [{ x: 1200, y: SURFACE - 40, text: 'STAIRWELL' }],
    lights: [{ x: 200, y: SURFACE - 120, color: 0xc4b49a, radius: 80, flicker: true }],
    enemies: [
      { kind: 'undead', x: 700, y: SURFACE, minX: 500, maxX: 900, bonusHp: floor >= 7 ? 1 : 0 },
    ],
    checkpoints: [{ x: 72, y: SURFACE }],
    exits: [{ x: 1240, y: SURFACE - 80, w: 120, h: 84 }],
    challenge: floor === 6 ? { x: 200, y: SURFACE } : null,
    builtSeed: seed,
  };
}

export function generateFloor(floor: number, seed: number, seenIds: readonly string[]): LevelData {
  const seen = new Set(seenIds);
  for (let attempt = 0; attempt < 12; attempt++) {
    const level = assemble(floor, (seed + attempt) >>> 0, seen);
    if (
      canReachExit({
        platforms: level.platforms,
        ladders: level.ladders,
        doors: level.doors,
        terminals: level.terminals,
        spawn: level.spawn,
        exits: level.exits,
      })
    ) {
      return level;
    }
  }
  return plainFloor(floor, seed, seen);
}
