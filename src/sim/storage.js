// Storage adapter contract (S1g) and the in-memory adapter. Simulation code never touches the browser's storage:
// it receives an object with `load()` and `save(data)` and nothing else.
//   load()      -> the saved plain-data object, or null when nothing usable is stored. Never throws.
//   save(data)  -> stores a plain-data object (numbers, strings, arrays, objects). Never throws.
// The client passes `core/LocalStorageAdapter.js`; tests, the loading screen's dry run and (later) the server
// pass this in-memory adapter or a database-backed one with the same two methods.

/** @typedef {{ load(): (object|null), save(data: object): void }} StorageAdapter */

/**
 * Keeps one plain-data object in memory. Values are copied through JSON on both sides, so a caller can never
 * mutate what is stored and a non-plain value fails the same way it would in a real store.
 * @param {object|null} [initial]
 * @returns {StorageAdapter & { clear(): void }}
 */
export function createMemoryStorage(initial = null) {
  let json = initial == null ? null : JSON.stringify(initial);
  return {
    load() {
      if (json == null) return null;
      try {
        return JSON.parse(json);
      } catch {
        return null;
      }
    },
    save(data) {
      try {
        json = JSON.stringify(data);
      } catch {
        /* not plain data: keep the previous save */
      }
    },
    clear() {
      json = null;
    },
  };
}
