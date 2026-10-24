// First character-owned gameplay items (L2 Phase E, docs/proposals/Inventory-and-ownership.md 13.5). Definitions only.
// Gold here is an ITEM carried by one character, kept by the Inventory service in that character's collection. It is not the
// account Wallet (lobby/Wallet.js, the placeholder Gold / Crystals / Points of Home and the Shop): the two never read or write each other.
// Sim code: no browser, no clock, no randomness (Claude.md 5b). Registered through content/index.js.
import { MAX_STACK_LIMIT } from "./ItemRegistry.js";
import { gramsToMg } from "./weight.js";

/** The item id of carried gold. Spend or earn it only through `inventory.grant` / `inventory.remove` with the character's owner id. */
export const GOLD_ID = "gold";

export const GAMEPLAY_ITEMS = [
  {
    id: GOLD_ID, name: "Gold", category: "currency", rarity: "common", scope: "character",
    description: "Coins carried by your character. Earned in the world; not the Home wallet.",
    maxStack: MAX_STACK_LIMIT, // one slot holds this many; more gold takes another slot (CHARACTER_SLOTS)
    weightMg: gramsToMg(31.1), // 31.10 g each (a troy ounce): carried gold is heavy, so it counts against carrying capacity
    actions: [], // no use, sell, discard or trade in the first inventory (decision 8, section 13.1)
  },
];
