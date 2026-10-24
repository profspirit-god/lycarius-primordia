// Job progression (track J, J1): job XP and job levels for ONE character. Separate from Progression (character level and class
// specialization): job XP comes from work (chopping), never from combat, and it is shown in the player's stats, not next to the battle bars.
// Persisted through a storage adapter (sim/storage.js), versioned, on its own key (JOBS_KEY in core/LocalStorageAdapter.js), so it never
// shares a save with progression or the inventory. No browser API, no clock, no randomness (Claude.md 5b).
//
// Save shape, version 1:  { v: 1, owners: { <ownerId>: { xp: { <jobId>: <integer> }, starter: <boolean> } } }
//   ownerId  the character (the class id today, same as the Inventory)
//   starter  true once the character has been handed its starter tool, so a traded or discarded axe is never given again
// Replicated fields (what a client may see later): the whole save shape.
import { createMemoryStorage } from "../sim/storage.js";
import { JOBS, jobIds, jobXpForNext, MAX_JOB_XP } from "../sim/jobs/jobs.js";
import { OWNER_ID_PATTERN } from "../sim/items/Inventory.js";

export const JOB_SAVE_VERSION = 1;

const isPlain = (o) => o !== null && typeof o === "object" && !Array.isArray(o);
const isXp = (n) => Number.isInteger(n) && n >= 0 && n <= MAX_JOB_XP;

/** Level, XP into the level, XP the level needs and the filled fraction, for a total of `xp`. */
export function jobLevelInfo(jobId, xp) {
  const max = JOBS[jobId].maxLevel;
  let lv = 1, left = xp;
  while (lv < max && left >= jobXpForNext(lv)) {
    left -= jobXpForNext(lv);
    lv++;
  }
  const full = lv >= max, need = full ? 0 : jobXpForNext(lv);
  return { job: jobId, level: lv, max, xp, into: full ? 0 : left, need, frac: full ? 1 : left / need };
}

export class JobProgress {
  /**
   * @param {string} ownerId the character (the class id today)
   * @param {import('../sim/storage.js').StorageAdapter} [storage] in memory by default, so nothing is saved by accident
   */
  constructor(ownerId, storage = createMemoryStorage()) {
    if (typeof ownerId !== "string" || !OWNER_ID_PATTERN.test(ownerId)) throw new Error(`[jobs] bad owner id ${JSON.stringify(ownerId)}`);
    this.ownerId = ownerId;
    this.storage = storage;
    this.xps = Object.create(null); // jobId -> total XP
    for (const id of jobIds()) this.xps[id] = 0;
    this.starter = false;
    this.load();
  }

  /** Total XP in a job (0 for an unknown id). */
  xp(jobId) {
    return this.xps[jobId] ?? 0;
  }
  level(jobId) {
    return JOBS[jobId] ? jobLevelInfo(jobId, this.xps[jobId]).level : 0;
  }
  /** @returns {ReturnType<typeof jobLevelInfo>|null} null for an unknown job */
  info(jobId) {
    return JOBS[jobId] ? jobLevelInfo(jobId, this.xps[jobId]) : null;
  }

  /**
   * Add job XP (whole numbers only; anything else changes nothing). Saves, and reports the levels reached.
   * @returns {{ gained: number, levels: number[] }} `gained` is what was really added (the total is capped at MAX_JOB_XP)
   */
  addXp(jobId, amount) {
    if (!JOBS[jobId] || !Number.isInteger(amount) || amount < 1) return { gained: 0, levels: [] };
    const before = this.level(jobId), room = MAX_JOB_XP - this.xps[jobId], gained = Math.min(amount, room);
    if (gained < 1) return { gained: 0, levels: [] };
    this.xps[jobId] += gained;
    const after = this.level(jobId), levels = [];
    for (let l = before + 1; l <= after; l++) levels.push(l);
    this.save();
    return { gained, levels };
  }

  /** The starter tool has been handed over (once per character, ever). */
  markStarterGiven() {
    if (this.starter) return;
    this.starter = true;
    this.save();
  }

  // --- persistence -------------------------------------------------------
  load() {
    try {
      const all = this.storage.load();
      if (!isPlain(all) || all.v !== JOB_SAVE_VERSION || !isPlain(all.owners)) return;
      const mine = all.owners[this.ownerId];
      if (!isPlain(mine)) return;
      if (isPlain(mine.xp)) for (const id of jobIds()) if (isXp(mine.xp[id])) this.xps[id] = mine.xp[id]; // an unknown job or a bad number is dropped, never fixed
      this.starter = mine.starter === true;
    } catch {
      /* corrupt data: start fresh */
    }
  }

  save() {
    try {
      const all = this.storage.load();
      const owners = isPlain(all) && all.v === JOB_SAVE_VERSION && isPlain(all.owners) ? all.owners : {};
      owners[this.ownerId] = { xp: { ...this.xps }, starter: this.starter };
      this.storage.save({ v: JOB_SAVE_VERSION, owners });
    } catch {
      /* storage unavailable: the change stays in memory for this session */
    }
  }
}
