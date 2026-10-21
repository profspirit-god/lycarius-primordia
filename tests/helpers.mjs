// Shared helpers for headless tests (no browser, no dependencies). Used by mage.test.mjs.
// graugr.test.mjs keeps its own copy on purpose: it is the pinned baseline and stays untouched.
import { EventBus } from "../src/core/EventBus.js";
import { StatusSystem } from "../src/systems/StatusSystem.js";
import { Rng } from "../src/sim/rng.js";

export const DT = 1 / 60;

/** Stub world: the members the simulation files reach for, with presentation calls turned into no-ops. */
export function mkWorld() {
  const w = { events: new EventBus(), entities: [], banners: [], numbers: [] };
  w.particles = { emit() {} };
  w.damageNumbers = { spawn: (...a) => w.numbers.push(a) };
  w.lights = { add() {} };
  w.camera = { addTrauma() {} };
  w.hitstop = () => {};
  w.spawn = (e) => (w.entities.push(e), e);
  w.rng = new Rng(1); // seeded like the real world; tests that need exact dice use withRng()
  w.status = new StatusSystem(w);
  return w;
}

/** Advance every entity and the status system by n fixed frames. */
export function step(w, n = 1) {
  for (let i = 0; i < n; i++) {
    for (const e of w.entities.slice()) e.update?.(DT, w);
    w.entities = w.entities.filter((e) => !e.dead);
    w.status.update(DT);
  }
}

/** Record every event of one name. Returns the live array. */
export function capture(w, name) {
  const log = [];
  w.events.on(name, (e) => log.push(e));
  return log;
}

/** An Rng whose next() replays `seq` (a number = constant, an array = values in order, the last one repeats). range() and chance() are the real ones. */
export class ScriptedRng extends Rng {
  constructor(seq) {
    super(0);
    this.list = Array.isArray(seq) ? seq : [seq];
    this.i = 0;
  }
  next() {
    return this.list[Math.min(this.i++, this.list.length - 1)];
  }
}

/** A bare `{ rng }` world for calls that only need dice, like FireballProjectile.roll(world). */
export const dice = (seq) => ({ rng: new ScriptedRng(seq) });

/**
 * Run fn with `w.rng` replaced by a scripted one, then restore it. Only gameplay rolls draw from it: particles, shake and
 * audio use their own randomness, so a sequence can no longer be eaten by a visual effect (the old Math.random stub could).
 */
export function withRng(w, seq, fn) {
  const real = w.rng;
  w.rng = new ScriptedRng(seq);
  try {
    return fn();
  } finally {
    w.rng = real;
  }
}

/** In-memory stand-in for localStorage (Progression saves through it). */
export function memoryStorage() {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => void data.set(k, String(v)),
    removeItem: (k) => void data.delete(k),
    clear: () => data.clear(),
    data,
  };
}
