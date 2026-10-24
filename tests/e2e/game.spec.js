import { expect, test } from '@playwright/test';

const stage = (page) => page.locator('#stage');

async function startGame(page) {
  await page.locator('#play').click();
  await expect(stage(page)).toHaveAttribute('data-state', 'playing');
  await expect(page.locator('#overlay')).toBeHidden();
}

/** Sends a device-orientation reading that tilts the displayed board by (x, y) degrees. */
async function tilt(page, x, y) {
  await page.evaluate(
    ([x, y]) => {
      const angle = (((screen.orientation?.angle ?? 0) % 360) + 360) % 360;
      // Inverse of screenGravity() in src/input.js (exact in direction, small angles).
      const map = {
        0: { beta: y, gamma: x },
        90: { beta: x, gamma: -y },
        180: { beta: -y, gamma: -x },
        270: { beta: -x, gamma: y },
      }[angle];
      window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { alpha: 0, ...map }));
    },
    [x, y],
  );
}

let errors;

test.beforeEach(async ({ page }) => {
  errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/');
});

test.afterEach(() => {
  expect(errors).toEqual([]);
});

test('shows the title screen over a full-screen rug', async ({ page }) => {
  await expect(page).toHaveTitle('Cheetah On');
  await expect(page.locator('#title')).toHaveText('Cheetah On');
  await expect(page.locator('#play')).toBeVisible();
  await expect(stage(page)).toHaveAttribute('data-state', 'ready');

  const viewport = page.viewportSize();
  const box = await stage(page).boundingBox();
  expect(box.x).toBeCloseTo(0, 0);
  expect(box.y).toBeCloseTo(0, 0);
  expect(box.width).toBeCloseTo(viewport.width, 0);
  expect(box.height).toBeCloseTo(viewport.height, 0);

  // The playfield is painted: pink frame at the edge, green rug inside.
  const [edge, inside] = await page.evaluate(() => {
    const c = document.getElementById('game');
    const ctx = c.getContext('2d');
    const px = (x, y) => [...ctx.getImageData(x, y, 1, 1).data];
    const k = c.height / window.__cheetahOn.layout.height;
    return [
      px(Math.round(48 * k), Math.round(c.height / 2)),
      px(Math.round(120 * k), Math.round(120 * k)),
    ];
  });
  expect(edge[0]).toBeGreaterThan(150); // pink: lots of red
  expect(edge[1]).toBeLessThan(120);
  expect(inside[1]).toBeGreaterThan(inside[0]); // green dominates
});

test('the ball stays put and the game keeps going while the board is level', async ({ page }) => {
  await startGame(page);
  const before = await page.evaluate(() => window.__cheetahOn.ball);
  await page.waitForTimeout(1500);
  await expect(stage(page)).toHaveAttribute('data-state', 'playing');
  const after = await page.evaluate(() => window.__cheetahOn.ball);
  expect(after.x).toBeCloseTo(before.x, 3);
  expect(after.y).toBeCloseTo(before.y, 3);
});

test('rolling into the pink border loses (keyboard)', async ({ page }) => {
  await startGame(page);
  await page.keyboard.down('ArrowUp');
  await expect(stage(page)).toHaveAttribute('data-state', 'lost');
  await page.keyboard.up('ArrowUp');
  await expect(stage(page)).toHaveAttribute('data-loss', 'border');
  await expect(page.locator('#message')).toHaveText('You touched the pink border!');
  await expect(page.locator('#play')).toHaveText('Play again');
});

test('rolling into the cheetah loses (keyboard)', async ({ page }) => {
  await startGame(page);
  await page.keyboard.down('ArrowDown');
  await expect(stage(page)).toHaveAttribute('data-state', 'lost');
  await page.keyboard.up('ArrowDown');
  await expect(stage(page)).toHaveAttribute('data-loss', 'cheetah');
  await expect(page.locator('#message')).toHaveText('The cheetah got you!');
});

test('the curled tail is solid too', async ({ page }) => {
  const { width, height } = page.viewportSize();
  // From the portrait spawn point a straight roll left passes above the tail.
  test.skip(height > width, 'tail sits on the spawn row only in landscape');
  await startGame(page);
  await page.keyboard.down('ArrowLeft');
  await expect(stage(page)).toHaveAttribute('data-state', 'lost');
  await page.keyboard.up('ArrowLeft');
  await expect(stage(page)).toHaveAttribute('data-loss', 'cheetah');
});

test('play again restarts from the spawn point', async ({ page }) => {
  await startGame(page);
  await page.keyboard.down('ArrowUp');
  await expect(stage(page)).toHaveAttribute('data-state', 'lost');
  await page.keyboard.up('ArrowUp');
  await expect(page.locator('#play')).toBeEnabled();
  await startGame(page);
  const { ball, spawn } = await page.evaluate(() => ({
    ball: window.__cheetahOn.ball,
    spawn: window.__cheetahOn.layout.spawn,
  }));
  expect(ball.x).toBeCloseTo(spawn.x, 0);
  expect(ball.y).toBeCloseTo(spawn.y, 0);
  await expect(stage(page)).not.toHaveAttribute('data-loss');
});

test('tilting the phone rolls the ball in the tilt direction', async ({ page }) => {
  await tilt(page, 0, 0); // resting position, captured as the calibration baseline
  await startGame(page);
  await tilt(page, -8, 0); // gently to the left
  await page.waitForTimeout(250);
  const ball = await page.evaluate(() => window.__cheetahOn.ball);
  const spawn = await page.evaluate(() => window.__cheetahOn.layout.spawn);
  expect(ball.vx).toBeLessThan(0);
  expect(ball.x).toBeLessThan(spawn.x);
  expect(Math.abs(ball.y - spawn.y)).toBeLessThan(1);
});

test('tilting the phone toward the cheetah loses on the cheetah', async ({ page }) => {
  await tilt(page, 0, 0);
  await startGame(page);
  await tilt(page, 0, 20);
  await expect(stage(page)).toHaveAttribute('data-state', 'lost');
  await expect(stage(page)).toHaveAttribute('data-loss', 'cheetah');
});

test('calibrates to however the phone is held when play starts', async ({ page }) => {
  await tilt(page, 0, 30); // held at a steep angle
  await startGame(page);
  await tilt(page, 0, 30); // unchanged: the board should feel level
  await page.waitForTimeout(800);
  await expect(stage(page)).toHaveAttribute('data-state', 'playing');
  await tilt(page, 0, 0); // tipped back toward the top border
  await expect(stage(page)).toHaveAttribute('data-loss', 'border');
});

test('the playfield follows the screen orientation, with the cheetah centered', async ({
  page,
}) => {
  const viewport = page.viewportSize();
  const portrait = viewport.height > viewport.width;
  const { layout } = await page.evaluate(() => ({ layout: window.__cheetahOn.layout }));
  // Upright, never rotated: the world's long side matches the screen's long side.
  expect(layout.height > layout.width).toBe(portrait);
  expect(layout.width / layout.height).toBeCloseTo(viewport.width / viewport.height, 2);
  await expect(stage(page)).toHaveCSS('transform', 'none');

  // The title card fits entirely on screen.
  const card = await page.locator('.card').boundingBox();
  expect(card.y).toBeGreaterThanOrEqual(0);
  expect(card.x).toBeGreaterThanOrEqual(0);
  expect(card.y + card.height).toBeLessThanOrEqual(viewport.height);
  expect(card.x + card.width).toBeLessThanOrEqual(viewport.width);
});

test('turning the phone switches between portrait and landscape layouts', async ({ page }) => {
  const { width, height } = page.viewportSize();
  const before = await page.evaluate(() => window.__cheetahOn.layout);
  await page.setViewportSize({ width: height, height: width });
  await expect
    .poll(() => page.evaluate(() => window.__cheetahOn.layout.width))
    .not.toBeCloseTo(before.width, 0);
  const after = await page.evaluate(() => window.__cheetahOn.layout);
  expect(after.width > after.height).toBe(height > width);
});

test('serves a full-screen web manifest that allows both orientations', async ({ request }) => {
  const res = await request.get('/manifest.webmanifest');
  expect(res.ok()).toBe(true);
  const manifest = await res.json();
  expect(manifest.orientation).toBe('any');
  expect(manifest.display).toBe('fullscreen');
});

test.describe('motion sensor access', () => {
  /** Simulates iOS: motion events need DeviceOrientationEvent.requestPermission(). */
  async function fakeIosPermission(page, answer) {
    await page.addInitScript((answer) => {
      window.__permissionCalls = 0;
      DeviceOrientationEvent.requestPermission = async () => {
        window.__permissionCalls++;
        return answer;
      };
    }, answer);
    await page.reload();
  }

  test('asks for motion permission when Play is tapped (iOS)', async ({ page }) => {
    await fakeIosPermission(page, 'granted');
    expect(await page.evaluate(() => window.__permissionCalls)).toBe(0);
    await tilt(page, 0, 0);
    await startGame(page);
    expect(await page.evaluate(() => window.__permissionCalls)).toBe(1);
    await tilt(page, 0, 20);
    await expect(stage(page)).toHaveAttribute('data-loss', 'cheetah');
    await expect(page.locator('#notice')).toBeHidden();
  });

  test('explains how to fix it when motion permission is denied', async ({ page }) => {
    await fakeIosPermission(page, 'denied');
    await startGame(page);
    await expect(page.locator('#notice')).toBeVisible();
    await expect(page.locator('#notice')).toHaveAttribute('data-kind', 'denied');
    await expect(page.locator('#notice')).toContainText('tap Allow');
  });

  test('says so when the phone sends no tilt data', async ({ page }) => {
    await startGame(page);
    await expect(page.locator('#notice')).toHaveAttribute('data-kind', 'noData', {
      timeout: 4000,
    });
    await expect(page.locator('#notice')).toContainText('Motion sensors');
    // As soon as readings arrive the notice goes away.
    await tilt(page, 0, 0);
    await expect(page.locator('#notice')).toBeHidden();
  });

  test('stays quiet when tilt data is flowing', async ({ page }) => {
    await startGame(page);
    for (let i = 0; i < 8; i++) {
      await tilt(page, 0, 0);
      await page.waitForTimeout(250);
    }
    await expect(page.locator('#notice')).toBeHidden();
  });

  test('?debug shows live sensor readings', async ({ page }) => {
    await page.goto('/?debug');
    await expect(page.locator('#debug')).toBeVisible();
    await tilt(page, 0, 12);
    await expect(page.locator('#debug')).toContainText('events 1');
    await expect(page.locator('#debug')).toContainText(/beta -?\d/);
  });

  test('the debug panel is hidden normally', async ({ page }) => {
    await expect(page.locator('#debug')).toBeHidden();
  });
});
