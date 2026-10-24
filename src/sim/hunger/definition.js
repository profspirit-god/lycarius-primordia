// The Primordia hunger definition as DATA (FOUNDER.md section 6, owner resolutions in FOUNDER.md section 12).
// Tuning lives here and nowhere else: change a number in this file, never in Hunger.js. Not wired into the game yet (H2 does that).
// A tier starts at `min` and runs up to the next tier's `min`; the top tier runs up to `max`. The stat is a real number, so
// "Hungry 8 to 24" in the design table means the tier changes the moment the value falls below 8, 25 and so on.
//
// DEFAULT TAKEN, flagged for the owner (see CHANGELOG V1.17.0.00): `start` is 85, not the 100 of the first draft. At 100 a new
// character would begin in the Stuffed tier (cannot eat, -10% move speed) for its first 15 minutes, which contradicts the
// "start with nothing" fantasy and the rule that debuffs must be earned. 85 is the Full tier. It is one number to change.

/** Validated by `validateHungerDef` (see validateHunger.js for every field and limit). */
export const PRIMORDIA_HUNGER = {
  id: "hunger",
  max: 100,
  start: 85,
  drainSeconds: 90, // 1 point per 90 s of sim time: 100 to 0 in 9000 s (2.5 hours)
  tiers: [
    { id: "stuffed", min: 90, regenMult: 1.05, moveMult: 0.9, staminaRegenMult: 1.05, status: "stuffed", canEat: false },
    { id: "full", min: 60, regenMult: 1.05, moveMult: 1, staminaRegenMult: 1.05, status: null, canEat: true },
    { id: "not_hungry", min: 25, regenMult: 1, moveMult: 1, staminaRegenMult: 1, status: null, canEat: true },
    { id: "hungry", min: 8, regenMult: 0.75, moveMult: 0.95, staminaRegenMult: 0.75, status: "hungry", canEat: true },
    { id: "starving", min: 0, regenMult: 0.5, moveMult: 0.9, staminaRegenMult: 0.5, status: "starving", canEat: true },
  ],
};
