const TICK = 1; // seconds between burn damage ticks

/**
 * Gameplay side of status effects (burn, stun). Visuals live in BurnFx, sounds in AudioSystem;
 * both listen to the 'burn' event. Burn state is stored on `target.burn`:
 *   { t, dur, dps, ticks, fx, source }
 * Ignition: a 'hit' event may carry `burn: { chance, duration, dps }`. A Burn Resistance ward
 * (`target.ward`) gets to nullify it first. Create this AFTER HitEffects so the hit damage lands first.
 * Stun: a 'hit' event may carry `stun: { duration }`. It sets `target.stunT` (seconds, refreshed never stacked);
 * this system counts it down, the entity decides what being stunned means.
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
    if (e.stun && t.hittable && !t.dead && !t.downed) this.stun(t, e.stun.duration);
    if (!b || !t.hittable || t.dead) return;
    if (!this.world.rng.chance(b.chance)) return;
    this.ignite(t, b, e.source);
  }

  stun(target, duration) {
    if (!(target.stunT > 0)) this.world.events.emit("stun", { type: "start", target, x: target.x, y: target.y, z: target.height });
    target.stunT = Math.max(target.stunT || 0, duration);
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
      if (t.stunT > 0) t.stunT = Math.max(0, t.stunT - dt);
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
    t.onDot?.({ damage, kind: "burn", source: b.source }, this.world);
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
