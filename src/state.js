import { createInitialState, migrateState, STATE_SCHEMA_VERSION } from './domain.js';

const STORAGE_KEY = 'shici-cet-state-v3';

function getStorage() {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function boundedNumber(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}

export { createInitialState };

export function loadState(words) {
  const initial = createInitialState(words);
  const storage = getStorage();
  if (!storage) return initial;
  try {
    const saved = JSON.parse(storage.getItem(STORAGE_KEY) || 'null');
    return migrateState(saved, words, Date.now());
  } catch {
    return initial;
  }
}

export function updateSettings(state, values, words) {
  const settings = {
    ...state.settings,
    targetScore: boundedNumber(values.targetScore, state.settings.targetScore, 1, 710),
    dailyNew: boundedNumber(values.dailyNew, state.settings.dailyNew, 1, 100),
    pronunciationPreference: values.pronunciationPreference === 'us' ? 'us' : (values.pronunciationPreference === 'uk' ? 'uk' : (state.settings.pronunciationPreference || 'uk')),
  };
  const untouched = state.queueIndex === 0 && state.completed.length === 0 && !state.revealed && !(state.pendingImported || []).length;
  if (!untouched) return { ...state, settings };
  const start = Math.max(0, state.newCursor - state.queue.length);
  const queue = (Array.isArray(words) ? words : []).slice(start, start + settings.dailyNew).map((word) => word.id);
  return { ...state, settings, queue, newCursor: start + queue.length, dailyTask: null };
}

export function setThemePreference(state, preference, now = Date.now()) {
  const themePreference = ['system', 'light', 'dark'].includes(preference) ? preference : 'system';
  return { ...state, settings: { ...state.settings, themePreference, themeUpdatedAt: now } };
}

export function saveState(state) {
  const storage = getStorage();
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ ...state, schemaVersion: STATE_SCHEMA_VERSION }));
    return true;
  } catch {
    return false;
  }
}

export function storageKey() {
  return STORAGE_KEY;
}
