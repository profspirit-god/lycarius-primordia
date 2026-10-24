// John the Merchant's shop panel (DOM shell around MerchantShopView). CLIENT ONLY. Opened with T next to John (WorldScene), pauses
// the game, closed with T, Esc or the X. A sale is `buy()` from sim/shop/john.js: gold out and ticket in, in one step.
import { buy } from "../sim/shop/john.js";
import { merchantModel, merchantHtml } from "./MerchantShopView.js";
import { icon } from "./icons.js";

const REASON_TEXT = {
  not_enough: "Not enough gold.",
  inventory_full: "Your inventory is full.",
  at_cap: "You already have all the tickets this stat can use.",
  too_far: "Step closer to John.",
  read_only: "This inventory was saved by a newer version and cannot be changed.",
};

export class MerchantPanel {
  /** @param {{ ui: HTMLElement, game: { inventory?: any }, training?: any, player?: any, merchant?: any, classId: string, closeMerchant: () => void }} world the WorldScene */
  constructor(world) {
    this.world = world;
    this.message = "";
    this.el = document.createElement("div");
    this.el.className = "panel profile ms-panel";
    this.el.style.display = "none";
    this.el.addEventListener("click", (e) => {
      const t = e.target.closest("[data-a]");
      if (!t) return;
      if (t.dataset.a === "ms-close") world.closeMerchant();
      else if (t.dataset.a === "shop-buy") this.buy(t.dataset.id);
    });
    world.ui.appendChild(this.el);
  }
  get isOpen() {
    return this.el.style.display !== "none";
  }
  open() {
    this.message = "";
    this.render();
    this.el.style.display = "";
  }
  close() {
    this.el.style.display = "none";
  }

  near() {
    const w = this.world;
    return !!w.merchant?.canTrade(w.player);
  }

  buy(offerId) {
    const w = this.world, inv = w.game.inventory;
    if (!inv || !w.training) return;
    const r = buy(inv, w.training, w.classId, offerId, { near: this.near() });
    this.message = r.ok ? `Bought ${r.offer.id.replace(/^ticket_/, "").replace(/_/g, " ")} ticket for ${r.price} gold.` : REASON_TEXT[r.reason] ?? `Not possible (${r.reason}).`;
    this.render();
  }

  render() {
    const w = this.world;
    this.el.innerHTML = `
      <button class="pr-x" data-a="ms-close" aria-label="Close">${icon("close")}</button>
      <h2 class="modal-title" style="margin-top:0">JOHN THE MERCHANT</h2>
      ${merchantHtml(merchantModel(w.game.inventory, w.training, w.classId, this.near()), { message: this.message })}
      <div class="pr-foot">T or Esc to close</div>`;
  }
}
