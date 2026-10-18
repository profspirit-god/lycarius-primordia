import { Scene } from "../core/Scene.js";
import { drawCover } from "../render/drawCover.js";
import { MODES, ART } from "../lobby/lobbyData.js";
import { loadImage, loadVideo } from "../lobby/assets.js";

/**
 * Game mode select: Live Server, Campaign, Training Grounds.
 * Each card shows a small picture placeholder; hovering (or focusing) shows the mode definition and stats below.
 * The background is a muted looping video (ART.modeVideo), drawn to the canvas; if it cannot load, a drawn placeholder is used.
 */
export class ModeSelectScene extends Scene {
  enter(game) {
    super.enter(game);
    this.t = 0;
    this.hover = null;
    this.video = null;
    this.fade = 0;
    const el = document.createElement("div");
    el.className = "modes";
    el.innerHTML = `
      <h2 class="modes-title">SELECT MODE</h2>
      <div class="mode-row">${MODES.map((m) => `
        <button class="mode-card" data-a="go" data-id="${m.id}" style="--mc:${m.color.join(",")}">
          <div class="mode-pic"><span>${m.name[0]}</span><small>picture placeholder</small></div>
          <div class="mode-name">${m.name}</div><div class="mode-tag">${m.tag}</div>
        </button>`).join("")}</div>
      <div class="mode-info" data-info></div>
      <button class="chip back-chip" data-a="back">‹ Home</button>`;
    this.info = el.querySelector("[data-info]");
    this.showInfo(null);
    el.addEventListener("click", (e) => {
      const b = e.target.closest("[data-a]");
      if (!b) return;
      if (b.dataset.a === "back") game.goto("home");
      else if (b.dataset.a === "go") {
        const go = MODES.find((m) => m.id === b.dataset.id).go;
        game.goto(go.scene, go.params);
      }
    });
    const on = (e) => this.showInfo(e.target.closest(".mode-card")?.dataset.id ?? null);
    el.addEventListener("mouseover", on);
    el.addEventListener("focusin", on);
    el.addEventListener("mouseleave", () => this.showInfo(null));
    this.ui.appendChild(el);
    for (const m of MODES) {
      loadImage(m.pic).then((img) => {
        const pic = el.querySelector(`[data-id="${m.id}"] .mode-pic`);
        if (img && pic) { pic.style.backgroundImage = `url("${m.pic}")`; pic.classList.add("has-img"); }
      });
    }
    loadVideo(ART.modeVideo).then((v) => {
      if (!v || this.game.scene !== this) return;
      this.video = v;
      v.currentTime = 0;
      v.play().catch(() => {});
    });
  }

  exit() { this.video?.pause(); }

  showInfo(id) {
    this.hover = id;
    const m = MODES.find((x) => x.id === id);
    this.info.classList.toggle("empty", !m);
    this.info.innerHTML = m
      ? `<div class="mi-head"><b>${m.name}</b><small>${m.tag}</small></div><p>${m.blurb}</p>
         <div class="mi-grid">${m.stats.map(([k, v]) => `<div><small>${k}</small><b>${v}</b></div>`).join("")}</div>`
      : `<p>Hover a mode to see its details.</p>`;
  }

  update(dt) {
    this.t += dt;
    if (this.game.input.wasPressed("Escape")) this.game.goto("home");
  }

  render(ctx, w, h) {
    const m = MODES.find((x) => x.id === this.hover);
    const c = m ? m.color : [255, 160, 90];
    ctx.fillStyle = "#07080c"; ctx.fillRect(0, 0, w, h);
    const v = this.video;
    if (v && v.readyState >= 2) {
      this.fade = Math.min(1, this.fade + 0.03);
      ctx.globalAlpha = this.fade;
      drawCover(ctx, v, v.videoWidth, v.videoHeight, w, h);
      ctx.globalAlpha = 1;
      // Darken the centre so the cards stay readable, keep the edges bright.
      const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.7);
      g.addColorStop(0, "rgba(5,6,10,.55)"); g.addColorStop(1, "rgba(5,6,10,.15)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
    // Soft wash tinted by the hovered mode (also animates the placeholder when there is no video).
    for (let i = 0; i < 3; i++) {
      const x = w * (0.5 + Math.sin(this.t * 0.25 + i * 2.1) * 0.35), y = h * (0.45 + Math.cos(this.t * 0.2 + i * 1.7) * 0.25);
      const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(w, h) * 0.5);
      g.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${v ? 0.08 : 0.18})`); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
    if (!v) {
      ctx.strokeStyle = "rgba(242,196,109,.25)"; ctx.lineWidth = 1;
      ctx.strokeRect(w * 0.06, h * 0.06, w * 0.88, h * 0.88);
      ctx.fillStyle = "rgba(234,223,200,.18)"; ctx.font = "13px Georgia"; ctx.textAlign = "center";
      ctx.fillText("VIDEO PLACEHOLDER", w / 2, h * 0.09);
      ctx.textAlign = "start";
    }
  }
}
