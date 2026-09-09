import test from 'node:test';
import assert from 'node:assert/strict';
import { getPhonetic, PronunciationService } from '../src/pronunciation.js';

test('sample words keep separate UK and US phonetics', () => {
  assert.equal(getPhonetic({ word: 'schedule' }, 'uk'), '/ˈʃedjuːl/');
  assert.equal(getPhonetic({ word: 'schedule' }, 'us'), '/ˈskedʒuːl/');
  assert.equal(getPhonetic({ word: 'unknown' }, 'uk'), '');
  assert.equal(getPhonetic({ word: 'nested', phonetics: { uk: { ipa: '/nɛstɪd/' } } }, 'uk'), '/nɛstɪd/');
});

test('speech fallback cancels the previous utterance and applies the selected locale', () => {
  const spoken = [];
  let cancelled = 0;
  class FakeUtterance { constructor(text) { this.text = text; } }
  const synth = { cancel: () => { cancelled += 1; }, getVoices: () => [{ lang: 'en-GB', name: 'UK' }, { lang: 'en-US', name: 'US' }], speak: (utterance) => spoken.push(utterance) };
  const service = new PronunciationService({ speechSynthesis: synth, Utterance: FakeUtterance, AudioCtor: null });
  assert.equal(service.play({ word: 'schedule' }, 'us'), true);
  assert.equal(cancelled, 1);
  assert.equal(spoken[0].lang, 'en-US');
  assert.equal(spoken[0].voice.name, 'US');
  service.stop();
  assert.equal(cancelled, 2);
});
