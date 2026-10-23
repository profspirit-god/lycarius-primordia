// L2 / Phase D: the Home Account Inventory view (pure HTML from the Inventory service). No DOM, no dependencies.
//   node tests/inventory-view.test.mjs        (exit 0 = all passed)
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import "../src/content/index.js"; // registers the nine cosmetics
import { createInventory } from "../src/sim/items/Inventory.js";
import { createMemoryStorage } from "../src/sim/storage.js";
import { ItemRegistry, defineItem, ITEM_CATEGORIES, ITEM_RARITIES } from "../src/sim/items/ItemRegistry.js";
import { inventoryModel, inventoryHtml, CATEGORY_LABELS, RARITY_COLORS } from "../src/ui/InventoryView.js";

let passed = 0;
const test = (name, fn) => (fn(), passed++, console.log("ok  " + name));
const mk = (initial) => { const s = createMemoryStorage(initial); return { s, inv: createInventory(s) }; };
const html = (inv, view) => inventoryHtml(inventoryModel(inv), view);
const tabs = (h) => [...h.matchAll(/data-a="inv-tab" data-t="([a-z]+)"/g)].map((m) => m[1]);
const cards = (h) => [...h.matchAll(/data-a="inv-open" data-id="([a-z_]+)"/g)].map((m) => m[1]);

test("an empty inventory shows the empty state, no tabs and no cards", () => {
  const { inv } = mk();
  const h = html(inv);
  assert.match(h, /Nothing owned yet/);
  assert.deepEqual([tabs(h), cards(h)], [[], []]);
});

test("owned items are listed from the service; unowned definitions and Shop offers are not", () => {
  const { inv } = mk();
  inv.grant("ember_robe"); inv.grant("cinder_halo");
  const h = html(inv);
  assert.deepEqual(cards(h).sort(), ["cinder_halo", "ember_robe"]);
  assert.ok(!h.includes("molten_veil") && !h.includes("Molten Veil"), "an item that is not owned is not shown");
  assert.match(h, /Shop offers are not owned until bought/);
});

test("tabs exist only for categories that hold something owned, with counts; ordered by category then name", () => {
  const { inv } = mk();
  for (const id of ["spark_trail", "fire_dance", "primordial_garb", "ember_robe", "ashen_cloak"]) inv.grant(id);
  const m = inventoryModel(inv);
  assert.deepEqual(m.categories.map((c) => [c.id, c.count]), [["outfit", 3], ["effect", 1], ["emote", 1]]);
  assert.deepEqual(m.entries.map((e) => e.def.id), ["ashen_cloak", "ember_robe", "primordial_garb", "spark_trail", "fire_dance"]);
  assert.deepEqual(tabs(inventoryHtml(m)), ["all", "outfit", "effect", "emote"]);
  assert.ok(ITEM_CATEGORIES.every((c) => CATEGORY_LABELS[c]), "every category has a label");
  assert.ok(ITEM_RARITIES.every((r) => RARITY_COLORS[r]), "every rarity has a colour");
});

test("a category tab filters; an unknown tab falls back to All", () => {
  const { inv } = mk();
  inv.grant("ember_robe"); inv.grant("spark_trail");
  assert.deepEqual(cards(html(inv, { tab: "effect" })), ["spark_trail"]);
  assert.deepEqual(cards(html(inv, { tab: "outfit" })), ["ember_robe"]);
  for (const t of ["emote", "nope", "", undefined, null, "__proto__"]) assert.equal(cards(html(inv, { tab: t })).length, 2, String(t)); // no emote is owned here, so that tab is unknown too
  assert.match(html(inv, { tab: "outfit" }), /data-t="outfit"/);
});

test("the detail view shows name, rarity, description, owned count and ownership; Equip is disabled", () => {
  const { inv } = mk();
  inv.grant("molten_veil");
  const h = html(inv, { selected: "molten_veil" });
  for (const text of ["Molten Veil", "epic", "Auras", "A veil of slow molten light.", "Account-wide", "Back to list"]) assert.ok(h.includes(text), text);
  assert.match(h, /<button class="btn sm" disabled[^>]*>Equip \(soon\)/, "Equip cannot be used before customization exists");
  assert.ok(!/data-a="inv-open"/.test(h), "the detail replaces the list");
});

test("a selected id that is not owned (or junk) shows the list, never a detail for an unowned item", () => {
  const { inv } = mk();
  inv.grant("ember_robe");
  for (const sel of ["molten_veil", "nope", "", 7, {}, "__proto__"]) {
    const h = html(inv, { selected: sel });
    assert.ok(!h.includes("Back to list"), String(sel));
    assert.deepEqual(cards(h), ["ember_robe"]);
  }
});

test("stack quantities show as a badge only above one", () => {
  const stack = defineItem({ id: "t_view_gem", name: "View Gem", description: "test", category: "material", rarity: "legendary", scope: "account", maxStack: 10, actions: [] });
  try {
    const { inv } = mk();
    inv.grant("t_view_gem", 1);
    assert.ok(!html(inv).includes("inv-qty"));
    inv.grant("t_view_gem", 3);
    assert.match(html(inv), /inv-qty">x4</);
    assert.match(html(inv, { selected: "t_view_gem" }), /<small>Owned<\/small><b>4<\/b>/);
    assert.ok(!html(inv, { selected: "t_view_gem" }).includes("Equip"), "no Equip button for an item that cannot be equipped");
    assert.ok(html(inv).includes(RARITY_COLORS.legendary));
  } finally { ItemRegistry.items.delete("t_view_gem"); }
});

test("states: missing service, newer-version save, corrupt save, repaired save", () => {
  for (const none of [null, undefined]) assert.match(html(none), /Inventory unavailable/);
  const newer = html(mk({ v: 2, account: { items: { ember_robe: 1 } } }).inv);
  assert.match(newer, /newer version/);
  assert.match(newer, /Nothing owned yet/);
  assert.ok(!newer.includes("Ember Robe"), "a save it cannot read is not shown");
  assert.match(html(mk({ v: "x" }).inv), /could not be read/);
  const rep = html(mk({ v: 1, account: { items: { ember_robe: 1, ghost: 1, fire_dance: 0 } } }).inv);
  assert.match(rep, /2 saved entries were not valid/);
  assert.deepEqual(cards(rep), ["ember_robe"]);
  assert.match(html(mk({ v: 1, account: { items: { ember_robe: 1, ghost: 1 } } }).inv), /1 saved entry was not valid/);
});

test("rendering never changes ownership or the save", () => {
  const { s, inv } = mk();
  inv.grant("ember_robe");
  const before = JSON.stringify(s.load());
  let saves = 0; const orig = s.save; s.save = (d) => { saves++; orig(d); };
  for (const v of [{}, { tab: "outfit" }, { selected: "ember_robe" }, { selected: "nope" }]) html(inv, v);
  assert.equal(saves, 0);
  assert.equal(JSON.stringify(s.load()), before);
  assert.equal(inv.count("ember_robe"), 1);
});

test("text from definitions is escaped", () => {
  const evil = defineItem({ id: "t_view_evil", name: '<img src=x onerror="1">', description: "a & b <script>", category: "misc", rarity: "common", scope: "account", maxStack: 1, actions: [] });
  try {
    const { inv } = mk();
    inv.grant("t_view_evil");
    for (const h of [html(inv), html(inv, { selected: "t_view_evil" })]) { assert.ok(!h.includes("<img") && !h.includes("<script"), h); assert.ok(h.includes("&lt;")); }
  } finally { ItemRegistry.items.delete(evil.id); }
});

test("wiring: HomeScene reads game.inventory and hardcodes no item id or grant; the view never grants or removes", () => {
  const strip = (f) => readFileSync(new URL(f, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  const home = strip("../src/scenes/HomeScene.js"), view = strip("../src/ui/InventoryView.js");
  assert.ok(home.includes("this.game.inventory"));
  assert.ok(!/(inventory|\binv)\??\.(grant|remove)\(/.test(home + view), 'no call to the inventory service\'s grant or remove');
  assert.ok(!/ember_robe|ashen_cloak|primordial_garb|cinder_halo|molten_veil|spark_trail|fire_dance|bow_of_respect|blue_flame/.test(home + view));
  assert.ok(!/localStorage|\.storage\b/.test(view));
});

console.log(`\n${passed} tests passed`);
