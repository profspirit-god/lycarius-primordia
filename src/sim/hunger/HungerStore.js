// H2a: the save of ONE character's Hunger, through a storage adapter (sim/storage.js). Its own versioned save, on its own key (HUNGER_KEY in
// core/LocalStorageAdapter.js), so it never shares a file with progression, jobs, the inventory or stat training.
// Sim code: no browser API, no clock, no randomness (Claude.md 5b). The only time it knows is the `dt` the caller passes.
//
// Save shape, version 1:  { v: 1, owners: { <ownerId>: <Hunger.serialize()> } }
//   ownerId  the character (the class id today, same as the Inventory and JobProgress)
//   the value under an owner is exactly `Hunger.serialize()`: { v, id, value } with the value in hunger points
// Replicated fields (what a client may see later): the whole save shape.
//
// Loading never throws and never trusts the file: a missing, corrupt, mismatched or newer save gives a fresh Hunger at the definition's
// start value and the reason is kept in `loaded`. A save written by a NEWER game is never overwritten (`locked`): the fresh Hunger only
// lives in memory for this session, so opening an old build cannot destroy newer data.
//
// When it writes (the stat only changes slowly, so it does not write every frame): on a tier change, every AUTOSAVE_SECONDS of sim time,
// on `save()` (eating, respawn, the Developer tool, leaving the world). A browser closed in between loses at most the last drain, and a
// lost drain is never worse for the player than the stat they had.
import { createMemoryStorage } from "../storage.js";
import { Hunger } from "./Hunger.js";
import { OWNER_ID_PATTERN } from "../items/Inventory.js";

export const HUNGER_STORE_VERSION = 1;
/** Sim seconds between two automatic saves while nothing else triggered one. */
export const AUTOSAVE_SECONDS = 30;

const isPlain = (o) => o !== null && typeof o === "object" && !Array.isArray(o);

export class HungerStore {
  /**
   * @param {string} ownerId the character (the class id today)
   * @param {unknown} def a hunger definition (see `validateHungerDef`); invalid input throws, like `Hunger`
   * @param {import('../storage.js').StorageAdapter} [storage] in memory by default, so nothing is saved by accident
   */
  constructor(ownerId, def, storage = createMemoryStorage()) {
    if (typeof ownerId !== "string" || !OWNER_ID_PATTERN.test(ownerId)) throw new Error(`[hunger] bad owner id ${JSON.stringify(ownerId)}`);
    this.ownerId = ownerId;
    this.def = def;
    this.storage = storage;
    this.sinceSave = 0; // sim seconds since the last write
    this.locked = false; // a newer game's save was found: never write over it
    /** @type {"new"|"restored"|"corrupt"|"newer_version"|"mismatch"} how the Hunger below came to be */
    this.loaded = "new";
    /** The character's Hunger: restored from the save, or fresh. */
    this.hunger = this.#load();
  }

  /**
   * Count `dt` seconds of sim time and write when due.
   * @param {number} dt
   * @param {boolean} [changed] true when the tier changed in this step (written at once)
   */
  tick(dt, changed = false) {
    if (typeof dt === "number" && Number.isFinite(dt) && dt > 0) this.sinceSave += dt;
    if (changed || this.sinceSave >= AUTOSAVE_SECONDS) this.save();
  }

  /** Write the current Hunger now. Returns false when nothing was written (a newer save is locked, or the storage failed). Never throws. */
  save() {
    if (this.locked) return false;
    try {
      const all = this.storage.load();
      if (isPlain(all) && Number.isInteger(all.v) && all.v > HUNGER_STORE_VERSION) {
        this.locked = true; // appeared after the load (another tab, a newer build): keep it
        return false;
      }
      const owners = isPlain(all) && all.v === HUNGER_STORE_VERSION && isPlain(all.owners) ? all.owners : {};
      owners[this.ownerId] = this.hunger.serialize();
      this.storage.save({ v: HUNGER_STORE_VERSION, owners });
      this.sinceSave = 0;
      return true;
    } catch {
      return false; // storage unavailable: the stat stays in memory for this session
    }
  }

  #load() {
    let all = null;
    try {
      all = this.storage.load();
    } catch {
      /* unreadable storage: start fresh */
    }
    if (all != null) {
      if (!isPlain(all) || !Number.isInteger(all.v) || all.v < 1) this.loaded = "corrupt";
      else if (all.v > HUNGER_STORE_VERSION) {
        this.loaded = "newer_version";
        this.locked = true;
      } else if (isPlain(all.owners) && all.owners[this.ownerId] !== undefined) {
        const r = Hunger.restore(this.def, all.owners[this.ownerId]);
        if (r.ok) {
          this.loaded = "restored";
          return r.hunger;
        }
        this.loaded = r.reason;
        if (r.reason === "newer_version") this.locked = true;
      }
    }
    return new Hunger(this.def);
  }
}
