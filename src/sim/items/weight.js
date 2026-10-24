// Item weight and carrying capacity (L2 phase E, docs/proposals/Inventory-and-ownership.md 13.6). Plain numbers, no names.
// Weight is stored as an INTEGER number of MILLIGRAMS (`weightMg`), so 31.10 g is exactly 31,100 and sums never drift the way
// 3 * 31.1 does in floating point. The fictional unit names (Veyt, Kirel, Theryn ...) are DISPLAY ONLY: they live in ui/weightUnits.js
// and never reach a save, a definition or a message from a client.
// Weight is separate from item size: size is the slot / `maxStack` rule in Inventory.js; neither reads the other.
// Sim code: no browser, no clock, no randomness (Claude.md 5b).

export const MG_PER_GRAM = 1000;
/** Largest weight of ONE item (1 metric ton). With MAX_QUANTITY (299,970) a total stays near 3e14, safely inside 2^53 (9e15). */
export const MAX_ITEM_WEIGHT_MG = 1_000_000_000;
/** Starting carrying capacity: 30 kg (30 Theryn). Capacity is its own rule, not derived from items; later systems raise it. */
export const STARTING_CARRY_CAPACITY_MG = 30_000 * MG_PER_GRAM;

/** Authoring helper for definitions: grams (may have decimals) to integer milligrams. `gramsToMg(31.1)` is 31100. */
export const gramsToMg = (grams) => Math.round(grams * MG_PER_GRAM);
/** True for a value a definition may carry: an integer from 0 (weightless) up to MAX_ITEM_WEIGHT_MG. */
export const isWeightMg = (n) => Number.isInteger(n) && n >= 0 && n <= MAX_ITEM_WEIGHT_MG;
/** Weight of one item of a definition; a definition without `weightMg` weighs nothing (account cosmetics, for example). */
export const unitWeightMg = (def) => def?.weightMg ?? 0;
/**
 * How much a character can carry, in milligrams. One function so a later system (strength, bags, buffs) changes one place.
 * @param {string} [_ownerId] the character; every character has the starting capacity today
 */
export const carryCapacityMg = (_ownerId) => STARTING_CARRY_CAPACITY_MG;
