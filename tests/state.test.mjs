import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, loadState, updateSettings } from '../src/state.js';
import { migrateState } from '../src/domain.js';

const sample = [{ id: 0, word: 'approach' }, { id: 1, word: 'maintain' }];

test('creates a home state with a complete vocabulary queue', () => {
  const state = createInitialState(sample);
  assert.equal(state.screen, 'home');
  assert.equal(state.queueIndex, 0);
  assert.deepEqual(state.queue, [0, 1]);
  assert.equal(state.newCursor, 2);
  assert.equal(state.revealed, false);
  assert.equal(state.assessment, null);
  assert.equal(state.vocabularyProfile, null);
  assert.equal(state.adaptivePlan, null);
  assert.equal(state.settings.learningIntensity, 'standard');
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
    learningIntensity: 'standard',
  });
});

test('updates score and daily words while rebuilding an untouched queue', () => {
  const sampleWords = Array.from({ length: 40 }, (_, id) => ({ id, word: `word-${id}` }));
  const updated = updateSettings(createInitialState(sampleWords), { targetScore: 600, dailyNew: 30, examDate: '2027-06-12' }, sampleWords);
  assert.equal(updated.settings.targetScore, 600);
  assert.equal(updated.settings.dailyNew, 30);
  assert.equal(updated.settings.examDate, '2027-06-12');
  assert.equal(updated.queue.length, 30);
  assert.equal(updated.newCursor, 30);
});

test('bounds invalid settings and retains an explicit pronunciation preference', () => {
  const updated = updateSettings(createInitialState(sample), { targetScore: '9999', dailyNew: '-3', pronunciationPreference: 'us', learningIntensity: 'intensive' }, sample);
  assert.equal(updated.settings.targetScore, 710);
  assert.equal(updated.settings.dailyNew, 1);
  assert.equal(updated.settings.pronunciationPreference, 'us');
  assert.equal(updated.settings.learningIntensity, 'intensive');
});

test('migration preserves an unfinished assessment and existing word learning state', () => {
  const saved = {
    wordStates: { 0: { wordId: 0, status: 'learning', reviewCount: 3 } },
    assessment: { seed: 'resume', answers: [{ wordId: 1, correct: true }], testedWordIds: [1], estimatedLevel: 4, completed: false },
  };
  const migrated = migrateState(saved, sample, 1000);
  assert.equal(migrated.assessment.seed, 'resume');
  assert.equal(migrated.assessment.answers.length, 1);
  assert.equal(migrated.wordStates['0'].status, 'learning');
  assert.equal(migrated.wordStates['0'].reviewCount, 3);
});

test('an old user with real study history receives a history profile and is not forced into assessment', () => {
  const saved = {
    history: { '2026-09-09': { learnedIds: [0], ratings: { known: 1, fuzzy: 0, unknown: 0 } } },
    wordStates: { 0: { wordId: 0, status: 'reviewing', correctCount: 2, reviewCount: 2 } },
  };
  const migrated = migrateState(saved, sample, 1000);
  assert.equal(migrated.vocabularyProfile.source, 'history');
  assert.equal(migrated.vocabularyProfile.testedWords.length, 0);
});
