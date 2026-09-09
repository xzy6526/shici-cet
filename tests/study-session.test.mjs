import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateState } from '../src/domain.js';
import { applyStudyRating, advanceStudySession, getStudyProgress } from '../src/study-session.js';
import { createDailyTask } from '../src/tasks.js';
import { studyWords } from '../src/words.js';

const words = studyWords;

test('study progress ignores weak reinforcements in the daily total', () => {
  const state = { queue: [1, 2, 3, 2], queueStages: ['new', 'new', 'new', 'weak'], queueIndex: 0 };
  assert.deepEqual(getStudyProgress(state), { current: 1, total: 3 });
  state.queueIndex = 3;
  assert.deepEqual(getStudyProgress(state), { current: 3, total: 3 });
});

test('review mode completes its queue without completing the full daily task', () => {
  const state = {
    queue: [1], queueStages: ['review'], queueIndex: 0, completed: [],
    dailyTask: { reviewWordIds: [1], completedReviewIds: [], newWordIds: [2], completedNewIds: [], weakWordIds: [], completedWeakIds: [], completed: false },
    wordStates: {}, sessionReplay: false,
  };
  const result = advanceStudySession(state, { wordId: 1, stage: 'review', sessionMode: 'review' });
  assert.equal(result.completed, true);
  assert.deepEqual(state.dailyTask.completedReviewIds, [1]);
  assert.equal(state.dailyTask.completed, false);
});

test('batch completion can advance without marking the full task complete', () => {
  const state = {
    queue: [1], queueStages: ['new'], queueIndex: 0, completed: [], sessionReplay: false,
    dailyTask: { reviewWordIds: [], completedReviewIds: [], reviewPoolIds: [1], completedReviewPoolIds: [], newWordIds: [1], completedNewIds: [], weakWordIds: [], completedWeakIds: [], completed: false },
    wordStates: {},
  };
  const result = advanceStudySession(state, { wordId: 1, stage: 'new', sessionMode: 'daily', completeTask: false });
  assert.equal(result.completed, true);
  assert.equal(state.dailyTask.completed, false);
});

test('normal batch ratings keep weak words in the review pool without requeueing them', () => {
  const state = {
    queue: [1, 2], queueStages: ['new', 'new'], queueIndex: 0, completed: [], weakToday: [],
    dailyTask: { date: '2026-09-09', batchSize: 2, batches: [{ id: '2026-09-09-1', newWordIds: [1, 2] }], activeBatchId: '2026-09-09-1', reviewWordIds: [], reviewPoolIds: [], completedReviewPoolIds: [], newWordIds: [1, 2], completedNewIds: [], weakWordIds: [], completedWeakIds: [], completedReviewIds: [] },
    wordStates: {},
  };
  applyStudyRating(state, { wordId: 1, stage: 'new', rating: 'unknown', now: 1_000, requeueWeak: false, batchId: state.dailyTask.activeBatchId });
  assert.deepEqual(state.queue, [1, 2]);
  assert.deepEqual(state.dailyTask.reviewPoolIds, [1]);
  assert.equal(state.wordStates['1'].status, 'weak');
});

test('batch review uses the same UserWordState and closes only the reviewed pool card', () => {
  const state = {
    queue: [1], queueStages: ['batch-review'], queueIndex: 0, completed: [], weakToday: [], sessionReplay: false,
    dailyTask: { date: '2026-09-09', batchSize: 1, batches: [{ id: '2026-09-09-1', newWordIds: [1], completedNewIds: [1], reviewPoolIds: [1], completedReviewIds: [] }], activeBatchId: '2026-09-09-1', reviewWordIds: [], completedReviewIds: [], completedNewIds: [1], reviewPoolIds: [1], completedReviewPoolIds: [], weakWordIds: [1], completedWeakIds: [], completed: false },
    wordStates: { '1': { wordId: 1, status: 'weak', interval: 0, ease: 2.3, difficulty: .6, streak: 0, reviewCount: 1, wrongCount: 1, lapses: 1 } },
  };
  applyStudyRating(state, { wordId: 1, stage: 'batch-review', rating: 'known', now: 2_000, requeueWeak: false });
  advanceStudySession(state, { wordId: 1, stage: 'batch-review', sessionMode: 'review', batchId: state.dailyTask.activeBatchId });
  assert.deepEqual(state.dailyTask.completedReviewPoolIds, [1]);
  assert.equal(state.wordStates['1'].lastResult, 'good');
  assert.equal(state.wordStates['1'].status, 'reviewing');
});

function createSession() {
  const task = createDailyTask({ words, settings: { dailyNew: 50 }, now: 1_000 });
  return {
    queue: [...task.newWordIds],
    queueStages: task.newWordIds.map(() => 'new'),
    queueIndex: 0,
    completed: [],
    weakToday: [],
    wordStates: {},
    dailyTask: task,
    dueCount: 0,
    sessionReplay: false,
  };
}

function rateThenAdvance(state, rating, now) {
  const wordId = state.queue[state.queueIndex];
  const stage = state.queueStages[state.queueIndex];
  applyStudyRating(state, { wordId, stage, rating, now });
  advanceStudySession(state, { wordId, stage });
}

test('a 50-word CET-4 session persists its exact resume point and completes weak reinforcement', () => {
  let state = createSession();
  assert.equal(words.length, 3861);
  const initialTaskIds = [...state.dailyTask.newWordIds];
  assert.equal(new Set(initialTaskIds).size, 50);

  for (let index = 0; index < 17; index += 1) {
    rateThenAdvance(state, index % 7 === 0 ? 'unknown' : index % 5 === 0 ? 'fuzzy' : 'known', 2_000 + index);
  }
  const saved = JSON.parse(JSON.stringify(state));
  const expectedWordId = saved.queue[saved.queueIndex];
  const expectedCompletedNew = saved.dailyTask.completedNewIds.length;
  state = migrateState(saved, words, 3_000);
  assert.equal(state.queue[state.queueIndex], expectedWordId);
  assert.equal(state.dailyTask.completedNewIds.length, expectedCompletedNew);

  let guard = 0;
  while (!state.dailyTask.completed && guard < 100) {
    rateThenAdvance(state, guard % 4 === 0 ? 'fuzzy' : 'known', 4_000 + guard);
    guard += 1;
  }

  assert.equal(state.dailyTask.completed, true);
  assert.equal(state.dailyTask.completedNewIds.length, 50);
  assert.equal(new Set(state.dailyTask.completedNewIds).size, 50);
  assert.equal(state.dailyTask.completedWeakIds.length, state.dailyTask.weakWordIds.length);
  assert.ok(state.weakToday.length > 0);
});
