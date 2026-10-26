// The Primordia hunger definition as DATA (FOUNDER.md section 6, owner resolutions R11 to R20 in FOUNDER.md section 12).
// Tuning lives here and nowhere else: change a number in this file, never in Hunger.js. Wired into the player by H2a (V1.23.0.00).
//
// The stat is counted in HUNGER POINTS, 0 to 1000, and shown as a percentage (R16): 10 points are 1%. A tier starts at `min` and runs
// up to the next tier's `min`; the top tier runs up to `max`. The stat is a real number, so "Hungry 8% to 24%" means the tier changes the
// moment the value falls below 80 points (8%), 250 points (25%) and so on. The HUD shows `Hunger.percent`.
// All multiplier values are PROVISIONAL (inherited from the first design table, tuned in one pass after H2b is playable).
// Regeneration is separate per stat (R18); mana stays at 1.0 in every tier until the owner sets values.
//
// DEFAULT TAKEN, flagged for the owner (R11): `start` is 850 (85%, the Full tier), not the maximum. At 100% a new character would begin
// Stuffed (-10% move speed) for its first 15 minutes, which contradicts the "start with nothing" fantasy. One number to change.

/** On respawn the stat is raised to at least this many points (R20: 25%, the start of the \"not hungry\" tier). Death never lowers it. */
export const HUNGER_RESPAWN_FLOOR = 250;

/** Validated by `validateHungerDef` (see validateHunger.js for every field and limit). */
export const PRIMORDIA_HUNGER = {
  id: "hunger",
  max: 1000, // hunger points (100%)
  start: 850, // 85%
  drainSeconds: 9, // 1 point per 9 s of sim time: 1000 to 0 in 9000 s (2.5 hours), the same pace as the first design
  tiers: [
    { id: "stuffed", min: 900, hpRegenMult: 1.05, manaRegenMult: 1, staminaRegenMult: 1, moveMult: 0.9, status: "stuffed" }, // 90% to 100%
    { id: "full", min: 600, hpRegenMult: 1.05, manaRegenMult: 1, staminaRegenMult: 1, moveMult: 1, status: null }, // 60% to 89%
    { id: "not_hungry", min: 250, hpRegenMult: 1, manaRegenMult: 1, staminaRegenMult: 1, moveMult: 1, status: null }, // 25% to 59%
    { id: "hungry", min: 80, hpRegenMult: 0.75, manaRegenMult: 1, staminaRegenMult: 0.75, moveMult: 0.95, status: "hungry" }, // 8% to 24%
    { id: "starving", min: 0, hpRegenMult: 0.5, manaRegenMult: 1, staminaRegenMult: 0.5, moveMult: 0.85, status: "starving" }, // 0% to 7%
  ],
};
