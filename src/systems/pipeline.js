/**
 * The ONE ordered list of world systems (S1d). Listeners on one event run in creation order, so the order below is the rule:
 * SIM systems first (damage lands, then status, then explosions, then XP), VIEW systems after (they only read events and
 * state, and may be absent on a server). Add a system here, in the group it belongs to, never with a loose `new` in a scene.
 * Each entry is [property name on the world, class]; every class takes `(world)` and has `dispose()`.
 * AudioSystem and RaidSystem need the finished world (player, dummy) and are created by the scene after these.
 */
import { DamageSystem } from "./DamageSystem.js";
import { StatusSystem } from "./StatusSystem.js";
import { ExplosionSystem } from "./ExplosionSystem.js";
import { XpSystem } from "./XpSystem.js";
import { JobSystem } from "../sim/jobs/JobSystem.js";
import { JobFx } from "./JobFx.js";
import { HitEffects } from "./HitEffects.js";
import { BurnFx } from "./BurnFx.js";
import { ManaRegenFx } from "./ManaRegenFx.js";
import { DodgeFx } from "./DodgeFx.js";
import { ExplosionFx } from "./ExplosionFx.js";
import { BlastFx } from "./BlastFx.js";
import { EntityViews } from "../view/EntityViews.js";
import { SkillViews } from "../view/SkillViews.js";

export const SIM_SYSTEMS = [
  ["damage", DamageSystem], // hit -> target.onHit (health, knock). Before status and xp.
  ["status", StatusSystem], // hit -> stun / ignition; update() counts burns and stuns down
  ["explosions", ExplosionSystem], // explosion -> aoe hit events
  ["xp", XpSystem], // hit / burn / cast -> player XP; reads world.player when an event arrives
  ["jobs", JobSystem], // chop -> tree, job XP, Velwood into the Inventory; keeps each player's `toolId` current (J1)
];

export const VIEW_SYSTEMS = [
  ["hitEffects", HitEffects],
  ["burnFx", BurnFx],
  ["manaRegenFx", ManaRegenFx],
  ["dodgeFx", DodgeFx],
  ["explosionFx", ExplosionFx],
  ["blastFx", BlastFx],
  ["jobFx", JobFx], // J1: chop sparks, chips, "+XP" and "+Velwood" numbers, job level-up banner
  ["entityViews", EntityViews], // S1f: views by entity kind (fireball so far); update() after the entities, draw() in render
  ["skillViews", SkillViews], // S1f: views by skill id (fireball so far); fed by `skill:charging` and `cast`
];

/** Create the systems of `list` in order and store each as `world[name]`. */
export function createSystems(world, list) {
  for (const [name, System] of list) world[name] = new System(world);
}

/** Dispose the systems of `list` in reverse order. */
export function disposeSystems(world, list) {
  for (let i = list.length - 1; i >= 0; i--) world[list[i][0]]?.dispose();
}
