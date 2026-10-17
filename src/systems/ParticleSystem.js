import { lerp, lerpColor, rgba, TAU } from '../core/math.js';

/**
 * Physics particles. Each has ground position (x,y) and height z.
 * Gravity pulls z down, particles bounce off the ground (z=0) with restitution + friction.
 * shapes: 'dot' | 'spark' (velocity streak) | 'ring' (expanding ground shockwave)
 */
export class ParticleSystem {
  constructor(max = 6000) { this.list = []; this.max = max; }

  emit(o) {
    if (this.list.length >= this.max) return;
    this.list.push({
      x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
      gravity: 900, drag: 0.4, bounce: 0.45, friction: 0.65,
      life: 1, age: 0, size: 3, sizeEnd: 0, color: [255, 160, 40], colorEnd: null,
      alpha: 1, additive: true, shape: 'dot', stretch: 0.02, ...o,
    });
  }

  update(dt) {
    const L = this.list; let j = 0;
    const slide = Math.exp(-dt * 8);
    for (let i = 0; i < L.length; i++) {
      const p = L[i];
      p.age += dt;
      if (p.age >= p.life) continue;
      if (p.shape !== 'ring') {
        const d = 1 / (1 + p.drag * dt);
        p.vx *= d; p.vy *= d; p.vz *= d;
        p.vz -= p.gravity * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        if (p.z < 0) {
          p.z = 0;
          if (p.vz < -40) { p.vz = -p.vz * p.bounce; p.vx *= p.friction; p.vy *= p.friction; }
          else { p.vz = 0; p.vx *= slide; p.vy *= slide; }
        }
      }
      L[j++] = p;
    }
    L.length = j;
  }

  render(ctx) {
    for (const additive of [false, true]) {
      ctx.globalCompositeOperation = additive ? 'lighter' : 'source-over';
      for (const p of this.list) if (p.additive === additive) this._draw(ctx, p);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  _draw(ctx, p) {
    const t = p.age / p.life, fade = Math.pow(1 - t, 1.3);
    const c = p.colorEnd ? lerpColor(p.color, p.colorEnd, t) : p.color;
    const s = Math.max(0.1, lerp(p.size, p.sizeEnd, t));
    const sx = p.x, sy = p.y - p.z;
    if (p.shape === 'ring') {
      ctx.strokeStyle = rgba(c, p.alpha * (1 - t)); ctx.lineWidth = 1 + 4 * (1 - t);
      ctx.beginPath(); ctx.ellipse(sx, sy, s, s * 0.5, 0, 0, TAU); ctx.stroke();
    } else if (p.shape === 'spark') {
      ctx.strokeStyle = rgba(c, p.alpha * fade); ctx.lineWidth = Math.max(0.6, s); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - p.vx * p.stretch, sy - (p.vy - p.vz) * p.stretch); ctx.stroke();
    } else {
      ctx.fillStyle = rgba(c, p.alpha * fade);
      ctx.beginPath(); ctx.arc(sx, sy, s, 0, TAU); ctx.fill();
    }
  }
}
