import { lerpColor, rgba } from '../core/math.js';
const shade = (c, f) => [c[0] * f, c[1] * f, c[2] * f];

/** Characters are cylinders. `lean` shifts the top cap (px) for recoil / sway. Returns top-cap centre. */
export function drawCylinder(ctx, { x, y, r, h, color, flash = 0, lean = [0, 0], squash = 0.5 }) {
  const tx = x + lean[0], ty = y - h + lean[1], ry = r * squash;
  ctx.fillStyle = 'rgba(0,0,0,.32)';
  ctx.beginPath(); ctx.ellipse(x, y, r * 1.2, ry * 1.2, 0, 0, Math.PI * 2); ctx.fill();

  const c = lerpColor(color, [255, 255, 255], flash);
  const g = ctx.createLinearGradient(x - r, 0, x + r, 0);
  g.addColorStop(0, rgba(shade(c, 0.55))); g.addColorStop(0.45, rgba(c)); g.addColorStop(1, rgba(shade(c, 0.5)));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - r, y); ctx.lineTo(tx - r, ty); ctx.lineTo(tx + r, ty); ctx.lineTo(x + r, y);
  ctx.ellipse(x, y, r, ry, 0, 0, Math.PI, false);
  ctx.closePath(); ctx.fill();

  ctx.fillStyle = rgba(lerpColor(shade(c, 1.15), [255, 255, 255], 0.15 + flash * 0.5));
  ctx.beginPath(); ctx.ellipse(tx, ty, r, ry, 0, 0, Math.PI * 2); ctx.fill();
  return { tx, ty, ry };
}
