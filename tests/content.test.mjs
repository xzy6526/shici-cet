import test from 'node:test';
import assert from 'node:assert/strict';
import { studyWords, wordSource, words } from '../src/words.js';
import { reviewedWordContent, withReviewedContent } from '../src/reviewed-word-content.js';
import { normalizeWord } from '../src/domain.js';

test('CET-4 vocabulary has a traceable source shape', () => {
  assert.equal(words.length, 4025);
  assert.equal(wordSource.count, words.length);
  const ids = new Set();
  let previousRank = 0;
  for (const word of words) {
    ids.add(word.id);
    assert.equal(word.exam, 'CET-4');
    assert.ok(word.word, 'word missing');
    assert.ok(word.meaning, `meaning missing for ${word.word}`);
    assert.ok(word.frequencyRank <= 5278, `rank out of range for ${word.word}`);
    assert.ok(word.frequency >= 0, `frequency out of range for ${word.word}`);
    assert.ok(word.frequencyRank > previousRank, `rank not sorted for ${word.word}`);
    previousRank = word.frequencyRank;
    for (const field of ['phonetic', 'secondary', 'example', 'translation', 'collocation', 'pitfall', 'extended', 'category', 'subcategory', 'variants']) {
      assert.ok(field in word, `${field} missing for ${word.word}`);
    }
  }
  assert.equal(ids.size, words.length);
  assert.equal(words.find((word) => word.word === 'ancestor')?.frequencyRank, 2105);
});

test('daily study list excludes function words while keeping the full library intact', () => {
  assert.equal(studyWords.length, wordSource.studyCount);
  assert.ok(studyWords.length < words.length);
  assert.equal(studyWords[0].word, 'passage');
  assert.ok(studyWords.every((word) => word.isStudyWord));
  for (const word of ['the', 'a', 'to', 'and', 'in', 'have']) {
    assert.equal(words.find((item) => item.word === word)?.isStudyWord, false);
  }
});

test('reviewed sample content covers the requested feature cases without fake exam provenance', () => {
  const samples = ['maintain', 'issue', 'address', 'schedule', 'economic', 'economical', 'significant', 'approach', 'charge', 'figure'];
  assert.deepEqual(Object.keys(reviewedWordContent).sort(), samples.sort());
  for (const sample of Object.values(reviewedWordContent)) {
    assert.ok(sample.partsOfSpeech?.length, 'sample part of speech missing');
    assert.ok(sample.plainExplanation, 'sample explanation missing');
    assert.ok((sample.examExamples || []).every((example) => example.sourceVerified !== true), 'unverified sample cannot claim exam provenance');
  }
  const issue = normalizeWord(withReviewedContent(words.find((word) => word.word === 'issue')));
  assert.deepEqual(issue.partsOfSpeech.map((part) => part.pos), ['n.', 'v.']);
  assert.equal(issue.primaryMeaning.priority, 'cet_high');
});

test('reviewed enrichment keeps the original source counts and stable ids', () => {
  const enriched = words.map(withReviewedContent);
  assert.equal(enriched.length, 4025);
  assert.equal(enriched.filter((word) => word.isStudyWord).length, 3861);
  assert.deepEqual(enriched.map((word) => word.id), words.map((word) => word.id));
});
