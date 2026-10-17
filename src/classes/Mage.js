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
  },
  skills: ["fireball", "flameShield", "burnResistance"],
  bindings: {
    fireball: ["Mouse0", "Space"],
    flameShield: ["Mouse2", "KeyE"],
    burnResistance: ["KeyQ"],
  },
};
