import { Graugr } from "../entities/Graugr.js";
import { TAU } from "../core/math.js";

const INTERMISSION = 4; // seconds between a cleared raid and the next
const SPAWN_RING = [420, 560]; // enemies appear this far from the player

/**
 * Mock raid for the Training Ground. Start removes the training dummy; Stop brings it back.
 * Raid N spawns N + 1 Graugrs at enhancement tier N - 1 (raid 1 is base strength). The next raid starts
 * a few seconds after the last enemy dies. Counts 'kill' events (emitted by Graugr) into kills / oneShots;
 * both reset when a new raid session starts. Needs from the world: spawn(), removeDummy(), restoreDummy(), pushBanner().
 */
export class RaidSystem {
  constructor(world) {
    this.world = world;
    this.active = false;
    this.number = 0;
    this.total = 0; // enemies spawned this raid
    this.wait = 0; // intermission countdown
    this.kills = 0;
    this.oneShots = 0;
    this.off = world.events.on("kill", (e) => this.onKill(e));
  }
  dispose() {
    this.off();
  }

  get tier() {
    return Math.max(0, this.number - 1);
  }
  /** Enemies still standing. */
  alive() {
    let c = 0;
    for (const e of this.world.entities) if (e.isGraugr && !e.downed && !e.dead) c++;
    return c;
  }

  start() {
    if (this.active) return;
    this.world.removeDummy();
    this.active = true;
    this.number = 0;
    this.kills = 0;
    this.oneShots = 0;
    this.wait = 0;
    this.nextRaid();
  }

  stop() {
    if (!this.active) return;
    for (const e of this.world.entities) if (e.isGraugr) e.dead = true;
    this.active = false;
    this.wait = 0;
    this.world.restoreDummy();
  }

  nextRaid() {
    const w = this.world,
      p = w.player;
    this.number++;
    this.total = this.number + 1;
    const a0 = w.rng.range(0, TAU);
    for (let i = 0; i < this.total; i++) {
      const a = a0 + (i * TAU) / this.total + w.rng.range(-0.3, 0.3),
        r = w.rng.range(SPAWN_RING[0], SPAWN_RING[1]);
      w.spawn(new Graugr(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, { tier: this.tier, rng: w.rng }));
    }
    w.pushBanner(`RAID ${this.number}`, `${this.total} Graugr${this.tier ? ` · enhanced x${this.tier}` : ""}`);
  }

  onKill(e) {
    if (!this.active || !e.target.isGraugr) return;
    this.kills++;
    if (e.oneShot) this.oneShots++;
  }

  update(dt) {
    if (!this.active) return;
    if (this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) this.nextRaid();
      return;
    }
    if (this.alive() === 0) {
      this.wait = INTERMISSION;
      this.world.pushBanner(`RAID ${this.number} CLEARED`, `Next raid in ${INTERMISSION}s`, 2.8);
    }
  }
}
