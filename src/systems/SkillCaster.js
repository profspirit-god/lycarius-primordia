import { SkillRegistry } from "../skills/SkillRegistry.js";

/**
 * Generic hold-to-charge caster. The owner supplies:
 *   owner.vitals, owner.aim, owner.getCastOrigin(), owner.wantsCast(slot, world)
 * Skill definition: { chargeTime, minCharge, cooldown, canStart?, maxAffordableCharge?, onChargeStart?, onCharging?, onRelease }
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
  get chargeLevel() {
    return Math.max(0, ...this.slots.map((s) => s.charge));
  }
  cancel() {
    for (const s of this.slots) {
      s.charging = false;
      s.charge = 0;
      s.t = 0;
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
  update(dt, world) {
    const mana = this.owner.vitals.mana;
    for (const s of this.slots) {
      const sk = s.skill;
      s.cooldown = Math.max(0, s.cooldown - dt);
      const held = this.owner.wantsCast(s, world);
      if (!s.charging) {
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
