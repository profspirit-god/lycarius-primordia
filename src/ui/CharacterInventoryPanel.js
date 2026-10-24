// In-game Character Inventory panel (L2 phase E, MVP): the DOM shell around CharacterInventoryView. CLIENT ONLY.
// Opened with I (WorldScene), pauses the game like the character panel, closed with I, Esc or the X.
// It reads the ONE client Inventory service (`world.game.inventory`) for the world's character (`world.classId`) and shows it.
// Writes, all through a service so every rule still applies: using a stat ticket (StatTraining.use, which takes the ticket out of
// the inventory and raises the stat), and the debug gold buttons (shown while Settings "Show debug" is on: grant / remove).
import { Settings } from "../core/Settings.js";
import { GOLD_ID } from "../sim/items/gameplay.js";
import { characterInventoryModel, characterInventoryHtml } from "./CharacterInventoryView.js";
import { icon } from "./icons.js";

const REASON_TEXT = {
  inventory_full: "Inventory full: no free slot for that much gold.",
  not_enough: "Not enough gold.",
  read_only: "This inventory was saved by a newer version and cannot be changed.",
  maxed: "That stat is already at its limit.",
  not_a_ticket: "That item cannot be used.",
};

export class CharacterInventoryPanel {
  /** @param {{ ui: HTMLElement, game: { inventory?: any }, training?: any, player?: any, classId: string, closeInventory: () => void }} world the WorldScene */
  constructor(world) {
    this.world = world;
    this.message = "";
    this.selected = null; // an item id, or null
    this.el = document.createElement("div");
    this.el.className = "panel profile ci-panel";
    this.el.style.display = "none";
    this.el.addEventListener("click", (e) => {
      const t = e.target.closest("[data-a]"); // closest: the click may land on the icon inside the button
      if (!t) return;
      const a = t.dataset.a;
      if (a === "ci-close") world.closeInventory();
      else if (a === "ci-select") { this.selected = this.selected === t.dataset.id ? null : t.dataset.id; this.message = ""; this.render(); }
      else if (a === "ci-use") this.useTicket(t.dataset.id);
      else if (a === "ci-grant" || a === "ci-spend") this.devGold(a === "ci-grant", Number(t.dataset.n));
    });
    world.ui.appendChild(this.el);
  }
  get isOpen() {
    return this.el.style.display !== "none";
  }
  open() {
    this.message = "";
    this.selected = null;
    this.render();
    this.el.style.display = "";
  }
  close() {
    this.el.style.display = "none";
  }

  /** Use one stat ticket: the ticket goes, the stat rises for good, and the player's stats are recomputed. */
  useTicket(itemId) {
    const w = this.world, inv = w.game.inventory;
    if (!inv || !w.training || !w.player) return;
    const r = w.training.use(inv, w.classId, itemId);
    if (r.ok) {
      w.player.setTraining(w.training.bonus(w.classId));
      this.message = `Stat raised (${r.count} / ${r.cap} used).`;
      if (!inv.owns(itemId, w.classId)) this.selected = null; // the last one was used
    } else this.message = REASON_TEXT[r.reason] ?? `Not possible (${r.reason}).`;
    this.render();
  }

  /** Debug only: add or spend gold through the service, so every rule (capacity, not enough, read only) still applies. */
  devGold(add, n) {
    const inv = this.world.game.inventory;
    if (!Settings.get("showDebug") || !inv) return;
    const r = add ? inv.grant(GOLD_ID, n, this.world.classId) : inv.remove(GOLD_ID, n, this.world.classId);
    this.message = r.ok ? `${add ? "Added" : "Spent"} ${n} gold.` : REASON_TEXT[r.reason] ?? `Not possible (${r.reason}).`;
    this.render();
  }

  render() {
    const m = characterInventoryModel(this.world.game.inventory, this.world.classId, this.world.training);
    this.el.innerHTML = `
      <button class="pr-x" data-a="ci-close" aria-label="Close">${icon("close")}</button>
      <h2 class="modal-title" style="margin-top:0">INVENTORY</h2>
      ${characterInventoryHtml(m, { dev: !!Settings.get("showDebug"), message: this.message, selected: this.selected })}
      <div class="pr-foot">I or Esc to close</div>`;
  }
}
