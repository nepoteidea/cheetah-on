// 2D geometry helpers. Polygons are arrays of [x, y] pairs.

export function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export function distToPolyline(px, py, points) {
  if (points.length === 1) return Math.hypot(px - points[0][0], py - points[0][1]);
  let best = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, ay] = points[i];
    const [bx, by] = points[i + 1];
    best = Math.min(best, distToSegment(px, py, ax, ay, bx, by));
  }
  return best;
}

export function pointInPolygon(px, py, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Distance from a point to a filled polygon: 0 when inside, edge distance otherwise. */
export function distToPolygon(px, py, polygon) {
  if (pointInPolygon(px, py, polygon)) return 0;
  let best = Infinity;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [ax, ay] = polygon[j];
    const [bx, by] = polygon[i];
    best = Math.min(best, distToSegment(px, py, ax, ay, bx, by));
  }
  return best;
}

/** Distance from a point to a capsule chain (a polyline thickened by `radius`). */
export function distToCapsule(px, py, points, radius) {
  return Math.max(0, distToPolyline(px, py, points) - radius);
}

export function ellipsePolygon(cx, cy, rx, ry, segments = 32, rotation = 0) {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const out = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const x = Math.cos(a) * rx;
    const y = Math.sin(a) * ry;
    out.push([cx + x * cos - y * sin, cy + x * sin + y * cos]);
  }
  return out;
}

/** Samples a closed Catmull-Rom spline through the control points into a dense polygon. */
export function smoothClosed(control, samplesPerSegment = 8) {
  const n = control.length;
  const out = [];
  for (let i = 0; i < n; i++) {
    const p0 = control[(i - 1 + n) % n];
    const p1 = control[i];
    const p2 = control[(i + 1) % n];
    const p3 = control[(i + 2) % n];
    for (let s = 0; s < samplesPerSegment; s++) {
      const t = s / samplesPerSegment;
      out.push(catmullRom(p0, p1, p2, p3, t));
    }
  }
  return out;
}

/** Samples an open Catmull-Rom spline that passes through every control point. */
export function smoothOpen(control, samplesPerSegment = 6) {
  const n = control.length;
  if (n < 3) return control.map((p) => [...p]);
  const out = [];
  for (let i = 0; i < n - 1; i++) {
    const p0 = control[Math.max(0, i - 1)];
    const p1 = control[i];
    const p2 = control[i + 1];
    const p3 = control[Math.min(n - 1, i + 2)];
    for (let s = 0; s < samplesPerSegment; s++) {
      out.push(catmullRom(p0, p1, p2, p3, s / samplesPerSegment));
    }
  }
  out.push([...control[n - 1]]);
  return out;
}

function catmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  const f = (a, b, c, d) =>
    0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  return [f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])];
}

/** Deterministic PRNG so decorative randomness (spots, rug fibres) is stable across reloads. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
