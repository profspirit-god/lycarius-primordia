import { Scene } from "../core/Scene.js";
import { ParticleSystem } from "../systems/ParticleSystem.js";
import { rand, TAU } from "../core/math.js";
import { drawCover } from "../render/drawCover.js";
import { LOADING } from "../lobby/lobbyData.js";
import { loadImage } from "../lobby/assets.js";

/**
 * Custom loading screen. `params.target` picks an entry in LOADING (lobbyData.js).
 * The bar is cosmetic for now (fills over `minTime`). When real assets / zone data load, drive `this.progress` from that.
 */
export class LoadingScene extends Scene {
  constructor({ target = "training" } = {}) {
    super();
    this.cfg = LOADING[target];
  }
  enter(game) {
    super.enter(game);
    this.t = 0;
    this.progress = 0;
    this.done = false;
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
        <div class="ld-pct" data-pct>0%</div>
        <div class="ld-tip" data-tip>${c.tips[this.tipIdx]}</div>
      </div>`;
    this.bar = el.querySelector("[data-bar]");
    this.pct = el.querySelector("[data-pct]");
    this.tip = el.querySelector("[data-tip]");
    this.artEl = el.querySelector(".ld-art");
    this.ui.appendChild(el);
    loadImage(c.image).then((img) => {
      if (img && this.game.scene === this) { this.bg = img; this.artEl.style.display = "none"; }
    });
  }
  update(dt) {
    this.t += dt;
    // Eased fill with small stalls so it feels like work is happening.
    const target = Math.min(1, this.t / this.cfg.minTime);
    this.progress += (target - this.progress) * Math.min(1, dt * 6);
    const p = Math.min(1, this.progress);
    this.bar.style.width = `${(p * 100).toFixed(1)}%`;
    this.pct.textContent = `${Math.floor(p * 100)}%`;
    if (Math.floor(this.t / 1.6) !== Math.floor((this.t - dt) / 1.6)) {
      this.tipIdx = (this.tipIdx + 1) % this.cfg.tips.length;
      this.tip.textContent = this.cfg.tips[this.tipIdx];
    }
    const { width: w, height: h } = this.game;
    for (let i = 0; i < 2; i++)
      this.particles.emit({ x: w / 2 + rand(-60, 60), y: h * 0.4 + rand(-20, 40), z: 0, vx: rand(-20, 20), vy: 0, vz: rand(40, 140),
        gravity: 0, drag: 0.2, life: rand(1.5, 3), size: rand(1, 2.6), sizeEnd: 0.2, color: [255, 190, 90], colorEnd: [200, 40, 10], alpha: 0.8 });
    this.particles.update(dt);
    if (!this.done && this.t >= this.cfg.minTime + 0.25) {
      this.done = true;
      const n = this.cfg.next;
      this.game.goto(n.scene, n.params);
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
