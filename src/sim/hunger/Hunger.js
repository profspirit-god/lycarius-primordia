// The hunger primitive (H1, FOUNDER.md section 6): one 0 to `max` stat that falls with sim time and is raised by eating, and the tier
// it is in. Pure and not wired into the game yet: nothing creates a Hunger until H2 (player) wires it.
// Sim code: no browser, no clock, no randomness (Claude.md 5b). The only time it knows is the `dt` the caller passes (R2, R10), so it
// never drains while the game is closed and gives the same result at any frame rate. It has no rng: hunger is deterministic.
//
// What it does NOT do, on purpose (H2 and later do these):
//  - The Hunger class deals no damage and cannot kill. Hunger may damage but never kill (FOUNDER.md 6b, R12), and only through
//    statuses, non-lethal (never below 1 HP): that is later work (track HS), never this class.
//  - It does not touch Vitals, StatusSystem, items, the HUD or storage. It reports a tier (`tier.status`, `regenMult`, ...) and the
//    caller applies it. The save is plain data; the caller writes it through the storage adapter.
//
// Timing, so nobody has to guess:
//  - The value is a real number. A tier applies the moment the value is at or above its `min`, so a value of exactly 25 is
//    "not_hungry" and 24.999 is "hungry". The HUD shows `Math.floor(value)`. Many small steps add up with rounding noise of about 1e-12,
//    so exactly ON a tier edge two frame rates can land on different sides by far less than a millisecond of play; away from an edge they agree.
//  - `update(dt)` lowers the value by `dt / drainSeconds` and floors it at 0. A bad `dt` (not a finite number, or negative) is ignored.
//  - `eat(n)` raises the value by `n`, capped at `max`, only when the current tier allows eating. A refused call changes nothing.
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
   * @param {{ value?: number }} [opts] a starting value (default: the definition's `start`); out of range or not a number throws
   */
  constructor(def, { value } = {}) {
    this.#def = normalizeHungerDef(def);
    const v = value === undefined ? this.#def.start : value;
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > this.#def.max) throw new Error(`[hunger] starting value must be a number from 0 to ${this.#def.max}`);
    this.#value = v;
  }

  get id() { return this.#def.id; }
  get max() { return this.#def.max; }
  /** Current value, 0 to max. */
  get value() { return this.#value; }
  /** The current tier: a frozen object `{ id, min, regenMult, moveMult, staminaRegenMult, status, canEat }`. */
  get tier() { return tierFor(this.#def, this.#value); }
  get tierId() { return this.tier.id; }
  /** Whether `eat` is allowed right now (false in the Stuffed tier). */
  get canEat() { return this.tier.canEat; }
  /** Multipliers for the caller to apply (H2): regeneration of health and mana, move speed, stamina regeneration. */
  get regenMult() { return this.tier.regenMult; }
  get moveMult() { return this.tier.moveMult; }
  get staminaRegenMult() { return this.tier.staminaRegenMult; }
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
   * Eat food worth `amount` hunger. Never throws.
   * @param {number} amount a finite number above 0 and at most `max`
   * @returns {{ ok: true, gained: number, value: number, change: { from: string, to: string } | null }
   *   | { ok: false, reason: "invalid_amount" | "cannot_eat" }}
   *   `gained` is what was really added (less than `amount` when the stat hits `max`). `cannot_eat` = the current tier refuses food
   *   (Stuffed); the caller keeps the food item. A failed call changes nothing.
   */
  eat(amount) {
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0 || amount > this.#def.max) return { ok: false, reason: "invalid_amount" };
    if (!this.canEat) return { ok: false, reason: "cannot_eat" };
    const before = this.#value;
    const change = this.#set(Math.min(this.#def.max, before + amount));
    return { ok: true, gained: this.#value - before, value: this.#value, change };
  }

  /**
   * The persistable state: plain data, JSON safe. Hunger is not a secret, so unlike a bag it may be shown to its owner.
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
