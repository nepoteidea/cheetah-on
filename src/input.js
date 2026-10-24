// Turns device orientation (or the keyboard, on desktop) into a tilt vector in screen
// space: x > 0 rolls the ball right, y > 0 rolls it down. Each component is in [-1, 1].

const FULL_TILT = Math.sin(Math.PI / 4); // tilting 45° from rest gives full acceleration
const KEY_TILT = 0.35;
const RAD = Math.PI / 180;

/**
 * The direction gravity pulls along the screen, from DeviceOrientation beta/gamma
 * (degrees). Returns screen-space components (x right, y down) of the unit gravity
 * vector, for the given screen rotation angle.
 *
 * Working from the gravity vector rather than raw angles keeps tilt responsive however
 * the phone is held: Euler angles barely change when a phone held upright is tilted.
 */
export function screenGravity(beta, gamma, angle) {
  const b = beta * RAD;
  const g = gamma * RAD;
  // Gravity in the device frame (x right, y up along the portrait screen), per the
  // DeviceOrientation spec's Z-X'-Y'' rotation order.
  const dx = Math.cos(b) * Math.sin(g);
  const dy = -Math.sin(b);
  switch (((angle % 360) + 360) % 360) {
    case 90: // device top on the left
      return { x: -dy, y: -dx };
    case 180:
      return { x: -dx, y: dy };
    case 270: // device top on the right
      return { x: dy, y: dx };
    default:
      return { x: dx, y: -dy };
  }
}

/**
 * The rotation the game is actually displayed at. In a portrait viewport the stage is
 * rotated 90° clockwise so the game always plays in landscape.
 */
export function effectiveAngle(screenAngle, portraitViewport) {
  return portraitViewport ? (screenAngle + 90) % 360 : screenAngle;
}

const clampUnit = (v) => Math.max(-1, Math.min(1, v));

/** Tilt relative to the calibrated resting position, normalised to [-1, 1]. */
export function tiltFromOrientation(reading, baseline, angle) {
  const now = screenGravity(reading.beta, reading.gamma, angle);
  const rest = baseline ? screenGravity(baseline.beta, baseline.gamma, angle) : { x: 0, y: 0 };
  return { x: clampUnit((now.x - rest.x) / FULL_TILT), y: clampUnit((now.y - rest.y) / FULL_TILT) };
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
