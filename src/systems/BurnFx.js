import { scaled as n, quality } from "./ParticleSystem.js";
import { clamp, rand, TAU } from "../core/math.js";
import { WARD_CIRCLE } from "../render/drawMagicCircle.js";

const FADE = 1.2; // seconds over which a burn dies down at its end
const FLAME_RATE = 85; // flame particles per second per burning entity at full strength

/**
 * Visuals for the 'burn' event: rising flames on every burning entity (decaying at the end),
 * tick flash + damage number, ignite burst, nullify toast. Create AFTER HitEffects.
 */
export class BurnFx {
  constructor(world) {
    this.world = world;
    this.off = world.events.on("burn", (e) => this.onBurn(e));
  }
  dispose() {
    this.off();
  }

  update(dt) {
    const list = this.world.entities;
    for (let i = 0; i < list.length; i++) if (list[i].burn) this.flames(list[i], dt);
  }

  /** Continuous fire climbing off the body. `k` falls 1 -> 0 over the last FADE seconds. */
  flames(e, dt) {
    const w = this.world,
      P = w.particles,
      b = e.burn,
      k = clamp((b.dur - b.t) / FADE, 0, 1),
      r = e.radius,
      h = e.height;
    b.fx += FLAME_RATE * k * dt * quality();
    while (b.fx >= 1) {
      b.fx -= 1;
      P.emit({
        x: e.x + rand(-r, r) * 0.8,
        y: e.y + rand(-r, r) * 0.35,
        z: rand(0.05, 0.95) * h,
        vx: rand(-14, 14),
        vy: rand(-8, 8),
        vz: rand(90, 200),
        gravity: -170,
        drag: 1.5,
        life: rand(0.5, 0.95) * (0.5 + 0.5 * k),
        size: rand(4, 8) * (0.45 + 0.55 * k),
        sizeEnd: 0.8,
        color: [255, 160, 55],
        colorEnd: [190, 30, 5],
        alpha: 0.75,
      });
    }
    if (Math.random() < 7 * dt * k * quality())
      P.emit({
        x: e.x + rand(-r, r) * 0.6,
        y: e.y,
        z: rand(0.3, 1) * h,
        vx: rand(-30, 30),
        vy: rand(-10, 10),
        vz: rand(120, 230),
        gravity: 250,
        life: rand(0.5, 0.9),
        size: rand(1, 1.8),
        sizeEnd: 0.3,
        color: [255, 235, 150],
        colorEnd: [255, 70, 10],
        shape: "spark",
        stretch: 0.025,
      });
    if (Math.random() < 3 * dt * quality())
      P.emit({
        x: e.x + rand(-r, r) * 0.5,
        y: e.y,
        z: h * rand(0.85, 1.1),
        vx: rand(-12, 12),
        vy: rand(-6, 6),
        vz: rand(25, 60),
        gravity: -50,
        drag: 1.5,
        life: rand(0.8, 1.4),
        size: rand(4, 7),
        sizeEnd: rand(14, 22),
        color: [55, 48, 48],
        alpha: 0.22 * (0.4 + 0.6 * k),
        additive: false,
      });
    w.lights.add({
      x: e.x,
      y: e.y,
      z: h * 0.55,
      radius: (80 + 70 * k) * (0.85 + 0.15 * Math.sin(performance.now() / 70)),
      intensity: 0.3 * k,
      color: [255, 120, 40],
      once: true,
      life: 1,
    });
  }

  /** @param {import('../types.js').BurnEvent} e */
  onBurn(e) {
    if (e.type === "ignite") this.ignite(e);
    else if (e.type === "tick") this.tick(e);
    else if (e.type === "nullify") this.nullify(e);
    else if (e.type === "end") this.puff(e, 14);
  }

  ignite({ target, x, y, z }) {
    const P = this.world.particles;
    for (let i = 0; i < n(26); i++) {
      const a = rand(0, TAU),
        s = rand(40, 150);
      P.emit({
        x: x + Math.cos(a) * target.radius * 0.5,
        y: y + Math.sin(a) * target.radius * 0.25,
        z: rand(0, target.height),
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s * 0.5,
        vz: rand(60, 220),
        gravity: -80,
        drag: 1.4,
        life: rand(0.5, 1),
        size: rand(3.5, 7),
        sizeEnd: 0.5,
        color: [255, 220, 110],
        colorEnd: [210, 40, 5],
      });
    }
    P.emit({
      shape: "ring",
      x,
      y,
      z: 0,
      life: 0.45,
      size: 10,
      sizeEnd: target.radius * 3,
      color: [255, 140, 50],
    });
    this.world.lights.add({ x, y, z, radius: 220, intensity: 1.1, life: 0.35, color: [255, 130, 45] });
  }

  /** One burn damage tick: damage number, embers, light pulse. The body flash comes from target.onDot. */
  tick({ target, damage, x, y, z }) {
    const w = this.world,
      P = w.particles;
    w.damageNumbers.spawn(target.x, target.y - target.height - 8, String(damage), {
      color: "#ff8a2a",
    });
    for (let i = 0; i < n(10); i++) {
      P.emit({
        x: x + rand(-target.radius, target.radius) * 0.6,
        y,
        z: rand(0.2, 1) * target.height,
        vx: rand(-60, 60),
        vy: rand(-20, 20),
        vz: rand(120, 300),
        gravity: 600,
        life: rand(0.4, 0.9),
        size: rand(1.2, 2.4),
        sizeEnd: 0.3,
        color: [255, 235, 150],
        colorEnd: [255, 70, 10],
        shape: "spark",
        stretch: 0.025,
      });
    }
    w.lights.add({ x, y, z, radius: 180, intensity: 0.8, life: 0.28, color: [255, 150, 60] });
  }

  /** A ward snuffed the burn: hiss of steam and sparks, toast above the target. */
  nullify({ target, x, y, z }) {
    const w = this.world,
      P = w.particles;
    for (let i = 0; i < n(26); i++) {
      const a = rand(0, TAU),
        s = rand(80, 260);
      P.emit({
        x,
        y,
        z,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s * 0.6,
        vz: rand(40, 240),
        gravity: 700,
        life: rand(0.4, 0.9),
        size: rand(1.2, 2.6),
        sizeEnd: 0.3,
        color: [255, 190, 130],
        colorEnd: [200, 40, 15],
        shape: "spark",
        stretch: 0.025,
      });
    }
    this.puff({ x, y, z, target }, 12);
    w.lights.add({ x, y, z, radius: 220, intensity: 1.0, life: 0.3, color: WARD_CIRCLE.main });
    w.toasts.spawn(target, { kind: "burnNullified", color: WARD_CIRCLE.main });
  }

  puff({ x, y, z }, count) {
    const P = this.world.particles;
    for (let i = 0; i < n(count); i++) {
      P.emit({
        x: x + rand(-8, 8),
        y: y + rand(-4, 4),
        z: z + rand(-10, 20),
        vx: rand(-25, 25),
        vy: rand(-10, 10),
        vz: rand(30, 90),
        gravity: -60,
        drag: 1.6,
        life: rand(0.8, 1.5),
        size: rand(5, 9),
        sizeEnd: rand(18, 30),
        color: [75, 68, 68],
        alpha: 0.3,
        additive: false,
      });
    }
  }
}
