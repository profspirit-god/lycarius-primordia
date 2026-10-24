// John the Merchant's shop window (client only): turns the Inventory service, the stat training and John's offers into HTML.
// Pure functions of plain data (no DOM, no storage, no buying): MerchantPanel wires the clicks and calls sim/shop/john.js `buy`.
import { findItem } from "../sim/items/ItemRegistry.js";
import { GOLD_ID } from "../sim/items/gameplay.js";
import { ticketById, gainText } from "../sim/items/tickets.js";
import { JOHN, OFFERS } from "../sim/shop/john.js";
import { RARITY_COLORS } from "./InventoryView.js";
import { icon } from "./icons.js";

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const fmt = (n) => n.toLocaleString("en-US");

/**
 * What the shop shows. Never throws; a missing service is an "unavailable" state.
 * @param {import('../sim/items/Inventory.js').Inventory|null|undefined} inv
 * @param {import('../sim/stats/StatTraining.js').StatTraining|null|undefined} training
 * @param {string} ownerId the buying character
 * @param {boolean} near the buyer is within John's trade range
 */
export function merchantModel(inv, training, ownerId, near) {
  if (!inv || !training) return { status: "unavailable", gold: 0, rows: [], near };
  const gold = inv.count(GOLD_ID, ownerId);
  const rows = OFFERS.map((offer) => {
    const t = ticketById(offer.id), def = findItem(offer.item);
    const used = training.count(ownerId, t.stat), carried = inv.count(offer.item, ownerId);
    return { offer, t, def, used, carried, afford: gold >= offer.price, atCap: used + carried >= t.cap };
  });
  return { status: inv.status, gold, rows, near };
}

const rowHtml = (r, near) => {
  const why = !near ? "Step closer to John." : r.atCap ? "You already have all the tickets this stat can use." : !r.afford ? "Not enough gold." : "";
  const off = !near || r.atCap || !r.afford;
  return `<div class="ms-row" style="--rar:${RARITY_COLORS[r.def.rarity]}">
      <div class="ms-info"><b>${esc(r.def.name)}</b><span>${esc(r.t.label)} ${esc(gainText(r.t))}</span>
        <small>Used ${r.used} / ${r.t.cap}${r.carried ? ` · carrying ${r.carried}` : ""}</small></div>
      <button class="btn sm ms-buy" data-a="shop-buy" data-id="${r.offer.id}"${off ? ` disabled title="${esc(why)}"` : ""}><i>${icon("coin")}</i> ${fmt(r.offer.price)}</button>
    </div>`;
};

/** @param {ReturnType<typeof merchantModel>} m @param {{ message?: string }} [view] */
export function merchantHtml(m, { message = "" } = {}) {
  if (m.status === "unavailable") return `<div class="inv-empty"><b>Shop unavailable</b><div>John cannot trade right now. Restart the game and try again.</div></div>`;
  return `<div class="ms-greet">${esc(JOHN.greeting)}</div>
    <div class="ci-gold"><i>${icon("coin")}</i><span>Your gold</span><small></small><b>${fmt(m.gold)}</b></div>
    <div class="ms-list">${m.rows.map((r) => rowHtml(r, m.near)).join("")}</div>
    <div class="ci-msg ci-main-msg" role="status">${esc(message)}</div>
    <div class="note" style="margin:10px 0 0">Tickets are used from your inventory (press I). Each stat takes at most ${m.rows[0]?.t.cap ?? 10} tickets.</div>`;
}
