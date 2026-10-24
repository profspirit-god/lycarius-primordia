// Item weight, carrying capacity and the game's own weight units. No DOM, no browser globals.
//   node tests/weight.test.mjs        (exit 0 = all passed)
import assert from "node:assert/strict";
import "../src/content/index.js";
import { createInventory, CHARACTER_SLOTS, MAX_QUANTITY } from "../src/sim/items/Inventory.js";
import { createMemoryStorage } from "../src/sim/storage.js";
import { findItem, validateItemDef, defineItem, ItemRegistry, allItems } from "../src/sim/items/ItemRegistry.js";
import { GOLD_ID } from "../src/sim/items/gameplay.js";
import {
  gramsToMg, isWeightMg, unitWeightMg, carryCapacityMg, STARTING_CARRY_CAPACITY_MG, MAX_ITEM_WEIGHT_MG, MG_PER_GRAM,
} from "../src/sim/items/weight.js";
import { WEIGHT_UNITS, formatWeight, pickWeightUnit, findWeightUnit } from "../src/ui/weightUnits.js";
import { characterInventoryModel, characterInventoryHtml } from "../src/ui/CharacterInventoryView.js";

let passed = 0;
const test = (name, fn) => (fn(), passed++, console.log("ok  " + name));
const mk = () => createInventory(createMemoryStorage());
const G = (g) => g * MG_PER_GRAM;

test("the unit table is exactly the owner's list, ascending, with unique names and symbols", () => {
  const expected = [
    ["Veyt", "Vt", 1], ["Kirel", "Kr", 10], ["Draum", "Dr", 100], ["Velkar", "Vk", 500], ["Theryn", "Th", 1000],
    ["Korvath", "Kv", 5000], ["Maelor", "Ml", 10000], ["Dravon", "Dv", 50000], ["Aethron", "Ae", 100000], ["Graveth", "Gv", 500000],
    ["Taurak", "Tr", 1e6], ["Orynth", "Or", 1e7], ["Vaelthar", "Va", 1e8], ["Kharvorn", "Kh", 1e9],
  ]; // grams
  assert.deepEqual(WEIGHT_UNITS.map((u) => [u.name, u.symbol, u.mg / MG_PER_GRAM]), expected);
  for (let i = 1; i < WEIGHT_UNITS.length; i++) assert.ok(WEIGHT_UNITS[i].mg > WEIGHT_UNITS[i - 1].mg);
  assert.equal(new Set(WEIGHT_UNITS.map((u) => u.name)).size, 14);
  assert.equal(new Set(WEIGHT_UNITS.map((u) => u.symbol)).size, 14);
  assert.ok(WEIGHT_UNITS.every((u) => Number.isSafeInteger(u.mg) && Object.isFrozen(u)));
  assert.equal(findWeightUnit("Th").name, "Theryn");
  assert.equal(findWeightUnit("Theryn").symbol, "Th");
  assert.equal(findWeightUnit("nope"), null);
});

test("weight is stored as integer milligrams: gold is exactly 31,100 and sums do not drift", () => {
  const gold = findItem(GOLD_ID);
  assert.equal(gold.weightMg, 31100);
  assert.equal(gramsToMg(31.1), 31100);
  assert.equal(gramsToMg(0.001), 1);
  assert.equal(3 * 31.1 === 93.3, false, "floating point would have drifted");
  const inv = mk();
  inv.grant(GOLD_ID, 3, "mage");
  assert.equal(inv.weightMg("mage"), 93300);
  inv.grant(GOLD_ID, 961, "mage");
  assert.equal(inv.weightMg("mage"), 964 * 31100);
  assert.ok(Number.isInteger(inv.weightMg("mage")));
});

test("a definition's weight is validated; no weight means weightless", () => {
  const good = { id: "iron_bar", name: "Iron Bar", description: "Heavy.", category: "material", rarity: "common", scope: "character", maxStack: 20, actions: [] };
  assert.deepEqual(validateItemDef(good), []);
  assert.deepEqual(validateItemDef({ ...good, weightMg: 0 }), []);
  assert.deepEqual(validateItemDef({ ...good, weightMg: MAX_ITEM_WEIGHT_MG }), []);
  for (const weightMg of [-1, 1.5, NaN, Infinity, "5", null, MAX_ITEM_WEIGHT_MG + 1])
    assert.ok(validateItemDef({ ...good, weightMg }).some((p) => p.includes("weightMg")), String(weightMg));
  assert.equal(unitWeightMg(findItem("ember_robe")), 0, "account cosmetics are weightless");
  assert.equal(unitWeightMg(undefined), 0);
  assert.ok(isWeightMg(0) && !isWeightMg(-1));
});

test("weight is separate from size: slots do not change with weight, weight does not change with slots", () => {
  const inv = mk();
  inv.grant(GOLD_ID, 9999, "mage");
  assert.equal(inv.freeSlots("mage"), CHARACTER_SLOTS - 1);
  assert.equal(inv.weightMg("mage"), 9999 * 31100);
  inv.grant(GOLD_ID, 1, "mage"); // second slot
  assert.equal(inv.freeSlots("mage"), CHARACTER_SLOTS - 2);
  assert.equal(inv.weightMg("mage"), 10000 * 31100);
  assert.equal(inv.weightMg("warrior"), 0, "another character carries nothing");
  for (const o of [undefined, null, "", "Bad Owner", "__proto__", 7]) assert.equal(inv.weightMg(o), 0, String(o));
  inv.remove(GOLD_ID, 10000, "mage");
  assert.equal(inv.weightMg("mage"), 0);
});

test("the heaviest possible inventory still sums exactly (inside 2^53)", () => {
  assert.ok(MAX_ITEM_WEIGHT_MG * MAX_QUANTITY < Number.MAX_SAFE_INTEGER);
  const id = "test_ingot";
  defineItem({ id, name: "Ingot", description: "A ton.", category: "material", rarity: "common", scope: "character", maxStack: 9999, actions: [], weightMg: MAX_ITEM_WEIGHT_MG });
  try {
    const inv = mk();
    inv.grant(id, 9999 * CHARACTER_SLOTS, "mage");
    assert.equal(inv.weightMg("mage"), MAX_ITEM_WEIGHT_MG * 9999 * CHARACTER_SLOTS);
    assert.ok(Number.isSafeInteger(inv.weightMg("mage")));
  } finally {
    ItemRegistry.items.delete(id);
  }
  assert.ok(!allItems().some((d) => d.id === id));
});

test("carrying capacity is its own rule: 30 Theryn = 30 kg, one function, nothing enforces it yet", () => {
  assert.equal(STARTING_CARRY_CAPACITY_MG, 30_000_000);
  assert.equal(carryCapacityMg("mage"), STARTING_CARRY_CAPACITY_MG);
  assert.equal(carryCapacityMg(), STARTING_CARRY_CAPACITY_MG);
  const inv = mk();
  assert.deepEqual(inv.grant(GOLD_ID, 1000, "mage"), { ok: true, qty: 1000 }, "31.1 kg of gold is over capacity and is still accepted");
  assert.ok(inv.weightMg("mage") > carryCapacityMg("mage"));
});

test("formatWeight picks the unit by weight", () => {
  const f = (g) => formatWeight(G(g));
  assert.equal(f(31.1), "3.11 Kr");
  assert.equal(f(93.3), "9.33 Kr");
  assert.equal(f(1), "1 Vt");
  assert.equal(f(10), "1 Kr");
  assert.equal(f(100), "1 Dr");
  assert.equal(f(500), "1 Vk");
  assert.equal(f(990), "1.98 Vk");
  assert.equal(f(999), "1 Th", "1.998 Velkar rounds to 2.00 and moves up");
  assert.equal(f(1000), "1 Th");
  assert.equal(f(5000), "1 Kv");
  assert.equal(f(30_000), "3 Ml");
  assert.equal(f(100_000), "1 Ae");
  assert.equal(f(1e6), "1 Tr");
  assert.equal(f(1e9), "1 Kh");
  assert.equal(f(2.5e9), "2.5 Kh");
  assert.equal(f(2.5e12), "2,500 Kh", "above the largest unit it stays in the largest");
  assert.equal(formatWeight(0), "0 Vt");
  assert.equal(formatWeight(500), "0.5 Vt", "under a gram stays in Veyt");
  assert.equal(formatWeight(1), "0 Vt", "one milligram rounds to 0.00");
});

test("a value that rounds up to the next unit moves up to it", () => {
  assert.equal(formatWeight(999_900), "1 Th"); // 9.999 Dr would show as "10 Dr"
  assert.equal(formatWeight(99_999), "1 Dr"); // 9.9999 Kr would show as "10 Kr"
  assert.equal(pickWeightUnit(999_900).symbol, "Th");
  assert.equal(pickWeightUnit(1_000_000).symbol, "Th");
  assert.equal(pickWeightUnit(999_999).symbol, "Th");
});

test("formatWeight can force a unit and never throws", () => {
  assert.equal(formatWeight(STARTING_CARRY_CAPACITY_MG, { unit: "Th" }), "30 Th");
  assert.equal(formatWeight(29_980_400, { unit: "Th" }), "29.98 Th");
  assert.equal(formatWeight(31100, { unit: "Theryn" }), "0.03 Th");
  assert.equal(formatWeight(31100, { unit: "nope" }), "3.11 Kr", "an unknown unit falls back to automatic");
  for (const bad of [-1, NaN, Infinity, -Infinity, "5", null, undefined, {}, []]) assert.equal(formatWeight(bad), "--", String(bad));
});

test("the Character Inventory shows carried weight against 30 Th, and each gold's weight", () => {
  const inv = mk();
  let h = characterInventoryHtml(characterInventoryModel(inv, "mage"));
  assert.match(h, /<span>Gold<\/span><small>3\.11 Kr each<\/small><b>0<\/b>/);
  assert.match(h, /<b>Weight<\/b><span>0 Th \/ 30 Th<\/span>/);
  assert.ok(!h.includes("ci-weight over"));
  inv.grant(GOLD_ID, 964, "mage");
  const m = characterInventoryModel(inv, "mage");
  assert.equal(m.weightMg, 29_980_400);
  assert.equal(m.capacityMg, 30_000_000);
  h = characterInventoryHtml(m);
  assert.match(h, /29\.98 Th \/ 30 Th/);
  assert.match(h, /width:100%/, "99.9% rounds to a full bar");
  assert.match(h, /Gold x964, weighs 3 Ml/, "the stack tooltip names its weight in an automatic unit");
  inv.grant(GOLD_ID, 100, "mage");
  h = characterInventoryHtml(characterInventoryModel(inv, "mage"));
  assert.match(h, /ci-weight over/);
  assert.match(h, /width:100%/, "the bar stops at full");
  assert.match(h, /33\.09 Th \/ 30 Th/);
});

test("the model without a service has zero weight and the capacity", () => {
  const m = characterInventoryModel(null, "mage");
  assert.deepEqual([m.weightMg, m.capacityMg], [0, 30_000_000]);
  characterInventoryHtml(m);
});

console.log(`\n${passed} tests passed`);
