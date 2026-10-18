/** Health + mana + stamina + regeneration. Reusable by players, dummies, and later enemies. Stamina is optional (0 = none). */
export class Vitals {
  constructor(stats) {
    this.configure(stats);
  }
  configure({ maxHp, maxMana, hpRegen, manaRegen, maxStamina = 0, staminaRegen = 0 }) {
    Object.assign(this, { maxHp, maxMana, hpRegen, manaRegen, maxStamina, staminaRegen });
    this.hp = maxHp;
    this.mana = maxMana;
    this.stamina = maxStamina;
  }
  update(dt) {
    if (this.hp <= 0) return;
    this.hp = Math.min(this.maxHp, this.hp + this.hpRegen * dt);
    this.mana = Math.min(this.maxMana, this.mana + this.manaRegen * dt);
    this.stamina = Math.min(this.maxStamina, this.stamina + this.staminaRegen * dt);
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
  /** Spend stamina if there is enough. Returns false (and spends nothing) otherwise. No skill uses it yet. */
  spendStamina(n) {
    if (this.stamina < n) return false;
    this.stamina -= n;
    return true;
  }
}
