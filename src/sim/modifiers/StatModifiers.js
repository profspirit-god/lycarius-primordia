// X1: the owned TEMPORARY stat-modifier layer. Simulation only (no browser, no clock, no randomness, no presentation).
//
// What it is: a list of named multiplier sets on one owner (a player). Each set has a key that names its owner ("hunger", "status:burn", a buff id), so
// the one who added it is the one who removes or replaces it. `mult(stat)` is the PRODUCT of every set's multiplier for that stat, clamped to the
// total cap of that stat (speed never below 75%, `STAT_CAPS`). Temporary modifiers multiply the FINAL stats; they never touch the permanent stat-ticket
// bonus (`StatTraining`), so removing one gives back exactly the stats the player had.
//
// Not saved: a temporary modifier is rebuilt by whoever owns it (a status, a tier). Replicated fields (clients would need): `list()` (plain data).
// R9: the product is taken in key order, so the result never depends on the order the sets were added.

/** The stats a modifier may scale. `staminaCost` scales what Dodge and Chop cost; `damage` scales the skill damage of the owner. */
export const MOD_STATS = Object.freeze(["hpRegen", "manaRegen", "staminaRegen", "speed", "staminaCost", "damage"]);

/** Total cap per stat (applied to the product of all sets). Speed floor 0.75 = `HUNGER_MOVE_FLOOR` (FOUNDER R17). */
export const STAT_CAPS = Object.freeze({
  hpRegen: Object.freeze({ min: 0, max: 5 }),
  manaRegen: Object.freeze({ min: 0, max: 10 }),
  staminaRegen: Object.freeze({ min: 0, max: 5 }),
  speed: Object.freeze({ min: 0.75, max: 1.5 }),
  staminaCost: Object.freeze({ min: 0.25, max: 3 }),
  damage: Object.freeze({ min: 0.25, max: 3 }),
});

/** R11 limits for one set (it can come from content or, later, from the network). */
export const MOD_LIMITS = Object.freeze({ maxSets: 32, maxKeyLength: 64, minMult: 0, maxMult: 10 });

const isStat = (s) => Object.prototype.hasOwnProperty.call(STAT_CAPS, s);

export class StatModifiers {
  constructor() {
    this.sets = []; // [{ key, mult: { stat: number } }], plain data
    this.revision = 0; // +1 on every change; lets the owner recalculate only when needed
  }

  /**
   * Add a set, or replace the one with the same key. Nothing changes on a refusal.
   * @param {string} key   who owns it
   * @param {Record<string, number>} mult   e.g. `{ speed: 0.9, hpRegen: 0.5 }`; a stat left out stays 1
   * @returns {{ok:true}|{ok:false, reason:string}}
   */
  set(key, mult) {
    if (typeof key !== "string" || key.length === 0 || key.length > MOD_LIMITS.maxKeyLength) return { ok: false, reason: "invalid_key" };
    if (!mult || typeof mult !== "object" || Array.isArray(mult)) return { ok: false, reason: "invalid_mult" };
    const clean = {};
    for (const stat of Object.keys(mult).sort()) {
      const v = mult[stat];
      if (!isStat(stat)) return { ok: false, reason: "unknown_stat" };
      if (typeof v !== "number" || !Number.isFinite(v) || v < MOD_LIMITS.minMult || v > MOD_LIMITS.maxMult) return { ok: false, reason: "invalid_mult" };
      clean[stat] = v;
    }
    const i = this.sets.findIndex((s) => s.key === key);
    if (i < 0 && this.sets.length >= MOD_LIMITS.maxSets) return { ok: false, reason: "too_many" };
    if (i >= 0) this.sets[i] = { key, mult: clean };
    else {
      this.sets.push({ key, mult: clean });
      this.sets.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)); // R9
    }
    this.revision++;
    return { ok: true };
  }

  /** Remove the set of `key`. Returns true if there was one. */
  remove(key) {
    const i = this.sets.findIndex((s) => s.key === key);
    if (i < 0) return false;
    this.sets.splice(i, 1);
    this.revision++;
    return true;
  }

  has(key) {
    return this.sets.some((s) => s.key === key);
  }

  /** The product of all sets for `stat`, clamped to the total cap. 1 when nothing applies or the stat is unknown. */
  mult(stat) {
    if (!isStat(stat)) return 1;
    let m = 1;
    for (const s of this.sets) if (s.mult[stat] !== undefined) m *= s.mult[stat];
    const cap = STAT_CAPS[stat];
    return Math.min(cap.max, Math.max(cap.min, Math.round(m * 1e6) / 1e6));
  }

  /** Plain-data copy of the sets (for a snapshot or a debug view). */
  list() {
    return this.sets.map((s) => ({ key: s.key, mult: { ...s.mult } }));
  }
}
