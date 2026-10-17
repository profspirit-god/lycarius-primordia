/** Id -> definition map. Skills, classes (and later items, factions, quests) register here. */
export class Registry {
  constructor(name) { this.name = name; this.items = new Map(); }
  register(def) {
    if (!def?.id) throw new Error(`[${this.name}] definition needs an id`);
    this.items.set(def.id, def);
    return def;
  }
  get(id) {
    const d = this.items.get(id);
    if (!d) throw new Error(`[${this.name}] unknown id: "${id}"`);
    return d;
  }
  all() { return [...this.items.values()]; }
}
