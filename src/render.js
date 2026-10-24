// Canvas drawing. The rug, border and cheetah never move, so they are painted once per
// resize into a background canvas; each frame only blits it and draws the ball.

import { face, shapes, spots } from './cheetah.js';
import { BORDER, OUTLINE, TRIM } from './field.js';
import { mulberry32 } from './geometry.js';

const COLORS = {
  rug: '#0d4f33',
  rugFibres: ['#0a432b', '#11603d', '#0e5737', '#167048', '#083b26'],
  trim: '#f6a99c',
  frame: '#e02a7f',
  frameFibres: ['#c81f6c', '#ef4a98', '#d6267a', '#f26aa8'],
  cream: '#f3dfb2',
  creamFar: '#e2c792',
  outline: '#3b2312',
  spot: '#4b2a15',
};

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function fibres(ctx, rand, x0, y0, w, h, palette, density, k) {
  const count = Math.floor((w * h) / density);
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1, 1.3 * k);
  for (let i = 0; i < count; i++) {
    const x = x0 + rand() * w;
    const y = y0 + rand() * h;
    const len = (2 + rand() * 5) * k;
    const a = rand() * Math.PI * 2;
    ctx.strokeStyle = palette[Math.floor(rand() * palette.length)];
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }
}

function drawRug(ctx, layout, k) {
  const W = layout.width * k;
  const H = layout.height * k;
  const rand = mulberry32(7);
  const b = BORDER * k;
  const t = TRIM * k;

  ctx.fillStyle = COLORS.trim;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = COLORS.frame;
  ctx.fillRect(t, t, W - 2 * t, H - 2 * t);
  ctx.save();
  ctx.beginPath();
  ctx.rect(t, t, W - 2 * t, H - 2 * t);
  ctx.rect(b, b, W - 2 * b, H - 2 * b);
  ctx.clip('evenodd');
  fibres(ctx, rand, t, t, W - 2 * t, H - 2 * t, COLORS.frameFibres, 30 * k * k, k);
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.rect(b, b, W - 2 * b, H - 2 * b);
  ctx.clip();
  ctx.fillStyle = COLORS.rug;
  ctx.fillRect(b, b, W - 2 * b, H - 2 * b);
  // Soft mottling, then shaggy fibres.
  for (let i = 0; i < 18; i++) {
    const x = b + rand() * (W - 2 * b);
    const y = b + rand() * (H - 2 * b);
    const r = (120 + rand() * 260) * k;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rand() > 0.5 ? 'rgba(30,120,80,0.25)' : 'rgba(0,30,15,0.25)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  fibres(ctx, rand, b, b, W - 2 * b, H - 2 * b, COLORS.rugFibres, 22 * k * k, k);
  // Slight shadow where the pile meets the pink frame.
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 6 * k;
  ctx.strokeRect(b, b, W - 2 * b, H - 2 * b);
  ctx.restore();
}

function shapePath(ctx, shape) {
  ctx.beginPath();
  shape.points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  if (shape.kind === 'polygon') ctx.closePath();
}

function paintShape(ctx, shape, color, extra) {
  shapePath(ctx, shape);
  if (shape.kind === 'capsule') {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2 * shape.radius + extra;
    ctx.stroke();
  } else {
    ctx.fillStyle = color;
    ctx.fill();
    if (extra > 0) {
      ctx.strokeStyle = color;
      ctx.lineWidth = extra;
      ctx.stroke();
    }
  }
}

function polyline(ctx, points, color, width) {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

function drawCheetah(ctx, layout, k, pxW, pxH) {
  const { scale, offsetX, offsetY } = layout.cheetah;
  const transform = [k * scale, 0, 0, k * scale, k * offsetX, k * offsetY];
  // OUTLINE world units of dark edge show outside the fill; collisions include it.
  const outlineWidth = (2 * OUTLINE) / scale;

  // Outline: every shape, fattened. Filling the union on top leaves only the outer edge.
  ctx.save();
  ctx.setTransform(...transform);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const shape of shapes) paintShape(ctx, shape, COLORS.outline, outlineWidth);
  ctx.restore();

  const layer = makeCanvas(pxW, pxH);
  const lc = layer.getContext('2d');
  lc.setTransform(...transform);
  lc.lineCap = 'round';
  lc.lineJoin = 'round';
  for (const shape of shapes) paintShape(lc, shape, shape.far ? COLORS.creamFar : COLORS.cream, 0);

  // Spots only land on the cheetah's own pixels.
  lc.globalCompositeOperation = 'source-atop';
  lc.fillStyle = COLORS.spot;
  for (const s of spots) {
    lc.beginPath();
    lc.ellipse(s.x, s.y, s.r, s.r * 0.85, 0, 0, Math.PI * 2);
    lc.fill();
  }
  polyline(lc, face.tailTip, COLORS.spot, 40);
  lc.globalCompositeOperation = 'source-over';

  lc.fillStyle = COLORS.outline;
  lc.beginPath();
  lc.ellipse(face.eye.x, face.eye.y, face.eye.rx, face.eye.ry, 0, 0, Math.PI * 2);
  lc.fill();
  lc.beginPath();
  face.nose.forEach(([x, y], i) => (i === 0 ? lc.moveTo(x, y) : lc.lineTo(x, y)));
  lc.closePath();
  lc.fill();
  polyline(lc, face.tearLine, COLORS.outline, 5);
  polyline(lc, face.mouth, COLORS.outline, 4);

  ctx.drawImage(layer, 0, 0);
}

/** Paints the static scene (rug, frame, cheetah) at pixel size pxW × pxH. */
export function renderBackground(layout, pxW, pxH) {
  const canvas = makeCanvas(pxW, pxH);
  const ctx = canvas.getContext('2d');
  const k = pxH / layout.height;
  drawRug(ctx, layout, k);
  drawCheetah(ctx, layout, k, pxW, pxH);
  return canvas;
}

/** A tiny chrome ball: soft contact shadow, environment-reflecting body, specular glint. */
export function drawBall(ctx, x, y, r) {
  ctx.save();
  const shadow = ctx.createRadialGradient(
    x + r * 0.35,
    y + r * 0.55,
    0,
    x + r * 0.35,
    y + r * 0.55,
    r * 1.4,
  );
  shadow.addColorStop(0, 'rgba(0,0,0,0.55)');
  shadow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = shadow;
  ctx.beginPath();
  ctx.ellipse(x + r * 0.35, y + r * 0.55, r * 1.4, r * 1.0, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();

  const body = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.05, x, y, r);
  body.addColorStop(0, '#ffffff');
  body.addColorStop(0.25, '#e4e8ee');
  body.addColorStop(0.6, '#9aa1ab');
  body.addColorStop(0.9, '#3d434c');
  body.addColorStop(1, '#22262c');
  ctx.fillStyle = body;
  ctx.fillRect(x - r, y - r, 2 * r, 2 * r);

  // Lower half mirrors the green rug; a thin pink glint is the frame catching the light.
  const env = ctx.createLinearGradient(x, y, x, y + r);
  env.addColorStop(0, 'rgba(20,110,70,0)');
  env.addColorStop(0.35, 'rgba(20,110,70,0.55)');
  env.addColorStop(1, 'rgba(8,50,30,0.8)');
  ctx.fillStyle = env;
  ctx.fillRect(x - r, y + r * 0.05, 2 * r, r);
  ctx.fillStyle = 'rgba(240,80,150,0.35)';
  ctx.fillRect(x - r, y + r * 0.72, 2 * r, r * 0.1);

  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.38, y - r * 0.42, r * 0.22, r * 0.15, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = Math.max(0.5, r * 0.08);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
}

export function drawFrame(ctx, background, layout, ball) {
  const k = ctx.canvas.height / layout.height;
  ctx.drawImage(background, 0, 0);
  drawBall(ctx, ball.x * k, ball.y * k, layout.ballRadius * k);
}
