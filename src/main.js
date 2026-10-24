import './style.css';
import { createLayout } from './field.js';
import { createGame, start, update } from './game.js';
import { effectiveAngle, isTiltKey, tiltFromKeys, tiltFromOrientation } from './input.js';
import { drawFrame, renderBackground } from './render.js';

const stage = document.getElementById('stage');
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const title = document.getElementById('title');
const message = document.getElementById('message');
const playButton = document.getElementById('play');

const LOSS_MESSAGES = {
  cheetah: 'The cheetah got you!',
  border: 'You touched the pink border!',
};

let layout;
let background;
let game;
let viewKey = '';
let portraitViewport = false;
let latestReading = null;
let baseline = null;
let wakeLock = null;
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

  // Always play in landscape: in a portrait viewport the whole stage is rotated 90°.
  portraitViewport = vh > vw;
  const w = Math.max(vw, vh);
  const h = Math.min(vw, vh);
  stage.classList.toggle('rotated', portraitViewport);
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
    return tiltFromOrientation(
      latestReading,
      baseline,
      effectiveAngle(screenAngle(), portraitViewport),
    );
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

async function requestOrientationPermission() {
  const DOE = window.DeviceOrientationEvent;
  if (DOE && typeof DOE.requestPermission === 'function') {
    try {
      return (await DOE.requestPermission()) === 'granted';
    } catch {
      return false;
    }
  }
  return true;
}

async function goFullscreenLandscape() {
  try {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    }
    await screen.orientation?.lock?.('landscape');
  } catch {
    // Not supported (e.g. iOS Safari, desktop): the rotated-stage fallback keeps landscape.
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
  const granted = await requestOrientationPermission();
  if (!granted) {
    message.textContent = 'Motion access was denied. Allow it in your browser settings to tilt.';
  }
  goFullscreenLandscape();
  acquireWakeLock();
  baseline = latestReading; // calibrate: however the phone is held now is "flat"
  start(game);
  delete stage.dataset.loss;
  setState('playing');
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
  requestAnimationFrame(frame);
}

window.addEventListener('deviceorientation', (e) => {
  if (e.beta == null || e.gamma == null) return;
  latestReading = { beta: e.beta, gamma: e.gamma };
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
