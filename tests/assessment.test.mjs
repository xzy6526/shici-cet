import test from 'node:test';
import assert from 'node:assert/strict';
import {
  answerAssessment,
  applyAssessmentToWordStates,
  buildAssessmentPool,
  createAssessmentState,
  createVocabularyProfile,
  getAssessmentQuestion,
  isAssessmentQuestionValid,
  updateVocabularyProfileFromLearning,
} from '../src/assessment.js';

const words = Array.from({ length: 100 }, (_, index) => ({
  id: index + 1,
  word: `word${index + 1}`,
  isStudyWord: true,
  frequencyRank: index * 40 + 1,
  importanceScore: 100 - index / 2,
  primaryMeaning: { pos: index % 2 ? 'v.' : 'n.', meaning: `含义${index + 1}`, verified: true },
  meanings: [{ pos: index % 2 ? 'v.' : 'n.', meaning: `含义${index + 1}`, verified: true }],
  phoneticUK: `/wɜːd${index + 1}/`,
  rareMeanings: index > 79 ? [{ pos: 'v.', meaning: `僻义${index + 1}`, verified: true }] : [],
}));

const pool = buildAssessmentPool(words);

function answerCurrent(state, correct) {
  const question = getAssessmentQuestion(state, pool);
  const choice = correct ? question.correctIndex : (question.correctIndex + 1) % question.options.length;
  return answerAssessment(state, choice, pool, 1_000 + state.answers.length);
}

test('new assessment starts in the middle band with a deterministic objective question', () => {
  const state = createAssessmentState({ seed: 'user-a', targetCount: 26 });
  const question = getAssessmentQuestion(state, pool);
  assert.equal(state.estimatedLevel, 3);
  assert.equal(question.band, 3);
  assert.equal(question.options.length, 5);
  assert.equal(question.options.at(-1).kind, 'unknown');
  assert.equal(isAssessmentQuestionValid(question), true);
  assert.equal(isAssessmentQuestionValid({ ...question, options: [{ text: question.meaning }, { text: question.meaning }, { text: '甲' }, { text: '乙' }, { text: '不认识', kind: 'unknown' }] }), false);
});

test('assessment matches the core Chinese meaning to its actual part of speech', () => {
  const matched = buildAssessmentPool([{
    id: 'hostile', word: 'hostile', isStudyWord: true, frequencyRank: 2000,
    primaryMeaning: { meaning: '敌对的' },
    partsOfSpeech: [
      { pos: 'n.', meanings: [{ meaning: '敌军' }] },
      { pos: 'adj.', meanings: [{ meaning: '不友善的；敌对的' }] },
    ],
  }]);
  assert.equal(matched[0].pos, 'adj.');
});

test('distractors prefer the same vocabulary category when enough candidates exist', () => {
  const categorized = buildAssessmentPool(Array.from({ length: 8 }, (_, index) => ({
    id: `c${index}`, word: `category${index}`, isStudyWord: true, frequencyRank: 2000 + index,
    category: index < 4 ? '人类与社会' : '自然环境',
    primaryMeaning: { pos: 'n.', meaning: `分类含义${index}` },
  })));
  const state = createAssessmentState({ seed: 'category' });
  const question = getAssessmentQuestion(state, categorized);
  assert.ok(['人类与社会', '自然环境'].includes(question.category));
  assert.ok(question.options.slice(0, 4).every((option) => option.category === question.category));
});

test('assessment never repeats a word and rises after correct answers', () => {
  let state = createAssessmentState({ seed: 'rise', minQuestions: 20, targetCount: 26, maxQuestions: 30 });
  const levels = [];
  for (let index = 0; index < 8; index += 1) {
    levels.push(state.estimatedLevel);
    state = answerCurrent(state, true);
  }
  assert.equal(new Set(state.testedWordIds).size, state.testedWordIds.length);
  assert.ok(state.estimatedLevel > levels[0]);
});

test('assessment falls after wrong answers and ends no later than its maximum', () => {
  let state = createAssessmentState({ seed: 'fall', minQuestions: 20, targetCount: 26, maxQuestions: 30 });
  for (let index = 0; index < 6; index += 1) state = answerCurrent(state, false);
  assert.ok(state.estimatedLevel < 3);
  while (!state.completed) state = answerCurrent(state, state.answers.length % 2 === 0);
  assert.ok(state.answers.length <= 30);
});

test('stable evidence can finish assessment before the target count', () => {
  let state = createAssessmentState({ seed: 'stable', minQuestions: 20, targetCount: 30, maxQuestions: 36 });
  while (!state.completed) state = answerCurrent(state, true);
  assert.ok(state.answers.length >= 20);
  assert.ok(state.answers.length < 30);
  assert.ok(state.confidence >= 0.8);
});

test('serialized assessment resumes the same current question', () => {
  let state = createAssessmentState({ seed: 'resume' });
  for (let index = 0; index < 12; index += 1) state = answerCurrent(state, index % 3 !== 0);
  const before = getAssessmentQuestion(state, pool);
  const restored = JSON.parse(JSON.stringify(state));
  assert.deepEqual(getAssessmentQuestion(restored, pool), before);
});

test('profile uses ranges and assessment evidence never marks a word mastered', () => {
  let state = createAssessmentState({ seed: 'profile', minQuestions: 20, targetCount: 20, maxQuestions: 20 });
  while (!state.completed) state = answerCurrent(state, state.answers.length % 2 === 0);
  const profile = createVocabularyProfile(state, 5_000);
  const wordStates = applyAssessmentToWordStates({}, state, 5_000);
  assert.equal(profile.assessmentVersion, 1);
  assert.ok(profile.estimatedCoverage.min < profile.estimatedCoverage.max);
  assert.equal(Object.values(wordStates).some((entry) => entry.status === 'mastered'), false);
  assert.equal(Object.values(wordStates).some((entry) => entry.assessedWeak), true);
  assert.equal(Object.values(wordStates).some((entry) => entry.assessedKnown), true);
});

test('real repeated learning evidence revises the assessment profile', () => {
  const profile = { assessmentVersion: 1, source: 'assessment', bandScores: { core: 0.7, highFrequency: 0.7, advanced: 0.8, rareMeaning: 0.5 }, lastUpdatedAt: 1 };
  const word = { frequencyRank: 3000, rareMeanings: [] };
  const updated = updateVocabularyProfileFromLearning(profile, word, { reviewCount: 3, correctCount: 0, wrongCount: 3 }, 99);
  assert.equal(updated.source, 'adaptive');
  assert.ok(updated.bandScores.advanced < profile.bandScores.advanced);
  assert.equal(updated.lastUpdatedAt, 99);
});
