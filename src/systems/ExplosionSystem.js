import { dist, lerp, rand } from "../core/math.js";
import { elementMult, skillMult } from "../progression/Mods.js";

export const explosionRadius = (charge) => lerp(70, 190, charge);
const EXPLOSION_DAMAGE = [6, 24]; // [min, max] at the centre, across the charge range
const EDGE = 0.3; // damage fraction at the very edge of the blast

/**
 * Area damage for 'explosion' events. Every hittable entity whose body edge is inside the radius
 * takes damage (the caster too), falling off linearly with distance. Damage goes out as 'hit'
 * events flagged `aoe: true`, so targets react through onHit and a Burn Resistance ward still applies.
 * Flame Shields do not stop explosions.
 */
export class ExplosionSystem {
  constructor(world) {
    this.world = world;
    this.off = world.events.on("explosion", (e) => this.onExplosion(e));
  }
  dispose() {
    this.off();
  }

  /** @param {import('../types.js').ExplosionEvent} e */
  onExplosion(e) {
    const w = this.world,
      R = explosionRadius(e.charge),
      base = lerp(EXPLOSION_DAMAGE[0], EXPLOSION_DAMAGE[1], e.charge),
      mult = skillMult(e.source) * elementMult(e.source, e.element);
    const list = w.entities.slice(); // events may spawn entities
    for (const t of list) {
      if (!t.hittable || t.dead) continue;
      const d = Math.max(0, dist(e.x, e.y, t.x, t.y) - t.radius);
      if (d > R) continue;
      const fall = lerp(1, EDGE, d / R);
      const raw = Math.max(1, Math.round(base * fall * mult * rand(0.92, 1.08)));
      const damage = t.ward ? t.ward.resist(raw) : raw;
      const len = Math.hypot(t.x - e.x, t.y - e.y) || 1;
      w.events.emit("hit", {
        source: e.source,
        target: t,
        damage,
        crit: false,
        resisted: raw - damage,
        dir: { x: (t.x - e.x) / len, y: (t.y - e.y) / len },
        charge: e.charge * fall,
        x: t.x,
        y: t.y,
        z: t.height * 0.5,
        aoe: true,
      });
    }
  }
}
