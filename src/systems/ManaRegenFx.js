import { quality } from "./ParticleSystem.js";
import { clamp, rand, TAU } from "../core/math.js";

const MAIN = [70, 150, 255];
const CORE = [175, 218, 255];
const DEEP = [20, 60, 200];
const FADE_IN = 0.4; // seconds for the glow to swell
const FADE_OUT = 1.2; // seconds it dies down at the end
const BUBBLE_RATE = 9; // hollow circles per second at full strength

/**
 * Visuals for the Mana Regen boost. Its signature is CIRCLES: hollow blue bubbles that rise around the body
 * (regen / restoring buffs use circles; ribbons mean resistance, dashes mean motion, see BurnWardEffect).
 * No body glow, so it stacks with other buffs without washing the character out. A faint light and a burst on start / end.
 * View only: reads the effect's fields, never changes sim state. `update` after lights.update (its one-frame light must survive to render).
 */
export class ManaRegenFx {
  constructor(world) {
    this.world = world;
    this.t = 0;
    this.off = world.events.on("manaRegen", (e) => this.onEvent(e));
  }
  dispose() {
    this.off();
  }

  level(b) {
    return clamp(Math.min(b.age / FADE_IN, b.life / FADE_OUT), 0, 1);
  }

  update(dt) {
    this.t += dt;
    const w = this.world,
      list = w.entities;
    for (let i = 0; i < list.length; i++) {
      const e = list[i],
        b = e.manaBuff;
      if (!b || b.dead) continue;
      const k = this.level(b);
      let acc = (b.fx = (b.fx ?? 0) + BUBBLE_RATE * k * dt * quality());
      while (acc >= 1) {
        acc -= 1;
        const a = rand(0, TAU);
        w.particles.emit({
          x: e.x + Math.cos(a) * e.radius * 1.1,
          y: e.y + Math.sin(a) * e.radius * 0.5,
          z: rand(0, 0.4) * e.height,
          vx: rand(-8, 8),
          vz: rand(35, 80),
          gravity: -20,
          drag: 0.9,
          life: rand(0.9, 1.5),
          size: rand(2.5, 5),
          sizeEnd: 1.5,
          shape: "bubble",
          color: CORE,
          colorEnd: MAIN,
          alpha: 0.85,
        });
      }
      b.fx = acc;
      w.lights.add({ x: e.x, y: e.y, z: e.height * 0.5, radius: 70, intensity: 0.15 * k, color: MAIN, once: true, life: 1 });
    }
  }

  /** Ring of bubbles spiralling up: 'up' is big, 'down' is a soft fade. */
  onEvent(e) {
    const P = this.world.particles,
      up = e.type === "up",
      cnt = Math.round((up ? 36 : 12) * quality()),
      r = e.owner.radius + 14;
    for (let i = 0; i < cnt; i++) {
      const a = (i / cnt) * TAU;
      P.emit({
        x: e.x + Math.cos(a) * r,
        y: e.y + Math.sin(a) * r * 0.5,
        z: rand(0, 6),
        vx: up ? -Math.sin(a) * 40 : 0,
        vy: up ? Math.cos(a) * 20 : 0,
        vz: up ? rand(90, 200) : rand(30, 70),
        gravity: -20,
        drag: 1.2,
        life: rand(0.5, 1),
        size: rand(2, 4.5),
        sizeEnd: 1.5,
        shape: "bubble",
        color: up ? CORE : MAIN,
        colorEnd: DEEP,
      });
    }
    if (up) this.world.lights.add({ x: e.x, y: e.y, z: e.owner.height * 0.5, radius: 160, intensity: 0.5, color: MAIN, once: true, life: 1 });
  }
}
