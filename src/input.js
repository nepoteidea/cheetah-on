// Turns device orientation (or the keyboard, on desktop) into a tilt vector in screen
// space: x > 0 rolls the ball right, y > 0 rolls it down. Each component is in [-1, 1].

const MAX_TILT_DEG = 45;
const KEY_TILT = 0.35;

/**
 * Maps DeviceOrientation beta/gamma (degrees, in the device's portrait frame) to tilt in
 * degrees along the screen's x/y axes, for the given screen rotation angle.
 */
export function screenTilt(beta, gamma, angle) {
  switch (((angle % 360) + 360) % 360) {
    case 90:
      return { x: beta, y: -gamma };
    case 180:
      return { x: -gamma, y: -beta };
    case 270:
      return { x: -beta, y: gamma };
    default:
      return { x: gamma, y: beta };
  }
}

/**
 * The rotation the game is actually displayed at. In a portrait viewport the stage is
 * rotated 90° clockwise so the game always plays in landscape.
 */
export function effectiveAngle(screenAngle, portraitViewport) {
  return portraitViewport ? (screenAngle + 90) % 360 : screenAngle;
}

function toUnit(deg) {
  const clamped = Math.max(-MAX_TILT_DEG, Math.min(MAX_TILT_DEG, deg));
  return Math.sin((clamped * Math.PI) / 180) / Math.sin((MAX_TILT_DEG * Math.PI) / 180);
}

/** Tilt relative to the calibrated resting position, normalised to [-1, 1]. */
export function tiltFromOrientation(reading, baseline, angle) {
  const now = screenTilt(reading.beta, reading.gamma, angle);
  const rest = baseline ? screenTilt(baseline.beta, baseline.gamma, angle) : { x: 0, y: 0 };
  return { x: toUnit(now.x - rest.x), y: toUnit(now.y - rest.y) };
}

const KEYS = {
  ArrowLeft: [-1, 0],
  KeyA: [-1, 0],
  ArrowRight: [1, 0],
  KeyD: [1, 0],
  ArrowUp: [0, -1],
  KeyW: [0, -1],
  ArrowDown: [0, 1],
  KeyS: [0, 1],
};

export function isTiltKey(code) {
  return code in KEYS;
}

/** Keyboard fallback: each held arrow/WASD key tilts the board a fixed amount. */
export function tiltFromKeys(pressed) {
  let x = 0;
  let y = 0;
  for (const code of pressed) {
    const dir = KEYS[code];
    if (dir) {
      x += dir[0];
      y += dir[1];
    }
  }
  return { x: Math.sign(x) * KEY_TILT, y: Math.sign(y) * KEY_TILT };
}
