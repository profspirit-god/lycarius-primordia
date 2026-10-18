import { Registry } from "../core/Registry.js";

export const SpecBonusRegistry = new Registry("specBonus");

/**
 * Specialization bonuses a player can pick on non-unlock levels. Pure data.
 * Exactly one of:  { stat, add }  adds to a base stat (maxMana, manaRegen)
 *                  { mod, add }   adds to an additive modifier (elementDamage, skillDamage)
 *                  { mod, mul }   multiplies a multiplier (castTimeMult, cooldownMult)
 * `per` is the display value of one pick, `unit` how to print it.
 */
export const SPEC_BONUSES = [
  { id: "mana", name: "Max Mana", icon: "💧", text: "+10 max mana", stat: "maxMana", add: 10 },
  { id: "manaRegen", name: "Mana Regen", icon: "🌀", text: "+0.25 mana per second", stat: "manaRegen", add: 0.25 },
  { id: "castTime", name: "Cast Time", icon: "⏳", text: "-5% cast time", mod: "castTimeMult", mul: 0.95 },
  { id: "cooldown", name: "Skill Cooldown", icon: "⏱️", text: "-5% skill cooldown", mod: "cooldownMult", mul: 0.95 },
  { id: "element", name: "Element Damage", icon: "🔥", text: "+5% damage of the specialization element", mod: "elementDamage", add: 0.05 },
  { id: "skill", name: "Skill Damage", icon: "✨", text: "+5% skill damage", mod: "skillDamage", add: 0.05 },
];

/**
 * Fold chosen bonuses into one modifier object.
 * @param {Object<number,string>} picks level -> bonus id
 * @param {string} element specialization element, e.g. "fire"
 */
export function computeMods(picks, element) {
  const m = {
    element,
    castTimeMult: 1,
    cooldownMult: 1,
    elementDamage: 0,
    skillDamage: 0,
    stats: { maxMana: 0, manaRegen: 0 },
    counts: {},
  };
  for (const id of Object.values(picks)) {
    const b = SpecBonusRegistry.items.get(id);
    if (!b) continue;
    m.counts[id] = (m.counts[id] ?? 0) + 1;
    if (b.stat) m.stats[b.stat] += b.add;
    else if (b.mul) m[b.mod] *= b.mul;
    else m[b.mod] += b.add;
  }
  return m;
}
