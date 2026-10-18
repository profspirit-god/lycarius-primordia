/**
 * Awards experience to the player from world events. Create AFTER HitEffects and StatusSystem,
 * so a killing blow has already downed the target when the event reaches us.
 *   damage dealt to anything but yourself : 1 character XP + 1 specialization XP per point
 *   defeating a hostile dummy             : +50 character XP
 *   casting Fireball                      : +2 to +5 specialization XP (by charge)
 */
const KILL_XP = 50;

export class XpSystem {
  constructor(world) {
    this.world = world;
    this.offs = [
      world.events.on("hit", (e) => this.onHit(e)),
      world.events.on("burn", (e) => this.onBurn(e)),
      world.events.on("cast", (e) => this.onCast(e)),
    ];
  }
  dispose() {
    this.offs.forEach((off) => off());
  }
  get player() {
    return this.world.player;
  }

  damage(target, amount) {
    const p = this.player,
      prog = p.prog;
    if (!prog || target === p || amount <= 0) return;
    prog.addCharXp(amount);
    prog.addSpecXp(amount);
    if (target.downed && target.attack && !target.xpGiven) {
      target.xpGiven = true;
      prog.addCharXp(KILL_XP);
    }
  }
  onHit(e) {
    if (e.source === this.player) this.damage(e.target, e.damage);
  }
  onBurn(e) {
    if (e.type === "tick" && e.target.burn?.source === this.player) this.damage(e.target, e.damage);
  }
  onCast(e) {
    if (e.owner === this.player) this.player.prog?.addSpecXp(2 + Math.round(e.charge * 3));
  }
}
