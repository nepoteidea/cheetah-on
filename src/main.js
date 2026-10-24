import './style.css';
import { createLayout } from './field.js';
import { createGame, start, update } from './game.js';
import { isTiltKey, tiltFromKeys, tiltFromOrientation } from './input.js';
import { drawFrame, renderBackground } from './render.js';

const stage = document.getElementById('stage');
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const title = document.getElementById('title');
const message = document.getElementById('message');
const playButton = document.getElementById('play');
const notice = document.getElementById('notice');
const debugPanel = new URLSearchParams(location.search).has('debug')
  ? document.getElementById('debug')
  : null;

const SENSOR_TIMEOUT_MS = 1500;
const NOTICES = {
  denied:
    "Motion access is off, so tilting won't move the ball. On iPhone, close this tab, open the site again and tap Allow.",
  noData:
    "Your phone isn't sending tilt data. Brave blocks it by default: menu → Settings → Site and Shields settings → Motion sensors → Allow. Chrome/Android: Site settings → Motion sensors. iPhone: tap Allow when asked.",
};

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
let permission = 'unknown';
let readingCount = 0;
let sensorTimer = null;
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
  const DOE = window.DeviceOrientationEvent;
  if (DOE && typeof DOE.requestPermission === 'function') {
    try {
      return await DOE.requestPermission();
    } catch {
      return 'denied';
    }
  }
  return 'not-required';
}

function showNotice(kind) {
  notice.textContent = NOTICES[kind];
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
  permission = await requestOrientationPermission();
  goFullscreenLandscape();
  acquireWakeLock();
  baseline = latestReading; // calibrate: however the phone is held now is "flat"
  start(game);
  delete stage.dataset.loss;
  setState('playing');
  watchSensor();
}

/** Tells the player why tilting does nothing, instead of leaving the ball silently still. */
function watchSensor() {
  clearTimeout(sensorTimer);
  if (permission === 'denied') {
    showNotice('denied');
    return;
  }
  const countAtStart = readingCount;
  sensorTimer = setTimeout(() => {
    if (game.state === 'playing' && readingCount === countAtStart && keys.size === 0) {
      showNotice('noData');
    }
  }, SENSOR_TIMEOUT_MS);
}

function updateDebug() {
  const r = latestReading;
  const t = currentTilt();
  debugPanel.textContent = [
    `permission ${permission}  events ${readingCount}`,
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
  if (e.beta == null || e.gamma == null) return;
  latestReading = { beta: e.beta, gamma: e.gamma };
  readingCount++;
  if (notice.dataset.kind === 'noData') hideNotice();
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
