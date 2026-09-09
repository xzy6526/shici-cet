import test from 'node:test';
import assert from 'node:assert/strict';
import { createDailyTask, markTaskItemComplete, updateTaskWeakWords } from '../src/tasks.js';
import { scheduleReview } from '../src/scheduler.js';

const words = Array.from({ length: 8 }, (_, id) => ({ id, word: `word-${id}`, isStudyWord: true, importanceScore: 20 - id, frequencyRank: id + 1 }));

test('a failed new word remains in the daily task for delayed weak reinforcement', () => {
  let task = createDailyTask({ words, settings: { dailyNew: 3 }, now: new Date(2026, 8, 5).getTime() });
  const failedId = task.newWordIds[0];
  task = updateTaskWeakWords(task, [failedId]);
  task = markTaskItemComplete(task, failedId, 'new');
  assert.deepEqual(task.weakWordIds, [failedId]);
  assert.equal(task.currentStage, 'new');
  task = markTaskItemComplete(task, task.newWordIds[1], 'new');
  task = markTaskItemComplete(task, task.newWordIds[2], 'new');
  assert.equal(task.currentStage, 'weak');
  task = markTaskItemComplete(task, failedId, 'weak');
  assert.equal(task.completed, true);
});

test('next-day due review is placed ahead of new words', () => {
  const now = new Date(2026, 8, 6).getTime();
  const task = createDailyTask({
    words,
    wordStates: { 4: { status: 'reviewing', nextReviewAt: now - 1, difficulty: .5, mistakeCount: 0 } },
    settings: { dailyNew: 2 },
    now,
  });
  assert.deepEqual(task.reviewWordIds, [4]);
  assert.equal(task.currentStage, 'review');
});

test('persisted scheduling data preserves the resume cursor and current word id', () => {
  const scheduled = scheduleReview({ status: 'unseen', interval: 0, ease: 2.3, difficulty: .5 }, 'hard', 1000);
  const persisted = { queue: [1, 2, 3], queueStages: ['new', 'new', 'new'], queueIndex: 1, wordStates: { 2: scheduled } };
  assert.equal(persisted.queue[persisted.queueIndex], 2);
  assert.equal(persisted.wordStates[2].lastResult, 'hard');
  assert.ok(persisted.wordStates[2].nextReviewAt > 1000);
});
