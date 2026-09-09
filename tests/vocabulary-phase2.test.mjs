import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeWord } from '../src/domain.js';
import { withCETPriorityMeaning } from '../src/cet-priority-overlay.js';
import { coverageFor, validateVocabulary } from '../src/vocabulary-quality.js';
import { getAudioSource, PronunciationService } from '../src/pronunciation.js';
import { studyWords, words } from '../src/words.js';

test('normalizes dual audio, collocations and meaning metadata without guessing', () => {
  const word = normalizeWord({
    id: 11,
    word: 'maintain',
    frequencyRank: 100,
    meaning: '维持',
    audio: { uk: { url: '/audio/uk.mp3', source: 'Open source UK', verified: true }, us: { url: '/audio/us.mp3', source: 'Open source US', verified: false } },
    collocations: [{ phrase: 'maintain  balance', meaning: '保持平衡' }, { phrase: ' maintain balance ', meaning: '重复' }],
    roots: [{ form: 'main', meaning: '手' }],
    wordFamily: [{ word: 'maintenance', relation: 'noun', meaning: '维护' }],
    primaryMeaning: { meaning: '维持', priority: 'cet_high', cetPriority: true, source: 'CET-4 词库' },
  });
  assert.equal(word.audio.uk.url, '/audio/uk.mp3');
  assert.equal(word.audio.uk.status, 'verified');
  assert.equal(word.audio.us.status, 'derived');
  assert.equal(word.collocations.length, 1);
  assert.equal(word.collocations[0].phrase, 'maintain balance');
  assert.equal(word.roots[0].form, 'main');
  assert.equal(word.primaryMeaning.cetPriority, true);
  assert.equal(word.dataQuality.audio, 'partial');
});

test('coverage reports phase-two fields separately', () => {
  const word = normalizeWord(withCETPriorityMeaning({ id: 1, word: 'one', meaning: '一', frequencyRank: 1, phoneticUK: '/wʌn/', phoneticUS: '/wʌn/', audio: { uk: { url: 'uk.mp3' } }, collocations: [{ phrase: 'one by one' }], wordFamily: [{ word: 'ones' }], confusableWords: [{ word: 'won' }] }));
  const coverage = coverageFor([word]);
  for (const field of ['ukIpa', 'usIpa', 'ukAudio', 'usAudio', 'cetPriorityMeaning', 'collocations', 'roots', 'affixes', 'wordFamily', 'confusableWords', 'examExamples']) assert.ok(field in coverage, `missing ${field}`);
  assert.equal(coverage.ukAudio.count, 1);
  assert.equal(coverage.usAudio.count, 0);
  assert.equal(coverage.cetPriorityMeaning.count, 1);
});

test('validator rejects unverifiable audio, roots and incomplete exam provenance', () => {
  const word = normalizeWord({
    id: 1,
    word: 'bad',
    meaning: '坏的',
    audio: { uk: { url: 'uk.mp3', verified: true } },
    roots: [{ form: 'bad', meaning: 'bad', verified: true }],
    examExamples: [{ sentence: 'Exam-like fixture.', sourceVerified: true, exam: 'CET-4', year: 2024, month: 6, section: 'Reading' }],
  });
  const result = validateVocabulary([word]);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((item) => item.includes('verified uk audio lacks source')));
  assert.ok(result.errors.some((item) => item.includes('verified roots lacks source')));
  assert.ok(result.errors.some((item) => item.includes('exam example metadata incomplete')));
});

test('normalizes exam context aliases without treating them as verified', () => {
  const word = normalizeWord({ id: 3, word: 'context', meaning: '语境', examExamples: [{ sentence: 'A context fixture.', targetMeaning: '语境', copyrightStatus: 'pending', sourceVerified: false }] });
  assert.equal(word.examExamples[0].targetMeaning, '语境');
  assert.equal(word.examExamples[0].copyrightStatus, 'pending');
  assert.equal(word.examExamples[0].sourceVerified, false);
});

test('CET priority overlay preserves reviewed meaning and marks source meaning', () => {
  const reviewed = withCETPriorityMeaning({ id: 1, word: 'issue', meaning: '问题', frequencyRank: 343, partsOfSpeech: [{ pos: 'n.', meanings: [{ meaning: '问题；议题', priority: 'cet_high' }] }] });
  assert.equal(reviewed.primaryMeaning.meaning, '问题；议题');
  assert.equal(reviewed.primaryMeaning.cetPriority, true);
  const base = withCETPriorityMeaning({ id: 2, word: 'unlisted', meaning: '未列出', frequencyRank: 3000 });
  assert.equal(base.primaryMeaning.priority, 'core');
  assert.equal(base.primaryMeaning.cetPriority, true);
});

test('pronunciation service maps top-level UK and US audio independently', () => {
  const played = [];
  class FakeAudio {
    constructor(url) { this.url = url; played.push(url); }
    play() { return true; }
  }
  const service = new PronunciationService({ speechSynthesis: null, Utterance: null, AudioCtor: FakeAudio });
  const word = { word: 'test', audio: { uk: { url: 'uk.mp3', verified: true }, us: { url: 'us.mp3' } } };
  assert.equal(getAudioSource(word, 'uk').kind, 'verified-audio');
  assert.equal(getAudioSource({ word: 'test' }, 'uk').kind, 'tts-fallback');
  service.play(word, 'uk');
  service.play(word, 'us');
  assert.deepEqual(played, ['uk.mp3', 'us.mp3']);
  assert.equal(service.lastPlayback.kind, 'audio');
});

test('full and study vocabulary counts and missing CET candidates remain stable', async () => {
  assert.equal(words.length, 4025);
  assert.equal(studyWords.length, 3861);
  assert.ok(words.every((word, index) => word.id === index));
  assert.equal(studyWords[0].word, 'passage');
  const candidates = JSON.parse(await readFile(new URL('../data/audits/missing-cet-candidates.json', import.meta.url), 'utf8'));
  assert.ok(candidates.some((item) => item.word === 'economic' && item.currentPresent === false));
  assert.ok(candidates.some((item) => item.word === 'economical' && item.currentPresent === false));
});
