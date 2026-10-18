import { Scene } from "../core/Scene.js";
import { ParticleSystem } from "../systems/ParticleSystem.js";
import { rand } from "../core/math.js";

/** Placeholder: ways to support the creator. Real links / payment provider decided later (see ROADMAP.md). */
export class CreatorSupportScene extends Scene {
  enter(game) {
    super.enter(game);
    this.particles = new ParticleSystem(300);
    const el = document.createElement("div");
    el.className = "panel creator";
    el.innerHTML = `
      <h2 class="title" style="font-size:28px">CREATOR SUPPORT</h2>
      <div class="subtitle">Help build Lycarius</div>
      <div class="support-grid">
        <div class="support-card">
          <div class="support-ic">◉</div>
          <h3>Monetary Support</h3>
          <p>Donations and memberships that fund development. Placeholder: provider and tiers to be decided.</p>
          <button class="btn" data-a="soon" data-what="Monetary support">Support (soon)</button>
        </div>
        <div class="support-card">
          <div class="support-ic">✦</div>
          <h3>Idea Support</h3>
          <p>Share ideas, lore, art and feedback. Placeholder: form or community link to be added.</p>
          <button class="btn" data-a="soon" data-what="Idea support">Share an idea (soon)</button>
        </div>
      </div>
      <div class="note" data-msg style="text-align:center;min-height:16px;margin:8px 0"></div>
      <button class="btn" data-a="menu">Back</button>`;
    el.addEventListener("click", (e) => {
      const a = e.target.dataset?.a;
      if (a === "menu") game.goto("menu");
      if (a === "soon") el.querySelector("[data-msg]").textContent = `${e.target.dataset.what} is a placeholder for now.`;
    });
    this.ui.appendChild(el);
  }
  update(dt) {
    const { width: w, height: h } = this.game;
    if (Math.random() < 0.5)
      this.particles.emit({ x: rand(0, w), y: rand(h * 0.7, h + 20), z: 0, vx: rand(-10, 10), vy: 0, vz: rand(20, 80),
        gravity: 0, drag: 0.1, life: rand(3, 5), size: rand(1, 2.4), sizeEnd: 0.2, color: [255, 160, 60], colorEnd: [200, 40, 10], alpha: 0.6 });
    this.particles.update(dt);
  }
  render(ctx, w, h) {
    ctx.fillStyle = "#0a0b10";
    ctx.fillRect(0, 0, w, h);
    this.particles.render(ctx);
  }
}
