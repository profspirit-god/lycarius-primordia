// How a merchant NPC looks (S1f view, client only): a robed cylinder, the name over his head, and "Press T to trade" when the
// player is close enough. Reads sim state (position, `canTrade`), never writes it. Registered under kind "merchant" in view/index.js.
import { drawCylinder } from "../render/drawCylinder.js";

const COLOR = [176, 132, 62]; // a gold-brown coat
const NAME_COLOR = "#f2c46d";

export class MerchantView {
  constructor(world) {
    this.world = world;
    this.t = 0;
  }
  tick(e, dt) {
    this.t += dt;
  }
  draw(ctx, e) {
    const bob = Math.sin(this.t * 2) * 0.8; // a slow breath so he does not look like a post
    const top = drawCylinder(ctx, { x: e.x, y: e.y, r: e.radius, h: e.height + bob, color: COLOR });
    ctx.fillStyle = "#f1d8b0"; // face marker, toward the player's side of the world (down-screen)
    ctx.beginPath();
    ctx.arc(top.tx, top.ty + 2, e.radius * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.textAlign = "center";
    ctx.font = "bold 13px Georgia, serif";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(0,0,0,.85)";
    ctx.strokeText(e.name, e.x, top.ty - 18);
    ctx.fillStyle = NAME_COLOR;
    ctx.fillText(e.name, e.x, top.ty - 18);
    if (e.canTrade(this.world.player)) {
      ctx.font = "12px Georgia, serif";
      ctx.strokeText("Press T to trade", e.x, top.ty - 4);
      ctx.fillStyle = "#eadfc8";
      ctx.fillText("Press T to trade", e.x, top.ty - 4);
    }
  }
  dispose() {}
}
