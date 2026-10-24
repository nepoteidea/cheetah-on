import './style.css';
import { createLayout } from './field.js';
import { createGame, start, update } from './game.js';
import { isTiltKey, tiltFromKeys, tiltFromOrientation } from './input.js';
import { drawFrame, renderBackground } from './render.js';
import { classifySensor, detectBrowser, sensorMessage } from './sensor.js';

const stage = document.getElementById('stage');
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const title = document.getElementById('title');
const message = document.getElementById('message');
const playButton = document.getElementById('play');
const notice = document.getElementById('notice');
const sensorStatus = document.getElementById('sensor-status');
const debugPanel = new URLSearchParams(location.search).has('debug')
  ? document.getElementById('debug')
  : null;

const SENSOR_TIMEOUT_MS = 1500;

const LOSS_MESSAGES = {
  cheetah: 'The cheetah got you!',
  border: 'You touched the pink border!',
};

let layout;
let background;
let game;
let viewKey = '';
let latestReading = null;
let baseline = null;
let wakeLock = null;
let readingCount = 0;
let sensorTimer = null;
let browser = detectBrowser(navigator.userAgent, { maxTouchPoints: navigator.maxTouchPoints });
const isTouch = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
const sensor = {
  hasApi: 'DeviceOrientationEvent' in window,
  isTouch,
  permission: 'unsupported',
  // Only iOS hands out motion access from a tap; Chromium's requestPermission() is a no-op.
  needsTap:
    browser === 'ios' && typeof window.DeviceOrientationEvent?.requestPermission === 'function',
  reading: 'none',
  timedOut: false,
};
let sensorState = 'checking';
const keys = new Set();

function screenAngle() {
  const angle = screen.orientation?.angle ?? window.orientation ?? 0;
  return ((angle % 360) + 360) % 360;
}

function resize() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const key = `${vw}x${vh}`;
  if (key === viewKey) return;
  viewKey = key;

  // The playfield follows the screen: a tall rug in portrait, a wide one in landscape.
  const w = vw;
  const h = vh;
  stage.style.width = `${w}px`;
  stage.style.height = `${h}px`;

  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  layout = createLayout(w, h);
  background = renderBackground(layout, canvas.width, canvas.height);

  const wasPlaying = game?.state === 'playing';
  game = createGame(layout);
  if (wasPlaying) {
    // The screen changed mid-round (e.g. entering fullscreen): restart from the spawn point.
    start(game);
    baseline = latestReading;
  }
  draw();
}

function currentTilt() {
  if (keys.size > 0) return tiltFromKeys(keys);
  if (latestReading && baseline) {
    return tiltFromOrientation(latestReading, baseline, screenAngle());
  }
  return { x: 0, y: 0 };
}

function setState(state) {
  stage.dataset.state = state;
  overlay.hidden = state === 'playing';
}

function showLoss(reason) {
  stage.dataset.loss = reason;
  title.textContent = 'Game over';
  message.textContent = LOSS_MESSAGES[reason];
  playButton.textContent = 'Play again';
  // Guard against an accidental tap restarting instantly.
  playButton.disabled = true;
  setTimeout(() => (playButton.disabled = false), 600);
  setState('lost');
  releaseWakeLock();
}

// iOS 13+ only delivers motion events after the user grants access from a tap.
async function requestOrientationPermission() {
  if (!sensor.needsTap) return;
  try {
    const answer = await window.DeviceOrientationEvent.requestPermission();
    sensor.permission = answer === 'granted' ? 'granted' : 'denied';
  } catch {
    sensor.permission = 'denied';
  }
  sensor.needsTap = false;
}

/** Re-evaluates tilt support and updates the title-card status and the in-game notice. */
function refreshSensor() {
  sensorState = classifySensor(sensor);
  const { tone, text } = sensorMessage(sensorState, browser, isTouch);
  sensorStatus.textContent = text;
  sensorStatus.dataset.status = sensorState;
  sensorStatus.dataset.tone = tone;
  if (game?.state === 'playing' && tone === 'warn') showNotice(sensorState, text);
  else if (tone !== 'warn') hideNotice();
}

/** Waits a moment for a first reading before concluding the sensor is silent. */
function startSensorTimer() {
  clearTimeout(sensorTimer);
  sensor.timedOut = false;
  sensorTimer = setTimeout(() => {
    sensor.timedOut = true;
    refreshSensor();
  }, SENSOR_TIMEOUT_MS);
}

/** Chromium-based browsers (Chrome, Brave, Samsung, Edge) report whether sensors are allowed. */
async function watchSensorPermission() {
  if (!navigator.permissions?.query) return;
  try {
    const states = await Promise.all(
      ['accelerometer', 'gyroscope'].map((name) => navigator.permissions.query({ name })),
    );
    const update = () => {
      const values = states.map((st) => st.state);
      sensor.permission = values.includes('denied')
        ? 'denied'
        : values.every((v) => v === 'granted')
          ? 'granted'
          : 'prompt';
      refreshSensor();
    };
    states.forEach((st) => st.addEventListener('change', update));
    update();
  } catch {
    // Not supported (Safari, Firefox): rely on whether readings arrive.
  }
}

function showNotice(kind, text) {
  notice.textContent = text;
  notice.dataset.kind = kind;
  notice.hidden = false;
}

function hideNotice() {
  notice.hidden = true;
  delete notice.dataset.kind;
}

async function goFullscreenLandscape() {
  try {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    }
    // Keep whichever orientation play started in, so the screen can't flip mid-round.
    const type = screen.orientation?.type ?? '';
    await screen.orientation?.lock?.(type.startsWith('portrait') ? 'portrait' : 'landscape');
  } catch {
    // Not supported (e.g. iOS Safari, desktop). A rotation mid-round restarts the round.
  }
}

async function acquireWakeLock() {
  try {
    wakeLock = await navigator.wakeLock?.request('screen');
  } catch {
    wakeLock = null;
  }
}

function releaseWakeLock() {
  wakeLock?.release?.().catch(() => {});
  wakeLock = null;
}

async function play() {
  if (game.state === 'playing') return;
  await requestOrientationPermission();
  goFullscreenLandscape();
  acquireWakeLock();
  baseline = latestReading; // calibrate: however the phone is held now is "flat"
  start(game);
  delete stage.dataset.loss;
  setState('playing');
  // Tell the player why tilting does nothing instead of leaving the ball silently still.
  if (sensor.reading !== 'values') startSensorTimer();
  refreshSensor();
}

function updateDebug() {
  const r = latestReading;
  const t = currentTilt();
  debugPanel.textContent = [
    `sensor ${sensorState}  permission ${sensor.permission}  events ${readingCount}`,
    `beta ${r ? r.beta.toFixed(1) : '-'}  gamma ${r ? r.gamma.toFixed(1) : '-'}`,
    `screen ${screenAngle()}°  ${window.innerWidth}×${window.innerHeight}`,
    `tilt x ${t.x.toFixed(2)}  y ${t.y.toFixed(2)}`,
  ].join('\n');
}

function draw() {
  drawFrame(ctx, background, layout, game.ball);
}

let last = performance.now();
function frame(now) {
  const dt = (now - last) / 1000;
  last = now;
  if (game.state === 'playing') {
    update(game, dt, currentTilt());
    if (game.state === 'lost') showLoss(game.lossReason);
  }
  draw();
  if (debugPanel) updateDebug();
  requestAnimationFrame(frame);
}

window.addEventListener('deviceorientation', (e) => {
  if (e.beta == null || e.gamma == null) {
    // Chrome sends one empty event when the device has no sensor at all.
    if (sensor.reading === 'none') {
      sensor.reading = 'empty';
      refreshSensor();
    }
    return;
  }
  latestReading = { beta: e.beta, gamma: e.gamma };
  readingCount++;
  if (sensor.reading !== 'values') {
    sensor.reading = 'values';
    refreshSensor();
  }
  if (game?.state === 'playing' && !baseline) baseline = latestReading;
});

window.addEventListener('keydown', (e) => {
  if (isTiltKey(e.code)) {
    keys.add(e.code);
    e.preventDefault();
  } else if ((e.code === 'Space' || e.code === 'Enter') && game.state !== 'playing') {
    if (!playButton.disabled) play();
    e.preventDefault();
  }
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());

document.addEventListener('visibilitychange', () => {
  // Coming back from the browser's settings: check again.
  if (!document.hidden && sensor.reading !== 'values') startSensorTimer();
  if (document.hidden && game.state === 'playing') {
    game = createGame(layout);
    title.textContent = 'Paused';
    message.textContent = 'Tap to start again.';
    playButton.textContent = 'Play';
    setState('ready');
    releaseWakeLock();
  }
});

window.addEventListener('resize', resize);
screen.orientation?.addEventListener?.('change', resize);
playButton.addEventListener('click', play);
notice.addEventListener('click', hideNotice);
if (debugPanel) debugPanel.hidden = false;

resize();
setState('ready');
refreshSensor();
startSensorTimer();
watchSensorPermission();
navigator.brave
  ?.isBrave?.()
  .then((yes) => {
    if (yes) browser = 'brave';
    refreshSensor();
  })
  .catch(() => {});
requestAnimationFrame(frame);

// Read-only hook for end-to-end tests.
window.__cheetahOn = {
  get state() {
    return game.state;
  },
  get ball() {
    return { ...game.ball };
  },
  get layout() {
    return layout;
  },
};
