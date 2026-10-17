/**
 * Base world object. Position (x,y) is on the ground plane; z is height above it.
 * Screen y = y - z, which is how the fake-3D / real-gravity look works.
 *
 * Optional members the world looks for:
 *   hittable = true       -> projectiles can damage it
 *   solid    = true       -> blocks the player
 *   onHit(e: HitEvent)    -> reaction to damage (see src/types.js)
 *   damageColor           -> colour of damage numbers it receives
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
  }
  update(dt, world) {}
  draw(ctx, world) {}
}
