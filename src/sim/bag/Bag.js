// The bag primitive (M1, docs/proposals/Marble-bag-engine.md section 4): a pool of outcome tokens that is shuffled and drawn
// without replacement, so every complete cycle contains exactly the configured counts (4 NORMAL + 2 CRIT = exactly 2 crits per 6 draws).
// Pure and not wired into the game yet: no combat code creates a Bag until M2.
// Sim code: no browser, no clock, no Math.random (Claude.md 5b). All randomness comes from the injected `rng` (`world.rng`, an
// object with `next()` in [0, 1)); a bag never creates, seeds or replaces one.
//
// Timing, so nobody has to guess:
//  - Dealing is LAZY. Constructing or restoring a bag never calls the rng. The first draw deals the first cycle, and a
//    `refill_shuffle` bag deals the next one on the first draw after the last token left (so it shows 0 left in between).
//  - A deal is a Fisher-Yates shuffle: tokens start sorted by name, then for i = n-1 down to 1, j = floor(next() * (i + 1)),
//    swap i and j. That is exactly n-1 calls to `next()` per deal, which tests (and a replay) can rely on.
//  - A failed call (empty bag, refused save) changes nothing and does not touch the rng.
//
// Hidden state: the draw order is a secret the server owns. All state is in `#private` fields, so `JSON.stringify(bag)` is `{}` and a
// snapshot can never leak it by accident. `serialize()` is for the persistence layer only; it is never sent to a client.
import { normalizeBagDef } from "./validateBag.js";

export const BAG_SAVE_VERSION = 1;

const isPlain = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

export class Bag {
  #def;
  #rng;
  /** Tokens of the current cycle in draw order. */
  #pool = [];
  /** Index of the next token to draw from `#pool`. */
  #pos = 0;
  /** Cycles dealt so far: 0 = nothing dealt yet, 1 = the first cycle is (or was) in play. */
  #cycle = 0;

  /**
   * @param {unknown} def a bag definition, see `validateBagDef`; invalid input throws with every problem listed
   * @param {{ rng: { next(): number } }} deps the injected random source (`world.rng`)
   */
  constructor(def, { rng } = {}) {
    this.#def = normalizeBagDef(def);
    if (!rng || typeof rng.next !== "function") throw new Error("[bag] needs an rng with next(); pass world.rng");
    this.#rng = rng;
  }

  get id() { return this.#def.id; }
  get scope() { return this.#def.scope; }
  /** Whether players may be told the contents. The bag itself never reveals anything; this is for the code that builds snapshots. */
  get hidden() { return this.#def.hidden; }
  /** Cycles dealt so far (0 before the first draw). */
  get cycle() { return this.#cycle; }

  /** Tokens left in the current cycle. Before the first draw that is the whole configured pool. */
  remaining() {
    return this.#cycle === 0 ? this.#total() : this.#pool.length - this.#pos;
  }

  /** @returns {Record<string, number>} tokens left per kind (every kind listed, sorted by name). A fresh copy. */
  counts() {
    const out = {};
    if (this.#cycle === 0) for (const [name, n] of this.#def.tokens) out[name] = n;
    else {
      for (const [name] of this.#def.tokens) out[name] = 0;
      for (let i = this.#pos; i < this.#pool.length; i++) out[this.#pool[i]]++;
    }
    return out;
  }

  /**
   * Draw one token. Never throws.
   * @returns {{ ok: true, token: string, left: number, cycle: number } | { ok: false, reason: "empty" }}
   *   `left` = tokens still in this cycle after the draw, `cycle` = which cycle the token came from (1 for the first).
   *   An empty `no_refill` bag answers `{ ok: false, reason: "empty" }` every time and consumes no randomness.
   */
  draw() {
    if (this.#pos >= this.#pool.length) {
      if (this.#cycle > 0 && this.#def.refill !== "refill_shuffle") return { ok: false, reason: "empty" };
      this.#deal();
    }
    const token = this.#pool[this.#pos++];
    return { ok: true, token, left: this.#pool.length - this.#pos, cycle: this.#cycle };
  }

  /**
   * The persistable state: plain data, JSON safe, a fresh copy. `pool` is the remaining tokens in the order they will be drawn, or
   * `null` before the first deal. SERVER ONLY: it contains the hidden order.
   * @returns {{ v: number, id: string, cycle: number, pool: string[] | null }}
   */
  serialize() {
    return { v: BAG_SAVE_VERSION, id: this.#def.id, cycle: this.#cycle, pool: this.#cycle === 0 ? null : this.#pool.slice(this.#pos) };
  }

  /**
   * Rebuild a bag from `serialize()` output (possibly read back from a database, so nothing is trusted). Every failure returns a
   * reason, creates no bag, does not touch `raw` and does not call the rng.
   *  - `corrupt`: not a save of this shape. `newer_version`: written by a newer game; keep it untouched, do not overwrite it.
   *  - `mismatch`: a valid save of a different bag, or one holding a token the definition no longer has (or more of it than a cycle).
   * A save with fewer tokens than a full cycle is fine: that is a bag in the middle of a cycle.
   * @param {unknown} def the definition the bag runs under (invalid input throws, like the constructor)
   * @param {unknown} raw the saved state
   * @param {{ rng: { next(): number } }} deps
   * @returns {{ ok: true, bag: Bag } | { ok: false, reason: "corrupt" | "newer_version" | "mismatch" }}
   */
  static restore(def, raw, deps) {
    const bag = new Bag(def, deps); // validates def and rng first: a programming error throws, bad data never does
    if (!isPlain(raw) || !Number.isInteger(raw.v) || raw.v < 1) return { ok: false, reason: "corrupt" };
    if (raw.v > BAG_SAVE_VERSION) return { ok: false, reason: "newer_version" };
    if (typeof raw.id !== "string") return { ok: false, reason: "corrupt" };
    if (!Number.isSafeInteger(raw.cycle) || raw.cycle < 0) return { ok: false, reason: "corrupt" };
    if (raw.cycle === 0) {
      if (raw.pool !== null) return { ok: false, reason: "corrupt" }; // nothing dealt means nothing to list
    } else {
      if (!Array.isArray(raw.pool)) return { ok: false, reason: "corrupt" };
      if (raw.pool.length > bag.#total()) return { ok: false, reason: "mismatch" }; // checked before scanning, so a huge list costs nothing
      if (raw.pool.some((t) => typeof t !== "string")) return { ok: false, reason: "corrupt" };
    }
    if (raw.id !== bag.#def.id) return { ok: false, reason: "mismatch" };
    if (raw.cycle > 0) {
      const left = new Map(bag.#def.tokens);
      for (const t of raw.pool) {
        const n = left.get(t);
        if (!n) return { ok: false, reason: "mismatch" };
        left.set(t, n - 1);
      }
      bag.#pool = raw.pool.slice();
      bag.#cycle = raw.cycle;
    }
    return { ok: true, bag };
  }

  #total() {
    let n = 0;
    for (const [, count] of this.#def.tokens) n += count;
    return n;
  }

  /** Deal a new cycle: every configured token, shuffled (Fisher-Yates, n-1 calls to `next()`). */
  #deal() {
    const pool = [];
    for (const [name, count] of this.#def.tokens) for (let i = 0; i < count; i++) pool.push(name);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(this.#rng.next() * (i + 1));
      const t = pool[i];
      pool[i] = pool[j];
      pool[j] = t;
    }
    this.#pool = pool;
    this.#pos = 0;
    this.#cycle++;
  }
}
