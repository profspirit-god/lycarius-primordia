import { BurnWardEffect } from "./BurnWardEffect.js";
import { scaled as n } from "../systems/ParticleSystem.js";
import { rand, TAU } from "../core/math.js";
import { WARD_CIRCLE } from "../render/drawMagicCircle.js";

const COST = 25; // mana, paid when the cast completes

/**
 * Self-only buff with a cast time. Hold the key until the circle completes; releasing early cancels for free.
 * Effects while active (see BurnWardEffect):
 *  - fire skill damage taken -30%
 *  - burn ticks do -50% damage
 *  - when a burn ignites: 50% to nullify it, which consumes the ward
 */
/** @type {import('../types.js').SkillDef} */
export const BurnResistance = {
  id: "burnResistance",
  name: "Burn Resistance",
  icon: "🧯",
  hint: "Q (hold)",
  self: true,
  autoRelease: true,
  cooldown: 1,
  chargeTime: 1.2,
  minCharge: 1,
  palette: WARD_CIRCLE,
  duration: 30, // seconds
  nullifyChance: 0.5,
  burnReduction: 0.5,
  fireReduction: 0.3,

  manaCost() {
    return COST;
  },
  canStart(mana) {
    return mana >= COST;
  },
  isActive(owner) {
    return !!owner.ward;
  },

  onChargeStart() {},

  /** Motes rise off the circle and spiral into the caster; a red-orange light swells with the cast. */
  onCharging({ owner, world, charge }, dt) {
    const P = world.particles,
      rr = owner.radius + 30 + charge * 22;
    if (Math.random() < 0.5 + charge) {
      const a = rand(0, TAU);
      P.emit({
        x: owner.x + Math.cos(a) * rr,
        y: owner.y + Math.sin(a) * rr * 0.5,
        z: 0,
        vz: rand(60, 150),
        gravity: -40,
        drag: 1.5,
        life: rand(0.5, 0.9),
        size: rand(1.2, 2.2),
        sizeEnd: 0.2,
        color: WARD_CIRCLE.core,
        colorEnd: WARD_CIRCLE.deep,
      });
    }
    for (let i = 0; i < n(1 + charge * 3); i++) {
      const a = rand(0, TAU),
        life = 0.45;
      P.emit({
        x: owner.x + Math.cos(a) * rr,
        y: owner.y + Math.sin(a) * rr * 0.5,
        z: rand(0, 6),
        vx: (-Math.cos(a) * rr) / life,
        vy: (-Math.sin(a) * rr * 0.5) / life,
        vz: rand(40, owner.height * 1.4),
        gravity: 0,
        drag: 0,
        life,
        size: rand(1.6, 3),
        sizeEnd: 0.4,
        color: [255, 150, 90],
        colorEnd: WARD_CIRCLE.deep,
      });
    }
    world.lights.add({
      x: owner.x,
      y: owner.y,
      z: owner.height * 0.5,
      radius: 70 + charge * 110,
      intensity: 0.35 + charge * 0.45,
      color: WARD_CIRCLE.main,
      once: true,
      life: 1,
    });
  },

  onRelease({ owner, world }) {
    owner.vitals.spend(COST);
    if (owner.ward) {
      owner.ward.refresh();
      return;
    }
    owner.ward = world.spawn(
      new BurnWardEffect({
        world,
        owner,
        duration: BurnResistance.duration,
        nullifyChance: BurnResistance.nullifyChance,
        burnReduction: BurnResistance.burnReduction,
        fireReduction: BurnResistance.fireReduction,
      }),
    );
    world.events.emit("ward", { type: "up", owner, x: owner.x, y: owner.y, z: 0 });
    owner.ward.burst();
  },
};
