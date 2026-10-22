/**
 * Simulation: applies every 'hit' event to its target (S1d). This is the ONE place where hit damage lands, so a headless
 * server runs it without any presentation code. The target's `onHit(e, world)` holds the sim reaction only (health, knock,
 * freeze, downing). Flash, glow, hit-stop, shake, numbers and sparks belong to HitEffects, which reads the same event.
 * Order matters: create this BEFORE StatusSystem (a killing blow must down the target before ignition is rolled) and before
 * XpSystem. The one ordered list lives in `systems/pipeline.js`.
 */
export class DamageSystem {
  constructor(world) {
    this.world = world;
    this.off = world.events.on("hit", (e) => this.onHit(e));
  }
  dispose() {
    this.off();
  }

  /** @param {import('../types.js').HitEvent} e */
  onHit(e) {
    e.target.onHit?.(e, this.world);
  }
}
