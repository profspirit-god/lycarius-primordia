const TICK = 1; // seconds between burn damage ticks

/**
 * Gameplay side of status effects (burn). Visuals live in BurnFx, sounds in AudioSystem;
 * both listen to the 'burn' event. Burn state is stored on `target.burn`:
 *   { t, dur, dps, ticks, fx, source }
 * Ignition: a 'hit' event may carry `burn: { chance, duration, dps }`. A Burn Resistance ward
 * (`target.ward`) gets to nullify it first. Create this AFTER HitEffects so the hit damage lands first.
 */
export class StatusSystem {
  constructor(world) {
    this.world = world;
    this.off = world.events.on("hit", (e) => this.onHit(e));
  }
  dispose() {
    this.off();
  }

  /** @param {import('../types.js').HitEvent} e */
  onHit(e) {
    const b = e.burn,
      t = e.target;
    if (!b || !t.hittable || t.dead) return;
    if (Math.random() >= b.chance) return;
    this.ignite(t, b, e.source);
  }

  ignite(target, { duration, dps }, source) {
    const at = { x: target.x, y: target.y, z: target.height * 0.5 };
    if (target.ward?.tryNullify()) {
      target.burn = null; // the ward also snuffs any burn already running
      this.world.events.emit("burn", { type: "nullify", target, ...at });
      return;
    }
    const b = target.burn;
    if (b) {
      // already burning: refresh instead of stacking
      b.dur = Math.max(b.dur - b.t, duration);
      b.t = 0;
      b.ticks = 0;
      b.dps = Math.max(b.dps, dps);
      return;
    }
    target.burn = { t: 0, dur: duration, dps, ticks: 0, fx: 0, source };
    this.world.events.emit("burn", { type: "ignite", target, ...at });
  }

  update(dt) {
    const list = this.world.entities;
    for (let i = 0; i < list.length; i++) {
      const t = list[i],
        b = t.burn;
      if (!b) continue;
      if (t.dead || t.downed) {
        t.burn = null;
        continue;
      }
      b.t += dt;
      while (
        t.burn === b &&
        (b.ticks + 1) * TICK <= b.dur &&
        b.t >= (b.ticks + 1) * TICK
      ) {
        b.ticks++;
        this.tick(t, b);
      }
      if (t.burn === b && b.t >= b.dur) {
        t.burn = null;
        this.world.events.emit("burn", {
          type: "end",
          target: t,
          x: t.x,
          y: t.y,
          z: t.height * 0.5,
        });
      }
    }
  }

  tick(t, b) {
    const ward = t.ward;
    const damage = Math.max(
      1,
      Math.round(b.dps * (ward ? 1 - ward.burnReduction : 1)),
    );
    ward?.pulse();
    t.onDot?.({ damage, kind: "burn", source: b.source });
    this.world.events.emit("burn", {
      type: "tick",
      target: t,
      damage,
      x: t.x,
      y: t.y,
      z: t.height * 0.5,
    });
  }
}
