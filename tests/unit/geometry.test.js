import { describe, expect, it } from 'vitest';
import {
  distToCapsule,
  distToPolygon,
  distToPolyline,
  distToSegment,
  ellipsePolygon,
  mulberry32,
  pointInPolygon,
  smoothClosed,
  smoothOpen,
} from '../../src/geometry.js';

const square = [
  [0, 0],
  [10, 0],
  [10, 10],
  [0, 10],
];

describe('distToSegment', () => {
  it('measures perpendicular distance inside the segment', () => {
    expect(distToSegment(5, 3, 0, 0, 10, 0)).toBe(3);
  });
  it('measures to the nearest endpoint beyond the segment', () => {
    expect(distToSegment(13, 4, 0, 0, 10, 0)).toBe(5);
    expect(distToSegment(-3, -4, 0, 0, 10, 0)).toBe(5);
  });
  it('handles zero-length segments', () => {
    expect(distToSegment(3, 4, 0, 0, 0, 0)).toBe(5);
  });
});

describe('distToPolyline', () => {
  it('takes the nearest segment', () => {
    const line = [
      [0, 0],
      [10, 0],
      [10, 10],
    ];
    expect(distToPolyline(12, 5, line)).toBe(2);
  });
  it('treats a single point as a point', () => {
    expect(distToPolyline(3, 4, [[0, 0]])).toBe(5);
  });
});

describe('pointInPolygon / distToPolygon', () => {
  it('detects inside and outside points', () => {
    expect(pointInPolygon(5, 5, square)).toBe(true);
    expect(pointInPolygon(15, 5, square)).toBe(false);
  });
  it('is 0 inside and the edge distance outside', () => {
    expect(distToPolygon(5, 5, square)).toBe(0);
    expect(distToPolygon(13, 5, square)).toBe(3);
  });
  it('works for concave polygons', () => {
    const u = [
      [0, 0],
      [3, 0],
      [3, 8],
      [7, 8],
      [7, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ];
    expect(pointInPolygon(5, 4, u)).toBe(false); // inside the notch
    expect(distToPolygon(5, 4, u)).toBe(2);
  });
});

describe('distToCapsule', () => {
  it('subtracts the radius and never goes negative', () => {
    const pts = [
      [0, 0],
      [10, 0],
    ];
    expect(distToCapsule(5, 8, pts, 3)).toBe(5);
    expect(distToCapsule(5, 1, pts, 3)).toBe(0);
  });
});

describe('ellipsePolygon', () => {
  it('samples points on the ellipse', () => {
    const pts = ellipsePolygon(10, 20, 5, 2, 4);
    expect(pts).toHaveLength(4);
    expect(pts[0][0]).toBeCloseTo(15);
    expect(pts[0][1]).toBeCloseTo(20);
    expect(pts[1][0]).toBeCloseTo(10);
    expect(pts[1][1]).toBeCloseTo(22);
  });
  it('supports rotation', () => {
    const [first] = ellipsePolygon(0, 0, 5, 2, 4, Math.PI / 2);
    expect(first[0]).toBeCloseTo(0);
    expect(first[1]).toBeCloseTo(5);
  });
});

describe('splines', () => {
  it('closed spline passes through every control point', () => {
    const pts = smoothClosed(square, 4);
    expect(pts).toHaveLength(16);
    for (let i = 0; i < 4; i++) expect(pts[i * 4]).toEqual(square[i]);
  });
  it('open spline starts and ends on the control points', () => {
    const ctrl = [
      [0, 0],
      [10, 5],
      [20, 0],
    ];
    const pts = smoothOpen(ctrl, 5);
    expect(pts).toHaveLength(11);
    expect(pts[0]).toEqual([0, 0]);
    expect(pts[5]).toEqual([10, 5]);
    expect(pts.at(-1)).toEqual([20, 0]);
  });
  it('open spline with fewer than 3 points copies them', () => {
    const ctrl = [
      [0, 0],
      [1, 1],
    ];
    const pts = smoothOpen(ctrl);
    expect(pts).toEqual(ctrl);
    expect(pts[0]).not.toBe(ctrl[0]);
  });
});

describe('mulberry32', () => {
  it('is deterministic and in [0, 1)', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
