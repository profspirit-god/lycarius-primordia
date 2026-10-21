// Headless tests for Mana Regen (Mage passive) and Dodge (universal ability). No browser, no dependencies.
//   node tests/abilities.test.mjs        (exit 0 = all passed)
import assert from "node:assert/strict";
import { EventBus } from "../src/core/EventBus.js";
import "../src/content/index.js";
import { ClassRegistry } from "../src/classes/ClassRegistry.js";
import { Player } from "../src/entities/Player.js";
import { Progression } from "../src/progression/Progression.js";
import { Vitals } from "../src/systems/Vitals.js";
import { ManaRegenFx } from "../src/systems/ManaRegenFx.js";
import { DodgeFx } from "../src/systems/DodgeFx.js";
import { ICONS } from "../src/ui/icons.js";

const DT = 1 / 60;
const mage = ClassRegistry.get("mage");
function mkWorld() {
  const w = { events: new EventBus(), entities: [], pressed: new Set(), down: new Set() };
  w.particles = { emit() {} };
  w.lights = { add() {} };
  w.spawn = (e) => (w.entities.push(e), e);
  w.input = { isDown: (k) => w.down.has(k), wasPressed: (k) => w.pressed.has(k), mouse: { x: 0, y: 0 } };
  w.camera = { screenToWorld: () => ({ x: 100, y: -32 }) }; // the cursor is level with the body, to the right: aim = 0
  w.game = { width: 800, height: 600 };
  w.player = w.spawn(new Player(mage, new Progression(mage)));
  return w;
}
const step = (w, n = 1) => {
  for (let i = 0; i < n; i++) {
    for (const e of w.entities.slice()) e.update(DT, w);
    w.entities = w.entities.filter((e) => !e.dead);
    w.pressed.clear();
  }
};
const press = (w, key) => (w.pressed.add(key), step(w));
let passed = 0;
const test = (name, fn) => (fn(), passed++, console.log("ok  " + name));
globalThis.localStorage ??= { getItem: () => null, setItem() {} };

test("class data: Mana Regen is owned at once, Dodge is universal", () => {
  const w = mkWorld(),
    c = w.player.caster;
  assert.ok(c.has("manaRegen") && c.has("dodge") && c.has("fireball"));
  assert.ok(!c.has("flameShield")); // unlock levels still apply
  assert.deepEqual(c.slots.find((s) => s.skill.id === "manaRegen").keys, ["KeyF"]);
  for (const id of ["manaRegen", "dodge"]) assert.ok(ICONS[id]);
});

test("Mana Regen: free, x5 regen for 30 s, then back to normal, 180 s cooldown", () => {
  const w = mkWorld(),
    p = w.player,
    v = p.vitals;
  v.mana = 0;
  press(w, "KeyF");
  assert.ok(p.manaBuff && v.manaRegenMult === 5);
  assert.ok(v.mana < 0.1, "no mana was spent");
  const slot = p.caster.slots.find((s) => s.skill.id === "manaRegen");
  assert.ok(Math.abs(slot.cooldown - 180) < 0.05);
  const m0 = v.mana;
  step(w, 60);
  assert.ok(Math.abs(v.mana - m0 - 5 * v.manaRegen) < 0.05, "5 mana in one second at x5");
  step(w, 60 * 30);
  assert.ok(!p.manaBuff && v.manaRegenMult === 1);
  v.mana = 0;
  const m1 = v.mana;
  step(w, 60);
  assert.ok(Math.abs(v.mana - m1 - v.manaRegen) < 0.05, "normal regen again");
  press(w, "KeyF"); // still on cooldown
  assert.ok(!p.manaBuff);
});

test("Mana Regen: ends when the player is downed and does not leak into the respawn", () => {
  const w = mkWorld(),
    p = w.player;
  press(w, "KeyF");
  p.onHit({ damage: 999, dir: { x: 1, y: 0 }, charge: 0 });
  assert.ok(p.downed && !p.manaBuff && p.vitals.manaRegenMult === 1);
  step(w, 60 * 4);
  assert.ok(!p.downed && p.vitals.manaRegenMult === 1);
});

test("Dodge: 20 stamina, moves backwards over time (not instant), 25 s cooldown", () => {
  const w = mkWorld(),
    p = w.player;
  const s0 = p.vitals.stamina;
  press(w, "ShiftLeft");
  assert.ok(p.dodge);
  assert.ok(s0 - p.vitals.stamina > 19.9 && s0 - p.vitals.stamina < 20.5, "20 stamina paid (plus a frame of regen)");
  step(w);
  assert.ok(p.x < 0 && p.x > -100, "after a frame or two it has moved a little, not all the way");
  step(w, 60);
  assert.ok(!p.dodge && p.hittable);
  assert.ok(Math.abs(p.x - -130) < 1 && Math.abs(p.y) < 1, `ends 130 px behind, got ${p.x}`);
  const slot = p.caster.slots.find((s) => s.skill.id === "dodge");
  assert.ok(slot.cooldown > 23.5 && slot.cooldown <= 24.2);
  const x = p.x;
  press(w, "ShiftLeft"); // cooldown: nothing happens
  assert.ok(!p.dodge && p.x === x);
});

test("Dodge: not hittable during the first 0.18 s only", () => {
  const w = mkWorld(),
    p = w.player;
  press(w, "ShiftLeft");
  assert.equal(p.hittable, false);
  step(w, 6); // ~0.1 s
  assert.equal(p.hittable, false);
  step(w, 8); // ~0.23 s
  assert.equal(p.hittable, true);
  assert.ok(p.dodge);
});

test("Dodge: refused without 20 stamina, flashes the bar, spends nothing", () => {
  const w = mkWorld(),
    p = w.player;
  p.vitals.stamina = 10;
  press(w, "ShiftLeft");
  assert.ok(!p.dodge && p.lowStaminaFlash > 0 && Math.abs(p.vitals.stamina - 10) < 1);
  assert.equal(p.caster.slots.find((s) => s.skill.id === "dodge").cooldown, 0);
});

test("Dodge: cancels a charging cast and blocks new casts until it ends", () => {
  const w = mkWorld(),
    p = w.player;
  w.down.add("Mouse0");
  step(w, 10);
  assert.ok(p.caster.charging);
  press(w, "ShiftLeft");
  assert.ok(!p.caster.charging);
  step(w, 5);
  assert.ok(!p.caster.charging, "still dodging, mouse still held");
  step(w, 30);
  assert.ok(p.caster.charging, "casting resumes after the dodge");
});

test("Dodge: stunned or downed players cannot dodge", () => {
  const w = mkWorld(),
    p = w.player;
  p.stunT = 1;
  press(w, "ShiftLeft");
  assert.ok(!p.dodge);
  p.stunT = 0;
  p.onHit({ damage: 999, dir: { x: 1, y: 0 }, charge: 0 });
  press(w, "ShiftLeft");
  assert.ok(!p.dodge);
});

test("Vitals: regen multiplier defaults to 1 and resets on configure", () => {
  const v = new Vitals(mage.stats);
  assert.equal(v.manaRegenMult, 1);
  v.manaRegenMult = 5;
  v.configure(mage.stats);
  assert.equal(v.manaRegenMult, 1);
});

test("FX: glow and trail draw with finite numbers only", () => {
  const w = mkWorld(),
    bad = [];
  const ctx = new Proxy({}, {
    get: (t, k) =>
      typeof k === "symbol"
        ? undefined
        : (...a) => {
            for (const x of a) if (typeof x === "number" && !Number.isFinite(x)) bad.push(k);
            if (/Gradient$/.test(k)) return { addColorStop() {} };
          },
    set: () => true,
  });
  const emitted = [];
  w.particles = { emit: (o) => emitted.push(o) };
  const mf = new ManaRegenFx(w),
    df = new DodgeFx(w);
  press(w, "KeyF");
  press(w, "ShiftLeft");
  for (let i = 0; i < 40; i++) {
    step(w);
    mf.update(DT);
    df.update(DT);
    df.render(ctx);
  }
  step(w, 60 * 31);
  for (let i = 0; i < 40; i++) df.update(DT);
  assert.equal(df.trails.length, 0, "trail removed once it faded");
  assert.deepEqual(bad, []);
  const bubbles = emitted.filter((o) => o.shape === "bubble");
  assert.ok(bubbles.length > 5, "Mana Regen is drawn with circle (bubble) particles");
  assert.ok(emitted.every((o) => Object.values(o).every((v) => typeof v !== "number" || Number.isFinite(v))), "finite particle numbers");
  mf.dispose();
  df.dispose();
});

console.log(`\n${passed} tests passed`);
