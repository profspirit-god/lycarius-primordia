import { Settings } from '../core/Settings.js';
import { rand } from '../core/math.js';

export class Camera {
  constructor() { this.x = 0; this.y = 0; this.trauma = 0; this.sx = 0; this.sy = 0; }
  addTrauma(t) { this.trauma = Math.min(1, this.trauma + t); }
  update(dt, target) {
    const k = 1 - Math.exp(-8 * dt);
    this.x += (target.x - this.x) * k; this.y += (target.y - this.y) * k;
    this.trauma = Math.max(0, this.trauma - dt * 1.8);
    const amp = Settings.get('screenShake') ? this.trauma * this.trauma * 22 : 0;
    this.sx = rand(-1, 1) * amp; this.sy = rand(-1, 1) * amp;
  }
  apply(ctx, w, h) { ctx.translate(Math.round(w / 2 - this.x + this.sx), Math.round(h / 2 - this.y + this.sy)); }
  screenToWorld(sx, sy, w, h) { return { x: sx - w / 2 + this.x, y: sy - h / 2 + this.y }; }
}
