import { describe, expect, it } from 'vitest';
import {
  effectiveAngle,
  isTiltKey,
  screenTilt,
  tiltFromKeys,
  tiltFromOrientation,
} from '../../src/input.js';

describe('screenTilt', () => {
  it('portrait: gamma is x, beta is y', () => {
    expect(screenTilt(10, 20, 0)).toEqual({ x: 20, y: 10 });
  });
  it('landscape (90°): raising the left side rolls right', () => {
    expect(screenTilt(10, 20, 90)).toEqual({ x: 10, y: -20 });
  });
  it('upside-down portrait (180°)', () => {
    expect(screenTilt(10, 20, 180)).toEqual({ x: -20, y: -10 });
  });
  it('landscape (270° and -90°)', () => {
    expect(screenTilt(10, 20, 270)).toEqual({ x: -10, y: 20 });
    expect(screenTilt(10, 20, -90)).toEqual({ x: -10, y: 20 });
  });
});

describe('effectiveAngle', () => {
  it('adds 90° when the stage is rotated in a portrait viewport', () => {
    expect(effectiveAngle(0, true)).toBe(90);
    expect(effectiveAngle(270, true)).toBe(0);
    expect(effectiveAngle(90, false)).toBe(90);
  });
});

describe('tiltFromOrientation', () => {
  it('is zero at the calibrated resting position', () => {
    const rest = { beta: 35, gamma: -5 };
    const t = tiltFromOrientation(rest, rest, 0);
    expect(t.x).toBeCloseTo(0);
    expect(t.y).toBeCloseTo(0);
  });
  it('is relative to the baseline and normalised', () => {
    const t = tiltFromOrientation({ beta: 35, gamma: 40 }, { beta: 35, gamma: -5 }, 0);
    expect(t.x).toBeCloseTo(1);
    expect(t.y).toBeCloseTo(0);
  });
  it('clamps extreme tilts to ±1', () => {
    const t = tiltFromOrientation({ beta: -80, gamma: 89 }, null, 0);
    expect(t).toEqual({ x: 1, y: -1 });
  });
  it('gives proportional values for small tilts', () => {
    const t = tiltFromOrientation({ beta: 10, gamma: 0 }, { beta: 0, gamma: 0 }, 0);
    expect(t.y).toBeGreaterThan(0.2);
    expect(t.y).toBeLessThan(0.3);
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
