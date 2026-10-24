// Game state and ball physics. Pure: no DOM, no timers — the caller supplies dt and tilt.

import { hitTest } from './field.js';

export const GRAVITY = 2600; // world units / s² at full tilt
export const FRICTION = 0.6; // velocity decay per second (rolling resistance)
export const MAX_SPEED = 1400;
export const STEP = 1 / 240; // physics substep; small enough that the ball can't tunnel

export function createGame(layout) {
  return {
    state: 'ready', // 'ready' | 'playing' | 'lost'
    layout,
    ball: { x: layout.spawn.x, y: layout.spawn.y, vx: 0, vy: 0 },
    lossReason: null,
    elapsed: 0,
  };
}

export function start(game) {
  game.state = 'playing';
  game.ball = { x: game.layout.spawn.x, y: game.layout.spawn.y, vx: 0, vy: 0 };
  game.lossReason = null;
  game.elapsed = 0;
  return game;
}

/** Advances the game by `dt` seconds under the given tilt. Returns the game. */
export function update(game, dt, tilt) {
  if (game.state !== 'playing') return game;
  let remaining = Math.min(dt, 0.1);
  while (remaining > 1e-9 && game.state === 'playing') {
    const h = Math.min(STEP, remaining);
    remaining -= h;
    integrate(game.ball, h, tilt);
    game.elapsed += h;
    const hit = hitTest(game.layout, game.ball.x, game.ball.y);
    if (hit) {
      game.state = 'lost';
      game.lossReason = hit;
    }
  }
  return game;
}

export function integrate(ball, h, tilt) {
  ball.vx += tilt.x * GRAVITY * h;
  ball.vy += tilt.y * GRAVITY * h;
  const decay = Math.exp(-FRICTION * h);
  ball.vx *= decay;
  ball.vy *= decay;
  const speed = Math.hypot(ball.vx, ball.vy);
  if (speed > MAX_SPEED) {
    ball.vx *= MAX_SPEED / speed;
    ball.vy *= MAX_SPEED / speed;
  }
  ball.x += ball.vx * h;
  ball.y += ball.vy * h;
}
