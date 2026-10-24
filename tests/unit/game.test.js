import { describe, expect, it } from 'vitest';
import { bounds } from '../../src/cheetah.js';
import { createLayout } from '../../src/field.js';
import { MAX_SPEED, createGame, integrate, start, update } from '../../src/game.js';

const layout = createLayout(915, 412);
const still = { x: 0, y: 0 };

function runUntilOver(game, tilt, seconds = 10) {
  for (let t = 0; t < seconds && game.state === 'playing'; t += 1 / 60) update(game, 1 / 60, tilt);
  return game;
}

describe('createGame / start', () => {
  it('starts ready with the ball at the spawn point', () => {
    const game = createGame(layout);
    expect(game.state).toBe('ready');
    expect(game.ball).toEqual({ x: layout.spawn.x, y: layout.spawn.y, vx: 0, vy: 0 });
  });

  it('start resets everything and begins playing', () => {
    const game = createGame(layout);
    Object.assign(game, { state: 'lost', lossReason: 'border', elapsed: 9 });
    game.ball.x = 0;
    start(game);
    expect(game.state).toBe('playing');
    expect(game.lossReason).toBe(null);
    expect(game.elapsed).toBe(0);
    expect(game.ball.x).toBe(layout.spawn.x);
  });
});

describe('update', () => {
  it('does nothing unless playing', () => {
    const game = createGame(layout);
    update(game, 1, { x: 1, y: 1 });
    expect(game.ball.x).toBe(layout.spawn.x);
    expect(game.elapsed).toBe(0);
  });

  it('keeps the ball still and alive when the phone is flat', () => {
    const game = start(createGame(layout));
    runUntilOver(game, still, 30);
    expect(game.state).toBe('playing');
    expect(game.ball.x).toBe(layout.spawn.x);
    expect(game.elapsed).toBeGreaterThan(29);
  });

  it('caps a single frame at 0.1s so a stall cannot teleport the ball', () => {
    const game = start(createGame(layout));
    update(game, 5, still);
    expect(game.elapsed).toBeCloseTo(0.1);
  });

  it('loses on the pink border when tilted toward the top', () => {
    const game = runUntilOver(start(createGame(layout)), { x: 0, y: -0.5 });
    expect(game.state).toBe('lost');
    expect(game.lossReason).toBe('border');
  });

  it("loses on the cheetah's back when tilted toward the bottom", () => {
    const game = runUntilOver(start(createGame(layout)), { x: 0, y: 0.5 });
    expect(game.lossReason).toBe('cheetah');
    expect(game.ball.y).toBeLessThan(layout.cheetah.offsetY);
  });

  it('loses on the curled tail when rolling left', () => {
    const game = runUntilOver(start(createGame(layout)), { x: -0.5, y: 0 });
    expect(game.lossReason).toBe('cheetah');
    expect(game.ball.x).toBeLessThan(layout.width / 2 - 300);
  });

  it('freezes the ball once lost', () => {
    const game = runUntilOver(start(createGame(layout)), { x: 0, y: -1 });
    const { x, y } = game.ball;
    update(game, 0.1, { x: 1, y: 1 });
    expect(game.ball).toMatchObject({ x, y });
  });

  it('lets a careful player slip under the belly and survive', () => {
    // Steer up over the ears, down the right side, along the strip under the paws, then up
    // into the open space between the front and hind legs.
    const game = start(createGame(layout));
    const { offsetX, offsetY, scale } = layout.cheetah;
    const target = (x, y) => {
      for (let i = 0; i < 2000 && game.state === 'playing'; i++) {
        const dx = x - game.ball.x;
        const dy = y - game.ball.y;
        if (Math.hypot(dx, dy) < 5 && Math.hypot(game.ball.vx, game.ball.vy) < 20) return;
        // PD controller on tilt
        const tilt = {
          x: Math.max(-0.3, Math.min(0.3, dx * 0.004 - game.ball.vx * 0.002)),
          y: Math.max(-0.3, Math.min(0.3, dy * 0.004 - game.ball.vy * 0.002)),
        };
        update(game, 1 / 60, tilt);
      }
    };
    target(layout.spawn.x, 150);
    target(layout.width - 200, 150);
    const underPaws = (offsetY + scale * bounds.maxY + layout.inner.bottom) / 2;
    target(layout.width - 200, underPaws);
    target(offsetX, underPaws);
    target(offsetX, offsetY + 150 * scale);
    expect(game.state).toBe('playing');
    expect(Math.abs(game.ball.x - offsetX)).toBeLessThan(10);
  });
});

describe('integrate', () => {
  it('accelerates in the tilt direction', () => {
    const ball = { x: 0, y: 0, vx: 0, vy: 0 };
    integrate(ball, 0.1, { x: 1, y: -1 });
    expect(ball.vx).toBeGreaterThan(0);
    expect(ball.vy).toBeLessThan(0);
    expect(ball.x).toBeGreaterThan(0);
  });

  it('slows down from friction when flat', () => {
    const ball = { x: 0, y: 0, vx: 100, vy: 0 };
    integrate(ball, 1, still);
    expect(ball.vx).toBeLessThan(100);
    expect(ball.vx).toBeGreaterThan(0);
  });

  it('never exceeds the maximum speed', () => {
    const ball = { x: 0, y: 0, vx: 0, vy: 0 };
    for (let i = 0; i < 100; i++) integrate(ball, 0.05, { x: 1, y: 1 });
    expect(Math.hypot(ball.vx, ball.vy)).toBeCloseTo(MAX_SPEED);
  });
});
