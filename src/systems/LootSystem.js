// Loot (sim): turns kills and cleared raids into carried gold. A listener, like XpSystem: it reads events and writes only through the
// Inventory service (`world.inventory`, set by the scene; absent = no loot, so a headless test world is unaffected). It never draws
// (LootFx shows the result from the `loot` event) and never touches the progression or wallet saves.
//   Graugr defeated by a player : 1 to 10 gold, one roll per kill
//   raid cleared                : 20 + 10 x raid number gold, paid to every player in the world (no roll)
// Gold goes straight into the killer's collection (no coin on the ground yet). A full inventory refuses it and the gold is lost:
// a `loot` event with `ok: false` says so. Replicated fields: the `loot` event `{ item, amount, owner, from, ok, reason?, total?, x, y }`.
// Sim code: no browser, no clock; the one roll uses `world.rng` (Claude.md 5b R3).
import { GOLD_ID } from "../sim/items/gameplay.js";

/** Gold one Graugr drops, inclusive. */
export const GRAUGR_GOLD = Object.freeze({ min: 1, max: 10 });
/** Raid reward: base + perRaid x the raid number (raid 1 = 30, raid 2 = 40 ...). */
export const RAID_GOLD = Object.freeze({ base: 20, perRaid: 10 });
export const raidGold = (number) => RAID_GOLD.base + RAID_GOLD.perRaid * Math.max(1, Math.floor(number) || 1);

export class LootSystem {
  constructor(world) {
    this.world = world;
    this.offs = [
      world.events.on("kill", (e) => this.onKill(e)),
      world.events.on("raid:cleared", (e) => this.onRaid(e)),
    ];
  }
  dispose() {
    this.offs.forEach((off) => off());
  }

  /** One integer from GRAUGR_GOLD.min to .max, each equally likely. */
  rollGraugrGold() {
    const { min, max } = GRAUGR_GOLD;
    return min + Math.floor(this.world.rng.next() * (max - min + 1));
  }

  /** Who gets gold: a player with a character id, and only when the world has an inventory service. */
  recipient(p) {
    return this.world.inventory && p?.isPlayer && typeof p.cls?.id === "string" ? p : null;
  }

  pay(p, amount, from, x, y) {
    const owner = p.cls.id, r = this.world.inventory.grant(GOLD_ID, amount, owner);
    this.world.events.emit("loot", { item: GOLD_ID, amount, owner, from, ok: r.ok, reason: r.ok ? undefined : r.reason, total: r.ok ? r.qty : undefined, x, y });
  }

  onKill(e) {
    if (!e.target?.isGraugr) return;
    const p = this.recipient(e.source);
    if (p) this.pay(p, this.rollGraugrGold(), "graugr", e.target.x, e.target.y);
  }

  /** A cleared raid pays every player in the world (a list in entity order, never `world.player`: Claude.md 5b R7). */
  onRaid(e) {
    for (const p of this.world.entities.filter((x) => x.isPlayer)) if (this.recipient(p)) this.pay(p, raidGold(e.number), "raid", p.x, p.y);
  }
}
