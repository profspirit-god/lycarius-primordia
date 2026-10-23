// Real readiness checks for the loading screen. LoadingScene runs these in order and only lets the game start
// when every one has finished. Each task: { id, label, weight, fatal, timeout, run(ctx) -> Promise|void }.
//  - fatal tasks (content, world) stop the loading screen with an error instead of starting a broken game.
//  - the others (art, audio, render) are optional: a failure or a timeout is logged and the game still starts.
// To make loading wait for something new (a zone file, a texture atlas), add a task to the array below.
import { ClassRegistry } from "../classes/ClassRegistry.js";
import { SkillRegistry } from "../skills/SkillRegistry.js";
import { UNIVERSAL } from "../classes/Universal.js";
import { Progression } from "../progression/Progression.js";
import { createMemoryStorage } from "../sim/storage.js";
import { Player } from "../entities/Player.js";
import { GameAudio } from "../audio/AudioEngine.js";
import { ParticleSystem } from "../systems/ParticleSystem.js";
import { drawGround } from "../render/drawGround.js";
import { drawCylinder } from "../render/drawCylinder.js";
import { icon, ICONS } from "../ui/icons.js";
import { loadImage } from "./assets.js";

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

/** @param {{ classId?: string, image?: string, preload?: string[] }} cfg @param {object} params the params passed to the world */
export function buildTasks(cfg, params = {}) {
  const classId = params.classId ?? "mage";
  return [
    {
      id: "content",
      label: "Reading class and skill data",
      weight: 1,
      fatal: true,
      run() {
        const cls = ClassRegistry.get(classId); // throws on an unknown class
        for (const id of cls.skills) SkillRegistry.get(id);
        for (const id of Object.values(cls.specialization.unlocks)) SkillRegistry.get(id);
        for (const id of [...cls.skills, ...UNIVERSAL.skills]) if (!ICONS[SkillRegistry.get(id).icon]) throw new Error(`Skill "${id}" has no icon`);
      },
    },
    {
      id: "fonts",
      label: "Loading fonts",
      weight: 1,
      timeout: 3,
      run: () => document.fonts?.ready,
    },
    {
      id: "art",
      label: "Loading artwork",
      weight: 3,
      timeout: 12,
      async run(ctx) {
        const urls = [cfg.image, ...(cfg.preload ?? [])].filter(Boolean);
        let done = 0;
        await Promise.all(urls.map((u) => loadImage(u).then(() => ctx.progress(++done / urls.length))));
      },
    },
    {
      id: "audio",
      label: "Tuning audio",
      weight: 1,
      timeout: 1.5,
      run: () => GameAudio.warmup(900),
    },
    {
      id: "render",
      label: "Warming up the renderer",
      weight: 3,
      timeout: 6,
      async run(ctx) {
        // Draw the real world primitives once on a hidden canvas so gradients, paths and particles are compiled before play.
        const cv = document.createElement("canvas");
        cv.width = 320;
        cv.height = 200;
        const g = cv.getContext("2d");
        const ps = new ParticleSystem(64);
        const steps = [
          () => drawGround(g, { x: 0, y: 0 }, 320, 200),
          () => drawCylinder(g, { x: 160, y: 130, r: 16, h: 46, color: [112, 92, 224], flash: 0.2, lean: [2, 1] }),
          () => {
            for (let i = 0; i < 24; i++) ps.emit({ x: 150 + i, y: 120, z: 10, vz: 80, life: 0.5, size: 3, color: [255, 160, 60], colorEnd: [200, 40, 10] });
            ps.update(0.016);
            ps.render(g);
          },
          () => {
            const rg = g.createRadialGradient(160, 100, 4, 160, 100, 90);
            rg.addColorStop(0, "rgba(255,140,60,.4)");
            rg.addColorStop(1, "rgba(255,140,60,0)");
            g.fillStyle = rg;
            g.fillRect(0, 0, 320, 200);
          },
          () => {
            const d = document.createElement("div"); // parse every icon once so the HUD builds without a hitch
            d.innerHTML = Object.keys(ICONS).map((n) => icon(n)).join("");
          },
        ];
        for (let i = 0; i < steps.length; i++) {
          await nextFrame();
          steps[i]();
          ctx.progress((i + 1) / steps.length);
        }
      },
    },
    {
      id: "world",
      label: "Preparing the world",
      weight: 2,
      fatal: true,
      async run() {
        // Dry run of what WorldScene.enter builds from data (no DOM, nothing is kept): progression save, player, skill slots.
        await nextFrame();
        const cls = ClassRegistry.get(classId);
        const prog = new Progression(cls, createMemoryStorage()); // in memory: the dry run never reads or writes the real save
        const p = new Player(cls, prog);
        if (!(p.caster.slots.length > 0)) throw new Error("The player has no skills");
        if (!(p.vitals.maxHp > 0)) throw new Error("The player has no health");
      },
    },
  ];
}
