const KEY = 'lycarius.primordia.settings';
const DEFAULTS = { masterVolume: 0.8, particleQuality: 1, screenShake: true, damageNumbers: true, showDebug: false, dummyAttacks: false };

/** Persistent user settings. Add a key to DEFAULTS and it is saved/loaded automatically. */
export const Settings = {
  data: { ...DEFAULTS },
  load() {
    try { Object.assign(this.data, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* ignore corrupt data */ }
  },
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* storage unavailable */ } },
  get(k) { return this.data[k]; },
  set(k, v) { this.data[k] = v; this.save(); },
  reset() { this.data = { ...DEFAULTS }; this.save(); },
};
