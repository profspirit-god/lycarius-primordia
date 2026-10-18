/** Draws an image or video frame to fill (w x h), cropping the overflow like CSS `object-fit: cover`. fx / fy (0..1) pick the focus. */
export function drawCover(ctx, src, sw, sh, w, h, fx = 0.5, fy = 0.5) {
  const s = Math.max(w / sw, h / sh);
  const dw = sw * s, dh = sh * s;
  ctx.drawImage(src, (w - dw) * fx, (h - dh) * fy, dw, dh);
}
