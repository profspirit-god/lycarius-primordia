// S1g: the storage adapter contract and the two adapters.
//   node tests/storage.test.mjs        (exit 0 = all passed)
// Progression itself is pinned in mage.test.mjs; this file covers the adapters and the "no browser in the sim" rule.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createMemoryStorage } from "../src/sim/storage.js";
import { createLocalStorageAdapter, PROGRESS_KEY } from "../src/core/LocalStorageAdapter.js";

let passed = 0;
const test = (name, fn) => (fn(), passed++, console.log("ok  " + name));

/** Map-backed stand-in for the two Storage methods the adapter uses. */
const fakeBacking = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => void m.set(k, String(v)), m };
};

test("memory adapter: empty is null, save/load round-trips a copy, clear empties", () => {
  const s = createMemoryStorage();
  assert.equal(s.load(), null);
  const data = { v: 1, classes: { mage: { charXp: 3, picks: { 2: "mana" } } } };
  s.save(data);
  assert.deepEqual(s.load(), data);
  data.classes.mage.charXp = 99;
  assert.equal(s.load().classes.mage.charXp, 3, "mutating the saved object does not change the store");
  s.load().classes.mage.charXp = 77;
  assert.equal(s.load().classes.mage.charXp, 3, "mutating a loaded object does not change the store");
  s.clear();
  assert.equal(s.load(), null);
});

test("memory adapter: initial value, and a value that is not plain data keeps the previous save", () => {
  assert.deepEqual(createMemoryStorage({ a: 1 }).load(), { a: 1 });
  const s = createMemoryStorage({ a: 1 });
  const cyc = {}; cyc.self = cyc;
  s.save(cyc);
  assert.deepEqual(s.load(), { a: 1 });
});

test("localStorage adapter: one JSON value under the given key", () => {
  const b = fakeBacking(), a = createLocalStorageAdapter(PROGRESS_KEY, b);
  assert.equal(PROGRESS_KEY, "lycarius.primordia.progress", "the save key did not change, so existing saves still load");
  assert.equal(a.load(), null);
  a.save({ v: 1, classes: {} });
  assert.equal(b.m.get(PROGRESS_KEY), '{"v":1,"classes":{}}');
  assert.deepEqual(a.load(), { v: 1, classes: {} });
});

test("localStorage adapter: corrupt, non-object and throwing storage all load as null and never throw", () => {
  const b = fakeBacking(), a = createLocalStorageAdapter("k", b);
  for (const raw of ["{not json", "7", '"str"', "null", ""]) { b.m.set("k", raw); assert.equal(a.load(), null, raw); }
  const dead = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("full"); } };
  const d = createLocalStorageAdapter("k", dead);
  assert.equal(d.load(), null);
  d.save({ a: 1 });
  const none = createLocalStorageAdapter("k"); // no global localStorage in Node
  assert.equal(none.load(), null);
  none.save({ a: 1 });
});

test("localStorage adapter reads the real global lazily", () => {
  const b = fakeBacking();
  const a = createLocalStorageAdapter("k");
  Object.defineProperty(globalThis, "localStorage", { value: b, configurable: true, writable: true });
  try { a.save({ z: 1 }); assert.deepEqual(a.load(), { z: 1 }); } finally { delete globalThis.localStorage; }
});

test("the Progression source no longer mentions the browser's storage", () => {
  const src = readFileSync(new URL("../src/progression/Progression.js", import.meta.url), "utf8");
  assert.ok(!/localStorage|sessionStorage|\bdocument\b|\bwindow\b/.test(src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")));
});

console.log(`\n${passed} tests passed`);
