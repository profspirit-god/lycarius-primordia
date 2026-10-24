// H1: the pure hunger primitive (src/sim/hunger/). Not wired into the game, so these tests are the only proof it works.
//   node tests/hunger.test.mjs        (exit 0 = all passed)
// Covers: the Primordia tier table of FOUNDER.md section 6, the validator and its guardrails (never more than -10% speed, regen never
// off, the lowest tier can eat), the drain math (1 per 90 s, 100 to 0 in 9000 s), tier-change reports, frame-rate independence,
// eating (cap, Stuffed refuses, bad amounts), serialize / restore through the storage adapter, and a Node import with no globals.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createMemoryStorage } from "../src/sim/storage.js";
import { Hunger, tierFor, HUNGER_SAVE_VERSION } from "../src/sim/hunger/Hunger.js";
import { PRIMORDIA_HUNGER } from "../src/sim/hunger/definition.js";
import {
  validateHungerDef, normalizeHungerDef, MIN_MOVE_MULT, MIN_MULT, MAX_TIERS, MAX_DRAIN_SECONDS,
} from "../src/sim/hunger/validateHunger.js";

let passed = 0;
const test = (name, fn) => (fn(), passed++, console.log("ok  " + name));

const clone = (o) => JSON.parse(JSON.stringify(o));
const def = (over = {}) => ({ ...clone(PRIMORDIA_HUNGER), ...over });
const withTier = (i, over) => { const d = def(); d.tiers[i] = { ...d.tiers[i], ...over }; return d; };
const at = (value) => new Hunger(def(), { value });

// ---------------------------------------------------------------- the data
test("the Primordia definition is valid and matches the FOUNDER.md tier table", () => {
  assert.deepEqual(validateHungerDef(PRIMORDIA_HUNGER), []);
  const n = normalizeHungerDef(PRIMORDIA_HUNGER);
  assert.equal(n.max, 100);
  assert.equal(n.drainSeconds, 90);
  assert.deepEqual(n.tiers.map((t) => [t.id, t.min]), [["stuffed", 90], ["full", 60], ["not_hungry", 25], ["hungry", 8], ["starving", 0]]);
  const row = (id) => n.tiers.find((t) => t.id === id);
  assert.deepEqual([row("stuffed").regenMult, row("stuffed").moveMult, row("stuffed").staminaRegenMult, row("stuffed").canEat], [1.05, 0.9, 1.05, false]);
  assert.deepEqual([row("full").regenMult, row("full").moveMult, row("full").staminaRegenMult], [1.05, 1, 1.05]);
  assert.deepEqual([row("not_hungry").regenMult, row("not_hungry").moveMult, row("not_hungry").staminaRegenMult], [1, 1, 1]);
  assert.deepEqual([row("hungry").regenMult, row("hungry").moveMult, row("hungry").staminaRegenMult, row("hungry").status], [0.75, 0.95, 0.75, "hungry"]);
  assert.deepEqual([row("starving").regenMult, row("starving").moveMult, row("starving").staminaRegenMult, row("starving").status], [0.5, 0.9, 0.5, "starving"]);
  assert.deepEqual([row("full").status, row("not_hungry").status, row("stuffed").status], [null, null, "stuffed"]);
});

test("the default start is 85 (Full), so a new character is not born Stuffed", () => {
  const h = new Hunger(PRIMORDIA_HUNGER);
  assert.equal(h.value, 85);
  assert.equal(h.tierId, "full");
  assert.equal(h.canEat, true);
});

test("normalize: frozen, tiers sorted high to low whatever the listed order, a fresh copy", () => {
  const d = def();
  d.tiers.reverse();
  const n = normalizeHungerDef(d);
  assert.deepEqual(n.tiers.map((t) => t.min), [90, 60, 25, 8, 0]);
  assert.ok(Object.isFrozen(n) && Object.isFrozen(n.tiers) && Object.isFrozen(n.tiers[0]));
  d.tiers[0].regenMult = 1.9;
  assert.notEqual(n.tiers.find((t) => t.id === "starving").regenMult, 1.9, "later edits of the source do not leak in");
});

// ---------------------------------------------------------------- the validator
test("validator: every field is required and unknown fields are refused", () => {
  for (const k of ["id", "max", "start", "drainSeconds", "tiers"]) {
    const d = def();
    delete d[k];
    assert.ok(validateHungerDef(d).some((e) => e.includes(`missing field "${k}"`)), k);
  }
  assert.ok(validateHungerDef({ ...def(), hacks: 1 }).some((e) => e.includes('unknown field "hacks"')));
  for (const k of ["id", "min", "regenMult", "moveMult", "staminaRegenMult", "status", "canEat"]) {
    const d = def();
    delete d.tiers[1][k];
    assert.ok(validateHungerDef(d).some((e) => e.includes(`missing field "${k}"`)), k);
  }
  assert.ok(validateHungerDef(withTier(1, { damage: 5 })).some((e) => e.includes('unknown field "damage"')), "a tier cannot carry damage");
});

test("validator: not an object, bad ids, max, start and drain", () => {
  for (const bad of [null, undefined, 5, "x", [], () => 1]) assert.deepEqual(validateHungerDef(bad), ["definition must be an object"]);
  for (const id of ["", "H", "1a", "has space", "x".repeat(41), 5, null]) assert.notEqual(validateHungerDef(def({ id })).length, 0, String(id));
  for (const max of [0, -1, 1.5, 1001, "100", null, NaN]) assert.notEqual(validateHungerDef(def({ max })).length, 0, String(max));
  for (const start of [-1, 101, NaN, Infinity, "50", null]) assert.notEqual(validateHungerDef(def({ start })).length, 0, String(start));
  for (const drainSeconds of [0, 0.5, -90, MAX_DRAIN_SECONDS + 1, NaN, Infinity, "90", null]) assert.notEqual(validateHungerDef(def({ drainSeconds })).length, 0, String(drainSeconds));
});

test("validator: tier lists (size, duplicates, coverage from 0, ranges)", () => {
  assert.notEqual(validateHungerDef(def({ tiers: "x" })).length, 0);
  assert.notEqual(validateHungerDef(def({ tiers: [] })).length, 0);
  assert.notEqual(validateHungerDef(def({ tiers: [def().tiers[0]] })).length, 0, "needs at least two tiers");
  const many = Array.from({ length: MAX_TIERS + 1 }, (_, i) => ({ ...def().tiers[2], id: "t" + (i + 10), min: i }));
  assert.notEqual(validateHungerDef(def({ tiers: many })).length, 0);
  assert.ok(validateHungerDef(withTier(4, { min: 1 })).some((e) => e.includes("min 0")), "some tier must start at 0");
  assert.ok(validateHungerDef(withTier(3, { id: "starving" })).some((e) => e.includes("duplicate id")));
  assert.ok(validateHungerDef(withTier(3, { min: 25 })).some((e) => e.includes("duplicate min")));
  for (const min of [-1, 100, 101, 8.5, "8", null]) assert.notEqual(validateHungerDef(withTier(3, { min })).length, 0, String(min));
  assert.notEqual(validateHungerDef(def({ tiers: [def().tiers[0], null, def().tiers[4]] })).length, 0);
  assert.ok(validateHungerDef(withTier(1, { id: "Full" })).length > 0);
});

test("validator guardrails: never slower than -10%, regen never off, a status is a name, the lowest tier can eat", () => {
  for (const moveMult of [0.89, 0.5, 0, -1, NaN, 2.5, "1"]) assert.notEqual(validateHungerDef(withTier(4, { moveMult })).length, 0, "moveMult " + moveMult);
  assert.deepEqual(validateHungerDef(withTier(4, { moveMult: MIN_MOVE_MULT })), [], "exactly -10% is allowed");
  for (const k of ["regenMult", "staminaRegenMult"]) {
    for (const v of [0, 0.05, -1, NaN, Infinity, 2.01, "1"]) assert.notEqual(validateHungerDef(withTier(4, { [k]: v })).length, 0, k + " " + v);
    assert.deepEqual(validateHungerDef(withTier(4, { [k]: MIN_MULT })), []);
  }
  for (const status of ["Hungry", "", 5, undefined, {}, "x".repeat(25)]) assert.notEqual(validateHungerDef(withTier(3, { status })).length, 0, String(status));
  assert.ok(validateHungerDef(withTier(4, { canEat: false })).some((e) => e.includes("lowest tier must be able to eat")));
  assert.notEqual(validateHungerDef(withTier(4, { canEat: "yes" })).length, 0);
  assert.deepEqual(validateHungerDef(withTier(0, { canEat: true })), [], "other tiers may allow eating");
});

test("validator: reports a hostile definition without throwing; the constructor throws with every problem", () => {
  const hostile = { __proto__: { id: "x" }, id: { toString() { throw new Error("boom"); } }, tiers: [{ __proto__: null }] };
  assert.doesNotThrow(() => validateHungerDef(hostile));
  assert.doesNotThrow(() => validateHungerDef(JSON.parse('{"id":"hunger","max":100,"start":1,"drainSeconds":90,"tiers":[{"__proto__":{}}]}')));
  assert.throws(() => new Hunger(def({ max: 0, start: -1 })), /\[hunger\] invalid definition.*max must be.*start must be/s);
  assert.throws(() => new Hunger(null), /must be an object/);
});

// ---------------------------------------------------------------- tiers and drain
test("tierFor: boundaries are exact (a tier starts AT its min) and the whole range is covered", () => {
  const n = normalizeHungerDef(PRIMORDIA_HUNGER);
  const id = (v) => tierFor(n, v).id;
  assert.deepEqual([id(100), id(90), id(89.999), id(60), id(59.999), id(25), id(24.999), id(8), id(7.999), id(0)],
    ["stuffed", "stuffed", "full", "full", "not_hungry", "not_hungry", "hungry", "hungry", "starving", "starving"]);
  for (let v = 0; v <= 100; v += 0.25) assert.ok(tierFor(n, v), "a tier for " + v);
});

test("drain: 1 point per 90 s, 100 to 0 in 9000 s, and it floors at 0", () => {
  const h = at(100);
  h.update(90);
  assert.equal(h.value, 99);
  h.update(8910);
  assert.equal(h.value, 0);
  assert.equal(h.tierId, "starving");
  assert.equal(h.update(1e9), null);
  assert.equal(h.value, 0, "never negative, no spiral");
  assert.equal(new Hunger(def({ drainSeconds: 10 }), { value: 5 }).update(30), null, "same tier, no report");
});

test("update reports the tier change it caused, once, with plain data", () => {
  const h = at(100);
  assert.equal(h.update(900), null, "exactly 90 is still Stuffed");
  assert.equal(h.value, 90);
  assert.deepEqual(h.update(1), { from: "stuffed", to: "full" });
  assert.equal(h.update(1), null);
  assert.deepEqual(h.update(30 * 90), { from: "full", to: "not_hungry" }, "from 89.98 down to 59.98: crosses 60");
  const jump = at(100).update(9000);
  assert.deepEqual(jump, { from: "stuffed", to: "starving" }, "one big step skips tiers and reports the endpoints");
  assert.deepEqual(JSON.parse(JSON.stringify(jump)), jump);
});

test("update ignores a bad dt: not a number, NaN, infinite, zero, negative", () => {
  const h = at(50);
  for (const dt of [NaN, Infinity, -Infinity, 0, -1, "5", null, undefined, {}, [5], 1n]) {
    assert.equal(h.update(dt), null, String(typeof dt === "bigint" ? "bigint" : dt));
    assert.equal(h.value, 50);
  }
});

test("frame-rate independence (R10): the same sim time at 60, 30 and 1 steps per second gives the same value and tier", () => {
  const run = (dt, seconds) => { const h = at(100); for (let i = 0, n = Math.round(seconds / dt); i < n; i++) h.update(dt); return h; }; // whole steps: no loop-clock drift
  const a = run(1 / 60, 3500), b = run(1 / 30, 3500), c = run(1, 3500), d = at(100);
  d.update(3500);
  for (const x of [a, b, c]) {
    assert.ok(Math.abs(x.value - d.value) < 1e-6, `${x.value} vs ${d.value}`);
    assert.equal(x.tierId, d.tierId);
  }
  assert.ok(Math.abs(d.value - (100 - 3500 / 90)) < 1e-9);
  // Exactly ON a tier edge (3600 s = value 60) the last float bit may fall either side between frame rates: far less than a millisecond of play.
  const edge = run(1 / 60, 3600);
  assert.ok(Math.abs(edge.value - 60) < 1e-6);
});

test("tier multipliers and status follow the tier; a sweep of every value respects the hunger-law guardrails", () => {
  const cases = [[100, 1.05, 0.9, 1.05, "stuffed"], [75, 1.05, 1, 1.05, null], [40, 1, 1, 1, null], [10, 0.75, 0.95, 0.75, "hungry"], [0, 0.5, 0.9, 0.5, "starving"]];
  for (const [v, regen, move, stam, status] of cases) {
    const h = at(v);
    assert.deepEqual([h.regenMult, h.moveMult, h.staminaRegenMult, h.status], [regen, move, stam, status], "value " + v);
  }
  for (let v = 0; v <= 100; v += 0.5) {
    const h = at(v);
    assert.ok(h.moveMult >= 0.9, "never slower than -10% at " + v);
    assert.ok(h.regenMult >= 0.5 && h.staminaRegenMult >= 0.5, "regen is never switched off at " + v);
  }
  assert.ok(at(0).canEat, "food is always usable when starving");
});

test("hunger cannot hurt: the class has no damage, kill or health member", () => {
  const names = Object.getOwnPropertyNames(Hunger.prototype).join(" ").toLowerCase();
  assert.doesNotMatch(names, /damage|kill|hurt|hp|health|die|dead/);
  const h = at(0);
  for (const k of Object.keys(h)) assert.notEqual(typeof h[k], "function");
});

// ---------------------------------------------------------------- eating
test("eat: adds the amount, caps at max, reports what was gained and any tier change", () => {
  const h = at(30);
  assert.deepEqual(h.eat(15), { ok: true, gained: 15, value: 45, change: null });
  assert.deepEqual(h.eat(15), { ok: true, gained: 15, value: 60, change: { from: "not_hungry", to: "full" } });
  const g = at(89);
  assert.deepEqual(g.eat(45), { ok: true, gained: 11, value: 100, change: { from: "full", to: "stuffed" } }, "89 + 45 caps at 100, gained 11");
  assert.deepEqual(at(55).eat(45), { ok: true, gained: 45, value: 100, change: { from: "not_hungry", to: "stuffed" } });
  assert.equal(at(0).eat(15).value, 15, "starving can eat");
});

test("eat is refused while Stuffed and changes nothing; eating two cooked meats quickly reaches Stuffed", () => {
  const h = at(95);
  assert.deepEqual(h.eat(15), { ok: false, reason: "cannot_eat" });
  assert.equal(h.value, 95);
  const two = at(10);
  assert.equal(two.eat(45).ok, true);
  assert.equal(two.tierId, "not_hungry");
  assert.equal(two.eat(45).ok, true);
  assert.equal(two.tierId, "stuffed", "10 + 45 + 45 = 100");
  assert.equal(two.eat(45).reason, "cannot_eat");
  two.update(900 + 1);
  assert.equal(two.canEat, true, "after dropping below 90 it can eat again");
});

test("eat: a bad amount is refused and changes nothing", () => {
  const h = at(40);
  for (const amount of [0, -5, NaN, Infinity, -Infinity, 100.0001, 1e9, "15", null, undefined, {}, [15]]) {
    assert.deepEqual(h.eat(amount), { ok: false, reason: "invalid_amount" }, String(amount));
    assert.equal(h.value, 40);
  }
  assert.equal(h.eat(100).ok, true, "an amount of exactly max is allowed");
});

// ---------------------------------------------------------------- saves
test("serialize / restore: a plain, versioned round trip through the storage adapter contract", () => {
  const h = at(100);
  h.update(1234.5);
  const raw = h.serialize();
  assert.deepEqual(Object.keys(raw).sort(), ["id", "v", "value"]);
  assert.equal(raw.v, HUNGER_SAVE_VERSION);
  assert.deepEqual(JSON.parse(JSON.stringify(raw)), raw, "JSON safe");
  const storage = createMemoryStorage();
  storage.save(raw);
  const r = Hunger.restore(def(), storage.load());
  assert.equal(r.ok, true);
  assert.equal(r.hunger.value, h.value);
  assert.equal(r.hunger.tierId, h.tierId);
  assert.deepEqual(r.hunger.serialize(), raw);
  raw.value = 1;
  assert.notEqual(h.value, 1, "serialize returns a fresh copy");
});

test("restore refuses bad saves with a reason, touches nothing and never throws", () => {
  const ok = at(50).serialize();
  const cases = [
    ["corrupt", null], ["corrupt", undefined], ["corrupt", "x"], ["corrupt", []], ["corrupt", 5],
    ["corrupt", { ...ok, v: 0 }], ["corrupt", { ...ok, v: 1.5 }], ["corrupt", { ...ok, v: "1" }], ["corrupt", { id: ok.id, value: 5 }],
    ["corrupt", { ...ok, id: 5 }], ["corrupt", { ...ok, value: "50" }], ["corrupt", { ...ok, value: NaN }], ["corrupt", { ...ok, value: Infinity }],
    ["corrupt", { ...ok, value: -1 }], ["corrupt", { ...ok, value: 100.5 }], ["corrupt", { ...ok, value: null }],
    ["newer_version", { ...ok, v: HUNGER_SAVE_VERSION + 1 }], ["mismatch", { ...ok, id: "thirst" }],
  ];
  for (const [reason, raw] of cases) {
    const before = JSON.stringify(raw);
    assert.deepEqual(Hunger.restore(def(), raw), { ok: false, reason }, `${reason}: ${before}`);
    assert.equal(JSON.stringify(raw), before, "raw is untouched");
  }
  const frozen = Object.freeze({ ...ok });
  assert.equal(Hunger.restore(def(), frozen).ok, true, "a frozen save is fine");
  assert.throws(() => Hunger.restore(null, ok), /must be an object/, "a bad definition is a programming error and throws");
  assert.equal(Hunger.restore(def(), { ...ok, value: 0 }).ok, true, "the edges 0 and max are valid");
  assert.equal(Hunger.restore(def(), { ...ok, value: 100 }).ok, true);
});

test("constructor: starting value must be a number from 0 to max", () => {
  for (const value of [-1, 101, NaN, Infinity, "5", null]) assert.throws(() => new Hunger(def(), { value }), /starting value/, String(value));
  assert.equal(new Hunger(def(), { value: 0 }).value, 0);
  assert.equal(new Hunger(def(), {}).value, 85);
});

test("two Hungers with the same inputs stay identical and independent, and JSON.stringify of one holds no hidden members", () => {
  const a = new Hunger(def()), b = new Hunger(def());
  for (const h of [a, b]) { h.update(500); h.eat(15); h.update(77); }
  assert.deepEqual(a.serialize(), b.serialize());
  a.update(5000);
  assert.notEqual(a.value, b.value);
  assert.equal(JSON.stringify(a), "{}", "all state is #private, a snapshot cannot pick it up by accident");
});

// ---------------------------------------------------------------- server rules
test("Node import with no browser globals (R12): a child process imports the folder and runs a day", () => {
  const dir = fileURLToPath(new URL("../src/sim/hunger/", import.meta.url)).replace(/\\/g, "/");
  const script = `
    for (const g of ["window", "document", "localStorage", "requestAnimationFrame"]) { // (Node 22 itself defines navigator)
      if (typeof globalThis[g] !== "undefined") throw new Error("global " + g + " exists");
    }
    const { Hunger } = await import("file://${dir}Hunger.js");
    const { PRIMORDIA_HUNGER } = await import("file://${dir}definition.js");
    const { validateHungerDef } = await import("file://${dir}validateHunger.js");
    const h = new Hunger(PRIMORDIA_HUNGER);
    h.update(9000);
    if (h.tierId !== "starving" || h.value !== 0 || validateHungerDef(null).length !== 1) throw new Error("bad result " + h.tierId);
    console.log("child ok");`;
  const res = spawnSync(process.execPath, ["--input-type=module", "-e", script], { encoding: "utf8" });
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /child ok/);
});

test("source rule check: no browser, clock, Math.random or rng in src/sim/hunger (the audit counts the same)", () => {
  const dir = new URL("../src/sim/hunger/", import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith(".js"));
  assert.deepEqual(files.sort(), ["Hunger.js", "definition.js", "validateHunger.js"]);
  for (const f of files) {
    const code = readFileSync(new URL(f, dir), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    assert.doesNotMatch(code, /\bMath\.random\b|\brand\(|\brng\b|\bperformance\b|\bDate\b|\bsetTimeout\b|\bwindow\b|\bdocument\b|\blocalStorage\b|\bworld\.(?:player|input|game|camera)\b/, f);
  }
});

console.log(`\n${passed} tests passed`);
