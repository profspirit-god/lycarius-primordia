/**
 * The ONE manifest of entity views (S1f, client only), like content/index.js is for skills. A view is registered under the
 * entity's `kind` string. A view class takes `(world)` and has `tick(entity, dt)`, `draw(ctx, entity)` and `dispose()`.
 * Entities whose kind has no view still draw themselves with `entity.draw` until their S1f group moves out.
 */
import { FireballView } from "./FireballView.js";
import { FireballCastView } from "./FireballCastView.js";
import { VelthornView } from "./VelthornView.js";

export const VIEWS = {
  fireball: FireballView,
  velthorn: VelthornView,
};

/**
 * Skill views, registered under the SKILL id (`skill.id`). A class takes `(world)` and has `charging(e)` (optional, `skill:charging`),
 * `cast(e)` (optional, `cast`) and `dispose()`; `SkillViews` dispatches the events to it.
 */
export const SKILL_VIEWS = {
  fireball: FireballCastView,
};
