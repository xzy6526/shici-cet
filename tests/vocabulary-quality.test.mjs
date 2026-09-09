import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeWord } from '../src/domain.js';
import { coverageFor, validateVocabulary } from '../src/vocabulary-quality.js';

test('vocabulary validator catches duplicate IDs and unverifiable verified IPA', () => {
  const first = normalizeWord({ id: 1, word: 'one', meaning: '一', phonetics: { uk: { ipa: '/wʌn/', status: 'verified' } } });
  const second = normalizeWord({ id: 1, word: 'two', meaning: '二' });
  const result = validateVocabulary([first, second]);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((item) => item.includes('duplicate id')));
  assert.ok(result.errors.some((item) => item.includes('verified uk IPA lacks source')));
  assert.equal(result.warnings.length, 0);
});

test('coverage reports only actual populated fields', () => {
  const [rich, bare] = [
    normalizeWord({ id: 1, word: 'one', meaning: '一', phoneticUK: '/wʌn/', phoneticUS: '/wʌn/', sources: [{ name: 'snapshot', verified: true }], collocations: [{ phrase: 'one by one' }] }),
    normalizeWord({ id: 2, word: 'two', meaning: '二' }),
  ];
  const coverage = coverageFor([rich, bare]);
  assert.deepEqual(coverage.ukIpa, { count: 1, total: 2, percent: 50 });
  assert.deepEqual(coverage.collocations, { count: 1, total: 2, percent: 50 });
});
