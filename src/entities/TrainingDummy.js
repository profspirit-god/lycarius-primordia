import { Entity } from "./Entity.js";
import { SkillCaster } from "../systems/SkillCaster.js";
import { Vitals } from "../systems/Vitals.js";
import { drawCylinder } from "../render/drawCylinder.js";
import { drawGlow } from "../render/drawGlow.js";
import { drawBar } from "../render/drawBar.js";
import { drawChargeOrb } from "../render/drawChargeOrb.js";
import { drawGroundCircle } from "../render/drawMagicCircle.js";
import { rand, TAU } from "../core/math.js";

const RESPAWN_TIME = 3;
const MOVE_SPEED = 130; // max walking speed (px/s)
const PATROL_AMP = 260; // patrol line half-length
const PATROL_RATE = 0.5; // rad/s along the sin path
const ORBIT_R = 340; // strafe radius around the player
const ORBIT_RATE = 0.35; // rad/s around the player

/**
 * Passive mode: infinite health, never attacks.
 * Attack mode (Settings > Dummy attacks): uses the player's class stats, casts the class skills at the player, can be defeated.
 */
export class TrainingDummy extends Entity {
  constructor(x, y, { attack = false, cls = null, move = "off" } = {}) {
    super();
    Object.assign(this, {
      x,
      y,
      radius: 22,
      height: 64,
      hittable: true,
      solid: true,
    });
    this.home = { x, y };
    this.move = move; // "off" | "patrol" | "strafe"
    this.vx = 0;
    this.vy = 0;
    this.pathT = 0;
    this.orbitA = 0;
    this.orbitDir = 1;
    this.orbitTimer = rand(3, 6);
    this.attack = attack && !!cls;
    this.cls = cls;
    this.vitals = this.attack ? new Vitals(cls.stats) : null;
    this.caster = this.attack ? new SkillCaster(this, cls.skills, {}) : null;
    this.aim = Math.PI;
    this.kick = 0;
    this.knock = { x: 0, y: 0 };
    this.lowManaFlash = 0;
    this.ai = { cast: false, timer: rand(1.5, 2.5), target: 1, t: 0 };
    this.downed = false;
    this.downedTimer = 0;
    this.freeze = 0;
    this.flash = 0;
    this.glow = 0;
    this.sway = 0;
    this.lx = 0;
    this.ly = 0;
    this.lvx = 0;
    this.lvy = 0;
    this.pending = null;
    this.totalDamage = 0;
    this.hits = 0;
    this.lastHit = 0;
    this.log = [];
  }

  // --- caster interface -------------------------------------------------
  wantsCast(slot) {
    return this.ai.cast && !slot.skill.self; // the AI only fires attack skills for now
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

  // --- combat -----------------------------------------------------------
  /** Called by HitEffects: freeze-frame, white flash, light emission, delayed knock-spring. */
  onHit(e) {
    this.freeze = 0.12 + 0.2 * e.charge;
    this.flash = 1;
    this.glow = 1;
    this.pending = {
      x: e.dir.x * (150 + 300 * e.charge),
      y: e.dir.y * (150 + 300 * e.charge) * 0.5,
    };
    this.totalDamage += e.damage;
    this.hits++;
    this.lastHit = e.damage;
    this.log.push({ t: performance.now(), d: e.damage });
    if (this.attack) {
      this.vitals.damage(e.damage);
      if (this.vitals.dead) this.down();
    }
  }
  /** Damage over time (burn tick): counts toward total damage and DPS, not toward hits. */
  onDot(e) {
    this.flash = 0.8;
    this.glow = 1;
    this.totalDamage += e.damage;
    this.log.push({ t: performance.now(), d: e.damage });
    if (this.attack) {
      this.vitals.damage(e.damage);
      if (this.vitals.dead) this.down();
    }
  }
  down() {
    this.burn = null;
    this.ward?.deactivate("downed");
    this.downed = true;
    this.downedTimer = RESPAWN_TIME;
    this.hittable = false;
    this.solid = false;
    this.caster.cancel();
    this.ai.cast = false;
  }
  respawn() {
    this.vitals.configure(this.cls.stats);
    this.x = this.home.x;
    this.y = this.home.y;
    this.knock.x = 0;
    this.knock.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.downed = false;
    this.hittable = true;
    this.solid = true;
    this.ai.cast = false;
    this.ai.timer = rand(1.5, 2.5);
  }
  dps() {
    const now = performance.now();
    this.log = this.log.filter((l) => now - l.t < 5000);
    return Math.round(this.log.reduce((a, l) => a + l.d, 0) / 5);
  }

  /** Steer toward the movement-mode target point; velocity eases so direction changes look weighty. */
  steer(dt, world) {
    let tx = this.home.x,
      ty = this.home.y;
    const p = world.player;
    if (this.move === "patrol") {
      this.pathT += dt * PATROL_RATE;
      ty += Math.sin(this.pathT) * PATROL_AMP;
    } else if (this.move === "strafe" && !p.downed) {
      this.orbitTimer -= dt;
      if (this.orbitTimer <= 0) {
        this.orbitDir = -this.orbitDir;
        this.orbitTimer = rand(3, 6);
      }
      this.orbitA += this.orbitDir * ORBIT_RATE * dt;
      tx = p.x + Math.cos(this.orbitA) * ORBIT_R;
      ty = p.y + Math.sin(this.orbitA) * ORBIT_R;
    }
    const dx = tx - this.x,
      dy = ty - this.y,
      d = Math.hypot(dx, dy) || 1,
      sp = Math.min(MOVE_SPEED, d * 3); // slow down on arrival
    const k = 1 - Math.exp(-4 * dt);
    this.vx += ((dx / d) * sp - this.vx) * k;
    this.vy += ((dy / d) * sp - this.vy) * k;
  }

  /** Simple AI: lead the target, charge to a random level, release, wait, repeat. */
  think(dt, world) {
    const p = world.player,
      ai = this.ai;
    const d = Math.hypot(p.x - this.x, p.y - this.y);
    if (p.downed || d > 1000) {
      ai.cast = false;
      return;
    }
    const lead = Math.min(0.6, d / 800) * 0.7;
    this.aim = Math.atan2(
      p.y + p.vy * lead - this.y,
      p.x + p.vx * lead - this.x,
    );
    if (!ai.cast) {
      ai.timer -= dt;
      if (ai.timer <= 0 && this.vitals.mana >= 8) {
        ai.cast = true;
        ai.target = rand(0.4, 1);
        ai.t = 0;
      }
    } else {
      ai.t += dt;
      if (
        (this.caster.charging && this.caster.chargeLevel >= ai.target) ||
        ai.t > 2.5
      ) {
        ai.cast = false;
        ai.timer = rand(1.2, 2.6);
      }
    }
  }

  update(dt, world) {
    this.flash = Math.max(0, this.flash - dt * 5);
    this.glow = Math.max(0, this.glow - dt * 0.9);
    this.lowManaFlash = Math.max(0, this.lowManaFlash - dt);
    if (this.downed) {
      this.downedTimer -= dt;
      if (this.downedTimer <= 0) this.respawn();
      return;
    }
    if (this.attack) this.vitals.update(dt);

    if (this.freeze > 0) {
      // FROZEN: all animation halts until the timer ends; a hit also staggers casting
      this.freeze -= dt;
      if (this.attack) {
        this.caster.cancel();
        this.ai.cast = false;
      }
      if (this.freeze <= 0 && this.pending) {
        this.lvx += this.pending.x * 0.5;
        this.lvy += this.pending.y * 0.5;
        this.pending = null;
      }
    } else {
      this.sway += dt * 1.6;
      const k = 180,
        c = 12; // damped spring back to upright
      this.lvx += (-k * this.lx - c * this.lvx) * dt;
      this.lvy += (-k * this.ly - c * this.lvy) * dt;
      this.lx += this.lvx * dt;
      this.ly += this.lvy * dt;
      if (this.attack) {
        this.think(dt, world);
        this.caster.update(dt, world);
      }
    }

    // recoil slide, then ease back to the home position
    const kd = Math.exp(-7 * dt);
    this.knock.x *= kd;
    this.knock.y *= kd;
    this.kick *= Math.exp(-6 * dt);
    if (this.move === "off") {
      const home = 1 - Math.exp(-1.5 * dt);
      this.x += this.knock.x * dt + (this.home.x - this.x) * home;
      this.y += this.knock.y * dt + (this.home.y - this.y) * home;
    } else {
      if (this.freeze <= 0) this.steer(dt, world);
      else {
        this.vx = 0;
        this.vy = 0;
      }
      this.x += (this.vx + this.knock.x) * dt;
      this.y += (this.vy + this.knock.y) * dt;
    }

    if (this.glow > 0) {
      // the dummy emits light after a hit
      world.lights.add({
        x: this.x,
        y: this.y,
        z: this.height * 0.5,
        radius: 90 + this.glow * 140,
        intensity: this.glow * 0.8,
        color: [255, 170, 80],
        once: true,
        life: 1,
      });
    }
  }

  draw(ctx) {
    const c = Math.cos(this.aim),
      s = Math.sin(this.aim);
    const lean = [
      this.lx + Math.sin(this.sway) * 2 + this.vx * 0.03 - (this.attack ? c * this.kick * 8 : 0),
      this.ly + this.vy * 0.015 - (this.attack ? s * this.kick * 4 : 0),
    ];
    if (this.downed) ctx.globalAlpha = 0.3;
    if (this.attack && this.caster.charging)
      drawGroundCircle(ctx, this.x, this.y, this.radius + 30 + this.caster.chargeLevel * 22, performance.now() / 1000, this.caster.chargeLevel);
    const top = drawCylinder(ctx, {
      x: this.x,
      y: this.y,
      r: this.radius,
      h: this.height,
      color: [178, 134, 86],
      flash: this.flash,
      lean,
    });
    for (const [k, col] of [
      [1, "#b3262b"],
      [0.66, "#f2e8d5"],
      [0.33, "#b3262b"],
    ]) {
      // target rings
      ctx.strokeStyle = col;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.ellipse(
        top.tx,
        top.ty,
        this.radius * 0.85 * k,
        top.ry * 0.85 * k,
        0,
        0,
        TAU,
      );
      ctx.stroke();
    }
    if (this.attack) {
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
      if (this.caster.charging)
        drawChargeOrb(ctx, this.getCastOrigin(), this.caster.chargeLevel, this.aim);
    }
    if (this.glow > 0) {
      ctx.globalCompositeOperation = "lighter";
      drawGlow(
        ctx,
        this.x + lean[0] * 0.5,
        this.y - this.height * 0.5,
        80 + this.glow * 60,
        [255, 160, 70],
        this.glow * 0.7,
      );
      ctx.globalCompositeOperation = "source-over";
    }
    ctx.textAlign = "center";
    ctx.font = "bold 12px Georgia, serif";
    ctx.fillStyle = "#eadfc8";
    if (this.attack) {
      const v = this.vitals;
      ctx.fillText(
        this.downed ? "DEFEATED" : "TRAINING DUMMY · HOSTILE",
        this.x,
        top.ty - 34,
      );
      drawBar(ctx, this.x - 30, top.ty - 26, 60, 6, v.hp / v.maxHp, "#d93b3b");
      drawBar(
        ctx,
        this.x - 30,
        top.ty - 18,
        60,
        5,
        v.mana / v.maxMana,
        "#3b82f6",
      );
    } else {
      ctx.fillText("TRAINING DUMMY", this.x, top.ty - 24);
      ctx.fillStyle = "#7bd88f";
      ctx.fillText("HP ∞", this.x, top.ty - 10);
    }
    ctx.globalAlpha = 1;
  }
}
