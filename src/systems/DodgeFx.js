import { quality } from "./ParticleSystem.js";
import { rand, TAU } from "../core/math.js";

const LIFE = 0.42; // seconds a trail sample stays visible
const RGB = "255,210,58"; // yellow

/** Outline of the body cylinder at (x, y): base ring, two sides, top ring. */
function outline(ctx, x, y, r, h) {
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.5, 0, 0, TAU);
  ctx.moveTo(x - r, y);
  ctx.lineTo(x - r, y - h);
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + r, y - h);
  ctx.moveTo(x + r, y - h);
  ctx.ellipse(x, y - h, r, r * 0.5, 0, 0, TAU);
  ctx.stroke();
}

/**
 * Visuals for the 'dodge' event: a yellow line silhouette trail. While `owner.dodge` runs, one sample per frame is
 * recorded; samples fade over LIFE seconds. Drawn as a streak through the body centre plus outlined body shapes.
 * View only. `render` runs before the entities so the body stays on top.
 */
export class DodgeFx {
  constructor(world) {
    this.world = world;
    this.trails = [];
    this.off = world.events.on("dodge", (e) => this.onDodge(e));
  }
  dispose() {
    this.off();
  }

  onDodge(e) {
    if (e.type !== "start") return;
    this.trails.push({ owner: e.owner, live: true, pts: [{ x: e.x, y: e.y, a: 0 }] });
    const P = this.world.particles,
      cnt = Math.round(10 * quality());
    for (let i = 0; i < cnt; i++)
      P.emit({
        x: e.x + rand(-6, 6),
        y: e.y + rand(-3, 3),
        z: rand(0, 8),
        vx: -e.dir.x * rand(20, 90) + rand(-20, 20),
        vy: -e.dir.y * rand(20, 90) + rand(-10, 10),
        vz: rand(10, 50),
        gravity: 120,
        life: rand(0.25, 0.5),
        size: rand(1.4, 2.6),
        sizeEnd: 0.2,
        color: [255, 225, 90],
        colorEnd: [255, 160, 20],
      });
  }

  update(dt) {
    const list = this.trails;
    for (let i = list.length - 1; i >= 0; i--) {
      const tr = list[i],
        pts = tr.pts;
      if (tr.live) {
        if (tr.owner.dodge) pts.push({ x: tr.owner.x, y: tr.owner.y, a: 0 });
        else tr.live = false;
      }
      for (let j = 0; j < pts.length; j++) pts[j].a += dt;
      while (pts.length && pts[0].a > LIFE) pts.shift();
      if (!tr.live && !pts.length) list.splice(i, 1);
    }
  }

  render(ctx) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const tr of this.trails) {
      const pts = tr.pts,
        h = tr.owner.height,
        r = tr.owner.radius;
      for (let i = 1; i < pts.length; i++) {
        const p = pts[i],
          q = pts[i - 1],
          k = 1 - p.a / LIFE;
        ctx.strokeStyle = `rgba(${RGB},${(0.9 * k).toFixed(3)})`;
        ctx.lineWidth = 1 + 4 * k;
        ctx.beginPath();
        ctx.moveTo(q.x, q.y - h * 0.5);
        ctx.lineTo(p.x, p.y - h * 0.5);
        ctx.stroke();
        if (i % 2 === 0) {
          ctx.strokeStyle = `rgba(${RGB},${(0.55 * k).toFixed(3)})`;
          ctx.lineWidth = 1.5;
          outline(ctx, p.x, p.y, r, h);
        }
      }
    }
    ctx.restore();
  }
}
