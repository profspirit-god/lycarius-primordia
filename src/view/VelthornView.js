/**
 * View of the Velthorn tree (job track J1, client only): trunk, canopy, chop notches, the wobble after a swing, the white flash after
 * a hit, the burning and charred looks and the stumps. It reads the entity (x y radius height state chops maxChops flash wobble) and
 * never writes sim state; `flash` and `wobble` are view-only fields it fades itself. Registered in view/index.js under kind "velthorn".
 * The canopy turns see-through while a player stands behind the tree, so the tree never hides a fight.
 */
import { drawCylinder } from "../render/drawCylinder.js";
import { drawBar } from "../render/drawBar.js";
import { lerpColor, rgba, TAU } from "../core/math.js";

const TRUNK = [116, 82, 52];
const TRUNK_BURNT = [58, 40, 30];
const LEAF = [58, 150, 118];
const LEAF_LIGHT = [132, 214, 168];
const LEAF_BURNT = [214, 96, 34];
const STUMP = [128, 94, 60];
const STUMP_CHARRED = [38, 33, 31];
const TRUNK_R = 14; // drawn trunk radius (the collision circle is wider: the whole tree base)
const TRUNK_H = 64;
const BLOBS = [ // canopy lobes: x offset, height above the trunk top, radius
  [0, 40, 40],
  [-30, 18, 30],
  [30, 20, 29],
  [0, 62, 30],
];

export class VelthornView {
  constructor(world) {
    this.world = world;
    this.off = world.events.on("chop", (e) => {
      if (e.target) e.target.wobble = 1;
    });
  }
  dispose() {
    this.off();
  }

  /** Once per entity step: fade the view-only fields. */
  tick(e, dt) {
    e.flash = Math.max(0, (e.flash || 0) - dt * 5);
    e.wobble = Math.max(0, (e.wobble || 0) - dt * 2.2);
  }

  draw(ctx, e) {
    const w = this.world;
    if (e.state === "felled" || e.state === "charred") return this.drawStump(ctx, e);
    const burning = e.state === "burning",
      t = w.time,
      sway = Math.sin(t * 1.3 + e.x * 0.013) * 1.6 + Math.sin(t * 46) * e.wobble * 5,
      flash = (e.flash || 0) * 0.6;
    const top = drawCylinder(ctx, {
      x: e.x, y: e.y, r: TRUNK_R, h: TRUNK_H, color: burning ? TRUNK_BURNT : TRUNK, flash, lean: [sway * 0.4, 0],
    });
    if (!burning) this.notches(ctx, e);
    // canopy: see-through when a player is behind the tree (smaller y) and would be hidden by it
    let alpha = 1;
    for (const p of w.entities) if (p.isPlayer && p.y < e.y && Math.abs(p.x - e.x) < 70 && e.y - p.y < 130) alpha = 0.42;
    ctx.save();
    ctx.globalAlpha = alpha;
    const base = burning ? lerpColor(LEAF, LEAF_BURNT, 0.75) : LEAF,
      light = burning ? lerpColor(LEAF_LIGHT, LEAF_BURNT, 0.55) : LEAF_LIGHT;
    for (const [bx, bh, r] of BLOBS) {
      const cx = top.tx + bx + sway * (bh / 40),
        cy = top.ty - bh,
        g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r);
      g.addColorStop(0, rgba(lerpColor(light, [255, 255, 255], flash)));
      g.addColorStop(1, rgba(lerpColor(base, [255, 255, 255], flash)));
      ctx.fillStyle = "rgba(0,0,0,.22)";
      ctx.beginPath();
      ctx.ellipse(cx + 2, cy + 3, r, r * 0.92, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(cx, cy, r, r * 0.92, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    if (!burning && e.chops > 0) drawBar(ctx, e.x - 22, top.ty - 112, 44, 5, 1 - e.chops / e.maxChops, "#c8a15a");
  }

  /** One pale cut across the trunk per landed chop, stepping up the trunk. */
  notches(ctx, e) {
    ctx.strokeStyle = "rgba(245,230,195,.95)";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    for (let i = 0; i < e.chops; i++) {
      const y = e.y - 10 - i * 11,
        dir = i % 2 ? -1 : 1;
      ctx.beginPath();
      ctx.moveTo(e.x - TRUNK_R * 0.8 * dir, y);
      ctx.lineTo(e.x + TRUNK_R * 0.5 * dir, y - 4);
      ctx.stroke();
    }
  }

  drawStump(ctx, e) {
    const charred = e.state === "charred",
      top = drawCylinder(ctx, { x: e.x, y: e.y, r: TRUNK_R + 1, h: charred ? 9 : 15, color: charred ? STUMP_CHARRED : STUMP });
    ctx.strokeStyle = charred ? "rgba(255,120,40,.35)" : "rgba(70,46,26,.7)";
    ctx.lineWidth = 1.5;
    for (const k of [0.35, 0.7]) {
      ctx.beginPath();
      ctx.ellipse(top.tx, top.ty, TRUNK_R * k, top.ry * k, 0, 0, TAU);
      ctx.stroke();
    }
  }
}
