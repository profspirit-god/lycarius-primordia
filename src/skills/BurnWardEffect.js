import { Entity } from "../entities/Entity.js";
import { scaled as n, quality } from "../systems/ParticleSystem.js";
import { rand, TAU } from "../core/math.js";
import { drawRibbons } from "../render/drawRibbons.js";
import { WARD_CIRCLE } from "../render/drawMagicCircle.js";

const FADE = 0.9; // seconds the ribbons take to die down
const WARN = 4; // the glow flickers during the last seconds of its life
const { main: C_MAIN, core: C_CORE, deep: C_DEEP } = WARD_CIRCLE;

/**
 * The living ward. Spawned by BurnResistance and stored on `owner.ward`.
 * Other code talks to it through: resist(damage) for fire damage, tryNullify() when a burn ignites,
 * pulse() when a burn ticks. It follows its owner, trails particles while the owner moves,
 * and decays into lingering embers when it expires, is spent, or the owner goes down.
 */
export class BurnWardEffect extends Entity {
  constructor({ world, owner, duration, nullifyChance, burnReduction, fireReduction }) {
    super();
    Object.assign(this, {
      world,
      owner,
      life: duration,
      maxLife: duration,
      nullifyChance,
      burnReduction,
      fireReduction,
    });
    this.isWard = true;
    this.state = "active"; // "active" | "fading"
    this.t = 0;
    this.fadeT = 0;
    this.hitFlash = 0;
    this.emberAcc = 0;
    this.trailAcc = 0;
    this.sync();
  }

  /** Sort just in front of the owner so the glow draws over the body. */
  sync() {
    this.x = this.owner.x;
    this.y = this.owner.y + 0.5;
  }

  // --- rules ------------------------------------------------------------
  /** Fire skill damage after resistance. */
  resist(damage) {
    if (this.state !== "active") return damage;
    this.pulse();
    const P = this.world.particles;
    for (let i = 0; i < n(8); i++) {
      P.emit({
        x: this.owner.x + rand(-1, 1) * this.owner.radius,
        y: this.owner.y,
        z: rand(0.2, 0.9) * this.owner.height,
        vx: rand(-80, 80),
        vy: rand(-30, 30),
        vz: rand(60, 200),
        gravity: 500,
        life: rand(0.3, 0.7),
        size: rand(1.2, 2.2),
        sizeEnd: 0.3,
        color: C_CORE,
        colorEnd: C_DEEP,
        shape: "spark",
        stretch: 0.02,
      });
    }
    return Math.max(1, Math.round(damage * (1 - this.fireReduction)));
  }

  /** A burn is trying to ignite. True = nullified (the ward is spent). */
  tryNullify() {
    if (this.state !== "active") return false;
    this.pulse();
    if (!this.world.rng.chance(this.nullifyChance)) return false;
    this.end("spent");
    return true;
  }

  pulse() {
    this.hitFlash = 1;
  }

  /** Recast while active: top the timer up. */
  refresh() {
    this.life = this.maxLife;
    this.pulse();
    this.burst();
    this.world.events.emit("ward", { type: "up", owner: this.owner, x: this.owner.x, y: this.owner.y, z: 0 });
  }

  /** Owner went down, or an external reason. */
  deactivate(reason = "expired") {
    this.end(reason);
  }

  end(reason) {
    if (this.state !== "active") return;
    this.state = "fading";
    this.fadeT = 0;
    if (this.owner.ward === this) this.owner.ward = null;
    this.world.events.emit("ward", {
      type: "down",
      reason,
      owner: this.owner,
      x: this.owner.x,
      y: this.owner.y,
      z: 0,
    });
    this.decay(reason === "spent");
  }

  // --- visuals ----------------------------------------------------------
  /** Cast-complete flash: ground ring and sparks climbing the body. */
  burst() {
    const o = this.owner,
      P = this.world.particles;
    P.emit({ shape: "ring", x: o.x, y: o.y, z: 0, life: 0.5, size: o.radius, sizeEnd: o.radius * 4.5, color: C_MAIN });
    for (let i = 0; i < n(34); i++) {
      const a = rand(0, TAU);
      P.emit({
        x: o.x + Math.cos(a) * o.radius * 1.2,
        y: o.y + Math.sin(a) * o.radius * 0.6,
        z: rand(0, 6),
        vx: Math.cos(a) * rand(10, 50),
        vy: Math.sin(a) * rand(5, 25),
        vz: rand(120, 340),
        gravity: 250,
        drag: 0.8,
        life: rand(0.6, 1.2),
        size: rand(1.4, 2.8),
        sizeEnd: 0.3,
        color: C_CORE,
        colorEnd: C_DEEP,
        shape: "spark",
        stretch: 0.02,
      });
    }
    this.world.lights.add({ x: o.x, y: o.y, z: o.height * 0.5, radius: 260, intensity: 1.2, life: 0.4, color: C_MAIN });
  }

  /** Decay: slow motes hang in the air where the ward was. A spent ward also bursts outward. */
  decay(spent) {
    const o = this.owner,
      P = this.world.particles;
    for (let i = 0; i < n(50); i++) {
      const a = rand(0, TAU);
      P.emit({
        x: o.x + Math.cos(a) * o.radius * rand(0.5, 1.6),
        y: o.y + Math.sin(a) * o.radius * rand(0.3, 0.8),
        z: rand(0, o.height),
        vx: rand(-14, 14),
        vy: rand(-8, 8),
        vz: rand(15, 70),
        gravity: -15,
        drag: 1.2,
        life: rand(1.4, 2.6),
        size: rand(2, 4.2),
        sizeEnd: 0.3,
        color: C_MAIN,
        colorEnd: C_DEEP,
      });
    }
    P.emit({ shape: "ring", x: o.x, y: o.y, z: 0, life: 0.6, size: o.radius * 1.5, sizeEnd: o.radius * 3.2, color: C_DEEP });
    if (spent) {
      for (let i = 0; i < n(30); i++) {
        const a = rand(0, TAU),
          s = rand(100, 300);
        P.emit({
          x: o.x,
          y: o.y,
          z: o.height * rand(0.2, 0.9),
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s * 0.6,
          vz: rand(40, 220),
          gravity: 600,
          life: rand(0.4, 0.9),
          size: rand(1.2, 2.6),
          sizeEnd: 0.3,
          color: C_CORE,
          colorEnd: C_DEEP,
          shape: "spark",
          stretch: 0.025,
        });
      }
    }
  }

  // --- loop -------------------------------------------------------------
  update(dt) {
    const o = this.owner;
    this.t += dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt * 4);
    this.sync();
    if (this.state === "fading") {
      this.fadeT += dt;
      if (this.fadeT >= FADE) this.dead = true;
      return;
    }
    if (o.dead || o.downed) return this.end("downed");
    this.life -= dt;
    if (this.life <= 0) return this.end("expired");
    this.shed(dt);
    this.world.lights.add({
      x: o.x,
      y: o.y,
      z: o.height * 0.5,
      radius: 80 + this.hitFlash * 50,
      intensity: 0.12 + this.hitFlash * 0.5,
      color: C_MAIN,
      once: true,
      life: 1,
    });
  }

  /** Embers around the body, plus short thin dashes streaking behind the owner while it moves. */
  shed(dt) {
    const o = this.owner,
      P = this.world.particles,
      q = quality();
    this.emberAcc += 10 * dt * q;
    while (this.emberAcc >= 1) {
      this.emberAcc -= 1;
      const a = rand(0, TAU);
      P.emit({
        x: o.x + Math.cos(a) * o.radius * 1.1,
        y: o.y + Math.sin(a) * o.radius * 0.55,
        z: rand(0, o.height),
        vz: rand(30, 90),
        gravity: -30,
        drag: 1,
        life: rand(0.6, 1.1),
        size: rand(1.2, 2.4),
        sizeEnd: 0.2,
        color: [255, 170, 100],
        colorEnd: C_DEEP,
      });
    }
    const sp = Math.hypot(o.vx || 0, o.vy || 0);
    if (sp > 25) {
      this.trailAcc += (sp * dt * q) / 14; // one dash per ~14 px travelled
      while (this.trailAcc >= 1) {
        this.trailAcc -= 1;
        P.emit({
          x: o.x + rand(-1, 1) * o.radius * 0.5,
          y: o.y + rand(-1, 1) * o.radius * 0.25,
          z: rand(3, o.height * 0.7),
          vx: -(o.vx || 0) * 0.35,
          vy: -(o.vy || 0) * 0.35,
          vz: 0,
          gravity: 0,
          drag: 3,
          life: rand(0.25, 0.5),
          size: 1,
          sizeEnd: 1,
          len: rand(6, 12),
          shape: "dash",
          color: [255, 150, 90],
          colorEnd: [160, 24, 10],
          alpha: 0.8,
        });
      }
    }
  }

  /** Ribbon strength 0..1.3: pulses, flares on pulse(), flickers when about to expire, fades out when ended. */
  level() {
    if (this.state === "fading") return 1 - this.fadeT / FADE;
    let a = 0.9 + 0.1 * Math.sin(this.t * 5) + this.hitFlash * 0.4;
    if (this.life < WARN) a *= 0.6 + 0.4 * Math.sin(this.t * 14) ** 2;
    return Math.min(1.3, a);
  }

  draw(ctx) {
    const o = this.owner;
    if (o.downed) ctx.globalAlpha = 0.3;
    drawRibbons(ctx, o.x, o.y, o.height, o.radius, this.level(), this.t, WARD_CIRCLE); // ribbons, not a glow: stacks with other buffs
    ctx.globalAlpha = 1;
  }
}
