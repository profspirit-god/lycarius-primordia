const MAX_ARROWS = 5;

function arrow(ctx, cx, y) {
  ctx.beginPath();
  ctx.moveTo(cx, y - 9);
  ctx.lineTo(cx + 5, y - 3);
  ctx.lineTo(cx + 2, y - 3);
  ctx.lineTo(cx + 2, y + 3);
  ctx.lineTo(cx - 2, y + 3);
  ctx.lineTo(cx - 2, y - 3);
  ctx.lineTo(cx - 5, y - 3);
  ctx.closePath();
  ctx.stroke();
  ctx.fill();
}

/** Enhancement marker: one yellow up-arrow per tier (x1 = one arrow). Above 5 tiers: one arrow plus "xN". (x, y) = centre. */
export function drawEnhance(ctx, x, y, tier) {
  if (tier <= 0) return;
  ctx.lineJoin = "round";
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(60,40,0,.95)";
  ctx.fillStyle = "#ffd23a";
  if (tier > MAX_ARROWS) {
    arrow(ctx, x - 10, y);
    ctx.textAlign = "left";
    ctx.font = "bold 12px Georgia, serif";
    ctx.lineWidth = 3;
    ctx.strokeText(`x${tier}`, x - 2, y + 4);
    ctx.fillText(`x${tier}`, x - 2, y + 4);
    return;
  }
  const gap = 12,
    x0 = x - ((tier - 1) * gap) / 2;
  for (let i = 0; i < tier; i++) arrow(ctx, x0 + i * gap, y);
}
