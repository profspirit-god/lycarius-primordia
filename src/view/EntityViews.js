/**
 * Entity views (S1f, client only): finds the view of an entity by its `kind` and runs it. `update(dt)` ticks the views of every
 * entity of the step, `draw(ctx, e)` draws one entity (falls back to `e.draw` for kinds without a view yet). Created from
 * `VIEW_SYSTEMS` in systems/pipeline.js as `world.entityViews`. Reads sim state, never writes it.
 */
import { VIEWS } from "./index.js";

export class EntityViews {
  constructor(world) {
    this.world = world;
    this.views = Object.create(null);
    for (const kind of Object.keys(VIEWS)) this.views[kind] = new VIEWS[kind](world);
  }

  /** Tick the views of the entities that ran this step (call right after they update, before the dead are removed). */
  update(dt) {
    const list = this.world.entities;
    for (let i = 0; i < list.length; i++) {
      const e = list[i],
        v = this.views[e.kind];
      if (v) v.tick(e, dt);
    }
  }

  draw(ctx, e) {
    const v = this.views[e.kind];
    if (v) v.draw(ctx, e);
    else e.draw(ctx, this.world);
  }

  dispose() {
    for (const kind in this.views) this.views[kind].dispose();
  }
}
