import { describe, expect, it } from 'vitest';
import { isTiltKey, screenGravity, tiltFromKeys, tiltFromOrientation } from '../../src/input.js';

describe('screenGravity', () => {
  const close = (v, x, y) => {
    expect(v.x).toBeCloseTo(x);
    expect(v.y).toBeCloseTo(y);
  };

  it('is zero in the screen plane when the phone lies flat', () => {
    for (const angle of [0, 90, 180, 270]) close(screenGravity(0, 0, angle), 0, 0);
  });

  it('portrait: raising the top edge pulls down, dipping the right edge pulls right', () => {
    close(screenGravity(30, 0, 0), 0, 0.5);
    close(screenGravity(0, 30, 0), 0.5, 0);
  });

  it('landscape (90°, top on the left): raising the left side pulls right', () => {
    close(screenGravity(30, 0, 90), 0.5, 0);
    close(screenGravity(0, 30, 90), 0, -0.5);
  });

  it('upside-down portrait (180°) and landscape (270° / -90°)', () => {
    close(screenGravity(30, 0, 180), 0, -0.5);
    close(screenGravity(30, 0, 270), -0.5, 0);
    close(screenGravity(0, 30, -90), 0, 0.5);
  });

  it('a phone held upright still responds to tilting', () => {
    // Landscape, held at 70° from flat (gamma ≈ -70): tipping it 10° further to the
    // side (beta) must still produce a clear sideways pull.
    const rest = screenGravity(0, -70, 90);
    const tipped = screenGravity(10, -70, 90);
    expect(tipped.x - rest.x).toBeGreaterThan(0.15);
  });
});

describe('tiltFromOrientation', () => {
  it('is zero at the calibrated resting position', () => {
    const rest = { beta: 35, gamma: -5 };
    const t = tiltFromOrientation(rest, rest, 0);
    expect(t.x).toBeCloseTo(0);
    expect(t.y).toBeCloseTo(0);
  });

  it('is relative to the baseline: 45° from rest is full tilt', () => {
    const t = tiltFromOrientation({ beta: 0, gamma: 45 }, { beta: 0, gamma: 0 }, 0);
    expect(t.x).toBeCloseTo(1);
    expect(t.y).toBeCloseTo(0);
  });

  it('clamps extreme tilts to ±1', () => {
    expect(tiltFromOrientation({ beta: 0, gamma: 80 }, null, 0).x).toBe(1);
    expect(tiltFromOrientation({ beta: -80, gamma: 0 }, null, 0).y).toBe(-1);
  });

  it('gives proportional values for small tilts', () => {
    const t = tiltFromOrientation({ beta: 10, gamma: 0 }, { beta: 0, gamma: 0 }, 0);
    expect(t.y).toBeGreaterThan(0.2);
    expect(t.y).toBeLessThan(0.3);
  });

  it('responds when calibrated with the phone held upright in landscape', () => {
    const rest = { beta: 0, gamma: -65 };
    const t = tiltFromOrientation({ beta: 12, gamma: -65 }, rest, 90);
    expect(t.x).toBeGreaterThan(0.2);
  });
});

describe('keyboard', () => {
  it('recognises arrows and WASD', () => {
    expect(isTiltKey('ArrowUp')).toBe(true);
    expect(isTiltKey('KeyD')).toBe(true);
    expect(isTiltKey('Space')).toBe(false);
  });
  it('maps held keys to a fixed tilt', () => {
    expect(tiltFromKeys(new Set())).toEqual({ x: 0, y: 0 });
    expect(tiltFromKeys(new Set(['ArrowRight', 'KeyS']))).toEqual({ x: 0.35, y: 0.35 });
    expect(tiltFromKeys(new Set(['KeyA', 'ArrowUp']))).toEqual({ x: -0.35, y: -0.35 });
  });
  it('cancels opposite keys and ignores unknown ones', () => {
    const t = tiltFromKeys(new Set(['ArrowLeft', 'ArrowRight', 'KeyQ']));
    expect(t.x).toBe(0);
    expect(t.y).toBe(0);
  });
});
