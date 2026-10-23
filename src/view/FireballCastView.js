/**
 * View of the Fireball CAST (S1f, client only): what you see while the key is held (rune motes, embers spiralling into the orb,
 * dripping hot embers, the charge light) and on release (body lean, camera shake, the ring of sparks, the muzzle flash, the flash
 * light). It used to live in `skills/Fireball.js`; the numbers are unchanged. Fed by `skill:charging` and `cast` through
 * `SkillViews`. It may write the view-only field `owner.kick` (the lean, decayed and drawn by Player / TrainingDummy, like
 * `flash` and `glow`), never sim state. Its randomness is visual only.
 */
import { scaled as n } from "../systems/ParticleSystem.js";
import { lerp, rand, TAU } from "../core/math.js";

export class FireballCastView {
  constructor(world) {
    this.world = world;
  }

  dispose() {}

  /** Embers spiral INTO the orb; at high charge hot embers drip off and fall with gravity. Once per step while the key is held. */
  charging({ owner, charge, origin }) {
    const world = this.world,
      P = world.particles;
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
  }

  /** The release: lean the body, shake the camera, discharge the circle, muzzle flash. */
  cast({ owner, charge, aim, origin }) {
    const world = this.world;
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
  }
}
