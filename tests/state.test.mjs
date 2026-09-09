import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, loadState, updateSettings } from '../src/state.js';

const sample = [{ id: 0, word: 'approach' }, { id: 1, word: 'maintain' }];

test('creates a home state with a complete vocabulary queue', () => {
  const state = createInitialState(sample);
  assert.equal(state.screen, 'home');
  assert.equal(state.queueIndex, 0);
  assert.deepEqual(state.queue, [0, 1]);
  assert.equal(state.newCursor, 2);
  assert.equal(state.revealed, false);
});

test('limits each learning session to the daily new-word setting', () => {
  const sampleWords = Array.from({ length: 25 }, (_, id) => ({ id, word: `word-${id}` }));
  const state = createInitialState(sampleWords);
  assert.equal(state.queue.length, 20);
  assert.deepEqual(state.queue.slice(0, 3), [0, 1, 2]);
  assert.equal(state.newCursor, 20);
});

test('loads a safe initial state when browser storage is unavailable', () => {
  const state = loadState(sample);
  assert.equal(state.screen, 'home');
  assert.deepEqual(state.settings, {
    exam: 'CET-4', targetScore: 550, examDate: '2026-12-19', dailyNew: 20, pronunciationPreference: 'uk', themePreference: 'system', themeUpdatedAt: state.settings.themeUpdatedAt, showProgress: true,
    preferences: { reading: true, listening: true, writing: true },
  });
});

test('updates score and daily words while rebuilding an untouched queue', () => {
  const sampleWords = Array.from({ length: 40 }, (_, id) => ({ id, word: `word-${id}` }));
  const updated = updateSettings(createInitialState(sampleWords), { targetScore: 600, dailyNew: 30 }, sampleWords);
  assert.equal(updated.settings.targetScore, 600);
  assert.equal(updated.settings.dailyNew, 30);
  assert.equal(updated.queue.length, 30);
  assert.equal(updated.newCursor, 30);
});

test('bounds invalid settings and retains an explicit pronunciation preference', () => {
  const updated = updateSettings(createInitialState(sample), { targetScore: '9999', dailyNew: '-3', pronunciationPreference: 'us' }, sample);
  assert.equal(updated.settings.targetScore, 710);
  assert.equal(updated.settings.dailyNew, 1);
  assert.equal(updated.settings.pronunciationPreference, 'us');
});
