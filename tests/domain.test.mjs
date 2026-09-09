import test from 'node:test';
import assert from 'node:assert/strict';
import { createUserWordState, migrateState, normalizeWord, STATE_SCHEMA_VERSION } from '../src/domain.js';

test('normalizes UK/US pronunciation and content fields without inventing missing data', () => {
  const word = normalizeWord({ id: 1, word: 'Schedule', phonetic: '/old/', meaning: '安排', category: '生活' });
  assert.equal(word.word, 'schedule');
  assert.equal(word.phoneticUK, '/old/');
  assert.equal(word.phoneticUS, '/old/');
  assert.deepEqual(word.categories, ['生活']);
  assert.equal(word.meaning, '安排');
  assert.deepEqual(word.meanings, [{ pos: '', meaning: '安排', explanation: '', priority: 'core', frequency: null }]);
  assert.equal(word.primaryMeaning.meaning, '安排');
  assert.deepEqual(word.partsOfSpeech, []);
  assert.deepEqual(word.exampleSentences, []);
  assert.deepEqual(word.examExamples, []);
  assert.equal(word.phonetics.uk.status, 'derived');
  assert.equal(word.dataQuality.meanings, 'verified');
});

test('preserves field-level phonetic provenance without changing legacy fields', () => {
  const word = normalizeWord({
    id: 3, word: 'test', meaning: '测试', phoneticUK: '/test/', phoneticUS: '/test/',
    phonetics: { uk: { ipa: '/test/', source: '词典样例', verified: true }, us: { ipa: '/test/', status: 'derived' } },
  });
  assert.equal(word.phoneticUK, '/test/');
  assert.equal(word.phonetics.uk.status, 'verified');
  assert.equal(word.phonetics.us.status, 'derived');
});

test('normalizes multiple parts of speech and keeps meaning-level CET priority', () => {
  const word = normalizeWord({
    id: 2,
    word: 'issue',
    meaning: '问题',
    partsOfSpeech: [
      { pos: 'noun', meanings: [{ meaning: '问题；议题', priority: 'cet_high', explanation: '需要讨论或解决的事情。' }] },
      { pos: 'verb', meanings: [{ meaning: '发布；发行', priority: 'secondary' }] },
    ],
    examExamples: [{ sentence: 'Development example.', sourceVerified: false }],
  });
  assert.deepEqual(word.partsOfSpeech.map((part) => part.pos), ['n.', 'v.']);
  assert.deepEqual(word.meanings.map((meaning) => meaning.meaning), ['问题；议题', '发布；发行']);
  assert.equal(word.primaryMeaning.meaning, '问题；议题');
  assert.equal(word.examExamples[0].sourceVerified, false);
});

test('creates a complete independent UserWordState', () => {
  const state = createUserWordState('a', 100);
  assert.equal(state.status, 'unseen');
  assert.equal(state.familiarity, 'unknown');
  assert.equal(state.createdAt, 100);
  assert.deepEqual(state.favoriteFolders, []);
});

test('migrates legacy queue and favorites while keeping valid ids only', () => {
  const migrated = migrateState({ queue: [1, 99], favorites: [1, 99], queueIndex: 1, settings: { targetScore: 600 } }, [{ id: 1, word: 'a' }, { id: 2, word: 'b' }], 100);
  assert.equal(migrated.schemaVersion, STATE_SCHEMA_VERSION);
  assert.deepEqual(migrated.queue, [1]);
  assert.deepEqual(migrated.favorites, [1]);
  assert.equal(migrated.wordStates['1'].favorite, true);
  assert.equal(migrated.settings.targetScore, 600);
});

test('migrates a persisted review session mode', () => {
  const words = [{ id: 1, word: 'one' }, { id: 2, word: 'two' }];
  const migrated = migrateState({ sessionMode: 'review', queue: [1], queueIndex: 0 }, words, 100);
  assert.equal(migrated.sessionMode, 'review');
});

test('migrates persisted batch completion state', () => {
  const words = [{ id: 1, word: 'one' }, { id: 2, word: 'two' }];
  const migrated = migrateState({ completionType: 'batch', reviewScope: 'batch', sessionMode: 'daily', dailyTask: { date: '2026-09-09', batches: [{ id: '2026-09-09-1', newWordIds: [1], completedNewIds: [1], reviewPoolIds: [1] }], activeBatchId: '2026-09-09-1' } }, words, new Date(2026, 8, 9).getTime());
  assert.equal(migrated.completionType, 'batch');
  assert.equal(migrated.reviewScope, 'batch');
  assert.equal(migrateState({ completionType: 'other', reviewScope: 'other' }, words, 100).completionType, null);
});

test('restores the persisted home, library, study, and completion screens', () => {
  const words = [{ id: 1, word: 'one' }, { id: 2, word: 'two' }];
  for (const screen of ['home', 'library', 'study', 'complete']) {
    const restored = migrateState({ screen, queue: [1, 2], queueIndex: 1, dailyTask: { date: '2026-09-06', newWordIds: [1, 2], reviewWordIds: [], weakWordIds: [], completedNewIds: [1], completedReviewIds: [], completedWeakIds: [], completed: screen === 'complete' } }, words, 100);
    assert.equal(restored.screen, screen);
    assert.equal(restored.queue[restored.queueIndex], 2);
  }
});
