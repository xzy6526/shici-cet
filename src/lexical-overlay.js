import { lexicalSources, verifiedLexicalContent } from './lexical-content.js';

const normalize = (value) => String(value || '').toLowerCase().replace(/[\s；;，,。.、:：]+/g, '');

function mergeMeanings(current = [], incoming = []) {
  const result = [...current];
  for (const meaning of incoming) {
    if (!result.some((item) => normalize(item.meaning) === normalize(meaning.meaning))) result.push(meaning);
  }
  return result;
}

function mergeParts(current = [], incoming = []) {
  const result = current.map((part) => ({ ...part, meanings: [...(part.meanings || [])] }));
  for (const part of incoming) {
    const existing = result.find((item) => item.pos === part.pos);
    if (existing) existing.meanings = mergeMeanings(existing.meanings, part.meanings);
    else result.push({ ...part, meanings: [...part.meanings] });
  }
  return result;
}

function mergeExamples(current = [], incoming = []) {
  const result = [...current];
  for (const example of incoming) {
    if (!result.some((item) => normalize(item.sentence || item.example) === normalize(example.sentence))) {
      result.push({ ...example, source: lexicalSources.english.name });
    }
  }
  return result;
}

function decodeRecord(record) {
  const [parts = [], examples = []] = record || [];
  return {
    partsOfSpeech: parts.map(([pos, meanings]) => ({
      pos,
      meanings: meanings.map(([meaning, explanation, priority, language, sourceId]) => ({
        meaning,
        explanation,
        priority: priority === 's' ? 'secondary' : 'rare',
        language: language === 'z' ? 'zh' : 'en',
        sourceId,
      })),
    })),
    exampleSentences: examples.map(([sentence, sourceId]) => ({ sentence, sourceType: 'dictionary_example', sourceVerified: false, sourceId })),
  };
}

export function withVerifiedLexicalContent(word = {}) {
  const encoded = verifiedLexicalContent[String(word.word || '').trim().toLowerCase()];
  if (!encoded) return word;
  const record = decodeRecord(encoded);
  const sources = [...(word.sources || [])];
  const baseSource = word.source || 'CET-4 词库';
  if (!sources.some((item) => (item.name || item.source) === baseSource)) sources.push({ name: baseSource, verified: true });
  for (const source of Object.values(lexicalSources)) {
    if (!sources.some((item) => (item.name || item.source) === source.name)) sources.push(source);
  }
  const rank = Number(word.frequencyRank);
  const priorityOrder = { cet_high: 0, core: 1, secondary: 2, rare: 3 };
  const reviewedPrimary = (word.partsOfSpeech || [])
    .flatMap((part) => (part.meanings || []).map((meaning) => ({ ...meaning, pos: meaning.pos || part.pos })))
    .sort((left, right) => (priorityOrder[left.priority] ?? 9) - (priorityOrder[right.priority] ?? 9))[0];
  return {
    ...word,
    primaryMeaning: word.primaryMeaning || reviewedPrimary || {
      pos: word.pos || '',
      meaning: word.meaning,
      priority: rank > 0 && rank <= 2104 ? 'cet_high' : 'core',
      language: 'zh',
      source: baseSource,
    },
    partsOfSpeech: mergeParts(word.partsOfSpeech, record.partsOfSpeech),
    exampleSentences: mergeExamples(word.exampleSentences || word.examples, record.exampleSentences),
    sources,
    dataQuality: {
      ...word.dataQuality,
      partsOfSpeech: 'verified',
      meanings: 'verified',
      examples: record.exampleSentences.length ? 'verified' : word.dataQuality?.examples,
      sources: 'verified',
    },
  };
}
