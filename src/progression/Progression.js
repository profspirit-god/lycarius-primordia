import { ClassRegistry } from "../classes/ClassRegistry.js";
import { SpecBonusRegistry, computeMods } from "./SpecBonuses.js";

const KEY = "lycarius.primordia.progress";
const SAVE_VERSION = 1;
export const MAX_CHAR_LEVEL = 50;

/** XP needed to go from `lv` to `lv + 1`. */
export const charXpForNext = (lv) => Math.round(100 * Math.pow(lv, 1.5));
export const specXpForNext = (lv) => Math.round(50 * Math.pow(lv, 1.4));

function levelInfo(total, need, max) {
  let lv = 1,
    left = total;
  while (lv < max && left >= need(lv)) {
    left -= need(lv);
    lv++;
  }
  const full = lv >= max;
  const nd = full ? 0 : need(lv);
  return { level: lv, max, into: full ? 0 : left, need: nd, frac: full ? 1 : left / nd };
}

/**
 * Character level and class specialization level are two separate tracks.
 *  - Character XP -> character level (no gameplay effect yet; hook for stats later).
 *  - Specialization XP -> specialization level: unlocks skills and grants one bonus pick per non-unlock level.
 * Persisted per class in localStorage (versioned). `onEvent` receives
 * { type: 'xp'|'levelup'|'pick', ... }.
 */
export class Progression {
  /** @param {import('../types.js').ClassDef} cls */
  constructor(cls) {
    this.cls = cls;
    this.spec = cls.specialization;
    this.charXp = 0;
    this.specXp = 0;
    this.picks = {}; // level -> bonus id
    this.onEvent = null;
    this.load();
    this.recalc();
  }

  recalc() {
    this.char = levelInfo(this.charXp, charXpForNext, MAX_CHAR_LEVEL);
    this.specInfo = levelInfo(this.specXp, specXpForNext, this.spec.maxLevel);
  }
  get charLevel() {
    return this.char.level;
  }
  get specLevel() {
    return this.specInfo.level;
  }

  /** Levels that offer a bonus pick (every level above 1 that is not a skill unlock). */
  choiceLevels() {
    const out = [];
    for (let l = 2; l <= this.spec.maxLevel; l++) if (!this.spec.unlocks[l]) out.push(l);
    return out;
  }
  /** Reached choice levels that still have no pick, lowest first. */
  pendingLevels() {
    return this.choiceLevels().filter((l) => l <= this.specLevel && !this.picks[l]);
  }
  unlockedSkills() {
    const ids = [...this.spec.start];
    for (const [lv, id] of Object.entries(this.spec.unlocks)) if (Number(lv) <= this.specLevel) ids.push(id);
    return ids;
  }
  mods() {
    return computeMods(this.picks, this.spec.element);
  }

  addCharXp(n) {
    n = Math.max(0, Math.round(n));
    if (!n) return;
    const before = this.charLevel;
    this.charXp += n;
    this.recalc();
    this.onEvent?.({ type: "xp", track: "char", amount: n });
    for (let l = before + 1; l <= this.charLevel; l++)
      this.onEvent?.({ type: "levelup", track: "char", level: l });
    this.save();
  }
  addSpecXp(n) {
    n = Math.max(0, Math.round(n));
    if (!n) return;
    const before = this.specLevel;
    this.specXp += n;
    this.recalc();
    this.onEvent?.({ type: "xp", track: "spec", amount: n });
    for (let l = before + 1; l <= this.specLevel; l++)
      this.onEvent?.({ type: "levelup", track: "spec", level: l, unlock: this.spec.unlocks[l] ?? null });
    this.save();
  }
  /** Dev helper: exact XP to reach the next specialization level (0 at max). */
  specXpToNext() {
    return this.specInfo.need - this.specInfo.into;
  }

  /** Spend the lowest pending pick on a bonus. Returns false when nothing is pending or the id is unknown. */
  pick(bonusId) {
    const lv = this.pendingLevels()[0];
    if (!lv || !SpecBonusRegistry.items.has(bonusId)) return false;
    this.picks[lv] = bonusId;
    this.save();
    this.onEvent?.({ type: "pick", level: lv, id: bonusId });
    return true;
  }

  reset() {
    this.charXp = 0;
    this.specXp = 0;
    this.picks = {};
    this.recalc();
    this.save();
  }

  // --- persistence -------------------------------------------------------
  load() {
    try {
      const all = JSON.parse(localStorage.getItem(KEY) || "{}");
      const d = all.v === SAVE_VERSION ? all.classes?.[this.cls.id] : null;
      if (!d) return;
      this.charXp = Math.max(0, Number(d.charXp) || 0);
      this.specXp = Math.max(0, Number(d.specXp) || 0);
      const valid = new Set(this.choiceLevels());
      for (const [lv, id] of Object.entries(d.picks ?? {}))
        if (valid.has(Number(lv)) && SpecBonusRegistry.items.has(id)) this.picks[Number(lv)] = id;
    } catch {
      /* ignore corrupt data */
    }
  }
  save() {
    try {
      const all = JSON.parse(localStorage.getItem(KEY) || "{}");
      const classes = all.v === SAVE_VERSION ? all.classes ?? {} : {};
      classes[this.cls.id] = { charXp: this.charXp, specXp: this.specXp, picks: this.picks };
      localStorage.setItem(KEY, JSON.stringify({ v: SAVE_VERSION, classes }));
    } catch {
      /* storage unavailable */
    }
  }
}

export const progressionFor = (classId) => new Progression(ClassRegistry.get(classId));
