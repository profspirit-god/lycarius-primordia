/** Class definition = pure data. Add Warrior/Rogue later by copying this shape. */
/** @type {import('../types.js').ClassDef} */
export const Mage = {
  id: "mage",
  name: "Mage",
  color: [112, 92, 224],
  stats: {
    speed: 230,
    radius: 16,
    height: 46,
    maxHp: 50,
    maxMana: 100,
    hpRegen: 0.1,
    manaRegen: 1,
    maxStamina: 100,
    staminaRegen: 8,
  },
  skills: ["fireball", "flameShield", "burnResistance"],
  // Class specialization (separate from character level): Lv1 starts with `start`, `unlocks` grant skills,
  // every other level above 1 grants one bonus pick (see progression/SpecBonuses.js).
  specialization: {
    element: "fire",
    maxLevel: 10,
    start: ["fireball"],
    unlocks: { 5: "flameShield", 10: "burnResistance" },
  },
  bindings: {
    fireball: ["Mouse0", "Space"],
    flameShield: ["Mouse2", "KeyE"],
    burnResistance: ["KeyQ"],
  },
};
