import { clamp } from './geom';

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
}

const EDGE_KEYS = ['jump', 'melee', 'fire', 'reload', 'interact', 'pause', 'flare'] as const;
type EdgeName = (typeof EDGE_KEYS)[number];

/**
 * Keyboard and touch write into one frame. Edges are consumed by the scene
 * so a held key doesn't repeat and a shop menu can't leak a reload into the world.
 */
export class Input {
  private left = false;
  private right = false;
  private keyUp = false;
  private keyDown = false;
  private joyX = 0;
  private joyY = 0;
  private jumpHeld = false;
  private interactHeld = false;
  private edges: Record<EdgeName, boolean> = {
    jump: false,
    melee: false,
    fire: false,
    reload: false,
    interact: false,
    pause: false,
    flare: false,
  };

  constructor() {
    window.addEventListener('keydown', (event) => this.onKey(event, true));
    window.addEventListener('keyup', (event) => this.onKey(event, false));
    window.addEventListener('blur', () => this.releaseAll());
  }

  setJoy(x: number, y: number): void {
    this.joyX = clamp(x, -1, 1);
    this.joyY = clamp(y, -1, 1);
  }

  /** y is negative upward, matching the stick. */
  get joyVector(): { x: number; y: number } {
    return { x: this.joyX, y: this.joyY };
  }

  press(name: EdgeName, held = true): void {
    this.edges[name] = true;
    if (name === 'jump') this.jumpHeld = held;
    if (name === 'interact') this.interactHeld = held;
  }

  release(name: 'jump' | 'interact'): void {
    if (name === 'jump') this.jumpHeld = false;
    if (name === 'interact') this.interactHeld = false;
  }

  consume(): Frame {
    const frame: Frame = {
      axisX: clamp((this.left ? -1 : 0) + (this.right ? 1 : 0) + this.joyX, -1, 1),
      keyUp: this.keyUp,
      keyDown: this.keyDown,
      joyUp: this.joyY < -0.42,
      joyDown: this.joyY > 0.42,
      jumpEdge: this.edges.jump,
      jumpHeld: this.jumpHeld,
      meleeEdge: this.edges.melee,
      fireEdge: this.edges.fire,
      reloadEdge: this.edges.reload,
      interactEdge: this.edges.interact,
      interactHeld: this.interactHeld,
      pauseEdge: this.edges.pause,
      flareEdge: this.edges.flare,
    };
    for (const key of EDGE_KEYS) this.edges[key] = false;
    return frame;
  }

  private releaseAll(): void {
    this.left = false;
    this.right = false;
    this.keyUp = false;
    this.keyDown = false;
    this.joyX = 0;
    this.joyY = 0;
    this.jumpHeld = false;
    this.interactHeld = false;
  }

  private onKey(event: KeyboardEvent, down: boolean): void {
    const mapped = mapKey(event.code);
    if (!mapped) return;
    event.preventDefault();
    if (down && event.repeat) return;
    if (mapped === 'left') this.left = down;
    else if (mapped === 'right') this.right = down;
    else if (mapped === 'up') this.keyUp = down;
    else if (mapped === 'down') this.keyDown = down;
    else if (mapped === 'jump') {
      if (down) this.edges.jump = true;
      this.jumpHeld = down;
    } else if (mapped === 'interact') {
      if (down) this.edges.interact = true;
      this.interactHeld = down;
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
