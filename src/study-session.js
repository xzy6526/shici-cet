import { stateForWord } from './domain.js';
import { scheduleReview } from './scheduler.js';
import { markTaskItemComplete, updateTaskWeakWords } from './tasks.js';

const ratingToResult = { unknown: 'again', fuzzy: 'hard', known: 'good' };

export function getStudyProgress(state = {}) {
  const queue = Array.isArray(state.queue) ? state.queue : [];
  const stages = Array.isArray(state.queueStages) ? state.queueStages : [];
  const baseQueueTotal = stages.length ? stages.filter((stage) => stage !== 'weak').length : 0;
  const task = state.dailyTask;
  const taskTotal = (task?.reviewWordIds?.length || 0) + (task?.newWordIds?.length || 0);
  const total = Math.max(1, baseQueueTotal || taskTotal || queue.length);
  const index = Math.max(0, Number(state.queueIndex) || 0);
  return { current: Math.min(index + 1, total), total };
}

export function applyStudyRating(state, { wordId, stage, rating, now = Date.now() } = {}) {
  const result = ratingToResult[rating];
  if (!result) return null;
  const before = { ...stateForWord(state, wordId) };
  const after = scheduleReview(before, result, now);
  state.wordStates[String(wordId)] = after;
  if (result !== 'good') {
    state.weakToday = [...new Set([...(state.weakToday || []), wordId])];
    state.dailyTask = updateTaskWeakWords(state.dailyTask, [wordId]);
    const queuedWeak = state.queue.slice(state.queueIndex + 1).some((id, offset) => id === wordId && state.queueStages?.[state.queueIndex + 1 + offset] === 'weak');
    if (!queuedWeak && stage !== 'weak') {
      const delay = Math.max(5, Math.min(10, Math.round(state.queue.length / 5)));
      const insertAt = Math.min(state.queue.length, state.queueIndex + delay);
      state.queue.splice(insertAt, 0, wordId);
      state.queueStages.splice(insertAt, 0, 'weak');
    }
  }
  return { before, after, result };
}

export function advanceStudySession(state, { wordId, stage } = {}) {
  if (!state.completed.includes(wordId)) state.completed.push(wordId);
  if (!state.sessionReplay && state.dailyTask) {
    state.dailyTask = markTaskItemComplete(state.dailyTask, wordId, stage);
    state.dueCount = Math.max(0, state.dailyTask.reviewWordIds.length - state.dailyTask.completedReviewIds.length);
  }
  if (state.queueIndex >= state.queue.length - 1) {
    if (!state.sessionReplay && state.dailyTask) state.dailyTask = { ...state.dailyTask, completed: true, currentStage: 'complete' };
    return { completed: true };
  }
  state.queueIndex += 1;
  return { completed: false };
}
