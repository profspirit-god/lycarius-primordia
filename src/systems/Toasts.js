import { clamp, rgba } from "../core/math.js";

const LIFE = 1.8; // seconds on screen
const SLASH_AT = 0.3; // when the slash starts
const SLASH_DUR = 0.16;

/** Flame silhouette centred on (0,0), height 2s. */
function flamePath(ctx, s) {
  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.bezierCurveTo(s * 0.15, -s * 0.5, s * 0.8, -s * 0.25, s * 0.7, s * 0.3);
  ctx.bezierCurveTo(s * 0.62, s * 0.8, s * 0.25, s, 0, s);
  ctx.bezierCurveTo(-s * 0.25, s, -s * 0.62, s * 0.8, -s * 0.7, s * 0.3);
  ctx.bezierCurveTo(-s * 0.8, -s * 0.25, -s * 0.15, -s * 0.5, 0, -s);
  ctx.closePath();
}

function drawFlame(ctx, color) {
  const g = ctx.createLinearGradient(0, -14, 0, 14);
  g.addColorStop(0, "rgb(255,235,190)");
  g.addColorStop(0.45, rgba(color, 1));
  g.addColorStop(1, "rgb(170,28,14)");
  ctx.fillStyle = g;
  flamePath(ctx, 14);
  ctx.fill();
  ctx.save();
  ctx.translate(0, 5);
  ctx.fillStyle = "rgba(255,245,215,.9)";
  flamePath(ctx, 6.5);
  ctx.fill();
  ctx.restore();
}

/**
 * Small badges floating above an entity (world space, drawn inside the camera transform).
 * kind "burnNullified": a flame icon that gets slashed in two.
 */
export class Toasts {
  constructor() {
    this.list = [];
  }
  spawn(target, { kind = "burnNullified", color = [255, 92, 50] } = {}) {
    this.list.push({ target, kind, color, age: 0, life: LIFE });
  }
  update(dt) {
    const L = this.list;
    let j = 0;
    for (let i = 0; i < L.length; i++) {
      const t = L[i];
      t.age += dt;
      if (t.age < t.life) L[j++] = t;
    }
    L.length = j;
  }

  render(ctx) {
    for (const t of this.list) this.draw(ctx, t);
  }

  draw(ctx, { target, color, age, life }) {
    const p = clamp(age / 0.2, 0, 1) - 1,
      scale = 1 + 2.70158 * p * p * p + 1.70158 * p * p, // ease-out-back: pops in with a slight overshoot
      fade = age > life - 0.45 ? (life - age) / 0.45 : 1,
      rise = clamp(age / life, 0, 1) * 14,
      slash = clamp((age - SLASH_AT) / SLASH_DUR, 0, 1),
      split = clamp((age - SLASH_AT - SLASH_DUR * 0.6) / 0.25, 0, 1);
    ctx.save();
    ctx.globalAlpha = Math.max(0, fade);
    ctx.translate(target.x, target.y - target.height - 46 - rise);
    ctx.scale(scale, scale);

    ctx.shadowColor = rgba(color, 0.9);
    ctx.shadowBlur = 16;
    ctx.fillStyle = "rgba(28,8,4,.9)";
    ctx.strokeStyle = rgba(color, 1);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(-26, -22, 52, 44, 13);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    if (split <= 0) drawFlame(ctx, color);
    else {
      // the slash cuts the icon along "/": each half slides away from the cut
      const d = 4 * (1 - Math.pow(1 - split, 2));
      for (const sg of [-1, 1]) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(-40, 40);
        ctx.lineTo(40, -40);
        ctx.lineTo(sg > 0 ? 40 : -40, sg > 0 ? 40 : -40);
        ctx.closePath();
        ctx.clip();
        ctx.translate(sg * d, sg * d);
        ctx.globalAlpha = Math.max(0, fade) * (1 - split * 0.35);
        drawFlame(ctx, color);
        ctx.restore();
      }
    }

    if (slash > 0) {
      // bright slash stroke sweeping from top-right to bottom-left, then fading
      const a = 1 - clamp((age - SLASH_AT - SLASH_DUR) / 0.3, 0, 1);
      if (a > 0) {
        const x1 = 20 - 40 * slash,
          y1 = -20 + 40 * slash;
        ctx.globalAlpha = Math.max(0, fade) * a;
        ctx.globalCompositeOperation = "lighter";
        ctx.lineCap = "round";
        ctx.shadowColor = rgba(color, 1);
        ctx.shadowBlur = 12;
        ctx.strokeStyle = "rgb(255,240,215)";
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.moveTo(20, -20);
        ctx.lineTo(x1, y1);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = rgba(color, 0.8);
        ctx.lineWidth = 7;
        ctx.globalAlpha *= 0.35;
        ctx.beginPath();
        ctx.moveTo(20, -20);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}
