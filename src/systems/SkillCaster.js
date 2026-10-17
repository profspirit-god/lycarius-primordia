import { SkillRegistry } from '../skills/SkillRegistry.js';

/**
 * Generic hold-to-charge caster. Any skill definition with
 * { chargeTime, minCharge, cooldown, onChargeStart?, onCharging?, onRelease } works.
 */
export class SkillCaster {
  constructor(owner, skillIds, bindings) {
    this.owner = owner;
    this.slots = skillIds.map((id) => ({
      skill: SkillRegistry.get(id), keys: bindings[id] ?? [], cooldown: 0, charging: false, charge: 0, t: 0,
    }));
  }
  get charging() { return this.slots.some((s) => s.charging); }
  get chargeLevel() { return Math.max(0, ...this.slots.map((s) => s.charge)); }
  cancel() { for (const s of this.slots) { s.charging = false; s.charge = 0; s.t = 0; } }
  _ctx(s, world) {
    return { owner: this.owner, world, skill: s.skill, charge: s.charge, aim: this.owner.aim, origin: this.owner.getCastOrigin() };
  }
  update(dt, world) {
    for (const s of this.slots) {
      s.cooldown = Math.max(0, s.cooldown - dt);
      const held = s.keys.some((k) => world.input.isDown(k));
      if (!s.charging) {
        if (held && s.cooldown <= 0 && !this.charging) {
          s.charging = true; s.t = 0; s.charge = 0;
          s.skill.onChargeStart?.(this._ctx(s, world));
        }
        continue;
      }
      s.t += dt; s.charge = Math.min(1, s.t / s.skill.chargeTime);
      const ctx = this._ctx(s, world);
      if (held) s.skill.onCharging?.(ctx, dt);
      else {
        s.charging = false;
        if (s.charge >= s.skill.minCharge) { s.skill.onRelease(ctx); s.cooldown = s.skill.cooldown; }
        s.charge = 0;
      }
    }
  }
}
