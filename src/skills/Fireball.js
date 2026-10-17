import { FireballProjectile } from "./FireballProjectile.js";
import { scaled as n } from "../systems/ParticleSystem.js";
import { clamp, lerp, rand, TAU } from "../core/math.js";
const MANA_MIN = 5; // cost at minimum charge
const MANA_MAX = 20; // cost at full charge

/** Skill definition. Charge 0..1 scales size, speed, damage, recoil and mana cost. */
/** @type {import('../types.js').SkillDef} */
export const Fireball = {
  id: "fireball",
  name: "Fireball",
  icon: "🔥",
  hint: "LMB / Space",
  cooldown: 0.7,
  chargeTime: 1.3,
  minCharge: 0.12,
  damage: [8, 30], // [min, max] across the charge range

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

  /** Embers spiral INTO the orb; at high charge hot embers drip off and fall with gravity. */
  onCharging({ owner, world, charge, origin }, dt) {
    const P = world.particles;
    // Rune motes lift off the ground circle (same radius as drawGroundCircle in Player / TrainingDummy)
    if (Math.random() < 0.4 + charge) {
      const a = rand(0, TAU),
        rr = owner.radius + 30 + charge * 22;
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
        color: [255, 225, 150],
        colorEnd: [255, 90, 20],
      });
    }
    for (let i = 0; i < n(1 + charge * 4); i++) {
      const a = rand(0, TAU),
        d = rand(35, 75) * (1.1 - charge * 0.4),
        life = 0.35;
      P.emit({
        x: origin.x + Math.cos(a) * d,
        y: origin.y + Math.sin(a) * d * 0.7,
        z: origin.z + rand(-26, 26),
        vx: (-Math.cos(a) * d) / life,
        vy: (-Math.sin(a) * d * 0.7) / life,
        vz: 0,
        gravity: 0,
        drag: 0,
        life,
        size: rand(1.5, 3),
        sizeEnd: 0.4,
        color: [255, 190, 80],
        colorEnd: [255, 80, 20],
      });
    }
    if (charge > 0.45 && Math.random() < charge * 0.5) {
      P.emit({
        x: origin.x + rand(-6, 6),
        y: origin.y,
        z: origin.z,
        vx: rand(-30, 30),
        vy: rand(-10, 10),
        vz: rand(20, 80),
        gravity: 800,
        bounce: 0.4,
        life: rand(0.7, 1.2),
        size: rand(1.5, 2.5),
        sizeEnd: 0.5,
        color: [255, 210, 110],
        colorEnd: [200, 40, 0],
      });
    }
    world.lights.add({
      x: origin.x,
      y: origin.y,
      z: origin.z,
      radius: 70 + charge * 130,
      intensity: 0.4 + charge * 0.5,
      once: true,
      life: 1,
    });
  },

  onRelease({ owner, world, charge, aim, origin }) {
    owner.vitals.spend(Fireball.manaCost(charge));
    world.events.emit("cast", { owner, charge, skill: Fireball });
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
      }),
    );

    // RECOIL: push the caster backward, lean the body, shake the camera.
    owner.applyImpulse(
      -dx * lerp(130, 420, charge),
      -dy * lerp(130, 420, charge),
    );
    owner.kick = 0.7 + charge * 0.9;
    world.camera.addTrauma(0.12 + charge * 0.3);

    // The circle discharges: a ring of sparks flies outward along the ground
    const rr = owner.radius + 30 + charge * 22;
    for (let i = 0; i < n(18 + charge * 30); i++) {
      const a = rand(0, TAU);
      world.particles.emit({
        x: owner.x + Math.cos(a) * rr,
        y: owner.y + Math.sin(a) * rr * 0.5,
        z: 0,
        vx: Math.cos(a) * rand(60, 200),
        vy: Math.sin(a) * rand(30, 100),
        vz: rand(60, 220),
        gravity: 700,
        life: rand(0.4, 0.9),
        size: rand(1.2, 2.4),
        sizeEnd: 0.3,
        color: [255, 225, 150],
        colorEnd: [255, 80, 15],
        shape: "spark",
        stretch: 0.02,
      });
    }
    world.particles.emit({
      shape: "ring",
      x: owner.x,
      y: owner.y,
      z: 0,
      life: 0.45,
      size: rr * 0.8,
      sizeEnd: rr * 2.2,
      color: [255, 200, 110],
    });

    // Muzzle flash
    const P = world.particles;
    for (let i = 0; i < n(14 + charge * 30); i++) {
      const a = aim + rand(-0.4, 0.4),
        s = rand(150, 520);
      P.emit({
        x: origin.x,
        y: origin.y,
        z: origin.z,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        vz: rand(-40, 160),
        gravity: 900,
        life: rand(0.3, 0.8),
        size: rand(1.2, 2.6),
        sizeEnd: 0.4,
        color: [255, 230, 150],
        colorEnd: [255, 70, 10],
        shape: "spark",
        stretch: 0.02,
      });
    }
    world.lights.add({
      x: origin.x,
      y: origin.y,
      z: origin.z,
      radius: 150 + charge * 120,
      intensity: 1,
      life: 0.18,
    });
  },
};
