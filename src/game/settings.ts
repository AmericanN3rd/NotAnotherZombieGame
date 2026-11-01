export interface Settings {
  /** 0 is the darkest readable cone, 1 lifts the whole floor. */
  brightness: number;
  lowEffects: boolean;
  introSeen: boolean;
  /** When set, new climbs and procedural floors use this seed. */
  seed: number | null;
}

const KEY = 'nazg-settings';

const DEFAULTS: Settings = {
  brightness: 0.62,
  lowEffects: false,
  introSeen: false,
  seed: null,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      brightness: clampSetting(parsed.brightness, 0.35, 1, DEFAULTS.brightness),
      lowEffects: Boolean(parsed.lowEffects),
      introSeen: Boolean(parsed.introSeen),
      seed: typeof parsed.seed === 'number' && Number.isFinite(parsed.seed) ? Math.floor(parsed.seed) : null,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(next: Settings): void {
  Object.assign(settings, next);
  localStorage.setItem(KEY, JSON.stringify(settings));
  for (const listener of listeners) listener(settings);
}

export const settings = loadSettings();

const listeners = new Set<(value: Settings) => void>();

export function watchSettings(listener: (value: Settings) => void): void {
  listeners.add(listener);
  listener(settings);
}

function clampSetting(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}
