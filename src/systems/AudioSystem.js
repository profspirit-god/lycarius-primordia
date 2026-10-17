import { GameAudio } from "../audio/AudioEngine.js";
import { clamp } from "../core/math.js";

/**
 * Bridges game events to sounds. Combat code never calls audio directly,
 * it just emits events ('hit', 'cast') and flips state (charging, downed, lowManaFlash).
 */
export class AudioSystem {
  constructor(world) {
    this.world = world;
    this.voices = new Map(); // caster owner -> charge voice
    this.prev = new Map(); // owner -> last frame state for edge detection
    this.offs = [
      world.events.on("hit", (e) => this.onHit(e)),
      world.events.on("cast", (e) => this.onCast(e)),
      world.events.on("shield", (e) => this.onShield(e)),
      world.events.on("burn", (e) => this.onBurn(e)),
      world.events.on("ward", (e) => this.onWard(e)),
    ];
  }

  /** Distance volume + stereo pan relative to the listener (the player). */
  spatial(x, y) {
    const p = this.world.player,
      dx = x - p.x,
      dy = y - p.y,
      d = Math.hypot(dx, dy);
    return {
      pan: clamp(dx / 700, -1, 1) * 0.8,
      vol: clamp(1 - d / 1100, 0.12, 1),
    };
  }

  onHit(e) {
    const s = this.spatial(e.target.x, e.target.y);
    if (e.target === this.world.player) GameAudio.hurt(e.charge, s.pan, s.vol);
    else GameAudio.impact(e.charge, e.crit, s.pan, s.vol);
  }
  onCast(e) {
    const s = this.spatial(e.owner.x, e.owner.y);
    GameAudio.cast(e.charge, s.pan, s.vol);
  }

  /** 'shield' events: type is 'up' | 'hit' | 'break' | 'down'. */
  onShield(e) {
    const s = this.spatial(e.x, e.y);
    if (e.type === "up") GameAudio.shieldUp(s.pan, s.vol);
    else if (e.type === "hit") GameAudio.shieldHit(s.pan, s.vol);
    else if (e.type === "break") GameAudio.shieldBreak(s.pan, s.vol);
    else GameAudio.shieldDown(s.pan, s.vol);
  }

  /** 'burn' events: type is 'ignite' | 'tick' | 'nullify' | 'end' (silent). */
  onBurn(e) {
    const s = this.spatial(e.x, e.y);
    if (e.type === "ignite") GameAudio.burnIgnite(s.pan, s.vol);
    else if (e.type === "tick") GameAudio.burnTick(s.pan, s.vol);
    else if (e.type === "nullify") GameAudio.burnNullify(s.pan, s.vol);
  }

  /** 'ward' events: 'up', or 'down' with a reason. A spent ward is covered by the nullify sound. */
  onWard(e) {
    const s = this.spatial(e.x, e.y);
    if (e.type === "up") GameAudio.wardUp(s.pan, s.vol);
    else if (e.reason !== "spent") GameAudio.wardDown(s.pan, s.vol);
  }

  casters() {
    const w = this.world;
    return w.dummy.attack ? [w.player, w.dummy] : [w.player];
  }

  update() {
    for (const o of this.casters()) {
      const c = o.caster,
        s = this.spatial(o.x, o.y);
      let v = this.voices.get(o);
      if (c.charging) {
        if (!v) {
          v = GameAudio.chargeVoice();
          if (v) this.voices.set(o, v);
        }
        v?.update(c.chargeLevel, s.pan, s.vol);
      } else if (v) {
        v.stop();
        this.voices.delete(o);
      }

      const st = this.prev.get(o) ?? { low: 0, downed: false };
      if (o.lowManaFlash > 0.35 && st.low <= 0.35)
        GameAudio.lowMana(s.pan, s.vol);
      if (o.downed && !st.downed) GameAudio.down(s.pan, s.vol);
      if (!o.downed && st.downed) GameAudio.respawn(s.pan, s.vol);
      this.prev.set(o, { low: o.lowManaFlash, downed: o.downed });
    }
  }

  silence() {
    for (const v of this.voices.values()) v.stop();
    this.voices.clear();
  }
  dispose() {
    this.silence();
    this.offs.forEach((off) => off());
  }
}
