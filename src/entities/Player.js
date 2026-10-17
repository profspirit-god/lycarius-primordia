import { Entity } from './Entity.js';
import { SkillCaster } from '../systems/SkillCaster.js';
import { drawCylinder } from '../render/drawCylinder.js';
import { drawGlow } from '../render/drawGlow.js';
import { TAU } from '../core/math.js';

const AIM_Z = 32; // cursor is read at body height so shots land where the sprite visually is

export class Player extends Entity {
  constructor(cls) {
    super();
    this.cls = cls;
    this.radius = cls.stats.radius; this.height = cls.stats.height;
    this.vx = 0; this.vy = 0; this.knock = { x: 0, y: 0 };
    this.aim = 0; this.kick = 0; this.t = 0; this.solid = true;
    this.caster = new SkillCaster(this, cls.skills, cls.bindings);
  }
  applyImpulse(x, y) { this.knock.x += x; this.knock.y += y; }
  getCastOrigin() {
    return { x: this.x + Math.cos(this.aim) * (this.radius + 12), y: this.y + Math.sin(this.aim) * (this.radius + 12), z: this.height * 0.7 };
  }

  update(dt, world) {
    const i = world.input;
    const mx = Number(i.isDown('KeyD') || i.isDown('ArrowRight')) - Number(i.isDown('KeyA') || i.isDown('ArrowLeft'));
    const my = Number(i.isDown('KeyS') || i.isDown('ArrowDown')) - Number(i.isDown('KeyW') || i.isDown('ArrowUp'));
    const len = Math.hypot(mx, my) || 1;
    const sp = this.cls.stats.speed * (this.caster.charging ? 0.55 : 1);
    const k = 1 - Math.exp(-14 * dt);
    this.vx += ((mx / len) * sp - this.vx) * k; this.vy += ((my / len) * sp - this.vy) * k;
    const kd = Math.exp(-7 * dt); this.knock.x *= kd; this.knock.y *= kd;
    this.x += (this.vx + this.knock.x) * dt; this.y += (this.vy + this.knock.y) * dt;

    for (const e of world.entities) { // push out of solid entities
      if (e === this || !e.solid || e.dead) continue;
      const dx = this.x - e.x, dy = this.y - e.y, d = Math.hypot(dx, dy) || 0.001, min = this.radius + e.radius;
      if (d < min) { this.x = e.x + (dx / d) * min; this.y = e.y + (dy / d) * min; }
    }

    const m = world.camera.screenToWorld(i.mouse.x, i.mouse.y, world.game.width, world.game.height);
    this.aim = Math.atan2(m.y + AIM_Z - this.y, m.x - this.x);
    this.kick *= Math.exp(-6 * dt); this.t += dt;
    this.caster.update(dt, world);
  }

  draw(ctx) {
    const moving = Math.hypot(this.vx, this.vy) / this.cls.stats.speed, c = Math.cos(this.aim), s = Math.sin(this.aim);
    const bob = Math.sin(this.t * 14) * 1.6 * moving;
    const charge = this.caster.chargeLevel;
    if (this.caster.charging) { // charge ring on the ground
      ctx.strokeStyle = `rgba(255,170,70,${0.4 + charge * 0.5})`; ctx.lineWidth = 2 + charge * 3;
      ctx.beginPath(); ctx.ellipse(this.x, this.y, this.radius + 14, (this.radius + 14) * 0.5, 0, -Math.PI / 2, -Math.PI / 2 + TAU * charge); ctx.stroke();
    }
    const top = drawCylinder(ctx, {
      x: this.x, y: this.y, r: this.radius, h: this.height + bob, color: this.cls.color,
      lean: [-c * this.kick * 8, -s * this.kick * 4 + moving * 1.5],
    });
    ctx.fillStyle = '#ffe9b0'; // facing marker
    ctx.beginPath(); ctx.arc(top.tx + c * this.radius * 0.65, top.ty + s * top.ry * 0.65, 3, 0, TAU); ctx.fill();
    if (this.caster.charging) { // charge orb
      const o = this.getCastOrigin(), r = 4 + charge * 13;
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(ctx, o.x, o.y - o.z, r * 3.4, [255, 120, 30], 0.8);
      drawGlow(ctx, o.x, o.y - o.z, r * 1.6, [255, 210, 110], 0.95);
      ctx.fillStyle = '#fff6dc'; ctx.beginPath(); ctx.arc(o.x, o.y - o.z, r * 0.55, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
  }
}
