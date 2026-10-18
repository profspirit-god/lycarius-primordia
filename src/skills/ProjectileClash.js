import { clamp } from "../core/math.js";

const TIE = 0.12; // charges closer than this annihilate each other

/**
 * Two hostile projectiles met. Rules:
 *  - Charges within TIE of each other: both are destroyed in one bigger explosion.
 *  - Otherwise the stronger one survives and the weaker one is destroyed in a smaller explosion.
 *    The survivor loses power in proportion to the weaker charge: ratio = weak / strong,
 *    damage x (1 - 0.4 ratio), size x (1 - 0.25 ratio). Full vs half: damage x0.8, size x0.875.
 * Emits 'explosion'; ExplosionSystem deals the area damage, ExplosionFx draws it.
 * Projectiles expose: charge, owner, x, y, z, dead, weaken(ratio).
 */
export function clashProjectiles(a, b, world) {
  const x = (a.x + b.x) / 2,
    y = (a.y + b.y) / 2,
    z = (a.z + b.z) / 2;
  const diff = a.charge - b.charge;
  let charge, source;
  if (Math.abs(diff) < TIE) {
    a.dead = b.dead = true;
    charge = clamp((a.charge + b.charge) * 0.6, 0.1, 1);
    source = a.owner;
  } else {
    const strong = diff > 0 ? a : b,
      weak = diff > 0 ? b : a;
    weak.dead = true;
    strong.weaken(weak.charge / strong.charge);
    charge = clamp(weak.charge * 0.9, 0.1, 1);
    source = strong.owner;
  }
  world.events.emit("explosion", { source, x, y, z, charge, kind: "clash", element: "fire" });
}
