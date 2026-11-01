/**
 * Active reload, Gears-style.
 * The bar runs out on its own (slow, safe). A second press inside the window
 * finishes instantly. A second press outside the window jams the gun.
 */

export type ReloadPhase = 'idle' | 'active' | 'jammed';

export interface ReloadState {
  phase: ReloadPhase;
  /** Seconds spent in the current phase. */
  t: number;
}

export const RELOAD_DURATION = 1.15;
export const RELOAD_WINDOW = { start: 0.6, end: 0.84 };
export const JAM_DURATION = 1.65;

export function idleReload(): ReloadState {
  return { phase: 'idle', t: 0 };
}

export type ReloadEvent = 'none' | 'perfect' | 'normal' | 'jam' | 'cleared';

export function beginReload(state: ReloadState): ReloadState {
  if (state.phase !== 'idle') return state;
  return { phase: 'active', t: 0 };
}

export interface ReloadOpts {
  window?: { start: number; end: number };
  /** Seconds for a full bar. Workbench levels shorten this. */
  duration?: number;
  /** Gun Oil: a tap outside the window is ignored instead of jamming. */
  oil?: boolean;
}

export function tickReload(
  state: ReloadState,
  dt: number,
  tap: boolean,
  opts?: ReloadOpts,
): { state: ReloadState; event: ReloadEvent } {
  if (state.phase === 'idle') return { state, event: 'none' };

  if (state.phase === 'jammed') {
    if (tap) return { state, event: 'none' };
    const t = state.t + dt;
    if (t >= JAM_DURATION) return { state: idleReload(), event: 'cleared' };
    return { state: { phase: 'jammed', t }, event: 'none' };
  }

  const duration = opts?.duration ?? RELOAD_DURATION;
  if (tap) {
    const window = opts?.window ?? RELOAD_WINDOW;
    const p = state.t / duration;
    if (p >= window.start && p <= window.end) {
      return { state: idleReload(), event: 'perfect' };
    }
    if (opts?.oil) return { state, event: 'none' };
    return { state: { phase: 'jammed', t: 0 }, event: 'jam' };
  }

  const t = state.t + dt;
  if (t >= duration) return { state: idleReload(), event: 'normal' };
  return { state: { phase: 'active', t }, event: 'none' };
}

export function reloadProgress(state: ReloadState, duration = RELOAD_DURATION): number {
  if (state.phase !== 'active') return 0;
  return Math.max(0, Math.min(1, state.t / duration));
}
