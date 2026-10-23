import { SkillRegistry } from "../skills/SkillRegistry.js";

/**
 * Generic hold-to-charge caster. Works with any owner that satisfies
 * `CasterOwner` and any skill that satisfies `SkillDef` (see src/types.js).
 */
export class SkillCaster {
  constructor(owner, skillIds, bindings) {
    this.owner = owner;
    this.slots = [];
    for (const id of skillIds) this.addSkill(id, bindings[id] ?? []);
  }
  has(id) {
    return this.slots.some((s) => s.skill.id === id);
  }
  /** Add a skill slot at runtime (specialization unlocks). No-op if already present. */
  addSkill(id, keys = []) {
    if (this.has(id)) return;
    const skill = SkillRegistry.get(id);
    this.slots.push({ skill, keys, cooldown: 0, cdMax: skill.cooldown, charging: false, charge: 0, t: 0, need: skill.chargeTime });
  }
  /** Slot being charged right now, or null. Its `t` and `need` (effective cast time) feed the cast-timer debug. */
  get chargingSlot() {
    return this.slots.find((s) => s.charging) ?? null;
  }
  /** Start a slot's cooldown, shortened by the owner's cooldown modifier. */
  _cd(s) {
    s.cdMax = s.skill.cooldown * (this.owner.mods?.cooldownMult ?? 1);
    s.cooldown = s.cdMax;
  }
  get charging() {
    return this.slots.some((s) => s.charging);
  }
  /** Skill of the slot being charged right now, or null. */
  get chargingSkill() {
    return this.slots.find((s) => s.charging)?.skill ?? null;
  }
  get chargeLevel() {
    return Math.max(0, ...this.slots.map((s) => s.charge));
  }
  cancel() {
    for (const s of this.slots) {
      s.charging = false;
      s.charge = 0;
      s.t = 0;
      s.latched = false;
    }
  }
  _ctx(s, world) {
    return {
      owner: this.owner,
      world,
      skill: s.skill,
      charge: s.charge,
      aim: this.owner.aim,
      origin: this.owner.getCastOrigin(),
    };
  }
  /** `skill:charging` for the views (SkillViews): plain data, every step a hold-to-charge skill is held. The charge look is not drawn from here. */
  _announce(s, world) {
    const o = this.owner,
      at = o.getCastOrigin();
    world.events.emit("skill:charging", { owner: o, skill: s.skill.id, charge: s.charge, aim: o.aim, origin: { x: at.x, y: at.y, z: at.z } });
  }
  /** Toggle skills (shields, auras): one press switches on, the next switches off. */
  _toggle(s, world, mana) {
    const sk = s.skill;
    if (!this.owner.wantsToggle?.(s, world)) return;
    const ctx = this._ctx(s, world);
    if (sk.isActive(this.owner)) {
      sk.onDeactivate(ctx);
      this._cd(s);
    } else if (s.cooldown <= 0) {
      if (!sk.canStart(mana)) this.owner.lowManaFlash = 0.4;
      else {
        sk.onActivate(ctx);
        this._cd(s);
      }
    }
  }
  /** Instant skills (Mana Regen, Dodge): one key press fires them, no charge. Refused while on cooldown or when unaffordable. */
  _instant(s, world, mana) {
    const sk = s.skill,
      o = this.owner;
    if (s.cooldown > 0 || !o.wantsToggle?.(s, world)) return;
    if (sk.canStart && !sk.canStart(mana)) {
      o.lowManaFlash = 0.4;
      return;
    }
    if (sk.canUse && !sk.canUse(o)) {
      sk.onDenied?.(o);
      return;
    }
    sk.onRelease(this._ctx(s, world));
    this._cd(s);
  }
  update(dt, world) {
    const mana = this.owner.vitals.mana;
    for (const s of this.slots) {
      const sk = s.skill;
      s.cooldown = Math.max(0, s.cooldown - dt);
      if (sk.instant) {
        this._instant(s, world, mana);
        continue;
      }
      if (sk.toggle) {
        this._toggle(s, world, mana);
        continue;
      }
      const held = this.owner.wantsCast(s, world);
      if (!s.charging) {
        if (s.latched) {
          // an auto-released cast must not restart until the key is let go
          if (!held) s.latched = false;
          continue;
        }
        if (!held || s.cooldown > 0 || this.charging) continue;
        if (sk.canStart && !sk.canStart(mana)) {
          this.owner.lowManaFlash = 0.4;
          continue;
        } // not enough mana
        s.charging = true;
        s.t = 0;
        s.charge = 0;
        sk.onChargeStart?.(this._ctx(s, world));
        continue;
      }
      s.t += dt;
      s.need = sk.chargeTime * (this.owner.mods?.castTimeMult ?? 1); // cast-time modifier
      const cap = sk.maxAffordableCharge ? sk.maxAffordableCharge(mana) : 1;
      s.charge = Math.min(1, s.t / s.need, cap);
      const ctx = this._ctx(s, world);
      if (held && sk.autoRelease && s.charge >= 1) {
        // cast-time skills fire the moment the bar fills
        s.charging = false;
        s.latched = true;
        sk.onRelease(ctx);
        this._cd(s);
        s.charge = 0;
        continue;
      }
      if (held) {
        this._announce(s, world);
        sk.onCharging?.(ctx, dt);
      } else {
        s.charging = false;
        if (s.charge >= sk.minCharge) {
          sk.onRelease(ctx);
          this._cd(s);
        }
        s.charge = 0;
      }
    }
  }
}
