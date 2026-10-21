import { rgba, TAU } from "../core/math.js";

/**
 * Long flexible tinted lines that spiral up a cylinder body: the signature of RESISTANCE buffs (Burn Resistance, later frost / storm ward).
 * Thin strokes, no glow, so it stacks with other buffs (circles = regen, dashes = motion) without washing the body out.
 * (x, y) is the ground point under the body; h its height; r its radius; a 0..1.3 strength; t seconds.
 */
export function drawRibbons(ctx, x, y, h, r, a, t, { main = [255, 92, 50], core = [255, 165, 115] } = {}, { count = 2, steps = 14 } = {}) {
  if (a <= 0.01) return;
  const al = Math.min(1, a);
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (let k = 0; k < count; k++) {
    const ph = t * 1.8 + (k / count) * TAU;
    for (const [col, w, f] of [[main, 3, 0.55], [core, 1.2, 0.95]]) {
      ctx.strokeStyle = rgba(col, f * al);
      ctx.lineWidth = w;
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const u = i / steps, // 0 feet .. 1 head
          ang = ph + u * TAU * 1.25, // the line winds around the body
          wob = Math.sin(t * 3 + u * 6 + k) * 0.12, // flexes
          px = x + Math.sin(ang) * r * (1.25 + wob),
          py = y - u * h * 0.95 + Math.cos(ang) * r * 0.45;
        if (i) ctx.lineTo(px, py);
        else ctx.moveTo(px, py);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}
