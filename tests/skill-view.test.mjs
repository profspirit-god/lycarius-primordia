// S1f-b (V1.12.0.06): the Fireball skill is simulation only; its charge and release look lives in view/FireballCastView.js,
// fed by `skill:charging` (SkillCaster) and `cast` through SkillViews. No browser, no dependencies.
//   node tests/skill-view.test.mjs        (exit 0 = all passed)
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import "../src/content/index.js";
import { Mage } from "../src/classes/Mage.js";
import { EventBus } from "../src/core/EventBus.js";
import { Rng } from "../src/sim/rng.js";
import { Vitals } from "../src/systems/Vitals.js";
import { SkillCaster } from "../src/systems/SkillCaster.js";
import { Fireball } from "../src/skills/Fireball.js";
import { ParticleSystem, scaled as n } from "../src/systems/ParticleSystem.js";
import { Lights } from "../src/systems/Lights.js";
import { Camera } from "../src/systems/Camera.js";
import { SIM_SYSTEMS, VIEW_SYSTEMS } from "../src/systems/pipeline.js";
import { SKILL_VIEWS } from "../src/view/index.js";
import { SkillViews } from "../src/view/SkillViews.js";
import { FireballCastView } from "../src/view/FireballCastView.js";
import { DT, capture } from "./helpers.mjs";

let passed = 0;
const test = (name, fn) => (fn(), passed++, console.log("ok  " + name));

/** A presentation stand-in that throws on any use: the sim must never touch it (R5). */
const banned = (what) => new Proxy({}, { get: (_, k) => { throw new Error(`sim touched ${what}.${String(k)}`); } });
function simWorld(seed = 1) {
  const w = { events: new EventBus(), entities: [], rng: new Rng(seed), time: 0 };
  w.particles = banned("particles"); w.lights = banned("lights"); w.camera = banned("camera"); w.damageNumbers = banned("damageNumbers"); w.audio = banned("audio");
  w.spawn = (e) => (w.entities.push(e), e);
  return w;
}
/** A caster owner with just enough surface for SkillCaster and Fireball (kick starts at 0 and only a view may change it). */
function mkOwner(mana = 100) {
  const o = { x: 40, y: -20, z: 0, radius: 16, aim: 0.7, mods: null, kick: 0, lowManaFlash: 0, hold: new Set(), impulses: [] };
  o.vitals = new Vitals({ ...Mage.stats, hpRegen: 0, manaRegen: 0 });
  o.vitals.mana = mana;
  o.wantsCast = (s) => o.hold.has(s.skill.id);
  o.getCastOrigin = () => ({ x: o.x + Math.cos(o.aim) * 28, y: o.y + Math.sin(o.aim) * 28, z: 32 });
  o.applyImpulse = (x, y) => o.impulses.push([x, y]);
  o.caster = new SkillCaster(o, ["fireball"], {});
  return o;
}
/** Hold the Fireball key for k frames (the first is the start frame), then let go for the release frame. */
function cast(w, o, k) {
  o.hold.add("fireball");
  for (let i = 0; i < k; i++) o.caster.update(DT, w);
  o.hold.delete("fireball");
  o.caster.update(DT, w);
}
/** Stub presentation world for the views: records what they ask for. */
function viewWorld() {
  const w = { events: new EventBus(), entities: [], emits: [], adds: [], trauma: [] };
  w.particles = { emit: (p) => w.emits.push(p) };
  w.lights = { add: (l) => w.adds.push(l) };
  w.camera = { addTrauma: (t) => w.trauma.push(t) };
  return w;
}
/** Run fn with a constant Math.random (the views' visual dice), then restore it. */
function withRandom(v, fn) {
  const real = Math.random;
  Math.random = () => v;
  try { return fn(); } finally { Math.random = real; }
}

test("a Fireball cast runs through SkillCaster with no presentation object in the world: charge events, release, cost, ball, recoil", () => {
  const w = simWorld(), o = mkOwner();
  const charging = capture(w, "skill:charging"), casts = capture(w, "cast");
  cast(w, o, 30); // 30 / 78 = 0.385 of a charge
  assert.equal(charging.length, 29, "one event per step the key is held after the start frame");
  assert.deepEqual(Object.keys(charging[0]).sort(), ["aim", "charge", "origin", "owner", "skill"]);
  assert.equal(charging[0].skill, "fireball");
  assert.deepEqual(Object.keys(charging[0].origin).sort(), ["x", "y", "z"]);
  assert.ok(charging[28].charge > charging[0].charge, "the charge rises");
  assert.equal(casts.length, 1);
  assert.deepEqual(Object.keys(casts[0]).sort(), ["aim", "charge", "origin", "owner", "skill"]);
  assert.equal(casts[0].skill, Fireball);
  assert.equal(casts[0].aim, 0.7);
  assert.deepEqual(casts[0].origin, o.getCastOrigin());
  assert.ok(w.entities.some((e) => e.isProjectile), "the ball was spawned");
  assert.equal(o.vitals.mana, 100 - Fireball.manaCost(casts[0].charge));
  assert.equal(o.impulses.length, 1, "recoil is a sim impulse");
  assert.equal(o.kick, 0, "the lean is a view field: the sim never sets it");
});

test("Fireball.js has no presentation, visual random or charge hook left", () => {
  const src = readFileSync(new URL("../src/skills/Fireball.js", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.ok(!/\b(?:particles|lights|damageNumbers|toasts)\.|\bctx\b|\bcamera\b|\bhitstop\b|\.audio\b/.test(src), "no presentation call");
  assert.ok(!/Math\.random|\brand\(|performance\.now|Date\.now/.test(src), "no visual random or clock");
  assert.ok(!/\bonCharging\b|\.kick\b/.test(src), "no charge look, no lean");
  assert.equal(Fireball.onCharging, undefined);
});

test("SkillViews: events go to the view of that skill id, anything else is ignored, dispose unhooks", () => {
  const w = viewWorld(), log = [];
  class Stub { constructor() { log.push("new"); } charging(e) { log.push(["charging", e.charge]); } cast(e) { log.push(["cast", e.charge]); } dispose() { log.push("dispose"); } }
  SKILL_VIEWS.stubskill = Stub;
  try {
    const sv = new SkillViews(w);
    w.events.emit("skill:charging", { skill: "stubskill", charge: 0.25 });
    w.events.emit("skill:charging", { skill: "other", charge: 0.5 }); // no view: ignored
    w.events.emit("cast", { skill: { id: "stubskill" }, charge: 0.75 });
    w.events.emit("cast", { owner: {}, charge: 1 }); // no skill (XpSystem tests emit this): ignored
    w.events.emit("cast", { skill: { id: "other" }, charge: 1 });
    sv.dispose();
    w.events.emit("skill:charging", { skill: "stubskill", charge: 0.9 });
    assert.deepEqual(log, ["new", ["charging", 0.25], ["cast", 0.75], "dispose"]);
  } finally {
    delete SKILL_VIEWS.stubskill;
  }
  assert.ok(SKILL_VIEWS.fireball === FireballCastView, "the fireball is registered");
});

test("FireballCastView.charging: rune mote, spiral embers scaled by charge, a drip above 0.45, and the one-frame charge light", () => {
  const owner = { x: 100, y: 50, radius: 16 }, origin = { x: 130, y: 60, z: 32 };
  const low = viewWorld(), v = new FireballCastView(low);
  withRandom(0.3, () => v.charging({ owner, charge: 0.2, origin }));
  assert.equal(low.emits.filter((p) => p.gravity === -40).length, 1, "rune mote (0.3 < 0.4 + charge)");
  assert.equal(low.emits.filter((p) => p.gravity === 0 && p.drag === 0).length, n(1 + 0.2 * 4), "spiral embers");
  assert.equal(low.emits.filter((p) => p.gravity === 800).length, 0, "no drip at charge 0.2");
  assert.deepEqual(low.adds.map((l) => [l.x, l.y, l.z, l.radius, l.intensity, l.once, l.life]), [[130, 60, 32, 70 + 0.2 * 130, 0.4 + 0.2 * 0.5, true, 1]]);
  const high = viewWorld(), v2 = new FireballCastView(high);
  withRandom(0.3, () => v2.charging({ owner, charge: 0.8, origin }));
  assert.equal(high.emits.filter((p) => p.gravity === 800).length, 1, "hot ember drips at charge 0.8 (0.3 < 0.4)");
  assert.equal(high.emits.filter((p) => p.gravity === 0 && p.drag === 0).length, n(1 + 0.8 * 4));
  const none = viewWorld(), v3 = new FireballCastView(none);
  withRandom(0.99, () => v3.charging({ owner, charge: 0.2, origin }));
  assert.equal(none.emits.filter((p) => p.gravity === -40).length, 0, "the mote is a dice roll");
  assert.equal(none.trauma.length, 0, "charging never shakes the camera");
});

test("FireballCastView.cast: lean, camera shake, ring of sparks, ground ring, muzzle flash fanned around the aim, flash light", () => {
  const w = viewWorld(), v = new FireballCastView(w);
  const owner = { x: 100, y: 50, radius: 16, kick: 0 }, origin = { x: 130, y: 60, z: 32 }, aim = 1.2, charge = 0.5;
  v.cast({ owner, charge, aim, origin });
  assert.ok(Math.abs(owner.kick - 1.15) < 1e-9, "kick = 0.7 + 0.9 x charge");
  assert.deepEqual(w.trauma.map((t) => Math.round(t * 1e6) / 1e6), [0.27]);
  const sparks = w.emits.filter((p) => p.gravity === 700), muzzle = w.emits.filter((p) => p.gravity === 900), rings = w.emits.filter((p) => p.shape === "ring");
  assert.equal(sparks.length, n(18 + charge * 30));
  assert.equal(muzzle.length, n(14 + charge * 30));
  assert.equal(rings.length, 1);
  assert.ok(muzzle.every((p) => Math.abs(Math.atan2(p.vy, p.vx) - aim) <= 0.4 + 1e-9), "within 0.4 rad of the aim");
  assert.ok(muzzle.every((p) => p.x === 130 && p.y === 60 && p.z === 32), "from the cast origin");
  assert.ok(sparks.every((p) => p.z === 0 && p.shape === "spark"), "the ring discharges along the ground");
  const rr = 16 + 30 + charge * 22;
  assert.deepEqual([rings[0].x, rings[0].y, rings[0].size, rings[0].sizeEnd], [100, 50, rr * 0.8, rr * 2.2]);
  assert.deepEqual(w.adds.map((l) => [l.radius, l.intensity, l.life]), [[150 + charge * 120, 1, 0.18]]);
});

test("the full cast on the real particle, light and camera systems with the real views: no throw, the lean decays through Player's rule", () => {
  const w = { events: new EventBus(), entities: [], rng: new Rng(4), time: 0 };
  w.particles = new ParticleSystem(); w.lights = new Lights(); w.camera = new Camera();
  w.spawn = (e) => (w.entities.push(e), e);
  const views = new SkillViews(w), o = mkOwner();
  cast(w, o, 40);
  assert.ok(o.kick > 0.7, "the view leaned the caster: " + o.kick);
  for (let i = 0; i < 30; i++) { w.particles.update(DT); w.lights.update(DT); o.kick *= Math.exp(-6 * DT); }
  assert.ok(o.kick < 0.2);
  views.dispose();
});

test("the pipeline lists skillViews as a view system after the sim systems, and the caster still calls a skill's own onCharging", () => {
  const names = [...SIM_SYSTEMS, ...VIEW_SYSTEMS].map(([nm]) => nm);
  assert.ok(names.indexOf("skillViews") > names.indexOf("xp"));
  assert.ok(VIEW_SYSTEMS.some(([nm]) => nm === "skillViews"));
  const w = simWorld(), o = mkOwner();
  let hooked = 0;
  o.caster.slots[0].skill = { ...Fireball, onCharging: () => hooked++ };
  cast(w, o, 10);
  assert.equal(hooked, 9, "hold-to-charge skills that still draw from their hook keep working until their group moves out");
});

function volley(withViews) {
  const w = simWorld(8), o = mkOwner(), seen = [];
  if (withViews) Object.assign(w, { particles: new ParticleSystem(), lights: new Lights(), camera: new Camera() });
  const views = withViews ? new SkillViews(w) : null;
  w.events.on("cast", (e) => seen.push(["cast", Math.round(e.charge * 1e6), Math.round(e.aim * 1e6)]));
  for (const k of [10, 39, 78, 25]) {
    cast(w, o, k);
    o.aim += 0.8;
    for (let i = 0; i < 50; i++) o.caster.update(DT, w); // cooldown passes
    for (const e of w.entities.slice()) e.update?.(DT, w);
    w.entities = w.entities.filter((e) => !e.dead);
  }
  views?.dispose();
  return { seen, mana: o.vitals.mana, impulses: o.impulses.map((p) => p.map((x) => Math.round(x * 1e3))), balls: w.entities.map((e) => [Math.round(e.charge * 1e6), Math.round(e.x * 1e3), Math.round(e.y * 1e3)]), rng: w.rng.state?.() };
}

test("the same seeded volley of four casts ends in the same sim state with and without the views", () => {
  const a = volley(false), b = volley(true);
  assert.equal(a.seen.length, 4);
  assert.ok(a.balls.length > 0);
  assert.deepEqual(b, a);
});

console.log(`\n${passed} tests passed`);
