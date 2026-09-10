import test from 'node:test';
import assert from 'node:assert/strict';
import { addBatchReviewWords, appendNewBatch, calculateStreak, createDailyTask, dateKey, daysUntilExam, getPendingReviewEntries, getPendingReviewIds } from '../src/tasks.js';

test('date helpers use local date keys and date-only exam arithmetic', () => {
  assert.equal(dateKey(new Date(2026, 8, 5, 23, 59)), '2026-09-05');
  assert.equal(daysUntilExam('2026-09-07', new Date(2026, 8, 5, 18)), 2);
  assert.equal(daysUntilExam('invalid', new Date(2026, 8, 5)), null);
});

test('streak counts consecutive study days only once per day', () => {
  const history = { '2026-09-03': { studied: true }, '2026-09-04': { learnedIds: ['a'] }, '2026-09-05': { reviewedIds: ['b'] } };
  assert.equal(calculateStreak(history, '2026-09-05'), 3);
  assert.equal(calculateStreak({ '2026-09-03': { studied: true }, '2026-09-05': { studied: true } }, '2026-09-05'), 1);
});

test('daily task is review first, then new words, with deterministic limit', () => {
  const words = Array.from({ length: 4 }, (_, id) => ({ id, word: `word-${id}`, isStudyWord: true, importanceScore: 10 - id, frequencyRank: id + 1 }));
  const options = { words, wordStates: { 0: { status: 'reviewing', nextReviewAt: 1, difficulty: .5 } }, settings: { dailyNew: 2 }, seed: 'test-user:1970-01-01', now: 10 };
  const task = createDailyTask(options);
  assert.deepEqual(task.reviewWordIds, [0]);
  assert.equal(task.newWordIds.length, 2);
  assert.equal(task.newWordIds.includes(0), false);
  assert.deepEqual(createDailyTask(options).newWordIds, task.newWordIds);
  assert.equal(task.currentStage, 'review');
});

test('same-day task keeps its original queue across a refresh', () => {
  const now = new Date(2026, 8, 5, 9).getTime();
  const first = createDailyTask({ words: Array.from({ length: 8 }, (_, id) => ({ id, word: `word-${id}`, isStudyWord: true, importanceScore: 20 - id, frequencyRank: id + 1 })), settings: { dailyNew: 4 }, now });
  const resumed = createDailyTask({ words: [], settings: { dailyNew: 1 }, now, previousTask: first });
  assert.deepEqual(resumed.newWordIds, first.newWordIds);
  assert.equal(resumed.completed, false);
});

test('pending review ids exclude completed review ids', () => {
  const task = { reviewWordIds: [1, 2, 3], completedReviewIds: [2] };
  assert.deepEqual(getPendingReviewIds(task), [1, 3]);
});

test('creates one batch with the configured size and empty review pool', () => {
  const words = Array.from({ length: 4 }, (_, id) => ({ id, word: `word-${id}`, isStudyWord: true, importanceScore: 20 - id, frequencyRank: id + 1 }));
  const task = createDailyTask({ words, settings: { dailyNew: 2 }, now: 100 });
  assert.equal(task.batchSize, 2);
  assert.equal(task.batches.length, 1);
  assert.equal(task.batches[0].newWordIds.length, 2);
  assert.deepEqual(task.reviewPoolIds, []);
});

test('appends a second batch only when explicitly requested and preserves the first batch', () => {
  const words = Array.from({ length: 4 }, (_, id) => ({ id, word: `word-${id}`, isStudyWord: true, importanceScore: 20 - id, frequencyRank: id + 1 }));
  const first = createDailyTask({ words, settings: { dailyNew: 2 }, now: 100 });
  const learned = Object.fromEntries(first.newWordIds.map((id) => [id, { status: 'reviewing' }]));
  const next = appendNewBatch(first, { words, wordStates: learned, settings: { dailyNew: 2 }, now: 101 });
  assert.deepEqual(next.batches[0].newWordIds, first.batches[0].newWordIds);
  assert.equal(next.batches[1].newWordIds.length, 2);
  assert.equal(next.batches[1].newWordIds.some((id) => next.batches[0].newWordIds.includes(id)), false);
  assert.equal(next.activeBatchId, next.batches[1].id);
});

test('same-day batch review ids are deduplicated across batches', () => {
  const words = Array.from({ length: 4 }, (_, id) => ({ id, word: `word-${id}`, isStudyWord: true, importanceScore: 20 - id, frequencyRank: id + 1 }));
  let task = createDailyTask({ words, settings: { dailyNew: 2 }, now: 100 });
  task = addBatchReviewWords(task, task.activeBatchId, [0, 1, 1]);
  task = appendNewBatch(task, { words, wordStates: { 0: { status: 'reviewing' }, 1: { status: 'reviewing' } }, settings: { dailyNew: 2 }, now: 101 });
  task = addBatchReviewWords(task, task.activeBatchId, [1, 2]);
  assert.deepEqual(task.reviewPoolIds, [0, 1, 2]);
});

test('pending review ids include historical and same-day pool ids without duplication', () => {
  const task = { reviewWordIds: [9, 1], completedReviewIds: [9], reviewPoolIds: [1, 2], completedReviewPoolIds: [] };
  assert.deepEqual(getPendingReviewIds(task), [1, 2]);
});

test('review entries prioritize same-day unknown, then vague, then due cards', () => {
  const task = {
    reviewWordIds: [9], completedReviewIds: [], reviewPoolIds: [2, 1], completedReviewPoolIds: [],
    batches: [{ resultById: { 1: 'hard', 2: 'again' } }],
  };
  assert.deepEqual(getPendingReviewEntries(task), [{ id: 2, stage: 'batch-review' }, { id: 1, stage: 'batch-review' }, { id: 9, stage: 'review' }]);
});
