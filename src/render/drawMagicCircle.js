import { drawGlow } from "./drawGlow.js";
import { clamp, hash2, rgba, TAU } from "../core/math.js";

/** Colour sets for circles. Add one per element later (frost, storm...). */
export const FIRE_CIRCLE = {
  main: [255, 170, 70],
  core: [255, 236, 175],
  deep: [255, 90, 25],
};

const RUNES = 12;

// Pseudo-runes: 3 strokes between points of a 3x3 lattice, seeded per slot so they never change.
const GLYPHS = Array.from({ length: RUNES }, (_, i) => {
  const pt = (k) => [
    Math.floor(hash2(i * 7 + k, 11) * 3) - 1,
    Math.floor(hash2(i * 13 + k, 29) * 3) - 1,
  ];
  return [pt(0), pt(1), pt(2), pt(3)];
});

/**
 * Magic circle drawn on any plane. (ux,uy) / (vx,vy) are the screen vectors of the circle's local X / Y axes.
 * power 0..1 lights the runes one by one and sweeps the outer ring (use the charge level).
 */
export function drawMagicCircle(
  ctx,
  {
    x,
    y,
    ux,
    uy,
    vx,
    vy,
    r,
    t,
    power = 1,
    alpha = 1,
    spin = 1,
    palette = FIRE_CIRCLE,
  },
) {
  if (alpha <= 0.01 || r < 1) return;
  const pw = clamp(power, 0, 1),
    px = 1 / r,
    { main, core, deep } = palette;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.transform(ux * r, uy * r, vx * r, vy * r, x, y);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // soft disc of light
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  g.addColorStop(0, rgba(main, (0.1 + 0.22 * pw) * alpha));
  g.addColorStop(1, rgba(deep, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, TAU);
  ctx.fill();

  // outer ring: faint full ring + bright sweep that follows the power
  ctx.strokeStyle = rgba(main, 0.3 * alpha);
  ctx.lineWidth = 1.5 * px;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = rgba(core, 0.95 * alpha);
  ctx.lineWidth = (2 + 2.5 * pw) * px;
  ctx.beginPath();
  ctx.arc(0, 0, 1, -Math.PI / 2, -Math.PI / 2 + TAU * Math.max(0.02, pw));
  ctx.stroke();

  // tick marks on the outer ring, slowly turning
  ctx.strokeStyle = rgba(main, 0.55 * alpha);
  ctx.lineWidth = 1 * px;
  ctx.beginPath();
  const tick0 = t * 0.12 * spin;
  for (let i = 0; i < 36; i++) {
    const a = tick0 + (i * TAU) / 36,
      l = i % 3 === 0 ? 0.075 : 0.04;
    ctx.moveTo(Math.cos(a) * (1 - l), Math.sin(a) * (1 - l));
    ctx.lineTo(Math.cos(a) * 0.985, Math.sin(a) * 0.985);
  }
  ctx.stroke();

  // dashed ring turning the other way
  ctx.setLineDash([0.07, 0.05]);
  ctx.lineDashOffset = t * 0.12 * spin;
  ctx.strokeStyle = rgba(main, 0.6 * alpha);
  ctx.lineWidth = 1.2 * px;
  ctx.beginPath();
  ctx.arc(0, 0, 0.86, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);

  // rune band: glyphs light up one by one as power rises
  ctx.strokeStyle = rgba(core, 0.9 * alpha);
  const lit = Math.min(RUNES, 2 + Math.floor(pw * (RUNES - 2) + 1e-6));
  const gs = 0.065;
  ctx.lineWidth = (1.4 * px) / gs;
  for (let k = 0; k < lit; k++) {
    const a = t * 0.35 * spin + (k * TAU) / RUNES,
      newest = k === lit - 1 && pw < 1;
    ctx.save();
    ctx.rotate(a);
    ctx.translate(0, -0.77);
    ctx.scale(gs, gs);
    ctx.globalAlpha = newest ? 0.5 + 0.5 * Math.sin(t * 30) ** 2 : 1;
    ctx.beginPath();
    const G = GLYPHS[k];
    ctx.moveTo(G[0][0], G[0][1]);
    ctx.lineTo(G[1][0], G[1][1]);
    ctx.lineTo(G[2][0], G[2][1]);
    ctx.lineTo(G[3][0], G[3][1]);
    ctx.stroke();
    ctx.restore();
  }

  // inner ring
  ctx.strokeStyle = rgba(main, 0.6 * alpha);
  ctx.lineWidth = 1.2 * px;
  ctx.beginPath();
  ctx.arc(0, 0, 0.68, 0, TAU);
  ctx.stroke();

  // counter-rotating triangles (hexagram), growing in with power
  const tri = 0.68 * clamp(pw * 1.6, 0.25, 1);
  ctx.strokeStyle = rgba(core, 0.8 * alpha);
  ctx.lineWidth = 1.5 * px;
  for (let s = 0; s < 2; s++) {
    const a0 = (s ? 1 : -1) * t * 0.5 * spin + (s ? Math.PI : 0) - Math.PI / 2;
    ctx.beginPath();
    for (let i = 0; i <= 3; i++) {
      const a = a0 + (i * TAU) / 3;
      i
        ? ctx.lineTo(Math.cos(a) * tri, Math.sin(a) * tri)
        : ctx.moveTo(Math.cos(a) * tri, Math.sin(a) * tri);
    }
    ctx.stroke();
  }

  // inner circle + orbiting nodes
  ctx.strokeStyle = rgba(main, 0.7 * alpha);
  ctx.lineWidth = 1.2 * px;
  ctx.beginPath();
  ctx.arc(0, 0, 0.32, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = rgba(core, 0.95 * alpha);
  for (let i = 0; i < 3; i++) {
    const a = t * 1.4 * spin + (i * TAU) / 3;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * 0.5, Math.sin(a) * 0.5, 0.03, 0, TAU);
    ctx.fill();
  }
  drawGlow(ctx, 0, 0, 0.45, core, (0.2 + 0.5 * pw) * alpha);
  ctx.restore();
}

/** Circle lying on the ground under a caster. The 0.5 squash matches the game's other ground rings. */
export function drawGroundCircle(ctx, x, y, r, t, power, opts = {}) {
  drawMagicCircle(ctx, { x, y, ux: 1, uy: 0, vx: 0, vy: 0.5, r, t, power, ...opts });
}

/**
 * Circle hovering at the cast origin, facing along `aim`.
 * Seen edge-on (a thin ellipse) when aiming sideways, full circle when aiming toward or away from the camera.
 */
export function drawFacingCircle(ctx, o, aim, r, t, power, opts = {}) {
  const s = Math.sin(aim),
    c = Math.cos(aim),
    w = Math.max(0.3, Math.abs(s));
  drawMagicCircle(ctx, {
    x: o.x + c * 8,
    y: o.y + s * 8 - o.z,
    ux: s >= 0 ? w : -w,
    uy: c * 0.4,
    vx: 0,
    vy: -1,
    r,
    t,
    power,
    ...opts,
  });
}
