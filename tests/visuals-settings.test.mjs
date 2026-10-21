// V1.12.0.00: buff visual language (circles, ribbons, dashes) and staged Settings. Headless, no DOM.
//   node tests/visuals-settings.test.mjs
import assert from "node:assert/strict";
import { ParticleSystem } from "../src/systems/ParticleSystem.js";
import { drawRibbons } from "../src/render/drawRibbons.js";
import { Settings, DEFAULTS } from "../src/core/Settings.js";

let passed = 0;
const test = (name, fn) => (fn(), passed++, console.log("ok  " + name));
const mkCtx = (bad) =>
  new Proxy({}, {
    get: (_, k) => (typeof k === "symbol" ? undefined : (...a) => { for (const x of a) if (typeof x === "number" && !Number.isFinite(x)) bad.push(k); if (/Gradient$/.test(k)) return { addColorStop() {} }; }),
    set: () => true,
  });

test("ParticleSystem draws bubble and dash shapes with finite numbers (also at rest)", () => {
  const bad = [], ctx = mkCtx(bad), P = new ParticleSystem(50);
  P.emit({ shape: "bubble", x: 1, y: 2, z: 3, vz: 40, life: 1, size: 3, sizeEnd: 1 });
  P.emit({ shape: "dash", x: 1, y: 2, z: 3, vx: -30, vy: 5, vz: 0, len: 9, life: 1 });
  P.emit({ shape: "dash", x: 1, y: 2, z: 0, life: 1 }); // no velocity: vertical dash
  for (let i = 0; i < 30; i++) { P.update(1 / 60); P.render(ctx); }
  assert.deepEqual(bad, []);
});

test("drawRibbons: finite numbers, nothing drawn at zero strength, count lines", () => {
  const bad = [];
  let strokes = 0;
  const ctx = new Proxy({}, { get: (_, k) => (typeof k === "symbol" ? undefined : (...a) => { if (k === "stroke") strokes++; for (const x of a) if (typeof x === "number" && !Number.isFinite(x)) bad.push(k); }), set: () => true });
  drawRibbons(ctx, 10, 20, 48, 16, 0, 1);
  assert.equal(strokes, 0);
  drawRibbons(ctx, 10, 20, 48, 16, 1.3, 1.7, { main: [255, 92, 50], core: [255, 165, 115] });
  assert.equal(strokes, 4, "2 ribbons x (body + core)");
  assert.deepEqual(bad, []);
});

test("Settings staged edit: preview does not persist, restore discards, defaults are complete", () => {
  Settings.reset();
  const snap = Settings.snapshot();
  Settings.preview("masterVolume", 0.1);
  assert.equal(Settings.get("masterVolume"), 0.1);
  Settings.restore(snap);
  assert.equal(Settings.get("masterVolume"), DEFAULTS.masterVolume);
  for (const k of ["dummyAttacks", "dummySkills", "dummyMovement", "showDebug", "debugCastTimer"]) assert.ok(k in DEFAULTS, k);
});

console.log(`\n${passed} tests passed`);
