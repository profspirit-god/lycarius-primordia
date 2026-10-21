// S1b: seeded RNG. The generator itself, and proof that gameplay outcomes depend on `world.rng` and nothing else.
//   node tests/rng.test.mjs        (exit 0 = all passed)
// The key tests run three scripted fights (a raid with Fireballs, explosions and burn; a Graugr duel with deflects, strafing and
// dodges; a hostile dummy that casts, orbits, dies and respawns) and compare logs: same seed = identical, different seed = different,
// and the same seed under different Math.random streams = identical. Math.random is only ever used by visuals (particles, shake,
// audio), so a gameplay roll that still reads it shows up here. Each fight asserts that it really reached the code it guards.
import assert from "node:assert/strict";
import "../src/content/index.js"; // registers skills and classes
import { Rng } from "../src/sim/rng.js";
import { Fireball } from "../src/skills/Fireball.js";
import { FireballProjectile } from "../src/skills/FireballProjectile.js";
import { Mage } from "../src/classes/Mage.js";
import { RaidSystem } from "../src/systems/RaidSystem.js";
import { ExplosionSystem } from "../src/systems/ExplosionSystem.js";
import { TrainingDummy } from "../src/entities/TrainingDummy.js";
import { Graugr } from "../src/entities/Graugr.js";
import { BurnWardEffect } from "../src/skills/BurnWardEffect.js";
import { DT, mkWorld, step, dice } from "./helpers.mjs";

let passed = 0;
const test = (name, fn) => (fn(), passed++, console.log("ok  " + name));

// ---------------------------------------------------------------- the generator
test("Rng: mulberry32 stream is pinned (seed 1) and repeatable", () => {
  const r = new Rng(1);
  assert.deepEqual([r.next(), r.next(), r.next()], [0.6270739405881613, 0.002735721180215478, 0.5274470399599522]);
  const a = new Rng(42), b = new Rng(42);
  for (let i = 0; i < 1000; i++) assert.equal(a.next(), b.next());
  assert.notEqual(new Rng(1).next(), new Rng(2).next());
});

test("Rng: next is in [0,1), range in [a,b), chance edges are exact", () => {
  const r = new Rng(7);
  for (let i = 0; i < 20000; i++) {
    const x = r.next();
    assert.ok(x >= 0 && x < 1);
    const y = r.range(0.9, 1.1);
    assert.ok(y >= 0.9 && y < 1.1);
    assert.equal(r.chance(0), false);
    assert.equal(r.chance(1), true);
  }
  assert.equal(new Rng(3).range(5, 5), 5);
});

test("Rng: roughly uniform, and chance(p) hits about p", () => {
  const r = new Rng(2024);
  let sum = 0, hits = 0;
  const N = 100000;
  for (let i = 0; i < N; i++) { sum += r.next(); if (r.chance(0.12)) hits++; }
  assert.ok(Math.abs(sum / N - 0.5) < 0.01, `mean ${sum / N}`);
  assert.ok(Math.abs(hits / N - 0.12) < 0.01, `rate ${hits / N}`);
});

test("Rng: state is one integer; setState resumes the same stream", () => {
  const r = new Rng(9);
  for (let i = 0; i < 17; i++) r.next();
  const saved = r.state(), tail = [r.next(), r.next(), r.next()];
  assert.ok(Number.isInteger(saved));
  const r2 = new Rng(0);
  r2.setState(saved);
  assert.deepEqual([r2.next(), r2.next(), r2.next()], tail);
  assert.equal(new Rng(-1).seed, 0xffffffff, "seeds wrap to 32 bits");
});

// ---------------------------------------------------------------- the S1b "done when"
const damageList = (seed) => {
  const w = { rng: new Rng(seed) };
  const out = [];
  for (let i = 0; i < 300; i++) {
    const b = new FireballProjectile({ owner: { id: "A" }, x: 0, y: 0, z: 20, angle: 0, charge: (i % 11) / 10, damage: Fireball.damage, burn: Fireball.burn });
    const r = b.roll(w);
    out.push(r.damage, r.crit);
  }
  return out;
};

test("Fireball damage lists: same seed twice is identical, different seeds differ", () => {
  assert.deepEqual(damageList(5), damageList(5));
  assert.notDeepEqual(damageList(5), damageList(6));
  assert.ok(damageList(5).includes(true), "300 rolls at 12% contain crits");
});

test("a Fireball asks the world for its dice, in order: crit, then spread", () => {
  assert.deepEqual(new FireballProjectile({ owner: {}, x: 0, y: 0, z: 0, angle: 0, charge: 1, damage: Fireball.damage }).roll(dice([0.05, 0.5])), { damage: 53, crit: true });
});

// ---------------------------------------------------------------- whole-fight determinism
/** Stub arena: the shared test world plus an invulnerable player at the origin that never moves. */
function arena(seed) {
  const w = mkWorld();
  w.rng = new Rng(seed);
  w.removeDummy = w.restoreDummy = () => {};
  w.pushBanner = () => {};
  w.explosions = new ExplosionSystem(w);
  w.player = { x: 0, y: 0, vx: 0, vy: 0, radius: 16, height: 46, hittable: true, downed: false, stunT: 0, caster: { charging: false, chargeLevel: 0 }, ward: null, onHit() {}, onDot() {} };
  w.entities.push(w.player);
  w.log = [];
  w.events.on("hit", (e) => w.log.push(["hit", e.target === w.player ? "P" : "E", e.damage, e.crit, !!e.aoe, e.burn ? Math.round(e.burn.duration * 1e6) : 0]));
  w.events.on("burn", (e) => w.log.push(["burn", e.type]));
  w.events.on("kill", (e) => w.log.push(["kill", e.oneShot]));
  w.events.on("hit", (e) => e.target.onHit?.(e));
  return w;
}
const ballAt = (w, from, to, charge) =>
  w.spawn(new FireballProjectile({ owner: from, x: from.x, y: from.y, z: 30, angle: Math.atan2(to.y - from.y, to.x - from.x), charge, damage: Fireball.damage, burn: Fireball.burn }));
const pos = (e) => [Math.round(e.x * 1e3), Math.round(e.y * 1e3)];
/** Keep a Burn Resistance on the player (50% to nullify an ignition, which spends it), so the nullify roll is exercised. */
const rewardWard = (w) => { if (!w.player.ward) w.player.ward = new BurnWardEffect({ world: w, owner: w.player, duration: 999, nullifyChance: 0.5, burnReduction: 0.5, fireReduction: 0.3 }); };

/** A raid: Fireballs (crit, spread, burn), explosions, kills, spawn positions. */
function raidFight(seed) {
  const w = arena(seed), raid = new RaidSystem(w);
  raid.start();
  for (let f = 0; f < 2400; f++) {
    const tgt = w.entities.find((e) => e.isGraugr && !e.dead && !e.downed);
    if (tgt && f % 12 === 0) ballAt(w, w.player, tgt, 1 - (f % 48) / 48);
    if (f % 60 === 0) rewardWard(w);
    if (tgt && f % 211 === 0) w.events.emit("explosion", { source: w.player, x: tgt.x, y: tgt.y, z: 0, charge: 0.8, element: "fire" });
    step(w);
    raid.update(DT);
    if (f % 100 === 0) w.log.push(["at", f, ...w.entities.filter((e) => e.isGraugr).map((e) => [...pos(e), e.vitals.hp])]);
  }
  w.log.push(["raid", raid.number, raid.kills]);
  return w.log;
}

/** One strong Graugr that is kept alive for 70 s: the first half it attacks (barrage, deflects, dodges), the second its stamina is held low so it buys time (strafes). */
function duel(seed) {
  const w = arena(seed), g = w.spawn(new Graugr(260, 0, { tier: 3, rng: w.rng }));
  let dir = g.strafeDir;
  const seen = new Set();
  w.log.push(["start", g.strafeDir, g.strafeT]);
  for (let f = 0; f < 4200; f++) {
    if (f % 9 === 0) ballAt(w, w.player, g, 0.3);
    step(w);
    g.vitals.hp = g.vitals.maxHp;
    if (f >= 2100) g.stamina = Math.min(g.stamina, 12);
    if (g.strafeDir !== dir) w.log.push(["strafe", f, (dir = g.strafeDir)]);
    for (const e of w.entities) if (e.isProjectile && e.owner === g && !seen.has(e)) { seen.add(e); w.log.push(["deflected", f, Math.round(Math.atan2(e.vy, e.vx) * 1e6)]); }
    if (f % 100 === 0) w.log.push(["at", f, ...pos(g), g.mode, Math.round(g.stamina * 1e3)]);
  }
  for (const n of w.numbers) w.log.push(["text", n[2], Math.round(n[0] * 1e3), Math.round(n[1] * 1e3)]);
  return w.log;
}

/** A hostile Mage dummy: its cast timer and charge target, orbit flips, death and respawn. Nobody shoots it except the script. */
function dummyFight(seed) {
  const w = arena(seed), d = w.spawn(new TrainingDummy(340, 0, { attack: true, cls: Mage, move: "strafe", skills: true, rng: w.rng }));
  let was = d.downed;
  for (let f = 0; f < 3600; f++) {
    if (f === 900) { d.vitals.hp = 0; d.down(); }
    if (f % 60 === 0) rewardWard(w);
    step(w);
    if (d.downed !== was) w.log.push(["downed", f, (was = d.downed)]);
    if (f % 60 === 0) w.log.push(["at", f, ...pos(d), Math.round(d.vitals.mana * 1e3)]);
  }
  return w.log;
}

/** Everything, with Math.random replaced by `visual` (a number, or a function) for the whole run. */
function fights(seed, visual) {
  const real = Math.random;
  Math.random = typeof visual === "function" ? visual : () => visual;
  try {
    return { raid: raidFight(seed), duel: duel(seed), dummy: dummyFight(seed) };
  } finally {
    Math.random = real;
  }
}
const count = (log, kind, test = () => true) => log.filter((l) => l[0] === kind && test(l)).length;

test("fights reach the code they are meant to guard", () => {
  const f = fights(11, 0.5);
  assert.ok(count(f.raid, "hit") > 40, "raid: enough hits");
  assert.ok(count(f.raid, "hit", (l) => l[3] === true) > 0, "raid: a crit");
  assert.ok(count(f.raid, "hit", (l) => l[4] === true) > 0, "raid: explosion (aoe) damage");
  assert.ok(count(f.raid, "burn", (l) => l[1] === "ignite") > 0, "raid: an ignition");
  assert.ok(count(f.raid, "kill") > 3, "raid: kills");
  assert.ok(count(f.duel, "text", (l) => l[1] === "DEFLECT") > 0, "duel: a deflect");
  assert.ok(count(f.duel, "strafe") >= 2, "duel: strafe flips");
  assert.ok(count(f.duel, "deflected") > 0, "duel: a deflected shot flies back");
  assert.ok(count(f.dummy, "burn", (l) => l[1] === "nullify") > 0 && count(f.dummy, "burn", (l) => l[1] === "ignite") > 0, "dummy: the ward both nullifies and lets ignitions through");
  assert.ok(count(f.duel, "hit", (l) => l[1] === "P") > 3, "duel: the Graugr lands hits");
  assert.ok(count(f.dummy, "hit", (l) => l[1] === "P") > 3, "dummy: casts at the player");
  assert.deepEqual(f.dummy.filter((l) => l[0] === "downed").map((l) => l[2]), [true, false], "dummy: dies, then respawns");
});

test("fights: same seed twice gives identical logs", () => {
  assert.deepEqual(fights(11, 0.5), fights(11, 0.5));
});

test("fights: different seeds give different fights", () => {
  const a = fights(11, 0.5), b = fights(12, 0.5);
  assert.notDeepEqual(a.raid, b.raid);
  assert.notDeepEqual(a.duel, b.duel);
  assert.notDeepEqual(a.dummy, b.dummy);
});

test("fights: gameplay does not read Math.random (other visual streams, same seed, same fights)", () => {
  let s = 0.123;
  const noisy = () => ((s = (s * 9301 + 0.49297) % 1), s); // a different, moving stream
  const base = fights(11, 0.5);
  assert.deepEqual(fights(11, 0.01), base);
  assert.deepEqual(fights(11, 0.99), base);
  assert.deepEqual(fights(11, noisy), base);
});

console.log(`\n${passed} tests passed`);
