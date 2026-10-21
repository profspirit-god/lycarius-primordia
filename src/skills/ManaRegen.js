import { ManaRegenEffect } from "./ManaRegenEffect.js";

const DURATION = 30; // seconds the boost lasts
const REGEN_MULT = 5; // mana regeneration multiplier while it lasts (the Mage's base 1/s becomes 5/s)

/**
 * Mage passive: no cost, no cast time, boosts mana regeneration for 30 s, 3 minute cooldown.
 * Granted at specialization level 1 (it sits in `specialization.start`), so a Mage owns it right after class selection.
 * It is an `instant` skill: one press (F) triggers it, SkillCaster does the cooldown. State lives in ManaRegenEffect.
 * Visuals are a listener (systems/ManaRegenFx.js) on the 'manaRegen' event.
 */
/** @type {import('../types.js').SkillDef} */
export const ManaRegen = {
  id: "manaRegen",
  name: "Mana Regen",
  icon: "manaRegen",
  color: "#5ab4ff",
  hint: "F",
  instant: true,
  cooldown: 180,
  chargeTime: 0,
  minCharge: 0,
  duration: DURATION,
  regenMult: REGEN_MULT,
  costText: "Free",

  manaCost() {
    return 0;
  },
  canStart() {
    return true;
  },
  isActive(owner) {
    return !!owner.manaBuff;
  },
  /** Fraction of the boost left, for the HUD ring. */
  activeFrac(owner) {
    return owner.manaBuff ? owner.manaBuff.life / owner.manaBuff.maxLife : 0;
  },

  onRelease({ owner, world }) {
    if (owner.manaBuff) {
      owner.manaBuff.refresh();
      return;
    }
    owner.manaBuff = world.spawn(new ManaRegenEffect({ owner, duration: DURATION, mult: REGEN_MULT }));
    world.events.emit("manaRegen", { type: "up", owner, x: owner.x, y: owner.y, z: 0 });
  },
};
