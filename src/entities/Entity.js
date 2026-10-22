/**
 * Base world object. Position (x,y) is on the ground plane; z is height above it.
 * Screen y = y - z, which is how the fake-3D / real-gravity look works.
 *
 * Optional members the world looks for:
 *   hittable = true       -> projectiles can damage it
 *   solid    = true       -> blocks the player
 *   onHit(e: HitEvent, world) -> SIM reaction to damage (health, knock, status), called by DamageSystem (see src/types.js).
 *                                No flash, glow or sound in it: HitEffects and BurnFx derive those from the same event
 *   damageColor           -> colour of damage numbers it receives
 *   onDot(e, world)       -> sim reaction to damage over time (burn tick): { damage, kind, source }
 *   flash (0..1), glow    -> view-only fields, written by HitEffects / BurnFx and drawn by the entity
 *
 * Status slots the world looks for (null when absent):
 *   burn  -> running burn, owned by StatusSystem
 *   ward  -> active BurnWardEffect (Burn Resistance)
 *   stunT -> seconds of stun left (0 = none); counted down by StatusSystem, honoured by Player and Graugr
 */
export class Entity {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.z = 0;
    this.radius = 12;
    this.height = 40;
    this.dead = false;
    this.hittable = false;
    this.solid = false;
    this.burn = null;
    this.ward = null;
    this.stunT = 0;
  }
  update(dt, world) {}
  draw(ctx, world) {}
}
