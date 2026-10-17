import { scaled as n } from "./ParticleSystem.js";
import { rand, TAU } from "../core/math.js";

/**
 * Listens to 'hit' and layers every impact effect:
 * freeze + flash + glow on the target, hit-stop, shake, damage number,
 * front sparks, BURST BEHIND the target, shockwave rings, smoke, light flash.
 * To add a new hit reaction, add a method here and call it from onHit.
 */
export class HitEffects {
  constructor(world) {
    this.world = world;
    this.off = world.events.on("hit", (e) => this.onHit(e));
  }
  dispose() {
    this.off();
  }

  /** @param {import('../types.js').HitEvent} e */
  onHit(e) {
    const w = this.world,
      { target, dir, charge, crit } = e;
    const mid = target.height * 0.55;
    target.onHit?.(e);
    w.hitstop(0.04 + 0.06 * charge);
    w.camera.addTrauma(0.22 + 0.45 * charge);
    w.damageNumbers.spawn(
      target.x,
      target.y - target.height - 8,
      String(e.damage),
      {
        crit,
        color: target.damageColor ?? (crit ? "#ff7a3d" : "#ffe08a"),
      },
    );
    this.frontSparks(e);
    this.backBurst(e, mid);
    this.shockwaves(e);
    w.lights.add({
      x: target.x,
      y: target.y,
      z: mid,
      radius: 240 + charge * 220,
      intensity: 1.3,
      life: 0.4,
      color: [255, 170, 70],
    });
    w.lights.add({
      x: target.x,
      y: target.y,
      z: mid,
      radius: 90 + charge * 90,
      intensity: 1.0,
      life: 0.15,
      color: [255, 245, 210],
    });
  }

  frontSparks({ x, y, z, charge, dir }) {
    const P = this.world.particles;
    for (let i = 0; i < n(36 + charge * 70); i++) {
      const a = rand(0, TAU),
        s = rand(120, 460) * (0.7 + charge * 0.6);
      P.emit({
        x,
        y,
        z,
        vx: Math.cos(a) * s - dir.x * 90,
        vy: Math.sin(a) * s * 0.6 - dir.y * 90,
        vz: rand(120, 480),
        gravity: 1150,
        bounce: 0.5,
        life: rand(0.6, 1.3),
        size: rand(1.2, 3),
        sizeEnd: 0.4,
        color: [255, 235, 160],
        colorEnd: [255, 60, 10],
        shape: "spark",
        stretch: 0.025,
      });
    }
  }

  /** The "burst behind the enemy": a cone of fire/embers pushed out the far side along the projectile direction. */
  backBurst({ target, dir, charge }, mid) {
    const P = this.world.particles,
      a0 = Math.atan2(dir.y, dir.x);
    const bx = target.x + dir.x * (target.radius + 4),
      by = target.y + dir.y * (target.radius + 4);
    for (let i = 0; i < n(50 + charge * 130); i++) {
      const a = a0 + rand(-0.65, 0.65),
        s = rand(220, 760) * (0.6 + charge * 0.7);
      const big = Math.random() < 0.35;
      P.emit({
        x: bx,
        y: by,
        z: mid,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        vz: rand(-60, 380),
        gravity: 950,
        drag: 0.8,
        bounce: 0.4,
        life: rand(0.5, 1.2),
        size: big ? rand(4, 8) : rand(1.5, 3),
        sizeEnd: 0.5,
        color: [255, 190, 70],
        colorEnd: [200, 30, 0],
        shape: big ? "dot" : "spark",
        stretch: 0.02,
      });
    }
    for (let i = 0; i < n(8 + charge * 10); i++) {
      // smoke rises (negative gravity)
      const a = a0 + rand(-0.8, 0.8),
        s = rand(40, 180);
      P.emit({
        x: bx,
        y: by,
        z: mid,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        vz: rand(20, 90),
        gravity: -70,
        drag: 2,
        life: rand(0.9, 1.6),
        size: rand(6, 10),
        sizeEnd: rand(22, 36),
        color: [70, 60, 60],
        alpha: 0.35,
        additive: false,
      });
    }
  }
  shockwaves({ target, dir, charge }) {
    const P = this.world.particles;
    P.emit({
      shape: "ring",
      x: target.x,
      y: target.y,
      z: 0,
      life: 0.5,
      size: 8,
      sizeEnd: 100 + charge * 90,
      color: [255, 170, 80],
    });
    P.emit({
      shape: "ring",
      x: target.x + dir.x * 36,
      y: target.y + dir.y * 36,
      z: 0,
      life: 0.38,
      size: 4,
      sizeEnd: 60 + charge * 60,
      color: [255, 230, 170],
    });
  }
}
