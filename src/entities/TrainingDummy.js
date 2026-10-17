import { Entity } from './Entity.js';
import { drawCylinder } from '../render/drawCylinder.js';
import { drawGlow } from '../render/drawGlow.js';
import { TAU } from '../core/math.js';

/** Infinite-health target. Tracks stats for balancing work. */
export class TrainingDummy extends Entity {
  constructor(x, y) {
    super();
    Object.assign(this, { x, y, radius: 22, height: 64, hittable: true, solid: true });
    this.health = Infinity;
    this.freeze = 0; this.flash = 0; this.glow = 0; this.sway = 0;
    this.lx = 0; this.ly = 0; this.lvx = 0; this.lvy = 0; this.pending = null;
    this.totalDamage = 0; this.hits = 0; this.lastHit = 0; this.log = [];
  }

  /** Called by HitEffects: freeze-frame, white flash, light emission, delayed knock-spring. */
  onHit(e) {
    this.freeze = 0.12 + 0.2 * e.charge; this.flash = 1; this.glow = 1;
    this.pending = { x: e.dir.x * (150 + 300 * e.charge), y: e.dir.y * (150 + 300 * e.charge) * 0.5 };
    this.totalDamage += e.damage; this.hits++; this.lastHit = e.damage;
    this.log.push({ t: performance.now(), d: e.damage });
  }
  dps() {
    const now = performance.now(); this.log = this.log.filter((l) => now - l.t < 5000);
    return Math.round(this.log.reduce((a, l) => a + l.d, 0) / 5);
  }

  update(dt, world) {
    this.flash = Math.max(0, this.flash - dt * 5);
    this.glow = Math.max(0, this.glow - dt * 0.9);
    if (this.freeze > 0) { // FROZEN: all animation halts until the timer ends
      this.freeze -= dt;
      if (this.freeze <= 0 && this.pending) { this.lvx += this.pending.x * 0.5; this.lvy += this.pending.y * 0.5; this.pending = null; }
    } else {
      this.sway += dt * 1.6;
      const k = 180, c = 12; // damped spring back to upright
      this.lvx += (-k * this.lx - c * this.lvx) * dt; this.lvy += (-k * this.ly - c * this.lvy) * dt;
      this.lx += this.lvx * dt; this.ly += this.lvy * dt;
    }
    if (this.glow > 0) { // the dummy emits light after a hit
      world.lights.add({ x: this.x, y: this.y, z: this.height * 0.5, radius: 90 + this.glow * 140, intensity: this.glow * 0.8, color: [255, 170, 80], once: true, life: 1 });
    }
  }

  draw(ctx) {
    const lean = [this.lx + Math.sin(this.sway) * 2, this.ly];
    const top = drawCylinder(ctx, { x: this.x, y: this.y, r: this.radius, h: this.height, color: [178, 134, 86], flash: this.flash, lean });
    for (const [k, col] of [[1, '#b3262b'], [0.66, '#f2e8d5'], [0.33, '#b3262b']]) { // target rings
      ctx.strokeStyle = col; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.ellipse(top.tx, top.ty, this.radius * 0.85 * k, top.ry * 0.85 * k, 0, 0, TAU); ctx.stroke();
    }
    if (this.glow > 0) {
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(ctx, this.x + lean[0] * 0.5, this.y - this.height * 0.5, 80 + this.glow * 60, [255, 160, 70], this.glow * 0.7);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.textAlign = 'center'; ctx.font = 'bold 12px Georgia, serif'; ctx.fillStyle = '#eadfc8';
    ctx.fillText('TRAINING DUMMY', this.x, top.ty - 24);
    ctx.fillStyle = '#7bd88f'; ctx.fillText('HP ∞', this.x, top.ty - 10);
  }
}
