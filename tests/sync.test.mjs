import test from 'node:test';
import assert from 'node:assert/strict';
import { createSyncService, mergeLearningState, mergeWordState } from '../src/services/sync.js';

test('merges a word without double-counting shared history and preserves favorites', () => {
  const local = { wordId: 1, status: 'learning', reviewCount: 5, correctCount: 4, wrongCount: 1, favorite: false, updatedAt: 100 };
  const cloud = { wordId: 1, status: 'reviewing', reviewCount: 3, correctCount: 2, wrongCount: 1, favorite: true, updatedAt: 200 };
  const merged = mergeWordState(local, cloud);
  assert.equal(merged.status, 'reviewing');
  assert.equal(merged.reviewCount, 5);
  assert.equal(merged.correctCount, 4);
  assert.equal(merged.wrongCount, 1);
  assert.equal(merged.favorite, true);
});

test('keeps the local daily task while merging cloud learning records and newer theme', () => {
  const local = {
    dailyTask: { date: '2026-09-06', currentIndex: 7 },
    wordStates: { '1': { wordId: 1, reviewCount: 2, favorite: false, updatedAt: 100 } },
    settings: { themePreference: 'dark', themeUpdatedAt: 500 },
    stats: { totalLearned: 2 },
  };
  const cloud = {
    wordStates: { '1': { wordId: 1, reviewCount: 1, favorite: true, updatedAt: 200 }, '2': { wordId: 2, reviewCount: 1, updatedAt: 200 } },
    settings: { themePreference: 'system', themeUpdatedAt: 100 },
    stats: { totalLearned: 1 },
  };
  const merged = mergeLearningState(local, cloud);
  assert.deepEqual(merged.dailyTask, local.dailyTask);
  assert.equal(merged.wordStates['1'].favorite, true);
  assert.equal(merged.wordStates['1'].reviewCount, 2);
  assert.equal(merged.wordStates['2'].reviewCount, 1);
  assert.equal(merged.settings.themePreference, 'dark');
});

test('restores settings and word state from cloud when the device has no learning data', () => {
  const local = { wordStates: {}, completed: [], stats: { totalLearned: 0 }, settings: { themePreference: 'system', themeUpdatedAt: 500 } };
  const cloud = { wordStates: { '2': { wordId: 2, reviewCount: 3, favorite: true, updatedAt: 100 } }, settings: { themePreference: 'dark', themeUpdatedAt: 100, targetScore: 600 }, stats: { totalLearned: 3 } };
  const merged = mergeLearningState(local, cloud);
  assert.equal(merged.settings.themePreference, 'dark');
  assert.equal(merged.settings.targetScore, 600);
  assert.equal(merged.wordStates['2'].reviewCount, 3);
});

test('uploads only user state rows for an authenticated account', async () => {
  const calls = [];
  const client = { from(table) { return { upsert: async (value, options) => { calls.push({ table, value, options }); return { error: null }; } }; } };
  await createSyncService(client).uploadLocalState('user-1', { settings: { themePreference: 'dark' }, stats: { totalLearned: 1 }, wordStates: { '1': { wordId: 1, favorite: true, updatedAt: 100 } } });
  assert.deepEqual(calls.map((call) => call.table), ['profiles', 'user_settings', 'user_word_states']);
  assert.equal(calls[2].value[0].word_id, '1');
  assert.equal(calls[2].value[0].favorite, true);
});

test('uploads only changed word states after the initial cloud sync', async () => {
  const calls = [];
  const client = { from(table) { return { upsert: async (value, options) => { calls.push({ table, value, options }); return { error: null }; } }; } };
  const service = createSyncService(client);
  const state = { settings: {}, stats: {}, wordStates: {
    '1': { wordId: 1, reviewCount: 1, updatedAt: 100 },
    '2': { wordId: 2, reviewCount: 1, updatedAt: 100 },
  } };
  await service.uploadLocalState('user-1', state);
  calls.length = 0;
  state.wordStates['2'] = { ...state.wordStates['2'], reviewCount: 2, updatedAt: 200 };
  await service.uploadLocalState('user-1', state, { incremental: true });
  const wordUpload = calls.find((call) => call.table === 'user_word_states');
  assert.equal(wordUpload.value.length, 1);
  assert.equal(wordUpload.value[0].word_id, '2');
});
