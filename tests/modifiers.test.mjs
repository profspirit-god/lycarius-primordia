// X1 (V1.24.0.00): the temporary stat-modifier layer. No browser, no dependencies.
//   node tests/modifiers.test.mjs        (exit 0 = all passed)
// Covers: set / replace / remove, validation (R11), product and total caps (speed floor 75%), order independence, the player's regeneration, speed,
// stamina cost and damage, the permanent stat tickets staying untouched, Mana Regen composing, and the source rule check.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import "../src/content/index.js";
import { ClassRegistry } from "../src/classes/ClassRegistry.js";
import { Player } from "../src/entities/Player.js";
import { StatModifiers, MOD_STATS, STAT_CAPS, MOD_LIMITS } from "../src/sim/modifiers/StatModifiers.js";
import { skillMult } from "../src/progression/Mods.js";
import { Dodge } from "../src/skills/Dodge.js";
import { DT, mkWorld, step } from "./helpers.mjs";

const mage = ClassRegistry.get("mage");
let passed = 0;
const test = (name, fn) => (fn(), passed++, console.log("ok  " + name));
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, `${msg ?? ""} ${a} vs ${b}`);
const mk = () => {
  const w = mkWorld();
  w.player = w.spawn(new Player(mage));
  return w;
};

test("empty layer: every multiplier is 1 and the list is empty", () => {
  const m = new StatModifiers();
  for (const s of MOD_STATS) assert.equal(m.mult(s), 1);
  assert.equal(m.mult("nonsense"), 1);
  assert.deepEqual(m.list(), []);
});

test("set, replace by key, remove", () => {
  const m = new StatModifiers();
  assert.deepEqual(m.set("hunger", { speed: 0.9 }), { ok: true });
  near(m.mult("speed"), 0.9);
  m.set("hunger", { speed: 0.8 });
  near(m.mult("speed"), 0.8, "same key replaces, never stacks");
  assert.equal(m.list().length, 1);
  assert.equal(m.remove("hunger"), true);
  assert.equal(m.remove("hunger"), false);
  assert.equal(m.mult("speed"), 1);
});

test("different keys multiply", () => {
  const m = new StatModifiers();
  m.set("a", { hpRegen: 0.5 });
  m.set("b", { hpRegen: 0.5, damage: 1.2 });
  near(m.mult("hpRegen"), 0.25);
  near(m.mult("damage"), 1.2);
});

test("total caps: speed never below 75%, other stats stay inside their range", () => {
  const m = new StatModifiers();
  m.set("a", { speed: 0.85 });
  m.set("b", { speed: 0.85 });
  m.set("c", { speed: 0.85 });
  assert.equal(m.mult("speed"), STAT_CAPS.speed.min);
  assert.equal(STAT_CAPS.speed.min, 0.75);
  m.set("big", { damage: 10 });
  m.set("big2", { damage: 10 });
  assert.equal(m.mult("damage"), STAT_CAPS.damage.max);
  m.set("zero", { hpRegen: 0 });
  assert.equal(m.mult("hpRegen"), STAT_CAPS.hpRegen.min);
});

test("hostile input is refused and changes nothing (R11)", () => {
  const m = new StatModifiers();
  m.set("ok", { speed: 0.9 });
  const rev = m.revision;
  const bad = [
    ["", { speed: 1 }, "invalid_key"],
    ["x".repeat(MOD_LIMITS.maxKeyLength + 1), { speed: 1 }, "invalid_key"],
    [42, { speed: 1 }, "invalid_key"],
    ["k", null, "invalid_mult"],
    ["k", [1], "invalid_mult"],
    ["k", { speed: NaN }, "invalid_mult"],
    ["k", { speed: Infinity }, "invalid_mult"],
    ["k", { speed: -1 }, "invalid_mult"],
    ["k", { speed: 11 }, "invalid_mult"],
    ["k", { speed: "2" }, "invalid_mult"],
    ["k", { armor: 2 }, "unknown_stat"],
    ["k", { constructor: 2 }, "unknown_stat"],
  ];
  for (const [k, v, reason] of bad) {
    const r = m.set(k, v);
    if (reason) assert.deepEqual(r, { ok: false, reason }, String(reason));
  }
  assert.equal(m.has("k"), false);
  assert.equal(m.list().length, 1);
  for (let i = 0; i < MOD_LIMITS.maxSets; i++) m.set("s" + i, { speed: 1 });
  assert.deepEqual(m.set("one-too-many", { speed: 1 }), { ok: false, reason: "too_many" });
  assert.ok(m.revision > rev);
});

test("order independence (R9): the same sets in any order give the same result", () => {
  const sets = [["c", { speed: 0.93, damage: 1.1 }], ["a", { speed: 0.97, hpRegen: 0.7 }], ["b", { speed: 0.91, damage: 0.9 }]];
  const m1 = new StatModifiers(), m2 = new StatModifiers();
  for (const [k, v] of sets) m1.set(k, v);
  for (const [k, v] of sets.slice().reverse()) m2.set(k, v);
  for (const s of MOD_STATS) assert.equal(m1.mult(s), m2.mult(s));
  assert.deepEqual(m1.list(), m2.list());
});

test("player: a fresh player is exactly as before (all temp multipliers 1)", () => {
  const p = mk().player;
  assert.deepEqual(p.vitals.temp, { hpRegen: 1, manaRegen: 1, staminaRegen: 1, staminaCost: 1 });
  assert.equal(p.modifiers.list().length, 0);
});

test("player: regeneration follows the modifiers and returns when removed", () => {
  const w = mk(), p = w.player, v = p.vitals;
  v.hp = 10; v.mana = 0; v.stamina = 0;
  const base = { hp: p.stats.hpRegen, mana: p.stats.manaRegen, st: p.stats.staminaRegen };
  assert.ok(p.addModifier("test", { hpRegen: 0.5, manaRegen: 2, staminaRegen: 0 }).ok);
  step(w, 60);
  near(v.hp, 10 + base.hp * 0.5 * 1, "hp regen x0.5 over 1 s");
  near(v.mana, base.mana * 2, "mana regen x2");
  near(v.stamina, 0, "stamina regen x0");
  assert.equal(p.removeModifier("test"), true);
  v.hp = 10; v.mana = 0; v.stamina = 0;
  step(w, 60);
  near(v.hp, 10 + base.hp, "back to normal");
  near(v.mana, base.mana);
  near(v.stamina, base.st);
});

test("player: speed multiplier slows the walk, the 75% floor holds", () => {
  const run = (mods) => {
    const w = mk(), p = w.player;
    for (const [k, v] of mods) p.addModifier(k, v);
    p.applyCommand({ seq: 1, mx: 1, my: 0, aim: 0, btn: 0 });
    step(w, 120);
    return p.x;
  };
  const free = run([]), slow = run([["a", { speed: 0.5 }]]), floor = run([["a", { speed: 0.85 }], ["b", { speed: 0.85 }], ["c", { speed: 0.85 }]]);
  assert.ok(slow > free * 0.74 && slow < free * 0.78, `speed floor 75%: ${slow / free}`);
  near(floor, slow, "three 0.85 sets hit the same floor as one 0.5");
});

test("player: stamina cost scales, and the check and the spend agree", () => {
  const w = mk(), p = w.player, v = p.vitals;
  p.addModifier("heavy", { staminaCost: 2 });
  near(v.staminaCost(20), 40);
  v.stamina = 39;
  assert.equal(Dodge.canUse(p), false, "39 < 2 x 20");
  assert.equal(v.spendStamina(20), false);
  near(v.stamina, 39, "a refusal spends nothing");
  v.stamina = 40;
  assert.equal(Dodge.canUse(p), true);
  assert.equal(v.spendStamina(20), true);
  near(v.stamina, 0);
});

test("player: damage multiplier scales skillMult and nothing else changes without it", () => {
  const p = mk().player;
  const before = skillMult(p);
  p.addModifier("rage", { damage: 1.5 });
  near(skillMult(p), before * 1.5);
  p.removeModifier("rage");
  near(skillMult(p), before);
  assert.equal(skillMult({}), 1, "a caster without modifiers still gets 1");
});

test("permanent stat tickets are untouched by temporary modifiers", () => {
  const p = mk().player;
  p.setTraining({ speed: 5, hpRegen: 0.2, maxHp: 10 });
  const stats = { ...p.stats };
  p.addModifier("x", { speed: 0.8, hpRegen: 0.1, staminaCost: 2 });
  assert.deepEqual(p.stats, stats, "player.stats stays the permanent value");
  p.removeModifier("x");
  assert.deepEqual(p.stats, stats);
  p.setTraining({ speed: 10 });
  assert.equal(p.modifiers.list().length, 0, "setTraining does not drop or add temporary sets");
});

test("Mana Regen composes with a modifier (x5 x modifier) and ends cleanly", () => {
  const w = mk(), p = w.player, v = p.vitals;
  v.manaRegenMult = 5; // what ManaRegenEffect writes
  p.addModifier("m", { manaRegen: 0.5 });
  v.mana = 0;
  step(w, 60);
  near(v.mana, p.stats.manaRegen * 5 * 0.5);
  v.manaRegenMult = 1;
  p.removeModifier("m");
});

test("modifiers survive a respawn (configure keeps them)", () => {
  const w = mk(), p = w.player;
  p.addModifier("keep", { hpRegen: 0.5 });
  p.vitals.configure(p.stats);
  assert.equal(p.vitals.temp.hpRegen, 0.5);
  assert.ok(p.modifiers.has("keep"));
});

test("Node import with no globals, and the source rule check", () => {
  assert.equal(typeof window, "undefined");
  assert.equal(typeof document, "undefined");
  const code = readFileSync(new URL("../src/sim/modifiers/StatModifiers.js", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  assert.doesNotMatch(code, /\bMath\.random\b|\brand\(|\brng\b|\bperformance\b|\bDate\b|\bsetTimeout\b|\bwindow\b|\bdocument\b|\blocalStorage\b|\bparticles\b|\blights\b|\bworld\./);
});

console.log(`\n${passed} tests passed`);
