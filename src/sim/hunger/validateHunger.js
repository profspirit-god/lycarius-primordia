// Hunger definitions (H1, FOUNDER.md section 6): the STATIC description of the hunger stat and its tiers.
// A definition holds no current value: that is runtime state (Hunger.js). Every limit is a constant here (Claude.md 5b, R11),
// because a definition will later come from content files and a saved value from a database.
// Sim code: no browser, no clock, no randomness (Claude.md 5b). Not wired into the game yet (H2 does that).
//
// The guardrails of the hunger law are enforced HERE, so no tier table can break them:
//  - hunger never damages: a tier only carries multipliers and a status id, there is nothing that could hurt;
//  - no tier slows movement by more than 10% (`MIN_MOVE_MULT`), so a player can never be trapped;
//  - no tier switches regeneration off (`MIN_MULT`), so hunger never stops recovery completely;
//  - the lowest tier can always eat, so food is never a soft-lock.

export const HUNGER_ID_PATTERN = /^[a-z][a-z0-9_]{1,39}$/;
export const TIER_ID_PATTERN = /^[a-z][a-z0-9_]{1,23}$/;
/** Status ids are the names `StatusSystem` will know in H2 (for example "hungry"); `null` = no status. */
export const STATUS_ID_PATTERN = /^[a-z][a-z0-9_]{1,23}$/;
export const MAX_TIERS = 8;
export const MIN_TIERS = 2;
export const MAX_VALUE_LIMIT = 1000;
export const MIN_DRAIN_SECONDS = 1;
export const MAX_DRAIN_SECONDS = 3600;
/** Multiplier limits: a modifier may weaken or strengthen a rate, never turn it off or make it huge. */
export const MIN_MULT = 0.1;
export const MAX_MULT = 2;
/** The hunger law: debuffs cap at -10% move speed. */
export const MIN_MOVE_MULT = 0.9;

const KEYS = ["id", "max", "start", "drainSeconds", "tiers"];
const TIER_KEYS = ["id", "min", "regenMult", "moveMult", "staminaRegenMult", "status", "canEat"];

const isPlain = (v) => v !== null && typeof v === "object" && !Array.isArray(v) &&
  (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
const isNum = (v) => typeof v === "number" && Number.isFinite(v);

/**
 * Returns a list of problems (empty = valid). Never throws for any JSON-shaped input.
 * @param {unknown} def `{ id, max, start, drainSeconds, tiers: [{ id, min, regenMult, moveMult, staminaRegenMult, status, canEat }] }`
 *   `drainSeconds` = seconds of play for the stat to fall by 1. A tier covers `min` up to the next tier's `min` (the top tier up to `max`).
 * @returns {string[]}
 */
export function validateHungerDef(def) {
  if (!isPlain(def)) return ["definition must be an object"];
  const errs = [];
  for (const k of Object.keys(def)) if (!KEYS.includes(k)) errs.push(`unknown field "${k}"`);
  for (const k of KEYS) if (!(k in def)) errs.push(`missing field "${k}"`);
  if ("id" in def && (typeof def.id !== "string" || !HUNGER_ID_PATTERN.test(def.id))) errs.push("id must match " + HUNGER_ID_PATTERN);
  const maxOk = "max" in def && Number.isInteger(def.max) && def.max >= 1 && def.max <= MAX_VALUE_LIMIT;
  if ("max" in def && !maxOk) errs.push(`max must be an integer from 1 to ${MAX_VALUE_LIMIT}`);
  if ("start" in def) {
    if (!isNum(def.start) || def.start < 0 || (maxOk && def.start > def.max)) errs.push("start must be a number from 0 to max");
  }
  if ("drainSeconds" in def && (!isNum(def.drainSeconds) || def.drainSeconds < MIN_DRAIN_SECONDS || def.drainSeconds > MAX_DRAIN_SECONDS)) {
    errs.push(`drainSeconds must be a number from ${MIN_DRAIN_SECONDS} to ${MAX_DRAIN_SECONDS}`);
  }
  if ("tiers" in def) validateTiers(def.tiers, maxOk ? def.max : null, errs);
  return errs;
}

function validateTiers(tiers, max, errs) {
  if (!Array.isArray(tiers)) { errs.push("tiers must be a list"); return; }
  if (tiers.length < MIN_TIERS || tiers.length > MAX_TIERS) errs.push(`tiers must have ${MIN_TIERS} to ${MAX_TIERS} entries`);
  if (tiers.length > MAX_TIERS) return; // do not scan an oversized list
  const ids = new Set(), mins = new Set();
  let lowest = null;
  tiers.forEach((t, i) => {
    const at = `tier ${i}`;
    if (!isPlain(t)) { errs.push(`${at} must be an object`); return; }
    for (const k of Object.keys(t)) if (!TIER_KEYS.includes(k)) errs.push(`${at}: unknown field "${k}"`);
    for (const k of TIER_KEYS) if (!(k in t)) errs.push(`${at}: missing field "${k}"`);
    if ("id" in t) {
      if (typeof t.id !== "string" || !TIER_ID_PATTERN.test(t.id)) errs.push(`${at}: id must match ${TIER_ID_PATTERN}`);
      else if (ids.has(t.id)) errs.push(`${at}: duplicate id "${t.id}"`);
      else ids.add(t.id);
    }
    if ("min" in t) {
      if (!Number.isInteger(t.min) || t.min < 0 || (max !== null && t.min >= max)) errs.push(`${at}: min must be an integer from 0 to below max`);
      else if (mins.has(t.min)) errs.push(`${at}: duplicate min ${t.min}`);
      else { mins.add(t.min); if (lowest === null || t.min < lowest.min) lowest = t; }
    }
    for (const k of ["regenMult", "staminaRegenMult"]) {
      if (k in t && (!isNum(t[k]) || t[k] < MIN_MULT || t[k] > MAX_MULT)) errs.push(`${at}: ${k} must be a number from ${MIN_MULT} to ${MAX_MULT}`);
    }
    if ("moveMult" in t && (!isNum(t.moveMult) || t.moveMult < MIN_MOVE_MULT || t.moveMult > MAX_MULT)) {
      errs.push(`${at}: moveMult must be a number from ${MIN_MOVE_MULT} (hunger never slows more than 10%) to ${MAX_MULT}`);
    }
    if ("status" in t && t.status !== null && (typeof t.status !== "string" || !STATUS_ID_PATTERN.test(t.status))) errs.push(`${at}: status must be null or match ${STATUS_ID_PATTERN}`);
    if ("canEat" in t && typeof t.canEat !== "boolean") errs.push(`${at}: canEat must be true or false`);
  });
  if (!mins.has(0) && tiers.length >= MIN_TIERS) errs.push("one tier must start at min 0, so every value has a tier");
  if (lowest && lowest.min === 0 && lowest.canEat === false) errs.push("the lowest tier must be able to eat (food is never a soft-lock)");
}

/**
 * Validated copy of a definition, frozen, with the tiers sorted from the highest `min` down (the order `tierFor` scans, independent
 * of the order the content listed them in, Claude.md 5b R9). Throws with every problem listed, like `defineItem`.
 * @param {unknown} def
 */
export function normalizeHungerDef(def) {
  const errs = validateHungerDef(def);
  if (errs.length) throw new Error(`[hunger] invalid definition ${JSON.stringify(isPlain(def) ? String(def.id).slice(0, 40) : null)}: ${errs.join("; ")}`);
  const tiers = def.tiers.map((t) => Object.freeze({
    id: t.id, min: t.min, regenMult: t.regenMult, moveMult: t.moveMult, staminaRegenMult: t.staminaRegenMult, status: t.status, canEat: t.canEat,
  })).sort((a, b) => b.min - a.min);
  return Object.freeze({ id: def.id, max: def.max, start: def.start, drainSeconds: def.drainSeconds, tiers: Object.freeze(tiers) });
}
