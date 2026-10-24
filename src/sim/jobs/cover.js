// Cover: solid, attack-blocking objects (trees) standing between an attacker and a target. Used by melee attacks and dashes
// (Graugr) the same way FireballProjectile already stops on the first hittable body. Pure geometry on plain entity data.
// Sim code: no browser, no clock, no randomness (Claude.md 5b).

/** Cover is any live entity with `isTree` or `cover` set that is still standing in the way (`solid`). */
const isCover = (e) => (e.isTree || e.cover) && e.solid && !e.dead;

/**
 * The nearest cover body that the segment (ax,ay) -> (bx,by) passes through, or null. A body sitting on an endpoint does not count
 * when it IS the attacker or the target (`except`). Iterates the entity array in order; ties keep the first (R9).
 * @param {{ entities: object[] }} world
 * @returns {object|null}
 */
export function firstCover(world, ax, ay, bx, by, except = null) {
  const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
  let best = null, bestT = Infinity;
  for (const e of world.entities) {
    if (e === except || !isCover(e)) continue;
    // closest point of the segment to the trunk centre
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((e.x - ax) * dx + (e.y - ay) * dy) / len2));
    const px = ax + dx * t - e.x, py = ay + dy * t - e.y;
    if (px * px + py * py < e.radius * e.radius && t < bestT) {
      best = e;
      bestT = t;
    }
  }
  return best;
}

/** The ground positions of the training-ground trees (fixed layout, so a run and a test see the same forest). */
export const TRAINING_TREES = [
  { x: -420, y: -260 }, { x: -560, y: 140 }, { x: -300, y: 340 }, { x: 180, y: -430 }, { x: 520, y: -310 },
  { x: 700, y: 250 }, { x: 310, y: 520 }, { x: -720, y: -60 }, { x: -140, y: -580 }, { x: 930, y: -90 },
  { x: -880, y: 380 }, { x: 80, y: 720 },
];

/**
 * Keep `who` (an entity with x, y, radius) out of every cover body: push it along the line from the trunk centre to the minimum
 * distance. Players do this in Player.update; enemies and the dummy call it after they move.
 * @param {{ entities: object[] }} world
 */
export function pushOutOfCover(world, who) {
  for (const e of world.entities) {
    if (e === who || !isCover(e)) continue;
    const dx = who.x - e.x, dy = who.y - e.y, d = Math.hypot(dx, dy) || 0.001, min = who.radius + e.radius;
    if (d < min) {
      who.x = e.x + (dx / d) * min;
      who.y = e.y + (dy / d) * min;
    }
  }
}
