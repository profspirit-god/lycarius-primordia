// Seeded random numbers for the simulation (S1b). Every gameplay roll (damage, crit, chances, AI choices, spawn
// positions) goes through `world.rng`, never `Math.random` (Claude.md 5b, rule R3). Same seed + same calls = same numbers,
// so tests are repeatable and a server can replay a fight. Visual randomness (particles, shake, audio) stays on `rand()`.
// Sim-safe: no browser, no clock. Replicated field if a client ever needs it: `s` (a 32-bit integer), see state() / setState().

const SEED_MASK = 0xffffffff;

/** mulberry32. `next()` is the only method that advances the state; the others are built on it. */
export class Rng {
  /** @param {number} seed any integer; it is wrapped to 32 bits */
  constructor(seed = 1) {
    this.seed = seed >>> 0;
    this.s = this.seed;
  }

  /** @returns {number} a float in [0, 1) */
  next() {
    this.s = (this.s + 0x6d2b79f5) & SEED_MASK;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** @returns {number} a float in [a, b) (same shape as core/math `rand`) */
  range(a = 0, b = 1) {
    return a + this.next() * (b - a);
  }

  /** @returns {boolean} true with probability p; `chance(0)` never, `chance(1)` always (next() is below 1) */
  chance(p) {
    return this.next() < p;
  }

  /** The whole generator state, a plain number (save it, or send it to a client that must predict). */
  state() {
    return this.s;
  }

  setState(s) {
    this.s = s >>> 0;
  }
}
