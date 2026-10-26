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
import { idleCommand, sanitizeCommand } from "../sim/InputCommand.js";
import { Hunger } from "../sim/hunger/Hunger.js";
import { PRIMORDIA_HUNGER, HUNGER_RESPAWN_FLOOR } from "../sim/hunger/definition.js";

const RESPAWN_TIME = 3; // seconds spent downed

/**
 * The local or remote player. It never reads input: each tick it is given an InputCommand (`applyCommand`, see sim/InputCommand.js).
 * Replicated fields (S1e): cmd { seq mx my aim btn } plus the existing x y vx vy knock aim dodge stunT downed, and toolId (J1: the job tool carried).
 * H2a adds `hunger` (a Hunger: value in hunger points, shown as a percentage; the tier and its multipliers are derived from it). It drains in
 * `update` by sim time and only changes tiers; it affects nothing else until H2b applies the multipliers through X1.
 */
export class Player extends Entity {
  /**
   * @param {import('../progression/Progression.js').Progression} [prog] specialization state; without it the player owns every class skill
   * @param {{ hungerStore?: import('../sim/hunger/HungerStore.js').HungerStore }} [opts] H2a: the saved hunger of this character; without it
   *   the player gets a fresh, unsaved Hunger at the start value (tests, the loading dry run)
   */
  constructor(cls, prog = null, { hungerStore = null } = {}) {
    super();
    this.cls = cls;
    this.prog = prog;
    this.hungerStore = hungerStore; // saves `hunger` (tier change, every 30 s of sim time, eat, respawn); null = nothing is saved
    this.hunger = hungerStore ? hungerStore.hunger : new Hunger(PRIMORDIA_HUNGER);
    this.training = {}; // permanent stat bonus from used stat tickets (sim/stats/StatTraining.js `bonus`), set by the world
    this.stats = { ...cls.stats }; // base stats + specialization bonuses
    this.mods = null; // specialization modifiers (castTimeMult, cooldownMult, elementDamage, skillDamage)
    this.radius = cls.stats.radius;
    this.height = cls.stats.height;
    this.vx = 0;
    this.vy = 0;
    this.knock = { x: 0, y: 0 };
    this.aim = 0;
    this.cmd = idleCommand(); // the command being applied; btnPrev / btnNow give skill presses as rising edges
    this.btnPrev = 0;
    this.btnNow = 0;
    this.kick = 0;
    this.t = 0;
    this.solid = true;
    this.isPlayer = true; // JobSystem and LootSystem look for this (R7: no world.player); gold is paid only to a player
    this.toolId = null; // item id of the job tool carried (basic_axe), written by JobSystem from the Inventory, read by the Chop skill
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

  /** Set the permanent stat bonus from used stat tickets (`{ maxHp: 10, speed: 5, ... }`) and apply it. Unknown keys are ignored. */
  setTraining(bonus) {
    this.training = bonus && typeof bonus === "object" ? { ...bonus } : {};
    this.syncProgression();
  }

  /** Re-read the Progression and the stat training: recompute stats and modifiers, add newly unlocked skill slots. Call after a level-up, a pick or a used ticket. */
  syncProgression() {
    const prog = this.prog,
      base = this.cls.stats;
    this.mods = prog ? prog.mods() : null;
    const add = this.mods?.stats,
      t = this.training;
    const r3 = (n) => Math.round(n * 1000) / 1000; // 0.1 + 3 x 0.05 would otherwise be 0.25000000000000006
    const num = (n) => (Number.isFinite(n) ? n : 0);
    this.stats = {
      ...base,
      maxHp: r3(base.maxHp + num(t.maxHp)),
      hpRegen: r3(base.hpRegen + num(t.hpRegen)),
      maxMana: r3(base.maxMana + (add?.maxMana ?? 0) + num(t.maxMana)),
      manaRegen: r3(base.manaRegen + (add?.manaRegen ?? 0) + num(t.manaRegen)),
      maxStamina: r3(base.maxStamina + num(t.maxStamina)),
      staminaRegen: r3(base.staminaRegen + num(t.staminaRegen)),
      speed: r3(base.speed + num(t.speed)),
    };
    const v = this.vitals,
      s = this.stats,
      gainedHp = s.maxHp - v.maxHp,
      gainedMana = s.maxMana - v.maxMana,
      gainedStamina = s.maxStamina - v.maxStamina;
    Object.assign(v, { maxHp: s.maxHp, hpRegen: s.hpRegen, maxMana: s.maxMana, manaRegen: s.manaRegen, maxStamina: s.maxStamina, staminaRegen: s.staminaRegen });
    if (gainedHp > 0 && v.hp > 0) v.hp += gainedHp; // a higher maximum also fills what it added, never revives
    if (gainedMana > 0) v.mana += gainedMana;
    if (gainedStamina > 0) v.stamina += gainedStamina;
    v.hp = Math.min(v.hp, v.maxHp);
    v.mana = Math.min(v.mana, v.maxMana);
    v.stamina = Math.min(v.stamina, v.maxStamina);
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
  /** Hand the player its next command. Untrusted input is validated; an old or repeated seq is ignored (the last command stays). */
  applyCommand(raw) {
    const c = sanitizeCommand(raw, this.cmd.seq);
    if (c) this.cmd = c;
  }
  /** Bit of `slot` in a command mask (0 when the slot is not one of this player's). */
  slotBit(slot) {
    const i = this.caster.slots.indexOf(slot);
    return i < 0 ? 0 : 1 << i;
  }
  wantsCast(slot) {
    return !this.downed && !this.dodge && !(this.stunT > 0) && (this.btnNow & this.slotBit(slot)) !== 0;
  }

  /** Toggle skills fire on the press (the bit rising since last tick), not while held. */
  wantsToggle(slot) {
    const b = this.slotBit(slot);
    return !this.downed && !(this.stunT > 0) && (this.btnNow & b) !== 0 && (this.btnPrev & b) === 0;
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
  /** Drain hunger by `dt` of sim time (not while downed: `update` returns before it) and announce a tier change. */
  updateHunger(dt, world) {
    const change = this.hunger.update(dt);
    this.announceHunger(change, world);
    this.hungerStore?.tick(dt, !!change);
  }
  /** Emit `hunger:tier` { target, from, to, percent } for a tier change (plain data; later HUD, audio and status code subscribe). */
  announceHunger(change, world) {
    if (change) world?.events?.emit("hunger:tier", { target: this, from: change.from, to: change.to, percent: this.hunger.percent });
  }
  /** Eat food worth `points` (H4 calls this; today the Developer tool does). Returns the `Hunger.eat` result; a success is saved at once. */
  eatHunger(points, world = null) {
    const r = this.hunger.eat(points);
    if (r.ok) {
      this.announceHunger(r.change, world);
      this.hungerStore?.save();
    }
    return r;
  }
  /** Set the hunger value in points (Developer tool, tests). Saved at once. Returns the tier change or null. */
  setHunger(points, world = null) {
    const change = this.hunger.setValue(points);
    this.announceHunger(change, world);
    this.hungerStore?.save();
    return change;
  }

  respawn(world = null) {
    this.setHunger(Math.max(this.hunger.value, HUNGER_RESPAWN_FLOOR), world); // R20: death never lowers hunger, respawn raises it to at least 25%
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
    this.btnPrev = this.btnNow;
    this.btnNow = this.cmd.btn;
    if (this.downed) {
      this.downedTimer -= dt;
      if (this.downedTimer <= 0) this.respawn(world);
      return;
    }
    this.vitals.update(dt);
    this.updateHunger(dt, world);

    const { mx, my } = this.cmd;
    const dodging = this.stepDodge(dt),
      len = Math.max(1, Math.hypot(mx, my)), // a command is already within the unit circle; this keeps a weaker stick slower
      free = this.stunT > 0 || dodging ? 0 : 1; // stunned or dodging: no steering, no casting
    const sp = this.stats.speed * (this.caster.charging ? 0.55 : 1);
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

    this.aim = this.cmd.aim;
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
    const moving = Math.hypot(this.vx, this.vy) / this.stats.speed,
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
