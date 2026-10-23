/**
 * The Fireball projectile: SIMULATION only (S1f). Movement, hit order (clash, deflect, shield, body), damage roll, range.
 * Everything you see (trail, embers, smoke, moving light, fizzle burst, drawing) lives in `view/FireballView.js`, which reads
 * this entity and the `projectile:fizzle` event. Replicated fields (what a client needs): kind, x, y, z, radius, charge, vx, vy,
 * dead, owner. Events: `hit` (body), `explosion` (clash, via ProjectileClash), `projectile:fizzle` (range ran out).
 */
import { Entity } from "../entities/Entity.js";
import { clamp, dist, lerp } from "../core/math.js";
import { clashProjectiles } from "./ProjectileClash.js";
import { elementMult, skillMult } from "../progression/Mods.js";

export class FireballProjectile extends Entity {
  constructor({ owner, x, y, z, angle, charge, damage = [8, 30], burn = null }) {
    super();
    Object.assign(this, { owner, x, y, z, charge, damageRange: damage, burnDef: burn });
    this.speed = lerp(520, 900, charge);
    this.radius = lerp(8, 19, charge);
    this.vx = Math.cos(angle) * this.speed;
    this.vy = Math.sin(angle) * this.speed;
    this.maxRange = 1200;
    this.travelled = 0;
    this.kind = "fireball"; // the view registry key (view/index.js)
    this.rolled = null; // damage is rolled once, so a shield and the body see the same number
    this.isProjectile = true; // other projectiles look for this to clash
    this.element = "fire";
    this.potency = 1; // damage multiplier; drops when this ball survives a clash
  }

  /** Lose power after winning a clash against a weaker ball (ratio = weak charge / this charge). */
  weaken(ratio) {
    const f = 1 - 0.4 * ratio;
    this.potency *= f;
    this.radius *= 1 - 0.25 * ratio;
    if (this.rolled) this.rolled.damage = Math.max(1, Math.round(this.rolled.damage * f));
  }

  update(dt, world) {
    if (this.dead) return; // destroyed earlier this frame by a clash
    const step = this.speed * dt,
      steps = Math.max(1, Math.ceil(step / this.radius));
    for (let i = 0; i < steps && !this.dead; i++) {
      this.x += (this.vx * dt) / steps;
      this.y += (this.vy * dt) / steps;
      this.checkHit(world);
    }
    this.travelled += step;
    if (!this.dead && this.travelled > this.maxRange) {
      this.dead = true;
      world.events.emit("projectile:fizzle", { kind: this.kind, x: this.x, y: this.y, z: this.z, charge: this.charge });
    }
  }

  checkHit(world) {
    for (const e of world.entities) {
      // projectile vs projectile: the stronger charge survives, equals annihilate (see ProjectileClash)
      if (!e.isProjectile || e === this || e.dead || e.owner === this.owner) continue;
      const reach = this.radius + e.radius;
      if (dist(this.x, this.y, e.x, e.y) < reach && Math.abs(this.z - e.z) < reach) {
        clashProjectiles(this, e, world);
        return;
      }
    }
    for (const e of world.entities) {
      // swinging arms (Graugr barrage) may bat the ball away before anything else
      if (!e.deflecting || e === this.owner) continue;
      if (e.tryDeflect(this, world)) return;
    }
    for (const e of world.entities) {
      // flame shields first: the arc is in front of the body it protects
      if (!e.isShield || e.owner === this.owner) continue;
      if (e.blocks(this.x, this.y, this.z, this.radius)) {
        this.hitShield(e, world);
        return;
      }
    }
    for (const e of world.entities) {
      if (!e.hittable || e.dead || e === this.owner) continue;
      if (
        dist(this.x, this.y, e.x, e.y) < this.radius + e.radius &&
        this.z < e.height + this.radius
      ) {
        this.hit(e, world);
        return;
      }
    }
  }

  /** Rolled once per projectile (crit, then the 0.9 to 1.1 spread) from `world.rng`. */
  roll(world) {
    if (!this.rolled) {
      const crit = world.rng.chance(0.12);
      const damage = Math.round(
        Math.round(
          lerp(
            this.damageRange[0],
            this.damageRange[1],
            Math.pow(this.charge, 1.3),
          ),
        ) *
          world.rng.range(0.9, 1.1) *
          (crit ? 1.75 : 1) *
          this.potency *
          skillMult(this.owner) *
          elementMult(this.owner, this.element),
      );
      this.rolled = { damage, crit };
    }
    return this.rolled;
  }

  /** The shield soaks what it can. Leftover damage keeps flying (smaller) toward the body. */
  hitShield(shield, world) {
    const r = this.roll(world),
      left = shield.absorb(r.damage, this);
    if (left <= 0) {
      this.dead = true;
      return;
    }
    this.rolled = { damage: left, crit: r.crit };
    this.radius *= clamp(0.55 + 0.45 * (left / r.damage), 0.55, 1);
  }

  hit(target, world) {
    const len = Math.hypot(this.vx, this.vy) || 1,
      dir = { x: this.vx / len, y: this.vy / len };
    const rolled = this.roll(world),
      crit = rolled.crit,
      damage = target.ward ? target.ward.resist(rolled.damage) : rolled.damage; // fire resistance
    const bd = this.burnDef;
    this.dead = true;
    world.events.emit("hit", {
      source: this.owner,
      target,
      damage,
      crit,
      resisted: rolled.damage - damage,
      burn: bd && {
        chance: lerp(bd.chance[0], bd.chance[1], this.charge),
        duration: world.rng.range(bd.duration[0], bd.duration[1]),
        dps: bd.dps * elementMult(this.owner, this.element), // element damage also boosts the burn
      },
      dir,
      charge: this.charge,
      x: this.x,
      y: this.y,
      z: this.z,
    });
  }
}
