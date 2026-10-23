// S1e (V1.12.0.04): the Player is driven by InputCommands only. No browser, no dependencies.
//   node tests/input.test.mjs        (exit 0 = all passed)
// The worlds below have NO `input` and NO `game`, and their camera cannot convert a mouse position: if Player reached for any of them, it would throw.
// The no-op `camera.addTrauma` and `particles` stubs stay because casting a Fireball still calls them directly (existing R5 debt, S1f).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import "../src/content/index.js";
import { EventBus } from "../src/core/EventBus.js";
import { ClassRegistry } from "../src/classes/ClassRegistry.js";
import { Player } from "../src/entities/Player.js";
import { Progression } from "../src/progression/Progression.js";
import { sanitizeCommand, idleCommand, BTN_MASK } from "../src/sim/InputCommand.js";
import { PlayerController } from "../src/input/PlayerController.js";

const DT = 1 / 60;
const mage = ClassRegistry.get("mage");
let passed = 0;
const test = (name, fn) => (fn(), passed++, console.log("ok  " + name));

function mkWorld() {
  const w = { events: new EventBus(), entities: [], time: 0 };
  w.spawn = (e) => (w.entities.push(e), e);
  w.particles = { emit() {} };
  w.lights = { add() {} };
  w.camera = { addTrauma() {} };
  w.hitstop = () => {};
  w.damageNumbers = { spawn() {} };
  w.player = w.spawn(new Player(mage, new Progression(mage)));
  return w;
}
let seq = 0;
/** Send one scripted command and run one frame. `keys` are skill ids that are held. */
function tick(w, { mx = 0, my = 0, aim = 0, keys = [] } = {}, frames = 1) {
  const p = w.player;
  let btn = 0;
  for (const id of keys) btn |= 1 << p.caster.slots.findIndex((s) => s.skill.id === id);
  for (let i = 0; i < frames; i++) {
    p.applyCommand({ seq: ++seq, mx, my, aim, btn });
    w.time += DT;
    for (const e of w.entities.slice()) e.update(DT, w);
  }
}

test("the command is validated at the boundary (R11): clamp, normalise, wrap, mask, ignore old seq", () => {
  const d = sanitizeCommand({ seq: 1, mx: 5, my: -9, aim: 0, btn: 1 }, 0);
  assert.ok(Math.abs(Math.hypot(d.mx, d.my) - 1) < 1e-12 && d.mx > 0 && d.my < 0 && d.seq === 1 && d.btn === 1, "clamped, then scaled to length 1");
  assert.deepEqual(sanitizeCommand({ seq: 2, mx: 0.5, my: 0, aim: 0, btn: 0 }, 1), { seq: 2, mx: 0.5, my: 0, aim: 0, btn: 0 }, "a weaker input stays weaker");
  const bad = sanitizeCommand({ seq: 3, mx: NaN, my: Infinity, aim: NaN, btn: 1.5 }, 2);
  assert.deepEqual(bad, { seq: 3, mx: 0, my: 0, aim: 0, btn: 0 });
  assert.ok(Math.abs(sanitizeCommand({ seq: 4, mx: 0, my: 0, aim: 7, btn: 0 }, 3).aim - (7 - 2 * Math.PI)) < 1e-9);
  assert.equal(sanitizeCommand({ seq: 5, mx: 0, my: 0, aim: 0, btn: 0xfffff }, 4).btn, BTN_MASK);
  for (const raw of [null, undefined, {}, { seq: 1.5 }, { seq: "7" }, { seq: -1 }, { seq: 2 ** 40 }]) assert.equal(sanitizeCommand(raw, 0), null);
  assert.equal(sanitizeCommand({ seq: 3, mx: 0, my: 0, aim: 0, btn: 0 }, 3), null, "a repeated seq is ignored");
  assert.deepEqual(idleCommand(), { seq: 0, mx: 0, my: 0, aim: 0, btn: 0 });
});

test("a scripted command moves the player: right, diagonal (same speed), weaker stick (slower), idle (stops)", () => {
  const speed = (cmd) => {
    const w = mkWorld(),
      p = w.player;
    tick(w, cmd, 120);
    return Math.hypot(p.vx, p.vy);
  };
  const full = speed({ mx: 1 }),
    diag = speed({ mx: 1, my: 1 }),
    half = speed({ mx: 0.5 });
  assert.ok(Math.abs(full - mage.stats.speed) < 1, "reaches the class speed");
  assert.ok(Math.abs(diag - full) < 1, "a diagonal is not faster");
  assert.ok(Math.abs(half - full / 2) < 1, "half stick, half speed");
  const w = mkWorld();
  tick(w, { mx: 1 }, 60);
  assert.ok(w.player.x > 100);
  tick(w, {}, 120);
  assert.ok(Math.hypot(w.player.vx, w.player.vy) < 1, "no command, no steering");
});

test("aim comes from the command", () => {
  const w = mkWorld();
  tick(w, { aim: 1.25 });
  assert.equal(w.player.aim, 1.25);
  tick(w, { aim: -2 });
  assert.equal(w.player.aim, -2);
});

test("holding the Fireball bit charges and releasing it fires along the commanded aim; a toggle fires on the press, not while held", () => {
  const w = mkWorld(),
    p = w.player;
  tick(w, { aim: Math.PI / 2, keys: ["fireball"] }, 30);
  assert.ok(p.caster.charging && p.caster.chargeLevel > 0);
  const n0 = w.entities.length;
  tick(w, { aim: Math.PI / 2 }); // released
  const ball = w.entities.find((e) => e.isProjectile);
  assert.ok(ball && w.entities.length > n0 - 1, "a Fireball was spawned");
  assert.ok(Math.abs(ball.vy) > Math.abs(ball.vx ?? 0), "it flies along +y (aim = PI/2)");
  // Mana Regen is a press skill (a rising edge starts it)
  tick(w, { keys: ["manaRegen"] }, 1);
  const buff = !!p.manaBuff;
  tick(w, { keys: ["manaRegen"] }, 10); // still held: no second trigger, no toggle-off
  assert.equal(!!p.manaBuff, buff);
  assert.ok(p.manaBuff, "Mana Regen started on the press and stayed on while held");
});

test("a stunned or downed player ignores skill and move commands", () => {
  const w = mkWorld(),
    p = w.player;
  p.stunT = 1;
  tick(w, { mx: 1, keys: ["fireball"] }, 20);
  assert.ok(!p.caster.charging && Math.abs(p.vx) < 1e-6);
  p.stunT = 0;
  p.vitals.damage(9999);
  p.down();
  tick(w, { mx: 1, keys: ["fireball"] }, 20);
  assert.ok(p.downed && !p.caster.charging);
});

test("an old command is ignored: the last one stays in force", () => {
  const w = mkWorld(),
    p = w.player;
  p.applyCommand({ seq: 100, mx: 1, my: 0, aim: 0.5, btn: 0 });
  p.applyCommand({ seq: 99, mx: -1, my: 0, aim: 2, btn: 0 });
  assert.equal(p.cmd.seq, 100);
  assert.equal(p.cmd.mx, 1);
});

test("PlayerController: keys, mouse and camera become the same command the scripted tests send", () => {
  const down = new Set(["KeyW", "KeyD", "Mouse0"]),
    w = mkWorld();
  Object.assign(w, {
    input: { isDown: (k) => down.has(k), mouse: { x: 10, y: 20 } },
    camera: { screenToWorld: () => ({ x: 0, y: -32 - 100 }) }, // straight above the body (aim point is 32 px higher)
    game: { width: 800, height: 600 },
  });
  const c = new PlayerController(w);
  c.update(w.player);
  const cmd = w.player.cmd;
  assert.equal(cmd.seq, 1);
  assert.ok(Math.abs(cmd.mx - Math.SQRT1_2) < 1e-9 && Math.abs(cmd.my + Math.SQRT1_2) < 1e-9, "D + W = right and up, length 1");
  assert.ok(Math.abs(cmd.aim + Math.PI / 2) < 1e-9, "aim straight up");
  assert.equal(cmd.btn & 1, 1, "Mouse0 is held, and slot 0 is Fireball");
  down.clear();
  c.update(w.player);
  assert.deepEqual([w.player.cmd.mx, w.player.cmd.my, w.player.cmd.btn, w.player.cmd.seq], [0, 0, 0, 2]);
});

test("Player.js has no input, camera or game access left", () => {
  const src = readFileSync(new URL("../src/entities/Player.js", import.meta.url), "utf8");
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.ok(!/world\.(input|camera|game)\b|\.isDown\(|\.wasPressed\(|screenToWorld/.test(code));
});

console.log(`\n${passed} tests passed`);
