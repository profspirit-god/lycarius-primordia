import { Entity } from "./Entity.js";
import { SkillCaster } from "../systems/SkillCaster.js";
import { Vitals } from "../systems/Vitals.js";
import { drawCylinder } from "../render/drawCylinder.js";
import { drawChargeOrb } from "../render/drawChargeOrb.js";
import { drawAura } from "../render/drawAura.js";
import { drawStun } from "../render/drawStun.js";
import { drawBar } from "../render/drawBar.js";
import { WARD_CIRCLE, FIRE_CIRCLE } from "../render/drawMagicCircle.js";
import { drawGroundCircle } from "../render/drawMagicCircle.js";
import { TAU } from "../core/math.js";
import { Settings } from "../core/Settings.js";
import { UNIVERSAL } from "../classes/Universal.js";

const AIM_Z = 32; // cursor is read at body height so shots land where the sprite visually is
const RESPAWN_TIME = 3; // seconds spent downed

export class Player extends Entity {
  /** @param {import('../progression/Progression.js').Progression} [prog] specialization state; without it the player owns every class skill */
  constructor(cls, prog = null) {
    super();
    this.cls = cls;
    this.prog = prog;
    this.stats = { ...cls.stats }; // base stats + specialization bonuses
    this.mods = null; // specialization modifiers (castTimeMult, cooldownMult, elementDamage, skillDamage)
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
    this.vitals = new Vitals(this.stats);
    this.caster = new SkillCaster(this, [], {});
    this.shield = null; // active FlameShieldEffect, if any
    this.manaBuff = null; // running ManaRegenEffect, if any
    this.dodge = null; // running dodge { t, dur, iFr, fx, fy, tx, ty } (replicated), if any
    this.lowStaminaFlash = 0;
    this.flash = 0;
    this.lowManaFlash = 0;
    this.downed = false;
    this.downedTimer = 0;
    this.syncProgression();
  }

  /** Re-read the Progression: recompute stats and modifiers, add newly unlocked skill slots. Call after a level-up or pick. */
  syncProgression() {
    const prog = this.prog,
      base = this.cls.stats;
    this.mods = prog ? prog.mods() : null;
    const add = this.mods?.stats;
    this.stats = { ...base, maxMana: base.maxMana + (add?.maxMana ?? 0), manaRegen: base.manaRegen + (add?.manaRegen ?? 0) };
    const v = this.vitals,
      gained = this.stats.maxMana - v.maxMana;
    v.maxMana = this.stats.maxMana;
    v.manaRegen = this.stats.manaRegen;
    if (gained > 0) v.mana += gained;
    v.mana = Math.min(v.mana, v.maxMana);
    for (const id of prog ? prog.unlockedSkills() : this.cls.skills) this.caster.addSkill(id, this.cls.bindings[id] ?? []);
    for (const id of UNIVERSAL.skills) this.caster.addSkill(id, UNIVERSAL.bindings[id] ?? []);
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
    return !this.downed && !this.dodge && !(this.stunT > 0) && slot.keys.some((k) => world.input.isDown(k));
  }

  /** Toggle skills fire on the key press, not while held. */
  wantsToggle(slot, world) {
    return !this.downed && !(this.stunT > 0) && slot.keys.some((k) => world.input.wasPressed(k));
  }

  /** Begin a dodge: slide from here to `dist` px along `angle` over `time` s; untouchable for the first `iFr` s. */
  startDodge(angle, dist, time, iFr) {
    this.dodge = { t: 0, dur: time, iFr, fx: this.x, fy: this.y, tx: this.x + Math.cos(angle) * dist, ty: this.y + Math.sin(angle) * dist };
    this.hittable = iFr <= 0;
  }
  /** Advance the dodge (ease-out slide). Returns true while it is still running. */
  stepDodge(dt) {
    const d = this.dodge;
    if (!d) return false;
    const u0 = d.t / d.dur;
    d.t = Math.min(d.dur, d.t + dt);
    const u1 = d.t / d.dur,
      k = (1 - (1 - u1) * (1 - u1)) - (1 - (1 - u0) * (1 - u0));
    this.x += (d.tx - d.fx) * k;
    this.y += (d.ty - d.fy) * k;
    this.hittable = d.t >= d.iFr;
    if (d.t >= d.dur) {
      this.dodge = null;
      this.hittable = true;
      return false;
    }
    return true;
  }

  /** Sim reaction to a hit, called by DamageSystem. The red flash is view state, set by HitEffects. */
  onHit(e) {
    this.vitals.damage(e.damage);
    this.applyImpulse(
      e.dir.x * (120 + 260 * e.charge),
      e.dir.y * (120 + 260 * e.charge),
    );
    if (this.vitals.dead) this.down();
  }
  /** Damage over time (burn tick): no knock-back. The flash is view state, set by BurnFx. */
  onDot(e) {
    this.vitals.damage(e.damage);
    if (this.vitals.dead) this.down();
  }
  down() {
    this.burn = null;
    this.stunT = 0;
    this.ward?.deactivate("downed");
    this.manaBuff?.end("downed");
    this.dodge = null;
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
    this.vitals.configure(this.stats);
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
    this.lowStaminaFlash = Math.max(0, this.lowStaminaFlash - dt);
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
    const dodging = this.stepDodge(dt),
      len = Math.hypot(mx, my) || 1,
      free = this.stunT > 0 || dodging ? 0 : 1; // stunned or dodging: no steering, no casting
    const sp = this.cls.stats.speed * (this.caster.charging ? 0.55 : 1);
    const k = 1 - Math.exp(-14 * dt);
    this.vx += ((mx / len) * sp * free - this.vx) * k;
    this.vy += ((my / len) * sp * free - this.vy) * k;
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
    if (this.stunT > 0) this.caster.cancel();
    this.caster.update(dt, world);
  }

  /** Debug: elapsed / effective cast time above the head. The cast time already includes specialization reductions. */
  drawCastTimer(ctx, y, slot) {
    const done = Math.min(slot.t, slot.need),
      full = slot.t >= slot.need;
    ctx.textAlign = "center";
    ctx.font = "bold 11px Consolas, monospace";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(0,0,0,.85)";
    const label = `${slot.skill.name}  ${done.toFixed(2)} / ${slot.need.toFixed(2)}s`;
    ctx.strokeText(label, this.x, y);
    ctx.fillStyle = full ? "#9dffa0" : "#ffe08a";
    ctx.fillText(label, this.x, y);
    drawBar(ctx, this.x - 30, y + 4, 60, 5, done / slot.need, full ? "#7bd88f" : "#ff8a3a");
  }

  draw(ctx) {
    const moving = Math.hypot(this.vx, this.vy) / this.cls.stats.speed,
      c = Math.cos(this.aim),
      s = Math.sin(this.aim);
    const bob = Math.sin(this.t * 14) * 1.6 * moving;
    const charge = this.caster.chargeLevel;
    if (this.downed) ctx.globalAlpha = 0.3;
    const casting = this.caster.chargingSkill;
    if (casting) {
      // magic circle on the ground; runes light up with the charge
      drawGroundCircle(ctx, this.x, this.y, this.radius + 30 + charge * 22, this.t, charge, {
        palette: casting.palette,
      });
    }
    const top = drawCylinder(ctx, {
      x: this.x,
      y: this.y,
      r: this.radius,
      h: this.height + bob,
      color: this.cls.color,
      flash: this.flash * 0.6,
      tint: casting?.self
        ? { c: (casting.palette ?? FIRE_CIRCLE).main, a: charge * 0.5 }
        : this.ward ? { c: WARD_CIRCLE.main, a: 0.18 * this.ward.level() } : null, // glows red-orange while casting / warded
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
    if (this.stunT > 0) drawStun(ctx, top.tx, top.ty, this.t);
    if (casting?.self)
      drawAura(ctx, this.x, this.y, this.height, this.radius, charge * 0.9, this.t, casting.palette);
    else if (casting) drawChargeOrb(ctx, this.getCastOrigin(), charge, this.aim);
    ctx.globalAlpha = 1;
    const slot = this.caster.chargingSlot;
    if (slot && Settings.get("debugCastTimer")) this.drawCastTimer(ctx, top.ty - 28, slot);
  }
}
