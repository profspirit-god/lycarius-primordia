// Fire Blast: instant-radius fire burst around the caster. Simulation code (server-ready): no randomness,
// no drawing, no audio. It emits a 'blast' event (BlastFx draws it, AudioSystem plays it) and 'hit' events (damage).
import { dist } from "../core/math.js";
import { elementMult, skillMult } from "../progression/Mods.js";

// Tuning (all numbers live here).
const DAMAGE = 70; // flat, to every target in range (no falloff)
const RADIUS = 240; // px, measured from the caster's centre to the target's body edge
const KNOCKBACK = 1500; // px/s impulse; the knock decays at exp(-7 t), so about 1500 / 7 = 215 px of travel
const COST = 40; // mana, paid when the cast completes
const BURN = { chance: 0.4, duration: 6, dps: 8 }; // chance to set each target on fire (dps is boosted by element damage)
const HIT_CHARGE = 0.3; // 'charge' on the hit events: keeps the targets' own onHit knock small, the blast knock is added on top

/**
 * Self-centred AOE with a short cast time. Hold the key until the circle completes; releasing early cancels for free.
 * Damages and knocks back everything hittable in range except the caster. Fire resistance (Burn Resistance) applies.
 */
/** @type {import('../types.js').SkillDef} */
export const FireBlast = {
  id: "fireBlast",
  name: "Fire Blast",
  icon: "blast",
  element: "fire",
  hint: "R (hold)",
  self: true,
  noAi: true, // enemy / dummy AI does not know this skill
  autoRelease: true,
  cooldown: 60,
  chargeTime: 0.5,
  minCharge: 1,
  damage: DAMAGE,
  radius: RADIUS,
  knockback: KNOCKBACK,
  burn: BURN,

  manaCost() {
    return COST;
  },
  canStart(mana) {
    return mana >= COST;
  },
  isActive() {
    return false;
  },

  onChargeStart() {},
  /** Presentation of the wind-up is the shared self-cast aura and ground circle (Player / dummy draw them). */
  onCharging() {},

  onRelease({ owner, world }) {
    owner.vitals.spend(COST);
    const mult = skillMult(owner) * elementMult(owner, FireBlast.element);
    const amount = Math.max(1, Math.round(DAMAGE * mult));
    const burnDps = BURN.dps * elementMult(owner, FireBlast.element);
    world.events.emit("blast", { source: owner, x: owner.x, y: owner.y, z: owner.height * 0.5, radius: RADIUS, element: FireBlast.element, kind: "fireBlast" });
    const list = world.entities.slice(); // events may spawn entities
    for (const t of list) {
      if (t === owner || !t.hittable || t.dead) continue;
      const d = dist(owner.x, owner.y, t.x, t.y);
      if (d - t.radius > RADIUS) continue;
      const dir = d > 1e-6 ? { x: (t.x - owner.x) / d, y: (t.y - owner.y) / d } : { x: Math.cos(owner.aim), y: Math.sin(owner.aim) };
      const damage = t.ward ? t.ward.resist(amount) : amount;
      world.events.emit("hit", {
        source: owner,
        target: t,
        damage,
        crit: false,
        resisted: amount - damage,
        burn: { chance: BURN.chance, duration: BURN.duration, dps: burnDps },
        dir,
        charge: HIT_CHARGE,
        x: t.x,
        y: t.y,
        z: t.height * 0.5,
        aoe: true,
      });
      t.applyImpulse?.(dir.x * KNOCKBACK, dir.y * KNOCKBACK);
    }
  },
};
