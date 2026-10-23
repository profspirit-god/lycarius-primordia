// S1f-a (V1.12.0.05): the Fireball projectile is simulation only; its look lives in view/FireballView.js. No browser, no dependencies.
//   node tests/projectile-view.test.mjs        (exit 0 = all passed)
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { EventBus } from "../src/core/EventBus.js";
import { Rng } from "../src/sim/rng.js";
import { Entity } from "../src/entities/Entity.js";
import { FireballProjectile } from "../src/skills/FireballProjectile.js";
import { Fireball } from "../src/skills/Fireball.js";
import { ParticleSystem, scaled as n } from "../src/systems/ParticleSystem.js";
import { Lights } from "../src/systems/Lights.js";
import { SIM_SYSTEMS, VIEW_SYSTEMS } from "../src/systems/pipeline.js";
import { VIEWS } from "../src/view/index.js";
import { EntityViews } from "../src/view/EntityViews.js";
import { FireballView } from "../src/view/FireballView.js";
import { DT, capture } from "./helpers.mjs";

let passed = 0;
const test = (name, fn) => (fn(), passed++, console.log("ok  " + name));

/** A presentation stand-in that throws on any use: the sim must never touch it (R5). */
const banned = (what) => new Proxy({}, { get: (_, k) => { throw new Error(`sim touched ${what}.${String(k)}`); } });
function simWorld(seed = 1) {
  const w = { events: new EventBus(), entities: [], rng: new Rng(seed), time: 0 };
  w.particles = banned("particles"); w.lights = banned("lights"); w.damageNumbers = banned("damageNumbers"); w.camera = banned("camera"); w.audio = banned("audio");
  w.spawn = (e) => (w.entities.push(e), e);
  return w;
}
function stepSim(w, frames = 1) {
  for (let i = 0; i < frames; i++) {
    w.time += DT;
    for (const e of w.entities.slice()) e.update?.(DT, w);
    w.entities = w.entities.filter((e) => !e.dead);
  }
}
const ball = (o = {}) => new FireballProjectile({ owner: o.owner ?? { id: "A" }, x: 0, y: 0, z: 30, angle: 0, charge: 0.5, damage: Fireball.damage, burn: Fireball.burn, ...o });
const body = (x) => ({ x, y: 0, z: 0, radius: 24, height: 60, hittable: true, dead: false, update() {}, draw() {} });
/** Stub of a presentation world for the view: records what the view asks for. */
function viewWorld() {
  const w = { events: new EventBus(), entities: [] };
  w.emits = []; w.adds = [];
  w.particles = { emit: (p) => w.emits.push(p) };
  w.lights = { add: (l) => w.adds.push(l) };
  return w;
}
/** Canvas stand-in: every call is a no-op that rejects NaN / Infinity; gradients accept colour stops. */
function ctxStub(log = []) {
  const bad = (a) => typeof a === "number" && !Number.isFinite(a);
  const grad = { addColorStop() {} };
  return new Proxy({}, {
    get: (t, k) => (k in t ? t[k] : (...args) => { assert.ok(!args.some(bad), `${String(k)} got a non-finite argument: ${args}`); log.push(String(k)); return /Gradient/.test(String(k)) ? grad : undefined; }),
    set: (t, k, v) => ((t[k] = v), true),
  });
}

test("a fireball runs its whole life with no presentation object in the world: range, body, shield, clash", () => {
  // range: flies 1200 px and fizzles
  let w = simWorld();
  const fizz = capture(w, "projectile:fizzle");
  w.spawn(ball({ charge: 0.3 }));
  stepSim(w, 200);
  assert.equal(w.entities.length, 0, "the ball is gone");
  assert.equal(fizz.length, 1, "fizzled once");
  // body
  w = simWorld(2);
  const hits = capture(w, "hit");
  w.spawn(ball({ charge: 0.8 })); w.spawn(body(300));
  stepSim(w, 60);
  assert.equal(hits.length, 1);
  assert.ok(hits[0].damage > 0);
  // shield
  w = simWorld(3);
  const foe = { id: "F" };
  w.spawn(ball({ charge: 0.9 }));
  w.spawn({ isShield: true, owner: foe, x: 300, y: 0, dead: false, blocks: (x) => x > 280, absorb: () => 0, update() {}, draw() {} });
  stepSim(w, 60);
  assert.ok(!w.entities.some((e) => e.isProjectile), "the shield soaked it");
  // clash
  w = simWorld(4);
  const boom = capture(w, "explosion");
  w.spawn(ball({ x: -200, charge: 1 })); w.spawn(ball({ owner: foe, x: 200, angle: Math.PI, charge: 0.4 }));
  stepSim(w, 60);
  assert.equal(boom.length, 1, "one explosion");
  assert.equal(w.entities.filter((e) => e.isProjectile).length, 1, "the stronger ball survives");
});

test("projectile:fizzle carries plain data only and the ball is dead when it fires", () => {
  const w = simWorld();
  const log = capture(w, "projectile:fizzle");
  const b = w.spawn(ball({ charge: 0.6 }));
  stepSim(w, 200);
  assert.equal(log.length, 1);
  assert.deepEqual(Object.keys(log[0]).sort(), ["charge", "kind", "x", "y", "z"]);
  assert.equal(log[0].kind, "fireball");
  assert.deepEqual(JSON.parse(JSON.stringify(log[0])), log[0], "survives a JSON round trip (R8)");
  assert.ok(b.dead);
  assert.ok(log[0].x > 1200 - 1 && log[0].x < 1300, "fired where the range ran out");
});

test("FireballProjectile.js has no presentation, clock or visual randomness left", () => {
  const src = readFileSync(new URL("../src/skills/FireballProjectile.js", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.ok(!/\b(?:particles|lights|damageNumbers|toasts)\.|\bctx\b|\bcamera\b|\bhitstop\b|\.audio\b/.test(src), "no presentation call");
  assert.ok(!/Math\.random|\brand\(|performance\.now|Date\.now/.test(src), "no visual random or clock");
  assert.ok(!/\bdraw\s*\(|\btrail\b|\bfizzle\s*\(/.test(src), "no draw, trail or fizzle method");
  assert.equal(new FireballProjectile({ owner: {}, x: 0, y: 0, z: 0, angle: 0, charge: 0.5 }).kind, "fireball");
});

test("FireballView.tick: embers scale with the charge, one one-frame light, a trail aged and culled at 0.32 s", () => {
  const w = viewWorld(), v = new FireballView(w);
  const weak = ball({ charge: 0 }), strong = ball({ charge: 1, y: 100 });
  v.tick(weak, DT);
  const embersWeak = w.emits.filter((p) => p.gravity === 750).length;
  assert.equal(embersWeak, n(2));
  assert.deepEqual(w.adds.map((l) => [l.radius, l.once, l.life, l.intensity]), [[130, true, 1, 0.85]]);
  w.emits.length = 0; w.adds.length = 0;
  v.tick(strong, DT);
  assert.equal(w.emits.filter((p) => p.gravity === 750).length, n(7));
  assert.equal(w.adds[0].radius, 280);
  for (let i = 0; i < 59; i++) v.tick(strong, DT);
  const trail = v.stateOf(strong).trail;
  assert.ok(trail.length >= 18 && trail.length <= 20, "about 0.32 s of points at 60 Hz: " + trail.length);
  assert.ok(trail.every((p) => p.age < 0.32));
  assert.ok(Math.abs(v.stateOf(strong).t - 60 * DT) < 1e-9, "flicker clock advanced by dt");
  assert.equal(v.stateOf(weak).trail.length, 1, "each ball keeps its own trail");
});

test("FireballView: the fizzle burst is n(20) sparks at the point; a stranger's kind is ignored; dispose unhooks it", () => {
  const w = viewWorld(), v = new FireballView(w);
  w.events.emit("projectile:fizzle", { kind: "fireball", x: 10, y: 20, z: 30, charge: 0.5 });
  assert.equal(w.emits.length, n(20));
  assert.ok(w.emits.every((p) => p.x === 10 && p.y === 20 && p.z === 30));
  w.emits.length = 0;
  w.events.emit("projectile:fizzle", { kind: "other", x: 0, y: 0, z: 0, charge: 0 });
  assert.equal(w.emits.length, 0);
  v.dispose();
  w.events.emit("projectile:fizzle", { kind: "fireball", x: 0, y: 0, z: 0, charge: 0 });
  assert.equal(w.emits.length, 0, "no listener after dispose");
});

test("FireballView.draw: finite arguments, trail strokes, glow, composite mode restored (also with the real particle and light systems)", () => {
  const w = viewWorld(), v = new FireballView(w);
  const b = ball({ charge: 0.7 });
  for (let i = 0; i < 12; i++) { b.x += 12; v.tick(b, DT); }
  const log = [], ctx = ctxStub(log);
  v.draw(ctx, b);
  assert.equal(log.filter((k) => k === "stroke").length, 11, "one stroke per trail segment");
  assert.ok(log.includes("fill") && log.includes("arc") && log.includes("ellipse"));
  assert.equal(ctx.globalCompositeOperation, "source-over");
  v.draw(ctx, ball()); // a ball never ticked still draws (empty trail)
  const real = { events: new EventBus(), entities: [], particles: new ParticleSystem(), lights: new Lights() };
  const rv = new FireballView(real);
  rv.tick(b, DT); real.events.emit("projectile:fizzle", { kind: "fireball", x: 0, y: 0, z: 0, charge: 1 });
  real.particles.update(DT); real.lights.update(DT);
});

test("EntityViews: a view by kind ticks and draws, other kinds draw themselves, dispose disposes every view", () => {
  const w = viewWorld();
  const log = [];
  class Stub { constructor() { log.push("new"); } tick(e, dt) { log.push(["tick", e.name, dt]); } draw(ctx, e) { log.push(["draw", e.name]); } dispose() { log.push("dispose"); } }
  VIEWS.stubkind = Stub;
  try {
    const own = new Entity(); own.name = "own"; own.draw = () => log.push(["self", "own"]);
    const viewed = new Entity(); viewed.name = "viewed"; viewed.kind = "stubkind"; viewed.draw = () => log.push("wrong");
    w.entities.push(own, viewed);
    const ev = new EntityViews(w);
    ev.update(0.5); ev.draw({}, own); ev.draw({}, viewed); ev.dispose();
    assert.deepEqual(log, ["new", ["tick", "viewed", 0.5], ["self", "own"], ["draw", "viewed"], "dispose"]);
  } finally {
    delete VIEWS.stubkind;
  }
  assert.ok(VIEWS.fireball === FireballView, "the fireball is registered");
});

test("the pipeline lists entityViews as a view system, after every sim system; the scene ticks and draws through it", () => {
  const names = [...SIM_SYSTEMS, ...VIEW_SYSTEMS].map(([n]) => n);
  assert.ok(names.indexOf("entityViews") > names.indexOf("xp"));
  assert.ok(VIEW_SYSTEMS.some(([n]) => n === "entityViews"));
  const src = readFileSync(new URL("../src/scenes/WorldScene.js", import.meta.url), "utf8").replace(/\r/g, "");
  const upd = src.indexOf("for (const e of list) e.update(edt, this);"), views = src.indexOf("this.entityViews.update(edt)"), filt = src.indexOf("this.entities = this.entities.filter((e) => !e.dead);");
  assert.ok(upd > 0 && upd < views && views < filt, "views tick after the entities ran and before the dead are removed");
  assert.ok(src.includes("this.entityViews.draw(ctx, e)") && !/\be\.draw\(ctx, this\)/.test(src), "entities are drawn through the views");
});

function fight(withView) {
  const w = simWorld(9), log = [];
  const w2 = withView ? Object.assign(w, { particles: new ParticleSystem(), lights: new Lights() }) : w;
  const views = withView ? new EntityViews(w2) : null;
  w.events.on("hit", (e) => log.push(["hit", e.damage, e.crit, Math.round(e.x)]));
  w.events.on("projectile:fizzle", (e) => log.push(["fizzle", Math.round(e.x)]));
  w.spawn(body(500));
  const me = { id: "P" };
  for (let f = 0; f < 400; f++) {
    // every other ball (angle 0.3) misses the body and fizzles at the end of its range
    if (f % 40 === 0) w.spawn(ball({ owner: me, charge: (f / 40 % 5) / 4, angle: f % 80 === 0 ? 0 : 0.3, damage: Fireball.damage, burn: Fireball.burn }));
    w.time += DT;
    for (const e of w.entities.slice()) e.update?.(DT, w);
    if (views) views.update(DT);
    w.entities = w.entities.filter((e) => !e.dead);
    if (withView) { w.particles.update(DT); w.lights.update(DT); }
  }
  return { log, left: w.entities.length, time: w.time, rng: w.rng.state?.() };
}

test("the same seeded volley ends in the same sim state with and without the view", () => {
  const a = fight(false), b = fight(true);
  assert.ok(a.log.some((l) => l[0] === "hit") && a.log.some((l) => l[0] === "fizzle"), "the volley hits and fizzles, so both code paths ran");
  assert.deepEqual(b, a);
});

console.log(`\n${passed} tests passed`);
