/**
 * Gunfire, melee, and UI stings stay synthesized.
 * Weather, the door, the walls, and the music beds are CC0 files in public/audio.
 * See AUDIO_CREDITS.md.
 */

let ctx: AudioContext | null = null;
let muted = false;
let drone: { osc: OscillatorNode; gain: GainNode } | null = null;

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
}

export function toggleMute(): boolean {
  muted = !muted;
  if (muted) {
    drone?.gain.gain.setTargetAtTime(0, ctx?.currentTime ?? 0, 0.05);
    for (const bed of beds) bed.volume = 0;
  } else {
    unlockAudio();
    if (drone && ctx) drone.gain.gain.setTargetAtTime(0.018, ctx.currentTime, 0.2);
    for (const bed of beds) bed.volume = bed.dataset.volume ? Number(bed.dataset.volume) : 0.4;
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

function noiseBurst(duration: number, peak: number, band: 'low' | 'high'): void {
  const c = context();
  if (!c) return;
  const length = Math.floor(c.sampleRate * duration);
  const buffer = c.createBuffer(1, length, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = band === 'low' ? 'lowpass' : 'highpass';
  filter.frequency.value = band === 'low' ? 420 : 1800;
  const g = envGain(c, duration, peak);
  src.connect(filter);
  filter.connect(g);
  src.start();
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

const beds = new Set<HTMLAudioElement>();
let pianoBed: HTMLAudioElement | null = null;

function clipUrl(name: ClipName): string {
  return `${import.meta.env.BASE_URL}audio/${name}.ogg`;
}

export function playClip(name: ClipName, volume = 0.45, loop = false): HTMLAudioElement | null {
  const audio = new Audio(clipUrl(name));
  audio.loop = loop;
  audio.preload = 'auto';
  audio.dataset.volume = String(volume);
  audio.volume = muted ? 0 : volume;
  beds.add(audio);
  if (!loop) audio.addEventListener('ended', () => beds.delete(audio));
  void audio.play().catch(() => undefined);
  return audio;
}

export function stopClip(audio: HTMLAudioElement | null): void {
  if (!audio) return;
  audio.pause();
  beds.delete(audio);
}

export function startAmbience(): void {
  if (pianoBed) return;
  pianoBed = playClip('piano', 0.07, true);
}

export function stopAmbience(): void {
  stopClip(pianoBed);
  pianoBed = null;
}
