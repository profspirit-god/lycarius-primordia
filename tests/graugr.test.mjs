// Headless gameplay test for Graugr, the raid, stun and deflect. No browser, no dependencies.
//   node tests/graugr.test.mjs        (exit 0 = all passed)
// Pattern for new tests: build a stub world (events, entities, player, particles, damageNumbers, lights), step entities with a fixed dt, assert.
import assert from "node:assert/strict";
import { EventBus } from "../src/core/EventBus.js";
import { Rng } from "../src/sim/rng.js";
import { Graugr, GRAUGR } from "../src/entities/Graugr.js";
import { RaidSystem } from "../src/systems/RaidSystem.js";
import { StatusSystem } from "../src/systems/StatusSystem.js";
import { FireballProjectile } from "../src/skills/FireballProjectile.js";

const DT = 1 / 60;
function mkWorld() {
  const w = { events: new EventBus(), entities: [], banners: [], dummyGone: 0, dummyBack: 0, rng: new Rng(7) }; // S1b: gameplay dice come from world.rng
  w.particles = { emit() {} };
  w.damageNumbers = { spawn() {} };
  w.lights = { add() {} };
  w.camera = { addTrauma() {} };
  w.hitstop = () => {};
  w.spawn = (e) => (w.entities.push(e), e);
  w.removeDummy = () => w.dummyGone++;
  w.restoreDummy = () => w.dummyBack++;
  w.pushBanner = (t) => w.banners.push(t);
  w.player = { x: 0, y: 0, vx: 0, vy: 0, radius: 16, height: 46, hittable: true, downed: false, stunT: 0, hits: [],
    onHit(e) { this.hits.push({ d: e.damage, stun: !!e.stun }); } };
  w.entities.push(w.player);
  w.events.on("hit", (e) => e.target.onHit?.(e)); // stands in for the damage step of HitEffects
  w.status = new StatusSystem(w);
  return w;
}
const step = (w, n = 1) => {
  for (let i = 0; i < n; i++) {
    for (const e of w.entities.slice()) e.update?.(DT, w);
    w.entities = w.entities.filter((e) => !e.dead);
    w.status.update(DT);
  }
};
const alone = (w, g) => ((w.entities = [w.player, g]), g);
let passed = 0;
const test = (name, fn) => (fn(), passed++, console.log("ok  " + name));

test("AI mode rules", () => {
  let w = mkWorld(), g = alone(w, new Graugr(300, 0));
  step(w); assert.equal(g.mode, "attack");
  g.stamina = 12; step(w); assert.equal(g.mode, "buy"); // 24% stamina
  w = mkWorld(); g = alone(w, new Graugr(300, 0)); g.vitals.hp = 11; step(w); assert.equal(g.mode, "buy"); // 44% HP
  w = mkWorld(); g = alone(w, new Graugr(300, 0)); g.vitals.hp = 8; g.stamina = 1; step(w); assert.equal(g.mode, "retreat");
  step(w, 60 * 7); assert.equal(g.mode, "attack", "leaves retreat once stamina is above 31% and health above 50%");
});

test("stationary player takes Barrage 12, Poke 25, Leap 8 + stun", () => {
  const w = mkWorld(); alone(w, new Graugr(300, 0));
  step(w, 60 * 70);
  const h = w.player.hits;
  assert.ok(h.some((x) => x.d === 12), "barrage hit");
  assert.ok(h.some((x) => x.d === 25), "poke hit");
  assert.ok(h.every((x) => [8, 12, 25].includes(x.d)), "no other damage values: " + [...new Set(h.map((x) => x.d))]);
});

test("Leap hit stuns, stun counts down and does not stack", () => {
  const w = mkWorld(); const g = alone(w, new Graugr(200, 0));
  g.cd.poke = 99; g.cd.barrage = 99; // leave only the leap
  step(w, 3);
  assert.ok(w.player.hits.some((x) => x.d === GRAUGR.leap.damage && x.stun), "leap hit with stun");
  assert.ok(w.player.stunT > 1.3 && w.player.stunT <= GRAUGR.leap.stun);
  step(w, 60 * 2); assert.equal(w.player.stunT, 0);
});

test("dodge: leaps sideways out of a fireball's line", () => {
  const w = mkWorld(); const g = alone(w, new Graugr(400, 0)); g.cd.poke = 99; g.cd.barrage = 99;
  w.entities.push(new FireballProjectile({ owner: w.player, x: 150, y: 0, z: 30, angle: 0, charge: 0.6 }));
  step(w, 20);
  assert.ok(Math.abs(g.y) > 100, "moved sideways, y=" + g.y.toFixed(0));
  assert.ok(g.cd.leap > 0 && g.stamina < 50);
});

test("deflect rate is about 40%", () => {
  let n = 0; const N = 600, w = mkWorld();
  for (let i = 0; i < N; i++) {
    const g = new Graugr(200, 0); g.deflecting = true; w.entities = [w.player, g];
    const f = new FireballProjectile({ owner: w.player, x: 0, y: 0, z: 20, angle: 0, charge: 0.5 });
    for (let s = 0; s < 120 && !f.dead; s++) { f.update(DT, w); if (f.owner === g) { n++; break; } }
  }
  assert.ok(n / N > 0.3 && n / N < 0.5, `rate ${(n / N).toFixed(2)}`);
});

test("raid: counts, tiers, one-shot kills, stop restores the dummy", () => {
  const w = mkWorld(), r = new RaidSystem(w);
  r.start();
  let gs = w.entities.filter((e) => e.isGraugr);
  assert.equal(gs.length, 2); assert.deepEqual(gs.map((e) => e.tier), [0, 0]); assert.equal(w.dummyGone, 1);
  const hit = (t, d) => w.events.emit("hit", { source: w.player, target: t, damage: d, dir: { x: 1, y: 0 }, charge: 1 });
  hit(gs[0], 30); hit(gs[1], 10); hit(gs[1], 20);
  step(w, 60); r.update(DT);
  assert.equal(r.kills, 2); assert.equal(r.oneShots, 1);
  for (let i = 0; i < 60 * 5; i++) { step(w); r.update(DT); }
  gs = w.entities.filter((e) => e.isGraugr);
  assert.equal(r.number, 2); assert.equal(gs.length, 3); assert.equal(gs[0].tier, 1); assert.equal(gs[0].vitals.maxHp, 30);
  r.stop(); assert.equal(w.dummyBack, 1);
});

console.log(`\n${passed} tests passed`);
