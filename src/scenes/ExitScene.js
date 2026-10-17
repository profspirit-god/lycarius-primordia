import { Scene } from '../core/Scene.js';

/** Browsers cannot truly quit; this is the exit screen. A desktop wrapper (Electron/Tauri) will do a real quit later. */
export class ExitScene extends Scene {
  enter(game) {
    super.enter(game);
    const el = document.createElement('div');
    el.className = 'panel';
    el.innerHTML = `<h2 class="title" style="font-size:26px">FAREWELL</h2><div class="subtitle">You may close this tab</div>
      <button class="btn" data-a="back">Return to menu</button>`;
    el.addEventListener('click', (e) => { if (e.target.dataset?.a === 'back') game.goto('menu'); });
    this.ui.appendChild(el);
    window.close(); // only works if the tab was opened by script
  }
  render(ctx, w, h) { ctx.fillStyle = '#050609'; ctx.fillRect(0, 0, w, h); }
}
