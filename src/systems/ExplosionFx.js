import { scaled as n } from "./ParticleSystem.js";
import { explosionRadius } from "./ExplosionSystem.js";
import { clamp, dist, rand, TAU } from "../core/math.js";

/** Visuals for 'explosion' events: fireball, sparks, smoke, shockwaves, light, and screen shake that fades with distance. */
export class ExplosionFx {
  constructor(world) {
    this.world = world;
    this.off = world.events.on("explosion", (e) => this.onExplosion(e));
  }
  dispose() {
    this.off();
  }

  onExplosion({ x, y, z, charge }) {
    const w = this.world,
      P = w.particles,
      R = explosionRadius(charge);
    for (let i = 0; i < n(30 + charge * 70); i++) {
      // fire billow
      const a = rand(0, TAU),
        s = rand(40, R * 2.2);
      P.emit({ x, y, z, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6, vz: rand(-40, 220), gravity: 200, drag: 2.2,
        life: rand(0.35, 0.8), size: rand(7, 14) + charge * 8, sizeEnd: 1, color: [255, 210, 110], colorEnd: [200, 40, 5], shape: "dot" });
    }
    for (let i = 0; i < n(40 + charge * 90); i++) {
      // flying sparks that fall with gravity
      const a = rand(0, TAU),
        s = rand(160, 620) * (0.6 + charge * 0.6);
      P.emit({ x, y, z, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6, vz: rand(100, 460), gravity: 1100, bounce: 0.45,
        life: rand(0.5, 1.2), size: rand(1.2, 3), sizeEnd: 0.4, color: [255, 235, 160], colorEnd: [255, 60, 10], shape: "spark", stretch: 0.025 });
    }
    for (let i = 0; i < n(6 + charge * 8); i++) {
      // smoke
      const a = rand(0, TAU),
        s = rand(20, 120);
      P.emit({ x, y, z, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: rand(20, 90), gravity: -70, drag: 2,
        life: rand(0.9, 1.6), size: rand(8, 14), sizeEnd: rand(26, 44), color: [70, 60, 60], alpha: 0.35, additive: false });
    }
    P.emit({ shape: "ring", x, y, z: 0, life: 0.5, size: 10, sizeEnd: R * 1.1, color: [255, 190, 100] });
    P.emit({ shape: "ring", x, y, z: 0, life: 0.32, size: 6, sizeEnd: R * 0.6, color: [255, 240, 200] });
    w.lights.add({ x, y, z, radius: R * 2.4, intensity: 1.5, life: 0.45, color: [255, 170, 70] });
    w.lights.add({ x, y, z, radius: R, intensity: 1.1, life: 0.16, color: [255, 245, 210] });

    const d = dist(x, y, w.player.x, w.player.y),
      near = clamp(1 - d / 900, 0, 1);
    w.camera.addTrauma((0.15 + 0.5 * charge) * near);
    if (d < 500) w.hitstop(0.03 + 0.04 * charge);
  }
}
