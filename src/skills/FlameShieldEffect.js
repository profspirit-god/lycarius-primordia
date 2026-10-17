import { Entity } from "../entities/Entity.js";
import { scaled as n } from "../systems/ParticleSystem.js";
import { clamp, rand, TAU } from "../core/math.js";
import { drawGlow } from "../render/drawGlow.js";
import { drawGroundCircle } from "../render/drawMagicCircle.js";

const RISE_TIME = 0.45; // seconds for the arc to rise and the runes to light
const BLOCK_AFTER = 0.35; // fraction of the rise after which the arc blocks
const SEGMENTS = 28;

/** Signed shortest angle from b to a. */
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

/**
 * The living shield. Spawned by the FlameShield skill and stored on `owner.shield`.
 * Projectiles find it by `isShield`, ask `blocks()` whether they crossed the arc, then call `absorb()`.
 * Rules: damage < points -> absorbed, points drop. damage >= points -> shield ends, the rest passes through.
 */
export class FlameShieldEffect extends Entity {
  constructor({ world, owner, points, radius, arc, height, upkeep }) {
    super();
    Object.assign(this, {
      world,
      owner,
      points,
      maxPoints: points,
      shieldRadius: radius,
      halfArc: arc / 2,
      shieldHeight: height,
      upkeep,
    });
    this.isShield = true;
    this.state = "active"; // "active" | "closing"
    this.facing = owner.aim;
    this.t = 0;
    this.rise = 0;
    this.closeT = 0;
    this.closeDur = 0.3;
    this.hitFlash = 0;
    this.ripples = [];
    this.acc = 0;
    this.sync();
  }

  /** Sort position for the renderer: the middle of the arc. */
  sync() {
    this.x = this.owner.x + Math.cos(this.facing) * this.shieldRadius;
    this.y = this.owner.y + Math.sin(this.facing) * this.shieldRadius;
  }

  /** True when a projectile at (px,py,pz) with radius pr has just reached the arc from outside. */
  blocks(px, py, pz, pr) {
    if (this.state !== "active" || this.rise < BLOCK_AFTER) return false;
    const o = this.owner,
      dx = px - o.x,
      dy = py - o.y,
      d = Math.hypot(dx, dy),
      R = this.shieldRadius;
    if (d > R + pr * 0.6 || d < R - 34) return false;
    if (pz > this.shieldHeight + pr) return false;
    return Math.abs(angDiff(Math.atan2(dy, dx), this.facing)) <= this.halfArc + 0.12;
  }

  /**
   * Takes a hit. Returns the damage that gets THROUGH (0 when fully absorbed).
   * @param {number} damage
   * @param {{x:number,y:number,z:number,vx:number,vy:number,charge:number}} proj
   */
  absorb(damage, proj) {
    const w = this.world,
      o = this.owner;
    const taken = Math.min(damage, this.points),
      left = damage - taken;
    this.points -= taken;
    const broke = this.points <= 1e-6;
    const ang = Math.atan2(proj.y - o.y, proj.x - o.x);
    this.ripples.push({ a: ang, age: 0 });
    if (this.ripples.length > 4) this.ripples.shift();
    this.hitFlash = 1;

    w.damageNumbers.spawn(proj.x, proj.y - proj.z - 14, String(Math.round(taken)), {
      color: "#ffb347",
    });
    w.camera.addTrauma(0.1 + 0.25 * proj.charge);
    w.hitstop(0.03 + 0.03 * proj.charge);
    this.impactSparks(proj, ang, 14 + proj.charge * 26);
    w.lights.add({
      x: proj.x,
      y: proj.y,
      z: proj.z,
      radius: 150 + proj.charge * 100,
      intensity: 1.1,
      life: 0.22,
      color: [255, 175, 70],
    });
    w.particles.emit({
      shape: "ring",
      x: proj.x,
      y: proj.y,
      z: 0,
      life: 0.35,
      size: 6,
      sizeEnd: 55 + proj.charge * 40,
      color: [255, 200, 110],
    });

    w.events.emit("shield", {
      type: broke ? "break" : "hit",
      owner: o,
      shield: this,
      absorbed: taken,
      passed: left,
      charge: proj.charge,
      x: proj.x,
      y: proj.y,
      z: proj.z,
    });
    if (broke) {
      this.shatter();
      this.end(0.18);
    }
    return left;
  }

  /** Player toggled it off, ran out of mana, or went down. */
  deactivate(reason = "manual") {
    if (this.state !== "active") return;
    this.world.events.emit("shield", {
      type: "down",
      reason,
      owner: this.owner,
      shield: this,
      x: this.owner.x,
      y: this.owner.y,
      z: 0,
    });
    this.fade();
    this.end(0.3);
  }

  end(dur) {
    this.state = "closing";
    this.closeT = 0;
    this.closeDur = dur;
    if (this.owner.shield === this) this.owner.shield = null;
  }

  arcPoint(i, N = SEGMENTS) {
    const a = this.facing - this.halfArc + (2 * this.halfArc * i) / N;
    return {
      a,
      x: this.owner.x + Math.cos(a) * this.shieldRadius,
      y: this.owner.y + Math.sin(a) * this.shieldRadius,
    };
  }

  impactSparks(p, ang, count) {
    const P = this.world.particles,
      ox = Math.cos(ang),
      oy = Math.sin(ang);
    for (let i = 0; i < n(count); i++) {
      const a = ang + Math.PI + rand(-1.1, 1.1), // flung back toward the attacker
        s = rand(120, 380);
      P.emit({
        x: p.x,
        y: p.y,
        z: p.z,
        vx: Math.cos(a) * s - ox * 40,
        vy: Math.sin(a) * s - oy * 40,
        vz: rand(60, 300),
        gravity: 1000,
        life: rand(0.4, 0.9),
        size: rand(1.2, 2.6),
        sizeEnd: 0.4,
        color: [255, 225, 140],
        colorEnd: [255, 70, 10],
        shape: "spark",
        stretch: 0.025,
      });
    }
  }

  /** Embers flung along the whole arc when the shield breaks. */
  shatter() {
    const P = this.world.particles;
    for (let i = 0; i < n(60); i++) {
      const pt = this.arcPoint(Math.floor(rand(0, SEGMENTS + 1))),
        s = rand(60, 300);
      P.emit({
        x: pt.x,
        y: pt.y,
        z: rand(0, this.shieldHeight),
        vx: Math.cos(pt.a) * s,
        vy: Math.sin(pt.a) * s,
        vz: rand(40, 260),
        gravity: 900,
        life: rand(0.5, 1.1),
        size: rand(1.5, 3.2),
        sizeEnd: 0.3,
        color: [255, 215, 120],
        colorEnd: [200, 40, 0],
      });
    }
    this.world.camera.addTrauma(0.3);
  }

  /** Gentle collapse: embers lift off the arc. */
  fade() {
    const P = this.world.particles;
    for (let i = 0; i < n(30); i++) {
      const pt = this.arcPoint(Math.floor(rand(0, SEGMENTS + 1)));
      P.emit({
        x: pt.x,
        y: pt.y,
        z: rand(0, this.shieldHeight * 0.6),
        vx: rand(-20, 20),
        vy: rand(-20, 20),
        vz: rand(50, 160),
        gravity: -60,
        drag: 1.5,
        life: rand(0.5, 1),
        size: rand(1.5, 3),
        sizeEnd: 0.3,
        color: [255, 200, 100],
        colorEnd: [200, 50, 10],
      });
    }
  }

  update(dt, world) {
    this.t += dt;
    const o = this.owner;
    this.hitFlash = Math.max(0, this.hitFlash - dt * 4);
    for (const r of this.ripples) r.age += dt;
    while (this.ripples.length && this.ripples[0].age > 0.6) this.ripples.shift();

    if (this.state === "active") {
      if (o.downed) this.deactivate("downed");
      else {
        this.facing += angDiff(o.aim, this.facing) * (1 - Math.exp(-16 * dt));
        o.vitals.spend(this.upkeep * dt);
        if (o.vitals.mana <= 0.001) this.deactivate("starved");
      }
      this.rise = Math.min(1, this.rise + dt / RISE_TIME);
    } else {
      this.closeT += dt;
      this.rise = Math.max(0, 1 - this.closeT / this.closeDur);
      if (this.closeT >= this.closeDur) this.dead = true;
    }
    this.sync();
    if (this.state !== "active") return;

    // rising flame wisps along the arc
    const frac = this.points / this.maxPoints;
    this.acc += 55 * dt * this.rise * (0.4 + 0.6 * frac);
    const cnt = Math.floor(this.acc);
    this.acc -= cnt;
    const P = world.particles;
    for (let i = 0; i < n(cnt); i++) {
      const pt = this.arcPoint(rand(0, SEGMENTS));
      P.emit({
        x: pt.x,
        y: pt.y,
        z: rand(0, this.shieldHeight * 0.5) * this.rise,
        vx: rand(-12, 12),
        vy: rand(-12, 12),
        vz: rand(50, 120),
        gravity: -140,
        drag: 1.2,
        life: rand(0.45, 0.9),
        size: rand(2.5, 5),
        sizeEnd: 0.5,
        color: [255, 195, 85],
        colorEnd: [220, 50, 10],
        alpha: 0.7,
      });
    }
    const mid = this.arcPoint(SEGMENTS / 2);
    world.lights.add({
      x: mid.x,
      y: mid.y,
      z: this.shieldHeight * 0.5,
      radius: 130 + 40 * this.hitFlash,
      intensity: (0.35 + 0.5 * this.hitFlash) * (0.4 + 0.6 * frac),
      once: true,
      life: 1,
      color: [255, 150, 60],
    });
  }

  draw(ctx) {
    const o = this.owner,
      t = this.t,
      frac = this.points / this.maxPoints,
      low = frac < 0.3;
    const k = this.state === "active" ? 1 - Math.pow(1 - this.rise, 3) : this.rise;
    if (k <= 0.01) return;
    const h = this.shieldHeight * k;

    // magic circle under the caster: runes light up while the shield rises
    drawGroundCircle(
      ctx,
      o.x,
      o.y,
      o.radius + 22 + (1 - this.rise) * 26,
      t,
      this.state === "active" ? this.rise : 1,
      { alpha: (0.35 + 0.4 * this.hitFlash) * k },
    );

    const flicker = low ? 0.65 + 0.35 * Math.sin(t * 41) * Math.sin(t * 17) : 1;
    const body = clamp((0.45 + 0.55 * frac + this.hitFlash * 0.5) * k * flicker, 0, 1);
    const N = SEGMENTS,
      pts = [],
      tops = [],
      lean = []; // the wall flares outward at the top, so it stays readable when the arc runs up/down the screen
    for (let i = 0; i <= N; i++) {
      const p = this.arcPoint(i),
        edge = Math.sin((Math.PI * i) / N),
        wob = 0.5 + 0.5 * Math.sin(t * 7 + i * 2.3) * Math.sin(t * 3.1 + i * 1.1);
      let boost = 0;
      for (const r of this.ripples)
        boost += Math.exp(-Math.pow(angDiff(p.a, r.a) / 0.28, 2)) * (1 - r.age / 0.6);
      pts.push(p);
      tops.push(h * (0.55 + 0.45 * Math.sqrt(edge)) * (0.8 + 0.2 * wob) * (1 + 0.25 * boost));
      lean.push(h * 0.5 * (0.7 + 0.3 * wob));
    }
    // top-edge point of segment i in screen space
    const topX = (i) => pts[i].x + Math.cos(pts[i].a) * lean[i],
      topY = (i) => pts[i].y - tops[i] + Math.sin(pts[i].a) * lean[i] * 0.5;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    // translucent wall of fire
    const g = ctx.createLinearGradient(0, o.y, 0, o.y - h * 1.15);
    g.addColorStop(0, `rgba(255,205,100,${0.6 * body})`);
    g.addColorStop(0.5, `rgba(255,115,35,${0.38 * body})`);
    g.addColorStop(1, "rgba(255,60,10,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i <= N; i++) ctx.lineTo(pts[i].x, pts[i].y);
    for (let i = N; i >= 0; i--) ctx.lineTo(topX(i), topY(i));
    ctx.closePath();
    ctx.fill();

    // flame tongues
    for (let i = 0; i < N; i += 2) {
      const a = pts[i],
        b = pts[i + 1],
        c = pts[Math.min(N, i + 2)];
      const grow = 1.05 + 0.35 * Math.sin(t * 9 + i),
        tx = b.x + Math.cos(b.a) * lean[i + 1] * grow,
        ty = b.y - tops[i + 1] * grow + Math.sin(b.a) * lean[i + 1] * grow * 0.5;
      ctx.fillStyle = `rgba(255,${150 + ((i * 17) % 70)},60,${0.34 * body})`;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo(b.x + Math.sin(t * 6 + i) * 3, (b.y + ty) / 2, tx, ty);
      ctx.quadraticCurveTo(b.x + Math.sin(t * 5 + i) * 3, (b.y + ty) / 2 + 6, c.x, c.y);
      ctx.closePath();
      ctx.fill();
    }

    // bright rim on the ground and along the flickering top edge
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = `rgba(255,225,150,${0.85 * body})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i <= N; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,150,50,${0.55 * body})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(topX(0), topY(0));
    for (let i = 1; i <= N; i++) ctx.lineTo(topX(i), topY(i));
    ctx.stroke();

    const m = pts[N >> 1];
    drawGlow(ctx, m.x, m.y - h * 0.45, this.shieldRadius * 1.15, [255, 140, 50], 0.22 * body);
    ctx.restore();
  }
}
