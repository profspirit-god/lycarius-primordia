import { TOOLS } from "../sim/jobs/jobs.js";

const COOLDOWN = 0.7; // seconds between swings

/**
 * Universal job action (every class, see classes/Universal.js): swing the tool you carry at the tree in front of you.
 * Needs a tool (`owner.toolId`, set by JobSystem from the Inventory) and its stamina cost. `instant`: one press = one swing, so
 * SkillCaster checks `canUse` before it starts the cooldown. The swing always happens (and costs stamina) even when nothing is
 * in reach; the nearest standing tree in front, inside the tool's reach and arc, is the target.
 * It only emits a `chop` event with plain data: JobSystem applies it (tree, XP, drop), JobFx and VelthornView draw it.
 * Not a combat skill: it deals no damage and gives no character or specialization XP.
 */
/** @type {import('../types.js').SkillDef} */
export const Chop = {
  id: "chop",
  name: "Chop",
  icon: "axe",
  color: "#c8a15a",
  hint: "C",
  instant: true,
  cooldown: COOLDOWN,
  chargeTime: 0,
  minCharge: 0,
  costText: "needs an axe",

  manaCost() {
    return 0;
  },
  canStart() {
    return true;
  },
  canUse(owner) {
    const tool = TOOLS[owner.toolId];
    return !!tool && !owner.dodge && owner.vitals.stamina >= tool.staminaCost;
  },
  /** Refused: no stamina flashes the bar (no tool shows as the greyed button). */
  onDenied(owner) {
    const tool = TOOLS[owner.toolId];
    if (tool && owner.vitals.stamina < tool.staminaCost) owner.lowStaminaFlash = 0.4;
  },
  isActive() {
    return false;
  },

  onRelease({ owner, world, aim }) {
    const tool = TOOLS[owner.toolId];
    if (!tool || !owner.vitals.spendStamina(tool.staminaCost)) return;
    const c = Math.cos(aim), s = Math.sin(aim);
    world.events.emit("chop", {
      source: owner,
      target: findTree(world, owner, aim, tool),
      tool: tool.id,
      aim,
      x: owner.x + c * (owner.radius + tool.reach * 0.6),
      y: owner.y + s * (owner.radius + tool.reach * 0.6),
      z: owner.height * 0.55,
      dir: { x: c, y: s },
    });
  },
};

const angleDiff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

/** Nearest standing tree in front of `owner`: its trunk edge within the tool's reach, its centre inside the swing arc (a fat trunk widens the arc). */
function findTree(world, owner, aim, tool) {
  let best = null, bestD = Infinity;
  for (const e of world.entities) {
    if (!e.choppable || e.dead) continue;
    const dx = e.x - owner.x, dy = e.y - owner.y, d = Math.hypot(dx, dy) || 0.001, gap = d - owner.radius - e.radius;
    if (gap > tool.reach) continue;
    const slack = Math.asin(Math.min(1, e.radius / d));
    if (angleDiff(Math.atan2(dy, dx), aim) > tool.arc + slack) continue;
    if (gap < bestD) {
      best = e;
      bestD = gap;
    }
  }
  return best;
}
