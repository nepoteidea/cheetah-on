// The cheetah silhouette, in local units (origin near the middle of the torso, y down,
// facing right). The same shapes are used for drawing and for collision, so the ball
// collides with exactly what the player sees: tail, ears, paws and the gaps between legs.

import {
  distToCapsule,
  distToPolygon,
  ellipsePolygon,
  mulberry32,
  smoothClosed,
  smoothOpen,
} from './geometry.js';

const LEG_RADIUS = 21;
const TAIL_RADIUS = 13;

const torso = smoothClosed([
  [250, -125],
  [120, -142],
  [-60, -132],
  [-220, -142],
  [-300, -100],
  [-312, -20],
  [-262, 40],
  [-150, 28],
  [0, 46],
  [150, 72],
  [262, 42],
  [302, -40],
]);

const neck = smoothClosed([
  [228, -122],
  [318, -205],
  [392, -172],
  [334, -28],
  [258, 22],
]);

const head = ellipsePolygon(398, -196, 62, 48, 40, -0.08);
const snout = ellipsePolygon(452, -176, 42, 30, 32, 0.1);
const earBack = smoothClosed(
  [
    [352, -226],
    [360, -266],
    [388, -236],
  ],
  6,
);
const earFront = smoothClosed(
  [
    [394, -238],
    [412, -270],
    [428, -232],
  ],
  6,
);

// Walking pose: near legs are a little forward of the far ones.
const legs = [
  // front near
  [
    [252, 0],
    [286, 150],
    [302, 298],
  ],
  // front far
  [
    [192, 12],
    [170, 160],
    [148, 298],
  ],
  // hind near
  [
    [-250, 0],
    [-200, 140],
    [-252, 222],
    [-238, 298],
  ],
  // hind far
  [
    [-176, 12],
    [-126, 140],
    [-166, 222],
    [-136, 298],
  ],
].map((control) => smoothOpen(control, 6));

const paws = legs.map((leg) => {
  const [x, y] = leg[leg.length - 1];
  return ellipsePolygon(x + 12, y + 8, 28, 14, 24);
});

// Long tail curling up on the left.
const tail = smoothOpen(
  [
    [-292, -84],
    [-360, -62],
    [-422, -72],
    [-466, -122],
    [-480, -192],
    [-460, -246],
    [-420, -266],
    [-386, -246],
    [-380, -214],
  ],
  6,
);

export const shapes = [
  { kind: 'capsule', part: 'tail', points: tail, radius: TAIL_RADIUS },
  // Far-side legs (odd indices) are drawn a shade darker for depth.
  ...legs.map((points, i) => ({
    kind: 'capsule',
    part: 'leg',
    points,
    radius: LEG_RADIUS,
    far: i % 2 === 1,
  })),
  ...paws.map((points, i) => ({ kind: 'polygon', part: 'paw', points, far: i % 2 === 1 })),
  { kind: 'polygon', part: 'torso', points: torso },
  { kind: 'polygon', part: 'neck', points: neck },
  { kind: 'polygon', part: 'ear', points: earBack },
  { kind: 'polygon', part: 'ear', points: earFront },
  { kind: 'polygon', part: 'head', points: head },
  { kind: 'polygon', part: 'head', points: snout },
];

/** Distance (local units) from a point to the cheetah silhouette; 0 when inside it. */
export function cheetahDistance(x, y) {
  let best = Infinity;
  for (const shape of shapes) {
    const d =
      shape.kind === 'capsule'
        ? distToCapsule(x, y, shape.points, shape.radius)
        : distToPolygon(x, y, shape.points);
    if (d < best) best = d;
    if (best === 0) break;
  }
  return best;
}

function computeBounds() {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const shape of shapes) {
    const pad = shape.radius ?? 0;
    for (const [x, y] of shape.points) {
      minX = Math.min(minX, x - pad);
      minY = Math.min(minY, y - pad);
      maxX = Math.max(maxX, x + pad);
      maxY = Math.max(maxY, y + pad);
    }
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

export const bounds = computeBounds();

function isHead(x, y) {
  return distToPolygon(x, y, head) === 0 || distToPolygon(x, y, snout) === 0;
}

function generateSpots() {
  const rand = mulberry32(14);
  const spots = [];
  const step = 34;
  for (let y = bounds.minY; y <= bounds.maxY; y += step) {
    for (let x = bounds.minX; x <= bounds.maxX; x += step) {
      const sx = x + (rand() - 0.5) * step * 0.8;
      const sy = y + (rand() - 0.5) * step * 0.8;
      const r = 6 + rand() * 7;
      if (cheetahDistance(sx, sy) === 0 && !isHead(sx, sy)) spots.push({ x: sx, y: sy, r });
    }
  }
  return spots;
}

export const spots = generateSpots();

/** Facial features, drawn on top of the fill. Purely decorative. */
export const face = {
  eye: { x: 414, y: -206, rx: 9, ry: 7 },
  nose: [
    [482, -190],
    [494, -182],
    [484, -172],
  ],
  tearLine: [
    [410, -198],
    [418, -176],
    [440, -160],
  ],
  mouth: [
    [470, -160],
    [452, -154],
  ],
  tailTip: tail.slice(-8),
};
