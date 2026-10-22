// S1c: the simulation clock. `world.time` is the only time source in sim code (R2); the dummy's DPS readout was the last user of a wall clock.
//   node tests/clock.test.mjs        (exit 0 = all passed)
import assert from "node:assert/strict";
import "../src/content/index.js"; // registers skills and classes
import { TrainingDummy } from "../src/entities/TrainingDummy.js";
import { DT, mkWorld, step } from "./helpers.mjs";

let passed = 0;
const test = (name, fn) => (fn(), passed++, console.log("ok  " + name));
const hit = (damage) => ({ damage, charge: 0, dir: { x: 1, y: 0 } });
const dummy = () => new TrainingDummy(300, 0, {});

test("world clock: step() advances world.time by exactly DT per frame", () => {
  const w = mkWorld();
  assert.equal(w.time, 0);
  step(w, 60);
  assert.ok(Math.abs(w.time - 1) < 1e-9);
});

test("DPS is a 5 s window of sim time: hits and burn ticks count, old ones drop out", () => {
  const w = mkWorld(), d = dummy();
  w.time = 0; d.onHit(hit(10), w);
  w.time = 2; d.onDot({ damage: 20, kind: "burn" }, w);
  w.time = 4.9; assert.equal(d.dps(w), 6, "(10 + 20) / 5");
  w.time = 5; assert.equal(d.dps(w), 4, "the hit at t = 0 is exactly 5 s old and leaves the window");
  w.time = 6.99; assert.equal(d.dps(w), 4);
  w.time = 7; assert.equal(d.dps(w), 0);
  assert.equal(d.totalDamage, 30, "the running total is not windowed");
  assert.equal(d.hits, 1, "a burn tick is damage but not a hit");
});

test("DPS does not read a wall clock, and does not care how large world.time is", () => {
  const w = mkWorld(), d = dummy(), real = performance.now;
  performance.now = () => NaN; // the old code compared performance.now() values: NaN would break it
  try {
    assert.ok(Number.isNaN(performance.now()), "the stub took effect");
    w.time = 1e6; d.onHit(hit(50), w);
    w.time = 1e6 + 1; assert.equal(d.dps(w), 10);
    w.time = 1e6 + 5.5; assert.equal(d.dps(w), 0);
  } finally {
    performance.now = real;
  }
});

test("a burn on the dummy reaches onDot with the world (StatusSystem passes it) and shows up in DPS", () => {
  const w = mkWorld(), d = w.spawn(dummy());
  w.events.emit("hit", { source: null, target: d, damage: 0, burn: { chance: 1, duration: 3, dps: 8 } });
  assert.ok(d.burn, "ignited");
  step(w, 60 * 3 + 5);
  assert.equal(d.log.length, 3, "three one-second ticks");
  assert.ok(d.log.every((l) => l.t > 0 && l.t <= w.time), "stamped with sim time, not a wall clock");
  assert.ok(Math.abs(d.log[1].t - d.log[0].t - 1) < 2 * DT, "ticks are one sim second apart");
  assert.equal(d.dps(w), 5, "24 damage / 5 s, rounded");
});

console.log(`\n${passed} tests passed`);
