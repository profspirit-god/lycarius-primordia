import { quality } from "./ParticleSystem.js";
import { clamp, rand, TAU } from "../core/math.js";
import { drawAura } from "../render/drawAura.js";

const MAIN = [70, 150, 255];
const CORE = [175, 218, 255];
const DEEP = [20, 60, 200];
const FADE_IN = 0.4; // seconds for the glow to swell
const FADE_OUT = 1.2; // seconds it dies down at the end
const MOTE_RATE = 26; // motes per second at full strength

/**
 * Visuals for the Mana Regen boost: a blue glow around every entity with `manaBuff`, rising motes, a light,
 * and a burst when it starts or ends. View only: reads the effect's fields, never changes sim state.
 * `update` after lights.update (its one-frame light must survive to render); `render` after the entities are drawn.
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
      let acc = (b.fx = (b.fx ?? 0) + MOTE_RATE * k * dt * quality());
      while (acc >= 1) {
        acc -= 1;
        const a = rand(0, TAU);
        w.particles.emit({
          x: e.x + Math.cos(a) * e.radius * 1.1,
          y: e.y + Math.sin(a) * e.radius * 0.5,
          z: rand(0, 0.4) * e.height,
          vz: rand(50, 120),
          gravity: -30,
          drag: 1.4,
          life: rand(0.6, 1.1),
          size: rand(1.4, 2.6),
          sizeEnd: 0.3,
          color: CORE,
          colorEnd: DEEP,
        });
      }
      b.fx = acc;
      w.lights.add({ x: e.x, y: e.y, z: e.height * 0.5, radius: 90 + 20 * Math.sin(this.t * 5), intensity: 0.45 * k, color: MAIN, once: true, life: 1 });
    }
  }

  render(ctx) {
    const list = this.world.entities;
    for (let i = 0; i < list.length; i++) {
      const e = list[i],
        b = e.manaBuff;
      if (!b || b.dead) continue;
      const k = this.level(b);
      if (k > 0.01) drawAura(ctx, e.x, e.y, e.height, e.radius, 0.8 * k, this.t, { main: MAIN, core: CORE });
    }
  }

  /** Ring of motes spiralling up: 'up' is big, 'down' is a soft fade. */
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
        size: rand(1.6, 3),
        sizeEnd: 0.3,
        color: up ? CORE : MAIN,
        colorEnd: DEEP,
      });
    }
    if (up) this.world.lights.add({ x: e.x, y: e.y, z: e.owner.height * 0.5, radius: 200, intensity: 0.8, color: MAIN, once: true, life: 1 });
  }
}
