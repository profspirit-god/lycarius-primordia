// Client-only: the storage adapter (see sim/storage.js) backed by the browser's localStorage. One key, one JSON value.
// The simulation never imports this file; WorldScene creates it and hands it to Progression.

/** localStorage key of the progression save. */
export const PROGRESS_KEY = "lycarius.primordia.progress";

/**
 * @param {string} key
 * @param {Pick<Storage, 'getItem'|'setItem'>} [backing] defaults to the browser's localStorage (read when used, so a missing one is only an error then)
 * @returns {import('../sim/storage.js').StorageAdapter}
 */
export function createLocalStorageAdapter(key, backing) {
  const store = () => backing ?? globalThis.localStorage;
  return {
    load() {
      try {
        const v = JSON.parse(store().getItem(key) || "null");
        return v && typeof v === "object" ? v : null;
      } catch {
        return null; // corrupt data or storage unavailable
      }
    },
    save(data) {
      try {
        store().setItem(key, JSON.stringify(data));
      } catch {
        /* storage unavailable or full */
      }
    },
  };
}
