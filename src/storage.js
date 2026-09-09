import { migrateState, createInitialState } from './domain.js';
import { storageKey } from './state.js';

export const IMPORT_STORAGE_KEY = 'shici-cet-imported-words-v1';

export function createStorage(storageLike = globalThis.localStorage) {
  return {
    get(key, fallback = null) {
      try {
        const raw = storageLike?.getItem(key);
        return raw == null ? fallback : JSON.parse(raw);
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        storageLike?.setItem(key, JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    },
    remove(key) {
      try { storageLike?.removeItem(key); } catch { /* best effort */ }
    },
  };
}

export function loadAppData(words, storageLike = globalThis.localStorage) {
  const storage = createStorage(storageLike);
  const saved = storage.get(storageKey(), null);
  const importedWords = storage.get(IMPORT_STORAGE_KEY, []);
  return {
    state: saved ? migrateState(saved, words, Date.now()) : createInitialState(words),
    importedWords: Array.isArray(importedWords) ? importedWords.filter((word) => word?.id != null && word?.word) : [],
  };
}

export function saveAppData({ state, importedWords = [] } = {}, storageLike = globalThis.localStorage) {
  const storage = createStorage(storageLike);
  const stateSaved = storage.set(storageKey(), state);
  const importedSaved = storage.set(IMPORT_STORAGE_KEY, importedWords);
  return stateSaved && importedSaved;
}
