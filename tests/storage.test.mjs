import test from 'node:test';
import assert from 'node:assert/strict';
import { createStorage, loadAppData, saveAppData } from '../src/storage.js';

function fakeStorage() {
  const data = new Map();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: (key) => data.delete(key) };
}

test('storage adapter falls back safely on malformed JSON', () => {
  const storage = fakeStorage();
  storage.setItem('bad', '{broken');
  assert.deepEqual(createStorage(storage).get('bad', []), []);
});

test('app data round trips state and imported words', () => {
  const storage = fakeStorage();
  const state = { queue: [1], settings: { pronunciationPreference: 'us' } };
  assert.equal(saveAppData({ state, importedWords: [{ id: 'x', word: 'x' }] }, storage), true);
  const data = loadAppData([{ id: 1, word: 'a' }, { id: 'x', word: 'x' }], storage);
  assert.equal(data.state.settings.pronunciationPreference, 'us');
  assert.equal(data.importedWords[0].word, 'x');
});
