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
import { StatusSystem } from "../systems/StatusSystem.js";
import { BurnFx } from "../systems/BurnFx.js";
import { Toasts } from "../systems/Toasts.js";
import { drawGround } from "../render/drawGround.js";
import { VERSION_LABEL } from "../config.js";
import { drawBar } from "../render/drawBar.js";
import { AudioSystem } from "../systems/AudioSystem.js";
import { ExplosionSystem } from "../systems/ExplosionSystem.js";
import { ExplosionFx } from "../systems/ExplosionFx.js";
import { XpSystem } from "../systems/XpSystem.js";
import { Progression } from "../progression/Progression.js";
import { SkillTreePanel } from "../ui/SkillTreePanel.js";
import { SkillRegistry } from "../skills/SkillRegistry.js";
import { scaled as n } from "../systems/ParticleSystem.js";
import { rand, TAU } from "../core/math.js";

/**
 * The playable world. Acts as the `world` object handed to entities and skills:
 * { game, input, events, camera, particles, lights, damageNumbers, entities, spawn(), hitstop() }
 */
export class WorldScene extends Scene {
  /** @param {{ classId?: string, mode?: 'training' }} params `mode` is the game mode; only the training ground exists so far. */
  constructor({ classId = "mage", mode = "training" } = {}) {
    super();
    this.classId = classId;
    this.mode = mode;
  }

  enter(game) {
    super.enter(game);
    this.input = game.input;
    this.events = new EventBus();
    this.camera = new Camera();
    this.particles = new ParticleSystem();
    this.lights = new Lights();
    this.damageNumbers = new DamageNumbers();
    this.toasts = new Toasts();
    this.entities = [];
    this.hitstopTimer = 0;
    this.paused = false;
    this.fps = 60;

    this.hitEffects = new HitEffects(this);
    this.status = new StatusSystem(this); // after HitEffects: hit damage lands before ignition is rolled
    this.burnFx = new BurnFx(this);
    this.explosions = new ExplosionSystem(this);
    this.explosionFx = new ExplosionFx(this);
    const cls = ClassRegistry.get(this.classId);
    this.progression = new Progression(cls);
    this.player = this.spawn(new Player(cls, this.progression));
    this.xp = new XpSystem(this); // after HitEffects + StatusSystem: a killing blow has already downed the target
    this.progression.onEvent = (e) => this.onProgress(e);
    this.offLevel = this.events.on("levelup", (e) => this.levelFx(e));
    this.banners = [];
    this.xpFlash = { char: 0, spec: 0, t: 0 };
    this.dummy = this.spawn(
      new TrainingDummy(340, 0, {
        attack: Settings.get("dummyAttacks"),
        move: Settings.get("dummyMovement"),
        skills: Settings.get("dummySkills"),
        cls,
      }),
    );
    this.audio = new AudioSystem(this);
    this.camera.x = this.player.x;
    this.camera.y = this.player.y;
    this.buildPauseMenu();
    this.tree = new SkillTreePanel(this);
  }

  exit() {
    this.audio.dispose();
    this.hitEffects.dispose();
    this.status.dispose();
    this.burnFx.dispose();
    this.explosions.dispose();
    this.explosionFx.dispose();
    this.xp.dispose();
    this.offLevel();
  }

  /** Progression events: keep the player in sync and tell the rest of the world through the bus. */
  onProgress(e) {
    if (e.type === "xp") {
      const f = this.xpFlash;
      if (f.t <= 0) f.char = f.spec = 0;
      f[e.track] += e.amount;
      f.t = 1.8;
    } else if (e.type === "levelup") {
      this.player.syncProgression();
      this.events.emit("levelup", e);
    } else if (e.type === "pick") this.player.syncProgression();
  }

  /** Level-up banner plus a ring and rising sparks around the player. */
  levelFx(e) {
    const spec = e.track === "spec",
      unlocked = e.unlock ? SkillRegistry.get(e.unlock).name : null;
    this.banners.push({
      title: spec ? `SPECIALIZATION LEVEL ${e.level}` : `LEVEL ${e.level}`,
      sub: !spec ? "Character level up" : unlocked ? `${unlocked} unlocked!` : "Bonus pick available (press K)",
      t: 0,
      life: 3.4,
    });
    if (this.banners.length > 4) this.banners.shift();
    const p = this.player,
      P = this.particles,
      col = spec ? [255, 210, 110] : [150, 200, 255];
    P.emit({ shape: "ring", x: p.x, y: p.y, z: 0, life: 0.8, size: 10, sizeEnd: 150, color: col });
    for (let i = 0; i < n(40); i++) {
      const a = rand(0, TAU);
      P.emit({ x: p.x + Math.cos(a) * 24, y: p.y + Math.sin(a) * 12, z: 0, vx: 0, vy: 0, vz: rand(120, 360), gravity: 120, drag: 1,
        life: rand(0.7, 1.4), size: rand(1.5, 3), sizeEnd: 0.3, color: col, colorEnd: [255, 255, 255], shape: "spark", stretch: 0.03 });
    }
    this.lights.add({ x: p.x, y: p.y, z: 30, radius: 260, intensity: 1, life: 0.5, color: col });
  }

  openTree() {
    this.paused = true;
    this.player.caster.cancel();
    this.audio.silence();
    this.tree.open();
  }
  closeTree() {
    this.tree.close();
    this.paused = false;
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
      <button class="btn" data-a="resume">Resume</button><button class="btn" data-a="menu">Home</button>`;
    this.pauseEl.addEventListener("click", (e) => {
      const a = e.target.dataset?.a;
      if (a === "resume") this.setPaused(false);
      if (a === "menu") this.game.goto("home");
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
    const inp = this.input;
    if (inp.wasPressed("Escape")) {
      if (this.tree.isOpen) this.closeTree();
      else this.setPaused(!this.paused);
    } else if (inp.wasPressed("KeyK") && (!this.paused || this.tree.isOpen)) {
      if (this.tree.isOpen) this.closeTree();
      else this.openTree();
    }
    this.fps += (1 / Math.max(dt, 0.0001) - this.fps) * 0.1;
    if (this.paused) return;
    this.xpFlash.t -= dt;
    for (const b of this.banners) b.t += dt;
    this.banners = this.banners.filter((b) => b.t < b.life);

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
    this.status.update(edt);
    this.burnFx.update(edt); // after lights.update: its one-frame lights must survive to render
    this.particles.update(pdt);
    this.damageNumbers.update(dt);
    this.toasts.update(dt);
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
    this.toasts.render(ctx);
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

  /** One skill slot: icon, cooldown, dim when unaffordable, bar (charge, shield points, or ward time left), key hint. */
  drawSlot(ctx, x, y, s, p, v) {
    const sk = s.skill,
      on = !!sk.isActive?.(p),
      cd = s.cooldown / (s.cdMax || sk.cooldown),
      cx = x + 34;
    ctx.fillStyle = "rgba(12,14,20,.8)";
    ctx.strokeStyle = s.charging || on ? "#ffb15a" : "rgba(242,196,109,.4)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, 68, 68, 12);
    ctx.fill();
    ctx.stroke();
    ctx.font = "34px serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    ctx.fillText(sk.icon, cx, y + 45);
    if (cd > 0) {
      ctx.fillStyle = "rgba(0,0,0,.6)";
      ctx.fillRect(x + 2, y + 2 + 64 * (1 - cd), 64, 64 * cd);
    }
    if (!s.charging && !on && !sk.canStart(v.mana)) {
      ctx.fillStyle = "rgba(20,40,120,.55)";
      ctx.fillRect(x + 2, y + 2, 64, 64);
    }
    const frac = sk.toggle
      ? on ? p.shield.points / p.shield.maxPoints : 0
      : on ? p.ward.life / p.ward.maxLife : s.charge;
    ctx.fillStyle = "rgba(255,255,255,.12)";
    ctx.fillRect(x, y + 76, 68, 7);
    ctx.fillStyle = "#ff8a3a";
    ctx.fillRect(x, y + 76, 68 * frac, 7);
    const label = sk.name.toUpperCase();
    ctx.font = "11px Georgia, serif";
    const lw = ctx.measureText(label).width;
    if (lw > 86) ctx.font = `${Math.floor((11 * 86) / lw)}px Georgia, serif`; // long names shrink to fit
    ctx.fillStyle = "#b9a77f";
    ctx.fillText(label, cx, y + 99);
    if (sk.hint) {
      ctx.font = "10px Georgia, serif";
      ctx.fillStyle = "rgba(234,223,200,.7)";
      ctx.fillText(sk.hint, cx, y + 12);
    }
  }

  /** A skill the specialization has not unlocked yet. */
  drawLockedSlot(ctx, x, y, sk, level) {
    ctx.fillStyle = "rgba(12,14,20,.6)";
    ctx.strokeStyle = "rgba(255,255,255,.15)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, 68, 68, 12);
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.font = "30px serif";
    ctx.fillStyle = "rgba(255,255,255,.35)";
    ctx.fillText("🔒", x + 34, y + 44);
    ctx.font = "11px Georgia, serif";
    ctx.fillStyle = "#7c735f";
    ctx.fillText(sk.name.toUpperCase(), x + 34, y + 99);
    ctx.font = "10px Georgia, serif";
    ctx.fillText(`SPEC Lv ${level}`, x + 34, y + 12);
  }

  /** Bottom-left: character and specialization XP, plus the skill-tree hint. */
  drawProgress(ctx, w, h) {
    const prog = this.player.prog;
    if (!prog) return;
    const c = prog.char,
      s = prog.specInfo,
      x = 18,
      y = h - 104,
      f = this.xpFlash,
      fa = Math.max(0, Math.min(1, f.t / 0.6)),
      pend = prog.pendingLevels().length;
    ctx.fillStyle = "rgba(12,14,20,.72)";
    ctx.strokeStyle = "rgba(242,196,109,.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x - 8, y - 8, 256, 96, 10);
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = "left";
    ctx.font = "12px Georgia, serif";
    ctx.fillStyle = "#eadfc8";
    ctx.fillText(`CHARACTER  Lv ${c.level}`, x, y + 6);
    ctx.fillText(`${this.player.cls.specialization.element.toUpperCase()} SPEC  Lv ${s.level}`, x, y + 36);
    ctx.textAlign = "right";
    ctx.fillStyle = "#b9a77f";
    ctx.fillText(c.need ? `${c.into} / ${c.need}` : "MAX", x + 240, y + 6);
    ctx.fillText(s.need ? `${s.into} / ${s.need}` : "MAX", x + 240, y + 36);
    drawBar(ctx, x, y + 10, 240, 8, c.frac, "#6aa8ff");
    drawBar(ctx, x, y + 40, 240, 8, s.frac, "#f2c46d");
    if (fa > 0) {
      ctx.globalAlpha = fa;
      ctx.fillStyle = "#9dc8ff";
      if (f.char) ctx.fillText(`+${f.char} XP`, x + 150, y + 6);
      ctx.fillStyle = "#ffe08a";
      if (f.spec) ctx.fillText(`+${f.spec} XP`, x + 150, y + 36);
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = "left";
    ctx.font = pend ? "bold 12px Georgia, serif" : "12px Georgia, serif";
    ctx.fillStyle = pend ? `rgba(123,216,143,${0.65 + 0.35 * Math.sin(performance.now() / 220)})` : "#8d836b";
    ctx.fillText(pend ? `K  Skill tree: ${pend} bonus pick${pend > 1 ? "s" : ""} available!` : "K  Skill tree", x, y + 72);
  }

  drawBanners(ctx, w, h) {
    ctx.textAlign = "center";
    this.banners.forEach((b, i) => {
      const a = Math.min(1, b.t / 0.25, (b.life - b.t) / 0.8),
        y = h * 0.2 + i * 66 - Math.min(1, b.t * 3) * 0;
      ctx.globalAlpha = Math.max(0, a);
      ctx.font = "bold 32px Georgia, serif";
      ctx.lineWidth = 5;
      ctx.strokeStyle = "rgba(30,8,0,.9)";
      ctx.strokeText(b.title, w / 2, y);
      ctx.fillStyle = "#f2c46d";
      ctx.fillText(b.title, w / 2, y);
      ctx.font = "16px Georgia, serif";
      ctx.fillStyle = "#eadfc8";
      ctx.fillText(b.sub, w / 2, y + 26);
    });
    ctx.globalAlpha = 1;
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
      "WASD move  ·  Mouse aim  ·  K skill tree  ·  Esc pause",
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

    // flame shield points
    if (p.shield) {
      const sh = p.shield;
      drawBar(ctx, 18, 108, 240, 12, sh.points / sh.maxPoints, "#ff9a3c");
      ctx.font = "12px Georgia, serif";
      ctx.fillStyle = "#fff";
      ctx.fillText(`SHIELD ${Math.ceil(sh.points)} / ${sh.maxPoints}   (-${sh.upkeep} MP/s)`, 24, 118);
    }

    // burn resistance time left, burn time left
    let sy = p.shield ? 128 : 108;
    if (p.ward) {
      drawBar(ctx, 18, sy, 240, 12, p.ward.life / p.ward.maxLife, "#ff5a32");
      ctx.font = "12px Georgia, serif";
      ctx.fillStyle = "#fff";
      ctx.fillText(`BURN RESISTANCE ${Math.ceil(p.ward.life)}s`, 24, sy + 10);
      sy += 20;
    }
    if (p.burn) {
      const b = p.burn;
      ctx.font = "bold 13px Georgia, serif";
      ctx.fillStyle = "#ff8a2a";
      ctx.fillText(`BURNING  ${Math.max(0, b.dur - b.t).toFixed(1)}s  (${(b.dps * (p.ward ? 1 - p.ward.burnReduction : 1)).toFixed(0)}/s)`, 18, sy + 12);
    }

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

    // skill slots
    const slots = p.caster.slots,
      locked = Object.entries(p.cls.specialization.unlocks).filter(([, id]) => !p.caster.has(id)),
      gap = 92,
      x0 = w / 2 - ((slots.length + locked.length) * gap - 10) / 2;
    slots.forEach((sl, i) => this.drawSlot(ctx, x0 + i * gap, h - 100, sl, p, v));
    locked.forEach(([lv, id], i) =>
      this.drawLockedSlot(ctx, x0 + (slots.length + i) * gap, h - 100, SkillRegistry.get(id), Number(lv)),
    );
    this.drawProgress(ctx, w, h);
    this.drawBanners(ctx, w, h);

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
