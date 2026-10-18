import { Scene } from '../core/Scene.js';
import { ParticleSystem } from '../systems/ParticleSystem.js';
import { rand } from '../core/math.js';
import { GAME_NAME, EDITION, VERSION_LABEL } from '../config.js';

/** Title menu: Play, Creator Support, Exit. Everything else lives in the Home scene. */
export class MenuScene extends Scene {
  enter(game) {
    super.enter(game);
    this.particles = new ParticleSystem(500);
    const el = document.createElement('div');
    el.className = 'panel';
    el.innerHTML = `
      <h1 class="title">LYCARIUS</h1>
      <div class="subtitle">${GAME_NAME.replace('Lycarius ', '')} · ${EDITION}</div>
      <button class="btn" data-a="home">Play</button>
      <button class="btn" data-a="creator">Creator Support</button>
      <button class="btn" data-a="exit">Exit</button>
      <div class="footer">${VERSION_LABEL}</div>`;
    el.addEventListener('click', (e) => {
      const a = e.target.dataset?.a;
      if (a) game.goto(a);
    });
    this.ui.appendChild(el);
  }
  update(dt) {
    const { width: w, height: h } = this.game;
    for (let i = 0; i < 2; i++) this.particles.emit({ x: rand(0, w), y: rand(h * 0.6, h + 20), z: 0, vx: rand(-14, 14), vy: 0, vz: rand(30, 110),
      gravity: 0, drag: 0.1, life: rand(3, 6), size: rand(1, 2.8), sizeEnd: 0.2, color: [255, 160, 60], colorEnd: [200, 40, 10], alpha: 0.8 });
    this.particles.update(dt);
  }
  render(ctx, w, h) {
    const g = ctx.createRadialGradient(w / 2, h * 0.9, 50, w / 2, h / 2, Math.max(w, h));
    g.addColorStop(0, '#2a1308'); g.addColorStop(0.5, '#10121a'); g.addColorStop(1, '#06070b');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    this.particles.render(ctx);
  }
}
