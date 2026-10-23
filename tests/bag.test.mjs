// M1: the pure bag primitive (src/sim/bag/). Not wired into the game, so these tests are the only proof it works.
//   node tests/bag.test.mjs        (exit 0 = all passed)
// Covers the stage's "done when" list (docs/proposals/ASSESSMENT.md section 4): exact counts per cycle, the 6-token cycle, refill and
// empty behaviour, a serialize round trip, an unbiased and reproducible shuffle with a controlled RNG, and a Node import with no globals.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Rng } from "../src/sim/rng.js";
import { Bag, BAG_SAVE_VERSION } from "../src/sim/bag/Bag.js";
import { validateBagDef, normalizeBagDef, MAX_POOL, MAX_TOKEN_COUNT, MAX_TOKEN_KINDS } from "../src/sim/bag/validateBag.js";
import { ScriptedRng } from "./helpers.mjs";

let passed = 0;
const test = (name, fn) => (fn(), passed++, console.log("ok  " + name));

const crit = (over = {}) => ({ id: "combat_crit", scope: "entity", tokens: { NORMAL: 4, CRIT: 2 }, refill: "refill_shuffle", hidden: true, ...over });
/** An Rng that counts how often next() was called. */
class CountingRng extends Rng {
  calls = 0;
  next() { this.calls++; return super.next(); }
}
const drawAll = (bag, n) => Array.from({ length: n }, () => bag.draw());
const tokens = (results) => results.map((r) => r.token);

// ---------------------------------------------------------------- the validator
test("validator: the proposal's 4 NORMAL + 2 CRIT bag and a 22 + 3 bag are valid", () => {
  assert.deepEqual(validateBagDef(crit()), []);
  assert.deepEqual(validateBagDef(crit({ tokens: { NORMAL: 22, CRIT: 3 }, refill: "no_refill", hidden: false })), []);
  const n = normalizeBagDef(crit({ tokens: { CRIT: 2, NORMAL: 4 } })); // key order must not matter
  assert.deepEqual(n.tokens, [["CRIT", 2], ["NORMAL", 4]]);
  assert.ok(Object.isFrozen(n) && Object.isFrozen(n.tokens) && Object.isFrozen(n.tokens[0]));
});

test("validator: every field is required and unknown fields are refused", () => {
  for (const k of ["id", "scope", "tokens", "refill", "hidden"]) {
    const d = crit();
    delete d[k];
    assert.ok(validateBagDef(d).some((e) => e.includes(`missing field "${k}"`)), k);
  }
  assert.ok(validateBagDef(crit({ secret: 1 })).some((e) => e.includes('unknown field "secret"')));
});

test("validator: bad ids, scopes, policies and flags", () => {
  for (const id of ["", "A", "1abc", "has space", "x".repeat(41), "a", 5, null, undefined, {}]) assert.notEqual(validateBagDef(crit({ id })).length, 0, String(id));
  for (const scope of ["", "global", "ENTITY", 1, null]) assert.notEqual(validateBagDef(crit({ scope })).length, 0, String(scope));
  for (const refill of ["", "persistent", "single_use", "refill", 0, null]) assert.notEqual(validateBagDef(crit({ refill })).length, 0, String(refill));
  for (const hidden of ["true", 1, 0, null, undefined]) assert.notEqual(validateBagDef(crit({ hidden })).length, 0, String(hidden));
});

test("validator: token names, counts, kinds and the pool bound", () => {
  const bad = (tokens) => validateBagDef(crit({ tokens })).length > 0;
  for (const t of [null, [], "NORMAL", 4, {}]) assert.ok(bad(t), JSON.stringify(t));
  for (const name of ["normal", "Normal", "1A", "A-B", "", "X".repeat(25), " A"]) assert.ok(bad({ [name]: 1 }), name);
  assert.ok(bad(JSON.parse('{"__proto__": 1}')), "an own __proto__ key is refused");
  for (const n of [0, -1, 1.5, NaN, Infinity, "2", null, MAX_TOKEN_COUNT + 1]) assert.ok(bad({ A: n }), String(n));
  assert.ok(!bad({ A: MAX_TOKEN_COUNT }));
  const kinds = (k) => Object.fromEntries(Array.from({ length: k }, (_, i) => ["K" + i, 1]));
  assert.ok(!bad(kinds(MAX_TOKEN_KINDS)));
  assert.ok(bad(kinds(MAX_TOKEN_KINDS + 1)));
  assert.ok(!bad({ A: MAX_POOL }));
  assert.ok(bad({ A: MAX_POOL - 1, B: 2 }), "one token over the pool bound");
});

test("validator: junk input is a list of problems, never an exception", () => {
  for (const junk of [null, undefined, 5, "x", true, [], [1], () => 1, new Date(), new Map(), Symbol.iterator]) {
    const errs = validateBagDef(junk);
    assert.ok(Array.isArray(errs) && errs.length > 0, String(junk));
  }
});

test("constructor: an invalid definition or a missing rng throws, listing the problems", () => {
  assert.throws(() => new Bag(crit({ id: "BAD", refill: "x" }), { rng: new Rng(1) }), /invalid definition.*id must match.*refill must be one of/);
  assert.throws(() => new Bag(crit(), {}), /needs an rng/);
  assert.throws(() => new Bag(crit()), /needs an rng/);
  assert.throws(() => new Bag(crit(), { rng: { next: 5 } }), /needs an rng/);
  assert.throws(() => Bag.restore({ nope: 1 }, null, { rng: new Rng(1) }), /invalid definition/, "a bad definition is a programming error, not data");
});

// ---------------------------------------------------------------- counts, cycles, shuffle
test("fresh bag: nothing dealt, counts exact, and building it never touches the rng", () => {
  const rng = new CountingRng(1);
  const bag = new Bag(crit(), { rng });
  assert.equal(bag.remaining(), 6);
  assert.deepEqual(bag.counts(), { CRIT: 2, NORMAL: 4 });
  assert.equal(bag.cycle, 0);
  assert.equal(bag.id, "combat_crit");
  assert.equal(bag.scope, "entity");
  assert.equal(bag.hidden, true);
  assert.equal(rng.calls, 0);
});

test("6-token cycle: exactly 4 NORMAL and 2 CRIT for 400 different seeds, counts fall by one per draw", () => {
  for (let seed = 1; seed <= 400; seed++) {
    const bag = new Bag(crit(), { rng: new Rng(seed) });
    const out = drawAll(bag, 6);
    assert.ok(out.every((r) => r.ok && r.cycle === 1));
    assert.deepEqual(out.map((r) => r.left), [5, 4, 3, 2, 1, 0]);
    const t = tokens(out);
    assert.equal(t.filter((x) => x === "NORMAL").length, 4, "seed " + seed);
    assert.equal(t.filter((x) => x === "CRIT").length, 2, "seed " + seed);
  }
  const bag = new Bag(crit(), { rng: new Rng(5) });
  let crits = 2, normals = 4;
  for (let i = 0; i < 6; i++) {
    const { token } = bag.draw();
    token === "CRIT" ? crits-- : normals--;
    assert.deepEqual(bag.counts(), { CRIT: crits, NORMAL: normals });
    assert.equal(bag.remaining(), 5 - i);
  }
});

test("shuffle: Fisher-Yates from the end, n-1 calls to next(), pinned with a scripted rng", () => {
  // Tokens start sorted: CRIT CRIT NORMAL NORMAL NORMAL NORMAL. next() = 0 always swaps with index 0.
  const zero = new Bag(crit(), { rng: new ScriptedRng(0) });
  assert.deepEqual(tokens(drawAll(zero, 6)), ["CRIT", "NORMAL", "NORMAL", "NORMAL", "NORMAL", "CRIT"]);
  // next() just below 1 always swaps an index with itself: the sorted order survives.
  const high = new Bag(crit(), { rng: new ScriptedRng(0.9999999) });
  assert.deepEqual(tokens(drawAll(high, 6)), ["CRIT", "CRIT", "NORMAL", "NORMAL", "NORMAL", "NORMAL"]);
  // Key order of the definition does not change the starting order.
  const flipped = new Bag(crit({ tokens: { CRIT: 2, NORMAL: 4 } }), { rng: new ScriptedRng(0.9999999) });
  assert.deepEqual(tokens(drawAll(flipped, 6)), ["CRIT", "CRIT", "NORMAL", "NORMAL", "NORMAL", "NORMAL"]);
  const rng = new CountingRng(3);
  const bag = new Bag(crit(), { rng });
  bag.draw();
  assert.equal(rng.calls, 5, "one deal of 6 tokens = 5 calls");
  drawAll(bag, 5);
  assert.equal(rng.calls, 5, "no randomness is used between deals");
});

test("shuffle is unbiased: all 6 orders of three tokens and every crit position come up evenly", () => {
  const N = 60000, orders = new Map(), pos = [0, 0, 0, 0, 0, 0];
  for (let seed = 1; seed <= N; seed++) {
    const abc = new Bag({ id: "three", scope: "world", tokens: { A: 1, B: 1, C: 1 }, refill: "no_refill", hidden: false }, { rng: new Rng(seed) });
    const key = tokens(drawAll(abc, 3)).join("");
    orders.set(key, (orders.get(key) || 0) + 1);
    const bag = new Bag(crit(), { rng: new Rng(seed + 7_000_000) });
    tokens(drawAll(bag, 6)).forEach((t, i) => { if (t === "CRIT") pos[i]++; });
  }
  assert.equal(orders.size, 6);
  for (const [k, n] of orders) assert.ok(Math.abs(n - N / 6) < 400, `${k}: ${n}`); // 4 standard deviations is about 365
  for (const n of pos) assert.ok(Math.abs(n - N / 3) < 600, `crit position count ${n}`); // sd is about 163
});

test("the proposal's odds: first draw CRIT is 2/6, and 2/5 after one NORMAL", () => {
  const N = 30000;
  let first = 0, afterNormal = 0, normalFirst = 0;
  for (let seed = 1; seed <= N; seed++) {
    const bag = new Bag(crit(), { rng: new Rng(seed) });
    const a = bag.draw().token;
    if (a === "CRIT") first++;
    else {
      normalFirst++;
      if (bag.draw().token === "CRIT") afterNormal++;
    }
  }
  assert.ok(Math.abs(first / N - 2 / 6) < 0.012, `first ${first / N}`);
  assert.ok(Math.abs(afterNormal / normalFirst - 2 / 5) < 0.015, `second ${afterNormal / normalFirst}`);
});

test("same seed = same draws; a different seed differs; draws never use Math.random", () => {
  const run = (seed) => tokens(drawAll(new Bag(crit(), { rng: new Rng(seed) }), 60));
  assert.deepEqual(run(11), run(11));
  assert.notDeepEqual(run(11), run(12));
  const real = Math.random;
  Math.random = () => { throw new Error("Math.random called"); };
  try { assert.deepEqual(run(11), run(11)); } finally { Math.random = real; }
});

// ---------------------------------------------------------------- refill and empty
test("refill_shuffle: every cycle is exact, a cycle is dealt only when the next draw needs it", () => {
  const rng = new CountingRng(21);
  const bag = new Bag(crit(), { rng });
  for (let cycle = 1; cycle <= 6; cycle++) {
    const out = drawAll(bag, 6);
    assert.ok(out.every((r) => r.ok && r.cycle === cycle));
    const t = tokens(out);
    assert.equal(t.filter((x) => x === "CRIT").length, 2, "cycle " + cycle);
    assert.equal(t.filter((x) => x === "NORMAL").length, 4, "cycle " + cycle);
    assert.equal(bag.remaining(), 0, "between cycles it shows 0 left");
    assert.deepEqual(bag.counts(), { CRIT: 0, NORMAL: 0 });
    assert.equal(rng.calls, 5 * cycle);
  }
  assert.equal(bag.cycle, 6);
  assert.equal(bag.draw().cycle, 7);
});

test("no_refill: the first cycle is dealt, then every draw answers empty and changes nothing", () => {
  const rng = new CountingRng(8);
  const bag = new Bag(crit({ refill: "no_refill" }), { rng });
  const out = drawAll(bag, 6);
  assert.ok(out.every((r) => r.ok));
  assert.equal(tokens(out).filter((x) => x === "CRIT").length, 2);
  const callsAfter = rng.calls, saved = JSON.stringify(bag.serialize());
  for (let i = 0; i < 5; i++) assert.deepEqual(bag.draw(), { ok: false, reason: "empty" });
  assert.equal(rng.calls, callsAfter, "an empty draw uses no randomness");
  assert.equal(JSON.stringify(bag.serialize()), saved);
  assert.equal(bag.remaining(), 0);
  assert.equal(bag.cycle, 1);
  assert.deepEqual(bag.counts(), { CRIT: 0, NORMAL: 0 });
});

test("largest allowed bag deals and refills", () => {
  const bag = new Bag({ id: "big", scope: "world", tokens: { A: MAX_POOL - 1, B: 1 }, refill: "refill_shuffle", hidden: true }, { rng: new Rng(2) });
  const t = tokens(drawAll(bag, MAX_POOL));
  assert.equal(t.filter((x) => x === "B").length, 1);
  assert.equal(bag.draw().cycle, 2);
});

// ---------------------------------------------------------------- serialize and restore
test("serialize: plain JSON data, versioned, a fresh copy; undealt is pool null", () => {
  const bag = new Bag(crit(), { rng: new Rng(4) });
  assert.deepEqual(bag.serialize(), { v: BAG_SAVE_VERSION, id: "combat_crit", cycle: 0, pool: null });
  bag.draw();
  const s = bag.serialize();
  assert.equal(s.cycle, 1);
  assert.equal(s.pool.length, 5);
  assert.deepEqual(JSON.parse(JSON.stringify(s)), s);
  s.pool.length = 0; // changing the copy must not change the bag
  assert.equal(bag.remaining(), 5);
  assert.equal(bag.serialize().pool.length, 5);
  const c = bag.counts();
  c.CRIT = 99;
  assert.ok(bag.counts().CRIT <= 2, "counts() is a copy");
});

test("round trip mid-cycle through JSON: the restored bag continues exactly like the original, into the next cycles", () => {
  const rngA = new Rng(5);
  const a = new Bag(crit(), { rng: rngA });
  drawAll(a, 8); // cycle 1 done, two tokens into cycle 2
  const saved = JSON.parse(JSON.stringify(a.serialize()));
  const rngB = new Rng(0);
  rngB.setState(rngA.state());
  const r = Bag.restore(crit(), saved, { rng: rngB });
  assert.equal(r.ok, true);
  assert.equal(r.bag.cycle, 2);
  assert.equal(r.bag.remaining(), 4);
  assert.deepEqual(r.bag.counts(), a.counts());
  assert.deepEqual(r.bag.draw(), a.draw());
  assert.deepEqual(tokens(drawAll(r.bag, 30)), tokens(drawAll(a, 30)));
  assert.deepEqual(r.bag.serialize(), a.serialize());
});

test("round trip at the edges: undealt, exactly exhausted, and a refilled bag", () => {
  const fresh = Bag.restore(crit(), new Bag(crit(), { rng: new Rng(1) }).serialize(), { rng: new Rng(9) });
  assert.equal(fresh.ok, true);
  assert.equal(fresh.bag.cycle, 0);
  assert.equal(fresh.bag.remaining(), 6);
  assert.deepEqual(tokens(drawAll(fresh.bag, 6)).sort(), ["CRIT", "CRIT", "NORMAL", "NORMAL", "NORMAL", "NORMAL"]);

  const spent = new Bag(crit({ refill: "no_refill" }), { rng: new Rng(1) });
  drawAll(spent, 6);
  const sv = spent.serialize();
  assert.deepEqual(sv.pool, []);
  const back = Bag.restore(crit({ refill: "no_refill" }), sv, { rng: new Rng(2) });
  assert.equal(back.ok, true);
  assert.deepEqual(back.bag.draw(), { ok: false, reason: "empty" });

  const refills = new Bag(crit(), { rng: new Rng(1) });
  drawAll(refills, 6);
  const rb = Bag.restore(crit(), refills.serialize(), { rng: new Rng(3) });
  assert.equal(rb.ok, true);
  assert.equal(rb.bag.draw().cycle, 2, "an exhausted refill bag deals the next cycle on its next draw");
});

test("restore refuses bad saves with a reason, builds no bag, never touches the rng or the input", () => {
  const live = new Bag(crit(), { rng: new Rng(6) });
  drawAll(live, 2);
  const good = live.serialize();
  const rng = new CountingRng(1);
  const cases = {
    corrupt: [null, undefined, 5, "x", [], { ...good, v: 0 }, { ...good, v: 1.5 }, { ...good, v: "1" }, { ...good, id: 7 },
      { ...good, cycle: -1 }, { ...good, cycle: 1.5 }, { ...good, cycle: NaN }, { ...good, cycle: "1" },
      { ...good, cycle: 0 }, // dealt pool but "nothing dealt"
      { ...good, pool: null }, { ...good, pool: "CRIT" }, { ...good, pool: ["CRIT", 5] }, { ...good, pool: {} }],
    newer_version: [{ ...good, v: BAG_SAVE_VERSION + 1 }, { v: 99, anything: true }],
    mismatch: [{ ...good, id: "other_bag" }, { ...good, pool: ["CRIT", "BOGUS"] }, { ...good, pool: ["CRIT", "CRIT", "CRIT"] },
      { ...good, pool: ["NORMAL", "NORMAL", "NORMAL", "NORMAL", "NORMAL"] }, { ...good, pool: new Array(7).fill("NORMAL") },
      { ...good, pool: ["constructor"] }, { ...good, pool: ["__proto__"] }],
  };
  for (const [reason, list] of Object.entries(cases)) {
    for (const raw of list) {
      const res = Bag.restore(crit(), raw, { rng });
      assert.deepEqual(res, { ok: false, reason }, JSON.stringify(raw));
    }
  }
  assert.equal(rng.calls, 0);
  const frozen = JSON.parse(JSON.stringify(good));
  Object.freeze(frozen.pool);
  Object.freeze(frozen);
  assert.equal(Bag.restore(crit(), frozen, { rng }).ok, true, "a frozen save is read, never written");
});

test("restore after a definition change: a smaller pool still fits, a token the definition lost does not", () => {
  const live = new Bag(crit(), { rng: new Rng(6) });
  drawAll(live, 4); // 2 tokens left
  const saved = live.serialize();
  const wider = Bag.restore(crit({ tokens: { NORMAL: 22, CRIT: 3 } }), saved, { rng: new Rng(1) });
  assert.equal(wider.ok, true);
  assert.equal(wider.bag.remaining(), 2);
  const lost = Bag.restore(crit({ tokens: { NORMAL: 4, MISS: 2 } }), { ...saved, pool: ["CRIT", "NORMAL"] }, { rng: new Rng(1) });
  assert.deepEqual(lost, { ok: false, reason: "mismatch" });
});

// ---------------------------------------------------------------- hidden state and isolation
test("hidden state: the bag stringifies to nothing, has no public fields, and the definition is copied", () => {
  const def = crit();
  const bag = new Bag(def, { rng: new Rng(1) });
  drawAll(bag, 2);
  assert.equal(JSON.stringify(bag), "{}");
  assert.deepEqual(Object.keys(bag), []);
  assert.deepEqual(Object.getOwnPropertyNames(bag), []);
  assert.equal(JSON.stringify({ entity: { hp: 5, bag } }), '{"entity":{"hp":5,"bag":{}}}');
  def.tokens.CRIT = 500; // editing the caller's object afterwards changes nothing
  def.id = "changed";
  assert.equal(bag.id, "combat_crit");
  assert.equal(bag.remaining(), 4);
  assert.deepEqual(bag.counts().CRIT + bag.counts().NORMAL, 4);
});

test("two bags with one rng share its stream; two bags with the same seed stay independent of each other", () => {
  const a = new Bag(crit(), { rng: new Rng(3) }), b = new Bag(crit(), { rng: new Rng(3) });
  const ta = tokens(drawAll(a, 12));
  assert.deepEqual(tokens(drawAll(b, 12)), ta, "drawing one bag does not move another");
  const shared = new Rng(3);
  const c = new Bag(crit(), { rng: shared }), d = new Bag(crit(), { rng: shared });
  assert.deepEqual(tokens(drawAll(c, 6)), ta.slice(0, 6));
  assert.notDeepEqual(tokens(drawAll(d, 6)), ta.slice(0, 6), "d dealt from the stream after c, so its order differs");
});

// ---------------------------------------------------------------- server rules
test("Node import with no browser globals (R12): a child process imports the folder and draws", () => {
  const dir = fileURLToPath(new URL("../src/sim/bag/", import.meta.url)).replace(/\\/g, "/");
  const script = `
    for (const g of ["window", "document", "localStorage", "requestAnimationFrame"]) { // (Node 22 itself defines navigator)
      if (typeof globalThis[g] !== "undefined") throw new Error("global " + g + " exists");
    }
    const { Bag } = await import("file://${dir}Bag.js");
    const { validateBagDef } = await import("file://${dir}validateBag.js");
    let x = 1;
    const rng = { next() { x = (x * 16807) % 2147483647; return x / 2147483647; } };
    const bag = new Bag({ id: "node_bag", scope: "world", tokens: { A: 2, B: 1 }, refill: "refill_shuffle", hidden: true }, { rng });
    const t = [bag.draw(), bag.draw(), bag.draw()].map((r) => r.token).sort().join("");
    if (t !== "AAB" || validateBagDef(null).length !== 1) throw new Error("bad result " + t);
    console.log("child ok");`;
  const res = spawnSync(process.execPath, ["--input-type=module", "-e", script], { encoding: "utf8" });
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /child ok/);
});

test("source rule check: no browser, clock or Math.random in src/sim/bag (the audit counts the same)", () => {
  const dir = new URL("../src/sim/bag/", import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith(".js"));
  assert.deepEqual(files.sort(), ["Bag.js", "validateBag.js"]);
  for (const f of files) {
    const code = readFileSync(new URL(f, dir), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    assert.doesNotMatch(code, /\bMath\.random\b|\brand\(|\bperformance\b|\bDate\b|\bsetTimeout\b|\bwindow\b|\bdocument\b|\blocalStorage\b|\bworld\.(?:player|input|game|camera)\b/, f);
  }
});

console.log(`\n${passed} tests passed`);
