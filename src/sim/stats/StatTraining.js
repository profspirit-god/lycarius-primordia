// Stat training: which stat tickets a character has used, and the permanent stat bonus that gives. Its OWN versioned save (key
// lycarius.primordia.training, never the progression or inventory save). The client passes a storage adapter (sim/storage.js).
// Sim code: no browser, no clock, no randomness (Claude.md 5b).
//
// Save shape, version 1: { v: 1, characters: { <ownerId>: { <statKey>: <ticketsUsed> } } } (keys in order).
// A bonus is DERIVED (tickets used x gain), never saved, so retuning a ticket's gain retunes every character. Replicated fields:
// the whole save shape; nothing here is hidden state.
import { STAT_TICKETS, TICKET_STATS, ticketById } from "../items/tickets.js";
import { OWNER_ID_PATTERN } from "../items/Inventory.js";

export const TRAINING_SAVE_VERSION = 1;
/** Why `use` changed nothing. Inventory reasons (`not_enough`, `read_only`, `unknown_item`) pass through. */
export const TRAINING_REASONS = ["not_a_ticket", "bad_owner", "maxed", "read_only", "not_enough", "unknown_item", "bad_quantity", "wrong_scope"];

const isPlain = (o) => o !== null && typeof o === "object" && !Array.isArray(o);
const byId = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const fail = (reason) => ({ ok: false, reason });
const round3 = (n) => Math.round(n * 1000) / 1000; // 3 x 0.05 would otherwise be 0.15000000000000002

/** Loads and checks a save. Never throws and never invents training: an entry that is not fully valid is dropped. */
export function readTrainingSave(raw) {
  const out = { status: "new", dropped: 0, characters: Object.create(null) };
  if (raw == null) return out;
  if (!isPlain(raw) || !Number.isInteger(raw.v) || raw.v < 1) return { ...out, status: "corrupt" };
  if (raw.v > TRAINING_SAVE_VERSION) return { ...out, status: "newer_version" };
  if (isPlain(raw.characters)) {
    for (const owner of Object.keys(raw.characters).sort(byId)) {
      if (!OWNER_ID_PATTERN.test(owner) || !isPlain(raw.characters[owner])) { out.dropped++; continue; }
      const kept = Object.create(null);
      for (const stat of Object.keys(raw.characters[owner]).sort(byId)) {
        const t = STAT_TICKETS.find((x) => x.stat === stat), n = raw.characters[owner][stat];
        if (!t || !Number.isInteger(n) || n < 1 || n > t.cap) out.dropped++;
        else kept[stat] = n;
      }
      if (Object.keys(kept).length) out.characters[owner] = kept;
    }
  }
  out.status = out.dropped ? "repaired" : "ok";
  return out;
}

export class StatTraining {
  /** @param {import('../storage.js').StorageAdapter} storage */
  constructor(storage) {
    this.storage = storage;
    const s = readTrainingSave(storage.load());
    this.status = s.status;
    this.dropped = s.dropped;
    this.characters = s.characters;
    /** A save written by a NEWER game version is never overwritten. */
    this.readOnly = s.status === "newer_version";
  }

  /** Tickets a character has used on a stat (0 for anything unknown). */
  count(ownerId, stat) {
    return (typeof ownerId === "string" && this.characters[ownerId]?.[stat]) || 0;
  }

  /** The permanent bonus of one character, one number per ticket stat (0 when untrained). Never throws. */
  bonus(ownerId) {
    const out = {};
    for (const t of STAT_TICKETS) out[t.stat] = round3(this.count(ownerId, t.stat) * t.gain);
    return out;
  }

  /**
   * Use one ticket from a character's inventory: the ticket leaves the inventory and the stat goes up, or nothing changes.
   * A maxed stat refuses BEFORE the ticket is taken, so a ticket is never wasted.
   * @param {import('../items/Inventory.js').Inventory} inv
   * @returns {{ ok: true, stat: string, gain: number, count: number, cap: number } | { ok: false, reason: string }}
   */
  use(inv, ownerId, itemId) {
    if (this.readOnly) return fail("read_only");
    const t = ticketById(itemId);
    if (!t) return fail("not_a_ticket");
    if (typeof ownerId !== "string" || !OWNER_ID_PATTERN.test(ownerId)) return fail("bad_owner");
    const have = this.count(ownerId, t.stat);
    if (have >= t.cap) return fail("maxed");
    const r = inv.remove(itemId, 1, ownerId);
    if (!r.ok) return r;
    const mine = this.characters[ownerId] ?? Object.create(null);
    mine[t.stat] = have + 1;
    this.characters[ownerId] = mine;
    try {
      this.storage.save(this.toSave());
    } catch {
      /* storage unavailable: the change stays in memory for this session */
    }
    return { ok: true, stat: t.stat, gain: t.gain, count: have + 1, cap: t.cap };
  }

  toSave() {
    const characters = {};
    for (const owner of Object.keys(this.characters).sort(byId)) {
      const o = {};
      for (const stat of TICKET_STATS) if (this.characters[owner][stat]) o[stat] = this.characters[owner][stat];
      characters[owner] = o;
    }
    return { v: TRAINING_SAVE_VERSION, characters };
  }
}

/** @param {import('../storage.js').StorageAdapter} storage */
export const createStatTraining = (storage) => new StatTraining(storage);
