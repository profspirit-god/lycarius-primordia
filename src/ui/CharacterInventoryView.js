// In-game Character Inventory view (L2 phase E, MVP): turns the Inventory service into panel HTML. CLIENT ONLY, read only.
// Pure functions of plain data (no DOM, no storage): CharacterInventoryPanel wires the clicks and asks the service for everything
// shown here. This is the CHARACTER's carried items; the Home Account Inventory (InventoryView.js) is a different record.
import { findItem, ITEM_CATEGORIES } from "../sim/items/ItemRegistry.js";
import { CHARACTER_SLOTS } from "../sim/items/Inventory.js";
import { GOLD_ID } from "../sim/items/gameplay.js";
import { carryCapacityMg, unitWeightMg } from "../sim/items/weight.js";
import { CATEGORY_LABELS, CATEGORY_ICONS, RARITY_COLORS } from "./InventoryView.js";
import { formatWeight } from "./weightUnits.js";
import { icon } from "./icons.js";

/** Amounts a developer can add or spend with the debug buttons (grant and spend go through the service, never around it). */
export const DEV_GOLD_STEPS = [100, 1000];
/** The unit the weight bar speaks in (capacity is "30 Th"). Item weights pick their own unit; the bar pins both numbers to this one. */
export const WEIGHT_BAR_UNIT = "Th";

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const fmt = (n) => n.toLocaleString("en-US");

/**
 * What the panel shows, read from the service. Never throws; a missing service is an "unavailable" state, not a crash.
 * `slots` always has CHARACTER_SLOTS entries: a stack `{ def, qty }` or null. Stacks are ordered by category then name (so gold is
 * first), and an amount above `maxStack` fills the next slot, exactly as the service counts slots.
 * @param {import('../sim/items/Inventory.js').Inventory|null|undefined} inv
 * @param {string} ownerId the character (the class id today)
 */
export function characterInventoryModel(inv, ownerId) {
  const slots = Array(CHARACTER_SLOTS).fill(null);
  const capacityMg = carryCapacityMg(ownerId);
  if (!inv) return { status: "unavailable", dropped: 0, slots, used: 0, free: CHARACTER_SLOTS, gold: 0, weightMg: 0, capacityMg };
  const entries = inv.list(ownerId)
    .map(({ id, qty }) => ({ def: findItem(id), qty }))
    .filter((e) => e.def)
    .sort((a, b) => ITEM_CATEGORIES.indexOf(a.def.category) - ITEM_CATEGORIES.indexOf(b.def.category) || (a.def.name < b.def.name ? -1 : a.def.name > b.def.name ? 1 : 0));
  let used = 0;
  for (const { def, qty } of entries)
    for (let left = qty; left > 0 && used < CHARACTER_SLOTS; left -= def.maxStack) slots[used++] = { def, qty: Math.min(left, def.maxStack) };
  return { status: inv.status, dropped: inv.dropped, slots, used, free: CHARACTER_SLOTS - used, gold: inv.count(GOLD_ID, ownerId), weightMg: inv.weightMg(ownerId), capacityMg };
}

const notice = (m) => {
  if (m.status === "newer_version") return "This inventory was saved by a newer version of the game. It is kept untouched and not shown until you update.";
  if (m.status === "corrupt") return "The saved inventory could not be read, so it starts empty.";
  if (m.status === "repaired") return `${m.dropped} saved ${m.dropped === 1 ? "entry was" : "entries were"} not valid and skipped.`;
  return "";
};

const slotHtml = (s) => !s ? `<div class="slot ci-slot"></div>`
  : `<div class="slot ci-slot full" style="--rar:${RARITY_COLORS[s.def.rarity]}" title="${esc(s.def.name)} x${fmt(s.qty)}${unitWeightMg(s.def) ? `, weighs ${formatWeight(unitWeightMg(s.def) * s.qty)}` : ""}: ${esc(s.def.description)}">
      <span class="ci-ic">${icon(CATEGORY_ICONS[s.def.category] ?? "dot")}</span><span class="inv-qty">${fmt(s.qty)}</span><small>${esc(s.def.name)}</small></div>`;

/** Carried weight against capacity, both in one unit. Over capacity only changes the colour: carry rules (speed, refusing pickups) come later. */
const weightHtml = (m) => {
  const over = m.weightMg > m.capacityMg, pct = Math.min(100, Math.round((m.weightMg / m.capacityMg) * 100));
  return `<div class="ci-weight${over ? " over" : ""}"><div class="lvline"><b>Weight</b><span>${formatWeight(m.weightMg, { unit: WEIGHT_BAR_UNIT })} / ${formatWeight(m.capacityMg, { unit: WEIGHT_BAR_UNIT })}</span></div>
      <div class="xpbar"><i style="width:${pct}%"></i></div></div>`;
};

/**
 * @param {ReturnType<typeof characterInventoryModel>} m
 * @param {{ dev?: boolean, message?: string }} [view] `dev` adds the debug gold buttons; `message` is the result of the last one
 */
export function characterInventoryHtml(m, { dev = false, message = "" } = {}) {
  if (m.status === "unavailable")
    return `<div class="inv-empty"><b>Inventory unavailable</b><div>The inventory could not be loaded. Restart the game and try again.</div></div>`;
  const warn = notice(m) ? `<div class="note inv-warn">${esc(notice(m))}</div>` : "";
  const devRow = dev
    ? `<div class="ci-dev"><span>Debug</span>${DEV_GOLD_STEPS.map((n) => `<button class="btn sm" data-a="ci-grant" data-n="${n}">+${fmt(n)} gold</button><button class="btn sm" data-a="ci-spend" data-n="${n}">-${fmt(n)} gold</button>`).join("")}
        <div class="ci-msg" role="status">${esc(message)}</div></div>`
    : "";
  return `${warn}
    <div class="ci-gold"><i>${icon("coin")}</i><span>Gold</span><small>${formatWeight(unitWeightMg(findItem(GOLD_ID)))} each</small><b>${fmt(m.gold)}</b></div>
    ${weightHtml(m)}
    <div class="slot-grid ci-grid">${m.slots.map(slotHtml).join("")}</div>
    <div class="ci-foot"><span>Slots ${m.used} / ${CHARACTER_SLOTS}</span><span>${m.free} free</span></div>
    ${devRow}
    <div class="note" style="margin:10px 0 0">What your character carries. Gold has no source in the world yet; the Home wallet and Shop are separate.</div>`;
}
