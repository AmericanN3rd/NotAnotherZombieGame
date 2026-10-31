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
}

interface Window {
  __nazg?: NazgDebug;
}
