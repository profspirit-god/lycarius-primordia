import { Scene } from "../core/Scene.js";
import { ParticleSystem } from "../systems/ParticleSystem.js";
import { rand, TAU } from "../core/math.js";
import { drawCover } from "../render/drawCover.js";
import { LOADING } from "../lobby/lobbyData.js";
import { loadImage } from "../lobby/assets.js";
import { buildTasks } from "../lobby/loadTasks.js";

const READY_HOLD = 0.35; // seconds the full bar stays up so "Ready" can be read before the game starts

/**
 * Loading screen. `params.target` picks an entry in LOADING (lobbyData.js).
 * The bar is REAL: it is the weighted progress of the tasks in lobby/loadTasks.js (data check, fonts, artwork, audio,
 * renderer warm-up, world dry run). The game starts only when every task has finished AND at least `minTime` seconds
 * have passed. Optional tasks that hang are given up on after `timeout`; a fatal task (broken data) shows an error with
 * Retry / Back instead of starting a broken game.
 */
export class LoadingScene extends Scene {
  constructor({ target = "training" } = {}) {
    super();
    this.target = target;
    this.cfg = LOADING[target];
  }
  enter(game) {
    super.enter(game);
    this.t = 0;
    this.shown = 0; // eased value drawn on the bar
    this.done = false;
    this.readyT = -1; // time since everything finished
    this.error = null;
    this.warnings = 0;
    this.bg = null;
    this.particles = new ParticleSystem(500);
    const c = this.cfg;
    this.tipIdx = Math.floor(Math.random() * c.tips.length);
    const el = document.createElement("div");
    el.className = "loading";
    el.innerHTML = `
      <div class="ld-art">${c.art}</div>
      <div class="ld-bottom">
        <h2 class="ld-title">${c.title}</h2>
        <div class="ld-sub">${c.subtitle}</div>
        <div class="ld-bar"><i data-bar></i></div>
        <div class="ld-row"><span class="ld-status" data-status>Starting</span><span class="ld-pct" data-pct>0%</span></div>
        <div class="ld-tip" data-tip>${c.tips[this.tipIdx]}</div>
        <div class="ld-err" data-err hidden>
          <div class="ld-err-msg" data-errmsg></div>
          <div class="ld-err-btns"><button class="btn sm" data-a="retry">Retry</button><button class="btn sm" data-a="back">Back</button></div>
        </div>
      </div>`;
    this.bar = el.querySelector("[data-bar]");
    this.pct = el.querySelector("[data-pct]");
    this.tip = el.querySelector("[data-tip]");
    this.status = el.querySelector("[data-status]");
    this.errBox = el.querySelector("[data-err]");
    this.errMsg = el.querySelector("[data-errmsg]");
    this.artEl = el.querySelector(".ld-art");
    el.addEventListener("click", (e) => {
      const a = e.target.dataset?.a;
      if (a === "retry") this.game.goto("loading", { target: this.target });
      else if (a === "back") this.game.goto("modes");
    });
    this.ui.appendChild(el);
    loadImage(c.image).then((img) => {
      if (img && this.game.scene === this) { this.bg = img; this.artEl.style.display = "none"; }
    });
    this.startTasks();
  }

  /** Start every task at once; each reports its own 0..1 progress and settles as done or failed. */
  startTasks() {
    const next = this.cfg.next;
    this.tasks = buildTasks(this.cfg, next.params).map((t) => ({ ...t, p: 0, state: "run" }));
    const limit = this.cfg.timeout ?? 20;
    for (const task of this.tasks) {
      const ctx = { progress: (f) => { if (task.state === "run") task.p = Math.max(task.p, Math.min(1, f)); } };
      const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error("timed out")), (task.timeout ?? limit) * 1000));
      Promise.race([Promise.resolve().then(() => task.run(ctx)), timeout]).then(
        () => this.settle(task, null),
        (err) => this.settle(task, err),
      );
    }
  }
  settle(task, err) {
    if (task.state !== "run") return;
    task.p = 1;
    if (!err) { task.state = "done"; return; }
    console.warn(`[loading] ${task.id}: ${err.message ?? err}`);
    if (task.fatal) {
      task.state = "failed";
      if (!this.error && this.game.scene === this) {
        this.error = { label: task.label, message: String(err.message ?? err) };
        this.errMsg.textContent = `${task.label} failed: ${this.error.message}`;
        this.errBox.hidden = false;
        this.status.textContent = "Cannot start";
      }
    } else {
      task.state = "done"; // optional: the game still starts (placeholder art, silent audio...)
      this.warnings++;
    }
  }

  /** Weighted 0..1 progress of all tasks. */
  measure() {
    let sum = 0, tot = 0;
    for (const t of this.tasks) { tot += t.weight; sum += t.weight * (t.state === "run" ? t.p * 0.95 : t.p); }
    return tot ? sum / tot : 1;
  }

  update(dt) {
    this.t += dt;
    const allDone = this.tasks.every((t) => t.state === "done");
    // Real progress, eased so the bar glides. It never passes what has really loaded, and waits for minTime before 100%.
    const real = allDone ? 1 : this.measure();
    const timeCap = Math.min(1, this.t / this.cfg.minTime);
    const goal = this.error ? Math.min(real, this.shown) : Math.min(real, allDone ? timeCap : 0.97 * Math.max(timeCap, 0.05));
    this.shown += (goal - this.shown) * Math.min(1, dt * 7);
    if (goal >= 1 && this.shown > 0.995) this.shown = 1;
    const p = Math.min(1, this.shown);
    this.bar.style.width = `${(p * 100).toFixed(1)}%`;
    this.pct.textContent = `${Math.floor(p * 100)}%`;
    if (!this.error) {
      const cur = this.tasks.find((t) => t.state === "run");
      this.status.textContent = this.readyT >= 0 ? "Ready" : cur ? `${cur.label}...` : "Getting ready...";
    }
    if (Math.floor(this.t / 1.6) !== Math.floor((this.t - dt) / 1.6)) {
      this.tipIdx = (this.tipIdx + 1) % this.cfg.tips.length;
      this.tip.textContent = this.cfg.tips[this.tipIdx];
    }
    const { width: w, height: h } = this.game;
    for (let i = 0; i < 2; i++)
      this.particles.emit({ x: w / 2 + rand(-60, 60), y: h * 0.4 + rand(-20, 40), z: 0, vx: rand(-20, 20), vy: 0, vz: rand(40, 140),
        gravity: 0, drag: 0.2, life: rand(1.5, 3), size: rand(1, 2.6), sizeEnd: 0.2, color: [255, 190, 90], colorEnd: [200, 40, 10], alpha: 0.8 });
    this.particles.update(dt);

    if (this.done || this.error) return;
    if (allDone && this.shown >= 1 && this.t >= this.cfg.minTime) {
      this.readyT = Math.max(0, this.readyT) + dt;
      if (this.readyT >= READY_HOLD) {
        this.done = true;
        const n = this.cfg.next;
        this.game.goto(n.scene, n.params);
      }
    }
  }
  render(ctx, w, h) {
    ctx.fillStyle = "#07080c"; ctx.fillRect(0, 0, w, h);
    if (this.bg) {
      ctx.globalAlpha = Math.min(0.6, this.t * 1.2);
      drawCover(ctx, this.bg, this.bg.naturalWidth, this.bg.naturalHeight, w, h);
      ctx.globalAlpha = 1;
      const v = ctx.createLinearGradient(0, h * 0.55, 0, h);
      v.addColorStop(0, "rgba(5,6,10,0)"); v.addColorStop(1, "rgba(5,6,10,.85)");
      ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
    }
    const cx = w / 2, cy = h * 0.4;
    const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, 260);
    g.addColorStop(0, "rgba(255,140,60,.28)"); g.addColorStop(1, "rgba(255,140,60,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    // Rotating rune rings (procedural placeholder for the custom art).
    ctx.save(); ctx.translate(cx, cy); ctx.globalAlpha = this.bg ? 0.4 : 1; ctx.strokeStyle = "rgba(242,196,109,.55)";
    for (const [r, speed, dash] of [[120, 0.5, 14], [90, -0.8, 8], [58, 1.2, 5]]) {
      ctx.save(); ctx.rotate(this.t * speed); ctx.setLineDash([dash, dash * 1.6]); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke(); ctx.restore();
    }
    ctx.rotate(-this.t * 0.4); ctx.setLineDash([]); ctx.lineWidth = 1.5; ctx.beginPath();
    for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU; ctx.lineTo(Math.cos(a) * 105, Math.sin(a) * 105); }
    ctx.closePath(); ctx.stroke(); ctx.restore();
    this.particles.render(ctx);
  }
}
