import { Scene } from '../core/Scene.js';
import { Settings } from '../core/Settings.js';

export class SettingsScene extends Scene {
  enter(game) {
    super.enter(game);
    const s = Settings.data;
    const el = document.createElement('div');
    el.className = 'panel';
    el.innerHTML = `
      <h2 class="title" style="font-size:28px">SETTINGS</h2><div class="subtitle">Preferences</div>
      <div class="row"><label>Master volume</label><input type="range" min="0" max="1" step="0.05" data-k="masterVolume" value="${s.masterVolume}"></div>
      <div class="note">Audio arrives in a later version; value is saved already.</div>
      <div class="row"><label>Particle quality</label>
        <select data-k="particleQuality" data-num="1">
          <option value="0.35" ${s.particleQuality == 0.35 ? 'selected' : ''}>Low</option>
          <option value="0.7" ${s.particleQuality == 0.7 ? 'selected' : ''}>Medium</option>
          <option value="1" ${s.particleQuality == 1 ? 'selected' : ''}>High</option></select></div>
      <div class="row"><label>Screen shake</label><input type="checkbox" data-k="screenShake" ${s.screenShake ? 'checked' : ''}></div>
      <div class="row"><label>Damage numbers</label><input type="checkbox" data-k="damageNumbers" ${s.damageNumbers ? 'checked' : ''}></div>
      <div class="row"><label>Show debug (FPS)</label><input type="checkbox" data-k="showDebug" ${s.showDebug ? 'checked' : ''}></div>
      <div class="row"><label>Dummy attacks</label><input type="checkbox" data-k="dummyAttacks" ${s.dummyAttacks ? 'checked' : ''}></div>
      <div class="note">On: the dummy uses the player's stats (50 HP, 100 mana, same regen), fights back, and can be defeated.</div>
      <button class="btn" data-a="reset">Reset to defaults</button>
      <button class="btn" data-a="back">Back</button>`;
    el.addEventListener('input', (e) => {
      const t = e.target, k = t.dataset.k; if (!k) return;
      Settings.set(k, t.type === 'checkbox' ? t.checked : t.type === 'range' || t.dataset.num ? Number(t.value) : t.value);
    });
    el.addEventListener('click', (e) => {
      const a = e.target.dataset?.a;
      if (a === 'back') game.goto('menu');
      if (a === 'reset') { Settings.reset(); game.goto('settings'); }
    });
    this.ui.appendChild(el);
  }
  render(ctx, w, h) { ctx.fillStyle = '#0a0b10'; ctx.fillRect(0, 0, w, h); }
}
