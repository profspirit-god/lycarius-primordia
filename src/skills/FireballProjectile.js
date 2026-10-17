import { Entity } from '../entities/Entity.js';
import { Settings } from '../core/Settings.js';
import { dist, lerp, lerpColor, rand, rgba, TAU } from '../core/math.js';
import { drawGlow } from '../render/drawGlow.js';

const n = (v) => Math.max(1, Math.round(v * Settings.get('particleQuality')));

export class FireballProjectile extends Entity {
  constructor({ owner, x, y, z, angle, charge }) {
    super();
    Object.assign(this, { owner, x, y, z, charge });
    this.speed = lerp(520, 900, charge);
    this.radius = lerp(8, 19, charge);
    this.vx = Math.cos(angle) * this.speed; this.vy = Math.sin(angle) * this.speed;
    this.maxRange = 1200; this.travelled = 0; this.trail = []; this.t = 0;
  }

  update(dt, world) {
    this.t += dt;
    const step = this.speed * dt, steps = Math.max(1, Math.ceil(step / this.radius));
    for (let i = 0; i < steps && !this.dead; i++) {
      this.x += (this.vx * dt) / steps; this.y += (this.vy * dt) / steps;
      this.checkHit(world);
    }
    this.travelled += step;
    if (!this.dead && this.travelled > this.maxRange) { this.dead = true; this.fizzle(world); }

    // trail history (head -> tail), aged and culled
    this.trail.push({ x: this.x, y: this.y, z: this.z, age: 0 });
    for (const p of this.trail) p.age += dt;
    this.trail = this.trail.filter((p) => p.age < 0.32);

    // particle trail: embers shed from the ball and FALL with gravity
    const P = world.particles;
    for (let i = 0; i < n(2 + this.charge * 5); i++) {
      P.emit({ x: this.x + rand(-4, 4), y: this.y + rand(-4, 4), z: this.z + rand(-this.radius, this.radius) * 0.6,
        vx: rand(-40, 40) - this.vx * 0.05, vy: rand(-40, 40) - this.vy * 0.05, vz: rand(10, 110),
        gravity: 750, bounce: 0.45, life: rand(0.5, 1.1), size: rand(1.4, 3.2) + this.charge * 1.5, sizeEnd: 0.3,
        color: [255, 200, 90], colorEnd: [190, 30, 0] });
    }
    if (Math.random() < 0.4) {
      P.emit({ x: this.x, y: this.y, z: this.z, vx: rand(-20, 20), vy: rand(-20, 20), vz: rand(10, 40), gravity: -60, drag: 2,
        life: rand(0.5, 0.9), size: this.radius * 0.5, sizeEnd: this.radius * 1.3, color: [60, 50, 50], alpha: 0.25, additive: false });
    }
    world.lights.add({ x: this.x, y: this.y, z: this.z, radius: 130 + this.charge * 150, intensity: 0.85, once: true, life: 1 });
  }

  checkHit(world) {
    for (const e of world.entities) {
      if (!e.hittable || e.dead || e === this.owner) continue;
      if (dist(this.x, this.y, e.x, e.y) < this.radius + e.radius && this.z < e.height + this.radius) { this.hit(e, world); return; }
    }
  }

  hit(target, world) {
    const len = Math.hypot(this.vx, this.vy) || 1, dir = { x: this.vx / len, y: this.vy / len };
    const crit = Math.random() < 0.12;
    const damage = Math.round(lerp(15, 110, Math.pow(this.charge, 1.3)) * rand(0.9, 1.1) * (crit ? 1.75 : 1));
    this.dead = true;
    world.events.emit('hit', { source: this.owner, target, damage, crit, dir, charge: this.charge, x: this.x, y: this.y, z: this.z });
  }

  fizzle(world) {
    for (let i = 0; i < n(20); i++) {
      const a = rand(0, TAU), s = rand(40, 220);
      world.particles.emit({ x: this.x, y: this.y, z: this.z, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: rand(40, 220),
        life: rand(0.4, 0.9), size: rand(1.5, 3), sizeEnd: 0.3, color: [255, 190, 80], colorEnd: [150, 20, 0] });
    }
  }

  draw(ctx) {
    const sx = this.x, sy = this.y - this.z, r = this.radius, flick = 0.85 + 0.15 * Math.sin(this.t * 50);
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.beginPath(); ctx.ellipse(this.x, this.y, r * 1.2, r * 0.6, 0, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    const L = this.trail.length;
    for (let i = 1; i < L; i++) { // tapered, colour-graded trail
      const t = i / L, a = this.trail[i - 1], b = this.trail[i];
      ctx.strokeStyle = rgba(lerpColor([255, 60, 10], [255, 210, 90], t), t * 0.75);
      ctx.lineWidth = r * 2 * t * flick;
      ctx.beginPath(); ctx.moveTo(a.x, a.y - a.z); ctx.lineTo(b.x, b.y - b.z); ctx.stroke();
    }
    drawGlow(ctx, sx, sy, r * 4.6 * flick, [255, 110, 25], 0.8);   // outer glow
    drawGlow(ctx, sx, sy, r * 2.3, [255, 200, 90], 0.95);          // inner glow
    ctx.fillStyle = 'rgba(255,250,225,1)';
    ctx.beginPath(); ctx.arc(sx, sy, r * 0.6, 0, TAU); ctx.fill(); // white-hot core
    ctx.globalCompositeOperation = 'source-over';
  }
}
