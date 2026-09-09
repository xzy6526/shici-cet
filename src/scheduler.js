const MINUTE = 60000;
const DAY = 86400000;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function scheduleReview(wordState = {}, result, now = Date.now()) {
  const current = {
    interval: Math.max(0, Number(wordState.interval) || 0),
    ease: clamp(Number(wordState.ease) || 2.3, 1.3, 3),
    difficulty: clamp(Number(wordState.difficulty) || 0.5, 0, 1),
    streak: Math.max(0, Number(wordState.streak) || 0),
    lapses: Math.max(0, Number(wordState.lapses) || 0),
    reviewCount: Math.max(0, Number(wordState.reviewCount) || 0),
    correctCount: Math.max(0, Number(wordState.correctCount) || 0),
    wrongCount: Math.max(0, Number(wordState.wrongCount) || 0),
  };
  const next = { ...wordState, reviewCount: current.reviewCount + 1, lastReviewedAt: now, updatedAt: now, lastResult: result };
  if (result === 'again') {
    next.interval = 1 / 24;
    next.nextReviewAt = now + 60 * MINUTE;
    next.difficulty = clamp(current.difficulty + 0.12, 0, 1);
    next.ease = clamp(current.ease - 0.15, 1.3, 3);
    next.streak = 0;
    next.lapses = current.lapses + 1;
    next.wrongCount = current.wrongCount + 1;
    next.mistakeCount = Math.max(1, Number(wordState.mistakeCount) || 0) + 1;
    next.familiarity = 'unknown';
    next.status = 'weak';
  } else if (result === 'hard') {
    next.interval = current.interval > 0 ? Math.max(1, current.interval * 1.2) : 1;
    next.nextReviewAt = now + next.interval * DAY;
    next.difficulty = clamp(current.difficulty + 0.03, 0, 1);
    next.ease = clamp(current.ease - 0.05, 1.3, 3);
    next.streak = current.streak + 1;
    next.correctCount = current.correctCount + 1;
    next.familiarity = 'vague';
    next.status = 'learning';
  } else if (result === 'good') {
    next.interval = current.interval > 0 ? Math.max(1, current.interval * current.ease) : 2;
    next.nextReviewAt = now + next.interval * DAY;
    next.difficulty = clamp(current.difficulty - 0.04, 0, 1);
    next.ease = clamp(current.ease + 0.03, 1.3, 3);
    next.streak = current.streak + 1;
    next.correctCount = current.correctCount + 1;
    next.familiarity = 'known';
    next.status = next.streak >= 4 && next.interval >= 14 ? 'mastered' : 'reviewing';
    if (next.status === 'mastered') next.masteredAt = now;
  } else {
    return { ...wordState };
  }
  if (!next.firstLearnedAt) next.firstLearnedAt = now;
  return next;
}

export function buildWeakRequeue(queue = [], wordId, offset = 6) {
  const result = queue.filter((id) => id !== wordId);
  const index = Math.min(result.length, Math.max(1, Number(offset) || 6));
  result.splice(index, 0, wordId);
  return result;
}

export function isMastered(wordState = {}) {
  return wordState.status === 'mastered' || (Number(wordState.streak) >= 4 && Number(wordState.interval) >= 14);
}
