import { drawGlow } from "./drawGlow.js";
import { TAU } from "../core/math.js";

/** Glowing charge orb at a cast origin {x,y,z}. Shared by Player and the hostile dummy. */
export function drawChargeOrb(ctx, o, charge) {
  const r = 4 + charge * 13,
    sy = o.y - o.z;
  ctx.globalCompositeOperation = "lighter";
  drawGlow(ctx, o.x, sy, r * 3.4, [255, 120, 30], 0.8);
  drawGlow(ctx, o.x, sy, r * 1.6, [255, 210, 110], 0.95);
  ctx.fillStyle = "#fff6dc";
  ctx.beginPath();
  ctx.arc(o.x, sy, r * 0.55, 0, TAU);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";
}
