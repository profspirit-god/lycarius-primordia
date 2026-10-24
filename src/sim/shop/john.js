// John the Merchant: what he sells, for how much, and the one function that makes a sale. DATA plus one pure rule (Claude.md 5.1).
// Today he sells one thing, stat tickets, for carried gold (the Inventory service's `gold` item, NOT the account Wallet).
// Prices live HERE and nowhere else: a ticket does not know its price (sim/items/tickets.js), a seller sets his own.
// Sim code: no browser, no clock, no randomness (Claude.md 5b). Replicated fields: the offers below (a client may show them).
import { STAT_TICKETS, ticketById } from "../items/tickets.js";
import { GOLD_ID } from "../items/gameplay.js";

export const JOHN = Object.freeze({
  id: "john",
  name: "John the Merchant",
  greeting: "Gold for tickets, friend. Each one makes you a little stronger, for good.",
  /** How close (px, edge to edge) a player must be to trade. */
  tradeRange: 110,
});

/**
 * Gold per ticket. Tuning, one number each: a raid pays 20 + 10 x its number and a Graugr drops 1 to 10 (about 5.5), so raid 1 is
 * worth about 40 gold and raid 5 about 125. Health is the scarcest stat (base 50), speed the rarest (a ticket is +2% of 230).
 * Maxing one stat (10 tickets) costs 10 x its price; maxing all seven costs 10,200.
 */
export const TICKET_PRICES = Object.freeze({
  ticket_max_health: 150,
  ticket_health_regen: 200,
  ticket_max_mana: 100,
  ticket_mana_regen: 120,
  ticket_max_stamina: 100,
  ticket_stamina_regen: 100,
  ticket_move_speed: 250,
});

/** Every offer, in the ticket table's order: `{ id, item, price }`. One per ticket, so no stat is left without one. */
export const OFFERS = Object.freeze(STAT_TICKETS.map((t) => Object.freeze({ id: t.id, item: t.id, price: TICKET_PRICES[t.id] })));
export const offerById = (id) => OFFERS.find((o) => o.id === id) ?? null;

/** Why `buy` changed nothing. Inventory reasons (`not_enough` = not enough gold, `inventory_full`, `read_only`) pass through. */
export const BUY_REASONS = ["unknown_offer", "bad_owner", "too_far", "at_cap", "not_enough", "inventory_full", "read_only", "unknown_item", "bad_quantity", "wrong_scope"];

/**
 * Buy one ticket: price in gold out, the ticket in, in ONE step (`Inventory.exchange`), so a refusal never costs gold or loses a ticket.
 * John does not sell a ticket that could not be used: tickets used plus tickets carried may not pass that stat's cap.
 * @param {import('../items/Inventory.js').Inventory} inv
 * @param {import('../stats/StatTraining.js').StatTraining} training
 * @param {string} ownerId the buying character
 * @param {string} offerId a ticket id
 * @param {{ near?: boolean }} [ctx] `near` = the buyer is within `JOHN.tradeRange` (the world checks it; default true for tests)
 * @returns {{ ok: true, offer: object, price: number } | { ok: false, reason: string }}
 */
export function buy(inv, training, ownerId, offerId, { near = true } = {}) {
  const offer = offerById(offerId), t = ticketById(offerId);
  if (!offer || !t) return { ok: false, reason: "unknown_offer" };
  if (typeof ownerId !== "string") return { ok: false, reason: "bad_owner" };
  if (!near) return { ok: false, reason: "too_far" };
  if (training.count(ownerId, t.stat) + inv.count(offer.item, ownerId) >= t.cap) return { ok: false, reason: "at_cap" };
  const r = inv.exchange(ownerId, [[GOLD_ID, offer.price]], [[offer.item, 1]]);
  return r.ok ? { ok: true, offer, price: offer.price } : r;
}
