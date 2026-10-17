import { drawGlow } from "./drawGlow.js";

/**
 * Soft coloured glow wrapped around a cylinder body plus a light pool on the ground.
 * Used while casting a self skill (grows with charge) and while a ward is active.
 * (x, y) is the ground point under the body; h its height; r its radius; a 0..1.
 */
export function drawAura(ctx, x, y, h, r, a, t, { main = [255, 92, 50], core = [255, 190, 130] } = {}) {
  if (a <= 0.01) return;
  const pulse = 0.9 + 0.1 * Math.sin(t * 7);
  ctx.globalCompositeOperation = "lighter";
  drawGlow(ctx, x, y - h * 0.5, (h * 1.1 + r) * pulse, main, 0.95 * a);
  drawGlow(ctx, x, y - h * 0.5, (h * 0.5 + r * 0.8) * pulse, core, 0.5 * a);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, 0.5);
  drawGlow(ctx, 0, 0, r * 2.6, main, 0.5 * a);
  ctx.restore();
  ctx.globalCompositeOperation = "source-over";
}
