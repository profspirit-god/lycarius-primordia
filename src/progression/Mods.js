/** Damage multipliers from a caster's specialization (`owner.mods`, see Progression). Casters without mods get 1. */
export const skillMult = (owner) => 1 + (owner?.mods?.skillDamage ?? 0);
export const elementMult = (owner, element) =>
  owner?.mods && owner.mods.element === element ? 1 + owner.mods.elementDamage : 1;
