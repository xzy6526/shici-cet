import test from 'node:test';
import assert from 'node:assert/strict';
import { createThemeService, resolveTheme } from '../src/services/theme.js';
import { createInitialState, setThemePreference } from '../src/state.js';

test('resolves system theme from the device and preserves manual overrides', () => {
  assert.equal(resolveTheme('system', false), 'light');
  assert.equal(resolveTheme('system', true), 'dark');
  assert.equal(resolveTheme('light', true), 'light');
  assert.equal(resolveTheme('dark', false), 'dark');
});

test('persists a valid theme preference with a timestamp', () => {
  const state = createInitialState([{ id: 1, word: 'one' }]);
  const updated = setThemePreference(state, 'dark', 123);
  assert.equal(updated.settings.themePreference, 'dark');
  assert.equal(updated.settings.themeUpdatedAt, 123);
});

test('updates a system preference when the device theme changes', () => {
  let listener;
  const mediaQuery = { matches: false, addEventListener: (_event, callback) => { listener = callback; }, removeEventListener() {} };
  const meta = { setAttribute() {} };
  const documentRef = { documentElement: { dataset: {} }, querySelector: () => meta };
  const service = createThemeService({ documentRef, mediaQuery });
  service.setPreference('system');
  service.subscribeSystemTheme();
  mediaQuery.matches = true;
  listener();
  assert.equal(documentRef.documentElement.dataset.theme, 'dark');
});
