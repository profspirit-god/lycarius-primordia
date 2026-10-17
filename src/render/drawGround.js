import { hash2 } from '../core/math.js';
const T = 64;
/** Infinite, deterministic ground. Placeholder art; replace with real tilemaps later. */
export function drawGround(ctx, cam, w, h) {
  const x0 = Math.floor((cam.x - w / 2) / T) - 1, x1 = Math.ceil((cam.x + w / 2) / T) + 1;
  const y0 = Math.floor((cam.y - h / 2) / T) - 1, y1 = Math.ceil((cam.y + h / 2) / T) + 1;
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const n = hash2(tx, ty), px = tx * T, py = ty * T;
      const v = 30 + n * 14;
      ctx.fillStyle = `rgb(${v * 0.8 | 0},${v * 1.35 | 0},${v | 0})`;
      ctx.fillRect(px, py, T + 1, T + 1);
      if (n > 0.72) {
        ctx.strokeStyle = `rgba(120,190,110,${0.25 + n * 0.3})`; ctx.lineWidth = 1.5;
        for (let i = 0; i < 4; i++) {
          const gx = px + hash2(tx * 7 + i, ty) * T, gy = py + hash2(tx, ty * 7 + i) * T;
          ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx - 2, gy - 7); ctx.moveTo(gx, gy); ctx.lineTo(gx + 3, gy - 6); ctx.stroke();
        }
      }
    }
  }
  ctx.strokeStyle = 'rgba(255,255,255,.035)'; ctx.lineWidth = 1; ctx.beginPath();
  for (let tx = x0; tx <= x1; tx++) { ctx.moveTo(tx * T, y0 * T); ctx.lineTo(tx * T, y1 * T); }
  for (let ty = y0; ty <= y1; ty++) { ctx.moveTo(x0 * T, ty * T); ctx.lineTo(x1 * T, ty * T); }
  ctx.stroke();
}
