// Presentation for 'blast' events (Fire Blast): ground shockwaves, fire billow, sparks, smoke, light, shake.
// Client-only; the gameplay lives in skills/FireBlast.js.
import { scaled as n } from "./ParticleSystem.js";
import { clamp, dist, rand, TAU } from "../core/math.js";

export class BlastFx {
  constructor(world) {
    this.world = world;
    this.off = world.events.on("blast", (e) => this.onBlast(e));
  }
  dispose() {
    this.off();
  }

  /** @param {import('../types.js').BlastEvent} e */
  onBlast({ x, y, z, radius: R }) {
    const w = this.world,
      P = w.particles;
    // expanding ground rings, the last one reaches the edge of the damage radius
    P.emit({ shape: "ring", x, y, z: 0, life: 0.55, size: 14, sizeEnd: R * 1.05, color: [255, 190, 100] });
    P.emit({ shape: "ring", x, y, z: 0, life: 0.38, size: 8, sizeEnd: R * 0.7, color: [255, 240, 200] });
    P.emit({ shape: "ring", x, y, z: 0, life: 0.75, size: 10, sizeEnd: R * 1.2, color: [255, 90, 25] });
    for (let i = 0; i < n(110); i++) {
      // fire billow thrown outwards in every direction
      const a = rand(0, TAU),
        s = rand(120, R * 2.6);
      P.emit({ x, y, z, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6, vz: rand(-30, 240), gravity: 200, drag: 2.4,
        life: rand(0.4, 0.9), size: rand(9, 20), sizeEnd: 1, color: [255, 215, 120], colorEnd: [200, 40, 5], shape: "dot" });
    }
    for (let i = 0; i < n(130); i++) {
      // sparks that arc and fall
      const a = rand(0, TAU),
        s = rand(220, 760);
      P.emit({ x, y, z, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6, vz: rand(120, 520), gravity: 1100, bounce: 0.45,
        life: rand(0.6, 1.4), size: rand(1.2, 3.2), sizeEnd: 0.4, color: [255, 235, 160], colorEnd: [255, 60, 10], shape: "spark", stretch: 0.025 });
    }
    for (let i = 0; i < n(14); i++) {
      const a = rand(0, TAU),
        s = rand(30, 150);
      P.emit({ x, y, z, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: rand(20, 100), gravity: -70, drag: 2,
        life: rand(1, 1.8), size: rand(10, 16), sizeEnd: rand(30, 52), color: [70, 60, 60], alpha: 0.35, additive: false });
    }
    w.lights.add({ x, y, z, radius: R * 2.6, intensity: 1.7, life: 0.5, color: [255, 170, 70] });
    w.lights.add({ x, y, z, radius: R, intensity: 1.2, life: 0.18, color: [255, 245, 210] });
    const d = dist(x, y, w.player.x, w.player.y);
    w.camera.addTrauma(0.7 * clamp(1 - d / 900, 0, 1));
    if (d < 500) w.hitstop(0.05);
  }
}
