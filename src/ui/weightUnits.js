// The game's own weight units (Veyt, Kirel, Theryn ...). DISPLAY ONLY, CLIENT ONLY: the sim stores integer milligrams (sim/items/weight.js)
// and never sees a name or a symbol here. `formatWeight` picks the unit that suits the weight, so a pouch reads "3.11 Kr", not "31,100 mg".
// Pure functions, no DOM.

/** Ascending. `mg` = the unit's equivalent weight in milligrams (1 g = 1,000 mg; 1 metric ton = 1,000,000 g). */
export const WEIGHT_UNITS = Object.freeze([
  { name: "Veyt", symbol: "Vt", mg: 1_000 },                 // 1 g
  { name: "Kirel", symbol: "Kr", mg: 10_000 },               // 10 g
  { name: "Draum", symbol: "Dr", mg: 100_000 },              // 100 g
  { name: "Velkar", symbol: "Vk", mg: 500_000 },             // 500 g
  { name: "Theryn", symbol: "Th", mg: 1_000_000 },           // 1 kg
  { name: "Korvath", symbol: "Kv", mg: 5_000_000 },          // 5 kg
  { name: "Maelor", symbol: "Ml", mg: 10_000_000 },          // 10 kg
  { name: "Dravon", symbol: "Dv", mg: 50_000_000 },          // 50 kg
  { name: "Aethron", symbol: "Ae", mg: 100_000_000 },        // 100 kg
  { name: "Graveth", symbol: "Gv", mg: 500_000_000 },        // 500 kg
  { name: "Taurak", symbol: "Tr", mg: 1_000_000_000 },       // 1 metric ton
  { name: "Orynth", symbol: "Or", mg: 10_000_000_000 },      // 10 metric tons
  { name: "Vaelthar", symbol: "Va", mg: 100_000_000_000 },   // 100 metric tons
  { name: "Kharvorn", symbol: "Kh", mg: 1_000_000_000_000 }, // 1,000 metric tons
].map(Object.freeze));

const DECIMALS = 100; // two decimals
const valid = (mg) => typeof mg === "number" && Number.isFinite(mg) && mg >= 0;
const round2 = (v) => Math.round(v * DECIMALS) / DECIMALS;

/** Find a unit by symbol or name (case sensitive), or null. */
export const findWeightUnit = (key) => WEIGHT_UNITS.find((u) => u.symbol === key || u.name === key) ?? null;

/**
 * The unit that suits a weight: the largest one that is not heavier than it, or the smallest (Veyt) for anything under 1 g.
 * A value that would round up to the next unit ("10 Dr") moves up to it ("1 Th").
 * @param {number} mg
 */
export function pickWeightUnit(mg) {
  let i = 0;
  if (valid(mg)) while (i + 1 < WEIGHT_UNITS.length && mg >= WEIGHT_UNITS[i + 1].mg) i++;
  const next = WEIGHT_UNITS[i + 1];
  if (valid(mg) && next && round2(mg / WEIGHT_UNITS[i].mg) * WEIGHT_UNITS[i].mg >= next.mg) i++;
  return WEIGHT_UNITS[i];
}

/**
 * "3.11 Kr". Up to two decimals, no trailing zeros, thousands separators. A bad value (negative, NaN, not a number) is "--".
 * @param {number} mg integer milligrams
 * @param {{ unit?: string|null }} [opts] `unit`: a symbol or name to force (a capacity bar shows both numbers in one unit)
 */
export function formatWeight(mg, { unit = null } = {}) {
  if (!valid(mg)) return "--";
  const u = (unit && findWeightUnit(unit)) || pickWeightUnit(mg);
  return `${round2(mg / u.mg).toLocaleString("en-US", { maximumFractionDigits: 2 })} ${u.symbol}`;
}
