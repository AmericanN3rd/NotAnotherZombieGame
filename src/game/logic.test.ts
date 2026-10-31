import { describe, expect, it } from 'vitest';
import { JAM_DURATION, RELOAD_DURATION, RELOAD_WINDOW, beginReload, idleReload, tickReload } from './reload';
import { attemptPurchase } from './shop';
import { createRun, gearLevel } from './state';

describe('active reload', () => {
  it('finishes slowly when you let the bar run out', () => {
    let state = beginReload(idleReload());
    const stepped = tickReload(state, RELOAD_DURATION - 0.05, false);
    expect(stepped.event).toBe('none');
    const done = tickReload(stepped.state, 0.06, false);
    expect(done.event).toBe('normal');
    expect(done.state.phase).toBe('idle');
  });

  it('cleans the gun when the second press is in the window', () => {
    const state = beginReload(idleReload());
    const mid = (RELOAD_WINDOW.start + RELOAD_WINDOW.end) / 2;
    const primed = tickReload(state, mid * RELOAD_DURATION, false);
    const hit = tickReload(primed.state, 0, true);
    expect(hit.event).toBe('perfect');
    expect(hit.state.phase).toBe('idle');
  });

  it('jams on an early press and ignores taps until the jam clears', () => {
    const state = beginReload(idleReload());
    const early = tickReload(state, 0.05, true);
    expect(early.event).toBe('jam');
    const ignored = tickReload(early.state, 0.2, true);
    expect(ignored.event).toBe('none');
    expect(ignored.state.phase).toBe('jammed');
    const cleared = tickReload(ignored.state, JAM_DURATION, false);
    expect(cleared.event).toBe('cleared');
    expect(cleared.state.phase).toBe('idle');
  });

  it('jams on a late press', () => {
    const state = beginReload(idleReload());
    const lateT = (RELOAD_WINDOW.end + 0.06) * RELOAD_DURATION;
    const primed = tickReload(state, lateT, false);
    const late = tickReload(primed.state, 0, true);
    expect(late.event).toBe('jam');
  });
});

describe('vending cache', () => {
  it('installs power once and refuses a second copy', () => {
    const run = createRun();
    const first = attemptPurchase(run, 'power', 30);
    expect(first.ok).toBe(true);
    expect(run.gunDamage).toBe(2);
    expect(run.coins).toBe(21);
    expect(gearLevel(run)).toBe(2);
    const second = attemptPurchase(run, 'power', 30);
    expect(second.ok).toBe(false);
    expect(run.coins).toBe(21);
  });

  it('stops at the floor spend limit even when the wallet could pay', () => {
    const run = createRun();
    run.coins = 80;
    expect(attemptPurchase(run, 'silencer', 30).ok).toBe(true);
    expect(attemptPurchase(run, 'compensator', 30).ok).toBe(true);
    const over = attemptPurchase(run, 'ammo', 30);
    expect(over.ok).toBe(false);
    expect(over.reason).toMatch(/30/);
    expect(run.spent[1]).toBe(30);
  });

  it('refuses a buy the wallet cannot cover', () => {
    const run = createRun();
    run.coins = 10;
    const result = attemptPurchase(run, 'power', 30);
    expect(result.ok).toBe(false);
    expect(run.owned.power).toBe(false);
  });

  it('lets ammo be bought until the limit, stacking reserve', () => {
    const run = createRun();
    expect(attemptPurchase(run, 'ammo', 30).ok).toBe(true);
    expect(attemptPurchase(run, 'ammo', 30).ok).toBe(true);
    expect(run.reserve).toBe(14);
    expect(attemptPurchase(run, 'ammo', 30).ok).toBe(true);
    expect(attemptPurchase(run, 'ammo', 30).ok).toBe(false);
  });
});
