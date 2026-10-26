// The hunger primitive (H1, aligned by H1b with FOUNDER.md section 6): one stat of hunger POINTS that falls with sim time and is raised
// by eating, and the tier it is in. Pure. Wired into the game by H2a (V1.23.0.00): `Player` owns one (`player.hunger`), `HungerStore` saves it.
// Sim code: no browser, no clock, no randomness (Claude.md 5b). The only time it knows is the `dt` the caller passes (R2, R10), so it
// never drains while the game is closed and gives the same result at any frame rate. It has no rng: hunger is deterministic.
//
// What it does NOT do, on purpose (H2a, H2b and track HS do these):
//  - The Hunger class deals no damage and cannot kill. Hunger may damage but never kill (FOUNDER.md 6b, R12), and only through
//    statuses, non-lethal (never below 1 HP): that is later work (track HS), never this class.
//  - It does not touch Vitals, StatusSystem, items, the HUD or storage. It reports a tier (`tier.status`, the multipliers) and the
//    caller applies it (H2b). The save is plain data; `HungerStore` writes it through the storage adapter.
//  - It does not know about the Overeating status or the Bag draws (HS1, HS2): `eat` only REPORTS an overflow (`overeat`, `excess`);
//    the caller starts the status, and refuses food while that status runs (R13).
//
// Timing, so nobody has to guess:
//  - The value is a real number of points (the maximum is usually 1000 = 100%). A tier applies the moment the value is at or above its
//    `min`, so exactly 250 points is "not_hungry" and 249.999 is "hungry". The HUD shows `percent` (the value in percent, rounded down).
//    Many small steps add up with rounding noise of about 1e-12, so exactly ON a tier edge two frame rates can land on different sides
//    by far less than a millisecond of play; away from an edge they agree.
//  - `update(dt)` lowers the value by `dt / drainSeconds` and floors it at 0. A bad `dt` (not a finite number, or negative) is ignored.
//  - `eat(points)` raises the value by `points`, in EVERY tier, as long as the value is below the maximum (R13). Points that do not fit
//    are wasted and reported as an overflow. A refused call changes nothing.
import { normalizeHungerDef } from "./validateHunger.js";

export const HUNGER_SAVE_VERSION = 1;

const isPlain = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/**
 * The tier a value falls in. Pure; the same function the class uses, for the HUD and tests.
 * @param {{ tiers: ReadonlyArray<{ min: number }> }} def a NORMALIZED definition (tiers sorted by `min`, highest first)
 * @param {number} value
 */
export function tierFor(def, value) {
  for (const t of def.tiers) if (value >= t.min) return t;
  return def.tiers[def.tiers.length - 1]; // unreachable for a valid definition (one tier starts at 0); keeps the function total
}

export class Hunger {
  #def;
  #value;

  /**
   * @param {unknown} def a hunger definition, see `validateHungerDef`; invalid input throws with every problem listed
   * @param {{ value?: number }} [opts] a starting value in points (default: the definition's `start`); out of range or not a number throws
   */
  constructor(def, { value } = {}) {
    this.#def = normalizeHungerDef(def);
    const v = value === undefined ? this.#def.start : value;
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > this.#def.max) throw new Error(`[hunger] starting value must be a number from 0 to ${this.#def.max}`);
    this.#value = v;
  }

  get id() { return this.#def.id; }
  /** The maximum in points (100%). */
  get max() { return this.#def.max; }
  /** Current value in points, 0 to max. */
  get value() { return this.#value; }
  /** The value as a whole percentage for the HUD, 0 to 100; 100 only when the stat is really at its maximum. */
  get percent() { return Math.floor((this.#value / this.#def.max) * 100); }
  /** The current tier: a frozen object `{ id, min, hpRegenMult, manaRegenMult, staminaRegenMult, moveMult, status }`. */
  get tier() { return tierFor(this.#def, this.#value); }
  get tierId() { return this.tier.id; }
  /** Whether `eat` can take food right now: true in every tier, false only when the stat is at its maximum. */
  get canEat() { return this.#value < this.#def.max; }
  /** Multipliers for the caller to apply (H2b), one per stat: health, mana and stamina regeneration, and move speed. */
  get hpRegenMult() { return this.tier.hpRegenMult; }
  get manaRegenMult() { return this.tier.manaRegenMult; }
  get staminaRegenMult() { return this.tier.staminaRegenMult; }
  get moveMult() { return this.tier.moveMult; }
  /** The status id the caller should show through `StatusSystem` for this tier, or null. */
  get status() { return this.tier.status; }

  /**
   * Drain by `dt` seconds of sim time.
   * @param {number} dt
   * @returns {{ from: string, to: string } | null} the tier change this call caused (plain data, for an event), or null
   */
  update(dt) {
    if (typeof dt !== "number" || !Number.isFinite(dt) || dt <= 0) return null;
    return this.#set(Math.max(0, this.#value - dt / this.#def.drainSeconds));
  }

  /**
   * Eat food worth `points` of hunger. Never throws.
   * @param {number} points a finite number above 0 and at most `max`
   * @returns {{ ok: true, gained: number, value: number, overeat: boolean, excess: number, change: { from: string, to: string } | null }
   *   | { ok: false, reason: "invalid_amount" | "cannot_eat" }}
   *   `gained` is what was really added. When `value + points` goes past the maximum the stat becomes the maximum, `overeat` is true and
   *   `excess` is the wasted part (the caller starts Overeating, R13); reaching the maximum exactly is not an overflow. `cannot_eat` =
   *   the stat is already at its maximum; the caller keeps the food item. A failed call changes nothing.
   */
  eat(points) {
    if (typeof points !== "number" || !Number.isFinite(points) || points <= 0 || points > this.#def.max) return { ok: false, reason: "invalid_amount" };
    if (!this.canEat) return { ok: false, reason: "cannot_eat" };
    const before = this.#value,
      room = this.#def.max - before,
      overeat = points > room;
    const change = this.#set(overeat ? this.#def.max : before + points);
    return { ok: true, gained: this.#value - before, value: this.#value, overeat, excess: overeat ? points - room : 0, change };
  }

  /**
   * Set the value directly, in points. Gameplay raises hunger only through `eat`; this exists for the respawn floor (R20, `Player.respawn`),
   * the Developer tool and tests. A bad value (not a finite number from 0 to max) changes nothing and returns null, like a call that
   * caused no tier change.
   * @param {number} points
   * @returns {{ from: string, to: string } | null} the tier change this call caused, or null
   */
  setValue(points) {
    if (typeof points !== "number" || !Number.isFinite(points) || points < 0 || points > this.#def.max) return null;
    return this.#set(points);
  }

  /**
   * The persistable state: plain data, JSON safe. Hunger is not a secret, so unlike a bag it may be shown to its owner.
   * The value is in hunger points (no stat was ever saved before H2a, so there is nothing older to migrate).
   * @returns {{ v: number, id: string, value: number }}
   */
  serialize() {
    return { v: HUNGER_SAVE_VERSION, id: this.#def.id, value: this.#value };
  }

  /**
   * Rebuild a Hunger from `serialize()` output (possibly read back from a save file or a database, so nothing is trusted). Every
   * failure returns a reason, creates nothing and does not touch `raw`.
   *  - `corrupt`: not a save of this shape, or a value that is not a number from 0 to max.
   *  - `newer_version`: written by a newer game; keep it untouched, do not overwrite it.
   *  - `mismatch`: a valid save of a different definition id.
   * @param {unknown} def the definition it runs under (invalid input throws, like the constructor)
   * @param {unknown} raw the saved state
   * @returns {{ ok: true, hunger: Hunger } | { ok: false, reason: "corrupt" | "newer_version" | "mismatch" }}
   */
  static restore(def, raw) {
    const hunger = new Hunger(def); // validates def first: a programming error throws, bad data never does
    if (!isPlain(raw) || !Number.isInteger(raw.v) || raw.v < 1) return { ok: false, reason: "corrupt" };
    if (raw.v > HUNGER_SAVE_VERSION) return { ok: false, reason: "newer_version" };
    if (typeof raw.id !== "string") return { ok: false, reason: "corrupt" };
    if (typeof raw.value !== "number" || !Number.isFinite(raw.value) || raw.value < 0 || raw.value > hunger.#def.max) return { ok: false, reason: "corrupt" };
    if (raw.id !== hunger.#def.id) return { ok: false, reason: "mismatch" };
    hunger.#value = raw.value;
    return { ok: true, hunger };
  }

  /** Store a new value and report the tier change, if any. */
  #set(next) {
    const from = this.tier.id;
    this.#value = next;
    const to = this.tier.id;
    return from === to ? null : { from, to };
  }
}
