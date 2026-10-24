// L2 / Phase E MVP: the Character Inventory and its first item, gold. Gold is a character-owned item in the Inventory service,
// separate from the account Wallet and the Home Account Inventory. No DOM, no browser globals.
//   node tests/character-inventory.test.mjs        (exit 0 = all passed)
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import "../src/content/index.js"; // registers the cosmetics and gold
import { createInventory, CHARACTER_SLOTS } from "../src/sim/items/Inventory.js";
import { createMemoryStorage } from "../src/sim/storage.js";
import { findItem, validateItemDef, ITEM_CATEGORIES, MAX_STACK_LIMIT } from "../src/sim/items/ItemRegistry.js";
import { GOLD_ID, GAMEPLAY_ITEMS } from "../src/sim/items/gameplay.js";
import { inventoryModel, inventoryHtml, CATEGORY_LABELS } from "../src/ui/InventoryView.js";
import { characterInventoryModel, characterInventoryHtml, DEV_GOLD_STEPS } from "../src/ui/CharacterInventoryView.js";
import { Wallet } from "../src/lobby/Wallet.js";

let passed = 0;
const test = (name, fn) => (fn(), passed++, console.log("ok  " + name));
const mk = (initial) => { const s = createMemoryStorage(initial); return { s, inv: createInventory(s) }; };
const view = (inv, owner = "mage", opts) => characterInventoryHtml(characterInventoryModel(inv, owner), opts);
const filled = (m) => m.slots.filter(Boolean);

test("gold is a valid, frozen, character-scoped currency item with no actions", () => {
  const def = findItem(GOLD_ID);
  assert.ok(def, "gold is registered by content/index.js");
  assert.deepEqual(validateItemDef(def), []);
  assert.ok(Object.isFrozen(def));
  assert.equal(def.scope, "character");
  assert.equal(def.category, "currency");
  assert.ok(ITEM_CATEGORIES.includes("currency") && CATEGORY_LABELS.currency, "the category exists and has a label");
  assert.equal(def.maxStack, MAX_STACK_LIMIT);
  assert.deepEqual([...def.actions], [], "no use, sell, discard or trade in the first inventory");
  assert.deepEqual(GAMEPLAY_ITEMS.map((d) => d.id), ["gold"]);
});

test("gold is granted, counted and spent through the service, per character", () => {
  const { inv } = mk();
  assert.deepEqual(inv.grant(GOLD_ID, 250, "mage"), { ok: true, qty: 250 });
  assert.deepEqual(inv.grant(GOLD_ID, 50, "mage"), { ok: true, qty: 300 });
  assert.equal(inv.count(GOLD_ID, "mage"), 300);
  assert.equal(inv.count(GOLD_ID, "warrior"), 0, "another character has none");
  assert.deepEqual(inv.remove(GOLD_ID, 120, "mage"), { ok: true, qty: 180 });
  assert.deepEqual(inv.remove(GOLD_ID, 180, "mage"), { ok: true, qty: 0 });
  assert.equal(inv.owns(GOLD_ID, "mage"), false);
  assert.deepEqual(inv.list("mage"), [], "an empty stack is not kept");
});

test("a failed call changes nothing and saves nothing", () => {
  const { s, inv } = mk();
  inv.grant(GOLD_ID, 100, "mage");
  const saved = JSON.stringify(s.load());
  const cases = [
    [inv.remove(GOLD_ID, 101, "mage"), "not_enough"],
    [inv.remove(GOLD_ID, 1, "warrior"), "not_enough"],
    [inv.grant(GOLD_ID, 5), "bad_owner"],
    [inv.grant(GOLD_ID, 5, "Bad Owner"), "bad_owner"],
    [inv.grant(GOLD_ID, 0, "mage"), "bad_quantity"],
    [inv.grant(GOLD_ID, -5, "mage"), "bad_quantity"],
    [inv.grant(GOLD_ID, 1.5, "mage"), "bad_quantity"],
    [inv.grant(GOLD_ID, NaN, "mage"), "bad_quantity"],
    [inv.remove(GOLD_ID, "10", "mage"), "bad_quantity"],
  ];
  for (const [r, reason] of cases) assert.deepEqual(r, { ok: false, reason });
  assert.equal(inv.count(GOLD_ID, "mage"), 100);
  assert.equal(JSON.stringify(s.load()), saved, "the save is byte for byte the same");
});

test("gold fills slots: one slot per 9,999, and the inventory is full at 30 slots", () => {
  const { inv } = mk();
  inv.grant(GOLD_ID, 9999, "mage");
  assert.equal(inv.freeSlots("mage"), CHARACTER_SLOTS - 1);
  inv.grant(GOLD_ID, 1, "mage");
  assert.equal(inv.freeSlots("mage"), CHARACTER_SLOTS - 2, "10,000 gold needs a second slot");
  const full = CHARACTER_SLOTS * MAX_STACK_LIMIT;
  assert.deepEqual(inv.grant(GOLD_ID, full - 10000, "mage"), { ok: true, qty: full });
  assert.equal(inv.freeSlots("mage"), 0);
  assert.deepEqual(inv.grant(GOLD_ID, 1, "mage"), { ok: false, reason: "inventory_full" });
  assert.equal(inv.count(GOLD_ID, "mage"), full, "nothing was added");
  assert.deepEqual(inv.grant(GOLD_ID, full + 1, "other"), { ok: false, reason: "bad_quantity" }, "no single grant may exceed the whole inventory");
});

test("gold survives a reload, in the character's collection of the inventory save only", () => {
  const { s, inv } = mk();
  inv.grant(GOLD_ID, 1234, "mage");
  inv.grant("ember_robe"); // an account cosmetic in the same save
  assert.deepEqual(s.load().characters, { mage: { items: { gold: 1234 } } });
  assert.deepEqual(s.load().account, { items: { ember_robe: 1 } });
  const again = createInventory(s);
  assert.equal(again.status, "ok");
  assert.equal(again.count(GOLD_ID, "mage"), 1234);
  assert.equal(again.owns("ember_robe"), true);
});

test("a bad or hostile save never creates gold", () => {
  const bad = (raw, status) => {
    const inv = createInventory(createMemoryStorage(raw));
    assert.equal(inv.count(GOLD_ID, "mage"), 0, JSON.stringify(raw));
    if (status) assert.equal(inv.status, status);
  };
  bad({ v: 1, account: { items: { gold: 5 } }, characters: {} }, "repaired"); // gold in the account collection is dropped
  bad({ v: 1, account: { items: {} }, characters: { mage: { items: { gold: -5 } } } }, "repaired");
  bad({ v: 1, account: { items: {} }, characters: { mage: { items: { gold: 1.5 } } } }, "repaired");
  bad({ v: 1, account: { items: {} }, characters: { mage: { items: { gold: "100" } } } }, "repaired");
  bad({ v: 1, account: { items: {} }, characters: { mage: { items: { gold: 9999 * 31 } } } }, "repaired"); // more than the inventory can hold
  bad({ v: 99, characters: { mage: { items: { gold: 5 } } } }, "newer_version");
  bad("gold", "corrupt");
  const newer = createInventory(createMemoryStorage({ v: 99, characters: { mage: { items: { gold: 5 } } } }));
  assert.deepEqual(newer.grant(GOLD_ID, 1, "mage"), { ok: false, reason: "read_only" });
});

test("character gold and the account are separate: Home inventory and the Wallet never see it", () => {
  const { inv } = mk();
  const before = Wallet.amount("gold");
  assert.ok(before > 0, "the placeholder wallet has its own gold");
  inv.grant(GOLD_ID, 777, "mage");
  inv.grant("ember_robe");
  assert.equal(Wallet.amount("gold"), before, "the wallet is untouched");
  assert.deepEqual(inventoryModel(inv).entries.map((e) => e.def.id), ["ember_robe"], "the Home list holds account items only");
  assert.ok(!inventoryHtml(inventoryModel(inv)).includes("Gold"), "no gold card on Home");
  assert.equal(inv.count(GOLD_ID), 0, "asking the account about gold finds none (wrong collection)");
  assert.deepEqual(inv.grant(GOLD_ID, 1), { ok: false, reason: "bad_owner" }, "gold cannot be granted to the account");
});

test("the model always has CHARACTER_SLOTS slots, gold first, one stack per slot", () => {
  const { inv } = mk();
  let m = characterInventoryModel(inv, "mage");
  assert.equal(m.slots.length, CHARACTER_SLOTS);
  assert.deepEqual([m.used, m.free, m.gold], [0, CHARACTER_SLOTS, 0]);
  inv.grant(GOLD_ID, 25000, "mage");
  m = characterInventoryModel(inv, "mage");
  assert.deepEqual(filled(m).map((s) => [s.def.id, s.qty]), [["gold", 9999], ["gold", 9999], ["gold", 5002]]);
  assert.deepEqual([m.used, m.free, m.gold], [3, CHARACTER_SLOTS - 3, 25000]);
  assert.equal(m.slots[0].def.id, "gold");
  assert.equal(characterInventoryModel(inv, "warrior").gold, 0, "another character's panel shows its own gold");
});

test("the model never throws: no service, bad owner, newer save", () => {
  for (const owner of [undefined, null, "", "Bad Owner", "__proto__", 7]) {
    const m = characterInventoryModel(createInventory(createMemoryStorage()), owner);
    assert.equal(m.slots.length, CHARACTER_SLOTS);
    assert.equal(m.gold, 0);
    characterInventoryHtml(m);
  }
  const none = characterInventoryModel(null, "mage");
  assert.equal(none.status, "unavailable");
  assert.match(characterInventoryHtml(none), /Inventory unavailable/);
  const newer = createInventory(createMemoryStorage({ v: 99 }));
  assert.match(view(newer), /newer version of the game/);
});

test("the HTML shows the gold total, the slot grid and the slot count", () => {
  const { inv } = mk();
  let h = view(inv);
  assert.match(h, /<span>Gold<\/span><small>[^<]*<\/small><b>0<\/b>/);
  assert.equal((h.match(/class="slot ci-slot"/g) ?? []).length, CHARACTER_SLOTS, "all slots empty");
  assert.match(h, /Slots 0 \/ 30/);
  inv.grant(GOLD_ID, 12345, "mage");
  h = view(inv);
  assert.match(h, /<b>12,345<\/b>/, "the total is formatted");
  assert.equal((h.match(/ci-slot full/g) ?? []).length, 2, "12,345 gold = two stacks");
  assert.equal((h.match(/class="slot ci-slot"/g) ?? []).length, CHARACTER_SLOTS - 2);
  assert.match(h, /9,999/);
  assert.match(h, /2,346/);
  assert.match(h, /Slots 2 \/ 30/);
  assert.match(h, /Gold has no source in the world yet/);
});

test("the debug buttons exist only when asked, and carry no state of their own", () => {
  const { inv } = mk();
  assert.ok(!/data-a="ci-(grant|spend)"/.test(view(inv)), "off by default");
  const h = view(inv, "mage", { dev: true, message: "Not enough gold." });
  for (const n of DEV_GOLD_STEPS) {
    assert.ok(h.includes(`data-a="ci-grant" data-n="${n}"`) && h.includes(`data-a="ci-spend" data-n="${n}"`), String(n));
  }
  assert.match(h, /Not enough gold\./);
  assert.ok(!view(inv, "mage", { dev: true, message: "<img onerror=1>" }).includes("<img"), "a message is escaped");
});

test("the panel and the view write only through the service, and sim files are Node-importable", () => {
  const view = readFileSync(new URL("../src/ui/CharacterInventoryView.js", import.meta.url), "utf8");
  assert.ok(!/\.(grant|remove)\(/.test(view), "the view only reads");
  const panel = readFileSync(new URL("../src/ui/CharacterInventoryPanel.js", import.meta.url), "utf8");
  const dev = panel.slice(panel.indexOf("  devGold("), panel.indexOf("  render()"));
  assert.equal((panel.match(/\.(grant|remove)\(/g) ?? []).length, 2, "grant and remove, nowhere else");
  assert.equal((dev.match(/\.(grant|remove)\(/g) ?? []).length, 2, "both live in devGold");
  assert.ok(/Settings\.get\("showDebug"\)/.test(dev), "the debug write is gated by the debug setting");
  const sim = readFileSync(new URL("../src/sim/items/gameplay.js", import.meta.url), "utf8");
  assert.ok(!/\b(window|document|localStorage|Date\.now|Math\.random|performance)\b/.test(sim));
});

console.log(`\n${passed} tests passed`);
