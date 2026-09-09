import { pronunciationData } from './pronunciation-data.js';

export function getPhonetic(word, accent = 'uk') {
  const key = String(word?.word || word || '').trim().toLowerCase();
  const sample = pronunciationData[key];
  const field = accent === 'us' ? 'phoneticUS' : 'phoneticUK';
  return word?.phonetics?.[accent]?.ipa || sample?.[field] || word?.[field] || word?.phonetic || '';
}

export function getAudioSource(word, accent = 'uk') {
  const entry = word?.audio?.[accent];
  const url = entry?.url || (accent === 'us' ? word?.phonetics?.us?.audio || word?.audioUS : word?.phonetics?.uk?.audio || word?.audioUK) || '';
  if (url) return { kind: entry?.verified === true ? 'verified-audio' : 'audio', url };
  return { kind: 'tts-fallback', url: '' };
}

function pickVoice(voices, accent) {
  const prefix = accent === 'us' ? 'en-US' : 'en-GB';
  return (voices || []).find((voice) => voice.lang?.toLowerCase() === prefix.toLowerCase())
    || (voices || []).find((voice) => voice.lang?.toLowerCase().startsWith(prefix.toLowerCase()))
    || (voices || []).find((voice) => voice.lang?.toLowerCase().startsWith('en-'))
    || null;
}

export class PronunciationService {
  constructor({ speechSynthesis = globalThis.speechSynthesis, Utterance = globalThis.SpeechSynthesisUtterance, AudioCtor = globalThis.Audio } = {}) {
    this.speechSynthesis = speechSynthesis;
    this.Utterance = Utterance;
    this.AudioCtor = AudioCtor;
    this.audio = null;
    this.preloaded = new Map();
    this.lastPlayback = null;
  }

  stop() {
    this.speechSynthesis?.cancel?.();
    this.audio?.pause?.();
    if (this.audio) this.audio.currentTime = 0;
    this.audio = null;
  }

  play(word, accent = 'uk') {
    this.stop();
    const source = getAudioSource(word, accent);
    this.lastPlayback = { accent, kind: source.kind };
    if (source.url && this.AudioCtor) {
      const audio = new this.AudioCtor(source.url);
      this.audio = audio;
      const result = audio.play?.();
      return result?.catch?.(() => this.playSpeech(word, accent)) || result;
    }
    return this.playSpeech(word, accent);
  }

  playSpeech(word, accent) {
    if (!this.speechSynthesis || !this.Utterance) return false;
    this.lastPlayback = { accent, kind: 'tts-fallback' };
    const utterance = new this.Utterance(word?.word || String(word || ''));
    utterance.lang = accent === 'us' ? 'en-US' : 'en-GB';
    utterance.voice = pickVoice(this.speechSynthesis.getVoices?.(), accent);
    this.speechSynthesis.speak(utterance);
    return true;
  }

  preload(words = [], accent = 'uk') {
    return (Array.isArray(words) ? words : []).slice(0, 5).map((word) => {
      const source = getAudioSource(word, accent);
      const audio = source.url;
      const key = `${accent}:${word.id}`;
      if (audio && this.AudioCtor && !this.preloaded.has(key)) {
        const element = new this.AudioCtor(audio);
        element.preload = 'auto';
        element.load?.();
        this.preloaded.set(key, element);
      }
      return { id: word.id, accent, phonetic: getPhonetic(word, accent), audio };
    });
  }
}

export const pronunciationService = new PronunciationService();
