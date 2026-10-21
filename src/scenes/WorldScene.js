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
import { ManaRegenFx } from "../systems/ManaRegenFx.js";
import { DodgeFx } from "../systems/DodgeFx.js";
import { Toasts } from "../systems/Toasts.js";
import { drawGround } from "../render/drawGround.js";
import { VERSION_LABEL } from "../config.js";
import { AudioSystem } from "../systems/AudioSystem.js";
import { ExplosionSystem } from "../systems/ExplosionSystem.js";
import { ExplosionFx } from "../systems/ExplosionFx.js";
import { BlastFx } from "../systems/BlastFx.js";
import { XpSystem } from "../systems/XpSystem.js";
import { RaidSystem } from "../systems/RaidSystem.js";
import { drawEnhance } from "../render/drawEnhance.js";
import { Progression } from "../progression/Progression.js";
import { SkillTreePanel } from "../ui/SkillTreePanel.js";
import { PlayerHud } from "../ui/PlayerHud.js";
import { ProfilePanel } from "../ui/ProfilePanel.js";
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
    this.manaRegenFx = new ManaRegenFx(this);
    this.dodgeFx = new DodgeFx(this);
    this.explosions = new ExplosionSystem(this);
    this.explosionFx = new ExplosionFx(this);
    this.blastFx = new BlastFx(this);
    const cls = ClassRegistry.get(this.classId);
    this.cls = cls;
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
    this.raid = new RaidSystem(this);
    this.audio = new AudioSystem(this);
    this.camera.x = this.player.x;
    this.camera.y = this.player.y;
    this.buildPauseMenu();
    this.buildRaidButton();
    this.tree = new SkillTreePanel(this);
    this.profile = new ProfilePanel(this);
    this.hud = new PlayerHud(this);
    this.fadeIn();
  }

  /** Black overlay that fades out over 0.7 s, so the world never pops in on its first frame. */
  fadeIn() {
    const f = document.createElement("div");
    f.className = "world-fade";
    f.addEventListener("animationend", () => f.remove());
    this.ui.appendChild(f);
  }

  exit() {
    this.audio.dispose();
    this.hitEffects.dispose();
    this.status.dispose();
    this.burnFx.dispose();
    this.manaRegenFx.dispose();
    this.dodgeFx.dispose();
    this.explosions.dispose();
    this.explosionFx.dispose();
    this.blastFx.dispose();
    this.xp.dispose();
    this.raid.dispose();
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
  /** Character panel (profile circle). Only opens from a running game, and closes back to it. */
  openProfile() {
    if (this.paused) return;
    this.paused = true;
    this.player.caster.cancel();
    this.audio.silence();
    this.profile.open();
  }
  closeProfile() {
    this.profile.close();
    this.paused = false;
  }
  toggleProfile() {
    if (this.profile.isOpen) this.closeProfile();
    else this.openProfile();
  }

  spawn(e) {
    this.entities.push(e);
    return e;
  }
  hitstop(t) {
    this.hitstopTimer = Math.max(this.hitstopTimer, t);
  }

  /** Big centred banner (same queue as level-ups). */
  pushBanner(title, sub, life = 3.4) {
    this.banners.push({ title, sub, t: 0, life });
    if (this.banners.length > 4) this.banners.shift();
  }

  /** Mock raid start: the training dummy leaves. */
  removeDummy() {
    if (!this.dummy) return;
    this.dummy.dead = true;
    this.dummy = null;
    this.audio.silence(); // a charge voice owned by the dummy would otherwise hang
  }
  /** Mock raid end: a fresh dummy, built from the current Settings. */
  restoreDummy() {
    if (this.dummy) return;
    this.dummy = this.spawn(
      new TrainingDummy(340, 0, {
        attack: Settings.get("dummyAttacks"),
        move: Settings.get("dummyMovement"),
        skills: Settings.get("dummySkills"),
        cls: this.cls,
      }),
    );
  }

  /** DOM button under the kills panel. tabIndex -1 and no focus on press: Space is the fireball key and would "click" a focused button. */
  buildRaidButton() {
    this.raidHidden = false;
    this.raidBtn = document.createElement("button");
    this.raidBtn.className = "btn sm raid-btn";
    this.raidBtn.tabIndex = -1;
    this.raidBtn.addEventListener("mousedown", (e) => e.preventDefault());
    this.raidBtn.addEventListener("click", () => {
      if (this.raid.active) this.raid.stop();
      else this.raid.start();
      this.refreshRaidButton();
    });
    this.ui.appendChild(this.raidBtn);
    this.refreshRaidButton();
  }
  refreshRaidButton() {
    this.raidBtn.textContent = this.raid.active ? "Stop Mock Raid" : "Start Mock Raid";
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
      if (this.profile.isOpen) this.closeProfile();
      else if (this.tree.isOpen) this.closeTree();
      else this.setPaused(!this.paused);
    } else if (inp.wasPressed("KeyK") && (!this.paused || this.tree.isOpen)) {
      if (this.tree.isOpen) this.closeTree();
      else this.openTree();
    }
    this.fps += (1 / Math.max(dt, 0.0001) - this.fps) * 0.1;
    this.hud.update();
    if (this.paused !== this.raidHidden) {
      this.raidHidden = this.paused; // the raid button hides behind the pause menu and the skill tree
      this.raidBtn.style.display = this.paused ? "none" : "";
    }
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
    this.raid.update(dt);
    this.status.update(edt);
    this.burnFx.update(edt); // after lights.update: its one-frame lights must survive to render
    this.manaRegenFx.update(edt);
    this.dodgeFx.update(edt);
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
    this.dodgeFx.render(ctx); // under the bodies
    for (const e of [...this.entities].sort((a, b) => a.y - b.y))
      e.draw(ctx, this);
    this.manaRegenFx.render(ctx);
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

  /** Top-right panel while a mock raid runs (same spot and size as the dummy panel). */
  drawRaidPanel(ctx, w) {
    const r = this.raid;
    ctx.fillStyle = "rgba(12,14,20,.72)";
    ctx.strokeStyle = "rgba(242,196,109,.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(w - 238, 16, 222, 126, 10);
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = "left";
    ctx.fillStyle = "#f2c46d";
    ctx.font = "bold 13px Georgia, serif";
    ctx.fillText("MOCK RAID", w - 224, 38);
    ctx.fillStyle = "#eadfc8";
    ctx.font = "13px Georgia, serif";
    ctx.fillText(`Raid ${r.number}`, w - 224, 60);
    ctx.fillText(`Enemies left: ${r.alive()} / ${r.total}`, w - 224, 80);
    ctx.fillText(r.tier ? "Enhanced:" : "Base strength", w - 224, 100);
    drawEnhance(ctx, w - 118, 96, r.tier);
    ctx.textAlign = "left";
    ctx.fillStyle = "#b9a77f";
    ctx.fillText(r.wait > 0 ? `Next raid in ${Math.ceil(r.wait)}s` : "Fight!", w - 224, 120);
  }

  /** Kill counters, under the top-right panel. */
  drawKillPanel(ctx, w) {
    ctx.fillStyle = "rgba(12,14,20,.72)";
    ctx.strokeStyle = "rgba(242,196,109,.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(w - 238, 150, 222, 44, 10);
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = "left";
    ctx.font = "13px Georgia, serif";
    ctx.fillStyle = "#eadfc8";
    ctx.fillText(`Kills: ${this.raid.kills}`, w - 224, 169);
    ctx.fillText(`One-shot kills: ${this.raid.oneShots}`, w - 224, 187);
  }

  drawHud(ctx, w, h) {
    const p = this.player,
      d = this.dummy;
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    ctx.font = "13px Georgia, serif";
    ctx.fillStyle = "rgba(234,223,200,.85)";
    if (Settings.get("showDebug"))
      ctx.fillText(
        `${VERSION_LABEL}  ·  ${Math.round(this.fps)} FPS  ·  ${this.particles.list.length} particles`,
        18,
        124,
      ); // under the HUD card

    // dummy panel (the raid panel takes its place while a mock raid runs)
    if (!d) this.drawRaidPanel(ctx, w);
    else {
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
    }
    this.drawKillPanel(ctx, w);

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
