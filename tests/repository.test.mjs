import test from 'node:test';
import assert from 'node:assert/strict';
import { getFavoriteWords, getHiddenWords, getNewWordCandidates, getReviewCandidates, searchWords, filterWords } from '../src/repository.js';

const words = [
  { id: 1, word: 'issue', meaning: '问题', isStudyWord: true, frequencyRank: 10, frequency: 20, importanceScore: 90 },
  { id: 2, word: 'island', meaning: '岛', isStudyWord: true, frequencyRank: 20, frequency: 10, importanceScore: 80 },
  { id: 3, word: 'zebra', meaning: '斑马', isStudyWord: true, frequencyRank: 30, frequency: 1, importanceScore: 5 },
];

test('search supports exact and prefix substring matches', () => {
  assert.deepEqual(searchWords(words, 'issue').map((word) => word.id), [1]);
  assert.deepEqual(searchWords(words, 'is').map((word) => word.id), [1, 2]);
});

test('new candidates exclude hidden and rank by priority', () => {
  const states = { 1: { status: 'mastered' }, 2: { status: 'hidden' }, 3: { status: 'unseen' } };
  assert.deepEqual(getNewWordCandidates(words, states, { targetScore: 550 }).map((word) => word.id), [3]);
});

test('new candidates use stable personal priority context', () => {
  const states = { 2: { status: 'unseen', assessedWeak: true } };
  const context = { seed: 'local-1:2026-09-10', profile: { bandScores: { core: 0.8, highFrequency: 0.5, advanced: 0.2, rareMeaning: 0.2 } } };
  const first = getNewWordCandidates(words, states, { targetScore: 550 }, context).map((word) => word.id);
  const second = getNewWordCandidates(words, states, { targetScore: 550 }, context).map((word) => word.id);
  assert.equal(first[0], 2);
  assert.deepEqual(second, first);
});

test('review candidates include only due words and prefer risk', () => {
  const states = {
    1: { status: 'reviewing', nextReviewAt: 10, difficulty: .3, mistakeCount: 0, lastReviewedAt: 0 },
    2: { status: 'weak', nextReviewAt: 10, difficulty: .8, mistakeCount: 2, lastReviewedAt: 0 },
    3: { status: 'reviewing', nextReviewAt: 1000, difficulty: .9, mistakeCount: 9, lastReviewedAt: 0 },
  };
  assert.deepEqual(getReviewCandidates(words, states, 20).map((word) => word.id), [2, 1]);
});

test('favorite and hidden views are derived from UserWordState', () => {
  const states = { 1: { favorite: true, status: 'reviewing' }, 2: { favorite: false, status: 'hidden' } };
  assert.deepEqual(getFavoriteWords(words, states).map((word) => word.id), [1]);
  assert.deepEqual(getHiddenWords(words, states).map((word) => word.id), [2]);
});

test('study filter preserves the supplied study pool', () => {
  assert.deepEqual(filterWords(words, 'study').map((word) => word.id), [1, 2, 3]);
});
