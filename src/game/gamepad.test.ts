import { describe, expect, it } from 'vitest';
import { PAD, emptyPad, padInUse, readStandardPad, stickAxis, type PadSample } from './gamepad';

function sample(patch: Partial<PadSample> & { press?: number[] } = {}): PadSample {
  const buttons = Array.from({ length: 16 }, () => 0);
  for (const index of patch.press ?? []) buttons[index] = 1;
  return { buttons, axes: patch.axes ?? [0, 0, 0, 0] };
}

describe('standard Xbox mapping', () => {
  it('leaves a resting pad at zero', () => {
    expect(readStandardPad(sample())).toEqual(emptyPad());
    expect(padInUse(sample())).toBe(false);
  });

  it('ignores stick drift inside the deadzone', () => {
    expect(stickAxis(0.1)).toBe(0);
    expect(readStandardPad(sample({ axes: [0.1, -0.1, 0, 0] })).moveX).toBe(0);
    expect(padInUse(sample({ axes: [0.1, 0.1, 0, 0] }))).toBe(false);
  });

  it('reads the left stick and lets the D-pad override it', () => {
    const stick = readStandardPad(sample({ axes: [-0.5, 0.8, 0, 0] }));
    expect(stick.moveX).toBeLessThan(0);
    expect(stick.moveY).toBeGreaterThan(0);
    expect(stick.up).toBe(false);
    expect(stick.down).toBe(true);

    const dpad = readStandardPad(sample({ axes: [1, 1, 0, 0], press: [PAD.LEFT, PAD.UP] }));
    expect(dpad.moveX).toBe(-1);
    expect(dpad.moveY).toBe(-1);
    expect(dpad.up).toBe(true);
  });

  it('maps the face buttons, triggers, and shoulders', () => {
    expect(readStandardPad(sample({ press: [PAD.A] })).jump).toBe(true);
    expect(readStandardPad(sample({ press: [PAD.B] })).interact).toBe(true);
    expect(readStandardPad(sample({ press: [PAD.X] })).melee).toBe(true);
    expect(readStandardPad(sample({ press: [PAD.Y] })).reload).toBe(true);
    expect(readStandardPad(sample({ press: [PAD.RB] })).reload).toBe(true);
    expect(readStandardPad(sample({ press: [PAD.RT] })).fire).toBe(true);
    expect(readStandardPad(sample({ press: [PAD.LB] })).flare).toBe(true);
    expect(readStandardPad(sample({ press: [PAD.START] })).pause).toBe(true);
    expect(readStandardPad(sample({ press: [PAD.A] })).melee).toBe(false);
    expect(readStandardPad(sample({ press: [PAD.RT] })).jump).toBe(false);
  });

  it('treats a half-pulled trigger as a press and a light one as idle', () => {
    const buttons = Array.from({ length: 16 }, () => 0);
    buttons[PAD.RT] = 0.5;
    expect(readStandardPad({ buttons, axes: [] }).fire).toBe(true);
    buttons[PAD.RT] = 0.2;
    expect(readStandardPad({ buttons, axes: [] }).fire).toBe(false);
    expect(padInUse({ buttons, axes: [0, 0] })).toBe(false);
  });
});
