import { SkillRegistry } from "../skills/SkillRegistry.js";

/**
 * Generic hold-to-charge caster. Works with any owner that satisfies
 * `CasterOwner` and any skill that satisfies `SkillDef` (see src/types.js).
 */
export class SkillCaster {
  constructor(owner, skillIds, bindings) {
    this.owner = owner;
    this.slots = skillIds.map((id) => ({
      skill: SkillRegistry.get(id),
      keys: bindings[id] ?? [],
      cooldown: 0,
      charging: false,
      charge: 0,
      t: 0,
    }));
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
  /** Toggle skills (shields, auras): one press switches on, the next switches off. */
  _toggle(s, world, mana) {
    const sk = s.skill;
    if (!this.owner.wantsToggle?.(s, world)) return;
    const ctx = this._ctx(s, world);
    if (sk.isActive(this.owner)) {
      sk.onDeactivate(ctx);
      s.cooldown = sk.cooldown;
    } else if (s.cooldown <= 0) {
      if (!sk.canStart(mana)) this.owner.lowManaFlash = 0.4;
      else {
        sk.onActivate(ctx);
        s.cooldown = sk.cooldown;
      }
    }
  }
  update(dt, world) {
    const mana = this.owner.vitals.mana;
    for (const s of this.slots) {
      const sk = s.skill;
      s.cooldown = Math.max(0, s.cooldown - dt);
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
      const cap = sk.maxAffordableCharge ? sk.maxAffordableCharge(mana) : 1;
      s.charge = Math.min(1, s.t / sk.chargeTime, cap);
      const ctx = this._ctx(s, world);
      if (held && sk.autoRelease && s.charge >= 1) {
        // cast-time skills fire the moment the bar fills
        s.charging = false;
        s.latched = true;
        sk.onRelease(ctx);
        s.cooldown = sk.cooldown;
        s.charge = 0;
        continue;
      }
      if (held) sk.onCharging?.(ctx, dt);
      else {
        s.charging = false;
        if (s.charge >= sk.minCharge) {
          sk.onRelease(ctx);
          s.cooldown = sk.cooldown;
        }
        s.charge = 0;
      }
    }
  }
}
