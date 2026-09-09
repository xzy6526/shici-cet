import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeWord } from '../src/domain.js';
import { withVerifiedPhonetics } from '../src/phonetic-overlay.js';

test('pinned UK and US sources override an unverified pronunciation without changing the word ID', () => {
  const word = normalizeWord(withVerifiedPhonetics({ id: 7, word: 'schedule', meaning: '安排', phoneticUK: '/old/', phoneticUS: '/old/' }));
  assert.equal(word.id, 7);
  assert.notEqual(word.phoneticUK, '/old/');
  assert.notEqual(word.phoneticUS, '/old/');
  assert.equal(word.phonetics.uk.status, 'verified');
  assert.equal(word.phonetics.us.status, 'verified');
  assert.equal(word.phonetics.uk.source.name, 'Britfone');
  assert.equal(word.phonetics.us.source.name, 'ipa-dict en_US');
});
