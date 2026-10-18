import { TAU } from "../core/math.js";

/** Three yellow stars circling a head. (x, y) = centre of the top cap, t = seconds. */
export function drawStun(ctx, x, y, t) {
  ctx.fillStyle = "#ffe066";
  ctx.strokeStyle = "rgba(60,40,0,.9)";
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 3; i++) {
    const a = t * 6 + (i * TAU) / 3,
      px = x + Math.cos(a) * 15,
      py = y - 8 + Math.sin(a) * 5;
    ctx.beginPath();
    ctx.arc(px, py, 3.2, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }
}
