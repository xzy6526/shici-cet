import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeWord } from '../src/domain.js';
import {
  formatExamProvenance,
  getAnswerContent,
  getCETTags,
  getPartOfSpeechLabels,
  getPreferredContext,
  getPrimaryMeaning,
  getRecommendationReason,
} from '../src/word-card.js';

const richWord = normalizeWord({
  id: 1,
  word: 'issue',
  exam: 'CET-4',
  frequencyRank: 343,
  tags: ['熟词多义'],
  partsOfSpeech: [
    { pos: 'noun', meanings: [{ meaning: '一期刊物', priority: 'secondary' }, { meaning: '问题；议题', explanation: '需要讨论或解决的事情。', priority: 'cet_high' }] },
    { pos: 'verb', meanings: [{ meaning: '发布；发行', priority: 'secondary' }] },
  ],
  plainExplanation: '需要讨论或解决的事情。',
  exampleSentences: [{ sentence: 'This is a project example.', translation: '这是项目示例。', sourceType: 'editorial_example' }],
  examExamples: [
    { sentence: 'Unverified exam-like sentence.', sourceVerified: false, exam: 'CET-4', year: 2024, month: 6, section: 'Reading' },
    { sentence: 'Verified fixture sentence.', translation: '经过验证的测试夹具。', wordMeaningInContext: '问题', sourceVerified: true, source: '测试夹具来源', exam: 'CET-4', year: 2023, month: 12, section: 'Reading' },
  ],
  collocations: [{ phrase: 'raise an issue', meaning: '提出问题' }, { phrase: 'address an issue', meaning: '处理问题' }, { phrase: 'current issue', meaning: '本期刊物' }],
  commonMistakes: ['issue 在 issue a notice 中是动词。'],
  rareMeanings: [{ pos: 'noun', meaning: '一期刊物' }],
  memoryTip: '先记“问题”，再区分动词“发布”。',
  roots: [{ word: 'test-root', meaning: '测试词根' }],
  wordFamily: [{ word: 'reissue', meaning: '重新发行' }],
  synonyms: ['problem'],
  confusableWords: [{ word: 'problem', meaning: '更强调困难' }],
});

test('selects the CET-priority meaning and compact study metadata', () => {
  assert.equal(getPrimaryMeaning(richWord).meaning, '问题；议题');
  assert.deepEqual(getPartOfSpeechLabels(richWord), ['n.', 'v.']);
  assert.deepEqual(getCETTags(richWord), ['CET-4 高频', '熟词多义']);
});

test('uses only verified exam provenance and otherwise falls back to a project example', () => {
  const context = getPreferredContext(richWord);
  assert.equal(context.kind, 'exam');
  assert.equal(context.sentence, 'Verified fixture sentence.');
  assert.equal(context.label, '真题语境');
  assert.equal(formatExamProvenance(context), 'CET-4 · 2023.12 · Reading');

  const fallback = getPreferredContext(normalizeWord({ word: 'plain', meaning: '普通', examExamples: [{ sentence: 'Not verified.', sourceVerified: false }], example: 'Safe example.' }));
  assert.equal(fallback.kind, 'example');
  assert.equal(fallback.sentence, 'Safe example.');
  assert.equal(fallback.label, '示例语境');
});

test('reveals progressively deeper answer content without empty modules', () => {
  const known = getAnswerContent(richWord, { rating: 'known' });
  const fuzzy = getAnswerContent(richWord, { rating: 'fuzzy' });
  const unknown = getAnswerContent(richWord, { rating: 'unknown' });
  assert.equal(known.explanation, '');
  assert.deepEqual(known.collocations, []);
  assert.equal(known.context.kind, 'exam');
  assert.equal(fuzzy.explanation, '需要讨论或解决的事情。');
  assert.equal(fuzzy.collocations.length, 2);
  assert.equal(fuzzy.memoryTip, '');
  assert.equal(unknown.memoryTip, '先记“问题”，再区分动词“发布”。');
  assert.equal(unknown.rareMeanings.length, 1);
  assert.equal(unknown.hasMore, true);
  assert.deepEqual(getAnswerContent(normalizeWord({ word: 'bare', meaning: '仅有释义' }), { rating: 'unknown' }).sections, ['meaning']);
});

test('keeps additional meanings and study aids in the more-content bucket', () => {
  const content = getAnswerContent(richWord, { rating: 'known' });
  assert.ok(content.more.meanings.some((meaning) => meaning.meaning === '发布；发行'));
  assert.equal(content.more.contexts.length, 2);
  assert.ok(content.more.contexts.every((context) => context.sentence !== 'Verified fixture sentence.'));
  assert.equal(content.more.collocations.length, 3);
  assert.equal(content.more.wordFamily[0].word, 'reissue');
  assert.equal(content.more.confusableWords[0].word, 'problem');

  const singleContext = getAnswerContent(normalizeWord({
    word: 'plain',
    meaning: '普通',
    exampleSentences: [{ sentence: 'Only one context.', translation: '只有一条语境。' }],
  }), { rating: 'unknown' });
  assert.equal(singleContext.more.contexts.length, 0);
});

test('explains why the current word is in the queue using calm one-line copy', () => {
  assert.equal(getRecommendationReason({ stage: 'review' }), '今天到期复习');
  assert.equal(getRecommendationReason({ stage: 'weak', wordState: { lastResult: 'hard' } }), '你上次标记为模糊');
  assert.equal(getRecommendationReason({ stage: 'new', wordState: { mistakeCount: 3 } }), '你之前错过 3 次');
  assert.equal(getRecommendationReason({ stage: 'new', word: richWord, targetScore: 550 }), 'CET-4 高频词');
  assert.equal(getRecommendationReason({ stage: 'new', word: { cetLevel: 'CET-4', frequencyRank: 4000 }, targetScore: 550 }), '你的 550 目标词');
});
