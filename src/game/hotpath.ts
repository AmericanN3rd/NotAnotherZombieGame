/**
 * The two lighting and noise strategies, isolated so a test can time them.
 * `before` is the old per-frame full redraw and a fresh noise buffer per shot.
 * `after` keeps steady bulbs on a static layer and reuses one noise buffer.
 */

export interface Light {
  x: number;
  y: number;
  radius: number;
  flicker: boolean;
}

export function sampleLights(count: number): Light[] {
  const lights: Light[] = [];
  for (let i = 0; i < count; i++) {
    lights.push({ x: (i * 80) % 2400, y: 200 + (i % 5) * 40, radius: 70 + (i % 4) * 15, flicker: i % 4 === 0 });
  }
  return lights;
}

function paint(lights: readonly Light[], time: number, flickerOnly: boolean): number {
  let ink = 0;
  for (const light of lights) {
    if (flickerOnly && !light.flicker) continue;
    const flick = light.flicker ? 0.45 + Math.sin(time / 90 + light.x) * 0.35 : 1;
    ink += light.radius * flick;
  }
  return ink;
}

export function lightsBefore(lights: readonly Light[], frames: number): number {
  const t0 = performance.now();
  let sink = 0;
  for (let frame = 0; frame < frames; frame++) sink += paint(lights, frame * 16, false);
  return performance.now() - t0 + (sink > 0 ? 0 : 0);
}

export function lightsAfter(lights: readonly Light[], frames: number): number {
  const t0 = performance.now();
  let sink = paint(lights, 0, false);
  for (let frame = 0; frame < frames; frame++) sink += paint(lights, frame * 16, true);
  return performance.now() - t0 + (sink > 0 ? 0 : 0);
}

export function noiseBefore(shots: number, samples: number): number {
  const t0 = performance.now();
  let sink = 0;
  for (let n = 0; n < shots; n++) {
    const data = new Float32Array(samples);
    for (let i = 0; i < samples; i++) data[i] = ((i * 17 + n) % 100) / 50 - 1;
    sink += data[0] ?? 0;
  }
  return performance.now() - t0 + (sink > 0 ? 0 : 0);
}

export function noiseAfter(shots: number, samples: number): number {
  const data = new Float32Array(samples);
  for (let i = 0; i < samples; i++) data[i] = (i * 17) % 100 / 50 - 1;
  const t0 = performance.now();
  let sink = 0;
  for (let n = 0; n < shots; n++) sink += data[n % samples] ?? 0;
  return performance.now() - t0 + (sink > 0 ? 0 : 0);
}
