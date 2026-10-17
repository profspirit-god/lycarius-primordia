import { Settings } from '../core/Settings.js';
import { rand } from '../core/math.js';

/** Floating damage text with real gravity: pops up, arcs, then FALLS and fades. */
export class DamageNumbers {
  constructor() { this.list = []; }
  spawn(x, y, text, { crit = false, color = '#ffd27a' } = {}) {
    if (!Settings.get('damageNumbers')) return;
    this.list.push({ x, y, text, color, crit, vx: rand(-80, 80), vy: -rand(300, 380) * (crit ? 1.15 : 1),
      g: 950, age: 0, life: 1.5, size: crit ? 38 : 26 });
  }
  update(dt) {
    for (const n of this.list) { n.age += dt; n.vy += n.g * dt; n.x += n.vx * dt; n.y += n.vy * dt; }
    this.list = this.list.filter((n) => n.age < n.life);
  }
  render(ctx) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    for (const n of this.list) {
      const pop = 1 + Math.max(0, 0.45 - n.age * 3);
      const a = n.age > n.life * 0.55 ? 1 - (n.age - n.life * 0.55) / (n.life * 0.45) : 1;
      ctx.save(); ctx.globalAlpha = Math.max(0, a); ctx.translate(n.x, n.y); ctx.scale(pop, pop);
      ctx.font = `bold ${n.size}px Georgia, serif`;
      ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(30,8,0,.9)'; ctx.strokeText(n.text, 0, 0);
      ctx.fillStyle = n.color; ctx.fillText(n.text, 0, 0); ctx.restore();
    }
  }
}
