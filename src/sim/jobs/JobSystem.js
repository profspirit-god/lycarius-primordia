/**
 * Simulation: the job rules (track J). One place applies a `chop` event, so a headless server runs it without presentation code.
 *   chop (target tree)  ->  tree.onChop (count the swing, maybe fell it)  ->  job XP  ->  on a fall: Velwood into the Inventory
 *   update()            ->  keeps `toolId` of every player in step with the tools the Inventory says it owns
 * Reads `world.inventory` (the ownership service) and `world.jobProgress` (job XP of the local character), both set by the scene
 * before the systems are created and read lazily, so a world without them (a test) simply grants nothing.
 * Events out (plain data): `tree:felled`, `job:xp`, `job:levelup`, `job:reward`. The one ordered list is systems/pipeline.js.
 * No browser, no clock, no randomness of its own (the tree rolls its drop from `world.rng`), no `world.player` (R7).
 */
import { BASIC_AXE_ID } from "../items/lumber.js";
import { CHOP_XP, FELL_XP, LUMBERJACK, TOOLS, toolIds } from "./jobs.js";

export class JobSystem {
  constructor(world) {
    this.world = world;
    this.off = world.events.on("chop", (e) => this.onChop(e));
  }
  dispose() {
    this.off();
  }

  /** The id of the best tool `owner` carries, or null. Ordered by id (R9). */
  toolOf(owner) {
    const inv = this.world.inventory, id = owner.cls?.id;
    if (!inv || !id) return null;
    for (const t of toolIds()) if (inv.owns(t, id)) return t;
    return null;
  }

  /** Hand the starter axe to a character that never had one. Returns true when it was given now. */
  ensureStarterTool(owner) {
    const inv = this.world.inventory, jp = this.progressOf(owner), id = owner.cls?.id;
    if (!inv || !jp || !id || jp.starter) return false;
    if (!inv.owns(BASIC_AXE_ID, id) && !inv.grant(BASIC_AXE_ID, 1, id).ok) return false; // a full bag or a read-only save: try again next time
    jp.markStarterGiven();
    return true;
  }

  /** Job progress of this owner's character (one local character so far), or null. */
  progressOf(owner) {
    const jp = this.world.jobProgress;
    return jp && owner?.cls?.id === jp.ownerId ? jp : null;
  }

  update() {
    for (const e of this.world.entities) if (e.isPlayer) e.toolId = this.toolOf(e);
  }

  /** @param {{ source: object, target: object|null, tool: string }} e */
  onChop(e) {
    const w = this.world, tree = e.target, tool = TOOLS[e.tool];
    if (!tree || !tool) return;
    const r = tree.onChop?.(e, w);
    if (!r) return;
    const at = { x: tree.x, y: tree.y, z: tree.height * 0.6 };
    this.award(e.source, tool.job, CHOP_XP, at);
    if (!r.felled) return;
    w.events.emit("tree:felled", { tree, source: e.source, itemId: r.itemId, qty: r.qty, ...at });
    this.award(e.source, tool.job, FELL_XP, at);
    this.give(e.source, r.itemId, r.qty, at);
  }

  award(owner, job, amount, at) {
    const jp = this.progressOf(owner);
    if (!jp) return;
    const { gained, levels } = jp.addXp(job, amount);
    if (!gained) return;
    this.world.events.emit("job:xp", { source: owner, job, amount: gained, ...at });
    for (const level of levels) this.world.events.emit("job:levelup", { source: owner, job, level });
  }

  /** Put the drop in the bag. A bag that cannot take it all takes what fits; the rest is lost and reported. */
  give(owner, itemId, qty, at) {
    const inv = this.world.inventory, id = owner.cls?.id;
    let granted = 0;
    if (inv && id) for (let q = qty; q >= 1 && !granted; q--) if (inv.grant(itemId, q, id).ok) granted = q;
    this.world.events.emit("job:reward", { source: owner, itemId, granted, lost: qty - granted, ...at });
  }
}
