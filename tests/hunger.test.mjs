// H1 / H1b: the pure hunger primitive (src/sim/hunger/). Not wired into the game, so these tests are the only proof it works.
//   node tests/hunger.test.mjs        (exit 0 = all passed)
// Covers: the Primordia tier table of FOUNDER.md section 6 in hunger points (1000 = 100%), the validator and its guardrails (a tier never
// slows more than 15%, no regeneration is switched off, mana stays separate), the drain math (1 point per 9 s, 1000 to 0 in 9000 s),
// every percentage edge of the design (0, 7, 8, 24, 25, 59, 60, 89, 90, 100), tier-change reports, frame-rate independence, eating
// (any tier below the maximum, exact fill, overflow report, refusal at the maximum, bad amounts), serialize / restore through the storage
// adapter contract, and a Node import with no globals.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createMemoryStorage } from "../src/sim/storage.js";
import { Hunger, tierFor, HUNGER_SAVE_VERSION } from "../src/sim/hunger/Hunger.js";
import { PRIMORDIA_HUNGER } from "../src/sim/hunger/definition.js";
import {
  validateHungerDef, normalizeHungerDef, MIN_MOVE_MULT, HUNGER_MOVE_FLOOR, MIN_MULT, MAX_TIERS, MAX_DRAIN_SECONDS,
} from "../src/sim/hunger/validateHunger.js";

let passed = 0;
const test = (name, fn) => (fn(), passed++, console.log("ok  " + name));

const clone = (o) => JSON.parse(JSON.stringify(o));
const def = (over = {}) => ({ ...clone(PRIMORDIA_HUNGER), ...over });
const withTier = (i, over) => { const d = def(); d.tiers[i] = { ...d.tiers[i], ...over }; return d; };
const at = (value) => new Hunger(def(), { value });
const pct = (p) => at(p * 10); // a Hunger at p percent

// ---------------------------------------------------------------- the data
test("the Primordia definition is valid and matches the FOUNDER.md tier table (in points)", () => {
  assert.deepEqual(validateHungerDef(PRIMORDIA_HUNGER), []);
  const n = normalizeHungerDef(PRIMORDIA_HUNGER);
  assert.equal(n.max, 1000);
  assert.equal(n.drainSeconds, 9);
  assert.deepEqual(n.tiers.map((t) => [t.id, t.min]), [["stuffed", 900], ["full", 600], ["not_hungry", 250], ["hungry", 80], ["starving", 0]]);
  const row = (id) => n.tiers.find((t) => t.id === id);
  const mults = (id) => { const t = row(id); return [t.hpRegenMult, t.manaRegenMult, t.staminaRegenMult, t.moveMult, t.status]; };
  assert.deepEqual(mults("stuffed"), [1.05, 1, 1, 0.9, "stuffed"]);
  assert.deepEqual(mults("full"), [1.05, 1, 1, 1, null]);
  assert.deepEqual(mults("not_hungry"), [1, 1, 1, 1, null]);
  assert.deepEqual(mults("hungry"), [0.75, 1, 0.75, 0.95, "hungry"]);
  assert.deepEqual(mults("starving"), [0.5, 1, 0.5, 0.85, "starving"]);
  for (const t of n.tiers) assert.equal(t.manaRegenMult, 1, "mana is unchanged in every tier until the owner sets values (R18)");
  assert.ok(!("canEat" in n.tiers[0]) && !("regenMult" in n.tiers[0]), "the old per-tier eat switch and the shared regen multiplier are gone");
});

test("the default start is 850 points (85%, Full), so a new character is not born Stuffed", () => {
  const h = new Hunger(PRIMORDIA_HUNGER);
  assert.equal(h.value, 850);
  assert.equal(h.percent, 85);
  assert.equal(h.tierId, "full");
  assert.equal(h.canEat, true);
});

test("normalize: frozen, tiers sorted high to low whatever the listed order, a fresh copy", () => {
  const d = def();
  d.tiers.reverse();
  const n = normalizeHungerDef(d);
  assert.deepEqual(n.tiers.map((t) => t.min), [900, 600, 250, 80, 0]);
  assert.ok(Object.isFrozen(n) && Object.isFrozen(n.tiers) && Object.isFrozen(n.tiers[0]));
  d.tiers[0].hpRegenMult = 1.9;
  assert.notEqual(n.tiers.find((t) => t.id === "starving").hpRegenMult, 1.9, "later edits of the source do not leak in");
});

// ---------------------------------------------------------------- the validator
test("validator: every field is required and unknown fields are refused", () => {
  for (const k of ["id", "max", "start", "drainSeconds", "tiers"]) {
    const d = def();
    delete d[k];
    assert.ok(validateHungerDef(d).some((e) => e.includes(`missing field "${k}"`)), k);
  }
  assert.ok(validateHungerDef({ ...def(), hacks: 1 }).some((e) => e.includes('unknown field "hacks"')));
  for (const k of ["id", "min", "hpRegenMult", "manaRegenMult", "staminaRegenMult", "moveMult", "status"]) {
    const d = def();
    delete d.tiers[1][k];
    assert.ok(validateHungerDef(d).some((e) => e.includes(`missing field "${k}"`)), k);
  }
  for (const k of ["damage", "canEat", "regenMult"]) {
    assert.ok(validateHungerDef(withTier(1, { [k]: 5 })).some((e) => e.includes(`unknown field "${k}"`)), "a tier cannot carry " + k);
  }
});

test("validator: not an object, bad ids, max, start and drain", () => {
  for (const bad of [null, undefined, 5, "x", [], () => 1]) assert.deepEqual(validateHungerDef(bad), ["definition must be an object"]);
  for (const id of ["", "H", "1a", "has space", "x".repeat(41), 5, null]) assert.notEqual(validateHungerDef(def({ id })).length, 0, String(id));
  for (const max of [0, -1, 1.5, 1001, "1000", null, NaN]) assert.notEqual(validateHungerDef(def({ max })).length, 0, String(max));
  for (const start of [-1, 1001, NaN, Infinity, "500", null]) assert.notEqual(validateHungerDef(def({ start })).length, 0, String(start));
  for (const drainSeconds of [0, 0.5, -9, MAX_DRAIN_SECONDS + 1, NaN, Infinity, "9", null]) assert.notEqual(validateHungerDef(def({ drainSeconds })).length, 0, String(drainSeconds));
});

test("validator: tier lists (size, duplicates, coverage from 0, ranges in points)", () => {
  assert.notEqual(validateHungerDef(def({ tiers: "x" })).length, 0);
  assert.notEqual(validateHungerDef(def({ tiers: [] })).length, 0);
  assert.notEqual(validateHungerDef(def({ tiers: [def().tiers[0]] })).length, 0, "needs at least two tiers");
  const many = Array.from({ length: MAX_TIERS + 1 }, (_, i) => ({ ...def().tiers[2], id: "t" + (i + 10), min: i }));
  assert.notEqual(validateHungerDef(def({ tiers: many })).length, 0);
  assert.ok(validateHungerDef(withTier(4, { min: 1 })).some((e) => e.includes("min 0")), "some tier must start at 0");
  assert.ok(validateHungerDef(withTier(3, { id: "starving" })).some((e) => e.includes("duplicate id")));
  assert.ok(validateHungerDef(withTier(3, { min: 250 })).some((e) => e.includes("duplicate min")));
  for (const min of [-1, 1000, 1001, 80.5, "80", null]) assert.notEqual(validateHungerDef(withTier(3, { min })).length, 0, String(min));
  assert.notEqual(validateHungerDef(def({ tiers: [def().tiers[0], null, def().tiers[4]] })).length, 0);
  assert.ok(validateHungerDef(withTier(1, { id: "Full" })).length > 0);
});

test("validator guardrails: a tier never slows more than 15%, no regeneration is off, a status is a name", () => {
  assert.equal(MIN_MOVE_MULT, 0.85);
  assert.equal(HUNGER_MOVE_FLOOR, 0.75, "the total floor of the hunger law is kept with the rest of the law");
  assert.ok(HUNGER_MOVE_FLOOR < MIN_MOVE_MULT, "statuses can push a little further than one tier, never below the total floor");
  for (const moveMult of [0.84, 0.5, 0, -1, NaN, 2.5, "1"]) assert.notEqual(validateHungerDef(withTier(4, { moveMult })).length, 0, "moveMult " + moveMult);
  assert.deepEqual(validateHungerDef(withTier(4, { moveMult: MIN_MOVE_MULT })), [], "exactly -15% is allowed");
  for (const k of ["hpRegenMult", "manaRegenMult", "staminaRegenMult"]) {
    for (const v of [0, 0.05, -1, NaN, Infinity, 2.01, "1"]) assert.notEqual(validateHungerDef(withTier(4, { [k]: v })).length, 0, k + " " + v);
    assert.deepEqual(validateHungerDef(withTier(4, { [k]: MIN_MULT })), []);
  }
  assert.deepEqual(validateHungerDef(withTier(3, { manaRegenMult: 0.8 })), [], "mana may differ from health once the owner sets it (R18): separate fields");
  for (const status of ["Hungry", "", 5, undefined, {}, "x".repeat(25)]) assert.notEqual(validateHungerDef(withTier(3, { status })).length, 0, String(status));
});

test("validator: reports a hostile definition without throwing; the constructor throws with every problem", () => {
  const hostile = { __proto__: { id: "x" }, id: { toString() { throw new Error("boom"); } }, tiers: [{ __proto__: null }] };
  assert.doesNotThrow(() => validateHungerDef(hostile));
  assert.doesNotThrow(() => validateHungerDef(JSON.parse('{"id":"hunger","max":1000,"start":1,"drainSeconds":9,"tiers":[{"__proto__":{}}]}')));
  assert.throws(() => new Hunger(def({ max: 0, start: -1 })), /\[hunger\] invalid definition.*max must be.*start must be/s);
  assert.throws(() => new Hunger(null), /must be an object/);
});

// ---------------------------------------------------------------- tiers and drain
test("tierFor: boundaries are exact in points (a tier starts AT its min) and the whole range is covered", () => {
  const n = normalizeHungerDef(PRIMORDIA_HUNGER);
  const id = (v) => tierFor(n, v).id;
  assert.deepEqual([id(1000), id(900), id(899.999), id(600), id(599.999), id(250), id(249.999), id(80), id(79.999), id(0)],
    ["stuffed", "stuffed", "full", "full", "not_hungry", "not_hungry", "hungry", "hungry", "starving", "starving"]);
  for (let v = 0; v <= 1000; v += 2.5) assert.ok(tierFor(n, v), "a tier for " + v);
});

test("the ten percentage edges of the design: 0, 7, 8, 24, 25, 59, 60, 89, 90 and 100 percent land in the right tier", () => {
  const edges = [[0, "starving"], [7, "starving"], [8, "hungry"], [24, "hungry"], [25, "not_hungry"], [59, "not_hungry"], [60, "full"], [89, "full"], [90, "stuffed"], [100, "stuffed"]];
  for (const [p, tier] of edges) {
    const h = pct(p);
    assert.equal(h.tierId, tier, `${p}%`);
    assert.equal(h.percent, p, `percent of ${p}%`);
  }
});

test("percent for the HUD: rounded down, and 100 only when the stat really is at its maximum", () => {
  assert.equal(at(999.9).percent, 99);
  assert.equal(at(1000).percent, 100);
  assert.equal(at(0).percent, 0);
  assert.equal(at(9.99).percent, 0);
  assert.equal(at(10).percent, 1);
  assert.equal(new Hunger(def({ max: 200, start: 100, tiers: [{ ...def().tiers[4] }, { ...def().tiers[0], min: 150 }] })).percent, 50, "any maximum, not only 1000");
});

test("drain: 1 point per 9 s, 1000 to 0 in 9000 s, and it floors at 0", () => {
  const h = at(1000);
  h.update(9);
  assert.equal(h.value, 999);
  h.update(8991);
  assert.equal(h.value, 0);
  assert.equal(h.tierId, "starving");
  assert.equal(h.update(1e9), null);
  assert.equal(h.value, 0, "never negative, no spiral");
  assert.equal(new Hunger(def({ drainSeconds: 10 }), { value: 50 }).update(30), null, "same tier, no report");
});

test("update reports the tier change it caused, once, with plain data", () => {
  const h = at(1000);
  assert.equal(h.update(900), null, "exactly 900 points is still Stuffed");
  assert.equal(h.value, 900);
  assert.deepEqual(h.update(1), { from: "stuffed", to: "full" });
  assert.equal(h.update(1), null);
  assert.deepEqual(h.update(300 * 9), { from: "full", to: "not_hungry" }, "from about 899.8 down to about 599.8: crosses 600");
  const jump = at(1000).update(9000);
  assert.deepEqual(jump, { from: "stuffed", to: "starving" }, "one big step skips tiers and reports the endpoints");
  assert.deepEqual(JSON.parse(JSON.stringify(jump)), jump);
});

test("update ignores a bad dt: not a number, NaN, infinite, zero, negative", () => {
  const h = at(500);
  for (const dt of [NaN, Infinity, -Infinity, 0, -1, "5", null, undefined, {}, [5], 1n]) {
    assert.equal(h.update(dt), null, String(typeof dt === "bigint" ? "bigint" : dt));
    assert.equal(h.value, 500);
  }
});

test("frame-rate independence (R10): the same sim time at 60, 30 and 1 steps per second gives the same value and tier", () => {
  const run = (dt, seconds) => { const h = at(1000); for (let i = 0, n = Math.round(seconds / dt); i < n; i++) h.update(dt); return h; }; // whole steps: no loop-clock drift
  const a = run(1 / 60, 3500), b = run(1 / 30, 3500), c = run(1, 3500), d = at(1000);
  d.update(3500);
  for (const x of [a, b, c]) {
    assert.ok(Math.abs(x.value - d.value) < 1e-6, `${x.value} vs ${d.value}`);
    assert.equal(x.tierId, d.tierId);
  }
  assert.ok(Math.abs(d.value - (1000 - 3500 / 9)) < 1e-9);
  // Exactly ON a tier edge (3600 s = 400 points drained = value 600) the last float bit may fall either side between frame rates.
  const edge = run(1 / 60, 3600);
  assert.ok(Math.abs(edge.value - 600) < 1e-6);
});

test("multipliers follow the tier, one per stat; a sweep of every value respects the hunger-law guardrails", () => {
  const cases = [[1000, 1.05, 1, 1, 0.9, "stuffed"], [750, 1.05, 1, 1, 1, null], [400, 1, 1, 1, 1, null], [100, 0.75, 1, 0.75, 0.95, "hungry"], [0, 0.5, 1, 0.5, 0.85, "starving"]];
  for (const [v, hp, mana, stam, move, status] of cases) {
    const h = at(v);
    assert.deepEqual([h.hpRegenMult, h.manaRegenMult, h.staminaRegenMult, h.moveMult, h.status], [hp, mana, stam, move, status], "value " + v);
  }
  for (let v = 0; v <= 1000; v += 5) {
    const h = at(v);
    assert.ok(h.moveMult >= MIN_MOVE_MULT, "never slower than -15% per tier at " + v);
    assert.ok(h.hpRegenMult >= 0.5 && h.staminaRegenMult >= 0.5 && h.manaRegenMult >= 0.5, "regeneration is never switched off at " + v);
    assert.ok(h.canEat === (v < 1000), "food is usable in every tier below the maximum at " + v);
  }
});

test("the Hunger class has no damage, kill or health member (hunger damage will come from statuses, FOUNDER.md 6b)", () => {
  const names = Object.getOwnPropertyNames(Hunger.prototype).join(" ").toLowerCase();
  assert.doesNotMatch(names, /damage|kill|hurt|hp(?!regen)|health|die|dead/);
  const h = at(0);
  for (const k of Object.keys(h)) assert.notEqual(typeof h[k], "function");
});

// ---------------------------------------------------------------- eating
test("eat: adds the points in any tier below the maximum and reports what was gained and any tier change", () => {
  const h = at(300);
  assert.deepEqual(h.eat(150), { ok: true, gained: 150, value: 450, overeat: false, excess: 0, change: null });
  assert.deepEqual(h.eat(150), { ok: true, gained: 150, value: 600, overeat: false, excess: 0, change: { from: "not_hungry", to: "full" } });
  assert.equal(at(0).eat(150).value, 150, "starving can eat");
  assert.equal(at(100).eat(150).ok, true, "hungry can eat");
  const stuffed = at(950);
  assert.deepEqual(stuffed.eat(30), { ok: true, gained: 30, value: 980, overeat: false, excess: 0, change: null }, "Stuffed may eat: it is the risk (R13)");
});

test("eat: reaching the maximum exactly is not an overflow; one point more is", () => {
  const exact = at(550).eat(450);
  assert.deepEqual(exact, { ok: true, gained: 450, value: 1000, overeat: false, excess: 0, change: { from: "not_hungry", to: "stuffed" } });
  const over = at(551).eat(450);
  assert.deepEqual(over, { ok: true, gained: 449, value: 1000, overeat: true, excess: 1, change: { from: "not_hungry", to: "stuffed" } });
  assert.deepEqual(at(950).eat(100), { ok: true, gained: 50, value: 1000, overeat: true, excess: 50, change: null }, "an overflow inside Stuffed has no tier change");
  assert.equal(at(999.5).eat(1).overeat, true);
});

test("eat is refused at the maximum and changes nothing; after a little drain food fits again", () => {
  const h = at(1000);
  assert.deepEqual(h.eat(150), { ok: false, reason: "cannot_eat" });
  assert.equal(h.value, 1000);
  assert.equal(h.canEat, false);
  h.update(9);
  assert.equal(h.canEat, true, "below the maximum food is accepted again (HS1 blocks it while the Overeating status runs, R13)");
  assert.deepEqual(h.eat(1), { ok: true, gained: 1, value: 1000, overeat: false, excess: 0, change: null });
});

test("eat: a bad amount is refused and changes nothing", () => {
  const h = at(400);
  for (const points of [0, -5, NaN, Infinity, -Infinity, 1000.0001, 1e9, "150", null, undefined, {}, [150]]) {
    assert.deepEqual(h.eat(points), { ok: false, reason: "invalid_amount" }, String(points));
    assert.equal(h.value, 400);
  }
  assert.equal(h.eat(1000).ok, true, "an amount of exactly max is allowed");
  assert.equal(h.value, 1000);
});

test("the design's meal sizes: Raw Meat 150 and Cooked Meat 450 points (provisional) move the stat as planned", () => {
  const h = at(300);
  h.eat(450);
  assert.equal(h.percent, 75);
  assert.equal(h.tierId, "full");
  assert.equal(at(550).eat(450).change.to, "stuffed", "one Cooked Meat from 55% reaches Stuffed (FOUNDER.md decision 6)");
  const raw = at(300);
  raw.eat(150);
  assert.equal(raw.percent, 45);
});

// ---------------------------------------------------------------- saves
test("serialize / restore: a plain, versioned round trip through the storage adapter contract", () => {
  const h = at(1000);
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
  const ok = at(500).serialize();
  const cases = [
    ["corrupt", null], ["corrupt", undefined], ["corrupt", "x"], ["corrupt", []], ["corrupt", 5],
    ["corrupt", { ...ok, v: 0 }], ["corrupt", { ...ok, v: 1.5 }], ["corrupt", { ...ok, v: "1" }], ["corrupt", { id: ok.id, value: 5 }],
    ["corrupt", { ...ok, id: 5 }], ["corrupt", { ...ok, value: "500" }], ["corrupt", { ...ok, value: NaN }], ["corrupt", { ...ok, value: Infinity }],
    ["corrupt", { ...ok, value: -1 }], ["corrupt", { ...ok, value: 1000.5 }], ["corrupt", { ...ok, value: null }],
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
  assert.equal(Hunger.restore(def(), { ...ok, value: 1000 }).ok, true);
});

test("constructor: starting value must be a number from 0 to max", () => {
  for (const value of [-1, 1001, NaN, Infinity, "5", null]) assert.throws(() => new Hunger(def(), { value }), /starting value/, String(value));
  assert.equal(new Hunger(def(), { value: 0 }).value, 0);
  assert.equal(new Hunger(def(), {}).value, 850);
});

test("two Hungers with the same inputs stay identical and independent, and JSON.stringify of one holds no hidden members", () => {
  const a = new Hunger(def()), b = new Hunger(def());
  for (const h of [a, b]) { h.update(500); h.eat(150); h.update(77); }
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
