// S1a safety net (V1.10.0.05): characterization tests for the Mage kit and the rules around it.
//   node tests/mage.test.mjs        (exit 0 = all passed)
// These pin what the code does TODAY (numbers, rounding, ordering), on unmodified gameplay code. They are not a design
// statement: when a later phase changes a number on purpose, change the pinned value in the same commit and say so in
// the CHANGELOG. Randomness is controlled with withRandom() until S1b adds a seeded RNG; then these stubs go away.
// Not covered here on purpose: HitEffects / Player.onHit (presentation + input, split in S1d), drawing, audio.
import assert from "node:assert/strict";
import "../src/content/index.js"; // registers skills, classes, specialization bonuses
import { Fireball } from "../src/skills/Fireball.js";
import { FireballProjectile } from "../src/skills/FireballProjectile.js";
import { FlameShield } from "../src/skills/FlameShield.js";
import { FlameShieldEffect } from "../src/skills/FlameShieldEffect.js";
import { BurnResistance } from "../src/skills/BurnResistance.js";
import { BurnWardEffect } from "../src/skills/BurnWardEffect.js";
import { clashProjectiles } from "../src/skills/ProjectileClash.js";
import { Mage } from "../src/classes/Mage.js";
import { Vitals } from "../src/systems/Vitals.js";
import { SkillCaster } from "../src/systems/SkillCaster.js";
import { ExplosionSystem, explosionRadius } from "../src/systems/ExplosionSystem.js";
import { XpSystem } from "../src/systems/XpSystem.js";
import { Progression, charXpForNext, specXpForNext, MAX_CHAR_LEVEL } from "../src/progression/Progression.js";
import { computeMods, SPEC_BONUSES } from "../src/progression/SpecBonuses.js";
import { DT, mkWorld, step, capture, withRandom, memoryStorage } from "./helpers.mjs";

const store = memoryStorage();
Object.defineProperty(globalThis, "localStorage", { value: store, configurable: true, writable: true });

let passed = 0;
const test = (name, fn) => (store.clear(), fn(), passed++, console.log("ok  " + name));
const near = (a, b, eps = 1e-6, msg) => assert.ok(Math.abs(a - b) <= eps, msg ?? `${a} is not within ${eps} of ${b}`);

// ---------------------------------------------------------------- builders
const ball = (o = {}) =>
  new FireballProjectile({
    owner: o.owner ?? { id: "A" },
    x: o.x ?? 0,
    y: o.y ?? 0,
    z: o.z ?? 20,
    angle: o.angle ?? 0,
    charge: o.charge ?? 1,
    damage: Fireball.damage,
    burn: Fireball.burn,
  });
const mkTarget = (o = {}) => ({
  x: 100, y: 0, radius: 16, height: 46, hittable: true, dead: false, downed: false,
  burn: null, ward: null, stunT: 0, dots: [], onDot(e) { this.dots.push(e.damage); }, ...o,
});
const mkWard = (w, owner) =>
  new BurnWardEffect({ world: w, owner, duration: 30, nullifyChance: 0.5, burnReduction: 0.5, fireReduction: 0.3 });
const igniteHit = (w, target, burn = { chance: 1, duration: 5, dps: 8 }, source = null) =>
  w.events.emit("hit", { source, target, damage: 0, burn });

/** A caster owner with just enough surface for SkillCaster and the three Mage skills. */
function mkCaster(w, { mana = 100, mods = null } = {}) {
  const o = { x: 0, y: 0, z: 0, radius: 16, height: 46, aim: 0, mods, kick: 0, lowManaFlash: 0, shield: null, ward: null,
    downed: false, hold: new Set(), press: new Set(), impulses: [] };
  o.vitals = new Vitals({ ...Mage.stats, hpRegen: 0, manaRegen: 0 });
  o.vitals.mana = mana;
  o.wantsCast = (s) => o.hold.has(s.skill.id);
  o.wantsToggle = (s) => o.press.delete(s.skill.id); // true once per press, like Input.wasPressed
  o.getCastOrigin = () => ({ x: 28, y: 0, z: 32 });
  o.applyImpulse = (x, y) => o.impulses.push([x, y]);
  o.caster = new SkillCaster(o, ["fireball", "flameShield", "burnResistance"], Mage.bindings);
  return o;
}
const slot = (o, id) => o.caster.slots.find((s) => s.skill.id === id);
function run(w, o, n) {
  for (let i = 0; i < n; i++) {
    o.caster.update(DT, w);
    for (const e of w.entities.slice()) e.update?.(DT, w);
    w.entities = w.entities.filter((e) => !e.dead);
  }
}
/** Press and hold, then let go on frame k after the start frame (the release frame still adds one dt of charge). */
function cast(w, o, id, k) {
  o.hold.add(id);
  run(w, o, k); // start frame + (k - 1) charging frames
  o.hold.delete(id);
  run(w, o, 1); // release frame: t = k * DT
}

// ================================================================= 1. constants
test("tuning constants of the Mage kit", () => {
  assert.equal(Fireball.cooldown, 0.7);
  assert.equal(Fireball.chargeTime, 1.3);
  assert.equal(Fireball.minCharge, 0.12);
  assert.deepEqual(Fireball.damage, [8, 30]);
  assert.deepEqual(Fireball.burn, { chance: [0.2, 0.5], duration: [5, 10], dps: 8 });
  assert.deepEqual([FlameShield.cooldown, FlameShield.points, FlameShield.upkeep, FlameShield.manaCost()], [0.6, 50, 5, 10]);
  assert.deepEqual(
    [BurnResistance.cooldown, BurnResistance.chargeTime, BurnResistance.duration, BurnResistance.manaCost()],
    [1, 1.2, 30, 25],
  );
  assert.deepEqual(
    [BurnResistance.nullifyChance, BurnResistance.burnReduction, BurnResistance.fireReduction],
    [0.5, 0.5, 0.3],
  );
  assert.deepEqual(Mage.stats, {
    speed: 230, radius: 16, height: 46, maxHp: 50, maxMana: 100, hpRegen: 0.1, manaRegen: 1, maxStamina: 100, staminaRegen: 8,
  });
  assert.deepEqual(Mage.skills, ["fireball", "flameShield", "burnResistance", "fireBlast"]); // fireBlast added in V1.11.0.00
});

test("Vitals: regeneration caps, damage and spend floor at zero, dead stops regen", () => {
  const v = new Vitals(Mage.stats);
  assert.deepEqual([v.hp, v.mana, v.stamina], [50, 100, 100]);
  v.damage(20); v.spend(40); v.spendStamina(30);
  v.update(10);
  near(v.hp, 31, 1e-9); near(v.mana, 70, 1e-9); near(v.stamina, 100, 1e-9); // 0.1/s, 1/s, 8/s capped at 100
  v.update(1000);
  assert.deepEqual([v.hp, v.mana, v.stamina], [50, 100, 100]);
  v.spend(500); v.damage(500);
  assert.deepEqual([v.hp, v.mana, v.dead], [0, 0, true]);
  v.update(10);
  assert.deepEqual([v.hp, v.mana], [0, 0], "no regeneration once dead");
  assert.equal(v.spendStamina(101), false);
  assert.equal(v.stamina, 100, "a failed stamina spend takes nothing");
});

// ================================================================= 2. Fireball numbers
test("Fireball: mana cost by charge, affordable charge, start rule", () => {
  assert.deepEqual([0, 0.12, 0.2, 0.5, 1].map((c) => Fireball.manaCost(c)), [5, 7, 8, 13, 20]);
  const cap = (m) => Fireball.maxAffordableCharge(m);
  near(cap(3), 0); near(cap(5), 0); near(cap(12.9), 7 / 15); near(cap(20), 1); near(cap(100), 1);
  assert.equal(Fireball.canStart(6.9), false);
  assert.equal(Fireball.canStart(7), true);
});

test("Fireball: projectile speed and size by charge", () => {
  const stats = (c) => { const b = ball({ charge: c }); return [b.speed, b.radius, b.maxRange]; };
  assert.deepEqual(stats(0), [520, 8, 1200]);
  assert.deepEqual(stats(0.5), [710, 13.5, 1200]);
  assert.deepEqual(stats(1), [900, 19, 1200]);
});

test("Fireball: damage by charge (no crit, spread at its middle)", () => {
  const table = [[0, 8], [0.12, 9], [0.25, 12], [0.5, 17], [0.75, 23], [1, 30]];
  for (const [c, dmg] of table) {
    const r = withRandom(0.5, () => ball({ charge: c }).roll());
    assert.deepEqual(r, { damage: dmg, crit: false }, `charge ${c}`);
  }
});

test("Fireball: crit is x1.75 below a 12% roll, spread is 0.9 to 1.1, rounding is half up", () => {
  const roll = (c, seq, owner) => withRandom(seq, () => ball({ charge: c, owner }).roll());
  assert.deepEqual(roll(1, [0.05, 0.5]), { damage: 53, crit: true }); // 30 x 1.75 = 52.5 -> 53
  assert.equal(roll(1, [0.1199, 0.5]).crit, true);
  assert.equal(roll(1, [0.12, 0.5]).crit, false, "the 12% threshold is exclusive");
  assert.equal(roll(1, [0.5, 0]).damage, 27); // x0.9
  assert.equal(roll(1, [0.5, 0.999999]).damage, 33); // x1.1
  assert.equal(roll(0.5, [0.5, 0]).damage, 15); // 17 x 0.9 = 15.3
  assert.equal(roll(0.5, [0.5, 0.999999]).damage, 19); // 17 x 1.1 = 18.7
});

test("Fireball: specialization multipliers (skill damage and matching element)", () => {
  const mods = { element: "fire", elementDamage: 0.05, skillDamage: 0.1 };
  assert.equal(withRandom([0.5, 0.5], () => ball({ owner: { mods } }).roll().damage), 35); // 30 x 1.1 x 1.05 = 34.65
  const ice = { element: "ice", elementDamage: 0.5, skillDamage: 0.1 };
  assert.equal(withRandom([0.5, 0.5], () => ball({ owner: { mods: ice } }).roll().damage), 33); // element does not match
  assert.equal(withRandom([0.5, 0.5], () => ball({ owner: {} }).roll().damage), 30, "an owner without mods gets x1");
});

test("Fireball: damage is rolled once per projectile", () => {
  const b = ball();
  const first = withRandom([0.5, 0.5], () => b.roll());
  const again = withRandom([0.0, 0.0], () => b.roll());
  assert.equal(again, first);
  assert.equal(again.damage, 30);
});

test("Fireball: a clash survivor loses power (weaken)", () => {
  const b = ball({ charge: 1 });
  b.weaken(0.5);
  near(b.potency, 0.8); near(b.radius, 19 * 0.875);
  assert.equal(withRandom([0.5, 0.5], () => b.roll().damage), 24); // 30 x 0.8
  b.weaken(0.5); // already rolled: the rolled damage is scaled in place
  assert.equal(b.roll().damage, 19); // 24 x 0.8 = 19.2
  const c = ball({ charge: 1 });
  c.weaken(1);
  near(c.potency, 0.6); near(c.radius, 19 * 0.75);
});

// ================================================================= 3. Fireball in flight
test("Fireball flight: body hit event carries damage, burn chance, direction", () => {
  const w = mkWorld(), hits = capture(w, "hit"), t = mkTarget({ x: 200 });
  w.entities.push(t);
  const p = w.spawn(ball({ charge: 0.5 }));
  withRandom(0.5, () => step(w, 60));
  assert.equal(hits.length, 1);
  const h = hits[0];
  assert.equal(h.target, t);
  assert.equal(h.source, p.owner);
  assert.equal(h.damage, 17);
  assert.equal(h.crit, false);
  assert.equal(h.resisted, 0);
  assert.equal(h.charge, 0.5);
  near(h.burn.chance, 0.35); near(h.burn.duration, 7.5); assert.equal(h.burn.dps, 8);
  assert.deepEqual([h.dir.x, h.dir.y + 0], [1, 0]);
  assert.equal(p.dead, true, "the projectile is consumed by the hit");
});

test("Fireball flight: burn chance and duration scale with charge, burn dps with element damage", () => {
  const burnOf = (charge, rnd, mods) => {
    const w = mkWorld(), hits = capture(w, "hit"), t = mkTarget({ x: 120 });
    w.entities.push(t);
    w.spawn(ball({ charge, owner: { mods } }));
    withRandom(rnd, () => step(w, 30));
    return hits[0].burn;
  };
  let b = burnOf(0, 0.5);
  near(b.chance, 0.2); near(b.duration, 7.5);
  b = burnOf(1, 0.5);
  near(b.chance, 0.5);
  b = burnOf(1, 0.5, { element: "fire", elementDamage: 0.25, skillDamage: 0 });
  near(b.dps, 10); // 8 x 1.25
});

test("Fireball flight: height gate, own caster and non-hittables are skipped", () => {
  const miss = (z, over = {}) => {
    const w = mkWorld(), hits = capture(w, "hit"), t = mkTarget({ x: 150, ...over });
    w.entities.push(t);
    w.spawn(ball({ charge: 0.5, z }));
    withRandom(0.5, () => step(w, 40));
    return hits.length;
  };
  assert.equal(miss(59), 1, "z < height + radius (46 + 13.5 = 59.5) hits");
  assert.equal(miss(60), 0, "above that it flies over");
  assert.equal(miss(20, { hittable: false }), 0);
  assert.equal(miss(20, { dead: true }), 0);
  const w = mkWorld(), hits = capture(w, "hit"), owner = mkTarget({ x: 0 });
  w.entities.push(owner);
  w.spawn(ball({ charge: 0.5, owner }));
  withRandom(0.5, () => step(w, 5));
  assert.equal(hits.length, 0, "a projectile never hits its own caster");
});

test("Fireball flight: range limit 1200 then it fizzles", () => {
  const w = mkWorld(), hits = capture(w, "hit"), p = w.spawn(ball({ charge: 1 }));
  let frames = 0;
  withRandom(0.5, () => { while (!p.dead && frames < 200) (step(w, 1), frames++); });
  assert.equal(p.dead, true);
  assert.ok(p.travelled > 1200 && p.travelled <= 1215, `travelled ${p.travelled}`);
  assert.ok(frames === 80 || frames === 81, `frames ${frames}`);
  assert.equal(hits.length, 0);
});

test("Fireball flight: Burn Resistance cuts fire damage by 30% and reports it", () => {
  const w = mkWorld(), hits = capture(w, "hit"), t = mkTarget({ x: 150 });
  t.ward = mkWard(w, t);
  w.entities.push(t);
  w.spawn(ball({ charge: 1 }));
  withRandom(0.5, () => step(w, 30));
  assert.equal(hits[0].damage, 21); // 30 x 0.7
  assert.equal(hits[0].resisted, 9);
});

// ================================================================= 4. cooldowns, charging, mana (SkillCaster)
test("Fireball cast: spends mana by charge, starts the 0.7 s cooldown, recoils, emits cast", () => {
  const w = mkWorld(), o = mkCaster(w), casts = capture(w, "cast");
  withRandom(0.5, () => cast(w, o, "fireball", 39)); // 39 x DT / 1.3 = 0.5
  assert.equal(casts.length, 1);
  near(casts[0].charge, 0.5, 1e-9);
  assert.equal(casts[0].skill, Fireball);
  near(o.vitals.mana, 87, 1e-9); // cost(0.5) = 13
  const proj = w.entities.find((e) => e.isProjectile);
  assert.ok(proj);
  near(proj.charge, 0.5, 1e-9);
  near(proj.x, 28 + 710 * DT, 1e-6); // spawned at the cast origin (28, 0, 32), then moved one frame by run()
  assert.deepEqual([proj.y, proj.z], [0, 32]);
  near(slot(o, "fireball").cooldown, 0.7, 1e-9);
  near(o.impulses[0][0], -275, 1e-6); // -(130 + 290 x 0.5)
  near(Math.abs(o.impulses[0][1]), 0, 1e-9);
  near(o.kick, 1.15, 1e-9); // 0.7 + 0.9 x 0.5
});

test("Fireball cast: charge below 0.12 releases nothing and costs nothing", () => {
  const w = mkWorld(), o = mkCaster(w), casts = capture(w, "cast");
  withRandom(0.5, () => cast(w, o, "fireball", 9)); // 9 / 78 = 0.115
  assert.equal(casts.length, 0);
  assert.equal(o.vitals.mana, 100);
  assert.equal(slot(o, "fireball").cooldown, 0, "no cooldown for a cancelled charge");
  withRandom(0.5, () => cast(w, o, "fireball", 10)); // 10 / 78 = 0.128
  assert.equal(casts.length, 1, "10 frames is the shortest cast");
});

test("Fireball cast: full charge caps at 1 and costs 20; no auto-release", () => {
  const w = mkWorld(), o = mkCaster(w), casts = capture(w, "cast");
  o.hold.add("fireball");
  withRandom(0.5, () => run(w, o, 200));
  assert.equal(casts.length, 0, "holding past full charge does not fire by itself");
  assert.equal(slot(o, "fireball").charge, 1);
  o.hold.clear();
  withRandom(0.5, () => run(w, o, 1));
  assert.equal(casts[0].charge, 1);
  near(o.vitals.mana, 80, 1e-9);
});

test("Fireball cast: charge is capped by affordable mana and the cap is paid in full", () => {
  const w = mkWorld(), o = mkCaster(w, { mana: 12 });
  o.hold.add("fireball");
  withRandom(0.5, () => run(w, o, 100));
  near(slot(o, "fireball").charge, 7 / 15, 1e-9);
  o.hold.clear();
  withRandom(0.5, () => run(w, o, 1));
  near(o.vitals.mana, 0, 1e-9); // cost(7/15) = 12
});

test("Fireball cast: not enough mana to start flashes the mana bar", () => {
  let w = mkWorld(), o = mkCaster(w, { mana: 6.9 });
  o.hold.add("fireball");
  run(w, o, 1);
  assert.equal(slot(o, "fireball").charging, false);
  assert.equal(o.lowManaFlash, 0.4);
  w = mkWorld(); o = mkCaster(w, { mana: 7 });
  o.hold.add("fireball");
  run(w, o, 1);
  assert.equal(slot(o, "fireball").charging, true);
});

test("Fireball cast: cooldown blocks a new charge until it runs out", () => {
  const w = mkWorld(), o = mkCaster(w);
  withRandom(0.5, () => cast(w, o, "fireball", 20));
  o.hold.add("fireball");
  withRandom(0.5, () => run(w, o, 38));
  assert.equal(slot(o, "fireball").charging, false, "still cooling down");
  withRandom(0.5, () => run(w, o, 6));
  assert.equal(slot(o, "fireball").charging, true, "free again after 0.7 s");
});

test("Specialization modifiers shorten cooldown and cast time", () => {
  const w = mkWorld(), o = mkCaster(w, { mods: { castTimeMult: 0.9025, cooldownMult: 0.9025 } });
  o.hold.add("fireball");
  withRandom(0.5, () => run(w, o, 3));
  near(slot(o, "fireball").need, 1.3 * 0.9025, 1e-9);
  withRandom(0.5, () => run(w, o, 16)); // 19 frames held so far
  o.hold.clear();
  withRandom(0.5, () => run(w, o, 1)); // release: 19 x DT / 1.17325 = 0.27 charge, above the minimum
  near(slot(o, "fireball").cdMax, 0.7 * 0.9025, 1e-9);
  near(slot(o, "fireball").cooldown, 0.7 * 0.9025, 1e-9);
});

test("Flame Shield skill: costs 10, toggles, drop is instant, re-raise waits 0.6 s, needs 10 mana", () => {
  const w = mkWorld(), o = mkCaster(w), ups = capture(w, "shield");
  o.press.add("flameShield");
  run(w, o, 1);
  assert.ok(o.shield?.isShield);
  assert.equal(o.shield.points, 50);
  near(o.vitals.mana, 90 - 5 * DT, 1e-9, "cast cost 10, then one frame of upkeep");
  assert.equal(ups[0].type, "up");
  near(slot(o, "flameShield").cooldown, 0.6, 1e-9);
  o.press.add("flameShield");
  run(w, o, 1);
  assert.equal(o.shield, null, "pressing again drops it at once, cooldown or not");
  assert.equal(ups.find((e) => e.type === "down").reason, "manual");
  o.press.add("flameShield");
  run(w, o, 1);
  assert.equal(o.shield, null, "re-raise blocked while the 0.6 s cooldown runs");
  run(w, o, 40);
  o.press.add("flameShield");
  run(w, o, 1);
  assert.ok(o.shield, "raised again after the cooldown");
  // not enough mana
  const w2 = mkWorld(), o2 = mkCaster(w2, { mana: 9 });
  o2.press.add("flameShield");
  run(w2, o2, 1);
  assert.equal(o2.shield, null);
  assert.equal(o2.lowManaFlash, 0.4);
});

test("Flame Shield: upkeep 5 mana per second, shield ends when mana runs out", () => {
  const w = mkWorld(), o = mkCaster(w);
  o.press.add("flameShield");
  run(w, o, 61);
  near(o.vitals.mana, 90 - 5 * 61 * DT, 1e-9);
  const w2 = mkWorld(), o2 = mkCaster(w2, { mana: 10.1 }), ev = capture(w2, "shield");
  o2.press.add("flameShield");
  run(w2, o2, 200);
  assert.equal(o2.shield, null);
  assert.ok(o2.vitals.mana <= 0.001);
  assert.equal(ev.find((e) => e.type === "down").reason, "starved");
});

test("Burn Resistance skill: 1.2 s cast, 25 mana, 30 s ward, recast refreshes", () => {
  const w = mkWorld(), o = mkCaster(w), ward = capture(w, "ward");
  o.hold.add("burnResistance");
  run(w, o, 70);
  assert.equal(o.ward, null, "not before the circle completes");
  run(w, o, 4);
  assert.ok(o.ward?.isWard, "up after about 72 frames");
  near(o.vitals.mana, 75, 1e-9);
  assert.equal(ward[0].type, "up");
  near(slot(o, "burnResistance").cooldown, 1, 0.1);
  run(w, o, 30);
  assert.equal(slot(o, "burnResistance").charging, false, "holding the key does not recast");
  o.hold.clear();
  run(w, o, 90);
  const life = o.ward.life;
  assert.ok(life < 30 && life > 27, `ward life ${life}`);
  o.hold.add("burnResistance");
  run(w, o, 75);
  near(o.vitals.mana, 50, 1e-9);
  assert.ok(o.ward.life > life, "recast tops the timer up");
  near(o.ward.life, 30, 0.2);
});

// ================================================================= 5. Burn (StatusSystem)
test("Burn: ignition chance gate, then one tick per second of dps", () => {
  const ignites = (rnd) => {
    const w = mkWorld(), t = mkTarget();
    w.entities.push(t);
    withRandom(rnd, () => igniteHit(w, t, { chance: 0.5, duration: 5, dps: 8 }));
    return !!t.burn;
  };
  assert.equal(ignites(0.499), true);
  assert.equal(ignites(0.5), false, "random >= chance fails");
  const w = mkWorld(), t = mkTarget(), burns = capture(w, "burn");
  w.entities.push(t);
  withRandom(0, () => igniteHit(w, t));
  assert.equal(burns[0].type, "ignite");
  step(w, 55);
  assert.equal(t.dots.length, 0, "no tick before 1 s");
  step(w, 7);
  assert.deepEqual(t.dots, [8], "first tick just after 1 s");
  step(w, 60 * 5);
  assert.deepEqual(t.dots, [8, 8, 8, 8, 8], "a 5 s burn ticks 5 times");
  assert.equal(t.burn, null);
  assert.equal(burns.filter((e) => e.type === "end").length, 1);
  assert.equal(burns.filter((e) => e.type === "tick").length, 5);
});

test("Burn: only whole seconds tick (5.5 s gives 5), dps below 1 still hurts for 1", () => {
  const w = mkWorld(), t = mkTarget();
  w.entities.push(t);
  withRandom(0, () => igniteHit(w, t, { chance: 1, duration: 5.5, dps: 0.4 }));
  step(w, 60 * 7);
  assert.deepEqual(t.dots, [1, 1, 1, 1, 1]);
  assert.equal(t.burn, null);
});

test("Burn: re-ignite refreshes instead of stacking", () => {
  const w = mkWorld(), t = mkTarget(), burns = capture(w, "burn");
  w.entities.push(t);
  withRandom(0, () => igniteHit(w, t, { chance: 1, duration: 5, dps: 8 }));
  step(w, 125); // 120 accumulated frames sit a hair under 2.0 s, so the 2nd tick needs a few more
  assert.equal(t.dots.length, 2);
  withRandom(0, () => igniteHit(w, t, { chance: 1, duration: 3, dps: 5 }));
  assert.equal(burns.filter((e) => e.type === "ignite").length, 1, "no second ignite event");
  assert.equal(t.burn.dps, 8, "keeps the stronger dps");
  near(t.burn.dur, 3, 0.05); // max(5 - 2, 3)
  step(w, 60 * 4);
  assert.equal(t.dots.length, 5, "2 earlier ticks + 3 more from the refreshed burn");
  assert.equal(t.burn, null);
  withRandom(0, () => igniteHit(w, t, { chance: 1, duration: 4, dps: 12 }));
  assert.equal(t.burn.dps, 12);
});

test("Burn: Burn Resistance halves ticks and may nullify an ignition (spending the ward)", () => {
  let w = mkWorld(), t = mkTarget();
  w.entities.push(t);
  t.ward = mkWard(w, t);
  withRandom([0, 0.5], () => igniteHit(w, t)); // chance passes, nullify roll 0.5 fails (needs < 0.5)
  assert.ok(t.burn);
  step(w, 70);
  assert.deepEqual(t.dots, [4], "8 dps x (1 - 0.5)");
  assert.equal(t.ward.state, "active");

  w = mkWorld(); t = mkTarget();
  w.entities.push(t);
  t.ward = mkWard(w, t);
  const burns = capture(w, "burn");
  withRandom([0, 0.49], () => igniteHit(w, t));
  assert.equal(t.burn, null);
  assert.equal(burns[0].type, "nullify");
  assert.equal(t.ward, null, "the ward is spent");
});

test("Burn: a nullified ignition also snuffs a burn that was already running", () => {
  const w = mkWorld(), t = mkTarget();
  w.entities.push(t);
  withRandom(0, () => igniteHit(w, t));
  assert.ok(t.burn);
  t.ward = mkWard(w, t);
  withRandom([0, 0.1], () => igniteHit(w, t));
  assert.equal(t.burn, null);
});

test("Burn: stops without an end event when the target goes down; dead and non-hittable do not ignite", () => {
  const w = mkWorld(), t = mkTarget(), burns = capture(w, "burn");
  w.entities.push(t);
  withRandom(0, () => igniteHit(w, t));
  t.downed = true;
  step(w, 1);
  assert.equal(t.burn, null);
  assert.equal(burns.filter((e) => e.type === "end").length, 0);
  for (const over of [{ dead: true }, { hittable: false }]) {
    const x = mkTarget(over);
    withRandom(0, () => igniteHit(w, x));
    assert.equal(x.burn, null);
  }
});

// ================================================================= 6. Flame Shield rules
function mkShieldRig(over = {}) {
  const w = mkWorld(), owner = mkTarget({ x: 0, y: 0, aim: 0, vitals: new Vitals(Mage.stats), shield: null, ...over });
  const shield = new FlameShieldEffect({ world: w, owner, points: 50, radius: owner.radius + 40, arc: (115 * Math.PI) / 180, height: 60, upkeep: 5 });
  owner.shield = shield;
  w.entities.push(owner, shield);
  return { w, owner, shield };
}

test("Flame Shield: absorb takes points, leftover passes through, zero points breaks it", () => {
  const { w, owner, shield } = mkShieldRig();
  const ev = capture(w, "shield");
  const proj = { x: 56, y: 0, z: 20, vx: -1, vy: 0, charge: 0.5 };
  assert.equal(shield.absorb(20, proj), 0);
  assert.equal(shield.points, 30);
  assert.deepEqual([ev[0].type, ev[0].absorbed, ev[0].passed], ["hit", 20, 0]);
  assert.equal(shield.absorb(40, proj), 10, "30 absorbed, 10 passes");
  assert.equal(shield.points, 0);
  assert.deepEqual([ev[1].type, ev[1].absorbed, ev[1].passed], ["break", 30, 10]);
  assert.equal(owner.shield, null);
  assert.equal(shield.state, "closing");
  assert.equal(w.numbers.length, 2, "a damage number per absorbed hit");
  assert.equal(w.numbers[0][2], "20");
});

test("Flame Shield: blocks only the front arc, in range, below its height, after rising", () => {
  const { shield } = mkShieldRig();
  const b = (x, y, z, r = 10) => shield.blocks(x, y, z, r);
  assert.equal(b(56, 0, 20), false, "not while it has not risen yet");
  shield.rise = 0.34;
  assert.equal(b(56, 0, 20), false);
  shield.rise = 0.35;
  assert.equal(b(56, 0, 20), true, "blocks from 35% of the rise");
  shield.rise = 1;
  assert.equal(b(-56, 0, 20), false, "behind the caster");
  assert.equal(b(80, 0, 20), false, "too far out");
  assert.equal(b(10, 0, 20), false, "too far in (inside radius - 34)");
  assert.equal(b(56, 0, 70), true, "z <= height + radius = 70");
  assert.equal(b(56, 0, 71), false);
  const at = (deg) => b(56 * Math.cos((deg * Math.PI) / 180), 56 * Math.sin((deg * Math.PI) / 180), 20);
  assert.equal(at(64), true, "half arc 57.5 deg + 0.12 rad (6.9 deg) margin");
  assert.equal(at(65), false);
  shield.state = "closing";
  assert.equal(b(56, 0, 20), false, "a closing shield blocks nothing");
});

test("Flame Shield: rises in 0.45 s and starts blocking after 10 frames", () => {
  const { w, shield } = mkShieldRig();
  step(w, 9);
  assert.equal(shield.blocks(56, 0, 20, 10), false);
  step(w, 1);
  assert.equal(shield.blocks(56, 0, 20, 10), true);
  step(w, 30);
  assert.equal(shield.rise, 1);
});

test("Flame Shield vs Fireball: absorbed ball dies, no hit event; leftover flies on smaller", () => {
  let { w, owner, shield } = mkShieldRig();
  shield.rise = 1;
  let hits = capture(w, "hit");
  let p = w.spawn(ball({ charge: 0.5, x: 300, angle: Math.PI, owner: { id: "enemy" } }));
  withRandom(0.5, () => step(w, 40));
  assert.equal(p.dead, true);
  assert.equal(shield.points, 33, "17 damage soaked");
  assert.equal(hits.length, 0);

  ({ w, owner, shield } = mkShieldRig());
  shield.rise = 1;
  shield.points = 20;
  hits = capture(w, "hit");
  p = w.spawn(ball({ charge: 1, x: 300, angle: Math.PI, owner: { id: "enemy" } }));
  withRandom(0.5, () => step(w, 40));
  assert.equal(owner.shield, null, "the shield broke");
  assert.equal(hits.length, 1);
  assert.equal(hits[0].target, owner);
  assert.equal(hits[0].damage, 10, "30 - 20 points");
  near(p.radius, 19 * 0.7, 1e-9); // 0.55 + 0.45 x (10 / 30)
});

// ================================================================= 7. Explosions
function blast(charge, targets, extra = {}) {
  const w = mkWorld(), hits = capture(w, "hit");
  new ExplosionSystem(w);
  w.entities.push(...targets);
  withRandom(extra.random ?? 0.5, () =>
    w.events.emit("explosion", { source: extra.source ?? null, x: 0, y: 0, z: 0, charge, kind: "clash", element: "fire" }),
  );
  return { w, hits };
}

test("Explosion: radius and centre damage by charge", () => {
  assert.deepEqual([0, 0.5, 1].map(explosionRadius), [70, 130, 190]);
  const centre = (c) => blast(c, [mkTarget({ x: 0, radius: 10 })]).hits[0].damage;
  assert.deepEqual([0, 0.5, 1].map(centre), [6, 15, 24]);
});

test("Explosion: linear falloff to 30% at the edge, measured from the body edge", () => {
  const ts = [mkTarget({ x: 10, y: 0, radius: 10 }), mkTarget({ x: 0, y: 105, radius: 10 }),
    mkTarget({ x: -200, y: 0, radius: 10 }), mkTarget({ x: 0, y: -201, radius: 10 })];
  const { hits } = blast(1, ts);
  assert.deepEqual(hits.map((h) => h.damage), [24, 16, 7], "centre, half way (0.65), edge (0.3); the 4th is 1 px outside");
  assert.deepEqual(hits.map((h) => h.target), ts.slice(0, 3));
  assert.deepEqual(blast(0, [mkTarget({ x: 80, radius: 10 })]).hits.map((h) => h.damage), [2], "6 x 0.3 = 1.8 -> 2");
});

test("Explosion: spread 0.92 to 1.08 and caster multipliers", () => {
  const dmg = (rnd, source) => blast(1, [mkTarget({ x: 0, radius: 10 })], { random: rnd, source }).hits[0].damage;
  assert.equal(dmg(0), 22); // 24 x 0.92 = 22.08
  assert.equal(dmg(0.999999), 26); // 24 x 1.08 = 25.92
  const source = { mods: { element: "fire", elementDamage: 0.05, skillDamage: 0.1 } };
  assert.equal(dmg(0.5, source), 28); // 24 x 1.155 = 27.72
});

test("Explosion: hit event shape, the caster is hurt too, dead and non-hittable are skipped", () => {
  const caster = mkTarget({ x: 20, y: 0, radius: 10, height: 46 });
  const { hits } = blast(1, [caster, mkTarget({ x: 20, dead: true }), mkTarget({ x: 20, hittable: false })], { source: caster });
  assert.equal(hits.length, 1);
  const h = hits[0];
  assert.equal(h.target, caster);
  assert.equal(h.source, caster);
  assert.deepEqual([h.aoe, h.crit, h.resisted, h.z], [true, false, 0, 23]);
  assert.deepEqual([h.dir.x, h.dir.y + 0], [1, 0]);
  near(h.charge, 1 * (1 - 0.7 * (10 / 190)), 1e-9); // charge x falloff
});

test("Explosion: Burn Resistance applies, Flame Shield does not stop it", () => {
  const r = mkShieldRig();
  new ExplosionSystem(r.w);
  const log = capture(r.w, "hit");
  const t2 = mkTarget({ x: 100, radius: 10 });
  t2.ward = mkWard(r.w, t2);
  r.w.entities.push(t2);
  withRandom(0.5, () => r.w.events.emit("explosion", { source: null, x: 100, y: 0, z: 0, charge: 1, kind: "clash", element: "fire" }));
  const onT2 = log.find((h) => h.target === t2);
  assert.deepEqual([onT2.damage, onT2.resisted], [17, 7], "24 x 0.7 = 16.8 -> 17");
  assert.equal(r.shield.points, 50, "shields are not hittable and soak nothing");
});

// ================================================================= 8. Projectile clash
test("Clash: charges within 0.12 annihilate in one bigger explosion", () => {
  const w = mkWorld(), ex = capture(w, "explosion");
  const a = ball({ owner: { id: "A" }, charge: 0.5, x: 0, z: 10 }), b = ball({ owner: { id: "B" }, charge: 0.61, x: 20, z: 30 });
  clashProjectiles(a, b, w);
  assert.deepEqual([a.dead, b.dead], [true, true]);
  assert.equal(ex.length, 1);
  assert.deepEqual([ex[0].x, ex[0].y, ex[0].z, ex[0].kind, ex[0].element], [10, 0, 20, "clash", "fire"]);
  near(ex[0].charge, (0.5 + 0.61) * 0.6, 1e-9);
  assert.equal(ex[0].source, a.owner);
  const c = ball({ charge: 1 }), d = ball({ charge: 1 }), e2 = ball({ charge: 0 }), f = ball({ charge: 0 });
  clashProjectiles(c, d, w); clashProjectiles(e2, f, w);
  assert.equal(ex[1].charge, 1, "capped at 1");
  assert.equal(ex[2].charge, 0.1, "floored at 0.1");
});

test("Clash: a gap of 0.13 or more means the stronger survives, weakened by the ratio", () => {
  const w = mkWorld(), ex = capture(w, "explosion");
  const a = ball({ owner: { id: "A" }, charge: 1 }), b = ball({ owner: { id: "B" }, charge: 0.5 });
  clashProjectiles(b, a, w); // argument order does not matter
  assert.deepEqual([a.dead, b.dead], [false, true]);
  near(a.potency, 0.8); near(a.radius, 19 * 0.875);
  near(ex[0].charge, 0.45, 1e-9); // weak charge x 0.9
  assert.equal(ex[0].source, a.owner, "credited to the survivor");
  const c = ball({ charge: 0.5 }), d = ball({ charge: 0.37 });
  clashProjectiles(c, d, w);
  assert.deepEqual([c.dead, d.dead], [false, true], "gap 0.13 is not a tie: the stronger ball survives");
  const e2 = ball({ charge: 0.5 }), f = ball({ charge: 0.39 });
  clashProjectiles(e2, f, w);
  assert.deepEqual([e2.dead, f.dead], [true, true], "gap 0.11 is a tie");
});

test("Clash in flight: head-on balls clash once; same owner and large height gap never clash", () => {
  const run2 = (a, b, frames = 20) => {
    const w = mkWorld(), ex = capture(w, "explosion");
    w.spawn(a); w.spawn(b);
    withRandom(0.5, () => step(w, frames));
    return ex;
  };
  const a = ball({ owner: { id: "A" }, charge: 1, x: 0, angle: 0 }), b = ball({ owner: { id: "B" }, charge: 0.4, x: 200, angle: Math.PI });
  const ex = run2(a, b);
  assert.equal(ex.length, 1, "exactly one explosion per clash");
  assert.deepEqual([a.dead, b.dead], [false, true]);
  near(a.potency, 1 - 0.4 * 0.4, 1e-9);
  near(ex[0].charge, 0.36, 1e-9);
  const same = { id: "A" };
  assert.equal(run2(ball({ owner: same, x: 0 }), ball({ owner: same, x: 200, angle: Math.PI })).length, 0);
  assert.equal(run2(ball({ owner: { id: "A" }, x: 0, z: 20 }), ball({ owner: { id: "B" }, x: 200, z: 140, angle: Math.PI })).length, 0);
});

// ================================================================= 9. XP, levels, specialization
test("XP curve: XP needed per level", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 10, 49].map(charXpForNext), [100, 283, 520, 800, 1118, 3162, 34300]);
  assert.deepEqual([1, 2, 3, 4, 5, 9].map(specXpForNext), [50, 132, 233, 348, 476, 1084]);
  assert.equal(MAX_CHAR_LEVEL, 50);
  assert.equal(Mage.specialization.maxLevel, 10);
});

test("Levels: thresholds, partial progress, caps", () => {
  const p = new Progression(Mage);
  const at = (xp) => { p.charXp = xp; p.recalc(); const c = p.char; return [c.level, c.into, c.need]; };
  assert.deepEqual(at(0), [1, 0, 100]);
  assert.deepEqual(at(99), [1, 99, 100]);
  assert.deepEqual(at(100), [2, 0, 283]);
  assert.deepEqual(at(382), [2, 282, 283]);
  assert.deepEqual(at(383), [3, 0, 520]);
  assert.deepEqual(at(903), [4, 0, 800]);
  near(p.char.frac, 0);
  p.charXp = 99; p.recalc();
  near(p.char.frac, 0.99);
  const top = at(1e9);
  assert.deepEqual(top, [50, 0, 0]);
  assert.equal(p.char.frac, 1);
  const spec = (xp) => { p.specXp = xp; p.recalc(); return [p.specLevel, p.specInfo.into, p.specInfo.need]; };
  assert.deepEqual(spec(49), [1, 49, 50]);
  assert.deepEqual(spec(50), [2, 0, 132]);
  assert.deepEqual(spec(1e9), [10, 0, 0]);
});

test("Progression events: xp, then one levelup per level gained, unlocks reported", () => {
  const p = new Progression(Mage), ev = [];
  p.onEvent = (e) => ev.push(e);
  p.addCharXp(383);
  assert.deepEqual(ev, [
    { type: "xp", track: "char", amount: 383 },
    { type: "levelup", track: "char", level: 2 },
    { type: "levelup", track: "char", level: 3 },
  ]);
  ev.length = 0;
  p.addSpecXp(50 + 132 + 233 + 348 + 476); // to level 6: crosses the level 5 unlock
  const ups = ev.filter((e) => e.type === "levelup");
  assert.deepEqual(ups.map((e) => [e.level, e.unlock]), [[2, null], [3, null], [4, null], [5, "flameShield"], [6, null]]);
  ev.length = 0;
  p.addCharXp(0.4); p.addCharXp(-5); p.addSpecXp(0);
  assert.equal(ev.length, 0, "zero, negative and below-half amounts are ignored");
  p.addCharXp(0.5);
  assert.equal(ev[0].amount, 1, "rounds half up");
});

test("Specialization: skill unlocks, choice levels, picks, folded modifiers", () => {
  const p = new Progression(Mage);
  assert.deepEqual(p.unlockedSkills(), ["fireball"]);
  assert.deepEqual(p.choiceLevels(), [2, 3, 4, 6, 7, 9]); // level 8 became the Fire Blast unlock in V1.11.0.00
  assert.deepEqual(p.pendingLevels(), []);
  assert.equal(p.pick("mana"), false, "nothing to pick at level 1");
  p.specXp = 50 + 132 + 233 + 348; p.recalc(); // level 5
  assert.equal(p.specLevel, 5);
  assert.deepEqual(p.unlockedSkills(), ["fireball", "flameShield"]);
  assert.deepEqual(p.pendingLevels(), [2, 3, 4]);
  assert.equal(p.pick("not-a-bonus"), false);
  assert.equal(p.pick("mana"), true);
  assert.deepEqual(p.picks, { 2: "mana" }, "picks fill the lowest pending level");
  p.pick("mana"); p.pick("castTime");
  assert.deepEqual(p.pendingLevels(), []);
  const m = p.mods();
  assert.deepEqual([m.element, m.stats.maxMana, m.castTimeMult, m.cooldownMult, m.elementDamage, m.skillDamage], ["fire", 20, 0.95, 1, 0, 0]);
  p.specXp = 1e9; p.recalc();
  assert.deepEqual(p.unlockedSkills(), ["fireball", "flameShield", "fireBlast", "burnResistance"]);
});

test("Specialization bonuses: each one folds into the modifier object", () => {
  assert.deepEqual(SPEC_BONUSES.map((b) => b.id), ["mana", "manaRegen", "castTime", "cooldown", "element", "skill"]);
  const m = computeMods({ 2: "mana", 3: "manaRegen", 4: "castTime", 6: "cooldown", 7: "element", 8: "skill", 9: "element", 10: "ghost" }, "fire");
  near(m.stats.maxMana, 10); near(m.stats.manaRegen, 0.25);
  near(m.castTimeMult, 0.95); near(m.cooldownMult, 0.95);
  near(m.elementDamage, 0.1); near(m.skillDamage, 0.05);
  assert.deepEqual(m.counts, { mana: 1, manaRegen: 1, castTime: 1, cooldown: 1, element: 2, skill: 1 }, "unknown ids are ignored");
});

test("Progression saves and loads (versioned), bad data is ignored", () => {
  const KEY = "lycarius.primordia.progress";
  const p = new Progression(Mage);
  p.addCharXp(500); p.addSpecXp(300); p.pick("skill");
  const saved = JSON.parse(store.getItem(KEY));
  assert.deepEqual(saved, { v: 1, classes: { mage: { charXp: 500, specXp: 300, picks: { 2: "skill" } } } });
  const q = new Progression(Mage);
  assert.deepEqual([q.charXp, q.specXp, q.picks], [500, 300, { 2: "skill" }]);
  store.setItem(KEY, JSON.stringify({ v: 1, classes: { mage: { charXp: -9, specXp: "x", picks: { 5: "mana", 3: "ghost", 4: "cooldown" } } } }));
  const r = new Progression(Mage);
  assert.deepEqual([r.charXp, r.specXp, r.picks], [0, 0, { 4: "cooldown" }], "negative and non-numeric XP clamp to 0; unlock levels and unknown ids are dropped");
  store.setItem(KEY, JSON.stringify({ v: 2, classes: { mage: { charXp: 50 } } }));
  assert.equal(new Progression(Mage).charXp, 0, "another save version is ignored");
  store.setItem(KEY, "{not json");
  assert.equal(new Progression(Mage).charXp, 0);
  q.reset();
  assert.deepEqual([q.charXp, q.specXp, q.picks, q.charLevel], [0, 0, {}, 1]);
});

function xpRig() {
  const w = mkWorld(), p = { prog: new Progression(Mage) };
  w.player = p;
  new XpSystem(w);
  return { w, p, prog: p.prog };
}

test("XpSystem: damage dealt gives 1 character XP and 1 specialization XP per point", () => {
  const { w, p, prog } = xpRig();
  const dummy = { downed: false };
  w.events.emit("hit", { source: p, target: dummy, damage: 10 });
  assert.deepEqual([prog.charXp, prog.specXp], [10, 10]);
  w.events.emit("hit", { source: p, target: p, damage: 10 });
  w.events.emit("hit", { source: dummy, target: p, damage: 10 });
  w.events.emit("hit", { source: p, target: dummy, damage: 0 });
  w.events.emit("hit", { source: p, target: dummy, damage: 0.4 });
  assert.deepEqual([prog.charXp, prog.specXp], [10, 10], "self damage, damage taken, zero and sub-half damage give nothing");
  w.events.emit("hit", { source: p, target: dummy, damage: 2.6 });
  assert.deepEqual([prog.charXp, prog.specXp], [13, 13], "rounded");
});

test("XpSystem: killing a hostile dummy pays 50 character XP once", () => {
  const { w, p, prog } = xpRig();
  const dummy = { downed: true, attack: true };
  w.events.emit("hit", { source: p, target: dummy, damage: 5 });
  assert.deepEqual([prog.charXp, prog.specXp], [55, 5]);
  w.events.emit("hit", { source: p, target: dummy, damage: 5 });
  assert.deepEqual([prog.charXp, prog.specXp], [60, 10], "no second kill bonus");
  w.events.emit("hit", { source: p, target: { downed: true, attack: false }, damage: 5 });
  assert.deepEqual([prog.charXp, prog.specXp], [65, 15], "a downed non-hostile pays no bonus");
});

test("XpSystem: burn ticks the player started pay XP, others do not", () => {
  const { w, p, prog } = xpRig();
  w.events.emit("burn", { type: "tick", target: { burn: { source: p } }, damage: 4 });
  assert.deepEqual([prog.charXp, prog.specXp], [4, 4]);
  w.events.emit("burn", { type: "tick", target: { burn: { source: {} } }, damage: 4 });
  w.events.emit("burn", { type: "ignite", target: { burn: { source: p } }, damage: 4 });
  assert.deepEqual([prog.charXp, prog.specXp], [4, 4]);
});

test("XpSystem: casting Fireball pays 2 to 5 specialization XP by charge", () => {
  const { w, p, prog } = xpRig();
  const xp = (charge, owner = p) => { const before = prog.specXp; w.events.emit("cast", { owner, charge }); return prog.specXp - before; };
  assert.deepEqual([0, 0.16, 0.5, 1].map((c) => xp(c)), [2, 2, 4, 5]);
  assert.equal(xp(1, {}), 0, "other casters pay nothing");
  assert.equal(prog.charXp, 0, "casting gives no character XP");
});

console.log(`\n${passed} tests passed`);
