import { phoneticSources, verifiedPhonetics } from './phonetics.js';

export function withVerifiedPhonetics(word = {}) {
  const record = verifiedPhonetics[String(word.word || '').trim().toLowerCase()];
  if (!record) return word;
  return {
    ...word,
    phoneticUK: record.uk?.ipa || word.phoneticUK,
    phoneticUS: record.us?.ipa || word.phoneticUS,
    phonetics: {
      ...word.phonetics,
      ...(record.uk ? { uk: { ...record.uk, source: phoneticSources.uk, verified: true, status: 'verified' } } : {}),
      ...(record.us ? { us: { ...record.us, source: phoneticSources.us, verified: true, status: 'verified' } } : {}),
    },
    dataQuality: { ...word.dataQuality, phoneticUK: record.uk ? 'verified' : word.dataQuality?.phoneticUK, phoneticUS: record.us ? 'verified' : word.dataQuality?.phoneticUS },
  };
}
