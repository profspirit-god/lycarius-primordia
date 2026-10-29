/** Health + mana + stamina + regeneration. Reusable by players, dummies, and later enemies. Stamina is optional (0 = none). */
export class Vitals {
  constructor(stats) {
    this.configure(stats);
  }
  configure({ maxHp, maxMana, hpRegen, manaRegen, maxStamina = 0, staminaRegen = 0 }) {
    Object.assign(this, { maxHp, maxMana, hpRegen, manaRegen, maxStamina, staminaRegen });
    this.manaRegenMult = 1; // Mana Regen boost multiplies this; owned by ManaRegenEffect
    this.temp ??= { hpRegen: 1, manaRegen: 1, staminaRegen: 1, staminaCost: 1 }; // X1: temporary multipliers, written by the owner from its StatModifiers; kept on configure
    this.hp = maxHp;
    this.mana = maxMana;
    this.stamina = maxStamina;
  }
  update(dt) {
    if (this.hp <= 0) return;
    const t = this.temp;
    this.hp = Math.min(this.maxHp, this.hp + this.hpRegen * t.hpRegen * dt);
    this.mana = Math.min(this.maxMana, this.mana + this.manaRegen * this.manaRegenMult * t.manaRegen * dt);
    this.stamina = Math.min(this.maxStamina, this.stamina + this.staminaRegen * t.staminaRegen * dt);
  }
  get dead() {
    return this.hp <= 0;
  }
  damage(n) {
    this.hp = Math.max(0, this.hp - n);
  }
  spend(n) {
    this.mana = Math.max(0, this.mana - n);
  }
  /** X1: what an action of base cost `n` really costs now (temporary cost multiplier). Skills check `stamina >= staminaCost(n)`. */
  staminaCost(n) {
    return n * this.temp.staminaCost;
  }
  /** Spend stamina (base cost `n`, scaled by `staminaCost`) if there is enough. Returns false (and spends nothing) otherwise. Dodge and Chop use it. */
  spendStamina(n) {
    const cost = this.staminaCost(n);
    if (this.stamina < cost) return false;
    this.stamina -= cost;
    return true;
  }
}
