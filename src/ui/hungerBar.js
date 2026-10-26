// H2a: what the fourth HUD bar shows, as a pure function of a Hunger (view only, no DOM, no sim state). PlayerHud applies it to the
// element; a test can check it in Node. The bar shows a PERCENTAGE (FOUNDER.md 6a, R16), never the raw hunger points.

/** Display names of the tier ids (sim/hunger/definition.js). An unknown id is shown as it is. */
export const HUNGER_TIER_NAMES = Object.freeze({ stuffed: "Stuffed", full: "Full", not_hungry: "Not hungry", hungry: "Hungry", starving: "Starving" });

/**
 * @param {{ value: number, max: number, percent: number, tierId: string }} hunger a Hunger (or anything with these members)
 * @returns {{ frac: number, text: string, title: string, tier: string }} bar fill 0 to 1, the label, the tooltip and the tier id
 */
export function hungerBarModel(hunger) {
  const name = HUNGER_TIER_NAMES[hunger.tierId] ?? hunger.tierId;
  return {
    frac: hunger.max > 0 ? Math.min(1, Math.max(0, hunger.value / hunger.max)) : 0,
    text: `${hunger.percent}%`,
    title: `Hunger: ${name} (${hunger.percent}%)`,
    tier: hunger.tierId,
  };
}
