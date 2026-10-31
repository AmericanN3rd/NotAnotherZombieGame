/**
 * W3C "standard" gamepad mapping, which is the Xbox layout in Chromium and Firefox:
 * A B X Y, LB RB LT RT, Back, Start, L3 R3, D-pad up down left right.
 * Sticks: axes 0/1 are the left stick, Y negative is up.
 */

export const PAD = {
  A: 0,
  B: 1,
  X: 2,
  Y: 3,
  LB: 4,
  RB: 5,
  LT: 6,
  RT: 7,
  BACK: 8,
  START: 9,
  L3: 10,
  R3: 11,
  UP: 12,
  DOWN: 13,
  LEFT: 14,
  RIGHT: 15,
} as const;

export const STICK_DEADZONE = 0.22;
export const BUTTON_PRESS = 0.45;

export interface PadSample {
  buttons: number[];
  axes: number[];
}

export interface PadReading {
  /** -1 left, +1 right. D-pad wins over a partial stick. */
  moveX: number;
  /** -1 up, +1 down, matching the touch stick. */
  moveY: number;
  jump: boolean;
  melee: boolean;
  fire: boolean;
  reload: boolean;
  interact: boolean;
  pause: boolean;
  flare: boolean;
  /** View / Back. Opens the pack. */
  gear: boolean;
  up: boolean;
  down: boolean;
}

export function stickAxis(value: number): number {
  const abs = Math.abs(value);
  if (abs < STICK_DEADZONE) return 0;
  const scaled = (abs - STICK_DEADZONE) / (1 - STICK_DEADZONE);
  return Math.sign(value) * Math.min(1, scaled);
}

function down(buttons: number[], index: number): boolean {
  return (buttons[index] ?? 0) >= BUTTON_PRESS;
}

/** Map one standard-layout sample to actions. Edges are the input class's job. */
export function readStandardPad(sample: PadSample): PadReading {
  const buttons = sample.buttons;
  let moveX = stickAxis(sample.axes[0] ?? 0);
  let moveY = stickAxis(sample.axes[1] ?? 0);
  if (down(buttons, PAD.LEFT)) moveX = -1;
  if (down(buttons, PAD.RIGHT)) moveX = 1;
  if (down(buttons, PAD.UP)) moveY = -1;
  if (down(buttons, PAD.DOWN)) moveY = 1;

  const up = moveY < -0.45;
  const downY = moveY > 0.45;
  return {
    moveX,
    moveY,
    jump: down(buttons, PAD.A),
    melee: down(buttons, PAD.X),
    fire: down(buttons, PAD.RT),
    reload: down(buttons, PAD.Y) || down(buttons, PAD.RB),
    interact: down(buttons, PAD.B),
    pause: down(buttons, PAD.START),
    flare: down(buttons, PAD.LB),
    gear: down(buttons, PAD.BACK),
    up,
    down: downY,
  };
}

export function padInUse(sample: PadSample): boolean {
  const reading = readStandardPad(sample);
  if (reading.moveX !== 0 || reading.moveY !== 0) return true;
  return (
    reading.jump ||
    reading.melee ||
    reading.fire ||
    reading.reload ||
    reading.interact ||
    reading.pause ||
    reading.flare ||
    down(sample.buttons, PAD.BACK)
  );
}

export function emptyPad(): PadReading {
  return {
    moveX: 0,
    moveY: 0,
    jump: false,
    melee: false,
    fire: false,
    reload: false,
    interact: false,
    pause: false,
    flare: false,
    gear: false,
    up: false,
    down: false,
  };
}
