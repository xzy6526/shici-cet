import test from 'node:test';
import assert from 'node:assert/strict';
import { words } from '../src/words.js';
import { normalizeWord } from '../src/domain.js';
import { withReviewedContent } from '../src/reviewed-word-content.js';
import { withVerifiedLexicalContent } from '../src/lexical-overlay.js';

test('adds sourced parts of speech and multiple senses without replacing the CET core meaning', () => {
  const base = words.find((word) => word.word === 'issue');
  const result = normalizeWord(withVerifiedLexicalContent(withReviewedContent(base)));
  assert.equal(result.id, base.id);
  assert.equal(result.primaryMeaning.meaning, '问题；议题');
  assert.ok(result.partsOfSpeech.some((part) => part.pos === 'n.'));
  assert.ok(result.partsOfSpeech.some((part) => part.pos === 'v.'));
  assert.ok(result.meanings.length > 3);
  assert.equal(result.dataQuality.partsOfSpeech, 'verified');
  assert.ok(result.sources.some((source) => source.name === 'CET-4 词库'));
  assert.ok(result.sources.some((source) => source.name === 'Chinese Open WordNet 2.0'));
});

test('keeps dictionary examples separate from verified CET exam examples', () => {
  const base = words.find((word) => word.word === 'problem');
  const result = normalizeWord(withVerifiedLexicalContent(base));
  assert.ok(result.exampleSentences.length > 0);
  assert.ok(result.exampleSentences.every((example) => example.sourceVerified === false));
  assert.equal(result.examExamples.length, 0);
  assert.equal(result.dataQuality.examExamples, 'missing');
});
