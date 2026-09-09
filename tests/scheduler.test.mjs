import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWeakRequeue, isMastered, scheduleReview } from '../src/scheduler.js';

test('again, hard and good use distinct dynamic intervals', () => {
  const base = { status: 'unseen', interval: 0, ease: 2.3, difficulty: .5, streak: 0, wrongCount: 0, correctCount: 0, lapses: 0, reviewCount: 0, mistakeCount: 0 };
  const again = scheduleReview(base, 'again', 1000);
  const hard = scheduleReview(base, 'hard', 1000);
  const good = scheduleReview(base, 'good', 1000);
  assert.equal(again.status, 'weak');
  assert.equal(hard.status, 'learning');
  assert.equal(good.status, 'reviewing');
  assert.ok(again.nextReviewAt < hard.nextReviewAt);
  assert.ok(hard.nextReviewAt < good.nextReviewAt);
  assert.equal(again.streak, 0);
  assert.equal(good.streak, 1);
});

test('failed words re-enter later in the queue and mastered needs repeated success', () => {
  assert.deepEqual(buildWeakRequeue([1, 2, 3, 4, 5, 6, 7], 2, 4), [1, 3, 4, 5, 2, 6, 7]);
  assert.equal(isMastered({ status: 'mastered' }), true);
  assert.equal(isMastered({ status: 'reviewing', streak: 3, interval: 10 }), false);
});
