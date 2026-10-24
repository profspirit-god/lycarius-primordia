// Item definitions (L2, Phase B of docs/proposals/Inventory-and-ownership.md): the STATIC, shared description of an item type.
// A definition holds no owner, quantity, equipped state or purchase history: that is ownership state (a later phase).
// Sim code: no browser, no clock, no randomness (Claude.md 5b). Definitions are validated and frozen when registered.
import { Registry } from "../../core/Registry.js";

/** Where an item may be owned. `account` = shared by all characters, `character` = tied to one character (class id today). */
export const ITEM_SCOPES = ["account", "character"];
/** Cosmetic categories first, then gameplay categories (`currency` = coins carried by a character, e.g. gold; not the account Wallet). Only categories with content are shown by a UI. */
export const ITEM_CATEGORIES = [
  "outfit", "aura", "effect", "emote", "title",
  "currency", "equipment", "consumable", "material", "quest", "container", "misc",
];
export const ITEM_RARITIES = ["common", "rare", "epic", "legendary"];
/** What a definition may allow. The inventory service (a later phase) decides whether an action is valid right now. */
export const ITEM_ACTIONS = ["use", "equip", "consume", "sell", "trade", "discard", "open"];
export const MAX_STACK_LIMIT = 9999;
export const ITEM_ID_PATTERN = /^[a-z][a-z0-9_]{1,39}$/;
const NAME_MAX = 60;
const DESCRIPTION_MAX = 200;
/** The only keys a definition may have. A new system (slots, stat modifiers, recipes) extends this list on purpose. */
const KEYS = ["id", "name", "description", "category", "rarity", "scope", "maxStack", "actions"];

/**
 * Returns a list of problems (empty = valid). Never throws, whatever the input.
 * @param {unknown} def
 * @returns {string[]}
 */
export function validateItemDef(def) {
  if (def === null || typeof def !== "object" || Array.isArray(def)) return ["definition must be an object"];
  const errs = [];
  for (const k of Object.keys(def)) if (!KEYS.includes(k)) errs.push(`unknown field "${k}"`);
  if (typeof def.id !== "string" || !ITEM_ID_PATTERN.test(def.id)) errs.push("id must match " + ITEM_ID_PATTERN);
  const text = (k, max) => {
    if (typeof def[k] !== "string" || def[k].trim() === "" || def[k].length > max) errs.push(`${k} must be a non-empty string of at most ${max} characters`);
  };
  text("name", NAME_MAX);
  text("description", DESCRIPTION_MAX);
  if (!ITEM_CATEGORIES.includes(def.category)) errs.push("category must be one of " + ITEM_CATEGORIES.join(", "));
  if (!ITEM_RARITIES.includes(def.rarity)) errs.push("rarity must be one of " + ITEM_RARITIES.join(", "));
  if (!ITEM_SCOPES.includes(def.scope)) errs.push("scope must be one of " + ITEM_SCOPES.join(", "));
  if (!Number.isInteger(def.maxStack) || def.maxStack < 1 || def.maxStack > MAX_STACK_LIMIT)
    errs.push(`maxStack must be an integer from 1 to ${MAX_STACK_LIMIT} (1 = not stackable)`);
  if (!Array.isArray(def.actions)) errs.push("actions must be an array");
  else {
    for (const a of def.actions) if (!ITEM_ACTIONS.includes(a)) errs.push(`unknown action "${a}"`);
    if (new Set(def.actions).size !== def.actions.length) errs.push("actions must not repeat");
  }
  return errs;
}

export const ItemRegistry = new Registry("item");

/**
 * Validate, freeze and register one definition. Throws with every problem listed, and on a duplicate id (the generic
 * Registry would silently replace it). Register through content/index.js only.
 */
export function defineItem(def) {
  const errs = validateItemDef(def);
  if (errs.length === 0 && ItemRegistry.items.has(def.id)) errs.push(`duplicate id "${def.id}"`);
  if (errs.length) throw new Error(`[item] invalid definition ${JSON.stringify(def?.id)}: ${errs.join("; ")}`);
  return ItemRegistry.register(Object.freeze({ ...def, actions: Object.freeze([...def.actions]) }));
}

/** Safe lookup for untrusted ids (a save file, a client message): the definition, or null. Never throws. */
export const findItem = (id) => (typeof id === "string" ? ItemRegistry.items.get(id) ?? null : null);
export const hasItem = (id) => findItem(id) !== null;
/** Every definition, ordered by id (never by registration order, Claude.md 5b R9). */
export const allItems = () => ItemRegistry.all().sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
