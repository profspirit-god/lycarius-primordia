// L2 / Phase B: item definitions and the ItemRegistry. No browser globals, no dependencies.
//   node tests/items.test.mjs        (exit 0 = all passed)
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import "../src/content/index.js"; // registers skills, classes, spec bonuses and items
import {
  ItemRegistry, defineItem, validateItemDef, findItem, hasItem, allItems,
  ITEM_CATEGORIES, ITEM_RARITIES, ITEM_SCOPES, ITEM_ACTIONS, MAX_STACK_LIMIT,
} from "../src/sim/items/ItemRegistry.js";
import { COSMETIC_ITEMS } from "../src/sim/items/cosmetics.js";
import { GAMEPLAY_ITEMS } from "../src/sim/items/gameplay.js";
import { LUMBER_ITEMS } from "../src/sim/items/lumber.js";
import { TICKET_ITEMS } from "../src/sim/items/tickets.js";
import { SkillRegistry } from "../src/skills/SkillRegistry.js";
import { ClassRegistry } from "../src/classes/ClassRegistry.js";
import { SpecBonusRegistry } from "../src/progression/SpecBonuses.js";
import { SHOP } from "../src/lobby/lobbyData.js";

let passed = 0;
const test = (name, fn) => (fn(), passed++, console.log("ok  " + name));
const good = (o = {}) => ({
  id: "test_item", name: "Test Item", description: "For tests.", category: "material", rarity: "common",
  scope: "character", maxStack: 20, actions: ["discard"], ...o,
});
const problems = (o) => validateItemDef(o);

test("a valid definition has no problems; every enum is non-empty and unique", () => {
  assert.deepEqual(problems(good()), []);
  for (const list of [ITEM_CATEGORIES, ITEM_RARITIES, ITEM_SCOPES, ITEM_ACTIONS]) {
    assert.ok(list.length > 0);
    assert.equal(new Set(list).size, list.length);
  }
  assert.deepEqual(problems(good({ maxStack: 1, actions: [] })), [], "no actions and no stacking are allowed");
});

test("each required field is checked", () => {
  const bad = (patch, text) => {
    const p = problems(good(patch));
    assert.ok(p.some((s) => s.includes(text)), `${JSON.stringify(patch)} -> ${p.join("|")}`);
  };
  for (const id of [undefined, "", "A", "a", "Upper", "1abc", "has space", "x".repeat(41), 7, null]) bad({ id }, "id must");
  for (const name of [undefined, "", "   ", 5, "x".repeat(61)]) bad({ name }, "name must");
  for (const description of [undefined, "", 5, "x".repeat(201)]) bad({ description }, "description must");
  for (const category of [undefined, "weapon", 1]) bad({ category }, "category must");
  for (const rarity of [undefined, "mythic", ""]) bad({ rarity }, "rarity must");
  for (const scope of [undefined, "guild", ""]) bad({ scope }, "scope must");
  for (const maxStack of [undefined, 0, -1, 1.5, "5", NaN, Infinity, MAX_STACK_LIMIT + 1]) bad({ maxStack }, "maxStack must");
  bad({ actions: "equip" }, "actions must be an array");
  bad({ actions: undefined }, "actions must be an array");
  bad({ actions: ["fly"] }, 'unknown action "fly"');
  bad({ actions: ["use", "use"] }, "must not repeat");
  bad({ stats: { str: 5 } }, 'unknown field "stats"');
  bad({ price: 10 }, 'unknown field "price"');
  assert.equal(problems(good({ maxStack: MAX_STACK_LIMIT })).length, 0, "the limit itself is valid");
});

test("validateItemDef never throws on junk and reports every problem at once", () => {
  for (const junk of [null, undefined, 5, "x", [], () => {}, true]) assert.deepEqual(problems(junk), ["definition must be an object"]);
  assert.ok(problems({}).length >= 6, "an empty object reports each missing field");
});

test("defineItem registers a frozen copy; the caller's object is not the stored one", () => {
  const src = good({ id: "frozen_probe", actions: ["use", "consume"] });
  const def = defineItem(src);
  try {
    assert.equal(findItem("frozen_probe"), def);
    assert.notEqual(def, src);
    assert.ok(Object.isFrozen(def) && Object.isFrozen(def.actions));
    src.name = "Changed"; src.actions.push("trade");
    assert.equal(findItem("frozen_probe").name, "Test Item");
    assert.deepEqual([...findItem("frozen_probe").actions], ["use", "consume"]);
    assert.throws(() => { "use strict"; def.name = "x"; }, TypeError);
    assert.throws(() => defineItem(good({ id: "frozen_probe" })), /duplicate id "frozen_probe"/);
  } finally {
    ItemRegistry.items.delete("frozen_probe"); // keep the real registry clean for the other tests
  }
  assert.equal(hasItem("frozen_probe"), false);
});

test("defineItem rejects an invalid definition with every problem in the message, and registers nothing", () => {
  const before = ItemRegistry.all().length;
  assert.throws(() => defineItem(good({ id: "bad_one", rarity: "x", scope: "y" })), /rarity must.*scope must/);
  assert.throws(() => defineItem(null), /definition must be an object/);
  assert.equal(ItemRegistry.all().length, before);
});

test("lookup of untrusted ids is safe: null, never a throw, never a prototype property", () => {
  for (const id of ["nope", "", undefined, null, 5, {}, [], "__proto__", "constructor", "toString"]) {
    assert.equal(findItem(id), null);
    assert.equal(hasItem(id), false);
  }
  assert.equal(findItem("ember_robe").name, "Ember Robe");
  assert.throws(() => ItemRegistry.get("nope"), /unknown id/, "the generic Registry.get still throws, it was not changed");
});

test("allItems is ordered by id, whatever the registration order", () => {
  const ids = allItems().map((d) => d.id);
  assert.deepEqual(ids, [...ids].sort());
  defineItem(good({ id: "aaa_first" }));
  defineItem(good({ id: "zzz_last" }));
  try {
    const now = allItems().map((d) => d.id);
    assert.equal(now[0], "aaa_first");
    assert.equal(now.at(-1), "zzz_last");
  } finally {
    ItemRegistry.items.delete("aaa_first"); ItemRegistry.items.delete("zzz_last");
  }
});

test("content: the nine Shop cosmetics are registered, account-owned, single, equippable and valid", () => {
  assert.equal(COSMETIC_ITEMS.length, 9);
  assert.equal(new Set(COSMETIC_ITEMS.map((d) => d.id)).size, 9, "ids are unique");
  assert.equal(allItems().length, 9 + GAMEPLAY_ITEMS.length + LUMBER_ITEMS.length + TICKET_ITEMS.length, "the cosmetics, gold, the lumber items and the stat tickets are all that is registered");
  for (const d of COSMETIC_ITEMS) {
    assert.deepEqual(problems(d), [], d.id);
    assert.deepEqual([d.scope, d.maxStack, [...d.actions]], ["account", 1, ["equip"]], d.id);
  }
});

test("transitional guard: every Shop offer matches a definition (name, rarity, category) until L4 links offers to ids", () => {
  const categoryOfTab = { outfits: "outfit", auras: "aura", effects: "effect", emotes: "emote" };
  assert.equal(SHOP.items.length, COSMETIC_ITEMS.length, "every definition has an offer and the other way round");
  for (const offer of SHOP.items) {
    const def = allItems().find((d) => d.name === offer.name);
    assert.ok(def, `no definition for the Shop offer "${offer.name}"`);
    assert.equal(def.rarity, offer.rarity, offer.name);
    assert.equal(def.category, categoryOfTab[offer.tab], offer.name);
  }
});

test("the existing registrations still work after the item registration was added", () => {
  for (const id of ["fireball", "flameShield", "burnResistance", "fireBlast", "manaRegen", "dodge"]) assert.ok(SkillRegistry.items.has(id), id);
  assert.ok(ClassRegistry.items.has("mage"));
  assert.equal(SpecBonusRegistry.all().length, 6);
});

test("the item files have no browser, clock or random call (Claude.md 5b)", () => {
  for (const f of ["ItemRegistry.js", "cosmetics.js"]) {
    const src = readFileSync(new URL("../src/sim/items/" + f, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    assert.ok(!/localStorage|\bdocument\b|\bwindow\b|performance\.now|Date\.now|Math\.random|setTimeout|setInterval/.test(src), f);
  }
});

console.log(`\n${passed} tests passed`);
