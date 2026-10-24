// Client-only: the storage adapter (see sim/storage.js) backed by the browser's localStorage. One key, one JSON value.
// The simulation never imports this file; WorldScene creates it and hands it to Progression.

/** localStorage key of the progression save. */
export const PROGRESS_KEY = "lycarius.primordia.progress";
/** localStorage key of the inventory save (sim/items/Inventory.js). A separate key and shape: it never touches the progression save. */
export const INVENTORY_KEY = "lycarius.primordia.inventory";
/** localStorage key of the job save (progression/JobProgress.js): job XP per character. Its own key and shape, like the two above. */
export const JOBS_KEY = "lycarius.primordia.jobs";
/** localStorage key of the stat training save (sim/stats/StatTraining.js): which stat tickets a character has used. Its own key and shape. */
export const TRAINING_KEY = "lycarius.primordia.training";

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
