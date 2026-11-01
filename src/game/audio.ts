/**
 * Gunfire, melee, and UI stings stay synthesized.
 * Weather, the door, the walls, and the music beds are CC0 files in public/audio.
 * See AUDIO_CREDITS.md.
 */

let ctx: AudioContext | null = null;
let muted = false;
let drone: { osc: OscillatorNode; gain: GainNode } | null = null;
const noiseCache = new Map<string, AudioBuffer>();
const clipCache = new Map<string, AudioBuffer>();
const clipLoads = new Map<string, Promise<void>>();

function context(): AudioContext | null {
  if (muted) return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function unlockAudio(): void {
  const c = context();
  if (!c) return;
  if (!drone) startDrone(c);
  for (const name of CLIP_NAMES) void loadClip(c, name);
}

export function toggleMute(): boolean {
  muted = !muted;
  if (muted) {
    drone?.gain.gain.setTargetAtTime(0, ctx?.currentTime ?? 0, 0.05);
    for (const bed of beds) bed.pause();
    duckMusic(0.0001);
  } else {
    unlockAudio();
    if (drone && ctx) drone.gain.gain.setTargetAtTime(0.018, ctx.currentTime, 0.2);
    if (musicSlot) {
      const slot = musicSlot;
      musicSlot = null;
      playMusic(slot);
    }
  }
  return muted;
}

export function isMuted(): boolean {
  return muted;
}

function startDrone(c: AudioContext): void {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.value = 55;
  gain.gain.value = 0.018;
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start();
  const osc2 = c.createOscillator();
  const gain2 = c.createGain();
  osc2.type = 'triangle';
  osc2.frequency.value = 82;
  gain2.gain.value = 0.006;
  osc2.connect(gain2);
  gain2.connect(c.destination);
  osc2.start();
  drone = { osc, gain };
}

function envGain(c: AudioContext, duration: number, peak: number): GainNode {
  const g = c.createGain();
  const t = c.currentTime;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  g.connect(c.destination);
  return g;
}

function tone(freq: number, duration: number, type: OscillatorType, peak: number, slideTo?: number): void {
  const c = context();
  if (!c) return;
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, c.currentTime);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), c.currentTime + duration);
  o.connect(envGain(c, duration, peak));
  o.start();
  o.stop(c.currentTime + duration + 0.02);
}

function noiseBuffer(c: AudioContext, band: 'low' | 'high'): AudioBuffer {
  const key = `${band}:${c.sampleRate}`;
  const cached = noiseCache.get(key);
  if (cached) return cached;
  const length = Math.floor(c.sampleRate * (band === 'low' ? 0.4 : 0.18));
  const buffer = c.createBuffer(1, length, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  noiseCache.set(key, buffer);
  return buffer;
}

function noiseBurst(duration: number, peak: number, band: 'low' | 'high'): void {
  const c = context();
  if (!c) return;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, band);
  const filter = c.createBiquadFilter();
  filter.type = band === 'low' ? 'lowpass' : 'highpass';
  filter.frequency.value = band === 'low' ? 420 : 1800;
  const g = envGain(c, duration, peak);
  src.connect(filter);
  filter.connect(g);
  src.start();
  src.stop(c.currentTime + duration);
}

export const sfx = {
  gun(silenced: boolean): void {
    if (silenced) {
      noiseBurst(0.08, 0.08, 'low');
      tone(180, 0.06, 'sine', 0.04, 70);
      return;
    }
    noiseBurst(0.18, 0.22, 'low');
    tone(140, 0.16, 'sawtooth', 0.06, 50);
  },
  dry(): void {
    tone(220, 0.04, 'square', 0.03, 120);
  },
  melee(): void {
    noiseBurst(0.09, 0.06, 'high');
    tone(320, 0.08, 'triangle', 0.03, 140);
  },
  hit(): void {
    tone(90, 0.09, 'square', 0.05, 40);
  },
  jam(): void {
    tone(640, 0.05, 'square', 0.05, 200);
    tone(180, 0.12, 'square', 0.04, 90);
  },
  reloadTick(): void {
    tone(880, 0.03, 'square', 0.02);
  },
  perfect(): void {
    tone(520, 0.08, 'triangle', 0.05, 880);
  },
  hurt(): void {
    tone(200, 0.16, 'sawtooth', 0.06, 60);
  },
  groan(): void {
    tone(110, 0.35, 'sawtooth', 0.03, 70);
  },
  screech(): void {
    tone(1400, 0.28, 'square', 0.04, 2200);
    tone(900, 0.2, 'sawtooth', 0.02, 1600);
  },
  pickup(): void {
    tone(660, 0.07, 'sine', 0.04, 990);
  },
  step(): void {
    noiseBurst(0.03, 0.015, 'low');
  },
  collapse(): void {
    noiseBurst(0.4, 0.12, 'low');
    tone(70, 0.4, 'sine', 0.06, 40);
  },
};

export type ClipName = 'rain' | 'thunder' | 'door-slam' | 'wail' | 'teeth' | 'scratch' | 'piano' | 'strings';

const CLIP_NAMES: readonly ClipName[] = ['rain', 'thunder', 'door-slam', 'wail', 'teeth', 'scratch', 'piano', 'strings'];

export interface ClipHandle {
  pause(): void;
}

const beds = new Set<ClipHandle>();
let pianoBed: ClipHandle | null = null;

function clipUrl(name: ClipName): string {
  return `${import.meta.env.BASE_URL}audio/${name}.ogg`;
}

function loadClip(c: AudioContext, name: ClipName): Promise<void> {
  const existing = clipLoads.get(name);
  if (existing) return existing;
  const job = fetch(clipUrl(name))
    .then((response) => response.arrayBuffer())
    .then((bytes) => c.decodeAudioData(bytes.slice(0)))
    .then((buffer) => {
      clipCache.set(name, buffer);
    })
    .catch(() => undefined);
  clipLoads.set(name, job);
  return job;
}

function playElement(name: ClipName, volume: number, loop: boolean): ClipHandle {
  const audio = new Audio(clipUrl(name));
  audio.loop = loop;
  audio.preload = 'auto';
  audio.volume = muted ? 0 : volume;
  const handle: ClipHandle = {
    pause() {
      audio.pause();
      beds.delete(handle);
    },
  };
  beds.add(handle);
  if (!loop) audio.addEventListener('ended', () => beds.delete(handle));
  void audio.play().catch(() => undefined);
  return handle;
}

export function playClip(name: ClipName, volume = 0.45, loop = false): ClipHandle | null {
  const c = context();
  const buffer = c ? clipCache.get(name) : undefined;
  if (!c || !buffer) {
    if (c) void loadClip(c, name);
    return playElement(name, volume, loop);
  }
  const src = c.createBufferSource();
  src.buffer = buffer;
  src.loop = loop;
  const gain = c.createGain();
  gain.gain.value = muted ? 0 : volume;
  src.connect(gain);
  gain.connect(c.destination);
  src.start();
  const handle: ClipHandle = {
    pause() {
      try {
        src.stop();
      } catch {
        // Already stopped.
      }
      beds.delete(handle);
    },
  };
  beds.add(handle);
  if (!loop) src.onended = () => beds.delete(handle);
  return handle;
}

export function stopClip(audio: ClipHandle | null): void {
  if (!audio) return;
  audio.pause();
  beds.delete(audio);
}

export type MusicSlot = 'camp' | 'climb' | 'hatch';

const MUSIC_EXTS = ['ogg', 'm4a', 'mp3'] as const;
let musicSlot: MusicSlot | null = null;
let musicGain: GainNode | null = null;
let musicSource: AudioBufferSourceNode | null = null;
const musicBuffers = new Map<string, AudioBuffer>();
let musicToken = 0;

/**
 * Loop a music slot and crossfade off the previous one.
 * Files are public/audio/music/<slot>.ogg, with .m4a and .mp3 as fallbacks.
 */
export function playMusic(slot: MusicSlot): void {
  if (slot === musicSlot && musicSource) return;
  stopAmbience();
  if (muted) {
    musicSlot = slot;
    return;
  }
  const c = context();
  if (!c) {
    musicSlot = slot;
    return;
  }
  const token = ++musicToken;
  void crossfadeMusic(c, slot, token);
}

async function loadMusic(c: AudioContext, slot: MusicSlot): Promise<AudioBuffer | null> {
  for (const ext of MUSIC_EXTS) {
    const key = `${slot}.${ext}`;
    const cached = musicBuffers.get(key);
    if (cached) return cached;
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}audio/music/${key}`);
      if (!response.ok) continue;
      const bytes = await response.arrayBuffer();
      const buffer = await c.decodeAudioData(bytes.slice(0));
      musicBuffers.set(key, buffer);
      return buffer;
    } catch {
      // Try the next extension.
    }
  }
  return null;
}

async function crossfadeMusic(c: AudioContext, slot: MusicSlot, token: number): Promise<void> {
  const buffer = await loadMusic(c, slot);
  if (token !== musicToken || !buffer) return;
  const now = c.currentTime;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.16, now + 1.2);
  gain.connect(c.destination);
  const src = c.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  src.connect(gain);
  src.start();
  if (musicGain && musicSource) {
    const oldGain = musicGain;
    const oldSrc = musicSource;
    oldGain.gain.cancelScheduledValues(now);
    oldGain.gain.setValueAtTime(Math.max(0.0001, oldGain.gain.value), now);
    oldGain.gain.linearRampToValueAtTime(0.0001, now + 1.2);
    window.setTimeout(() => {
      try {
        oldSrc.stop();
      } catch {
        // Already stopped.
      }
    }, 1300);
  }
  musicGain = gain;
  musicSource = src;
  musicSlot = slot;
}

function duckMusic(level: number): void {
  if (!musicGain || !ctx) return;
  musicGain.gain.setTargetAtTime(level, ctx.currentTime, 0.08);
}

export function startAmbience(): void {
  if (pianoBed || musicSource) return;
  pianoBed = playClip('piano', 0.07, true);
}

export function stopAmbience(): void {
  stopClip(pianoBed);
  pianoBed = null;
}
