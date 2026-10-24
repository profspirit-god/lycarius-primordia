// Stat tickets and stat training: one ticket per stat, used from the inventory, a permanent bonus in its own save, applied to the player.
//   node tests/training.test.mjs        (exit 0 = all passed)
import assert from "node:assert/strict";
import "../src/content/index.js";
import { Mage } from "../src/classes/Mage.js";
import { Player } from "../src/entities/Player.js";
import { createInventory } from "../src/sim/items/Inventory.js";
import { createMemoryStorage } from "../src/sim/storage.js";
import { findItem, validateItemDef } from "../src/sim/items/ItemRegistry.js";
import { STAT_TICKETS, TICKET_ITEMS, TICKET_STATS, ticketById, ticketForStat } from "../src/sim/items/tickets.js";
import { StatTraining, createStatTraining, readTrainingSave, TRAINING_SAVE_VERSION } from "../src/sim/stats/StatTraining.js";
import { TRAINING_KEY, PROGRESS_KEY, INVENTORY_KEY } from "../src/core/LocalStorageAdapter.js";

let passed = 0;
const test = (name, fn) => (fn(), passed++, console.log("ok  " + name));
const mk = () => {
  const s = createMemoryStorage(), inv = createInventory(createMemoryStorage()), tr = createStatTraining(s);
  return { s, inv, tr };
};

test("there is a ticket for every stat the sim has, and nothing else", () => {
  const simStats = Object.keys(Mage.stats).filter((k) => !["radius", "height"].includes(k)).sort();
  assert.deepEqual([...TICKET_STATS].sort(), simStats, "all seven stats: maxHp hpRegen maxMana manaRegen maxStamina staminaRegen speed");
  assert.equal(STAT_TICKETS.length, 7);
  assert.equal(new Set(STAT_TICKETS.map((t) => t.id)).size, 7);
  for (const t of STAT_TICKETS) assert.equal(ticketForStat(t.stat), t);
  assert.equal(ticketById("nope"), null);
});

test("every ticket is a valid, registered, character-owned, usable, 1 g consumable", () => {
  assert.equal(TICKET_ITEMS.length, 7);
  for (const d of TICKET_ITEMS) {
    assert.deepEqual(validateItemDef(d), [], d.id);
    const reg = findItem(d.id);
    assert.ok(reg && Object.isFrozen(reg), d.id);
    assert.deepEqual([reg.scope, reg.category, [...reg.actions], reg.weightMg], ["character", "consumable", ["use"], 1000], d.id);
  }
});

test("using a ticket takes it from the inventory and raises the stat for good", () => {
  const { inv, tr } = mk();
  inv.grant("ticket_max_health", 2, "mage");
  const r = tr.use(inv, "mage", "ticket_max_health");
  assert.deepEqual(r, { ok: true, stat: "maxHp", gain: 5, count: 1, cap: 10 });
  assert.equal(inv.count("ticket_max_health", "mage"), 1);
  assert.equal(tr.bonus("mage").maxHp, 5);
  tr.use(inv, "mage", "ticket_max_health");
  assert.equal(tr.bonus("mage").maxHp, 10);
  assert.equal(inv.owns("ticket_max_health", "mage"), false);
  assert.equal(tr.bonus("warrior").maxHp, 0, "another character is untouched");
});

test("a failed use changes nothing: no ticket, a maxed stat (the ticket is kept), a bad owner, read only", () => {
  const { s, inv, tr } = mk();
  const none = JSON.stringify(s.load());
  assert.deepEqual(tr.use(inv, "mage", "ticket_max_mana"), { ok: false, reason: "not_enough" });
  assert.deepEqual(tr.use(inv, "mage", "gold"), { ok: false, reason: "not_a_ticket" });
  assert.deepEqual(tr.use(inv, "Bad Owner", "ticket_max_mana"), { ok: false, reason: "bad_owner" });
  assert.deepEqual(tr.use(inv, "mage", "ticket_nope"), { ok: false, reason: "not_a_ticket" });
  assert.equal(JSON.stringify(s.load()), none);
  inv.grant("ticket_move_speed", 12, "mage");
  for (let i = 0; i < 10; i++) assert.equal(tr.use(inv, "mage", "ticket_move_speed").ok, true);
  assert.deepEqual(tr.use(inv, "mage", "ticket_move_speed"), { ok: false, reason: "maxed" });
  assert.equal(inv.count("ticket_move_speed", "mage"), 2, "a maxed stat refuses BEFORE the ticket is taken");
  assert.equal(tr.bonus("mage").speed, 50);
});

test("the bonus is exact: no floating point drift", () => {
  const { inv, tr } = mk();
  inv.grant("ticket_health_regen", 10, "mage");
  for (let i = 1; i <= 10; i++) {
    tr.use(inv, "mage", "ticket_health_regen");
    assert.equal(tr.bonus("mage").hpRegen, Math.round(i * 0.05 * 1000) / 1000);
  }
  assert.equal(tr.bonus("mage").hpRegen, 0.5);
});

test("the training has its own versioned save; it survives a reload and is never the progression or inventory save", () => {
  const { s, inv, tr } = mk();
  inv.grant("ticket_max_mana", 3, "mage");
  inv.grant("ticket_stamina_regen", 1, "mage");
  for (let i = 0; i < 3; i++) tr.use(inv, "mage", "ticket_max_mana");
  tr.use(inv, "mage", "ticket_stamina_regen");
  assert.deepEqual(s.load(), { v: TRAINING_SAVE_VERSION, characters: { mage: { maxMana: 3, staminaRegen: 1 } } });
  const again = new StatTraining(s);
  assert.equal(again.status, "ok");
  assert.equal(again.bonus("mage").maxMana, 30);
  assert.ok(new Set([TRAINING_KEY, PROGRESS_KEY, INVENTORY_KEY]).size === 3, "three different keys");
  assert.equal(TRAINING_KEY, "lycarius.primordia.training");
});

test("a hostile save never invents training", () => {
  const bad = (raw, status) => {
    const t = new StatTraining(createMemoryStorage(raw));
    for (const k of TICKET_STATS) assert.equal(t.count("mage", k), 0, JSON.stringify(raw));
    if (status) assert.equal(t.status, status);
  };
  bad({ v: 1, characters: { mage: { maxHp: 11 } } }, "repaired"); // over the cap
  bad({ v: 1, characters: { mage: { maxHp: -1 } } }, "repaired");
  bad({ v: 1, characters: { mage: { maxHp: 1.5 } } }, "repaired");
  bad({ v: 1, characters: { mage: { maxHp: "5" } } }, "repaired");
  bad({ v: 1, characters: { mage: { strength: 3 } } }, "repaired"); // not a stat
  bad({ v: 1, characters: { "Bad Owner": { maxHp: 1 } } }, "repaired");
  bad({ v: 9, characters: { mage: { maxHp: 1 } } }, "newer_version");
  bad("x", "corrupt");
  assert.equal(readTrainingSave(null).status, "new");
  const newer = new StatTraining(createMemoryStorage({ v: 9 }));
  const inv = createInventory(createMemoryStorage());
  inv.grant("ticket_max_health", 1, "mage");
  assert.deepEqual(newer.use(inv, "mage", "ticket_max_health"), { ok: false, reason: "read_only" });
  assert.equal(inv.count("ticket_max_health", "mage"), 1);
});

test("the player's stats and vitals include the bonus, for all seven stats", () => {
  const p = new Player(Mage);
  const base = { ...p.stats };
  const { inv, tr } = mk();
  for (const t of STAT_TICKETS) inv.grant(t.id, 3, "mage");
  for (const t of STAT_TICKETS) for (let i = 0; i < 3; i++) tr.use(inv, "mage", t.id);
  p.setTraining(tr.bonus("mage"));
  const want = { maxHp: 50 + 15, hpRegen: 0.1 + 0.15, maxMana: 100 + 30, manaRegen: 1 + 0.3, maxStamina: 100 + 30, staminaRegen: 8 + 2.4, speed: 230 + 15 };
  for (const [k, v] of Object.entries(want)) assert.equal(p.stats[k], Math.round(v * 1000) / 1000, k);
  assert.equal(base.maxHp, 50);
  const v = p.vitals;
  assert.deepEqual([v.maxHp, v.hpRegen, v.maxMana, v.manaRegen, v.maxStamina, v.staminaRegen], [65, 0.25, 130, 1.3, 130, 10.4]);
  assert.equal(v.hp, 65, "a higher maximum also fills what it added");
  assert.equal(v.mana, 130);
  assert.equal(v.stamina, 130);
  assert.equal(p.stats.radius, 16, "non-ticket stats are unchanged");
  p.setTraining({});
  assert.equal(p.stats.maxHp, 50, "removing the bonus restores the base");
  assert.equal(v.hp, 50, "and never leaves current above the maximum");
});

test("training survives respawn and does not revive a downed player", () => {
  const p = new Player(Mage);
  p.setTraining({ maxHp: 20 });
  p.vitals.hp = 0;
  p.down();
  p.setTraining({ maxHp: 30 });
  assert.equal(p.vitals.hp, 0, "more maximum health does not revive");
  p.respawn();
  assert.equal(p.vitals.hp, 80);
  assert.equal(p.vitals.maxHp, 80);
});

test("bad bonus input never breaks the stats", () => {
  const p = new Player(Mage);
  for (const bad of [null, undefined, 5, "x", [], { maxHp: NaN, speed: "5", hpRegen: Infinity }]) {
    p.setTraining(bad);
    for (const v of Object.values(p.stats)) assert.ok(Number.isFinite(v));
    assert.equal(p.stats.maxHp, 50);
  }
});

console.log(`\n${passed} tests passed`);
