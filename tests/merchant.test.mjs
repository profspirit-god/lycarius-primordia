// John the Merchant: his offers, prices, the atomic sale, the NPC body and the shop window HTML. No DOM, no browser.
//   node tests/merchant.test.mjs        (exit 0 = all passed)
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import "../src/content/index.js";
import { createInventory, CHARACTER_SLOTS } from "../src/sim/items/Inventory.js";
import { createMemoryStorage } from "../src/sim/storage.js";
import { createStatTraining } from "../src/sim/stats/StatTraining.js";
import { GOLD_ID } from "../src/sim/items/gameplay.js";
import { STAT_TICKETS } from "../src/sim/items/tickets.js";
import { JOHN, OFFERS, TICKET_PRICES, offerById, buy, BUY_REASONS } from "../src/sim/shop/john.js";
import { Merchant } from "../src/entities/Merchant.js";
import { VIEWS } from "../src/view/index.js";
import { MerchantView } from "../src/view/MerchantView.js";
import { merchantModel, merchantHtml } from "../src/ui/MerchantShopView.js";

let passed = 0;
const test = (name, fn) => (fn(), passed++, console.log("ok  " + name));
const mk = (gold = 0) => {
  const inv = createInventory(createMemoryStorage()), tr = createStatTraining(createMemoryStorage());
  if (gold) inv.grant(GOLD_ID, gold, "mage");
  return { inv, tr };
};

test("John sells a ticket for every stat, each with a positive whole-number gold price, and nothing else", () => {
  assert.equal(OFFERS.length, STAT_TICKETS.length);
  assert.deepEqual(OFFERS.map((o) => o.item), STAT_TICKETS.map((t) => t.id));
  for (const o of OFFERS) {
    assert.ok(Number.isInteger(o.price) && o.price > 0, o.id);
    assert.equal(o.price, TICKET_PRICES[o.id]);
    assert.equal(offerById(o.id), o);
  }
  assert.deepEqual(Object.keys(TICKET_PRICES).sort(), STAT_TICKETS.map((t) => t.id).sort(), "no price without a ticket");
  assert.equal(offerById("gold"), null);
  assert.equal(JOHN.name, "John the Merchant");
});

test("the price list: a plan I can read at a glance", () => {
  assert.deepEqual({ ...TICKET_PRICES }, {
    ticket_max_health: 150, ticket_health_regen: 200, ticket_max_mana: 100, ticket_mana_regen: 120,
    ticket_max_stamina: 100, ticket_stamina_regen: 100, ticket_move_speed: 250,
  });
  assert.equal(Object.values(TICKET_PRICES).reduce((a, b) => a + b, 0) * 10, 10200, "maxing every stat costs 10,200");
});

test("a sale takes the price in gold and gives one ticket, in one step", () => {
  const { inv, tr } = mk(500);
  const r = buy(inv, tr, "mage", "ticket_max_health");
  assert.deepEqual([r.ok, r.price, r.offer.id], [true, 150, "ticket_max_health"]);
  assert.equal(inv.count(GOLD_ID, "mage"), 350);
  assert.equal(inv.count("ticket_max_health", "mage"), 1);
  buy(inv, tr, "mage", "ticket_max_health");
  assert.equal(inv.count("ticket_max_health", "mage"), 2);
  assert.equal(inv.count(GOLD_ID, "mage"), 200);
});

test("every refusal changes nothing and saves nothing", () => {
  const { inv, tr } = mk(149);
  const store = JSON.stringify(inv.toSave());
  const same = (r, reason) => { assert.deepEqual(r, { ok: false, reason }); assert.equal(JSON.stringify(inv.toSave()), store); };
  same(buy(inv, tr, "mage", "ticket_max_health"), "not_enough");
  same(buy(inv, tr, "mage", "ticket_nope"), "unknown_offer");
  same(buy(inv, tr, "mage", "gold"), "unknown_offer");
  same(buy(inv, tr, 7, "ticket_max_health"), "bad_owner");
  same(buy(inv, tr, "mage", "ticket_max_health", { near: false }), "too_far");
  for (const r of ["not_enough", "unknown_offer", "bad_owner", "too_far", "at_cap", "inventory_full"]) assert.ok(BUY_REASONS.includes(r), r);
});

test("a full inventory refuses the sale and the gold stays", () => {
  const { inv, tr } = mk(9999 * (CHARACTER_SLOTS - 1) + 5000); // 30 slots of gold; paying 150 does not free one
  assert.equal(inv.freeSlots("mage"), 0);
  const before = inv.count(GOLD_ID, "mage");
  assert.deepEqual(buy(inv, tr, "mage", "ticket_health_regen"), { ok: false, reason: "inventory_full" });
  assert.equal(inv.count(GOLD_ID, "mage"), before, "no gold was taken");
  assert.equal(inv.count("ticket_health_regen", "mage"), 0, "no ticket was given");
});

test("paying with the gold that frees the slot a ticket needs is allowed (the check is on the result)", () => {
  const { inv, tr } = mk(9999 * (CHARACTER_SLOTS - 1) + 150); // 30 slots; the last holds exactly the price
  assert.equal(inv.freeSlots("mage"), 0);
  const r = buy(inv, tr, "mage", "ticket_max_health");
  assert.equal(r.ok, true);
  assert.equal(inv.count(GOLD_ID, "mage"), 9999 * (CHARACTER_SLOTS - 1));
  assert.equal(inv.count("ticket_max_health", "mage"), 1);
  assert.equal(inv.freeSlots("mage"), 0);
});

test("a stat that cannot take more tickets is not sold: used plus carried may not pass the cap", () => {
  const { inv, tr } = mk(100000);
  for (let i = 0; i < 10; i++) { assert.equal(buy(inv, tr, "mage", "ticket_move_speed").ok, true, String(i)); }
  const gold = inv.count(GOLD_ID, "mage");
  assert.deepEqual(buy(inv, tr, "mage", "ticket_move_speed"), { ok: false, reason: "at_cap" }, "10 carried = the cap");
  assert.equal(inv.count(GOLD_ID, "mage"), gold);
  for (let i = 0; i < 4; i++) tr.use(inv, "mage", "ticket_move_speed"); // 4 used, 6 carried
  assert.equal(buy(inv, tr, "mage", "ticket_move_speed").reason, "at_cap");
  for (let i = 0; i < 6; i++) tr.use(inv, "mage", "ticket_move_speed"); // all used
  assert.equal(buy(inv, tr, "mage", "ticket_move_speed").reason, "at_cap");
  assert.equal(buy(inv, tr, "mage", "ticket_max_mana").ok, true, "other stats are unaffected");
});

test("Inventory.exchange is all or nothing, character items only, saved once", () => {
  const storage = createMemoryStorage(), inv = createInventory(storage);
  let saves = 0;
  const orig = storage.save.bind(storage);
  storage.save = (d) => (saves++, orig(d));
  inv.grant(GOLD_ID, 100, "mage");
  saves = 0;
  assert.deepEqual(inv.exchange("mage", [[GOLD_ID, 100]], [["ticket_max_mana", 1]]), { ok: true });
  assert.equal(saves, 1);
  assert.deepEqual([inv.count(GOLD_ID, "mage"), inv.count("ticket_max_mana", "mage")], [0, 1]);
  saves = 0;
  const bad = [
    [[[GOLD_ID, 1]], [["ticket_max_mana", 1]], "not_enough"],
    [[], [["nope", 1]], "unknown_item"],
    [[], [["ember_robe", 1]], "wrong_scope"],
    [[], [["ticket_max_mana", 0]], "bad_quantity"],
    [[], [["ticket_max_mana", 1.5]], "bad_quantity"],
    [[["ticket_max_mana", 1]], [[GOLD_ID, 1], ["ticket_max_mana", 99999999]], "bad_quantity"],
    [[["ticket_max_mana", 1]], "x", "bad_quantity"],
    [[["ticket_max_mana"]], [], "bad_quantity"],
  ];
  for (const [take, give, reason] of bad) {
    const r = inv.exchange("mage", take, give);
    assert.deepEqual(r, { ok: false, reason }, JSON.stringify([take, give]));
  }
  assert.deepEqual(inv.exchange("Bad Owner", [], []), { ok: false, reason: "bad_owner" });
  assert.equal(saves, 0, "no refusal saved anything");
  assert.deepEqual([inv.count(GOLD_ID, "mage"), inv.count("ticket_max_mana", "mage")], [0, 1], "nothing moved");
  const ro = createInventory(createMemoryStorage({ v: 99 }));
  assert.deepEqual(ro.exchange("mage", [], []), { ok: false, reason: "read_only" });
});

test("the NPC: a solid, unhittable body with a view; trade range is edge to edge and a downed player cannot trade", () => {
  const m = new Merchant(-230, -120);
  assert.deepEqual([m.kind, m.isMerchant, m.id, m.name, m.solid, m.hittable], ["merchant", true, "john", "John the Merchant", true, false]);
  const p = { x: m.x + m.radius + 16 + JOHN.tradeRange, y: m.y, radius: 16, downed: false };
  assert.equal(m.canTrade(p), true, "exactly at the range");
  assert.equal(m.canTrade({ ...p, x: p.x + 1 }), false, "one pixel further");
  assert.equal(m.canTrade({ ...p, x: m.x + 20, downed: true }), false);
  assert.equal(m.canTrade(null), false);
  assert.equal(m.canTrade(undefined), false);
  assert.equal(VIEWS.merchant, MerchantView, "registered under its kind");
  m.update(1 / 60, {}); // never throws
});

test("the NPC view draws without NaN and shows the trade hint only when close", () => {
  const m = new Merchant(0, 0), texts = [], args = [];
  const ctx = new Proxy({}, { get: (_, k) => k === "createLinearGradient" ? () => ({ addColorStop() {} }) : k === "fillText" || k === "strokeText" ? (t, ...a) => (texts.push(t), args.push(...a)) : (...a) => args.push(...a.filter((x) => typeof x === "number")), set: () => true });
  const world = { player: { x: 5, y: 5, radius: 16, downed: false } };
  const v = new MerchantView(world);
  v.tick(m, 0.1); v.draw(ctx, m);
  assert.ok(texts.includes("John the Merchant") && texts.includes("Press T to trade"));
  assert.ok(args.every((n) => !Number.isNaN(n)), "no NaN in any drawing argument");
  texts.length = 0;
  world.player = { x: 900, y: 0, radius: 16, downed: false };
  v.draw(ctx, m);
  assert.ok(texts.includes("John the Merchant") && !texts.includes("Press T to trade"));
  v.dispose();
});

test("the shop window lists every ticket with its price, and disables what you cannot buy, with a reason", () => {
  const { inv, tr } = mk(160);
  const html = (near = true, message) => merchantHtml(merchantModel(inv, tr, "mage", near), { message });
  let h = html();
  assert.match(h, /John the Merchant|Gold for tickets/);
  for (const t of STAT_TICKETS) assert.ok(h.includes(`data-id="${t.id}"`), t.id);
  assert.match(h, /<b>160<\/b>/, "your gold");
  assert.ok(!/data-id="ticket_max_health"[^>]*disabled/.test(h), "150 is affordable with 160");
  assert.match(h, /data-id="ticket_health_regen" disabled title="Not enough gold\."/);
  assert.match(html(false), /disabled title="Step closer to John\."/);
  buy(inv, tr, "mage", "ticket_max_health");
  assert.match(html(), /Used 0 \/ 10 · carrying 1/);
  assert.match(html(true, "Bought it."), /Bought it\./);
  assert.ok(!html(true, "<img onerror=1>").includes("<img"), "messages are escaped");
  assert.match(merchantHtml(merchantModel(null, tr, "mage", true)), /Shop unavailable/);
  assert.match(merchantHtml(merchantModel(inv, null, "mage", true)), /Shop unavailable/);
});

test("the shop window and panel only buy through buy(); sim files stay clean", () => {
  const view = readFileSync(new URL("../src/ui/MerchantShopView.js", import.meta.url), "utf8");
  assert.ok(!/\.(grant|remove|exchange|use)\(/.test(view), "the view only reads");
  const panel = readFileSync(new URL("../src/ui/MerchantPanel.js", import.meta.url), "utf8");
  assert.ok(!/\.(grant|remove|exchange)\(/.test(panel), "the panel never edits the inventory itself");
  assert.equal((panel.match(/\bbuy\(/g) ?? []).length >= 1, true);
  for (const f of ["../src/sim/shop/john.js", "../src/entities/Merchant.js", "../src/systems/LootSystem.js"]) {
    const src = readFileSync(new URL(f, import.meta.url), "utf8");
    assert.ok(!/\b(window|document|localStorage|Date\.now|Math\.random|performance|setTimeout)\b/.test(src), f);
  }
});

console.log(`\n${passed} tests passed`);
