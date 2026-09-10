import test from 'node:test';
import assert from 'node:assert/strict';
import { createPersonalLearningPool, recommendDailyQuota, scoreLearningPriority } from '../src/personal-plan.js';

const words = Array.from({ length: 40 }, (_, index) => ({
  id: index + 1,
  word: `word${index + 1}`,
  isStudyWord: true,
  importanceScore: 100 - index,
  frequencyRank: index * 80 + 1,
  primaryMeaning: { pos: 'v.', meaning: `含义${index + 1}` },
  rareMeanings: index > 30 ? [{ meaning: `僻义${index + 1}` }] : [],
}));

test('important assessed-weak words outrank known words', () => {
  const weak = scoreLearningPriority(words[0], { status: 'unseen', assessedWeak: true }, { targetScore: 550 });
  const known = scoreLearningPriority(words[0], { status: 'unseen', assessedKnown: true }, { targetScore: 550 });
  assert.ok(weak > known);
});

test('mastered and hidden words never enter the personal new-word pool', () => {
  const ranked = createPersonalLearningPool({
    words,
    wordStates: { 1: { status: 'mastered' }, 2: { status: 'hidden' } },
    seed: 'same-day',
  });
  assert.equal(ranked.some((word) => word.id === 1 || word.id === 2), false);
});

test('mistakes raise priority and different profiles produce different top candidates', () => {
  const base = createPersonalLearningPool({ words, seed: 'person-a', profile: { bandScores: { core: 0.9, highFrequency: 0.8, advanced: 0.7, rareMeaning: 0.2 } } });
  const weakCore = createPersonalLearningPool({ words, seed: 'person-b', profile: { bandScores: { core: 0.2, highFrequency: 0.7, advanced: 0.8, rareMeaning: 0.9 } }, wordStates: { 8: { status: 'unseen', mistakeCount: 4 } } });
  assert.notDeepEqual(base.slice(0, 10).map(({ id }) => id), weakCore.slice(0, 10).map(({ id }) => id));
  assert.ok(weakCore.findIndex(({ id }) => id === 8) < base.findIndex(({ id }) => id === 8));
});

test('same seed produces the same bucket-shuffled order', () => {
  const first = createPersonalLearningPool({ words, seed: 'local-1:2026-09-10' }).map(({ id }) => id);
  const second = createPersonalLearningPool({ words, seed: 'local-1:2026-09-10' }).map(({ id }) => id);
  assert.deepEqual(second, first);
});

test('high review pressure and low accuracy reduce new words', () => {
  const highLoad = recommendDailyQuota({ previousNewWords: 20, dueReviews: 70, remainingWords: 1000, recentDays: [], intensity: 'standard' });
  const lowAccuracy = recommendDailyQuota({ previousNewWords: 20, dueReviews: 10, remainingWords: 1000, recentDays: [{ correct: 3, fuzzy: 4, unknown: 3, completionRate: 0.8 }], intensity: 'standard' });
  assert.ok(highLoad.newWords <= 15);
  assert.ok(lowAccuracy.newWords < 20);
  assert.ok(highLoad.reasonCodes.includes('HIGH_REVIEW_LOAD'));
});

test('high accuracy only raises quota smoothly and intensity scales the result', () => {
  const recentDays = [{ correct: 18, fuzzy: 1, unknown: 1, completionRate: 1 }];
  const standard = recommendDailyQuota({ previousNewWords: 20, dueReviews: 2, remainingWords: 1000, recentDays, intensity: 'standard' });
  const relaxed = recommendDailyQuota({ previousNewWords: 20, dueReviews: 2, remainingWords: 1000, recentDays, intensity: 'relaxed' });
  const intensive = recommendDailyQuota({ previousNewWords: 20, dueReviews: 2, remainingWords: 1000, recentDays, intensity: 'intensive' });
  assert.ok(standard.newWords > 20 && standard.newWords <= 25);
  assert.ok(relaxed.newWords < standard.newWords);
  assert.ok(intensive.newWords > standard.newWords);
  assert.ok(Math.abs(standard.newWords - 20) <= 5);
});

