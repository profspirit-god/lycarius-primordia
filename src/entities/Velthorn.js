/**
 * Velthorn: a choppable tree (job track J1). SIMULATION only: state, collision, chop count and the drop roll. Everything you see
 * (trunk, canopy, notches, wobble, flash, chips, the number above it) lives in `view/VelthornView.js` and `systems/JobFx.js`.
 *
 *   standing  solid and hittable. Each axe swing that lands counts one chop; the 5th fells it: `onChop` returns the drop and the
 *             tree becomes a stump. It blocks and soaks everything that hits it (fireballs stop on it, Graugr arms and pokes are
 *             cut off by it through sim/jobs/cover.js), and the player, the dummy and the Graugrs cannot walk through it.
 *   burning   any hit from the world that is not an enemy's body (a fireball, Fire Blast, an explosion) sets it on fire at once.
 *             A burning tree cannot be chopped and drops NOTHING; it stays solid and keeps blocking until the fire ends.
 *   charred   the fire is out: a dead stump, not solid, not hittable. After CHARRED_TIME it grows back.
 *   felled    chopped down: a stump, not solid, not hittable. After REGROW_TIME it grows back with its 5 chops again.
 *
 * Replicated fields (what a client needs): kind, x, y, radius, height, state, chops, maxChops, burn. View-only fields written by
 * the view, never read by the sim: flash, wobble. Events: `tree:scorched`, `tree:burnedout`, `tree:regrown` (plain data).
 */
import { Entity } from "./Entity.js";
import { VELWOOD_ID } from "../sim/items/lumber.js";

export const VELTHORN = {
  maxChops: 5, // axe swings that land before it falls
  drop: { itemId: VELWOOD_ID, min: 10, max: 15 }, // inclusive
  radius: 26, // trunk collision circle (px), also what blocks shots and arms
  height: 150, // fireballs fly at about 32 px, so they hit the trunk
  burnTime: 6, // seconds a scorched tree burns
  burnDps: 1, // burn tick damage; a tree has no health, the number only feeds the shared burn code
  charredTime: 20, // seconds a burnt-out stump stays before it regrows
  regrowTime: 60, // seconds a felled stump stays before it regrows
};

export class Velthorn extends Entity {
  constructor(x, y) {
    super();
    Object.assign(this, { x, y, radius: VELTHORN.radius, height: VELTHORN.height, kind: "velthorn", hittable: true, solid: true });
    this.isTree = true; // cover.js and the chop search look for this
    this.choppable = true; // true only while standing
    this.home = { x, y };
    this.maxChops = VELTHORN.maxChops;
    this.chops = 0;
    this.state = "standing"; // standing | burning | charred | felled
    this.timer = 0; // seconds until a stump regrows
    this.flash = 0; // view-only (HitEffects sets it, the view fades it)
    this.wobble = 0; // view-only (the view sets it on a chop and fades it)
  }

  /**
   * Called by JobSystem for a `chop` event aimed at this tree.
   * @returns {null | { felled: boolean, itemId?: string, qty?: number }} null = the swing did nothing (not standing)
   */
  onChop(_e, world) {
    if (this.state !== "standing") return null;
    this.chops++;
    if (this.chops < this.maxChops) return { felled: false };
    const D = VELTHORN.drop,
      qty = D.min + Math.floor(world.rng.next() * (D.max - D.min + 1)); // uniform 10..15
    this.fall(VELTHORN.regrowTime, "felled");
    return { felled: true, itemId: D.itemId, qty };
  }

  /**
   * Sim reaction to a hit (DamageSystem). An enemy's body (Graugr arms, poke, leap) only bounces off a tree; anything else, in
   * practice magic fire, sets it alight. A burning or already-scorched tree never drops anything.
   */
  onHit(e, world) {
    if (e.source?.isGraugr) return;
    if (this.state === "standing") {
      this.state = "burning";
      this.choppable = false;
      world.events.emit("tree:scorched", { tree: this, x: this.x, y: this.y, z: this.height * 0.5 });
    }
    if (this.state === "burning") world.status.ignite(this, { duration: VELTHORN.burnTime, dps: VELTHORN.burnDps }, e.source);
  }

  /** Burn tick (StatusSystem). A tree has no health: it burns until the fire runs out. */
  onDot() {}

  /** Become a stump: no collision, no target, a timer until it regrows. */
  fall(time, state) {
    this.state = state;
    this.timer = time;
    this.choppable = false;
    this.hittable = false;
    this.solid = false;
    this.burn = null;
  }

  update(dt, world) {
    if (this.state === "burning" && !this.burn) {
      // StatusSystem ended the fire
      this.fall(VELTHORN.charredTime, "charred");
      world.events.emit("tree:burnedout", { tree: this, x: this.x, y: this.y, z: 0 });
    } else if (this.state === "charred" || this.state === "felled") {
      this.timer -= dt;
      if (this.timer <= 0) this.regrow(world);
    }
  }

  regrow(world) {
    this.state = "standing";
    this.chops = 0;
    this.timer = 0;
    this.choppable = true;
    this.hittable = true;
    this.solid = true;
    world.events.emit("tree:regrown", { tree: this, x: this.x, y: this.y, z: 0 });
  }
}
