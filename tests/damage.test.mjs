// S1d (V1.12.0.03): damage is applied by DamageSystem (sim), not by the view. No browser, no dependencies.
//   node tests/damage.test.mjs        (exit 0 = all passed)
// Every world below is built WITHOUT HitEffects unless a test says otherwise: that is the S1d "done when".
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import "../src/content/index.js";
import { ClassRegistry } from "../src/classes/ClassRegistry.js";
import { EventBus } from "../src/core/EventBus.js";
import { Rng } from "../src/sim/rng.js";
import { Player } from "../src/entities/Player.js";
import { Graugr } from "../src/entities/Graugr.js";
import { TrainingDummy } from "../src/entities/TrainingDummy.js";
import { Progression } from "../src/progression/Progression.js";
import { Fireball } from "../src/skills/Fireball.js";
import { FireballProjectile } from "../src/skills/FireballProjectile.js";
import { DamageSystem } from "../src/systems/DamageSystem.js";
import { SIM_SYSTEMS, VIEW_SYSTEMS, createSystems, disposeSystems } from "../src/systems/pipeline.js";
import { DT, step, capture } from "./helpers.mjs";

globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
const mage = ClassRegistry.get("mage");
let passed = 0;
const test = (name, fn) => (fn(), passed++, console.log("ok  " + name));
const dir = { x: 1, y: 0 };
const hit = (target, o = {}) => ({ source: o.source ?? { id: "A" }, target, damage: o.damage ?? 10, crit: false, dir, charge: o.charge ?? 0.5, x: target.x, y: target.y, z: 20, ...o });

/** A world with the simulation pipeline only: no HitEffects and no view systems. The no-op presentation stubs stay because Graugr's death still
 *  calls `world.particles` directly (existing R5 debt, audit `present`, leaves in S1f). */
function simWorld(seed = 1) {
  const w = { events: new EventBus(), entities: [], banners: [], rng: new Rng(seed), time: 0 };
  w.particles = { emit() {} };
  w.lights = { add() {} };
  w.camera = { addTrauma() {} };
  w.damageNumbers = { spawn() {} };
  w.hitstop = () => {};
  w.spawn = (e) => (w.entities.push(e), e);
  w.removeDummy = w.restoreDummy = w.pushBanner = () => {};
  createSystems(w, SIM_SYSTEMS);
  return w;
}

test("the pipeline lists sim systems before view systems, damage before status before xp", () => {
  const names = [...SIM_SYSTEMS, ...VIEW_SYSTEMS].map(([n]) => n);
  assert.equal(new Set(names).size, names.length, "no duplicates");
  assert.deepEqual(names.slice(0, 3), ["damage", "status", "explosions"]);
  assert.ok(names.indexOf("xp") < names.indexOf("hitEffects"));
  const w = simWorld();
  for (const [n] of SIM_SYSTEMS) assert.ok(w[n], n + " is stored on the world");
  assert.ok(!w.hitEffects, "no view system in a sim world");
});

test("a Player takes hit damage and knock with no HitEffects, and the red flash is not a sim value", () => {
  const w = simWorld(),
    p = w.spawn(new Player(mage, new Progression(mage)));
  const hp0 = p.vitals.hp;
  w.events.emit("hit", hit(p, { damage: 12, charge: 1 }));
  assert.equal(p.vitals.hp, hp0 - 12);
  assert.ok(p.knock.x > 0, "knocked along the hit direction");
  assert.equal(p.flash, 0);
  w.events.emit("hit", hit(p, { damage: 9999 }));
  assert.ok(p.downed && !p.hittable, "a lethal hit downs the player");
});

test("a Graugr takes hit and burn damage with no HitEffects; the kill event and one-shot flag still work", () => {
  const w = simWorld(),
    g = w.spawn(new Graugr(200, 0, { rng: w.rng })),
    kills = capture(w, "kill");
  const hp0 = g.vitals.hp;
  w.events.emit("hit", hit(g, { damage: 7 }));
  assert.equal(g.vitals.hp, hp0 - 7);
  assert.ok(g.knock.x > 0 && g.flash === 0);
  g.onDot({ damage: 3, kind: "burn", source: null }, w);
  assert.equal(g.vitals.hp, hp0 - 10);
  assert.equal(g.flash, 0);
  w.events.emit("hit", hit(g, { damage: 99999 }));
  assert.ok(g.downed);
  step(w, 2);
  assert.equal(kills.length, 1);
  assert.equal(kills[0].oneShot, false, "it had been hit before");
});

test("the training dummy counts damage, freezes and springs back with no HitEffects", () => {
  const w = simWorld(),
    d = w.spawn(new TrainingDummy(300, 0, { attack: true, cls: mage, rng: w.rng }));
  w.time = 1;
  w.events.emit("hit", hit(d, { damage: 20, charge: 1 }));
  assert.equal(d.totalDamage, 20);
  assert.equal(d.hits, 1);
  assert.equal(d.lastHit, 20);
  assert.ok(d.freeze > 0.3 && d.pending, "sim values: freeze stops steering, the knock waits for it");
  assert.equal(d.vitals.hp, d.vitals.maxHp - 20);
  assert.equal(d.flash + d.glow, 0, "flash and glow are view values");
  assert.equal(d.dps(w), Math.round(20 / 5));
});

test("a killing blow downs the target before ignition is rolled, so a dead target is not set alight", () => {
  const w = simWorld(),
    g = w.spawn(new Graugr(200, 0, { rng: w.rng }));
  w.events.emit("hit", hit(g, { damage: 99999, burn: { chance: 1, duration: 4, dps: 3 } }));
  assert.ok(g.downed && !g.burn);
  const live = w.spawn(new Graugr(400, 0, { rng: w.rng }));
  w.events.emit("hit", hit(live, { damage: 1, burn: { chance: 1, duration: 4, dps: 3 } }));
  assert.ok(live.burn, "a living target still ignites at chance 1");
});

test("without DamageSystem nothing lands; after dispose it stops listening", () => {
  const w = { events: new EventBus(), entities: [], rng: new Rng(1), time: 0 };
  const t = { x: 0, y: 0, hittable: true, got: 0, onHit(e, world) { this.got += e.damage; this.world = world; } };
  w.events.emit("hit", hit(t));
  assert.equal(t.got, 0);
  const sys = new DamageSystem(w);
  w.events.emit("hit", hit(t, { damage: 4 }));
  assert.equal(t.got, 4);
  assert.equal(t.world, w, "onHit receives the world");
  sys.dispose();
  w.events.emit("hit", hit(t, { damage: 4 }));
  assert.equal(t.got, 4);
  const w2 = simWorld();
  disposeSystems(w2, SIM_SYSTEMS);
  const t2 = { ...t, got: 0 };
  w2.events.emit("hit", hit(t2));
  assert.equal(t2.got, 0, "disposeSystems unhooks every sim system");
});

test("HitEffects no longer applies damage: its source has no onHit call on the target", () => {
  const src = readFileSync(new URL("../src/systems/HitEffects.js", import.meta.url), "utf8");
  assert.ok(!/\.onHit\??\.?\(/.test(src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "").replace(/onHit\(e\)/g, "")), "no target.onHit( call left");
});

test("with the view systems on, the flash and glow come from the events (hit: 1, burn tick: 0.55 player / 0.8 others)", () => {
  const w = simWorld();
  w.particles = { emit() {} };
  w.lights = { add() {} };
  w.camera = { addTrauma() {} };
  w.damageNumbers = { spawn() {} };
  w.hitstop = () => {};
  createSystems(w, VIEW_SYSTEMS);
  const p = (w.player = w.spawn(new Player(mage, new Progression(mage)))),
    g = w.spawn(new Graugr(200, 0, { rng: w.rng })),
    d = w.spawn(new TrainingDummy(300, 0, { rng: w.rng }));
  for (const t of [p, g, d]) {
    w.events.emit("hit", hit(t));
    assert.equal(t.flash, 1);
    t.flash = 0;
  }
  assert.equal(d.glow, 1);
  d.glow = 0;
  for (const t of [p, g, d]) w.events.emit("burn", { type: "tick", target: t, damage: 2, x: t.x, y: t.y, z: 10 });
  assert.equal(p.flash, 0.55);
  assert.equal(g.flash, 0.8);
  assert.equal(d.flash, 0.8);
  assert.equal(d.glow, 1);
});

// ---- the same fight with and without the view systems must end in the same sim state
function fight(withViews) {
  const w = simWorld(5);
  w.player = { id: "P", x: 0, y: 0, vx: 0, vy: 0, radius: 16, height: 46, hittable: true, downed: false, stunT: 0, hp: 0, caster: { charging: false, chargeLevel: 0 }, ward: null, onHit(e) { this.hp += e.damage; }, onDot() {} };
  w.entities.push(w.player);
  if (withViews) {
    createSystems(w, VIEW_SYSTEMS);
  }
  const g = w.spawn(new Graugr(260, 0, { rng: w.rng }));
  const log = [];
  w.events.on("hit", (e) => log.push([e.target === w.player ? "P" : "G", e.damage, !!e.aoe]));
  for (let f = 0; f < 1500; f++) {
    if (!g.downed && f % 150 === 0) w.spawn(new FireballProjectile({ owner: w.player, x: 0, y: 0, z: 30, angle: Math.atan2(g.y, g.x), charge: 0.4, damage: Fireball.damage, burn: Fireball.burn }));
    step(w);
  }
  return { log, ghp: g.vitals.hp, gx: Math.round(g.x * 1e3), gy: Math.round(g.y * 1e3), downed: g.downed, php: w.player.hp, time: w.time };
}

test("the same seeded fight ends in the same sim state with and without the view systems", () => {
  const a = fight(false),
    b = fight(true);
  assert.ok(a.log.some((l) => l[0] === "G") && a.log.some((l) => l[0] === "P"), "both sides took damage, so the fight reached the damage code");
  assert.deepEqual(b, a);
});

console.log(`\n${passed} tests passed`);
