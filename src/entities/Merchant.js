import { Entity } from "./Entity.js";
import { JOHN } from "../sim/shop/john.js";

/**
 * A merchant NPC (today only John, sim/shop/john.js). Stands still, cannot be hit, blocks the player like a post. Everything he
 * sells is in his shop data; this is only the body and the "is the buyer close enough" rule. His look is a view (view/MerchantView.js,
 * kind "merchant"); this class never draws.
 * Replicated fields: x y kind id name.
 */
export class Merchant extends Entity {
  constructor(x, y, def = JOHN) {
    super();
    this.x = x;
    this.y = y;
    this.kind = "merchant";
    this.isMerchant = true;
    this.id = def.id;
    this.name = def.name;
    this.tradeRange = def.tradeRange;
    this.radius = 15;
    this.height = 44;
    this.solid = true;
    this.hittable = false; // fireballs pass through: nobody shoots the shopkeeper
  }

  /** Close enough to talk, edge to edge. A downed player cannot trade. */
  canTrade(p) {
    return !!p && !p.downed && Math.hypot(p.x - this.x, p.y - this.y) <= this.radius + (p.radius ?? 0) + this.tradeRange;
  }
}
