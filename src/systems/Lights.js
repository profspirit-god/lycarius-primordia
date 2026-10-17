import { drawGlow } from "../render/drawGlow.js";

/** Additive dynamic lights. `once:true` lights live for one frame (re-add each update). */
export class Lights {
  constructor() {
    this.list = [];
  }
  add(l) {
    this.list.push({
      color: [255, 180, 80],
      intensity: 1,
      life: 0.3,
      age: 0,
      once: false,
      ...l,
    });
  }
  update(dt) {
    this.list = this.list.filter((l) => !l.once && (l.age += dt) < l.life);
  }
  render(ctx) {
    ctx.globalCompositeOperation = "lighter";
    for (const l of this.list) {
      const a = l.once
        ? l.intensity
        : l.intensity * Math.pow(1 - l.age / l.life, 1.5);
      ctx.save();
      ctx.translate(l.x, l.y);
      ctx.scale(1, 0.5); // ground light pool
      drawGlow(ctx, 0, 0, l.radius, l.color, a * 0.35);
      ctx.restore();
      drawGlow(ctx, l.x, l.y - (l.z || 0), l.radius * 0.7, l.color, a * 0.45); // air glow
    }
    ctx.globalCompositeOperation = "source-over";
  }
}
