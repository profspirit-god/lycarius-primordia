import { Scene } from "../core/Scene.js";
import { ParticleSystem } from "../systems/ParticleSystem.js";
import { rand } from "../core/math.js";

/** "Coming soon" screen for modes that are planned but not built (Campaign, Live Server). */
export class PlaceholderScene extends Scene {
  constructor({ title = "Coming soon", blurb = "", plan = "" } = {}) {
    super();
    Object.assign(this, { title, blurb, plan });
  }
  enter(game) {
    super.enter(game);
    this.particles = new ParticleSystem(300);
    const el = document.createElement("div");
    el.className = "panel";
    el.innerHTML = `
      <h2 class="title" style="font-size:28px">${this.title.toUpperCase()}</h2>
      <div class="subtitle">Coming soon</div>
      <div class="note" style="margin:0 0 8px;text-align:center">${this.blurb}</div>
      <div class="note" style="text-align:center">${this.plan}</div>
      <button class="btn" data-a="back">Back</button>`;
    el.addEventListener("click", (e) => {
      if (e.target.dataset?.a === "back") game.goto("menu");
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
