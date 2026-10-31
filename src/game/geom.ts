import type { Rect } from './types';

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function rectsOverlap(ax: number, ay: number, aw: number, ah: number, b: Rect): boolean {
  return ax < b.x + b.w && ax + aw > b.x && ay < b.y + b.h && ay + ah > b.y;
}

/** True when a solid sits on the segment, so sight and melee don't pass through floors. */
export function segmentBlocked(blocks: Rect[], x1: number, y1: number, x2: number, y2: number): boolean {
  const steps = 7;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = x1 + (x2 - x1) * t;
    const y = y1 + (y2 - y1) * t;
    for (const r of blocks) {
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return true;
    }
  }
  return false;
}

/** A walkable top within a few pixels under the foot probe. */
export function groundAt(floors: Rect[], x: number, footY: number): boolean {
  for (const r of floors) {
    if (x < r.x || x > r.x + r.w) continue;
    if (footY >= r.y - 8 && footY <= r.y + 20) return true;
  }
  return false;
}
