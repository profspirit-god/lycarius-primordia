// L2 / Phase C: ownership state and the separate versioned local save. No browser globals, no dependencies.
//   node tests/inventory.test.mjs        (exit 0 = all passed)
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import "../src/content/index.js"; // registers the nine cosmetics
import { defineItem, ItemRegistry } from "../src/sim/items/ItemRegistry.js";
import {
  Inventory, createInventory, readSave, INVENTORY_SAVE_VERSION, CHARACTER_SLOTS, MAX_QUANTITY, REASONS,
} from "../src/sim/items/Inventory.js";
import { createMemoryStorage } from "../src/sim/storage.js";
import { createLocalStorageAdapter, PROGRESS_KEY, INVENTORY_KEY } from "../src/core/LocalStorageAdapter.js";
import { Progression } from "../src/progression/Progression.js";
import { ClassRegistry } from "../src/classes/ClassRegistry.js";

let passed = 0;
const test = (name, fn) => (fn(), passed++, console.log("ok  " + name));
const def = (id, maxStack, scope = "character") => ({
  id, name: id, description: "test", category: "material", rarity: "common", scope, maxStack, actions: [],
});
const TEST_IDS = ["t_potion", "t_sword", "t_stone", "t_acct_gem"];
defineItem(def("t_potion", 20));          // character stack of up to 20
defineItem(def("t_sword", 1));            // character, not stackable: one slot each
defineItem(def("t_stone", 5));            // character, small stacks: 12 stones = 3 slots
defineItem(def("t_acct_gem", 10, "account")); // account stack of up to 10
const fresh = (initial) => { const s = createMemoryStorage(initial); return { s, inv: createInventory(s) }; };
const failed = (r, reason) => assert.deepEqual(r, { ok: false, reason });

test("a new inventory is empty and writes nothing until something changes", () => {
  const { s, inv } = fresh();
  assert.equal(inv.status, "new");
  assert.deepEqual(inv.list(), []);
  assert.deepEqual(inv.list("mage"), []);
  assert.equal(s.load(), null, "loading alone does not save");
  assert.deepEqual(inv.toSave(), { v: 1, account: { items: {} }, characters: {} });
});

test("grant and remove: account cosmetic, character stack, exact quantities", () => {
  const { inv } = fresh();
  assert.deepEqual(inv.grant("ember_robe"), { ok: true, qty: 1 });
  assert.equal(inv.owns("ember_robe"), true);
  assert.deepEqual(inv.grant("t_potion", 5, "mage"), { ok: true, qty: 5 });
  assert.deepEqual(inv.grant("t_potion", 7, "mage"), { ok: true, qty: 12 });
  assert.equal(inv.count("t_potion", "mage"), 12);
  assert.equal(inv.count("t_potion", "other"), 0, "another owner has none");
  assert.deepEqual(inv.remove("t_potion", 2, "mage"), { ok: true, qty: 10 });
  assert.deepEqual(inv.remove("t_potion", 10, "mage"), { ok: true, qty: 0 });
  assert.deepEqual(inv.list("mage"), [], "a stack that reaches 0 is deleted, not kept as zero");
  assert.deepEqual(inv.toSave().characters, {}, "an empty character collection is not written");
  assert.deepEqual(inv.remove("ember_robe"), { ok: true, qty: 0 });
  assert.equal(inv.owns("ember_robe"), false);
});

test("a duplicate grant of a single-copy item is refused and changes nothing", () => {
  const { s, inv } = fresh();
  inv.grant("ember_robe");
  const before = JSON.stringify(s.load());
  failed(inv.grant("ember_robe"), "already_owned");
  assert.equal(inv.count("ember_robe"), 1);
  assert.equal(JSON.stringify(s.load()), before);
});

test("quantities are validated: zero, negative, fractional, huge, NaN, strings", () => {
  const { s, inv } = fresh();
  for (const q of [0, -1, 1.5, NaN, Infinity, "3", null, {}, MAX_QUANTITY + 1]) {
    failed(inv.grant("t_potion", q, "mage"), "bad_quantity");
    failed(inv.remove("t_potion", q, "mage"), "bad_quantity");
  }
  assert.equal(s.load(), null, "no failed call saved anything");
  assert.ok(inv.grant("t_potion", undefined, "mage").ok, "the quantity defaults to 1");
});

test("unknown ids fail safely, including prototype names", () => {
  const { inv } = fresh();
  for (const id of ["nope", "", undefined, null, 5, {}, "__proto__", "constructor", "toString"]) {
    failed(inv.grant(id), "unknown_item");
    failed(inv.remove(id), "unknown_item");
    assert.equal(inv.count(id), 0);
    assert.equal(inv.owns(id), false);
  }
});

test("account and character items cannot be confused", () => {
  const { inv } = fresh();
  failed(inv.grant("ember_robe", 1, "mage"), "wrong_scope");   // account item with an owner
  failed(inv.grant("t_potion", 1), "bad_owner");               // character item without one
  for (const o of ["", "Mage", "1mage", "has space", "x".repeat(41), 7, {}, "__proto__"]) {
    failed(inv.grant("t_potion", 1, o), "bad_owner");
    assert.equal(inv.count("t_potion", o), 0);
    assert.equal(inv.freeSlots(o), 0);
  }
  inv.grant("ember_robe");
  inv.grant("t_potion", 3, "mage");
  assert.equal(inv.count("ember_robe", "mage"), 0, "an account item is not in a character collection");
  assert.equal(inv.count("t_potion"), 0, "a character item is not in the account collection");
  assert.deepEqual(inv.list().map((e) => e.id), ["ember_robe"]);
  assert.deepEqual(inv.list("mage").map((e) => e.id), ["t_potion"]);
});

test("account stacks stop at maxStack; character collections are slot based", () => {
  const { inv } = fresh();
  assert.deepEqual(inv.grant("t_acct_gem", 10), { ok: true, qty: 10 });
  failed(inv.grant("t_acct_gem", 1), "stack_full");
  assert.equal(inv.freeSlots("mage"), CHARACTER_SLOTS);
  inv.grant("t_stone", 12, "mage");                       // 12 / 5 -> 3 slots
  assert.equal(inv.freeSlots("mage"), CHARACTER_SLOTS - 3);
  inv.grant("t_sword", 1, "mage");                        // one slot
  assert.equal(inv.freeSlots("mage"), CHARACTER_SLOTS - 4);
  inv.remove("t_stone", 3, "mage");                       // 9 / 5 -> 2 slots
  assert.equal(inv.freeSlots("mage"), CHARACTER_SLOTS - 3);
  assert.equal(inv.freeSlots("rogue"), CHARACTER_SLOTS, "another owner has its own slots");
});

test("capacity: the grant that would not fit is refused whole, nothing partial, nothing saved", () => {
  const { s, inv } = fresh();
  inv.grant("t_stone", 5 * (CHARACTER_SLOTS - 1), "mage"); // fills all but one slot
  inv.grant("t_sword", 1, "mage");                         // the last slot
  assert.equal(inv.freeSlots("mage"), 0);
  const before = JSON.stringify(s.load());
  failed(inv.grant("t_sword", 1, "mage"), "inventory_full");
  failed(inv.grant("t_potion", 1, "mage"), "inventory_full");
  failed(inv.grant("t_stone", 1, "mage"), "inventory_full"); // would open a new slot
  assert.equal(inv.count("t_stone", "mage"), 5 * (CHARACTER_SLOTS - 1));
  assert.equal(JSON.stringify(s.load()), before);
  inv.remove("t_sword", 1, "mage");
  assert.ok(inv.grant("t_potion", 20, "mage").ok, "freed space is usable again");
  failed(inv.grant("t_potion", 1, "mage"), "inventory_full"); // 21 potions would need a second slot
  assert.equal(inv.count("t_potion", "mage"), 20);
});

test("removing more than owned fails and changes nothing", () => {
  const { s, inv } = fresh();
  inv.grant("t_potion", 4, "mage");
  const before = JSON.stringify(s.load());
  failed(inv.remove("t_potion", 5, "mage"), "not_enough");
  failed(inv.remove("t_sword", 1, "mage"), "not_enough");
  failed(inv.remove("ember_robe"), "not_enough");
  assert.equal(inv.count("t_potion", "mage"), 4);
  assert.equal(JSON.stringify(s.load()), before);
});

test("every failure reason is one of REASONS", () => {
  const { inv } = fresh();
  inv.grant("ember_robe");
  const seen = [inv.grant("nope"), inv.grant("t_potion", 0, "m"), inv.grant("t_potion"), inv.grant("ember_robe", 1, "m"),
    inv.grant("ember_robe"), inv.grant("t_acct_gem", 11), inv.remove("t_sword", 1, "m")];
  for (const r of seen) { assert.equal(r.ok, false); assert.ok(REASONS.includes(r.reason), r.reason); }
});

test("save and load round-trip, with keys in id order; the loaded inventory behaves the same", () => {
  const { s, inv } = fresh();
  inv.grant("spark_trail"); inv.grant("ember_robe"); inv.grant("t_acct_gem", 4);
  inv.grant("t_stone", 7, "mage"); inv.grant("t_potion", 9, "mage"); inv.grant("t_sword", 1, "rogue");
  const saved = s.load();
  assert.equal(saved.v, INVENTORY_SAVE_VERSION);
  assert.deepEqual(Object.keys(saved.account.items), ["ember_robe", "spark_trail", "t_acct_gem"]);
  assert.deepEqual(Object.keys(saved.characters), ["mage", "rogue"]);
  const again = createInventory(createMemoryStorage(saved));
  assert.equal(again.status, "ok");
  assert.equal(again.dropped, 0);
  assert.deepEqual(again.toSave(), saved);
  assert.deepEqual(again.list("mage"), [{ id: "t_potion", qty: 9 }, { id: "t_stone", qty: 7 }]);
  failed(again.grant("ember_robe"), "already_owned");
  assert.equal(again.freeSlots("mage"), CHARACTER_SLOTS - 1 - 2);
});

test("corrupt data never crashes and never creates items: bad entries are dropped, good ones kept", () => {
  const raw = {
    v: 1,
    account: { items: { ember_robe: 1, ghost_item: 1, spark_trail: 2, cinder_halo: -1, molten_veil: 1.5, fire_dance: "1", t_potion: 3, bow_of_respect: 0 } },
    characters: {
      mage: { items: { t_potion: 5, t_sword: 1, ember_robe: 1, ghost: 4, t_stone: 0 } },
      "Bad Owner": { items: { t_potion: 1 } },
      rogue: "nope",
    },
  };
  // JSON.parse makes "__proto__" an own key, the way a tampered save file would
  const s = readSave(JSON.parse(JSON.stringify(raw).replace('"mage"', '"__proto__":{"items":{"t_potion":1}},"mage"')));
  assert.equal(s.status, "repaired");
  assert.deepEqual({ ...s.account }, { ember_robe: 1 }, "only the valid account entry survives");
  assert.deepEqual({ ...s.characters.mage }, { t_potion: 5, t_sword: 1 });
  assert.deepEqual(Object.keys(s.characters), ["mage"]);
  assert.ok(s.dropped >= 10);
  const inv = createInventory(createMemoryStorage(raw));
  assert.equal(inv.count("spark_trail"), 0, "an invalid quantity did not become a free item");
});

test("junk payloads load as an empty, usable inventory", () => {
  for (const junk of [null, undefined, [], 7, "x", {}, { v: "1" }, { v: 0 }, { v: -3 }, { v: 1.5 }, { account: {} }]) {
    const st = readSave(junk);
    assert.deepEqual([{ ...st.account }, { ...st.characters }], [{}, {}]);
    assert.ok(["new", "corrupt"].includes(st.status), JSON.stringify(junk) + " -> " + st.status);
  }
  for (const odd of [{ v: 1 }, { v: 1, account: null, characters: null }, { v: 1, account: { items: [] }, characters: [] }, { v: 1, account: { items: "x" } }]) {
    assert.equal(readSave(odd).status, "ok", JSON.stringify(odd));
  }
  const { inv } = fresh({ v: "bad" });
  assert.equal(inv.status, "corrupt");
  assert.ok(inv.grant("ember_robe").ok, "a corrupt save starts clean and the next change replaces it");
  assert.equal(inv.storage.load().v, 1);
});

test("a save from a NEWER version is kept intact: every change is refused, nothing is overwritten", () => {
  const future = { v: INVENTORY_SAVE_VERSION + 1, account: { items: { ember_robe: 1 }, extra: true }, vault: { gold: 5 } };
  const { s, inv } = fresh(future);
  assert.equal(inv.status, "newer_version");
  assert.equal(inv.readOnly, true);
  assert.equal(inv.owns("ember_robe"), false, "it does not guess at a format it does not know");
  failed(inv.grant("spark_trail"), "read_only");
  failed(inv.remove("ember_robe"), "read_only");
  assert.deepEqual(s.load(), future);
});

test("an over-full character save keeps the earlier ids and drops the rest, deterministically", () => {
  const items = { t_potion: 20 * 10, t_stone: 5 * 15, t_sword: 5 }; // 10 + 15 + 5 = 30 slots, so it fits exactly
  assert.equal(readSave({ v: 1, characters: { mage: { items } } }).dropped, 0);
  items.t_sword = 6; // 31 slots: the last id in order (t_sword) goes
  const r = readSave({ v: 1, characters: { mage: { items } } });
  assert.equal(r.dropped, 1);
  assert.deepEqual(Object.keys(r.characters.mage), ["t_potion", "t_stone"]);
});

test("storage failures do not throw; the change holds for the session", () => {
  const dead = { load: () => null, save() { throw new Error("full"); } };
  const inv = createInventory(dead);
  assert.deepEqual(inv.grant("ember_robe"), { ok: true, qty: 1 });
  assert.equal(inv.owns("ember_robe"), true);
});

test("localStorage round trip on its own key; the progression save is never touched", () => {
  const m = new Map();
  const backing = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => void m.set(k, String(v)) };
  assert.equal(INVENTORY_KEY, "lycarius.primordia.inventory");
  assert.notEqual(INVENTORY_KEY, PROGRESS_KEY);
  assert.equal(PROGRESS_KEY, "lycarius.primordia.progress", "the progression key did not change");
  const progStore = createLocalStorageAdapter(PROGRESS_KEY, backing);
  const prog = new Progression(ClassRegistry.get("mage"), progStore);
  prog.addCharXp(10); // writes a real progression save
  assert.ok(m.has(PROGRESS_KEY));
  const progRaw = m.get(PROGRESS_KEY);

  const inv = createInventory(createLocalStorageAdapter(INVENTORY_KEY, backing));
  inv.grant("molten_veil"); inv.grant("t_potion", 6, "mage");
  assert.equal(m.get(PROGRESS_KEY), progRaw, "granting items left the progression save byte for byte unchanged");
  assert.ok(m.has(INVENTORY_KEY));
  const back = createInventory(createLocalStorageAdapter(INVENTORY_KEY, backing));
  assert.equal(back.owns("molten_veil"), true);
  assert.equal(back.count("t_potion", "mage"), 6);
  assert.deepEqual(JSON.parse(m.get(INVENTORY_KEY)), back.toSave());
  const prog2 = new Progression(ClassRegistry.get("mage"), createLocalStorageAdapter(PROGRESS_KEY, backing));
  assert.ok(prog2, "progression still loads next to an inventory save");
});

test("saved data is a copy: changing what was loaded or saved cannot change the live inventory", () => {
  const { s, inv } = fresh();
  inv.grant("t_potion", 3, "mage");
  const list = inv.list("mage"); list[0].qty = 99; list.push({ id: "ember_robe", qty: 1 });
  assert.equal(inv.count("t_potion", "mage"), 3);
  const out = inv.toSave(); out.characters.mage.items.t_potion = 99;
  assert.equal(inv.count("t_potion", "mage"), 3);
  assert.equal(s.load().characters.mage.items.t_potion, 3);
});

test("the inventory file has no browser, clock or random call (Claude.md 5b) and imports no client code", () => {
  const src = readFileSync(new URL("../src/sim/items/Inventory.js", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  assert.ok(!/localStorage|\bdocument\b|\bwindow\b|performance\.now|Date\.now|Math\.random|setTimeout|setInterval/.test(src));
  assert.ok(!/from\s+["']\.\.\/\.\.\/(core\/LocalStorage|scenes|ui|lobby|view|input)/.test(src));
});

for (const id of TEST_IDS) ItemRegistry.items.delete(id); // keep the real registry clean
console.log(`\n${passed} tests passed`);
