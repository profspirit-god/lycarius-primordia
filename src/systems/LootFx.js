// Loot presentation (view, client only): shows what LootSystem paid as floating text. Reads `loot` events, never changes sim state.
// A kill drop pops up where the Graugr fell, a raid reward over the player; a refused payment says so in red.
const GOLD = "#f2c46d";
const REFUSED = "#ff8a6a";
const LIFT = 34; // px above the ground point, so the text clears the body

export class LootFx {
  constructor(world) {
    this.world = world;
    this.off = world.events.on("loot", (e) => this.onLoot(e));
  }
  dispose() {
    this.off();
  }
  onLoot(e) {
    const text = e.ok ? `+${e.amount} gold` : "Inventory full";
    this.world.damageNumbers.spawn(e.x, e.y - LIFT, text, { color: e.ok ? GOLD : REFUSED, crit: e.from === "raid" });
  }
}
