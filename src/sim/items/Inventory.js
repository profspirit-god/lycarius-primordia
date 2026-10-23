// Inventory service (L2, Phase C of docs/proposals/Inventory-and-ownership.md): who owns how many of which item.
// The ONE canonical ownership record. A UI, the Shop or a reward only ever asks this service; none of them keeps its own copy.
// Sim code: no browser, no clock, no randomness (Claude.md 5b). Storage arrives as an adapter (sim/storage.js); the client
// passes a localStorage adapter on INVENTORY_KEY, so this save never shares a key or a shape with the progression save.
//
// Save shape, version 1 (the owner-approved boundary, docs/proposals/Inventory-and-ownership.md 13.4):
//   { v: 1, account: { items: { <itemId>: <qty> } }, characters: { <ownerId>: { items: { <itemId>: <qty> } } } }
// Stacks only: an id and a quantity (item instances wait for M4, S1h and S5). The definition decides the collection:
//   scope "account"   -> the one account collection; at most `maxStack` of an id (a cosmetic, maxStack 1, is owned once).
//   scope "character" -> the collection of one owner id (the class id today); slot based, ceil(qty / maxStack) slots per id,
//                        CHARACTER_SLOTS slots in total.
// Replicated fields (what a client may see later): the whole save shape above. Nothing here is hidden state.
import { findItem, MAX_STACK_LIMIT } from "./ItemRegistry.js";

export const INVENTORY_SAVE_VERSION = 1;
/** Slots of one character collection. A default (Phase E confirms it); one constant, so changing it is one line. */
export const CHARACTER_SLOTS = 30;
/** Allowed owner ids (R11): lowercase words, same style as item ids. Class ids today, real character ids with accounts (S5). */
export const OWNER_ID_PATTERN = /^[a-z][a-z0-9_]{0,39}$/;
/** Largest quantity one grant or removal may name (R11). Capacity rules reject anything that does not fit. */
export const MAX_QUANTITY = MAX_STACK_LIMIT * CHARACTER_SLOTS;

/** Why a call changed nothing. */
export const REASONS = [
  "unknown_item", "bad_quantity", "bad_owner", "wrong_scope", "already_owned",
  "stack_full", "inventory_full", "not_enough", "read_only",
];

const isQty = (n) => Number.isInteger(n) && n >= 1 && n <= MAX_QUANTITY;
const isPlain = (o) => o !== null && typeof o === "object" && !Array.isArray(o);
const byId = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const slotsFor = (qty, def) => Math.ceil(qty / def.maxStack);
const fail = (reason) => ({ ok: false, reason });

/**
 * @typedef {{ ok: true, qty: number } | { ok: false, reason: string }} Result
 * @typedef {'new'|'ok'|'repaired'|'corrupt'|'newer_version'} LoadStatus
 */

/**
 * Loads and checks a save. Never throws and never invents an item: an entry that is not fully valid is dropped, not fixed.
 * @param {unknown} raw whatever the adapter returned
 * @returns {{ status: LoadStatus, dropped: number, account: Record<string,number>, characters: Record<string, Record<string,number>> }}
 */
export function readSave(raw) {
  const out = { status: "new", dropped: 0, account: Object.create(null), characters: Object.create(null) };
  if (raw == null) return out;
  if (!isPlain(raw) || !Number.isInteger(raw.v) || raw.v < 1) return { ...out, status: "corrupt" };
  if (raw.v > INVENTORY_SAVE_VERSION) return { ...out, status: "newer_version" };

  const keep = (items, scope) => {
    const kept = Object.create(null);
    if (!isPlain(items)) return kept;
    for (const id of Object.keys(items).sort(byId)) {
      const def = findItem(id), qty = items[id];
      if (!def || def.scope !== scope || !isQty(qty) || (scope === "account" && qty > def.maxStack)) out.dropped++;
      else kept[id] = qty;
    }
    return kept;
  };
  out.account = keep(raw.account?.items, "account");
  if (isPlain(raw.characters)) {
    for (const owner of Object.keys(raw.characters).sort(byId)) {
      if (!OWNER_ID_PATTERN.test(owner) || !isPlain(raw.characters[owner])) { out.dropped++; continue; }
      const items = keep(raw.characters[owner].items, "character");
      let used = 0;
      for (const id of Object.keys(items)) { // ids in order: when the save holds too much, the later ids are the ones dropped
        used += slotsFor(items[id], findItem(id));
        if (used > CHARACTER_SLOTS) { used -= slotsFor(items[id], findItem(id)); delete items[id]; out.dropped++; }
      }
      if (Object.keys(items).length) out.characters[owner] = items;
    }
  }
  out.status = out.dropped ? "repaired" : "ok";
  return out;
}

export class Inventory {
  /** @param {import('../storage.js').StorageAdapter} storage where the save lives (an in-memory one by default is the caller's choice) */
  constructor(storage) {
    this.storage = storage;
    const s = readSave(storage.load());
    /** @type {LoadStatus} */ this.status = s.status;
    /** Entries the load threw away (unknown ids, bad quantities, wrong collection, over capacity). */
    this.dropped = s.dropped;
    this.account = s.account;
    this.characters = s.characters;
    /** A save written by a NEWER game version is never overwritten: every change is refused until it is understood. */
    this.readOnly = s.status === "newer_version";
  }

  /** The collection an item lives in, or a failure. `ownerId` is only for character-scoped items. */
  #target(def, ownerId) {
    if (def.scope === "account") return ownerId == null ? { items: this.account } : fail("wrong_scope");
    if (ownerId == null || typeof ownerId !== "string" || !OWNER_ID_PATTERN.test(ownerId)) return fail("bad_owner");
    return { items: this.characters[ownerId] ?? Object.create(null), owner: ownerId };
  }

  #slots(items) {
    let n = 0;
    for (const id of Object.keys(items)) n += slotsFor(items[id], findItem(id));
    return n;
  }

  #commit(def, t, qty) {
    if (qty > 0) t.items[def.id] = qty; else delete t.items[def.id];
    if (t.owner !== undefined) {
      if (Object.keys(t.items).length) this.characters[t.owner] = t.items; else delete this.characters[t.owner];
    }
    try {
      this.storage.save(this.toSave());
    } catch {
      /* storage unavailable: the change stays in memory for this session */
    }
    return { ok: true, qty };
  }

  /**
   * Add `qty` of an item. Changes nothing (and saves nothing) unless every rule passes.
   * @param {string} itemId
   * @param {number} [qty]
   * @param {string|null} [ownerId] required for character-scoped items, must be absent for account-scoped ones
   * @returns {Result} the new quantity on success
   */
  grant(itemId, qty = 1, ownerId = null) {
    if (this.readOnly) return fail("read_only");
    const def = findItem(itemId);
    if (!def) return fail("unknown_item");
    if (!isQty(qty)) return fail("bad_quantity");
    const t = this.#target(def, ownerId);
    if (t.ok === false) return t;
    const have = t.items[def.id] ?? 0, next = have + qty;
    if (def.scope === "account") {
      if (next > def.maxStack) return fail(def.maxStack === 1 ? "already_owned" : "stack_full");
    } else if (this.#slots(t.items) - (have ? slotsFor(have, def) : 0) + slotsFor(next, def) > CHARACTER_SLOTS) {
      return fail("inventory_full");
    }
    return this.#commit(def, t, next);
  }

  /** Take `qty` away. Fails (and changes nothing) if fewer are owned. @returns {Result} the quantity left on success */
  remove(itemId, qty = 1, ownerId = null) {
    if (this.readOnly) return fail("read_only");
    const def = findItem(itemId);
    if (!def) return fail("unknown_item");
    if (!isQty(qty)) return fail("bad_quantity");
    const t = this.#target(def, ownerId);
    if (t.ok === false) return t;
    const have = t.items[def.id] ?? 0;
    if (have < qty) return fail("not_enough");
    return this.#commit(def, t, have - qty);
  }

  /** How many are owned. Unknown ids, a wrong collection or a bad owner count as 0. Never throws. */
  count(itemId, ownerId = null) {
    const def = findItem(itemId);
    if (!def) return 0;
    const t = this.#target(def, ownerId);
    return t.ok === false ? 0 : t.items[def.id] ?? 0;
  }

  owns(itemId, ownerId = null) {
    return this.count(itemId, ownerId) > 0;
  }

  /** Free slots of one character collection (never negative). */
  freeSlots(ownerId) {
    if (typeof ownerId !== "string" || !OWNER_ID_PATTERN.test(ownerId)) return 0;
    return Math.max(0, CHARACTER_SLOTS - this.#slots(this.characters[ownerId] ?? {}));
  }

  /** What is owned in one collection, ordered by id (R9): the account's with no argument, one owner's with an owner id. */
  list(ownerId = null) {
    const items = ownerId == null ? this.account : this.characters[ownerId] ?? {};
    return Object.keys(items).sort(byId).map((id) => ({ id, qty: items[id] }));
  }

  /** The save payload: plain data, keys in id order. Empty character collections are not written. */
  toSave() {
    const pack = (items) => {
      const o = {};
      for (const id of Object.keys(items).sort(byId)) o[id] = items[id];
      return { items: o };
    };
    const characters = {};
    for (const owner of Object.keys(this.characters).sort(byId)) characters[owner] = pack(this.characters[owner]);
    return { v: INVENTORY_SAVE_VERSION, account: pack(this.account), characters };
  }
}

/** @param {import('../storage.js').StorageAdapter} storage */
export const createInventory = (storage) => new Inventory(storage);
