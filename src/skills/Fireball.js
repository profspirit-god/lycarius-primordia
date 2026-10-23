/**
 * The Fireball skill: SIMULATION only (S1f). Numbers, mana cost, cooldown, the ball it spawns and the recoil impulse.
 * Everything you see while charging and on release (rune motes, spiralling embers, the charge light, the discharge ring, the
 * muzzle flash, the camera shake and the body lean `kick`) lives in `view/FireballCastView.js`. It listens to `skill:charging`
 * (SkillCaster, every step while the key is held) and to `cast` (this file, on release).
 * Event: `cast { owner, charge, skill, aim, origin: {x,y,z} }`.
 */
import { FireballProjectile } from "./FireballProjectile.js";
import { clamp, lerp } from "../core/math.js";
const MANA_MIN = 5; // cost at minimum charge
const MANA_MAX = 20; // cost at full charge

/** Skill definition. Charge 0..1 scales size, speed, damage, recoil and mana cost. */
/** @type {import('../types.js').SkillDef} */
export const Fireball = {
  id: "fireball",
  name: "Fireball",
  icon: "flame",
  element: "fire",
  hint: "LMB / Space",
  cooldown: 0.7,
  chargeTime: 1.3,
  minCharge: 0.12,
  damage: [8, 30], // [min, max] across the charge range
  // Chance to set the target on fire on a body hit; chance scales with charge. dps is per second, ticks every 1 s.
  burn: { chance: [0.2, 0.5], duration: [5, 10], dps: 8 },

  manaCost(charge) {
    return Math.ceil(lerp(MANA_MIN, MANA_MAX, charge) - 1e-6);
  },
  /** Highest charge the given mana can pay for. */
  maxAffordableCharge(mana) {
    return clamp((Math.floor(mana) - MANA_MIN) / (MANA_MAX - MANA_MIN), 0, 1);
  },
  canStart(mana) {
    return mana >= this.manaCost(this.minCharge);
  },

  onChargeStart() {},

  onRelease({ owner, world, charge, aim, origin }) {
    owner.vitals.spend(Fireball.manaCost(charge));
    world.events.emit("cast", { owner, charge, skill: Fireball, aim, origin: { x: origin.x, y: origin.y, z: origin.z } });
    const dx = Math.cos(aim),
      dy = Math.sin(aim);
    world.spawn(
      new FireballProjectile({
        owner,
        x: origin.x,
        y: origin.y,
        z: origin.z,
        angle: aim,
        charge,
        damage: Fireball.damage,
        burn: Fireball.burn,
      }),
    );

    // RECOIL: push the caster backward (sim). The body lean and the camera shake are the view's (FireballCastView).
    owner.applyImpulse(
      -dx * lerp(130, 420, charge),
      -dy * lerp(130, 420, charge),
    );
  },
};
