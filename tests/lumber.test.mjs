// Job track J1 (V1.20.0.00): the Velthorn tree, Velwood, the Basic Axe, Chop and job XP. No browser, no dependencies.
//   node tests/lumber.test.mjs        (exit 0 = all passed)
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import "../src/content/index.js";
import { ClassRegistry } from "../src/classes/ClassRegistry.js";
import { EventBus } from "../src/core/EventBus.js";
import { Rng } from "../src/sim/rng.js";
import { Player } from "../src/entities/Player.js";
import { Graugr } from "../src/entities/Graugr.js";
import { TrainingDummy } from "../src/entities/TrainingDummy.js";
import { Velthorn, VELTHORN } from "../src/entities/Velthorn.js";
import { Progression } from "../src/progression/Progression.js";
import { JobProgress, jobLevelInfo, JOB_SAVE_VERSION } from "../src/progression/JobProgress.js";
import { FireballProjectile } from "../src/skills/FireballProjectile.js";
import { Chop } from "../src/skills/Chop.js";
import { SIM_SYSTEMS, VIEW_SYSTEMS, createSystems } from "../src/systems/pipeline.js";
import { createInventory, CHARACTER_SLOTS } from "../src/sim/items/Inventory.js";
import { findItem } from "../src/sim/items/ItemRegistry.js";
import { BASIC_AXE_ID, VELWOOD_ID, LUMBER_ITEMS } from "../src/sim/items/lumber.js";
import { TOOLS, JOBS, LUMBERJACK, CHOP_XP, FELL_XP, jobXpForNext, MAX_JOB_XP } from "../src/sim/jobs/jobs.js";
import { TRAINING_TREES, firstCover } from "../src/sim/jobs/cover.js";
import { UNIVERSAL } from "../src/classes/Universal.js";
import { VIEWS } from "../src/view/index.js";
import { ICONS } from "../src/ui/icons.js";
import { ProfilePanel } from "../src/ui/ProfilePanel.js";
import { DT, createMemoryStorage } from "./helpers.mjs";

const mage = ClassRegistry.get("mage");
let passed = 0;
const test = (name, fn) => (fn(), passed++, console.log("ok  " + name));

/** The sim pipeline (damage, status, explosions, xp, jobs) with a real Player, Inventory and JobProgress. No view systems. */
function mkWorld({ seed = 1, axe = true, jobStore = createMemoryStorage(), invStore = createMemoryStorage() } = {}) {
  const w = { events: new EventBus(), entities: [], banners: [], rng: new Rng(seed), time: 0, seq: 0 };
  w.particles = { emit() {} };
  w.lights = { add() {} };
  w.camera = { addTrauma() {} };
  w.damageNumbers = { spawn() {} };
  w.hitstop = () => {};
  w.spawn = (e) => (w.entities.push(e), e);
  w.removeDummy = w.restoreDummy = w.pushBanner = () => {};
  w.inventory = createInventory(invStore);
  w.jobProgress = new JobProgress("mage", jobStore);
  createSystems(w, SIM_SYSTEMS);
  w.player = w.spawn(new Player(mage, new Progression(mage)));
  if (axe) w.jobs.ensureStarterTool(w.player);
  w.jobs.update();
  return w;
}
function step(w, n = 1) {
  for (let i = 0; i < n; i++) {
    w.time += DT;
    for (const e of w.entities.slice()) e.update?.(DT, w);
    w.entities = w.entities.filter((e) => !e.dead);
    w.status.update(DT);
    w.jobs.update(DT);
  }
}
/** One key press of Chop (the bit is high for exactly one tick), aimed at `aim`, then enough ticks to pass its cooldown. */
function swing(w, aim = 0, wait = 44) {
  const p = w.player, slot = p.caster.slots.find((s) => s.skill.id === "chop");
  p.applyCommand({ seq: ++w.seq, mx: 0, my: 0, aim, btn: p.slotBit(slot) });
  step(w);
  p.applyCommand({ seq: ++w.seq, mx: 0, my: 0, aim, btn: 0 });
  step(w, wait);
}
const tree = (w, x = 70, y = 0) => w.spawn(new Velthorn(x, y)); // player at 0,0 (radius 16): the trunk edge is about 28 px away
const fireHit = (w, t, source = w.player) => w.events.emit("hit", { source, target: t, damage: 9, crit: false, dir: { x: 1, y: 0 }, charge: 0.5, x: t.x, y: t.y, z: 30 });

test("content: Velwood and the Basic Axe are valid character items; the axe is the one tool; Chop is a universal action on C with an icon", () => {
  assert.equal(LUMBER_ITEMS.length, 2);
  for (const id of [BASIC_AXE_ID, VELWOOD_ID]) assert.equal(findItem(id).scope, "character", id);
  assert.deepEqual([findItem(BASIC_AXE_ID).category, findItem(BASIC_AXE_ID).maxStack], ["equipment", 1]);
  assert.equal(findItem(VELWOOD_ID).category, "material");
  assert.ok(Object.keys(TOOLS).every((id) => findItem(id) && JOBS[TOOLS[id].job]), "every tool is a registered item of a real job");
  assert.ok(UNIVERSAL.skills.includes("chop") && ICONS[Chop.icon] && UNIVERSAL.bindings.chop[0] === "KeyC");
  assert.ok(VIEWS.velthorn, "the tree has a view");
  const w = mkWorld();
  assert.ok(w.player.caster.has("chop"));
});

test("the training ground has a forest: 12 fixed spots, all clear of the player, the dummy and each other", () => {
  assert.equal(TRAINING_TREES.length, 12);
  for (const t of TRAINING_TREES) {
    assert.ok(Math.hypot(t.x, t.y) > 350, "clear of the player spawn and the dummy's patrol");
    assert.ok(Math.hypot(t.x - 340, t.y) > 300, "clear of the dummy");
  }
  for (let i = 0; i < TRAINING_TREES.length; i++)
    for (let j = i + 1; j < TRAINING_TREES.length; j++)
      assert.ok(Math.hypot(TRAINING_TREES[i].x - TRAINING_TREES[j].x, TRAINING_TREES[i].y - TRAINING_TREES[j].y) > 200);
});

test("a new character gets the Basic Axe once; a discarded axe is never given again", () => {
  const jobStore = createMemoryStorage(), invStore = createMemoryStorage();
  let w = mkWorld({ jobStore, invStore });
  assert.equal(w.inventory.count(BASIC_AXE_ID, "mage"), 1);
  assert.equal(w.player.toolId, BASIC_AXE_ID);
  w.inventory.remove(BASIC_AXE_ID, 1, "mage");
  w = mkWorld({ jobStore, invStore }); // next session, same saves
  assert.equal(w.inventory.count(BASIC_AXE_ID, "mage"), 0, "the starter flag was saved");
  assert.equal(w.player.toolId, null);
  assert.equal(w.jobs.ensureStarterTool(w.player), false);
});

test("Velthorn: solid and hittable, 5 chops, then a stump that is not solid and cannot be targeted", () => {
  const t = new Velthorn(100, 0);
  assert.deepEqual([t.solid, t.hittable, t.choppable, t.kind, t.maxChops, t.state], [true, true, true, "velthorn", 5, "standing"]);
  const w = mkWorld(), e = { source: w.player, target: t };
  for (let i = 1; i <= 4; i++) assert.deepEqual(t.onChop(e, w), { felled: false });
  assert.equal(t.chops, 4);
  const last = t.onChop(e, w);
  assert.equal(last.felled, true);
  assert.equal(last.itemId, VELWOOD_ID);
  assert.deepEqual([t.solid, t.hittable, t.choppable, t.state], [false, false, false, "felled"]);
  assert.equal(t.onChop(e, w), null, "a stump takes no more chops");
});

test("the drop is 10 to 15 Velwood, rolled from the seeded world dice (all six values appear, none outside)", () => {
  const seen = new Set();
  for (let seed = 1; seed <= 300; seed++) {
    const w = mkWorld({ seed }), t = new Velthorn(0, 0);
    t.chops = 4;
    const r = t.onChop({}, w);
    assert.ok(Number.isInteger(r.qty) && r.qty >= 10 && r.qty <= 15, String(r.qty));
    seen.add(r.qty);
  }
  assert.deepEqual([...seen].sort((a, b) => a - b), [10, 11, 12, 13, 14, 15]);
  const a = mkWorld({ seed: 7 }), b = mkWorld({ seed: 7 }), ta = new Velthorn(0, 0), tb = new Velthorn(0, 0);
  ta.chops = tb.chops = 4;
  assert.equal(ta.onChop({}, a).qty, tb.onChop({}, b).qty, "same seed, same drop");
});

test("Chop: a swing costs stamina and lands on the tree in front; five swings fell it and the Velwood lands in the bag", () => {
  const w = mkWorld(), t = tree(w), felled = [], rewards = [];
  w.events.on("tree:felled", (e) => felled.push(e));
  w.events.on("job:reward", (e) => rewards.push(e));
  const s0 = w.player.vitals.stamina;
  swing(w, 0, 0);
  assert.equal(t.chops, 1);
  assert.ok(w.player.vitals.stamina < s0, "the swing cost stamina");
  step(w, 44);
  for (let i = 0; i < 4; i++) swing(w, 0, 44 + 100); // plenty of time for stamina to come back too
  assert.equal(t.state, "felled");
  assert.equal(felled.length, 1);
  const n = w.inventory.count(VELWOOD_ID, "mage");
  assert.ok(n >= 10 && n <= 15 && n === felled[0].qty, `bag holds ${n}`);
  assert.deepEqual([rewards[0].granted, rewards[0].lost], [n, 0]);
});

test("Chop: a miss still swings (and costs stamina) but touches nothing; out of reach and behind you do not count", () => {
  const w = mkWorld(), t = tree(w, 300, 0), misses = [];
  w.events.on("chop", (e) => misses.push(e));
  swing(w, 0); // 300 px away
  w.player.x = 200; // trunk edge now about 58 px from the body: beyond the 44 px reach
  swing(w, 0);
  w.player.x = 250;
  swing(w, Math.PI); // facing away
  assert.equal(t.chops, 0);
  assert.equal(misses.length, 3);
  assert.ok(misses.every((e) => e.target === null));
  w.player.x = 232; // gap = 300 - 232 - 16 - 26 = 26 px
  swing(w, 0.5); // 0.5 rad off: still inside the arc
  assert.equal(t.chops, 1);
  swing(w, 2.0); // far outside the arc
  assert.equal(t.chops, 1);
});

test("Chop needs a tool and stamina: no axe = no swing; no stamina = no swing and the bar flashes", () => {
  const w = mkWorld({ axe: false }), t = tree(w);
  swing(w, 0);
  assert.equal(t.chops, 0, "no axe");
  assert.equal(Chop.canUse(w.player), false);
  const v = mkWorld(), tv = tree(v);
  v.player.vitals.stamina = 3;
  swing(v, 0, 2);
  assert.equal(tv.chops, 0, "3 stamina is below the 8 an axe swing costs");
  assert.ok(v.player.lowStaminaFlash > 0);
});

test("job XP: 3 per landed swing, +15 for the fall (30 for one tree); it never touches character or specialization XP", () => {
  const w = mkWorld(), t = tree(w), prog = w.player.prog, xps = [];
  w.events.on("job:xp", (e) => xps.push(e.amount));
  for (let i = 0; i < 5; i++) swing(w, 0, 150);
  assert.equal(t.state, "felled");
  assert.deepEqual(xps, [CHOP_XP, CHOP_XP, CHOP_XP, CHOP_XP, CHOP_XP, FELL_XP]);
  assert.equal(w.jobProgress.xp(LUMBERJACK), 5 * CHOP_XP + FELL_XP);
  assert.deepEqual([prog.charXp, prog.specXp], [0, 0]);
});

test("job levels: the curve, a level-up event, and a miss gives nothing", () => {
  const jp = new JobProgress("mage");
  assert.deepEqual([jp.level(LUMBERJACK), jobXpForNext(1), jobXpForNext(2)], [1, 60, 170]);
  assert.deepEqual(jp.addXp(LUMBERJACK, 59), { gained: 59, levels: [] });
  assert.deepEqual(jp.addXp(LUMBERJACK, 1), { gained: 1, levels: [2] });
  assert.deepEqual(jp.addXp(LUMBERJACK, 5000).levels.slice(0, 2), [3, 4]);
  for (const bad of [0, -3, 1.5, NaN, "9", null]) assert.deepEqual(jp.addXp(LUMBERJACK, bad), { gained: 0, levels: [] });
  assert.deepEqual(jp.addXp("fishing", 5), { gained: 0, levels: [] });
  const max = jobLevelInfo(LUMBERJACK, MAX_JOB_XP);
  assert.deepEqual([max.level, max.need, max.frac], [JOBS[LUMBERJACK].maxLevel, 0, 1]);
  const w = mkWorld(), ups = [];
  w.events.on("job:levelup", (e) => ups.push(e.level));
  w.jobProgress.addXp(LUMBERJACK, 55);
  tree(w);
  swing(w, 0, 0); // +3 XP: 58, not yet
  assert.deepEqual(ups, []);
  step(w, 44);
  swing(w, 0, 0); // 61: level 2 (the system reports it)
  assert.deepEqual(ups, [2]);
});

test("job save: versioned, per character, survives a restart, repairs bad data, never invents XP", () => {
  const store = createMemoryStorage();
  const a = new JobProgress("mage", store);
  a.addXp(LUMBERJACK, 250);
  a.markStarterGiven();
  const b = new JobProgress("mage", store);
  assert.deepEqual([b.xp(LUMBERJACK), b.starter, b.level(LUMBERJACK)], [250, true, 3]);
  assert.equal(new JobProgress("warrior", store).xp(LUMBERJACK), 0, "another character starts fresh");
  new JobProgress("warrior", store).addXp(LUMBERJACK, 7);
  assert.equal(new JobProgress("mage", store).xp(LUMBERJACK), 250, "saving one character keeps the other");
  assert.equal(store.load().v, JOB_SAVE_VERSION);
  for (const junk of [null, 5, "x", [], { v: 2, owners: {} }, { v: 1, owners: 3 }, { v: 1, owners: { mage: { xp: { lumberjack: -5, mining: 9 } } } }, { v: 1, owners: { mage: { xp: { lumberjack: 1.5 } } } }, { v: 1, owners: { mage: { xp: { lumberjack: 1e12 } } } }])
    assert.equal(new JobProgress("mage", { load: () => junk, save() {} }).xp(LUMBERJACK), 0, JSON.stringify(junk));
  assert.throws(() => new JobProgress("Bad Id!"), /bad owner/);
  assert.doesNotThrow(() => new JobProgress("mage", { load() { throw new Error("boom"); }, save() { throw new Error("boom"); } }).addXp(LUMBERJACK, 5));
});

test("a full bag takes what fits and reports the rest as lost; nothing is invented", () => {
  const w = mkWorld(), t = tree(w);
  // fill every slot but one with Velwood (maxStack 999 per slot)
  w.inventory.grant(VELWOOD_ID, 999 * (CHARACTER_SLOTS - 2), "mage"); // the axe takes one slot, so one slot is left
  const before = w.inventory.count(VELWOOD_ID, "mage"), got = [];
  w.events.on("job:reward", (e) => got.push(e));
  t.chops = 4;
  swing(w, 0, 0);
  assert.deepEqual([got[0].granted, got[0].lost], [got[0].granted, 0], "one free slot holds the whole drop");
  assert.ok(got[0].granted >= 10 && got[0].granted <= 15);
  assert.equal(w.inventory.count(VELWOOD_ID, "mage"), before + got[0].granted);
  // now truly full: one slot, 999 of it used up
  const f = mkWorld(), tf = tree(f), r = [];
  f.inventory.grant(VELWOOD_ID, 999 * (CHARACTER_SLOTS - 1), "mage"); // axe + 29 full stacks = full
  f.events.on("job:reward", (e) => r.push(e));
  tf.chops = 4;
  swing(f, 0, 0);
  assert.equal(tf.state, "felled", "the tree still falls");
  assert.deepEqual([r[0].granted, r[0].lost >= 10], [0, true]);
  assert.equal(f.inventory.count(VELWOOD_ID, "mage"), 999 * (CHARACTER_SLOTS - 1));
});

test("fire: any hit that is not an enemy's body sets the tree alight at once; it burns, cannot be chopped and drops nothing", () => {
  const w = mkWorld(), t = tree(w), drops = [], scorched = [];
  w.events.on("tree:felled", (e) => drops.push(e));
  w.events.on("tree:scorched", (e) => scorched.push(e));
  fireHit(w, t);
  assert.equal(t.state, "burning");
  assert.ok(t.burn, "it is burning");
  assert.equal(scorched.length, 1);
  assert.deepEqual([t.solid, t.hittable, t.choppable], [true, true, false], "still solid (it keeps shielding) but not choppable");
  for (let i = 0; i < 6; i++) swing(w, 0, 60);
  assert.equal(t.chops, 0);
  assert.equal(w.inventory.count(VELWOOD_ID, "mage"), 0);
  assert.equal(w.jobProgress.xp(LUMBERJACK), 0, "no job XP for a burning tree");
  assert.equal(drops.length, 0);
  fireHit(w, t); // a second hit refreshes the fire, no second scorch event
  assert.equal(scorched.length, 1);
});

test("fire: the fire burns out into a dead stump (no drop, no collision), which grows back later with its 5 chops", () => {
  const w = mkWorld(), t = tree(w, 500, 0), out = [], back = [];
  w.events.on("tree:burnedout", (e) => out.push(e));
  w.events.on("tree:regrown", (e) => back.push(e));
  fireHit(w, t);
  step(w, Math.ceil((VELTHORN.burnTime + 1.2) / DT));
  assert.equal(t.state, "charred");
  assert.equal(out.length, 1);
  assert.deepEqual([t.solid, t.hittable, t.choppable], [false, false, false]);
  assert.equal(w.inventory.count(VELWOOD_ID, "mage"), 0);
  step(w, Math.ceil((VELTHORN.charredTime + 0.5) / DT));
  assert.equal(t.state, "standing");
  assert.equal(back.length, 1);
  assert.deepEqual([t.chops, t.solid, t.hittable, t.choppable], [0, true, true, true]);
});

test("a felled tree grows back after its regrow time", () => {
  const w = mkWorld(), t = tree(w);
  t.chops = 4;
  swing(w, 0, 0);
  assert.equal(t.state, "felled");
  step(w, Math.ceil((VELTHORN.regrowTime - 1) / DT));
  assert.equal(t.state, "felled");
  step(w, Math.ceil(2 / DT));
  assert.equal(t.state, "standing");
  assert.equal(t.chops, 0);
});

test("an enemy's body (Graugr) bounces off a tree: it does not set it alight", () => {
  const w = mkWorld(), t = tree(w), g = new Graugr(0, 0, { rng: w.rng });
  fireHit(w, t, g);
  assert.equal(t.state, "standing");
  assert.equal(t.burn, null);
});

test("a real Fireball stops on the tree: the tree burns, what stands behind it is untouched", () => {
  const w = mkWorld(), t = tree(w, 200, 0), dummy = w.spawn(new TrainingDummy(400, 0, { rng: w.rng })), hits = [];
  w.events.on("hit", (e) => hits.push(e.target));
  const ball = w.spawn(new FireballProjectile({ owner: w.player, x: 20, y: 0, z: 30, angle: 0, charge: 0.6, burn: { chance: [1, 1], duration: [2, 2], dps: 2 } }));
  step(w, 120);
  assert.equal(ball.dead, true);
  assert.deepEqual(hits, [t], "only the tree was hit");
  assert.equal(dummy.hits, 0);
  assert.equal(t.state, "burning");
});

test("cover: a tree between a Graugr and the player cuts off the barrage, the poke and the leap", () => {
  const w = mkWorld(), g = w.spawn(new Graugr(0, 0, { rng: w.rng })), p = w.player, t = tree(w, 45, 0), hits = [];
  p.x = 100;
  p.y = 0;
  w.events.on("hit", (e) => hits.push([e.source === g ? "graugr" : "other", e.target === p ? "player" : e.target === t ? "tree" : "x"]));
  assert.equal(firstCover(w, g.x, g.y, p.x, p.y), t);
  g.swingHit(w, p);
  assert.deepEqual(hits, [], "the arms hit the tree, not the player");
  g.pokeHit(w, p, 0);
  assert.deepEqual(hits, [["graugr", "tree"]], "the tree takes the poke");
  const hp = p.vitals.hp;
  g.leap(w, 1, 0);
  assert.equal(p.vitals.hp, hp, "the leap does not reach the player");
  assert.ok(g.x < t.x - t.radius, "the dash stopped in front of the tree");
  assert.equal(t.state, "standing", "none of it scorched the tree");
  // no tree between: the same attacks land
  const w2 = mkWorld(), g2 = w2.spawn(new Graugr(0, 0, { rng: w2.rng })), p2 = w2.player, h2 = [];
  p2.x = 100;
  w2.events.on("hit", (e) => h2.push(e.target === p2));
  g2.swingHit(w2, p2);
  g2.pokeHit(w2, p2, 0);
  assert.deepEqual(h2, [true, true]);
  // a dead stump is no cover
  t.fall(10, "felled");
  assert.equal(firstCover(w, 0, 0, 100, 0), null);
});

test("collision: Graugrs, the dummy and the player cannot stand inside a tree", () => {
  const w = mkWorld(), t = tree(w, 300, 300), g = w.spawn(new Graugr(300, 290, { rng: w.rng })), d = w.spawn(new TrainingDummy(305, 310, { rng: w.rng }));
  w.player.x = 295;
  w.player.y = 305;
  step(w, 2);
  for (const e of [g, d, w.player]) assert.ok(Math.hypot(e.x - t.x, e.y - t.y) >= e.radius + t.radius - 0.01, e.constructor.name);
});

test("the Profile panel shows the job level in the player stats, from the job save", () => {
  const w = mkWorld();
  w.jobProgress.addXp(LUMBERJACK, 100);
  const html = ProfilePanel.prototype.jobs.call({ world: w, xp: ProfilePanel.prototype.xp });
  assert.match(html, /Lumberjack Level 2/);
  assert.match(html, /40 \/ 170 XP/);
  assert.equal(ProfilePanel.prototype.jobs.call({ world: {}, xp: ProfilePanel.prototype.xp }), "");
});

test("pipeline: JobSystem is a sim system, JobFx a view system; the same seeded forest ends the same with and without the view", () => {
  assert.ok(SIM_SYSTEMS.some(([n]) => n === "jobs") && VIEW_SYSTEMS.some(([n]) => n === "jobFx"));
  const run = () => {
    const w = mkWorld({ seed: 5 });
    for (const s of TRAINING_TREES.slice(0, 3)) w.spawn(new Velthorn(s.x, s.y));
    const t = tree(w);
    for (let i = 0; i < 5; i++) swing(w, 0, 100);
    return [t.state, w.inventory.count(VELWOOD_ID, "mage"), w.jobProgress.xp(LUMBERJACK), w.rng.state()];
  };
  assert.deepEqual(run(), run());
});

test("source rule check: the new sim files use no browser, clock, Math.random, presentation call or world.player (the audit counts the same)", () => {
  const files = ["src/entities/Velthorn.js", "src/skills/Chop.js", "src/sim/jobs/jobs.js", "src/sim/jobs/cover.js", "src/sim/jobs/JobSystem.js", "src/sim/items/lumber.js", "src/progression/JobProgress.js"];
  const bad = /\b(?:document|window|navigator)\.|\blocalStorage\b|\bperformance\.now\b|\bDate\.now\b|\bsetTimeout\b|\bsetInterval\b|\bMath\.random\b|\brand\(|\bSettings\.|\b(?:particles|lights|damageNumbers|toasts)\.|\baddTrauma\b|\bhitstop\b|\.audio\b|\bctx\b|\bcamera\b|\.input\b|\bworld\.game\b|\bworld\.player\b/;
  for (const f of files) {
    const src = readFileSync(new URL("../" + f, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    assert.doesNotMatch(src, bad, f);
  }
});

console.log(`\n${passed} tests passed`);
