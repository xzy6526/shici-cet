import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, parseJson, parseTextLines } from '../src/importer.js';

test('parses supported text formats into normalized words', () => {
  assert.deepEqual(parseCsv('word,meaning\nabandon,放弃\ncarry,携带'), [
    { word: 'abandon', meaning: '放弃' },
    { word: 'carry', meaning: '携带' },
  ]);
  assert.deepEqual(parseJson('[{"word":"adapt","meaning":"适应"}]'), [
    { word: 'adapt', meaning: '适应' },
  ]);
  assert.deepEqual(parseTextLines('arrive, 到达\n\n# ignored'), [
    { word: 'arrive', meaning: '到达' },
  ]);
});

test('accepts JSON string entries and skips incomplete rows', () => {
  assert.deepEqual(parseJson('["focus",{"word":"fair","meaning":"公平"},{"word":""}]'), [
    { word: 'focus', meaning: '' },
    { word: 'fair', meaning: '公平' },
  ]);
});
