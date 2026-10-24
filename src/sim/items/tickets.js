// Stat tickets: consumable items that permanently raise one stat. DATA only (data over code, Claude.md 5.1): one row per stat,
// the item definitions are built from the rows, and sim/stats/StatTraining.js applies them. Prices are NOT here: a seller sets its own
// (sim/shop/john.js). Sim code: no browser, no clock, no randomness (Claude.md 5b).
import { gramsToMg } from "./weight.js";

/**
 * `stat` is a key of the player's stats (classes/Mage.js `stats`). `gain` is added per ticket used, `cap` is the most tickets one
 * character can use on that stat (so a stat cannot grow without limit). `label` / `per` are for display only.
 * Only the stats that exist in the sim get a ticket. The six core attributes (Strength ... Luck) are placeholders in the character panel.
 */
export const STAT_TICKETS = Object.freeze([
  { id: "ticket_max_health", stat: "maxHp", label: "Max Health", gain: 5, cap: 10, rarity: "common" },
  { id: "ticket_health_regen", stat: "hpRegen", label: "Health Regen", gain: 0.05, per: "/s", cap: 10, rarity: "common" },
  { id: "ticket_max_mana", stat: "maxMana", label: "Max Mana", gain: 10, cap: 10, rarity: "common" },
  { id: "ticket_mana_regen", stat: "manaRegen", label: "Mana Regen", gain: 0.1, per: "/s", cap: 10, rarity: "common" },
  { id: "ticket_max_stamina", stat: "maxStamina", label: "Max Stamina", gain: 10, cap: 10, rarity: "common" },
  { id: "ticket_stamina_regen", stat: "staminaRegen", label: "Stamina Regen", gain: 0.8, per: "/s", cap: 10, rarity: "common" },
  { id: "ticket_move_speed", stat: "speed", label: "Move Speed", gain: 5, cap: 10, rarity: "rare" },
].map(Object.freeze));

/** The stat keys a ticket can raise, in a fixed order (R9). */
export const TICKET_STATS = Object.freeze(STAT_TICKETS.map((t) => t.stat));
export const ticketById = (id) => STAT_TICKETS.find((t) => t.id === id) ?? null;
export const ticketForStat = (stat) => STAT_TICKETS.find((t) => t.stat === stat) ?? null;
/** "+5" or "+0.05/s", for text. */
export const gainText = (t) => `+${t.gain}${t.per ?? ""}`;

/** The item definitions of the tickets, registered through content/index.js. A ticket is a light slip of paper: one gram. */
export const TICKET_ITEMS = STAT_TICKETS.map((t) => ({
  id: t.id,
  name: `${t.label} Ticket`,
  description: `Use it to permanently raise ${t.label} by ${gainText(t)}. Up to ${t.cap} tickets per stat.`,
  category: "consumable",
  rarity: t.rarity,
  scope: "character",
  maxStack: 20,
  weightMg: gramsToMg(1),
  actions: ["use"],
}));
