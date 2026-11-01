import { JUMP_VELOCITY, GRAVITY } from './balance';
import type { Rect } from './types';

/** Real apex, minus a few pixels so a landing is not a one-frame miracle. */
export const JUMP_HEIGHT = Math.floor((JUMP_VELOCITY * JUMP_VELOCITY) / (2 * GRAVITY)) - 8;
/** Running jump on flat ground, held the whole way, with the same margin. */
export const FLAT_GAP = 96;
const STEP = 18;

export interface ReachDoor {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ReachTerminal {
  doorId: string;
  x: number;
  y: number;
}

export interface ReachLevel {
  platforms: Rect[];
  ladders: Rect[];
  doors: ReachDoor[];
  terminals: ReachTerminal[];
  spawn: { x: number; y: number };
  exits: Rect[];
}

interface Gate {
  left: number;
  right: number;
  doorId: string;
}

function xGap(a: Rect, b: Rect): number {
  if (a.x + a.w <= b.x) return b.x - (a.x + a.w);
  if (b.x + b.w <= a.x) return a.x - (b.x + b.w);
  return 0;
}

function pairKey(a: number, b: number): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

/** Can a standing climber get from `from` onto `to` without a ladder? */
export function platformLink(from: Rect, to: Rect): boolean {
  const gap = xGap(from, to);
  const rise = from.y - to.y;
  if (rise <= STEP && gap <= 12) return true;
  if (rise < 0 && gap <= 12) return true;
  if (rise <= 0 && gap <= FLAT_GAP) return true;
  if (rise > STEP && rise <= JUMP_HEIGHT && gap <= (rise > 56 ? 28 : 64)) return true;
  return false;
}

function doorCuts(door: ReachDoor, platform: Rect): boolean {
  const onTop = door.y + door.h >= platform.y - 4 && door.y <= platform.y + 36;
  const across = door.x > platform.x + 12 && door.x + door.w < platform.x + platform.w - 12;
  return onTop && across;
}

function ladderTouches(ladder: Rect, platform: Rect): boolean {
  const cx = ladder.x + ladder.w / 2;
  if (cx < platform.x + 4 || cx > platform.x + platform.w - 4) return false;
  const top = ladder.y;
  const bottom = ladder.y + ladder.h;
  return top <= platform.y + 16 && bottom >= platform.y - 8;
}

function feetOn(x: number, y: number, platform: Rect): boolean {
  return x >= platform.x + 4 && x <= platform.x + platform.w - 4 && Math.abs(y - platform.y) <= 28;
}

function exitOn(exit: Rect, platform: Rect): boolean {
  const overlapX = Math.min(exit.x + exit.w, platform.x + platform.w) - Math.max(exit.x, platform.x);
  if (overlapX < 16) return false;
  return exit.y + exit.h >= platform.y - 70 && exit.y <= platform.y + 8;
}

/**
 * Breadth-first over platforms, jumps, drops, and ladders.
 * A locked door is a wall until its terminal is standing-reachable.
 */
export function canReachExit(level: ReachLevel): boolean {
  const pieces: Rect[] = [];
  const gates: Gate[] = [];
  const blocked = new Set<string>();

  for (const platform of level.platforms) {
    const cuts = level.doors.filter((door) => doorCuts(door, platform)).sort((a, b) => a.x - b.x);
    if (cuts.length === 0) {
      pieces.push(platform);
      continue;
    }
    let cursor = platform.x;
    let prev: number | null = null;
    let pending: string | null = null;
    const end = platform.x + platform.w;
    const push = (x: number, w: number, doorId: string | null) => {
      if (w < 16) return;
      const index = pieces.length;
      pieces.push({ x, y: platform.y, w, h: platform.h });
      if (prev != null && doorId) {
        blocked.add(pairKey(prev, index));
        gates.push({ left: prev, right: index, doorId });
      }
      prev = index;
    };
    for (const door of cuts) {
      push(cursor, door.x - cursor, pending);
      pending = door.id;
      cursor = door.x + door.w;
    }
    push(cursor, end - cursor, pending);
  }

  const count = pieces.length;
  if (count === 0) return false;
  const adj: number[][] = Array.from({ length: count }, () => []);
  for (let i = 0; i < count; i++) {
    for (let j = i + 1; j < count; j++) {
      if (blocked.has(pairKey(i, j))) continue;
      if (platformLink(pieces[i]!, pieces[j]!) || platformLink(pieces[j]!, pieces[i]!)) {
        adj[i]!.push(j);
        adj[j]!.push(i);
      }
    }
  }
  for (const ladder of level.ladders) {
    const touching: number[] = [];
    pieces.forEach((piece, index) => {
      if (ladderTouches(ladder, piece)) touching.push(index);
    });
    for (let a = 0; a < touching.length; a++) {
      for (let b = a + 1; b < touching.length; b++) {
        adj[touching[a]!]!.push(touching[b]!);
        adj[touching[b]!]!.push(touching[a]!);
      }
    }
  }

  const open = new Set<string>();
  const seen = new Set<number>();
  const queue: number[] = [];
  pieces.forEach((piece, index) => {
    if (feetOn(level.spawn.x, level.spawn.y, piece)) queue.push(index);
  });
  if (queue.length === 0) return false;

  const unlock = (index: number) => {
    for (const terminal of level.terminals) {
      if (open.has(terminal.doorId)) continue;
      if (!feetOn(terminal.x, terminal.y, pieces[index]!)) continue;
      open.add(terminal.doorId);
      for (const gate of gates) {
        if (gate.doorId !== terminal.doorId) continue;
        adj[gate.left]!.push(gate.right);
        adj[gate.right]!.push(gate.left);
        if (seen.has(gate.left) && !seen.has(gate.right)) queue.push(gate.right);
        if (seen.has(gate.right) && !seen.has(gate.left)) queue.push(gate.left);
      }
    }
  };

  while (queue.length > 0) {
    const index = queue.shift()!;
    if (seen.has(index)) continue;
    seen.add(index);
    unlock(index);
    for (const next of adj[index]!) {
      if (!seen.has(next)) queue.push(next);
    }
  }

  return level.exits.some((exit) => pieces.some((piece, index) => seen.has(index) && exitOn(exit, piece)));
}
