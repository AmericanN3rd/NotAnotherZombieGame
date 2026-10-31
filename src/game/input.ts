import { emptyPad, padInUse, readStandardPad, type PadReading, type PadSample } from './gamepad';
import { clamp } from './geom';

export type Scheme = 'key' | 'touch' | 'pad';

export interface Frame {
  axisX: number;
  keyUp: boolean;
  keyDown: boolean;
  joyUp: boolean;
  joyDown: boolean;
  jumpEdge: boolean;
  jumpHeld: boolean;
  meleeEdge: boolean;
  fireEdge: boolean;
  reloadEdge: boolean;
  interactEdge: boolean;
  interactHeld: boolean;
  pauseEdge: boolean;
  flareEdge: boolean;
  /** -1 up, +1 down, for shop and menu rows. */
  navEdge: -1 | 0 | 1;
}

const EDGE_KEYS = ['jump', 'melee', 'fire', 'reload', 'interact', 'pause', 'flare'] as const;
type EdgeName = (typeof EDGE_KEYS)[number];

type PromptAction = 'jump' | 'melee' | 'fire' | 'reload' | 'interact' | 'pause' | 'climb';

const PROMPTS: Record<Scheme, Record<PromptAction, string>> = {
  key: { jump: 'Space', melee: 'J', fire: 'K', reload: 'R', interact: 'E', pause: 'Esc', climb: 'W/S' },
  touch: { jump: 'Jump', melee: 'Knife', fire: 'Fire', reload: 'Reload', interact: 'Use', pause: 'Esc', climb: 'Stick' },
  pad: { jump: 'A', melee: 'X', fire: 'RT', reload: 'Y', interact: 'B', pause: 'Menu', climb: 'Stick' },
};

/**
 * Keyboard, touch, and the standard gamepad mapping write into one frame.
 * Edges are consumed by the scene so a held button doesn't repeat and a
 * shop menu can't leak a reload into the world.
 */
export class Input {
  private left = false;
  private right = false;
  private keyUp = false;
  private keyDown = false;
  private joyX = 0;
  private joyY = 0;
  private keyJumpHeld = false;
  private keyInteractHeld = false;
  private edges: Record<EdgeName, boolean> = {
    jump: false,
    melee: false,
    fire: false,
    reload: false,
    interact: false,
    pause: false,
    flare: false,
  };

  private scheme: Scheme;
  private idleScheme: Scheme;
  private schemeListeners = new Set<(scheme: Scheme) => void>();
  private pad = emptyPad();
  private prevPad = emptyPad();
  private lastPadIndex = -1;
  private navDir = 0;
  private navHeldFor = 0;
  private lastPoll = 0;

  constructor() {
    const touchFirst =
      window.matchMedia?.('(pointer: coarse)')?.matches === true || new URLSearchParams(location.search).has('touch');
    this.scheme = touchFirst ? 'touch' : 'key';
    this.idleScheme = this.scheme;
    window.addEventListener('keydown', (event) => this.onKey(event, true));
    window.addEventListener('keyup', (event) => this.onKey(event, false));
    window.addEventListener('blur', () => this.releaseKeys());
    window.addEventListener('gamepadconnected', () => this.pollPad());
    window.addEventListener('gamepaddisconnected', () => this.pollPad());
    void this.bindHardwareBack();
  }

  /** Android back pauses instead of leaving the activity. */
  private async bindHardwareBack(): Promise<void> {
    try {
      const { Capacitor } = await import('@capacitor/core');
      if (!Capacitor.isNativePlatform()) return;
      const { App } = await import('@capacitor/app');
      await App.addListener('backButton', () => {
        this.edges.pause = true;
      });
    } catch {
      // Browser build.
    }
  }

  get device(): Scheme {
    return this.scheme;
  }

  watchScheme(listener: (scheme: Scheme) => void): void {
    this.schemeListeners.add(listener);
    listener(this.scheme);
  }

  label(action: PromptAction): string {
    return PROMPTS[this.scheme][action];
  }

  setJoy(x: number, y: number): void {
    this.joyX = clamp(x, -1, 1);
    this.joyY = clamp(y, -1, 1);
    if (Math.hypot(this.joyX, this.joyY) > 0.2) this.adopt('touch');
  }

  /** y is negative upward, matching the stick. */
  get joyVector(): { x: number; y: number } {
    return { x: this.joyX, y: this.joyY };
  }

  press(name: EdgeName, held = true): void {
    this.edges[name] = true;
    if (name === 'jump') this.keyJumpHeld = held;
    if (name === 'interact') this.keyInteractHeld = held;
    this.adopt('touch');
  }

  release(name: 'jump' | 'interact'): void {
    if (name === 'jump') this.keyJumpHeld = false;
    if (name === 'interact') this.keyInteractHeld = false;
  }

  consume(): Frame {
    this.pollPad();
    const navEdge = this.navPulse();
    const frame: Frame = {
      axisX: clamp((this.left ? -1 : 0) + (this.right ? 1 : 0) + this.joyX + this.pad.moveX, -1, 1),
      keyUp: this.keyUp,
      keyDown: this.keyDown,
      joyUp: this.joyY < -0.42 || this.pad.up,
      joyDown: this.joyY > 0.42 || this.pad.down,
      jumpEdge: this.edges.jump,
      jumpHeld: this.keyJumpHeld || this.pad.jump,
      meleeEdge: this.edges.melee,
      fireEdge: this.edges.fire,
      reloadEdge: this.edges.reload,
      interactEdge: this.edges.interact,
      interactHeld: this.keyInteractHeld || this.pad.interact,
      pauseEdge: this.edges.pause,
      flareEdge: this.edges.flare,
      navEdge,
    };
    for (const key of EDGE_KEYS) this.edges[key] = false;
    return frame;
  }

  private navPulse(): -1 | 0 | 1 {
    const now = performance.now();
    const dt = this.lastPoll === 0 ? 0 : Math.min(0.05, (now - this.lastPoll) / 1000);
    this.lastPoll = now;
    const dir: -1 | 0 | 1 = this.pad.up ? -1 : this.pad.down ? 1 : 0;
    if (dir === 0) {
      this.navDir = 0;
      this.navHeldFor = 0;
      return 0;
    }
    if (dir !== this.navDir) {
      this.navDir = dir;
      this.navHeldFor = 0;
      return dir;
    }
    this.navHeldFor += dt;
    if (this.navHeldFor >= 0.38) {
      this.navHeldFor = 0.16;
      return dir;
    }
    return 0;
  }

  private pollPad(): void {
    const pads = readGamepads();
    const connected = pads.filter((pad) => pad && pad.connected);
    if (connected.length === 0) {
      this.prevPad = emptyPad();
      this.pad = emptyPad();
      this.lastPadIndex = -1;
      if (this.scheme === 'pad') this.adopt(this.idleScheme);
      return;
    }

    const preferred =
      connected.find((pad) => pad.index === this.lastPadIndex) ??
      connected.find((pad) => pad.mapping === 'standard') ??
      connected[0];
    const sample = sampleOf(preferred);
    const reading = readStandardPad(sample);
    if (padInUse(sample)) {
      this.lastPadIndex = preferred.index;
      this.adopt('pad');
    }
    this.rise(reading);
    this.prevPad = reading;
    this.pad = reading;
  }

  private rise(reading: PadReading): void {
    const was = this.prevPad;
    if (reading.jump && !was.jump) this.edges.jump = true;
    if (reading.melee && !was.melee) this.edges.melee = true;
    if (reading.fire && !was.fire) this.edges.fire = true;
    if (reading.reload && !was.reload) this.edges.reload = true;
    if (reading.interact && !was.interact) this.edges.interact = true;
    if (reading.pause && !was.pause) this.edges.pause = true;
    if (reading.flare && !was.flare) this.edges.flare = true;
  }

  private adopt(next: Scheme): void {
    if (next === 'key' || next === 'touch') this.idleScheme = next;
    if (this.scheme === next) return;
    this.scheme = next;
    for (const listener of this.schemeListeners) listener(next);
  }

  private releaseKeys(): void {
    this.left = false;
    this.right = false;
    this.keyUp = false;
    this.keyDown = false;
    this.joyX = 0;
    this.joyY = 0;
    this.keyJumpHeld = false;
    this.keyInteractHeld = false;
  }

  private onKey(event: KeyboardEvent, down: boolean): void {
    const mapped = mapKey(event.code);
    if (!mapped) return;
    event.preventDefault();
    if (down && event.repeat) return;
    if (down) this.adopt('key');
    if (mapped === 'left') this.left = down;
    else if (mapped === 'right') this.right = down;
    else if (mapped === 'up') this.keyUp = down;
    else if (mapped === 'down') this.keyDown = down;
    else if (mapped === 'jump') {
      if (down) this.edges.jump = true;
      this.keyJumpHeld = down;
    } else if (mapped === 'interact') {
      if (down) this.edges.interact = true;
      this.keyInteractHeld = down;
    } else if (down) {
      this.edges[mapped] = true;
    }
  }
}

export const input = new Input();

function mapKey(code: string): 'left' | 'right' | 'up' | 'down' | EdgeName | null {
  switch (code) {
    case 'ArrowLeft':
    case 'KeyA':
      return 'left';
    case 'ArrowRight':
    case 'KeyD':
      return 'right';
    case 'ArrowUp':
    case 'KeyW':
      return 'up';
    case 'ArrowDown':
    case 'KeyS':
      return 'down';
    case 'Space':
      return 'jump';
    case 'KeyJ':
    case 'KeyX':
      return 'melee';
    case 'KeyK':
    case 'KeyZ':
      return 'fire';
    case 'KeyR':
      return 'reload';
    case 'KeyE':
    case 'KeyF':
      return 'interact';
    case 'Escape':
    case 'KeyP':
      return 'pause';
    case 'Digit3':
    case 'KeyG':
      return 'flare';
    default:
      return null;
  }
}

function readGamepads(): Gamepad[] {
  try {
    return Array.from(navigator.getGamepads?.() ?? []).filter((pad): pad is Gamepad => pad != null);
  } catch {
    return [];
  }
}

function sampleOf(pad: Gamepad): PadSample {
  return {
    buttons: pad.buttons.map((button) => button.value),
    axes: Array.from(pad.axes),
  };
}
