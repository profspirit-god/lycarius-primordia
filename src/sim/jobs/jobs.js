// Jobs (track J, J1 = Lumberjack): data and tuning only. A JOB is a career you level by doing its work (chopping, later mining ...),
// separate from the class (Mage) and from its XP: job XP never touches character or specialization XP. A TOOL is the equipment a
// job action needs; it is keyed by the ITEM id, because an item definition has no tool fields (sim/items/ItemRegistry.js KEYS).
// Sim code: no browser, no clock, no randomness (Claude.md 5b). Constants for tuning stay at the top.
import { BASIC_AXE_ID } from "../items/lumber.js";

export const LUMBERJACK = "lumberjack";

/** @type {Record<string, { id: string, name: string, maxLevel: number }>} */
export const JOBS = {
  [LUMBERJACK]: { id: LUMBERJACK, name: "Lumberjack", maxLevel: 20 },
};
export const jobIds = () => Object.keys(JOBS).sort(); // never registration order (R9)

/** XP needed to go from job level `lv` to `lv + 1`. */
export const jobXpForNext = (lv) => Math.round(60 * Math.pow(lv, 1.5));
/** Largest job XP total a save may hold (R11): far above what level 20 needs, small enough to stay an exact integer. */
export const MAX_JOB_XP = 1_000_000_000;

export const CHOP_XP = 3; // job XP for each swing that lands on a standing tree
export const FELL_XP = 15; // extra job XP for the swing that fells it

/**
 * Tools. `reach` is px from the user's body edge to the tree's trunk edge, `arc` the half-angle (radians) of the swing in front.
 * @type {Record<string, { id: string, job: string, reach: number, arc: number, staminaCost: number }>}
 */
export const TOOLS = {
  [BASIC_AXE_ID]: { id: BASIC_AXE_ID, job: LUMBERJACK, reach: 44, arc: 0.9, staminaCost: 8 },
};
export const toolIds = () => Object.keys(TOOLS).sort();
