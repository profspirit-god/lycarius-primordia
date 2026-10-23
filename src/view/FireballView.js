/**
 * View of the Fireball projectile (S1f, client only): the trail history, ember and smoke particles, the moving light, the fizzle
 * burst and the drawing. It used to live inside `skills/FireballProjectile.js`; the numbers are unchanged. It reads the entity
 * (x y z radius charge vx vy) and the `projectile:fizzle` event and never writes sim state. Its randomness is visual only.
 * Per-entity animation state (trail, flicker clock) is kept here in a WeakMap, not on the entity.
 */
import { scaled as n } from "../systems/ParticleSystem.js";
import { lerpColor, rand, rgba, TAU } from "../core/math.js";
import { drawGlow } from "../render/drawGlow.js";

const TRAIL_LIFE = 0.32; // seconds a trail point lives

export class FireballView {
  constructor(world) {
    this.world = world;
    this.state = new WeakMap(); // entity -> { trail: [{x,y,z,age}], t }
    this.off = world.events.on("projectile:fizzle", (e) => this.onFizzle(e));
  }

  dispose() {
    this.off();
  }

  stateOf(e) {
    let s = this.state.get(e);
    if (!s) this.state.set(e, (s = { trail: [], t: 0 }));
    return s;
  }

  /** The range ran out: a burst of sparks where the ball was. */
  onFizzle({ kind, x, y, z }) {
    if (kind !== "fireball") return;
    for (let i = 0; i < n(20); i++) {
      const a = rand(0, TAU),
        s = rand(40, 220);
      this.world.particles.emit({
        x,
        y,
        z,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        vz: rand(40, 220),
        life: rand(0.4, 0.9),
        size: rand(1.5, 3),
        sizeEnd: 0.3,
        color: [255, 190, 80],
        colorEnd: [150, 20, 0],
      });
    }
  }

  /** Once per entity step (same dt as the sim): trail, embers that fall with gravity, smoke, and the one-frame light. */
  tick(e, dt) {
    const s = this.stateOf(e),
      w = this.world,
      P = w.particles;
    s.t += dt;

    // trail history (head -> tail), aged and culled
    s.trail.push({ x: e.x, y: e.y, z: e.z, age: 0 });
    for (const p of s.trail) p.age += dt;
    s.trail = s.trail.filter((p) => p.age < TRAIL_LIFE);

    // particle trail: embers shed from the ball and FALL with gravity
    for (let i = 0; i < n(2 + e.charge * 5); i++) {
      P.emit({
        x: e.x + rand(-4, 4),
        y: e.y + rand(-4, 4),
        z: e.z + rand(-e.radius, e.radius) * 0.6,
        vx: rand(-40, 40) - e.vx * 0.05,
        vy: rand(-40, 40) - e.vy * 0.05,
        vz: rand(10, 110),
        gravity: 750,
        bounce: 0.45,
        life: rand(0.5, 1.1),
        size: rand(1.4, 3.2) + e.charge * 1.5,
        sizeEnd: 0.3,
        color: [255, 200, 90],
        colorEnd: [190, 30, 0],
      });
    }
    if (Math.random() < 0.4) {
      P.emit({
        x: e.x,
        y: e.y,
        z: e.z,
        vx: rand(-20, 20),
        vy: rand(-20, 20),
        vz: rand(10, 40),
        gravity: -60,
        drag: 2,
        life: rand(0.5, 0.9),
        size: e.radius * 0.5,
        sizeEnd: e.radius * 1.3,
        color: [60, 50, 50],
        alpha: 0.25,
        additive: false,
      });
    }
    w.lights.add({
      x: e.x,
      y: e.y,
      z: e.z,
      radius: 130 + e.charge * 150,
      intensity: 0.85,
      once: true,
      life: 1,
    });
  }

  draw(ctx, e) {
    const s = this.stateOf(e),
      sx = e.x,
      sy = e.y - e.z,
      r = e.radius,
      flick = 0.85 + 0.15 * Math.sin(s.t * 50);
    ctx.fillStyle = "rgba(0,0,0,.25)";
    ctx.beginPath();
    ctx.ellipse(e.x, e.y, r * 1.2, r * 0.6, 0, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    const L = s.trail.length;
    for (let i = 1; i < L; i++) {
      // tapered, colour-graded trail
      const t = i / L,
        a = s.trail[i - 1],
        b = s.trail[i];
      ctx.strokeStyle = rgba(lerpColor([255, 60, 10], [255, 210, 90], t), t * 0.75);
      ctx.lineWidth = r * 2 * t * flick;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y - a.z);
      ctx.lineTo(b.x, b.y - b.z);
      ctx.stroke();
    }
    drawGlow(ctx, sx, sy, r * 4.6 * flick, [255, 110, 25], 0.8); // outer glow
    drawGlow(ctx, sx, sy, r * 2.3, [255, 200, 90], 0.95); // inner glow
    ctx.fillStyle = "rgba(255,250,225,1)";
    ctx.beginPath();
    ctx.arc(sx, sy, r * 0.6, 0, TAU);
    ctx.fill(); // white-hot core
    ctx.globalCompositeOperation = "source-over";
  }
}
