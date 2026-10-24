import { scaled as n } from "./ParticleSystem.js";
import { rand, TAU } from "../core/math.js";
import { JOBS } from "../sim/jobs/jobs.js";
import { findItem } from "../sim/items/ItemRegistry.js";

const CHIP = [226, 190, 130]; // fresh wood
const LEAF = [96, 190, 140];

/**
 * VIEW only. Listens to the job events and layers the feedback: the swing arc, wood chips and a small shake on a chop, the fall of a
 * tree, smoke when a scorched tree burns out, the floating "+XP" and "+Velwood" numbers, and the job level-up banner. It never changes
 * a sim value: JobSystem does that, and a world without this class plays the same game. Its place in the order is systems/pipeline.js.
 */
export class JobFx {
  constructor(world) {
    this.world = world;
    this.offs = [
      world.events.on("chop", (e) => this.onChop(e)),
      world.events.on("tree:felled", (e) => this.onFelled(e)),
      world.events.on("tree:scorched", (e) => this.say(e, "Scorched: no wood", "#ff9a4a", 0, -10)),
      world.events.on("tree:burnedout", (e) => this.onBurnedOut(e)),
      world.events.on("job:xp", (e) => this.say(e, `+${e.amount} XP`, "#7bd88f", 26, 0)),
      world.events.on("job:reward", (e) => this.onReward(e)),
      world.events.on("job:levelup", (e) => this.onLevelUp(e)),
    ];
  }
  dispose() {
    this.offs.forEach((off) => off());
  }

  say(e, text, color, dx, dy) {
    this.world.damageNumbers.spawn(e.x + dx, e.y - e.z - 24 + dy, text, { color });
  }

  /** The swing: pale sparks along the arc in front of the user. Chips and a nudge of shake when it lands on a tree. */
  onChop(e) {
    const w = this.world, P = w.particles, o = e.source;
    for (let i = 0; i < n(7); i++) {
      const a = e.aim + rand(-0.8, 0.8), r = o.radius + rand(18, 44);
      P.emit({
        x: o.x + Math.cos(a) * r, y: o.y + Math.sin(a) * r, z: o.height * 0.5 + rand(-8, 8),
        vx: Math.cos(a + 1.57) * 120, vy: Math.sin(a + 1.57) * 120, vz: 0, gravity: 0, drag: 6,
        life: 0.16, size: 2.2, sizeEnd: 0.4, color: [235, 232, 215], shape: "spark", stretch: 0.03,
      });
    }
    const t = e.target;
    if (!t) return;
    w.camera.addTrauma(0.14);
    w.hitstop(0.035);
    this.chips(t.x, t.y, 20 + rand(0, 20), n(12), CHIP, e.dir);
    w.lights.add({ x: t.x, y: t.y, z: 40, radius: 90, intensity: 0.5, life: 0.12, color: [255, 235, 190] });
  }

  chips(x, y, z, count, color, dir) {
    const P = this.world.particles;
    for (let i = 0; i < count; i++) {
      const a = Math.atan2(dir.y, dir.x) + Math.PI + rand(-1.2, 1.2), s = rand(60, 240);
      P.emit({
        x, y, z, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6, vz: rand(80, 280), gravity: 700, drag: 1,
        life: rand(0.4, 0.9), size: rand(1.6, 3.2), sizeEnd: 0.6, color, colorEnd: [110, 76, 44], additive: false,
      });
    }
  }

  onFelled(e) {
    const w = this.world, P = w.particles;
    w.camera.addTrauma(0.35);
    this.chips(e.x, e.y, 30, n(36), CHIP, { x: 1, y: 0 });
    for (let i = 0; i < n(26); i++) {
      const a = rand(0, TAU), s = rand(30, 160);
      P.emit({
        x: e.x + Math.cos(a) * 24, y: e.y + Math.sin(a) * 12, z: rand(60, 140), vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.5, vz: rand(-20, 80),
        gravity: 140, drag: 2.2, life: rand(0.9, 1.8), size: rand(2.5, 5), sizeEnd: 1, color: LEAF, colorEnd: [60, 110, 80], additive: false,
      });
    }
    P.emit({ shape: "ring", x: e.x, y: e.y, z: 0, life: 0.5, size: 8, sizeEnd: 90, color: [226, 200, 150] });
  }

  onBurnedOut(e) {
    const P = this.world.particles;
    for (let i = 0; i < n(14); i++)
      P.emit({
        x: e.x + rand(-14, 14), y: e.y + rand(-6, 6), z: rand(0, 30), vx: rand(-14, 14), vy: rand(-6, 6), vz: rand(30, 90), gravity: -40, drag: 1.2,
        life: rand(0.9, 1.6), size: rand(6, 11), sizeEnd: 16, color: [90, 86, 82], alpha: 0.35, additive: false,
      });
  }

  onReward(e) {
    const name = findItem(e.itemId)?.name ?? e.itemId;
    if (e.granted > 0) this.say(e, `+${e.granted} ${name}`, "#f1e3b0", -18, -30);
    if (e.lost > 0) this.say(e, `Bag full: ${e.lost} ${name} lost`, "#ff7a6b", -18, -62);
  }

  onLevelUp(e) {
    const w = this.world, o = e.source;
    w.pushBanner?.(`${JOBS[e.job].name.toUpperCase()} LEVEL ${e.level}`, "Job level up");
    w.particles.emit({ shape: "ring", x: o.x, y: o.y, z: 0, life: 0.8, size: 10, sizeEnd: 150, color: [140, 230, 160] });
    w.lights.add({ x: o.x, y: o.y, z: 30, radius: 240, intensity: 0.9, life: 0.45, color: [140, 230, 160] });
  }
}
