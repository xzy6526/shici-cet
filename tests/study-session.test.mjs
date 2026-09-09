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
