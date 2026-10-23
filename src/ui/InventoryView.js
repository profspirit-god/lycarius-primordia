// Home Account Inventory view (L2 phase D): turns the Inventory service into modal HTML. CLIENT ONLY, read only.
// Pure functions of plain data (no DOM, no storage, no grants): HomeScene wires the clicks and asks the service for
// everything shown here. A Shop offer is never shown as owned, and rendering never changes ownership.
import { findItem, ITEM_CATEGORIES } from "../sim/items/ItemRegistry.js";
import { icon } from "./icons.js";

export const CATEGORY_LABELS = {
  outfit: "Outfits", aura: "Auras", effect: "Effects", emote: "Emotes", title: "Titles", equipment: "Equipment",
  consumable: "Consumables", material: "Materials", quest: "Quest items", container: "Containers", misc: "Miscellaneous",
};
/** Icon NAMES from ui/icons.js. Items have no art yet, so a card shows its category icon (ROADMAP L1: shop item images). */
const CATEGORY_ICONS = {
  outfit: "user", aura: "sparkles", effect: "bolt", emote: "heart", title: "crown", equipment: "shield",
  consumable: "drop", material: "gem", quest: "star", container: "box", misc: "dot",
};
export const RARITY_COLORS = { common: "#9aa3b2", rare: "#5aa8ff", epic: "#c27bff", legendary: "#ffb347" };
const SCOPE_TEXT = { account: "Account-wide: shared by all your characters", character: "Tied to one character" };

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * What the screen shows, read from the service. Never throws; a missing service is an "unavailable" state, not a crash.
 * Entries are ordered by category, then name (deterministic). Only categories that hold something owned get a tab.
 * @param {import('../sim/items/Inventory.js').Inventory|null|undefined} inv
 */
export function inventoryModel(inv) {
  if (!inv) return { status: "unavailable", dropped: 0, entries: [], categories: [] };
  const entries = inv.list()
    .map(({ id, qty }) => ({ def: findItem(id), qty }))
    .filter((e) => e.def)
    .sort((a, b) => ITEM_CATEGORIES.indexOf(a.def.category) - ITEM_CATEGORIES.indexOf(b.def.category) || (a.def.name < b.def.name ? -1 : a.def.name > b.def.name ? 1 : 0));
  const categories = ITEM_CATEGORIES.map((id) => ({ id, label: CATEGORY_LABELS[id] ?? cap(id), count: entries.filter((e) => e.def.category === id).length }))
    .filter((c) => c.count > 0);
  return { status: inv.status, dropped: inv.dropped, entries, categories };
}

const notice = (m) => {
  if (m.status === "newer_version") return "This inventory was saved by a newer version of the game. It is kept untouched and not shown until you update.";
  if (m.status === "corrupt") return "The saved inventory could not be read, so it starts empty.";
  if (m.status === "repaired") return `${m.dropped} saved ${m.dropped === 1 ? "entry was" : "entries were"} not valid and skipped.`;
  return "";
};
const foot = `<div class="note" style="margin:10px 0 0">Only items you own are listed. Shop offers are not owned until bought, and buying is not wired yet.</div>`;

/**
 * @param {ReturnType<typeof inventoryModel>} m
 * @param {{ tab?: string, selected?: string|null }} [view] an unknown tab means All; an id that is not owned means the list
 */
export function inventoryHtml(m, { tab = "all", selected = null } = {}) {
  if (m.status === "unavailable")
    return `<div class="inv-empty"><b>Inventory unavailable</b><div>The inventory could not be loaded. Restart the game and try again.</div></div>`;
  const warn = notice(m) ? `<div class="note inv-warn">${esc(notice(m))}</div>` : "";
  const sel = selected == null ? null : m.entries.find((e) => e.def.id === selected);
  if (sel) return warn + detailHtml(sel);
  if (m.entries.length === 0)
    return `${warn}<div class="inv-empty"><b>Nothing owned yet</b><div>Cosmetics you buy or earn will appear here.</div></div>${foot}`;
  const cur = m.categories.some((c) => c.id === tab) ? tab : "all";
  const shown = cur === "all" ? m.entries : m.entries.filter((e) => e.def.category === cur);
  const tabs = [{ id: "all", label: "All", count: m.entries.length }, ...m.categories]
    .map((c) => `<button class="tab${c.id === cur ? " on" : ""}" data-a="inv-tab" data-t="${c.id}">${esc(c.label)} (${c.count})</button>`).join("");
  const cards = shown.map(({ def, qty }) => `<button class="item inv-item" style="--rar:${RARITY_COLORS[def.rarity]}" data-a="inv-open" data-id="${def.id}">
      <div class="item-img"><span>${icon(CATEGORY_ICONS[def.category] ?? "dot")}</span></div>
      <div class="item-name">${esc(def.name)}</div><div class="item-rar">${def.rarity}</div>
      ${qty > 1 ? `<div class="inv-qty">x${qty}</div>` : ""}</button>`).join("");
  return `${warn}<div class="tabs">${tabs}</div><div class="shop-grid">${cards}</div>${foot}`;
}

function detailHtml({ def, qty }) {
  const equip = def.actions.includes("equip");
  return `<div class="inv-detail" style="--rar:${RARITY_COLORS[def.rarity]}">
      <div class="item-img inv-detail-img"><span>${icon(CATEGORY_ICONS[def.category] ?? "dot")}</span></div>
      <div class="inv-detail-text">
        <h3>${esc(def.name)}</h3>
        <div class="item-rar">${def.rarity} · ${esc(CATEGORY_LABELS[def.category] ?? cap(def.category))}</div>
        <p>${esc(def.description)}</p>
        <div class="pf-grid"><div><small>Owned</small><b>${qty}</b></div><div><small>Ownership</small><b>${esc(SCOPE_TEXT[def.scope] ?? def.scope)}</b></div></div>
      </div></div>
    <div class="pf-actions">
      <button class="btn sm" data-a="inv-back">Back to list</button>
      ${equip ? `<button class="btn sm" disabled title="Character customization arrives with a later update">Equip (soon)</button>` : ""}
    </div>`;
}
