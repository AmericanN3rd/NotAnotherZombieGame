export interface FloorPalette {
  /** Page and camera background. */
  bg: string;
  /** Phaser fill for the back wall. */
  wall: number;
  floor: number;
  lip: number;
  /** Warm cone and the rare bulb that still works. */
  lamp: number;
  fog: string;
}

const PALETTES: FloorPalette[] = [
  { bg: '#07080c', wall: 0x07080e, floor: 0x14161c, lip: 0x2a3140, lamp: 0xc4b49a, fog: '#14110f' },
  { bg: '#0c0a0b', wall: 0x100c0e, floor: 0x1a1416, lip: 0x3a2c2a, lamp: 0xd7a15f, fog: '#1a1210' },
  { bg: '#10080c', wall: 0x140a10, floor: 0x1c1014, lip: 0x4a2428, lamp: 0xc45a4a, fog: '#1a0c10' },
  { bg: '#070c0b', wall: 0x081210, floor: 0x101816, lip: 0x243832, lamp: 0x8faf98, fog: '#0c1412' },
  { bg: '#080910', wall: 0x0a0c16, floor: 0x12141e, lip: 0x2a3050, lamp: 0x9aa4d0, fog: '#10121c' },
  { bg: '#100e08', wall: 0x141208, floor: 0x1c1810, lip: 0x4a3c20, lamp: 0xe0b15a, fog: '#16140c' },
  { bg: '#0c0810', wall: 0x120a16, floor: 0x180e1c, lip: 0x3a2048, lamp: 0xc49ad0, fog: '#140e18' },
  { bg: '#050506', wall: 0x080808, floor: 0x101012, lip: 0x3a1818, lamp: 0xe07070, fog: '#100808' },
];

export function paletteFor(floor: number): FloorPalette {
  return PALETTES[Math.min(PALETTES.length, Math.max(1, floor)) - 1] ?? PALETTES[0]!;
}
