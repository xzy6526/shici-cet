import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateStreak, createDailyTask, dateKey, daysUntilExam, getPendingReviewIds } from '../src/tasks.js';

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
  const task = createDailyTask({ words, wordStates: { 0: { status: 'reviewing', nextReviewAt: 1, difficulty: .5 } }, settings: { dailyNew: 2 }, now: 10 });
  assert.deepEqual(task.reviewWordIds, [0]);
  assert.deepEqual(task.newWordIds, [1, 2]);
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
