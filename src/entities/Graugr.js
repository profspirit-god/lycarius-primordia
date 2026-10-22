import { Entity } from "./Entity.js";
import { Vitals } from "../systems/Vitals.js";
import { scaled as n } from "../systems/ParticleSystem.js";
import { drawCylinder } from "../render/drawCylinder.js";
import { drawGlow } from "../render/drawGlow.js";
import { drawBar } from "../render/drawBar.js";
import { drawEnhance } from "../render/drawEnhance.js";
import { drawStun } from "../render/drawStun.js";
import { Settings } from "../core/Settings.js";
import { clamp, rand, TAU } from "../core/math.js";

/** All Graugr numbers in one place. Stamina fractions are of maxStamina, HP fractions of maxHp. */
export const GRAUGR = {
  maxHp: 25,
  hpRegen: 1,
  maxStamina: 50,
  staminaRegen: 4,
  radius: 18,
  height: 58,
  tierBonus: 0.2, // each enhancement tier adds +20% max HP and +20% damage
  walkSpeed: 150,
  buySpeed: 110,
  retreatSpeed: 200,
  // AI thresholds
  attackHp: 0.5, // attack only above this HP ...
  attackStamina: 0.31, // ... and above this stamina
  buyStamina: 0.3, // at or below this stamina: buy time
  retreatHp: 0.4, // retreat below this HP ...
  retreatStamina: 0.05, // ... AND below this stamina
  buyDistance: 250, // preferred gap (body edge to body edge) while buying time
  // Skill 1: Arm Swing Barrage
  barrage: { cost: 10, duration: 10, windup: 0.6, tick: 0.5, damage: 12, reach: 78, cooldown: 35, deflect: 0.4, moveMult: 0.7, spin: 15 },
  // Skill 2: Piercing Poke
  poke: { cost: 13, charge: 3, lockAt: 0.7, damage: 25, length: 250, half: 20, strike: 0.2, recover: 0.6, cooldown: 60 },
  // Skill 3: Leap
  leap: { cost: 20, distance: 170, cooldown: 8, damage: 8, stun: 1.5 },
};

const DEATH_FADE = 0.7;
const HOP = 0.22; // visual hop time of a leap

/**
 * Graugr: melee brute with long arms. Smart AI picks one of three modes from its health and stamina:
 *   attack  (HP > 50% and stamina > 31%): close in and use skills
 *   buy     (stamina <= 30%, or HP 40-50%): keep a gap, strafe, recover; may leap away or dodge fireballs
 *   retreat (HP < 40% and stamina < 5%): run until stamina is back above 31%
 * Skills: Arm Swing Barrage (spinning arms, deflects projectiles), Piercing Poke (3 s stationary charge, long line),
 * Leap (instant dash; a hit deals damage and stuns). Damage goes out as 'hit' events; a 'kill' event is emitted on death.
 * Enhancement tier (raids): max HP and damage x (1 + 0.2 tier).
 */
export class Graugr extends Entity {
  /** `rng` (the world's) seeds the first strafe choice; without it the start is fixed (left, 3 s). Later rolls use `world.rng`. */
  constructor(x, y, { tier = 0, rng = null } = {}) {
    super();
    const G = GRAUGR;
    Object.assign(this, { x, y, radius: G.radius, height: G.height, hittable: true, solid: true });
    this.isGraugr = true;
    this.attack = true; // XpSystem pays kill XP for `downed && attack`
    this.xpGiven = false;
    this.tier = tier;
    this.power = 1 + G.tierBonus * tier;
    this.vitals = new Vitals({ maxHp: Math.round(G.maxHp * this.power), maxMana: 0, hpRegen: G.hpRegen, manaRegen: 0 });
    this.stamina = G.maxStamina;
    this.aim = Math.PI;
    this.mode = "attack";
    this.vx = 0;
    this.vy = 0;
    this.want = { x: 0, y: 0, speed: 0 };
    this.knock = { x: 0, y: 0 };
    this.cd = { barrage: 0, poke: 0, leap: 0 };
    this.act = null; // running skill: { type: 'barrage'|'poke', phase, t, ... }
    this.deflecting = false; // true while the barrage swings; FireballProjectile asks tryDeflect()
    this.deflectSeen = new WeakSet();
    this.strafeDir = rng && !rng.chance(0.5) ? -1 : 1;
    this.strafeT = rng ? rng.range(2, 4) : 3;
    this.swingA = rand(0, TAU);
    this.lockT = 0; // short pause after a leap or a finished skill
    this.hopT = 0;
    this.flash = 0;
    this.deathT = 0;
    this.dmgInstances = 0; // damage events taken; a kill on the first one is a one-shot kill
    this.killer = null;
    this.killSent = false;
    this.oneShot = false;
  }

  get hpFrac() {
    return this.vitals.hp / this.vitals.maxHp;
  }
  get staminaFrac() {
    return this.stamina / GRAUGR.maxStamina;
  }
  applyImpulse(x, y) {
    this.knock.x += x;
    this.knock.y += y;
  }

  // --- damage in (sim only: the flash is view state, set by HitEffects / BurnFx) ------------
  onHit(e) {
    if (this.downed) return;
    const k = e.aoe ? 40 : 60 + 140 * e.charge;
    this.knock.x += e.dir.x * k;
    this.knock.y += e.dir.y * k;
    this.hurt(e.damage, e.source);
  }
  onDot(e) {
    if (this.downed) return;
    this.hurt(e.damage, e.source);
  }
  hurt(damage, source) {
    this.dmgInstances++;
    this.vitals.damage(damage);
    if (this.vitals.dead) {
      this.oneShot = this.dmgInstances === 1;
      this.killer = source;
      this.downed = true;
      this.hittable = false;
      this.solid = false;
      this.burn = null;
      this.act = null;
      this.deflecting = false;
    }
  }

  /** Called by FireballProjectile while the barrage spins. 40% of projectiles that reach the arms are batted away. */
  tryDeflect(proj, world) {
    if (!this.deflecting || this.downed) return false;
    const B = GRAUGR.barrage;
    if (Math.hypot(proj.x - this.x, proj.y - this.y) - proj.radius > this.radius + B.reach) return false;
    if (this.deflectSeen.has(proj)) return false; // one roll per projectile
    this.deflectSeen.add(proj);
    if (!world.rng.chance(B.deflect)) return false;
    const a = Math.atan2(proj.y - this.y, proj.x - this.x) + world.rng.range(-0.5, 0.5),
      sp = Math.hypot(proj.vx, proj.vy);
    proj.vx = Math.cos(a) * sp;
    proj.vy = Math.sin(a) * sp;
    proj.owner = this; // it flies back as Graugr's shot
    proj.travelled = 0;
    world.damageNumbers.spawn(this.x, this.y - this.height - 8, "DEFLECT", { color: "#9fe3ff" });
    const P = world.particles;
    P.emit({ shape: "ring", x: proj.x, y: proj.y, z: proj.z, life: 0.3, size: 6, sizeEnd: 46, color: [170, 230, 255] });
    for (let i = 0; i < n(14); i++) {
      const s = rand(160, 420);
      P.emit({ x: proj.x, y: proj.y, z: proj.z, vx: Math.cos(a + rand(-1, 1)) * s, vy: Math.sin(a + rand(-1, 1)) * s, vz: rand(40, 220),
        life: rand(0.3, 0.7), size: rand(1.2, 2.6), sizeEnd: 0.3, color: [200, 240, 255], colorEnd: [90, 150, 255], shape: "spark", stretch: 0.025 });
    }
    return true;
  }

  // --- damage out --------------------------------------------------------
  strike(world, target, damage, { dx, dy, charge, aoe = false, stun = null }) {
    world.events.emit("hit", {
      source: this,
      target,
      damage: Math.max(1, Math.round(damage * this.power)),
      crit: false,
      dir: { x: dx, y: dy },
      charge,
      x: target.x,
      y: target.y,
      z: target.height * 0.55,
      aoe,
      stun,
    });
  }

  // --- AI ----------------------------------------------------------------
  pickMode(hpF, stF) {
    const G = GRAUGR;
    if (hpF < G.retreatHp && stF < G.retreatStamina) return "retreat";
    if (this.mode === "retreat" && stF <= G.attackStamina) return "retreat"; // keep running until it can fight again
    if (stF <= G.buyStamina) return "buy";
    if (hpF > G.attackHp && stF > G.attackStamina) return "attack";
    return "buy"; // HP 40-50%, or stamina in the thin 30-31% band
  }

  steer(ux, uy, speed) {
    const l = Math.hypot(ux, uy) || 1;
    this.want.x = ux / l;
    this.want.y = uy / l;
    this.want.speed = speed;
  }

  think(dt, world, p) {
    const G = GRAUGR;
    this.mode = this.pickMode(this.hpFrac, this.staminaFrac);
    if (p.downed) return;
    const dx = p.x - this.x,
      dy = p.y - this.y,
      d = Math.hypot(dx, dy) || 1,
      ux = dx / d,
      uy = dy / d,
      edge = d - this.radius - p.radius;
    this.aim = Math.atan2(dy, dx);
    const canLeap = this.cd.leap <= 0 && this.stamina >= G.leap.cost;
    if (canLeap && this.dodge(world)) return;

    if (this.mode === "attack") {
      if (this.cd.barrage <= 0 && this.stamina >= G.barrage.cost && edge <= G.barrage.reach) return this.startBarrage();
      if (this.cd.poke <= 0 && this.stamina >= G.poke.cost && edge <= G.poke.length * 0.85) return this.startPoke();
      // leap in when it is far enough to matter and the leap still leaves it above the attack threshold
      if (canLeap && (this.stamina - G.leap.cost) / G.maxStamina > G.attackStamina && edge > 90 && edge <= G.leap.distance)
        return this.leap(world, ux, uy);
      this.steer(ux, uy, edge > 24 ? G.walkSpeed : 0);
    } else if (this.mode === "buy") {
      if (canLeap && edge < 80) return this.leap(world, -ux, -uy); // escape
      this.strafeT -= dt;
      if (this.strafeT <= 0) {
        this.strafeDir = -this.strafeDir;
        this.strafeT = world.rng.range(2, 4);
      }
      const rad = edge < G.buyDistance - 40 ? -1 : edge > G.buyDistance + 80 ? 0.7 : 0;
      this.steer(ux * rad - uy * this.strafeDir * 0.7, uy * rad + ux * this.strafeDir * 0.7, G.buySpeed);
    } else {
      this.steer(-ux, -uy, edge < 900 ? G.retreatSpeed : 0);
    }
  }

  /** Leap sideways out of the line of a fireball that is about to arrive. Returns true if it leapt. */
  dodge(world) {
    for (const e of world.entities) {
      if (!e.isProjectile || e.dead || e.owner === this || e.owner?.isGraugr) continue;
      const rx = this.x - e.x,
        ry = this.y - e.y,
        sp = Math.hypot(e.vx, e.vy) || 1,
        vx = e.vx / sp,
        vy = e.vy / sp,
        along = rx * vx + ry * vy,
        side = rx * vy - ry * vx;
      if (along <= 0 || along > 360 || along / sp > 0.42) continue; // behind it, too far, or not imminent
      if (Math.abs(side) > e.radius + this.radius + 16) continue; // will miss anyway
      const s = side === 0 ? (world.rng.chance(0.5) ? 1 : -1) : side > 0 ? -1 : 1;
      this.leap(world, -vy * s, vx * s);
      return true;
    }
    return false;
  }

  // --- skills ------------------------------------------------------------
  startBarrage() {
    const B = GRAUGR.barrage;
    this.stamina -= B.cost;
    this.cd.barrage = B.cooldown;
    this.act = { type: "barrage", phase: "windup", t: 0, tick: 0 };
  }

  startPoke() {
    const K = GRAUGR.poke;
    this.stamina -= K.cost;
    this.cd.poke = K.cooldown;
    this.act = { type: "poke", phase: "charge", t: 0, ang: this.aim, locked: false };
  }

  runAct(dt, world, p) {
    const G = GRAUGR,
      a = this.act;
    a.t += dt;
    if (a.type === "barrage") {
      const B = G.barrage;
      let dx = 0,
        dy = 0,
        d = 1;
      if (!p.downed) {
        dx = p.x - this.x;
        dy = p.y - this.y;
        d = Math.hypot(dx, dy) || 1;
        this.aim = Math.atan2(dy, dx);
      }
      if (a.phase === "windup") {
        if (a.t >= B.windup) {
          a.phase = "swing";
          a.t = 0;
          a.tick = 0;
          this.deflecting = true;
        }
        return;
      }
      this.swingA += dt * B.spin;
      a.tick -= dt;
      if (a.tick <= 0) {
        a.tick += B.tick;
        this.swingHit(world, p);
      }
      if (!p.downed) this.steer(dx / d, dy / d, d - this.radius - p.radius > 10 ? G.walkSpeed * B.moveMult : 0);
      if (a.t >= B.duration || p.downed) {
        this.act = null;
        this.deflecting = false;
        this.lockT = 0.4;
      }
      return;
    }
    // poke: stands still the whole time
    const K = G.poke;
    if (a.phase === "charge") {
      if (!a.locked) {
        if (!p.downed) a.ang = Math.atan2(p.y - this.y, p.x - this.x);
        if (a.t >= K.charge * K.lockAt) a.locked = true; // aim freezes so a sidestep works
      }
      this.aim = a.ang;
      if (a.t >= K.charge) {
        a.phase = "strike";
        a.t = 0;
        this.pokeHit(world, p, a.ang);
      }
    } else if (a.phase === "strike") {
      if (a.t >= K.strike) {
        a.phase = "recover";
        a.t = 0;
      }
    } else if (a.t >= K.recover) this.act = null;
  }

  swingHit(world, p) {
    if (p.downed || !p.hittable) return;
    const dx = p.x - this.x,
      dy = p.y - this.y,
      d = Math.hypot(dx, dy) || 1;
    if (d - p.radius > this.radius + GRAUGR.barrage.reach) return;
    this.strike(world, p, GRAUGR.barrage.damage, { dx: dx / d, dy: dy / d, charge: 0.2, aoe: true }); // aoe: no hit-stop spam on repeated ticks
  }

  pokeHit(world, p, ang) {
    if (p.downed || !p.hittable) return;
    const K = GRAUGR.poke,
      c = Math.cos(ang),
      s = Math.sin(ang),
      rx = p.x - this.x,
      ry = p.y - this.y,
      along = rx * c + ry * s,
      side = Math.abs(-rx * s + ry * c);
    if (along < 0 || along > K.length + p.radius || side > K.half + p.radius) return;
    this.strike(world, p, K.damage, { dx: c, dy: s, charge: 0.9 });
  }

  /** Instant dash. A body in the path takes damage and a stun; the dash stops at its edge. */
  leap(world, dx, dy) {
    const L = GRAUGR.leap,
      len = Math.hypot(dx, dy) || 1,
      p = world.player;
    dx /= len;
    dy /= len;
    let travel = L.distance,
      hit = false;
    if (!p.downed && p.hittable) {
      const rx = p.x - this.x,
        ry = p.y - this.y,
        along = rx * dx + ry * dy,
        side = Math.abs(rx * dy - ry * dx),
        r = this.radius + p.radius;
      if (along > 0 && along - r <= L.distance && side <= r + 6) {
        hit = true;
        travel = clamp(along - r - 2, 0, L.distance);
      }
    }
    const sx = this.x,
      sy = this.y;
    this.x += dx * travel;
    this.y += dy * travel;
    this.stamina -= L.cost;
    this.cd.leap = L.cooldown;
    this.aim = Math.atan2(dy, dx);
    this.hopT = HOP;
    this.lockT = 0.15;
    this.vx = 0;
    this.vy = 0;
    this.leapFx(world, sx, sy, dx, dy, travel);
    if (hit) this.strike(world, p, L.damage, { dx, dy, charge: 0.5, stun: { duration: L.stun } });
  }

  leapFx(world, sx, sy, dx, dy, travel) {
    const P = world.particles,
      cnt = n(Math.max(3, Math.ceil(travel / 22)));
    for (let i = 0; i < cnt; i++) {
      const f = i / cnt;
      P.emit({ x: sx + dx * travel * f, y: sy + dy * travel * f, z: rand(4, 40), vx: rand(-30, 30), vy: rand(-30, 30), vz: rand(10, 60),
        gravity: -30, drag: 2, life: rand(0.25, 0.5), size: rand(5, 9), sizeEnd: 1, color: [170, 190, 150], alpha: 0.5, additive: false });
    }
    P.emit({ shape: "ring", x: sx, y: sy, z: 0, life: 0.35, size: 6, sizeEnd: 60, color: [190, 230, 170] });
    P.emit({ shape: "ring", x: this.x, y: this.y, z: 0, life: 0.35, size: 6, sizeEnd: 70, color: [190, 230, 170] });
  }

  // --- frame -------------------------------------------------------------
  update(dt, world) {
    this.flash = Math.max(0, this.flash - dt * 5);
    if (this.downed) {
      this.want.speed = 0;
      if (!this.killSent) {
        this.killSent = true;
        this.deathFx(world);
        world.events.emit("kill", { target: this, source: this.killer, oneShot: this.oneShot, tier: this.tier });
      }
      this.deathT += dt;
      if (this.deathT >= DEATH_FADE) this.dead = true;
      this.move(dt, world);
      return;
    }
    const G = GRAUGR;
    this.vitals.update(dt);
    this.stamina = Math.min(G.maxStamina, this.stamina + G.staminaRegen * dt);
    this.cd.barrage = Math.max(0, this.cd.barrage - dt);
    this.cd.poke = Math.max(0, this.cd.poke - dt);
    this.cd.leap = Math.max(0, this.cd.leap - dt);
    this.hopT = Math.max(0, this.hopT - dt);
    this.lockT = Math.max(0, this.lockT - dt);
    this.want.speed = 0;
    if (this.stunT > 0) {
      this.act = null;
      this.deflecting = false;
    } else if (this.act) this.runAct(dt, world, world.player);
    else if (this.lockT <= 0) this.think(dt, world, world.player);
    this.move(dt, world);
  }

  move(dt, world) {
    const w = this.want,
      k = 1 - Math.exp(-8 * dt),
      kd = Math.exp(-7 * dt);
    this.vx += (w.x * w.speed - this.vx) * k;
    this.vy += (w.y * w.speed - this.vy) * k;
    this.knock.x *= kd;
    this.knock.y *= kd;
    this.x += (this.vx + this.knock.x) * dt;
    this.y += (this.vy + this.knock.y) * dt;
    for (const e of world.entities) {
      // keep Graugrs from stacking on each other
      if (e === this || !e.isGraugr || e.dead || e.downed) continue;
      const dx = this.x - e.x,
        dy = this.y - e.y,
        d = Math.hypot(dx, dy) || 0.001,
        min = this.radius + e.radius;
      if (d < min) {
        const push = (min - d) * 0.5;
        this.x += (dx / d) * push;
        this.y += (dy / d) * push;
      }
    }
  }

  deathFx(world) {
    const P = world.particles;
    P.emit({ shape: "ring", x: this.x, y: this.y, z: 0, life: 0.6, size: 10, sizeEnd: 110, color: [190, 230, 170] });
    for (let i = 0; i < n(22); i++) {
      const a = rand(0, TAU),
        s = rand(80, 320);
      P.emit({ x: this.x, y: this.y, z: rand(10, this.height), vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6, vz: rand(100, 380),
        life: rand(0.5, 1.1), size: rand(2, 5), sizeEnd: 0.5, color: [170, 200, 140], colorEnd: [60, 80, 50], shape: "dot" });
    }
  }

  // --- drawing -----------------------------------------------------------
  /** Thick rounded limb with a fist. */
  limb(ctx, sx, sy, ex, ey, w, glow = 0) {
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(20,28,18,.9)";
    ctx.lineWidth = w + 3;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.strokeStyle = glow > 0 ? `rgb(${(130 + 110 * glow) | 0},${(150 - 60 * glow) | 0},${(110 - 60 * glow) | 0})` : "#829a6e";
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.fillStyle = "#6f865d";
    ctx.beginPath();
    ctx.arc(ex, ey, w * 0.85, 0, TAU);
    ctx.fill();
  }

  drawTelegraphs(ctx, t) {
    const G = GRAUGR,
      a = this.act;
    if (!a) return;
    ctx.save();
    if (a.type === "barrage") {
      const R = this.radius + G.barrage.reach;
      if (a.phase === "windup") {
        const f = a.t / G.barrage.windup;
        ctx.fillStyle = `rgba(255,60,40,${0.1 + 0.22 * f})`;
        ctx.strokeStyle = `rgba(255,90,60,${0.5 + 0.5 * f})`;
        ctx.lineWidth = 2 + 2 * f;
        ctx.beginPath();
        ctx.ellipse(this.x, this.y, R, R * 0.5, 0, 0, TAU);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = "rgba(255,200,170,.8)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(this.x, this.y, R * f, R * f * 0.5, 0, 0, TAU);
        ctx.stroke();
      } else {
        ctx.strokeStyle = `rgba(255,120,80,${0.25 + 0.1 * Math.sin(t * 10)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(this.x, this.y, R, R * 0.5, 0, 0, TAU);
        ctx.stroke();
      }
    } else if (a.phase === "charge") {
      const K = G.poke,
        f = a.t / K.charge,
        c = Math.cos(a.ang),
        s = Math.sin(a.ang),
        px = -s * K.half,
        py = c * K.half,
        L = K.length;
      ctx.fillStyle = `rgba(255,50,40,${0.06 + 0.12 * f})`;
      ctx.strokeStyle = a.locked ? "rgba(255,255,255,.95)" : `rgba(255,90,60,${0.45 + 0.3 * f})`;
      ctx.lineWidth = a.locked ? 3 : 2;
      ctx.beginPath();
      ctx.moveTo(this.x + px, this.y + py);
      ctx.lineTo(this.x + c * L + px, this.y + s * L + py);
      ctx.lineTo(this.x + c * L - px, this.y + s * L - py);
      ctx.lineTo(this.x - px, this.y - py);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      const g = ctx.createLinearGradient(this.x, this.y, this.x + c * L, this.y + s * L); // fill grows toward the tip as the charge builds
      g.addColorStop(0, "rgba(255,70,50,.55)");
      g.addColorStop(Math.max(0.001, f), "rgba(255,70,50,.4)");
      g.addColorStop(Math.min(1, f + 0.001), "rgba(255,70,50,0)");
      ctx.fillStyle = g;
      ctx.fill();
    }
    ctx.restore();
  }

  draw(ctx, world) {
    const G = GRAUGR,
      t = performance.now() / 1000,
      a = this.act,
      hop = this.hopT > 0 ? Math.sin((1 - this.hopT / HOP) * Math.PI) * 34 : 0,
      c = Math.cos(this.aim),
      s = Math.sin(this.aim);
    ctx.globalAlpha = this.downed ? Math.max(0, 1 - this.deathT / DEATH_FADE) : 1;
    this.drawTelegraphs(ctx, t);
    ctx.save();
    ctx.translate(0, -hop);
    const top = drawCylinder(ctx, {
      x: this.x,
      y: this.y,
      r: this.radius,
      h: this.height,
      color: [104, 124, 88],
      flash: this.flash,
      lean: [this.vx * 0.03, this.vy * 0.015],
    });
    // face marker
    ctx.fillStyle = "#ffd98a";
    ctx.beginPath();
    ctx.arc(top.tx + c * this.radius * 0.6, top.ty + s * top.ry * 0.6, 3, 0, TAU);
    ctx.fill();

    // arms
    const shoulder = (k) => {
      const pa = this.aim + (k * Math.PI) / 2;
      return { x: top.tx + Math.cos(pa) * this.radius * 0.9, y: top.ty + Math.sin(pa) * top.ry * 0.9 + 10 };
    };
    const fists = [];
    if (a?.type === "barrage" && a.phase === "swing") {
      const R = this.radius + G.barrage.reach;
      for (let k = 0; k < 2; k++) {
        const th = this.swingA + k * Math.PI,
          sh = shoulder(k ? 1 : -1);
        ctx.strokeStyle = "rgba(255,200,160,.28)"; // motion arc behind the fist
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.ellipse(top.tx, top.ty + 14, R, R * 0.5, 0, th - 1.0, th);
        ctx.stroke();
        fists.push([sh, top.tx + Math.cos(th) * R, top.ty + 14 + Math.sin(th) * R * 0.5, 11, 0.4]);
      }
    } else if (a?.type === "poke" && a.phase !== "charge") {
      const K = G.poke,
        ext = a.phase === "strike" ? Math.min(1, a.t / (K.strike * 0.35)) : 1 - Math.min(1, a.t / K.recover),
        sh = shoulder(1);
      fists.push([sh, sh.x + Math.cos(a.ang) * K.length * ext, sh.y + Math.sin(a.ang) * K.length * ext, 12, 1]);
      fists.push([shoulder(-1), ...this.restFist(shoulder(-1), top)]);
    } else {
      let pull = 0,
        glow = 0;
      if (a?.type === "poke") {
        glow = a.t / G.poke.charge;
        pull = 10 + 4 * glow;
      }
      const sh1 = shoulder(1),
        poking = a?.type === "poke"; // charging: fist pulled back along the aim; otherwise it hangs
      fists.push([sh1, sh1.x - (poking ? Math.cos(a.ang) * pull : 0), sh1.y - (poking ? Math.sin(a.ang) * pull : -22), 11, glow]);
      fists.push([shoulder(-1), ...this.restFist(shoulder(-1), top)]);
      if (a?.type === "poke") {
        ctx.globalCompositeOperation = "lighter";
        drawGlow(ctx, fists[0][1], fists[0][2], 24 + 40 * glow, [255, 80, 50], 0.35 + 0.5 * glow);
        ctx.globalCompositeOperation = "source-over";
      }
    }
    for (const [sh, ex, ey, w, g] of fists) this.limb(ctx, sh.x, sh.y, ex, ey, w, g);
    if (a?.type === "poke" && a.phase === "strike") {
      ctx.globalCompositeOperation = "lighter";
      const f = fists[0];
      drawGlow(ctx, f[1], f[2], 70, [255, 90, 60], 0.9);
      ctx.globalCompositeOperation = "source-over";
    }
    if (this.stunT > 0) drawStun(ctx, top.tx, top.ty, t);
    ctx.restore();

    // name, enhancement, bars
    const v = this.vitals;
    drawEnhance(ctx, this.x, top.ty - 58, this.tier);
    ctx.textAlign = "center";
    ctx.font = "bold 12px Georgia, serif";
    ctx.fillStyle = "#eadfc8";
    ctx.fillText("GRAUGR", this.x, top.ty - 38);
    drawBar(ctx, this.x - 30, top.ty - 32, 60, 6, v.hp / v.maxHp, "#d93b3b");
    drawBar(ctx, this.x - 30, top.ty - 24, 60, 5, this.stamina / G.maxStamina, "#e6c84a");
    if (Settings.get("showDebug")) {
      ctx.font = "10px Consolas, monospace";
      ctx.fillStyle = "#9fe3ff";
      ctx.fillText(`${this.mode}${a ? " · " + a.type + " " + a.phase : ""}`, this.x, top.ty - 12);
    }
    ctx.globalAlpha = 1;
  }

  /** Where the idle arm hangs. */
  restFist(sh, top) {
    return [sh.x + (sh.x - top.tx) * 0.25, sh.y + 22, 11, 0];
  }
}
