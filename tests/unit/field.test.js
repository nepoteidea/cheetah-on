import { describe, expect, it } from 'vitest';
import { bounds } from '../../src/cheetah.js';
import {
  BALL_RADIUS,
  BORDER,
  WORLD_SHORT_SIDE,
  createLayout,
  distanceToBorder,
  distanceToCheetah,
  hitTest,
  toLocal,
} from '../../src/field.js';

const phone = createLayout(915, 412); // Pixel 7 landscape
const square = createLayout(800, 800);
const portrait = createLayout(412, 839); // Pixel 7 portrait

function cheetahWorldBox(layout) {
  const { scale, offsetX, offsetY } = layout.cheetah;
  return {
    left: offsetX + scale * bounds.minX,
    right: offsetX + scale * bounds.maxX,
    top: offsetY + scale * bounds.minY,
    bottom: offsetY + scale * bounds.maxY,
  };
}

describe('createLayout', () => {
  it('in landscape is 1000 units tall and as wide as the screen aspect', () => {
    expect(phone.height).toBe(WORLD_SHORT_SIDE);
    expect(phone.width).toBeCloseTo((WORLD_SHORT_SIDE * 915) / 412);
    expect(phone.pxPerUnit).toBeCloseTo(0.412);
  });

  it('in portrait is 1000 units wide and as tall as the screen aspect', () => {
    expect(portrait.width).toBe(WORLD_SHORT_SIDE);
    expect(portrait.height).toBeCloseTo((WORLD_SHORT_SIDE * 839) / 412);
    expect(portrait.pxPerUnit).toBeCloseTo(0.412);
  });

  it('handles a zero-sized screen', () => {
    expect(createLayout(0, 0)).toMatchObject({ width: WORLD_SHORT_SIDE, height: WORLD_SHORT_SIDE });
  });

  it('places the inner field inside the border', () => {
    expect(phone.inner).toEqual({
      left: BORDER,
      top: BORDER,
      right: phone.width - BORDER,
      bottom: WORLD_SHORT_SIDE - BORDER,
    });
  });

  it.each([
    ['phone', phone],
    ['square', square],
    ['portrait', portrait],
  ])('centers the cheetah and keeps it clear of the border (%s)', (_name, layout) => {
    const box = cheetahWorldBox(layout);
    expect((box.left + box.right) / 2).toBeCloseTo(layout.width / 2);
    expect((box.top + box.bottom) / 2).toBeCloseTo(layout.height / 2);
    expect(box.left).toBeGreaterThan(layout.inner.left + 3 * BALL_RADIUS);
    expect(box.right).toBeLessThan(layout.inner.right - 3 * BALL_RADIUS);
    expect(box.top).toBeGreaterThan(layout.inner.top + 3 * BALL_RADIUS);
    expect(box.bottom).toBeLessThan(layout.inner.bottom - 3 * BALL_RADIUS);
  });

  it('makes the cheetah large: most of the field height', () => {
    const box = cheetahWorldBox(phone);
    expect(box.bottom - box.top).toBeGreaterThan(0.6 * WORLD_SHORT_SIDE);
  });

  it('shrinks the cheetah on narrow screens so it still fits', () => {
    expect(square.cheetah.scale).toBeLessThan(phone.cheetah.scale);
    expect(portrait.cheetah.scale).toBeCloseTo(square.cheetah.scale);
  });
});

describe('toLocal', () => {
  it('inverts the cheetah transform', () => {
    const { scale, offsetX, offsetY } = phone.cheetah;
    const [x, y] = toLocal(phone, offsetX + 100 * scale, offsetY - 50 * scale);
    expect(x).toBeCloseTo(100);
    expect(y).toBeCloseTo(-50);
  });
});

describe('hitTest', () => {
  const mid = { x: phone.width / 2, y: WORLD_SHORT_SIDE / 2 };

  it('detects the ball touching each side of the border', () => {
    const r = BALL_RADIUS;
    expect(hitTest(phone, BORDER + r, 300)).toBe('border');
    expect(hitTest(phone, phone.width - BORDER - r, 300)).toBe('border');
    expect(hitTest(phone, 200, BORDER + r)).toBe('border');
    expect(hitTest(phone, 200, WORLD_SHORT_SIDE - BORDER - r)).toBe('border');
    expect(hitTest(phone, BORDER + r + 1, 300)).toBe(null);
  });

  it('detects the ball touching the cheetah', () => {
    expect(hitTest(phone, mid.x, mid.y)).toBe('cheetah');
  });

  it('counts the drawn outline as part of the cheetah', () => {
    // Walk down from above the back until the first hit; it happens just before the fill.
    let y = 150;
    while (hitTest(phone, mid.x, y) === null) y += 0.5;
    const gap = distanceToCheetah(phone, mid.x, y);
    expect(gap).toBeGreaterThan(BALL_RADIUS);
    expect(gap).toBeLessThanOrEqual(BALL_RADIUS + 4);
  });

  it('lets the ball sit in the gap under the belly', () => {
    const { offsetX, offsetY, scale } = phone.cheetah;
    expect(hitTest(phone, offsetX, offsetY + 200 * scale)).toBe(null);
  });
});

describe('spawn', () => {
  it.each([
    ['phone', phone],
    ['square', square],
    ['portrait', portrait],
  ])('is safely above the cheetah, on the center line (%s)', (_name, layout) => {
    const { x, y } = layout.spawn;
    expect(x).toBeCloseTo(layout.width / 2);
    expect(hitTest(layout, x, y)).toBe(null);
    expect(distanceToBorder(layout, x, y)).toBeGreaterThan(4 * BALL_RADIUS);
    expect(distanceToCheetah(layout, x, y)).toBeGreaterThan(4 * BALL_RADIUS);
    expect(y).toBeLessThan(layout.cheetah.offsetY);
  });
});
