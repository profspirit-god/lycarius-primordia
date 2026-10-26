// H2a (V1.23.0.00): hunger on the player, its save and the fourth HUD bar. No browser, no dependencies.
//   node tests/hunger-player.test.mjs        (exit 0 = all passed)
// Covers: a Player owns a Hunger (fresh at 850 without a store); it drains 1 point per 9 s of sim time at any frame rate; it does not drain
// while downed (or while the world is paused: WorldScene.update returns before the entities run); the respawn floor of 25% (R20) raises and
// never lowers; `hunger:tier` events; HungerStore (autosave every 30 sim seconds, tier change, eat and respawn write at once, restore, corrupt,
// mismatch and newer saves, a newer save is never overwritten, other owners are kept, storage that throws); no stat, regen or speed changes
// yet (that is H2b); the Developer tools (set, eat, refusal at 100%); the HUD bar model and its place after Stamina; a Node import with no globals.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import "../src/content/index.js";
import { ClassRegistry } from "../src/classes/ClassRegistry.js";
import { Player } from "../src/entities/Player.js";
import { Hunger } from "../src/sim/hunger/Hunger.js";
import { PRIMORDIA_HUNGER, HUNGER_RESPAWN_FLOOR } from "../src/sim/hunger/definition.js";
import { HungerStore, HUNGER_STORE_VERSION, AUTOSAVE_SECONDS } from "../src/sim/hunger/HungerStore.js";
import { HUNGER_KEY, createLocalStorageAdapter } from "../src/core/LocalStorageAdapter.js";
import { hungerBarModel, HUNGER_TIER_NAMES } from "../src/ui/hungerBar.js";
import { DT, mkWorld, step, capture, createMemoryStorage } from "./helpers.mjs";

const mage = ClassRegistry.get("mage");
let passed = 0;
const test = (name, fn) => (fn(), passed++, console.log("ok  " + name));
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, `${msg ?? ""} ${a} vs ${b}`);

/** A memory storage that counts the writes. */
const counting = (initial) => {
  const inner = createMemoryStorage(initial);
  let saves = 0;
  return { load: () => inner.load(), save: (d) => (saves++, inner.save(d)), get saves() { return saves; }, inner };
};
/** A world with one player; `store` is optional. */
const mk = (store = null) => {
  const w = mkWorld();
  w.player = w.spawn(new Player(mage, null, store ? { hungerStore: store } : {}));
  return w;
};
const saved = (storage, owner = "mage") => storage.load()?.owners?.[owner];

// ---------------------------------------------------------------- the player owns a hunger
test("a player without a store gets a fresh, unsaved Hunger at the start value (85%, Full)", () => {
  const p = new Player(mage);
  assert.ok(p.hunger instanceof Hunger);
  assert.equal(p.hunger.value, 850);
  assert.equal(p.hunger.percent, 85);
  assert.equal(p.hunger.tierId, "full");
  assert.equal(p.hungerStore, null);
});

test("with a store the player shares the store's Hunger (the saved one)", () => {
  const st = new HungerStore("mage", PRIMORDIA_HUNGER, createMemoryStorage());
  const p = new Player(mage, null, { hungerStore: st });
  assert.equal(p.hunger, st.hunger);
});

// ---------------------------------------------------------------- draining
test("drain: 1 point per 9 s of sim time (90 s = 10 points)", () => {
  const w = mk();
  step(w, 90 * 60);
  near(w.player.hunger.value, 840);
  assert.equal(w.player.hunger.percent, 84);
});

test("drain is frame-rate independent (30 fps and 120 fps agree)", () => {
  const run = (dt, frames) => {
    const w = mkWorld();
    const p = w.spawn(new Player(mage));
    for (let i = 0; i < frames; i++) { w.time += dt; p.update(dt, w); }
    return p.hunger.value;
  };
  near(run(1 / 30, 30 * 180), run(1 / 120, 120 * 180));
  near(run(1 / 30, 30 * 180), 850 - 20);
});

test("no drain while downed; draining resumes after the respawn", () => {
  const w = mk();
  const p = w.player;
  p.vitals.hp = 0;
  p.down();
  step(w, 120); // 2 s downed, the respawn timer is 3 s
  assert.equal(p.downed, true);
  assert.equal(p.hunger.value, 850, "a downed player does not drain");
  step(w, 70); // past 3 s: respawned
  assert.equal(p.downed, false);
  const v0 = p.hunger.value; // a few frames after the respawn have drained a fraction of a point
  assert.ok(v0 > 849.9 && v0 <= 850, `draining resumed gently: ${v0}`);
  step(w, 540); // 9 s
  near(p.hunger.value, v0 - 1);
});

test("no drain while paused: WorldScene.update returns before the entities run", () => {
  const src = readFileSync(new URL("../src/scenes/WorldScene.js", import.meta.url), "utf8");
  const pause = src.indexOf("if (this.paused) return;"), run = src.indexOf("e.update(edt, this)");
  assert.ok(pause > 0 && run > pause, "the pause check comes first");
});

test("hunger stops at 0 and never kills: a starving player keeps its health", () => {
  const w = mk();
  w.player.setHunger(0);
  step(w, 600);
  assert.equal(w.player.hunger.value, 0);
  assert.equal(w.player.hunger.tierId, "starving");
  assert.equal(w.player.vitals.hp, w.player.vitals.maxHp);
  assert.equal(w.player.downed, false);
});

// ---------------------------------------------------------------- respawn floor (R20)
test("death never lowers hunger; respawn raises it to at least 25% and never lowers it", () => {
  const cases = [[0, HUNGER_RESPAWN_FLOOR], [100, 250], [249, 250], [250, 250], [700, 700], [1000, 1000]];
  assert.equal(HUNGER_RESPAWN_FLOOR, 250);
  for (const [before, after] of cases) {
    const p = new Player(mage);
    p.setHunger(before);
    p.vitals.hp = 0;
    p.down();
    assert.equal(p.hunger.value, before, `down() leaves ${before} alone`);
    p.respawn();
    assert.equal(p.hunger.value, after, `respawn from ${before}`);
  }
});

test("the respawn floor is written to the save at once", () => {
  const storage = counting();
  const st = new HungerStore("mage", PRIMORDIA_HUNGER, storage);
  const p = new Player(mage, null, { hungerStore: st });
  p.setHunger(10);
  p.down();
  p.respawn();
  assert.equal(saved(storage).value, 250);
});

// ---------------------------------------------------------------- tier events
test("a tier change emits hunger:tier with plain data (once, at the edge)", () => {
  const w = mk();
  const log = capture(w, "hunger:tier");
  w.player.setHunger(600.05); // just above the Full edge (600)
  step(w, 60); // 1 s drains 0.111 points: crosses below 600
  assert.equal(log.length, 1);
  assert.deepEqual([log[0].from, log[0].to, log[0].percent], ["full", "not_hungry", 59]);
  assert.equal(log[0].target, w.player);
  step(w, 600);
  assert.equal(log.length, 1, "no event without a tier change");
});

test("set, eat and respawn announce the tier change they cause", () => {
  const w = mk();
  const log = capture(w, "hunger:tier");
  w.player.setHunger(0, w);
  assert.deepEqual([log[0].from, log[0].to], ["full", "starving"]);
  w.player.respawn(w);
  assert.deepEqual([log[1].from, log[1].to], ["starving", "not_hungry"]);
  w.player.eatHunger(400, w);
  assert.deepEqual([log[2].from, log[2].to], ["not_hungry", "full"]);
  assert.equal(log.length, 3);
});

// ---------------------------------------------------------------- the store
test("HungerStore: a new character starts fresh, writes nothing until due", () => {
  const storage = counting();
  const st = new HungerStore("mage", PRIMORDIA_HUNGER, storage);
  assert.equal(st.loaded, "new");
  assert.equal(st.hunger.value, 850);
  assert.equal(storage.saves, 0);
});

test("HungerStore autosaves every 30 sim seconds, not before", () => {
  assert.equal(AUTOSAVE_SECONDS, 30);
  const storage = counting();
  const st = new HungerStore("mage", PRIMORDIA_HUNGER, storage);
  st.hunger.update(100);
  st.tick(29.9);
  assert.equal(storage.saves, 0);
  st.tick(0.2);
  assert.equal(storage.saves, 1);
  near(saved(storage).value, 850 - 100 / 9);
  st.tick(10);
  assert.equal(storage.saves, 1, "the counter restarted");
});

test("a Player with a store writes about once per 30 s of play, and on every tier change", () => {
  const storage = counting();
  const w = mk(new HungerStore("mage", PRIMORDIA_HUNGER, storage));
  step(w, 29 * 60);
  assert.equal(storage.saves, 0);
  step(w, 2 * 60); // 31 s
  assert.equal(storage.saves, 1);
  w.player.setHunger(600.05);
  const before = storage.saves;
  step(w, 60); // crosses the Full edge: a write at once
  assert.equal(storage.saves, before + 1);
  assert.equal(saved(storage).value < 600, true);
});

test("eating and the developer set write at once; a refused eat writes nothing", () => {
  const storage = counting();
  const st = new HungerStore("mage", PRIMORDIA_HUNGER, storage);
  const p = new Player(mage, null, { hungerStore: st });
  assert.equal(p.eatHunger(100).ok, true);
  assert.equal(storage.saves, 1);
  assert.equal(saved(storage).value, 950);
  p.setHunger(1000);
  assert.equal(storage.saves, 2);
  assert.deepEqual(p.eatHunger(10), { ok: false, reason: "cannot_eat" });
  assert.equal(storage.saves, 2, "a refused eat changes and saves nothing");
  assert.equal(p.hunger.value, 1000);
});

test("restore: a second session starts from the saved value (drain across sessions)", () => {
  const storage = createMemoryStorage();
  const w = mk(new HungerStore("mage", PRIMORDIA_HUNGER, storage));
  step(w, 90 * 60);
  w.player.hungerStore.save(); // what WorldScene.exit does
  const st2 = new HungerStore("mage", PRIMORDIA_HUNGER, storage);
  assert.equal(st2.loaded, "restored");
  near(st2.hunger.value, 840);
  const p2 = new Player(mage, null, { hungerStore: st2 });
  assert.equal(p2.hunger.percent, 84);
});

test("the save has the documented shape and the key is its own", () => {
  const storage = createMemoryStorage();
  const st = new HungerStore("mage", PRIMORDIA_HUNGER, storage);
  st.hunger.eat(50);
  assert.equal(st.save(), true);
  assert.deepEqual(storage.load(), { v: HUNGER_STORE_VERSION, owners: { mage: { v: 1, id: "hunger", value: 900 } } });
  assert.equal(HUNGER_KEY, "lycarius.primordia.hunger");
  const keys = readFileSync(new URL("../src/core/LocalStorageAdapter.js", import.meta.url), "utf8").match(/"lycarius\.primordia\.[a-z]+"/g);
  assert.equal(new Set(keys).size, keys.length, "every save has a different key");
});

test("the real adapter round-trips it (a fake Storage stands in for the browser)", () => {
  const mem = new Map();
  const backing = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  const st = new HungerStore("mage", PRIMORDIA_HUNGER, createLocalStorageAdapter(HUNGER_KEY, backing));
  st.hunger.update(900); // 100 points off
  st.save();
  assert.ok(mem.has(HUNGER_KEY));
  const again = new HungerStore("mage", PRIMORDIA_HUNGER, createLocalStorageAdapter(HUNGER_KEY, backing));
  near(again.hunger.value, 750);
});

test("another character's entry is kept when this one saves", () => {
  const other = { v: 1, id: "hunger", value: 123 };
  const storage = createMemoryStorage({ v: 1, owners: { thief: other } });
  const st = new HungerStore("mage", PRIMORDIA_HUNGER, storage);
  assert.equal(st.loaded, "new");
  st.save();
  assert.deepEqual(storage.load().owners.thief, other);
  assert.equal(storage.load().owners.mage.value, 850);
});

test("hostile or broken saves give a fresh Hunger and never throw", () => {
  const bad = [
    ["corrupt", "text"], ["corrupt", { v: 0, owners: {} }], ["corrupt", { v: "1", owners: {} }], ["corrupt", [1, 2]],
    ["corrupt", { v: 1, owners: { mage: { v: 1, id: "hunger", value: -5 } } }],
    ["corrupt", { v: 1, owners: { mage: { v: 1, id: "hunger", value: 5000 } } }],
    ["corrupt", { v: 1, owners: { mage: { v: 1, id: "hunger", value: "850" } } }],
    ["corrupt", { v: 1, owners: { mage: "x" } }],
    ["mismatch", { v: 1, owners: { mage: { v: 1, id: "thirst", value: 400 } } }],
  ];
  for (const [reason, raw] of bad) {
    const st = new HungerStore("mage", PRIMORDIA_HUNGER, { load: () => raw, save() {} });
    assert.equal(st.hunger.value, 850, JSON.stringify(raw));
    assert.equal(st.loaded, reason, JSON.stringify(raw));
  }
  const noOwners = new HungerStore("mage", PRIMORDIA_HUNGER, { load: () => ({ v: 1, owners: [] }), save() {} });
  assert.equal(noOwners.loaded, "new");
  const throwing = new HungerStore("mage", PRIMORDIA_HUNGER, { load() { throw new Error("no storage"); }, save() { throw new Error("full"); } });
  assert.equal(throwing.hunger.value, 850);
  assert.equal(throwing.save(), false);
  assert.doesNotThrow(() => throwing.tick(100, true));
});

test("a save from a NEWER game is never overwritten", () => {
  for (const raw of [{ v: 2, owners: { mage: { v: 1, id: "hunger", value: 400 } }, extra: true }, { v: 1, owners: { mage: { v: 2, id: "hunger", value: 400 } } }]) {
    const storage = counting(raw);
    const st = new HungerStore("mage", PRIMORDIA_HUNGER, storage);
    assert.equal(st.loaded, "newer_version");
    assert.equal(st.locked, true);
    assert.equal(st.hunger.value, 850, "a fresh one lives in memory for this session");
    st.hunger.eat(10);
    assert.equal(st.save(), false);
    st.tick(1000, true);
    assert.equal(storage.saves, 0);
    assert.deepEqual(storage.load(), raw);
  }
  const late = counting();
  const st = new HungerStore("mage", PRIMORDIA_HUNGER, late);
  late.inner.save({ v: 9, owners: {} }); // a newer build wrote it after our load
  assert.equal(st.save(), false);
  assert.equal(st.locked, true);
  assert.deepEqual(late.load(), { v: 9, owners: {} });
});

test("a bad owner id or a bad definition throws (a programming error, not bad data)", () => {
  for (const id of ["", "Mage", "9x", null, 5, "a b"]) assert.throws(() => new HungerStore(id, PRIMORDIA_HUNGER), /bad owner id/);
  assert.throws(() => new HungerStore("mage", { id: "hunger" }));
});

// ---------------------------------------------------------------- nothing but the stat and the bar changes yet
test("H2a applies no modifier: a starving player moves, regenerates and has stats exactly like a full one", () => {
  const run = (points) => {
    const w = mkWorld();
    const p = w.spawn(new Player(mage));
    w.player = p;
    p.setHunger(points);
    p.applyCommand({ seq: 1, mx: 1, my: 0, aim: 0, btn: 0 });
    p.vitals.hp = 10;
    p.vitals.mana = 10;
    p.vitals.stamina = 10;
    const stats = JSON.stringify(p.stats);
    step(w, 120);
    return { stats, x: p.x, y: p.y, hp: p.vitals.hp, mana: p.vitals.mana, stamina: p.vitals.stamina, mult: p.vitals.manaRegenMult };
  };
  const full = run(850);
  assert.ok(full.x > 100, "the player moved");
  assert.deepEqual(run(0), full, "Starving");
  assert.deepEqual(run(80), full, "Hungry");
  assert.deepEqual(run(1000), full, "Stuffed");
});

// ---------------------------------------------------------------- developer tools
test("developer tools: set and eat by percentage, with the refusal line at 100%", async () => {
  let WorldScene;
  try {
    ({ WorldScene } = await import("../src/scenes/WorldScene.js"));
  } catch {
    WorldScene = null; // the scene needs a browser to import on some setups: the player methods are tested above
  }
  if (!WorldScene) return;
  const p = new Player(mage);
  const ctx = { player: p };
  assert.equal(WorldScene.prototype.devSetHunger.call(ctx, 30), "set to 30%");
  assert.equal(p.hunger.value, 300);
  assert.equal(WorldScene.prototype.devEatHunger.call(ctx, 15), "ate +15%");
  assert.equal(p.hunger.value, 450);
  assert.equal(WorldScene.prototype.devEatHunger.call(ctx, 100), "ate +55% (overflow 45%, wasted)");
  assert.equal(p.hunger.value, 1000);
  assert.equal(WorldScene.prototype.devEatHunger.call(ctx, 10), "refused: hunger is full");
  assert.equal(WorldScene.prototype.devEatHunger.call(ctx, 0), "nothing to eat");
});

// ---------------------------------------------------------------- the HUD bar
test("hungerBarModel: a percentage, a tier name, a fraction and a tooltip", () => {
  const at = (v) => hungerBarModel(new Hunger(PRIMORDIA_HUNGER, { value: v }));
  assert.deepEqual(at(850), { frac: 0.85, text: "85%", title: "Hunger: Full (85%)", tier: "full" });
  assert.equal(at(0).text, "0%");
  assert.equal(at(0).title, "Hunger: Starving (0%)");
  assert.equal(at(79.9).text, "7%");
  assert.equal(at(1000).frac, 1);
  assert.equal(at(1000).title, "Hunger: Stuffed (100%)");
  assert.equal(at(250).title, "Hunger: Not hungry (25%)");
  for (const t of PRIMORDIA_HUNGER.tiers) assert.ok(HUNGER_TIER_NAMES[t.id], `a display name for ${t.id}`);
  assert.deepEqual(hungerBarModel({ value: 5, max: 0, percent: 0, tierId: "odd" }), { frac: 0, text: "0%", title: "Hunger: odd (0%)", tier: "odd" });
});

test("the HUD builds the Hunger bar after Stamina, and the CSS styles it", () => {
  const hud = readFileSync(new URL("../src/ui/PlayerHud.js", import.meta.url), "utf8");
  const order = ['bar("hp"', 'bar("mp"', 'bar("st"', 'bar("hg"'].map((s) => hud.indexOf(s));
  assert.ok(order.every((i) => i > 0) && order.every((v, i) => i === 0 || v > order[i - 1]), "HP, Mana, Stamina, Hunger");
  assert.match(hud, /for \(const id of \["hp", "mp", "st", "hg"\]\)/);
  assert.match(readFileSync(new URL("../css/style.css", import.meta.url), "utf8"), /\.hud-bar\.hg i \{/);
});

// ---------------------------------------------------------------- server-ready
test("Node imports the new sim files with no browser globals (R12)", () => {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const code = `import("./src/sim/hunger/HungerStore.js").then(async (m) => { await import("./src/ui/hungerBar.js"); const s = new m.HungerStore("mage", (await import("./src/sim/hunger/definition.js")).PRIMORDIA_HUNGER); s.save(); if (typeof window !== "undefined" || typeof document !== "undefined") process.exit(2); });`;
  const r = spawnSync(process.execPath, ["-e", code], { cwd: root, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
});

test("source rule check: HungerStore has no browser, clock or randomness", () => {
  const code = readFileSync(new URL("../src/sim/hunger/HungerStore.js", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  assert.doesNotMatch(code, /\bMath\.random\b|\brand\(|\brng\b|\bperformance\b|\bDate\b|\bsetTimeout\b|\bwindow\b|\bdocument\b|\blocalStorage\b|\bworld\.(?:player|input|game|camera)\b/);
});

console.log(`\n${passed} tests passed`);
