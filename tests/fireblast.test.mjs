// Headless test for Fire Blast: damage, range, knockback, burn offer, cost, cooldown, cast time, modifiers, AI exclusion.
//   node tests/fireblast.test.mjs        (exit 0 = all passed)
import assert from "node:assert/strict";
import "../src/content/index.js"; // registers skills and classes
import { EventBus } from "../src/core/EventBus.js";
import { Rng } from "../src/sim/rng.js";
import { ScriptedRng } from "./helpers.mjs";
import { SkillCaster } from "../src/systems/SkillCaster.js";
import { StatusSystem } from "../src/systems/StatusSystem.js";
import { Vitals } from "../src/systems/Vitals.js";
import { FireBlast } from "../src/skills/FireBlast.js";
import { Mage } from "../src/classes/Mage.js";
import { SkillRegistry } from "../src/skills/SkillRegistry.js";
import { TrainingDummy } from "../src/entities/TrainingDummy.js";
import { BlastFx } from "../src/systems/BlastFx.js";
import { Player } from "../src/entities/Player.js";
import { ParticleSystem } from "../src/systems/ParticleSystem.js";
import { Lights } from "../src/systems/Lights.js";
import { Camera } from "../src/systems/Camera.js";

const DT = 1 / 60;
function mkWorld() {
  const w = { events: new EventBus(), entities: [], rng: new Rng(1) };
  w.spawn = (e) => (w.entities.push(e), e);
  w.hits = [];
  w.blasts = [];
  w.events.on("hit", (e) => w.hits.push(e));
  w.events.on("blast", (e) => w.blasts.push(e));
  w.status = new StatusSystem(w);
  return w;
}
const mkTarget = (w, x, y, radius = 20) => {
  const t = { x, y, radius, height: 60, hittable: true, dead: false, knocks: [], applyImpulse(a, b) { this.knocks.push([a, b]); } };
  w.entities.push(t);
  return t;
};
function mkCaster(w, { mana = 100, mods = null } = {}) {
  const o = { x: 0, y: 0, radius: 16, height: 46, aim: 0, vitals: new Vitals(Mage.stats), mods, hold: false, kick: 0, lowManaFlash: 0, hittable: true,
    applyImpulse() {}, getCastOrigin() { return { x: 0, y: 0, z: 30 }; }, wantsCast() { return this.hold; } };
  o.vitals.mana = mana;
  o.caster = new SkillCaster(o, ["fireBlast"], {});
  w.entities.push(o);
  return o;
}
const run = (w, o, secs) => { for (let i = 0; i < Math.round(secs / DT); i++) o.caster.update(DT, w); };
const cast = (w, o) => { o.hold = true; run(w, o, 0.7); o.hold = false; run(w, o, 0.1); };
let passed = 0;
const test = (name, fn) => (fn(), passed++, console.log("ok  " + name));

test("registered, Mage unlocks it at specialization level 8 with key R", () => {
  assert.equal(FireBlast.cooldown, 60);
  assert.equal(FireBlast.manaCost(), 40);
  assert.ok(Mage.skills.includes("fireBlast"));
  assert.equal(Mage.specialization.unlocks[8], "fireBlast");
  assert.deepEqual(Mage.bindings.fireBlast, ["KeyR"]);
});

test("deals 70 to targets in range, none outside, never to the caster", () => {
  const w = mkWorld(), o = mkCaster(w);
  const near = mkTarget(w, 100, 0), edge = mkTarget(w, 0, 255, 20), far = mkTarget(w, 0, -270, 20);
  cast(w, o);
  assert.equal(w.blasts.length, 1);
  const by = (t) => w.hits.find((h) => h.target === t);
  assert.equal(by(near).damage, 70);
  assert.equal(by(edge).damage, 70, "body edge inside the 240 px radius");
  assert.equal(by(far), undefined, "body edge outside the radius");
  assert.equal(w.hits.some((h) => h.target === o), false);
  assert.ok(w.hits.every((h) => h.aoe === true && h.crit === false && h.damage === 70));
});

test("knockback: radial impulse of 1500 px/s away from the caster", () => {
  const w = mkWorld(), o = mkCaster(w);
  const t = mkTarget(w, 0, 150);
  cast(w, o);
  assert.equal(t.knocks.length, 1);
  assert.ok(Math.abs(t.knocks[0][0]) < 1e-6 && Math.abs(t.knocks[0][1] - 1500) < 1e-6);
});

test("target on the caster's centre gets a defined direction (aim)", () => {
  const w = mkWorld(), o = mkCaster(w);
  const t = mkTarget(w, 0, 0);
  cast(w, o);
  assert.ok(Number.isFinite(t.knocks[0][0]) && Number.isFinite(t.knocks[0][1]));
});

test("burn offer: 40% chance, 6 s, ignition goes through StatusSystem", () => {
  const w = mkWorld(), o = mkCaster(w);
  const t = mkTarget(w, 100, 0);
  {
    w.rng = new ScriptedRng(0.9); // the live StatusSystem must not ignite during the cast itself
    cast(w, o);
    assert.deepEqual(w.hits[0].burn, { chance: 0.4, duration: 6, dps: 8 });
    assert.equal(t.burn ?? null, null);
    w.rng = new ScriptedRng(0.1); // below 0.4 -> ignites
    w.status.onHit(w.hits[0]);
    assert.ok(t.burn && t.burn.dur === 6);
    t.burn = null;
    w.rng = new ScriptedRng(0.9);
    w.status.onHit(w.hits[0]);
    assert.equal(t.burn ?? null, null);
  }
});

test("cost 40 mana at completion, cooldown 60 s, cooldown modifier applies", () => {
  const w = mkWorld(), o = mkCaster(w, { mana: 100 });
  cast(w, o);
  assert.ok(Math.abs(o.vitals.mana - 60) < 0.5, "40 spent (plus a little regen): " + o.vitals.mana);
  const slot = o.caster.slots[0];
  assert.ok(slot.cooldown > 59 && slot.cdMax === 60);
  const before = w.blasts.length;
  cast(w, o);
  assert.equal(w.blasts.length, before, "blocked during the cooldown");
  const w2 = mkWorld(), o2 = mkCaster(w2, { mods: { cooldownMult: 0.5, castTimeMult: 1, skillDamage: 0, elementDamage: 0, element: "fire" } });
  cast(w2, o2);
  assert.equal(o2.caster.slots[0].cdMax, 30);
});

test("not enough mana: no cast; releasing before the cast completes: no cast, no cost", () => {
  let w = mkWorld(), o = mkCaster(w, { mana: 39 });
  o.vitals.manaRegen = 0;
  cast(w, o);
  assert.equal(w.blasts.length, 0);
  assert.ok(o.lowManaFlash > 0 || o.vitals.mana < 40);
  w = mkWorld(); o = mkCaster(w);
  o.hold = true; run(w, o, 0.3); o.hold = false; run(w, o, 0.2);
  assert.equal(w.blasts.length, 0);
  assert.ok(o.vitals.mana >= 100 - 1e-6);
});

test("skill and element damage multiply: 70 x 1.1 x 1.1 = 85", () => {
  const w = mkWorld(), o = mkCaster(w, { mods: { cooldownMult: 1, castTimeMult: 1, skillDamage: 0.1, elementDamage: 0.1, element: "fire" } });
  mkTarget(w, 100, 0);
  cast(w, o);
  assert.equal(w.hits[0].damage, 85);
  assert.ok(Math.abs(w.hits[0].burn.dps - 8.8) < 1e-9, "element damage also boosts the burn");
});

test("fire ward reduces the damage and reports it as resisted", () => {
  const w = mkWorld(), o = mkCaster(w);
  const t = mkTarget(w, 100, 0);
  t.ward = { resist: (d) => Math.round(d * 0.7), tryNullify: () => false };
  cast(w, o);
  assert.equal(w.hits[0].damage, 49);
  assert.equal(w.hits[0].resisted, 21);
});

test("downed / dead targets are skipped", () => {
  const w = mkWorld(), o = mkCaster(w);
  const a = mkTarget(w, 100, 0), b = mkTarget(w, -100, 0);
  a.hittable = false; b.dead = true;
  cast(w, o);
  assert.equal(w.hits.length, 0);
});

test("the hostile dummy never receives Fire Blast (noAi)", () => {
  const d = new TrainingDummy(300, 0, { attack: true, cls: Mage, skills: true });
  assert.equal(d.caster.has("fireBlast"), false);
  assert.ok(d.caster.has("burnResistance") && d.caster.has("flameShield"));
});

test("BlastFx emits finite particle numbers and a bounded amount", () => {
  const w = mkWorld(), seen = [];
  w.particles = { emit: (p) => seen.push(p) };
  w.lights = { add: (l) => seen.push(l) };
  w.camera = { trauma: 0, addTrauma(v) { this.trauma += v; } };
  w.hitstop = () => {};
  w.player = { x: 50, y: 0 };
  const fx = new BlastFx(w);
  w.events.emit("blast", { source: w.player, x: 0, y: 0, z: 23, radius: 240, element: "fire", kind: "fireBlast" });
  assert.ok(seen.length > 100 && seen.length < 600, "particle count " + seen.length);
  for (const p of seen) for (const v of Object.values(p)) if (typeof v === "number") assert.ok(Number.isFinite(v), JSON.stringify(p));
  assert.ok(w.camera.trauma > 0 && w.camera.trauma <= 1);
  fx.dispose();
});

/** Canvas stand-in: every method is a no-op that rejects NaN / Infinity arguments; gradients accept colour stops. */
function mkCtx() {
  const bad = [];
  const ctx = new Proxy({}, {
    get: (t, k) => {
      if (k === "bad") return bad;
      if (k === "createRadialGradient" || k === "createLinearGradient") return () => ({ addColorStop() {} });
      if (k in t) return t[k];
      return (...a) => { for (const v of a) if (typeof v === "number" && !Number.isFinite(v)) bad.push(String(k)); };
    },
    set: (t, k, v) => ((t[k] = v), true),
  });
  return ctx;
}

test("regression: the player draws while charging and while holding Fire Blast (V1.11.1.00 crash on R)", () => {
  const p = new Player(Mage);
  p.x = 100; p.y = 100;
  const slot = p.caster.slots.find((s) => s.skill.id === "fireBlast");
  assert.ok(slot, "the player owns Fire Blast without a progression object");
  assert.ok(slot.skill.palette, "a self skill must carry its own circle palette");
  for (const charge of [0, 0.3, 1]) {
    slot.charging = true; slot.charge = charge; slot.t = charge * 0.5;
    const ctx = mkCtx();
    p.draw(ctx);
    assert.deepEqual(ctx.bad, [], "non-finite draw arguments at charge " + charge);
  }
  slot.charging = false;
  p.draw(mkCtx());
});

test("every self skill of the class has a palette (draw code reads palette.main)", () => {
  for (const id of Mage.skills) {
    const sk = SkillRegistry.get(id);
    if (sk.self) assert.ok(sk.palette?.main && sk.palette?.core && sk.palette?.deep, id + " has no complete palette");
  }
});

test("integration: a full cast with the real particles, lights and camera updates and renders 2 s without a bad value", () => {
  const w = mkWorld();
  w.input = { isDown: () => false, wasPressed: () => false };
  w.particles = new ParticleSystem(); w.lights = new Lights(); w.camera = new Camera(); w.hitstop = () => {};
  const p = new Player(Mage);
  p.x = 0; p.y = 0; p.vitals.mana = 100;
  w.player = p; w.entities.push(p);
  new BlastFx(w);
  const t = mkTarget(w, 120, 0);
  const slot = p.caster.slots.find((s) => s.skill.id === "fireBlast");
  p.wantsCast = (s) => s === slot; // key held
  for (let i = 0; i < 150; i++) {
    p.caster.update(DT, w);
    w.particles.update(DT); w.lights.update(DT); w.camera.update(DT, p);
    const ctx = mkCtx();
    p.draw(ctx); w.particles.render(ctx); w.lights.render(ctx);
    assert.deepEqual(ctx.bad, [], "frame " + i);
  }
  assert.equal(w.blasts.length, 1, "exactly one blast: holding R does not recast");
  assert.ok(w.hits.some((h) => h.target === t && h.damage === 70));
  assert.ok(slot.cooldown > 55, "cooldown running");
});

console.log(`\n${passed} tests passed`);
