// Shared helpers for headless tests (no browser, no dependencies). Used by mage.test.mjs.
// graugr.test.mjs keeps its own copy on purpose: it is the pinned baseline and stays untouched.
import { EventBus } from "../src/core/EventBus.js";
import { StatusSystem } from "../src/systems/StatusSystem.js";

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

/**
 * Run fn with Math.random replaced. `seq` is a number (constant) or an array (values in order, last one repeats).
 * Particle code also draws from Math.random, so sequences only make sense around direct calls (roll, ignite),
 * never around a loop that updates projectiles. Use a constant there.
 */
export function withRandom(seq, fn) {
  const real = Math.random;
  const list = Array.isArray(seq) ? seq : [seq];
  let i = 0;
  Math.random = () => list[Math.min(i++, list.length - 1)];
  try {
    return fn();
  } finally {
    Math.random = real;
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
