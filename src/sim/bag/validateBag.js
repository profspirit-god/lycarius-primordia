// Bag definitions (M1, docs/proposals/Marble-bag-engine.md sections 3 and 4): the STATIC description of one bag of outcome tokens.
// A definition holds no draws, order or owner: that is runtime state (Bag.js). Every limit is a constant here (Claude.md 5b, R11),
// because a definition will later come from content files and a saved bag from a database.
// Sim code: no browser, no clock, no randomness (Claude.md 5b). Not wired into the game yet (M2 does that).

/**
 * Who owns a bag. M1 only validates the word; the bag does not know its owner (the code that holds it keys it).
 * The combat default (per attacker or per skill) is still an open decision before M2 (ASSESSMENT 3.2), so this list may change then.
 */
export const BAG_SCOPES = ["entity", "skill", "item", "world"];
/**
 * What happens when the last token is drawn. `refill_shuffle` deals a fresh shuffled copy of the configured pool on the next draw.
 * `no_refill` keeps the bag empty (draw fails with reason "empty"). Other policies of the proposal (`single_use`, `conditional`)
 * need item instances or gates and arrive with M3 / M4.
 */
export const BAG_REFILLS = ["refill_shuffle", "no_refill"];
export const BAG_ID_PATTERN = /^[a-z][a-z0-9_]{1,39}$/;
/** Token names are upper case words, like the proposal's NORMAL and CRIT. */
export const TOKEN_PATTERN = /^[A-Z][A-Z0-9_]{0,23}$/;
export const MAX_TOKEN_KINDS = 16;
export const MAX_TOKEN_COUNT = 1000;
/** Tokens in one full cycle, all kinds together. Bounds memory, shuffle time and the size of a save. */
export const MAX_POOL = 1000;

/** The only keys a definition may have, and all of them are required: nothing is left to a default (design law 2). */
const KEYS = ["id", "scope", "tokens", "refill", "hidden"];

const isPlain = (v) => v !== null && typeof v === "object" && !Array.isArray(v) &&
  (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);

/**
 * Returns a list of problems (empty = valid). Never throws for any JSON-shaped input.
 * @param {unknown} def `{ id, scope, tokens: { NAME: count }, refill, hidden }`
 * @returns {string[]}
 */
export function validateBagDef(def) {
  if (!isPlain(def)) return ["definition must be an object"];
  const errs = [];
  for (const k of Object.keys(def)) if (!KEYS.includes(k)) errs.push(`unknown field "${k}"`);
  for (const k of KEYS) if (!(k in def)) errs.push(`missing field "${k}"`);
  if ("id" in def && (typeof def.id !== "string" || !BAG_ID_PATTERN.test(def.id))) errs.push("id must match " + BAG_ID_PATTERN);
  if ("scope" in def && !BAG_SCOPES.includes(def.scope)) errs.push("scope must be one of " + BAG_SCOPES.join(", "));
  if ("refill" in def && !BAG_REFILLS.includes(def.refill)) errs.push("refill must be one of " + BAG_REFILLS.join(", "));
  if ("hidden" in def && typeof def.hidden !== "boolean") errs.push("hidden must be true or false");
  if ("tokens" in def) {
    if (!isPlain(def.tokens)) errs.push("tokens must be an object of NAME: count");
    else {
      const names = Object.keys(def.tokens);
      let total = 0;
      if (names.length < 1 || names.length > MAX_TOKEN_KINDS) errs.push(`tokens must have 1 to ${MAX_TOKEN_KINDS} kinds`);
      for (const name of names) {
        const n = def.tokens[name];
        if (!TOKEN_PATTERN.test(name)) errs.push(`token name "${name.slice(0, 30)}" must match ${TOKEN_PATTERN}`);
        if (!Number.isInteger(n) || n < 1 || n > MAX_TOKEN_COUNT) errs.push(`token "${name.slice(0, 30)}" count must be an integer from 1 to ${MAX_TOKEN_COUNT}`);
        else total += n;
      }
      if (total > MAX_POOL) errs.push(`a cycle may hold at most ${MAX_POOL} tokens in all (has ${total})`);
    }
  }
  return errs;
}

/**
 * Validated copy of a definition, frozen, with the tokens as `[name, count]` pairs sorted by name. The sort makes the starting
 * order of a cycle independent of object key order, so one seed always deals the same bag (Claude.md 5b R9). Throws with every
 * problem listed, like `defineItem`.
 * @param {unknown} def
 * @returns {Readonly<{ id: string, scope: string, refill: string, hidden: boolean, tokens: ReadonlyArray<Readonly<[string, number]>> }>}
 */
export function normalizeBagDef(def) {
  const errs = validateBagDef(def);
  if (errs.length) throw new Error(`[bag] invalid definition ${JSON.stringify(isPlain(def) ? String(def.id).slice(0, 40) : null)}: ${errs.join("; ")}`);
  const tokens = Object.keys(def.tokens).sort().map((name) => Object.freeze([name, def.tokens[name]]));
  return Object.freeze({ id: def.id, scope: def.scope, refill: def.refill, hidden: def.hidden, tokens: Object.freeze(tokens) });
}
