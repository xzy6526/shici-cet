const priority = { cet_high: 0, core: 1, secondary: 2, rare: 3 };

export function getPrimaryMeaning(word = {}) {
  const candidates = [...(word.examMeanings || []), ...(word.meanings || [])];
  if (word.primaryMeaning) candidates.push(word.primaryMeaning);
  const primary = candidates.sort((left, right) => (priority[left?.priority] ?? 9) - (priority[right?.priority] ?? 9))[0];
  if (primary) return primary;
  const fallback = String(word.meaning || '').trim();
  return fallback ? { pos: word.pos || '', meaning: fallback, priority: 'core', language: 'zh' } : null;
}

export function getPartOfSpeechLabels(word = {}) {
  return [...new Set((word.partsOfSpeech || []).map((part) => part.pos).filter(Boolean))];
}

export function getCETTags(word = {}) {
  const level = word.cetLevel || word.exam || '';
  const rank = Number(word.frequencyRank);
  const lead = level ? (rank > 0 && rank <= 2104 ? `${level} 高频` : level) : '';
  return [...new Set([lead, ...(word.tags || []).filter((tag) => tag !== level)])].filter(Boolean).slice(0, 2);
}

function isVerifiedExamExample(example) {
  return example?.sourceVerified === true && example.exam && Number(example.year) > 0 && Number(example.month) > 0 && example.section && example.source;
}

export function getPreferredContext(word = {}) {
  const verified = (word.examExamples || []).find(isVerifiedExamExample);
  if (verified) return { ...verified, kind: 'exam', label: '真题语境' };
  const fallback = (word.exampleSentences || [])[0] || (word.examExamples || [])[0];
  return fallback ? { ...fallback, kind: 'example', label: '示例语境', sourceVerified: false } : null;
}

export function formatExamProvenance(context = {}) {
  if (context.kind !== 'exam') return '';
  return [context.exam, `${context.year}.${String(context.month).padStart(2, '0')}`, context.section].filter(Boolean).join(' · ');
}

export function getRecommendationReason({ stage, wordState = {}, word = {}, targetScore } = {}) {
  if (stage === 'review') return '今天到期复习';
  if (stage === 'weak') return wordState.lastResult === 'hard' ? '你上次标记为模糊' : '薄弱词再次巩固';
  if (Number(wordState.mistakeCount) > 0) return `你之前错过 ${Number(wordState.mistakeCount)} 次`;
  if (Number(word.frequencyRank) > 0 && Number(word.frequencyRank) <= 2104) return `${word.cetLevel || word.exam || 'CET'} 高频词`;
  return targetScore ? `你的 ${targetScore} 目标词` : '';
}

function remainingContexts(word, selected) {
  const selectedSentence = String(selected?.sentence || '').trim();
  return [...(word.examExamples || []), ...(word.exampleSentences || [])]
    .filter((context) => String(context?.sentence || '').trim() !== selectedSentence)
    .map((context) => isVerifiedExamExample(context)
      ? { ...context, kind: 'exam', label: '真题语境' }
      : { ...context, kind: 'example', label: '示例语境', sourceVerified: false });
}

export function getAnswerContent(word = {}, { rating = 'known', stage, wordState, targetScore } = {}) {
  const primaryMeaning = getPrimaryMeaning(word);
  const context = getPreferredContext(word);
  const detailed = rating === 'fuzzy' || rating === 'unknown';
  const full = rating === 'unknown';
  const explanation = detailed ? (word.plainExplanation || primaryMeaning?.explanation || '') : '';
  const collocations = detailed ? (word.collocations || []).slice(0, 2) : [];
  const commonMistakes = detailed ? (word.commonMistakes || []).slice(0, 1) : [];
  const memoryTip = full ? (word.memoryTip || '') : '';
  const rareMeanings = full ? (word.rareMeanings || []).slice(0, 1) : [];
  const recommendation = getRecommendationReason({ stage, wordState, word, targetScore });
  const more = {
    meanings: (word.meanings || []).filter((meaning) => meaning !== primaryMeaning && (meaning.meaning !== primaryMeaning?.meaning || meaning.pos !== primaryMeaning?.pos)),
    contexts: remainingContexts(word, context),
    collocations: (word.collocations || []).slice(detailed ? 2 : 0),
    rareMeanings: (word.rareMeanings || []).slice(full ? 1 : 0),
    commonMistakes: (word.commonMistakes || []).slice(detailed ? 1 : 0),
    memoryTip: full ? '' : (word.memoryTip || ''),
    roots: word.roots || [],
    affixes: word.affixes || [],
    wordFamily: word.wordFamily || [],
    synonyms: word.synonyms || [],
    confusableWords: word.confusableWords || [],
  };
  const hasMore = Object.values(more).some((value) => Array.isArray(value) ? value.length : Boolean(value));
  const sections = [
    primaryMeaning && 'meaning', context && 'context', explanation && 'explanation', collocations.length && 'collocations',
    commonMistakes.length && 'commonMistakes', memoryTip && 'memoryTip', rareMeanings.length && 'rareMeanings', recommendation && 'recommendation',
  ].filter(Boolean);
  return { primaryMeaning, context, explanation, collocations, commonMistakes, memoryTip, rareMeanings, recommendation, more, hasMore, sections };
}
