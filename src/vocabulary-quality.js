const statuses = new Set(['verified', 'derived', 'partial', 'missing']);
const present = (value) => Array.isArray(value) ? value.length > 0 : Boolean(String(value || '').trim());
const sourcePresent = (value) => typeof value === 'string'
  ? value.trim().length > 0
  : Boolean(value && typeof value === 'object' && String(value.name || value.source || value.url || '').trim());
const priorityValues = new Set(['cet_high', 'core', 'secondary', 'rare']);
const normalizedKey = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');

export function qualityStatus(word, field) {
  const status = String(word?.dataQuality?.[field] || '').toLowerCase();
  return statuses.has(status) ? status : 'missing';
}

export function hasIpa(value) {
  const text = String(value || '').trim();
  return /^\/[^/]+\/$/.test(text);
}

export function validateVocabulary(words = []) {
  const errors = [];
  const warnings = [];
  const seenIds = new Set();
  const seenWords = new Set();
  for (const word of words) {
    const label = String(word?.word || word?.id || 'unknown');
    if (word?.id === undefined || word?.id === null || word?.id === '') errors.push(`${label}: missing id`);
    if (!String(word?.word || '').trim()) errors.push(`${label}: missing word`);
    if (seenIds.has(String(word?.id))) errors.push(`${label}: duplicate id`);
    if (seenWords.has(String(word?.word || '').toLowerCase())) warnings.push(`${label}: duplicate spelling retained from source`);
    seenIds.add(String(word?.id));
    seenWords.add(String(word?.word || '').toLowerCase());
    for (const accent of ['uk', 'us']) {
      const phonetic = word?.phonetics?.[accent];
      if (phonetic?.ipa && !hasIpa(phonetic.ipa)) errors.push(`${label}: invalid ${accent} IPA`);
      if (phonetic?.status === 'verified' && !sourcePresent(phonetic.source)) errors.push(`${label}: verified ${accent} IPA lacks source`);
      const audio = word?.audio?.[accent];
      if (audio?.status === 'verified' && !sourcePresent(audio.source)) errors.push(`${label}: verified ${accent} audio lacks source`);
    }
    for (const example of word?.examExamples || []) {
      if (example.sourceVerified && (!sourcePresent(example.source) || !example.exam || Number(example.year) <= 0 || Number(example.month) <= 0 || !example.section)) {
        errors.push(`${label}: verified exam example metadata incomplete`);
      }
    }
    for (const [field, values] of [['collocations', word?.collocations], ['examples', word?.examples]]) {
      const keys = (values || []).map((value) => normalizedKey(value?.phrase || value?.sentence)).filter(Boolean);
      if (new Set(keys).size !== keys.length) errors.push(`${label}: duplicate ${field}`);
    }
    for (const part of word?.partsOfSpeech || []) {
      if (!part?.pos) errors.push(`${label}: part of speech lacks label`);
      for (const meaning of part?.meanings || []) {
        if (!priorityValues.has(meaning?.priority)) errors.push(`${label}: invalid meaning priority`);
      }
    }
    for (const meaning of word?.meanings || []) {
      if (!priorityValues.has(meaning?.priority)) errors.push(`${label}: invalid meaning priority`);
    }
    if (word?.primaryMeaning) {
      if (!priorityValues.has(word.primaryMeaning.priority)) errors.push(`${label}: invalid primary meaning priority`);
      if (word.primaryMeaning.verified === true && !sourcePresent(word.primaryMeaning.source)) errors.push(`${label}: verified primary meaning lacks source`);
    }
    for (const item of word?.collocations || []) {
      if (item?.verified === true && !sourcePresent(item.source)) errors.push(`${label}: verified collocation lacks source`);
    }
    for (const [field, values] of [['roots', word?.roots], ['affixes', word?.affixes]]) {
      for (const item of values || []) {
        if (!item?.word) errors.push(`${label}: ${field} item lacks form`);
        if (item?.verified === true && !sourcePresent(item.source)) errors.push(`${label}: verified ${field} lacks source`);
      }
    }
    for (const item of word?.wordFamily || []) {
      if (!item?.word) errors.push(`${label}: word family item lacks word`);
    }
    for (const example of word?.examples || []) {
      if (example.sourceVerified === true) errors.push(`${label}: ordinary example cannot be marked as verified exam content`);
    }
  }
  return { valid: errors.length === 0, errors, warnings };
}

export function coverageFor(words = []) {
  const fields = {
    ukIpa: (word) => present(word.phoneticUK), usIpa: (word) => present(word.phoneticUS),
    ukAudio: (word) => present(word.audio?.uk?.url || word.phonetics?.uk?.audio || word.audioUK),
    usAudio: (word) => present(word.audio?.us?.url || word.phonetics?.us?.audio || word.audioUS),
    partsOfSpeech: (word) => present(word.partsOfSpeech), primaryMeaning: (word) => present(word.primaryMeaning?.meaning),
    multipleMeanings: (word) => (word.meanings || []).length > 1,
    cetPriorityMeaning: (word) => word.primaryMeaning?.cetPriority === true || word.primaryMeaning?.priority === 'cet_high',
    collocations: (word) => present(word.collocations), examples: (word) => present(word.examples),
    roots: (word) => present(word.roots), affixes: (word) => present(word.affixes),
    rootsOrAffixes: (word) => present(word.roots) || present(word.affixes),
    wordFamily: (word) => present(word.wordFamily), confusableWords: (word) => present(word.confusableWords), rareMeanings: (word) => present(word.rareMeanings),
    examExamples: (word) => (word.examExamples || []).some((item) => item.sourceVerified), sources: (word) => present(word.sources),
  };
  const total = words.length;
  return Object.fromEntries(Object.entries(fields).map(([name, check]) => {
    const count = words.filter(check).length;
    return [name, { count, total, percent: total ? Number((count / total * 100).toFixed(2)) : 0 }];
  }));
}
