import { Entity } from "./Entity.js";
import { SkillCaster } from "../systems/SkillCaster.js";
import { Vitals } from "../systems/Vitals.js";
import { drawCylinder } from "../render/drawCylinder.js";
import { drawChargeOrb } from "../render/drawChargeOrb.js";
import { drawGroundCircle } from "../render/drawMagicCircle.js";
import { TAU } from "../core/math.js";

const AIM_Z = 32; // cursor is read at body height so shots land where the sprite visually is
const RESPAWN_TIME = 3; // seconds spent downed

export class Player extends Entity {
  constructor(cls) {
    super();
    this.cls = cls;
    this.radius = cls.stats.radius;
    this.height = cls.stats.height;
    this.vx = 0;
    this.vy = 0;
    this.knock = { x: 0, y: 0 };
    this.aim = 0;
    this.kick = 0;
    this.t = 0;
    this.solid = true;
    this.hittable = true;
    this.damageColor = "#ff6b6b";
    this.home = { x: 0, y: 0 };
    this.vitals = new Vitals(cls.stats);
    this.caster = new SkillCaster(this, cls.skills, cls.bindings);
    this.shield = null; // active FlameShieldEffect, if any
    this.flash = 0;
    this.lowManaFlash = 0;
    this.downed = false;
    this.downedTimer = 0;
  }
  applyImpulse(x, y) {
    this.knock.x += x;
    this.knock.y += y;
  }
  getCastOrigin() {
    return {
      x: this.x + Math.cos(this.aim) * (this.radius + 12),
      y: this.y + Math.sin(this.aim) * (this.radius + 12),
      z: this.height * 0.7,
    };
  }
  wantsCast(slot, world) {
    return !this.downed && slot.keys.some((k) => world.input.isDown(k));
  }

  /** Toggle skills fire on the key press, not while held. */
  wantsToggle(slot, world) {
    return !this.downed && slot.keys.some((k) => world.input.wasPressed(k));
  }

  /** Called by HitEffects when something hits the player. */
  onHit(e) {
    this.vitals.damage(e.damage);
    this.flash = 1;
    this.applyImpulse(
      e.dir.x * (120 + 260 * e.charge),
      e.dir.y * (120 + 260 * e.charge),
    );
    if (this.vitals.dead) this.down();
  }
  down() {
    this.downed = true;
    this.downedTimer = RESPAWN_TIME;
    this.hittable = false;
    this.solid = false;
    this.caster.cancel();
    this.shield?.deactivate("downed");
    this.vx = 0;
    this.vy = 0;
  }
  respawn() {
    this.vitals.configure(this.cls.stats);
    this.x = this.home.x;
    this.y = this.home.y;
    this.knock.x = 0;
    this.knock.y = 0;
    this.downed = false;
    this.hittable = true;
    this.solid = true;
  }

  update(dt, world) {
    this.flash = Math.max(0, this.flash - dt * 5);
    this.lowManaFlash = Math.max(0, this.lowManaFlash - dt);
    if (this.downed) {
      this.downedTimer -= dt;
      if (this.downedTimer <= 0) this.respawn();
      return;
    }
    this.vitals.update(dt);

    const i = world.input;
    const mx =
      Number(i.isDown("KeyD") || i.isDown("ArrowRight")) -
      Number(i.isDown("KeyA") || i.isDown("ArrowLeft"));
    const my =
      Number(i.isDown("KeyS") || i.isDown("ArrowDown")) -
      Number(i.isDown("KeyW") || i.isDown("ArrowUp"));
    const len = Math.hypot(mx, my) || 1;
    const sp = this.cls.stats.speed * (this.caster.charging ? 0.55 : 1);
    const k = 1 - Math.exp(-14 * dt);
    this.vx += ((mx / len) * sp - this.vx) * k;
    this.vy += ((my / len) * sp - this.vy) * k;
    const kd = Math.exp(-7 * dt);
    this.knock.x *= kd;
    this.knock.y *= kd;
    this.x += (this.vx + this.knock.x) * dt;
    this.y += (this.vy + this.knock.y) * dt;

    for (const e of world.entities) {
      // push out of solid entities
      if (e === this || !e.solid || e.dead) continue;
      const dx = this.x - e.x,
        dy = this.y - e.y,
        d = Math.hypot(dx, dy) || 0.001,
        min = this.radius + e.radius;
      if (d < min) {
        this.x = e.x + (dx / d) * min;
        this.y = e.y + (dy / d) * min;
      }
    }

    const m = world.camera.screenToWorld(
      i.mouse.x,
      i.mouse.y,
      world.game.width,
      world.game.height,
    );
    this.aim = Math.atan2(m.y + AIM_Z - this.y, m.x - this.x);
    this.kick *= Math.exp(-6 * dt);
    this.t += dt;
    this.caster.update(dt, world);
  }

  draw(ctx) {
    const moving = Math.hypot(this.vx, this.vy) / this.cls.stats.speed,
      c = Math.cos(this.aim),
      s = Math.sin(this.aim);
    const bob = Math.sin(this.t * 14) * 1.6 * moving;
    const charge = this.caster.chargeLevel;
    if (this.downed) ctx.globalAlpha = 0.3;
    if (this.caster.charging) {
      // magic circle on the ground; runes light up with the charge
      drawGroundCircle(ctx, this.x, this.y, this.radius + 30 + charge * 22, this.t, charge);
    }
    const top = drawCylinder(ctx, {
      x: this.x,
      y: this.y,
      r: this.radius,
      h: this.height + bob,
      color: this.cls.color,
      flash: this.flash * 0.6,
      lean: [-c * this.kick * 8, -s * this.kick * 4 + moving * 1.5],
    });
    ctx.fillStyle = "#ffe9b0"; // facing marker
    ctx.beginPath();
    ctx.arc(
      top.tx + c * this.radius * 0.65,
      top.ty + s * top.ry * 0.65,
      3,
      0,
      TAU,
    );
    ctx.fill();
    if (this.caster.charging) drawChargeOrb(ctx, this.getCastOrigin(), charge, this.aim);
    ctx.globalAlpha = 1;
  }
}
