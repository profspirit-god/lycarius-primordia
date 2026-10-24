// Gold drops: Graugr 1 to 10 gold per kill, a raid reward per cleared raid, paid through the Inventory service. Headless, no browser.
//   node tests/loot.test.mjs        (exit 0 = all passed)
import assert from "node:assert/strict";
import "../src/content/index.js";
import { EventBus } from "../src/core/EventBus.js";
import { Rng } from "../src/sim/rng.js";
import { Graugr } from "../src/entities/Graugr.js";
import { RaidSystem } from "../src/systems/RaidSystem.js";
import { LootSystem, GRAUGR_GOLD, RAID_GOLD, raidGold } from "../src/systems/LootSystem.js";
import { LootFx } from "../src/systems/LootFx.js";
import { StatusSystem } from "../src/systems/StatusSystem.js";
import { createInventory, CHARACTER_SLOTS } from "../src/sim/items/Inventory.js";
import { createMemoryStorage } from "../src/sim/storage.js";
import { GOLD_ID } from "../src/sim/items/gameplay.js";
import { SIM_SYSTEMS, VIEW_SYSTEMS } from "../src/systems/pipeline.js";

const DT = 1 / 60;
function mkWorld(seed = 7, withInventory = true) {
  const w = { events: new EventBus(), entities: [], banners: [], rng: new Rng(seed), time: 0 };
  w.particles = { emit() {} };
  w.damageNumbers = { spawn: (...a) => (w.numbers ??= []).push(a) };
  w.lights = { add() {} };
  w.camera = { addTrauma() {} };
  w.hitstop = () => {};
  w.spawn = (e) => (w.entities.push(e), e);
  w.removeDummy = () => {};
  w.restoreDummy = () => {};
  w.pushBanner = (t) => w.banners.push(t);
  w.player = { x: 0, y: 0, vx: 0, vy: 0, radius: 16, height: 46, hittable: true, downed: false, stunT: 0, isPlayer: true, cls: { id: "mage" }, onHit() {} };
  w.entities.push(w.player);
  w.events.on("hit", (e) => e.target.onHit?.(e));
  w.status = new StatusSystem(w);
  if (withInventory) w.inventory = createInventory(createMemoryStorage());
  w.loot = new LootSystem(w);
  w.loots = [];
  w.events.on("loot", (e) => w.loots.push(e));
  return w;
}
const step = (w, n = 1) => {
  for (let i = 0; i < n; i++) {
    w.time += DT;
    for (const e of w.entities.slice()) e.update?.(DT, w);
    w.entities = w.entities.filter((e) => !e.dead);
    w.status.update(DT);
  }
};
const kill = (w, g, source = w.player) => {
  w.events.emit("hit", { source, target: g, damage: 999, dir: { x: 1, y: 0 }, charge: 1 });
  step(w, 3);
};
const gold = (w) => w.inventory.count(GOLD_ID, "mage");

let passed = 0;
const test = (name, fn) => (fn(), passed++, console.log("ok  " + name));

test("the numbers: a Graugr drops 1 to 10, a raid pays 20 + 10 x its number", () => {
  assert.deepEqual({ ...GRAUGR_GOLD }, { min: 1, max: 10 });
  assert.deepEqual({ ...RAID_GOLD }, { base: 20, perRaid: 10 });
  assert.deepEqual([1, 2, 3, 10].map(raidGold), [30, 40, 50, 120]);
  assert.equal(raidGold(0), 30, "never below raid 1");
  assert.equal(raidGold(NaN), 30);
});

test("killing a Graugr pays 1 to 10 gold into the killer's inventory, once", () => {
  const w = mkWorld();
  const g = w.spawn(new Graugr(100, 0, { tier: 0, rng: w.rng }));
  kill(w, g);
  step(w, 120);
  assert.equal(w.loots.length, 1, "one drop per kill, however long the body lies there");
  const e = w.loots[0];
  assert.equal(e.ok, true);
  assert.equal(e.item, "gold");
  assert.equal(e.from, "graugr");
  assert.equal(e.owner, "mage");
  assert.ok(Number.isInteger(e.amount) && e.amount >= 1 && e.amount <= 10, String(e.amount));
  assert.equal(gold(w), e.amount);
  assert.equal(e.total, e.amount);
  assert.ok(e.x > 0, "the drop is reported where the Graugr fell");
});

test("every amount from 1 to 10 is possible, nothing else, and each is about equally likely", () => {
  const w = mkWorld(1);
  const seen = new Map();
  for (let i = 0; i < 5000; i++) {
    const a = w.loot.rollGraugrGold();
    seen.set(a, (seen.get(a) ?? 0) + 1);
  }
  assert.deepEqual([...seen.keys()].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  for (const n of seen.values()) assert.ok(n > 400 && n < 600, `a value came up ${n} times of 5000`);
});

test("the roll comes from world.rng: same seed, same drops, whatever Math.random (visuals) does", () => {
  const run = (seed, visual) => {
    const real = Math.random;
    Math.random = typeof visual === "function" ? visual : () => visual;
    try {
      const w = mkWorld(seed);
      for (let i = 0; i < 8; i++) kill(w, w.spawn(new Graugr(100, 0, { tier: 0, rng: w.rng })));
      return w.loots.map((e) => e.amount);
    } finally { Math.random = real; }
  };
  let n = 0;
  assert.deepEqual(run(5, 0.1), run(5, 0.9));
  assert.deepEqual(run(5, 0.1), run(5, () => (n = (n * 7 + 0.37) % 1)));
  assert.notDeepEqual(run(5, 0.1), run(6, 0.1));
});

test("no gold when there is no recipient: no inventory, a dummy killer, no killer, a non-Graugr", () => {
  const noInv = mkWorld(7, false);
  kill(noInv, noInv.spawn(new Graugr(100, 0, { tier: 0, rng: noInv.rng })));
  assert.equal(noInv.loots.length, 0);
  const w = mkWorld();
  const before = w.rng.state?.() ?? null;
  kill(w, w.spawn(new Graugr(100, 0, { tier: 0, rng: w.rng })), { cls: { id: "mage" } }); // not a player
  kill(w, w.spawn(new Graugr(100, 0, { tier: 0, rng: w.rng })), null);
  w.events.emit("kill", { target: { isGraugr: false }, source: w.player });
  assert.equal(w.loots.length, 0);
  assert.equal(gold(w), 0);
});

test("a full inventory refuses the gold, says so, and loses it", () => {
  const w = mkWorld();
  w.inventory.grant(GOLD_ID, CHARACTER_SLOTS * 9999, "mage");
  const full = gold(w);
  kill(w, w.spawn(new Graugr(100, 0, { tier: 0, rng: w.rng })));
  assert.equal(w.loots.length, 1);
  assert.equal(w.loots[0].ok, false);
  assert.equal(w.loots[0].reason, "inventory_full");
  assert.equal(gold(w), full);
});

test("a cleared raid pays once, 20 + 10 x its number, and a stopped raid pays nothing", () => {
  const w = mkWorld();
  const r = new RaidSystem(w);
  r.start();
  const gs = w.entities.filter((e) => e.isGraugr);
  assert.equal(gs.length, 2);
  for (const g of gs) w.events.emit("hit", { source: w.player, target: g, damage: 999, dir: { x: 1, y: 0 }, charge: 1 });
  step(w, 60);
  const drops = gold(w); // two Graugr drops so far
  r.update(DT);
  r.update(DT); // the clear is announced once, not every frame
  const raid = w.loots.filter((e) => e.from === "raid");
  assert.equal(raid.length, 1);
  assert.equal(raid[0].amount, 30);
  assert.equal(gold(w), drops + 30);
  assert.deepEqual([w.loots.filter((e) => e.from === "graugr").length, w.banners.some((b) => /CLEARED/.test(b))], [2, true]);
  for (let i = 0; i < 60 * 5; i++) { step(w); r.update(DT); } // raid 2 begins
  const second = w.entities.filter((e) => e.isGraugr);
  assert.equal(second.length, 3);
  const before = gold(w);
  r.stop();
  step(w, 60);
  r.update(DT);
  assert.equal(gold(w), before, "stopping a raid is not clearing it");
  assert.equal(w.loots.filter((e) => e.from === "raid").length, 1);
});

test("a raid pays every player in the world, never through world.player", () => {
  const w = mkWorld();
  const second = { ...w.player, cls: { id: "warrior" }, x: 5 };
  w.entities.push(second);
  w.events.emit("raid:cleared", { number: 2 });
  assert.equal(w.inventory.count(GOLD_ID, "mage"), 40);
  assert.equal(w.inventory.count(GOLD_ID, "warrior"), 40);
  delete w.player;
  w.events.emit("raid:cleared", { number: 1 });
  assert.equal(w.inventory.count(GOLD_ID, "mage"), 70, "works without a world.player");
});

test("the gold is saved in the inventory save and nowhere else", () => {
  const storage = createMemoryStorage();
  const w = mkWorld();
  w.inventory = createInventory(storage);
  kill(w, w.spawn(new Graugr(100, 0, { tier: 0, rng: w.rng })));
  const saved = storage.load();
  assert.deepEqual(Object.keys(saved.characters.mage.items), ["gold"]);
  assert.equal(saved.characters.mage.items.gold, w.loots[0].amount);
  assert.deepEqual(saved.account.items, {}, "the account collection and the Wallet are untouched");
});

test("LootFx shows the result and writes no sim state; the pipeline lists both systems", () => {
  const w = mkWorld();
  const fx = new LootFx(w);
  w.events.emit("loot", { item: "gold", amount: 7, ok: true, from: "graugr", x: 10, y: 50 });
  w.events.emit("loot", { item: "gold", amount: 7, ok: false, reason: "inventory_full", from: "graugr", x: 10, y: 50 });
  assert.equal(w.numbers.length, 2);
  assert.equal(w.numbers[0][2], "+7 gold");
  assert.equal(w.numbers[1][2], "Inventory full");
  assert.ok(w.numbers[0][1] < 50, "text floats above the ground point");
  fx.dispose();
  w.events.emit("loot", { item: "gold", amount: 1, ok: true, from: "graugr", x: 0, y: 0 });
  assert.equal(w.numbers.length, 2, "disposed");
  assert.ok(SIM_SYSTEMS.some(([n, C]) => n === "loot" && C === LootSystem));
  assert.ok(VIEW_SYSTEMS.some(([n, C]) => n === "lootFx" && C === LootFx));
  assert.ok(SIM_SYSTEMS.findIndex(([n]) => n === "loot") > SIM_SYSTEMS.findIndex(([n]) => n === "xp"), "loot after xp");
});

console.log(`\n${passed} tests passed`);
