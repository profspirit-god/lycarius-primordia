/** Health + mana + regeneration. Reusable by players, dummies, and later enemies. */
export class Vitals {
  constructor(stats) {
    this.configure(stats);
  }
  configure({ maxHp, maxMana, hpRegen, manaRegen }) {
    Object.assign(this, { maxHp, maxMana, hpRegen, manaRegen });
    this.hp = maxHp;
    this.mana = maxMana;
  }
  update(dt) {
    if (this.hp <= 0) return;
    this.hp = Math.min(this.maxHp, this.hp + this.hpRegen * dt);
    this.mana = Math.min(this.maxMana, this.mana + this.manaRegen * dt);
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
}
