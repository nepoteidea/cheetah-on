// Playfield layout in world units. The world is always 1000 units tall and as wide as the
// screen's aspect ratio requires, so the rug fills the whole screen on any phone.

import { bounds, cheetahDistance } from './cheetah.js';

export const WORLD_HEIGHT = 1000;
export const TRIM = 16; // light salmon outer trim
export const FRAME = 64; // hot-pink frame
export const BORDER = TRIM + FRAME;
export const BALL_RADIUS = 14;
/** Width of the cheetah's dark outline; touching the drawn outline counts as touching it. */
export const OUTLINE = 4;

const CHEETAH_MARGIN = 70; // minimum green gap around the cheetah
const MAX_CHEETAH_SCALE = 1.1;

export function createLayout(screenWidth, screenHeight) {
  const aspect = Math.max(1, screenWidth / Math.max(1, screenHeight));
  const width = WORLD_HEIGHT * aspect;
  const height = WORLD_HEIGHT;

  const availW = width - 2 * (BORDER + CHEETAH_MARGIN);
  const availH = height - 2 * (BORDER + CHEETAH_MARGIN);
  const scale = Math.min(MAX_CHEETAH_SCALE, availW / bounds.width, availH / bounds.height);

  // Centered horizontally; standing so its paws are just above the bottom border.
  const offsetX = width / 2 - (scale * (bounds.minX + bounds.maxX)) / 2;
  const offsetY = height - BORDER - CHEETAH_MARGIN - scale * bounds.maxY;

  const layout = {
    width,
    height,
    pxPerUnit: screenHeight / WORLD_HEIGHT,
    inner: { left: BORDER, top: BORDER, right: width - BORDER, bottom: height - BORDER },
    cheetah: { scale, offsetX, offsetY },
    ballRadius: BALL_RADIUS,
  };
  layout.spawn = findSpawn(layout);
  return layout;
}

export function toLocal(layout, x, y) {
  const { scale, offsetX, offsetY } = layout.cheetah;
  return [(x - offsetX) / scale, (y - offsetY) / scale];
}

/** Distance in world units from a point to the cheetah's silhouette (0 when inside). */
export function distanceToCheetah(layout, x, y) {
  const [lx, ly] = toLocal(layout, x, y);
  return cheetahDistance(lx, ly) * layout.cheetah.scale;
}

export function distanceToBorder(layout, x, y) {
  const { left, top, right, bottom } = layout.inner;
  return Math.min(x - left, right - x, y - top, bottom - y);
}

/** What the ball at (x, y) is touching, if anything: 'border', 'cheetah' or null. */
export function hitTest(layout, x, y) {
  const r = layout.ballRadius;
  if (distanceToBorder(layout, x, y) <= r) return 'border';
  if (distanceToCheetah(layout, x, y) <= r + OUTLINE) return 'cheetah';
  return null;
}

/**
 * Picks the starting point: on the vertical center line, in the open strip above the
 * cheetah's back, as far as possible from both the cheetah and the border.
 */
export function findSpawn(layout) {
  const x = layout.width / 2;
  let best = { x, y: layout.inner.top + layout.ballRadius * 4, clearance: -Infinity };
  for (let y = layout.inner.top; y <= layout.inner.bottom; y += 4) {
    const toCheetah = distanceToCheetah(layout, x, y);
    if (toCheetah === 0) break; // reached the cheetah's back; don't spawn underneath it
    const clearance = Math.min(distanceToBorder(layout, x, y), toCheetah);
    if (clearance > best.clearance) best = { x, y, clearance };
  }
  return { x: best.x, y: best.y };
}
