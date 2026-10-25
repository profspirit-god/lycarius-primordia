// Hunger definitions (H1, aligned by H1b with FOUNDER.md section 6): the STATIC description of the hunger stat and its tiers.
// A definition holds no current value: that is runtime state (Hunger.js). Every limit is a constant here (Claude.md 5b, R11),
// because a definition will later come from content files and a saved value from a database.
// Sim code: no browser, no clock, no randomness (Claude.md 5b). Not wired into the game yet (H2a does that).
//
// The stat is counted in HUNGER POINTS (the maximum is usually 1000) and shown to the player as a percentage (R16); a tier's `min` is
// in points. Regeneration is SEPARATE per stat (R18): a tier carries `hpRegenMult`, `manaRegenMult` and `staminaRegenMult`.
//
// The guardrails of the hunger law are enforced HERE, so no tier table can break them:
//  - a tier never damages: it only carries multipliers and a status id. (Hunger may damage but never kill, FOUNDER.md 6b, R12, and
//    only through statuses, non-lethal, never below 1 HP: later work, track HS);
//  - no tier slows movement by more than 15% (`MIN_MOVE_MULT`); all hunger sources together never go below 75% (`HUNGER_MOVE_FLOOR`,
//    applied by the modifier layer, row X1), so a player can never be trapped;
//  - no tier switches a regeneration off (`MIN_MULT`), so hunger never stops recovery completely;
//  - food is never a soft-lock: `Hunger.eat` accepts food whenever the stat is below its maximum, in every tier, so no tier carries
//    an "eat" switch any more.

export const HUNGER_ID_PATTERN = /^[a-z][a-z0-9_]{1,39}$/;
export const TIER_ID_PATTERN = /^[a-z][a-z0-9_]{1,23}$/;
/** Status ids are the names `StatusSystem` will know in H2b (for example "hungry"); `null` = no status. */
export const STATUS_ID_PATTERN = /^[a-z][a-z0-9_]{1,23}$/;
export const MAX_TIERS = 8;
export const MIN_TIERS = 2;
export const MAX_VALUE_LIMIT = 1000;
export const MIN_DRAIN_SECONDS = 1;
export const MAX_DRAIN_SECONDS = 3600;
/** Multiplier limits: a modifier may weaken or strengthen a rate, never turn it off or make it huge. */
export const MIN_MULT = 0.1;
export const MAX_MULT = 2;
/** The hunger law, per tier: a tier slows movement by at most 15% (R14). */
export const MIN_MOVE_MULT = 0.85;
/** The hunger law, in total: all hunger sources together (tier and statuses) never slow movement below 75% of normal (R14). The
 *  modifier layer (row X1) applies this floor to the product; it is kept here with the rest of the law. */
export const HUNGER_MOVE_FLOOR = 0.75;

const KEYS = ["id", "max", "start", "drainSeconds", "tiers"];
const TIER_KEYS = ["id", "min", "hpRegenMult", "manaRegenMult", "staminaRegenMult", "moveMult", "status"];
const REGEN_KEYS = ["hpRegenMult", "manaRegenMult", "staminaRegenMult"];

const isPlain = (v) => v !== null && typeof v === "object" && !Array.isArray(v) &&
  (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
const isNum = (v) => typeof v === "number" && Number.isFinite(v);

/**
 * Returns a list of problems (empty = valid). Never throws for any JSON-shaped input.
 * @param {unknown} def `{ id, max, start, drainSeconds, tiers: [{ id, min, hpRegenMult, manaRegenMult, staminaRegenMult, moveMult, status }] }`
 *   `max` and `start` are in hunger points; `drainSeconds` = seconds of play for the stat to fall by 1 point. A tier covers `min` up to
 *   the next tier's `min` (the top tier up to `max`).
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
      else mins.add(t.min);
    }
    for (const k of REGEN_KEYS) {
      if (k in t && (!isNum(t[k]) || t[k] < MIN_MULT || t[k] > MAX_MULT)) errs.push(`${at}: ${k} must be a number from ${MIN_MULT} to ${MAX_MULT}`);
    }
    if ("moveMult" in t && (!isNum(t.moveMult) || t.moveMult < MIN_MOVE_MULT || t.moveMult > MAX_MULT)) {
      errs.push(`${at}: moveMult must be a number from ${MIN_MOVE_MULT} (a tier never slows more than 15%) to ${MAX_MULT}`);
    }
    if ("status" in t && t.status !== null && (typeof t.status !== "string" || !STATUS_ID_PATTERN.test(t.status))) errs.push(`${at}: status must be null or match ${STATUS_ID_PATTERN}`);
  });
  if (!mins.has(0) && tiers.length >= MIN_TIERS) errs.push("one tier must start at min 0, so every value has a tier");
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
    id: t.id, min: t.min, hpRegenMult: t.hpRegenMult, manaRegenMult: t.manaRegenMult, staminaRegenMult: t.staminaRegenMult, moveMult: t.moveMult, status: t.status,
  })).sort((a, b) => b.min - a.min);
  return Object.freeze({ id: def.id, max: def.max, start: def.start, drainSeconds: def.drainSeconds, tiers: Object.freeze(tiers) });
}
