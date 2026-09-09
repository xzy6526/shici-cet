const PRIORITY_ORDER = { cet_high: 0, core: 1, secondary: 2, rare: 3 };

const text = (value) => String(value ?? '').trim();

function bestExistingMeaning(word) {
  if (word.primaryMeaning?.meaning) return word.primaryMeaning;
  return (word.partsOfSpeech || [])
    .flatMap((part) => (part.meanings || []).map((meaning) => ({ ...meaning, pos: meaning.pos || part.pos })))
    .filter((meaning) => meaning.meaning)
    .sort((left, right) => (PRIORITY_ORDER[left.priority] ?? 9) - (PRIORITY_ORDER[right.priority] ?? 9))[0] || null;
}

export function withCETPriorityMeaning(word = {}) {
  const rank = Number(word.frequencyRank);
  const isCETPriority = rank > 0 && rank <= 2104;
  const existing = bestExistingMeaning(word);
  const source = text(word.source || 'CET-4 词库');
  const primaryMeaning = existing || (text(word.meaning)
    ? {
      pos: text(word.pos),
      meaning: text(word.meaning),
      explanation: '',
      priority: isCETPriority ? 'cet_high' : 'core',
      cetPriority: true,
      language: 'zh',
      source,
      verified: true,
    }
    : null);
  if (!primaryMeaning) return word;
  return {
    ...word,
    primaryMeaning: {
      ...primaryMeaning,
      priority: isCETPriority ? 'cet_high' : (primaryMeaning.priority || 'core'),
      cetPriority: primaryMeaning.cetPriority !== false,
      source: primaryMeaning.source || source,
    },
    dataQuality: {
      ...word.dataQuality,
      cetPriorityMeaning: 'derived',
    },
  };
}
