/// <reference types="vite/client" />

interface NazgDebug {
  goto: (floor: number) => void;
  pos: () => { x: number; y: number; floor: number; hp: number; phase: string };
  kill: () => void;
  coins: (n: number) => void;
  hurt: (n: number) => void;
  fill: () => void;
  status: () => Record<string, unknown>;
  place: (x: number, y: number) => void;
  seed: () => number;
  setSeed: (seed: number) => void;
  openShop: () => void;
  openGear: () => void;
  setKnife: (n: number) => void;
  setHp: (n: number) => void;
  give: (id: string) => void;
  setSalvage: (n: number) => void;
  setStations: (n: number) => void;
  openStation: (id: string) => void;
  die: () => void;
  pocket: (n: number) => void;
}

interface Window {
  __nazg?: NazgDebug;
}
