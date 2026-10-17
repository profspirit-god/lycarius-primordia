/** Tiny pub/sub. Systems talk through events so features never hard-wire to each other. */
export class EventBus {
  constructor() { this.map = new Map(); }
  on(name, fn) {
    if (!this.map.has(name)) this.map.set(name, new Set());
    this.map.get(name).add(fn);
    return () => this.off(name, fn);
  }
  off(name, fn) { this.map.get(name)?.delete(fn); }
  emit(name, payload) { this.map.get(name)?.forEach((fn) => fn(payload)); }
}
