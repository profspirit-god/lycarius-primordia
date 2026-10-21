import { Entity } from "../entities/Entity.js";

/**
 * The running Mana Regen boost. Spawned by ManaRegen and stored on `owner.manaBuff`.
 * Simulation only: it multiplies `owner.vitals.manaRegenMult` while it lives and puts it back when it ends
 * (timer ran out, or the owner was downed). Drawing is done by systems/ManaRegenFx.js, which reads these fields.
 * Replicated fields (clients need them): life, maxLife, mult, age.
 */
export class ManaRegenEffect extends Entity {
  constructor({ owner, duration, mult }) {
    super();
    Object.assign(this, { owner, life: duration, maxLife: duration, mult, age: 0 });
    owner.vitals.manaRegenMult = mult;
  }

  /** Cast again while running: the clock restarts. */
  refresh() {
    this.life = this.maxLife;
  }

  /** @param {'expired'|'downed'} reason */
  end(reason, world) {
    if (this.dead) return;
    this.dead = true;
    this.owner.vitals.manaRegenMult = 1;
    if (this.owner.manaBuff === this) this.owner.manaBuff = null;
    world?.events.emit("manaRegen", { type: "down", owner: this.owner, x: this.owner.x, y: this.owner.y, z: 0, reason });
  }

  update(dt, world) {
    if (this.dead) return;
    this.age += dt;
    this.life -= dt;
    if (this.owner.downed || this.owner.dead) this.end("downed", world);
    else if (this.life <= 0) this.end("expired", world);
  }
}
