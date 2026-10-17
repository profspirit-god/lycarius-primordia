import { Scene } from "../core/Scene.js";
import { EventBus } from "../core/EventBus.js";
import { Settings } from "../core/Settings.js";
import { ClassRegistry } from "../classes/ClassRegistry.js";
import { Player } from "../entities/Player.js";
import { TrainingDummy } from "../entities/TrainingDummy.js";
import { Camera } from "../systems/Camera.js";
import { ParticleSystem } from "../systems/ParticleSystem.js";
import { Lights } from "../systems/Lights.js";
import { DamageNumbers } from "../systems/DamageNumbers.js";
import { HitEffects } from "../systems/HitEffects.js";
import { drawGround } from "../render/drawGround.js";
import { VERSION_LABEL } from "../config.js";
import { drawBar } from "../render/drawBar.js";
import { AudioSystem } from "../systems/AudioSystem.js";

/**
 * The playable world. Acts as the `world` object handed to entities and skills:
 * { game, input, events, camera, particles, lights, damageNumbers, entities, spawn(), hitstop() }
 */
export class WorldScene extends Scene {
  constructor({ classId = "mage" } = {}) {
    super();
    this.classId = classId;
  }

  enter(game) {
    super.enter(game);
    this.input = game.input;
    this.events = new EventBus();
    this.camera = new Camera();
    this.particles = new ParticleSystem();
    this.lights = new Lights();
    this.damageNumbers = new DamageNumbers();
    this.entities = [];
    this.hitstopTimer = 0;
    this.paused = false;
    this.fps = 60;

    this.hitEffects = new HitEffects(this);
    this.player = this.spawn(new Player(ClassRegistry.get(this.classId)));
    this.dummy = this.spawn(
      new TrainingDummy(340, 0, {
        attack: Settings.get("dummyAttacks"),
        cls: ClassRegistry.get(this.classId),
      }),
    );
    this.audio = new AudioSystem(this);
    this.camera.x = this.player.x;
    this.camera.y = this.player.y;
    this.buildPauseMenu();
  }

  exit() {
    this.audio.dispose();
    this.hitEffects.dispose();
  }

  spawn(e) {
    this.entities.push(e);
    return e;
  }
  hitstop(t) {
    this.hitstopTimer = Math.max(this.hitstopTimer, t);
  }

  buildPauseMenu() {
    this.pauseEl = document.createElement("div");
    this.pauseEl.className = "panel";
    this.pauseEl.style.display = "none";
    this.pauseEl.innerHTML = `<h2 class="title" style="font-size:28px">PAUSED</h2><div class="subtitle">${VERSION_LABEL}</div>
      <button class="btn" data-a="resume">Resume</button><button class="btn" data-a="menu">Main menu</button>`;
    this.pauseEl.addEventListener("click", (e) => {
      const a = e.target.dataset?.a;
      if (a === "resume") this.setPaused(false);
      if (a === "menu") this.game.goto("menu");
    });
    this.ui.appendChild(this.pauseEl);
  }
  setPaused(p) {
    this.paused = p;
    this.pauseEl.style.display = p ? "" : "none";
    if (p) this.player.caster.cancel();
    if (p) this.audio.silence();
  }

  update(dt) {
    if (this.input.wasPressed("Escape")) this.setPaused(!this.paused);
    this.fps += (1 / Math.max(dt, 0.0001) - this.fps) * 0.1;
    if (this.paused) return;

    let edt = dt,
      pdt = dt;
    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      edt = dt * 0.08;
      pdt = dt * 0.4;
    } // hit-stop

    this.lights.update(dt);
    const list = this.entities.slice();
    for (const e of list) e.update(edt, this);
    this.entities = this.entities.filter((e) => !e.dead);
    this.particles.update(pdt);
    this.damageNumbers.update(dt);
    this.camera.update(dt, this.player);
    this.audio.update(dt);
  }

  render(ctx, w, h) {
    ctx.fillStyle = "#0b0f0d";
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    this.camera.apply(ctx, w, h);
    drawGround(ctx, this.camera, w, h);
    for (const e of [...this.entities].sort((a, b) => a.y - b.y))
      e.draw(ctx, this);
    this.particles.render(ctx);
    this.lights.render(ctx);
    this.damageNumbers.render(ctx);
    ctx.restore();
    this.drawVignette(ctx, w, h);
    this.drawHud(ctx, w, h);
  }

  drawVignette(ctx, w, h) {
    const g = ctx.createRadialGradient(
      w / 2,
      h / 2,
      Math.min(w, h) * 0.35,
      w / 2,
      h / 2,
      Math.max(w, h) * 0.75,
    );
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,.55)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  drawHud(ctx, w, h) {
    const p = this.player,
      v = p.vitals,
      s = p.caster.slots[0],
      d = this.dummy;
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    ctx.font = "13px Georgia, serif";
    ctx.fillStyle = "rgba(234,223,200,.85)";
    ctx.fillText(
      "WASD move  ·  Mouse aim  ·  Hold LMB / Space to charge, release to cast  ·  Esc pause",
      18,
      26,
    );
    if (Settings.get("showDebug"))
      ctx.fillText(
        `${VERSION_LABEL}  ·  ${Math.round(this.fps)} FPS  ·  ${this.particles.list.length} particles`,
        18,
        46,
      );

    // player vitals
    const cost = s.charging ? s.skill.manaCost(s.charge) : 0;
    drawBar(ctx, 18, 60, 240, 16, v.hp / v.maxHp, "#d93b3b");
    drawBar(ctx, 18, 84, 240, 16, v.mana / v.maxMana, "#3b82f6", {
      border: p.lowManaFlash > 0 ? "#ff4040" : undefined,
    });
    if (cost > 0) {
      // preview of the mana this cast will consume
      const x0 = 18 + (240 * Math.max(0, v.mana - cost)) / v.maxMana;
      ctx.fillStyle = "rgba(255,255,255,.4)";
      ctx.fillRect(x0, 84, (240 * Math.min(cost, v.mana)) / v.maxMana, 16);
    }
    ctx.font = "12px Georgia, serif";
    ctx.fillStyle = "#fff";
    ctx.fillText(`HP ${v.hp.toFixed(1)} / ${v.maxHp}`, 24, 72);
    ctx.fillText(
      `MP ${Math.floor(v.mana)} / ${v.maxMana}${cost > 0 ? `   (-${cost})` : ""}`,
      24,
      96,
    );

    // dummy panel
    ctx.fillStyle = "rgba(12,14,20,.72)";
    ctx.strokeStyle = "rgba(242,196,109,.35)";
    ctx.beginPath();
    ctx.roundRect(w - 238, 16, 222, 126, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#f2c46d";
    ctx.font = "bold 13px Georgia, serif";
    ctx.fillText("TRAINING DUMMY", w - 224, 38);
    ctx.fillStyle = "#eadfc8";
    ctx.font = "13px Georgia, serif";
    ctx.fillText(
      `Total damage: ${d.totalDamage.toLocaleString()}`,
      w - 224,
      60,
    );
    ctx.fillText(`Hits: ${d.hits}   Last: ${d.lastHit}`, w - 224, 80);
    ctx.fillText(`DPS (5s): ${d.dps()}`, w - 224, 100);
    ctx.fillText(
      d.attack
        ? `Hostile · HP ${d.vitals.hp.toFixed(1)} / ${d.vitals.maxHp}`
        : "Passive · HP ∞",
      w - 224,
      120,
    );

    // skill slot
    const x = w / 2 - 34,
      y = h - 100,
      cd = s.cooldown / s.skill.cooldown;
    ctx.fillStyle = "rgba(12,14,20,.8)";
    ctx.strokeStyle = s.charging ? "#ffb15a" : "rgba(242,196,109,.4)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, 68, 68, 12);
    ctx.fill();
    ctx.stroke();
    ctx.font = "34px serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    ctx.fillText(s.skill.icon, w / 2, y + 45);
    if (cd > 0) {
      ctx.fillStyle = "rgba(0,0,0,.6)";
      ctx.fillRect(x + 2, y + 2 + 64 * (1 - cd), 64, 64 * cd);
    }
    if (!s.charging && !s.skill.canStart(v.mana)) {
      ctx.fillStyle = "rgba(20,40,120,.55)";
      ctx.fillRect(x + 2, y + 2, 64, 64);
    }
    ctx.fillStyle = "rgba(255,255,255,.12)";
    ctx.fillRect(x, y + 76, 68, 7);
    ctx.fillStyle = "#ff8a3a";
    ctx.fillRect(x, y + 76, 68 * s.charge, 7);
    ctx.font = "11px Georgia, serif";
    ctx.fillStyle = "#b9a77f";
    ctx.fillText(s.skill.name.toUpperCase(), w / 2, y + 99);

    if (p.downed) {
      // death overlay
      ctx.fillStyle = "rgba(80,0,0,.35)";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#ff6b6b";
      ctx.font = "bold 44px Georgia, serif";
      ctx.fillText("YOU DIED", w / 2, h / 2 - 6);
      ctx.fillStyle = "#eadfc8";
      ctx.font = "16px Georgia, serif";
      ctx.fillText(
        `Respawning in ${Math.ceil(p.downedTimer)}…`,
        w / 2,
        h / 2 + 24,
      );
    }
  }
}
