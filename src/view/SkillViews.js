/**
 * Skill views (S1f, client only): finds the view of a skill by its id and feeds it the skill's events. `skill:charging` (SkillCaster,
 * every step a hold-to-charge skill is held) calls `view.charging(e)`, `cast` (a skill's release) calls `view.cast(e)`. A skill with no
 * view is ignored (its own hooks still draw until its S1f group moves out). Created from `VIEW_SYSTEMS` in systems/pipeline.js as
 * `world.skillViews`. Reads events, never writes sim state.
 */
import { SKILL_VIEWS } from "./index.js";

export class SkillViews {
  constructor(world) {
    this.world = world;
    this.views = Object.create(null);
    for (const id of Object.keys(SKILL_VIEWS)) this.views[id] = new SKILL_VIEWS[id](world);
    this.offs = [
      world.events.on("skill:charging", (e) => this.views[e.skill]?.charging?.(e)),
      world.events.on("cast", (e) => this.views[e.skill?.id]?.cast?.(e)),
    ];
  }

  dispose() {
    for (const off of this.offs) off();
    for (const id in this.views) this.views[id].dispose();
  }
}
