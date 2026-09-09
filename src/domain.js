const DEFAULT_NOW = () => Date.now();

export const STATE_SCHEMA_VERSION = 2;

const asText = (value) => String(value ?? '').trim();
const priorityOrder = { cet_high: 0, core: 1, secondary: 2, rare: 3 };
const posLabels = {
  noun: 'n.', n: 'n.', 'n.': 'n.', verb: 'v.', v: 'v.', 'v.': 'v.',
  adjective: 'adj.', adj: 'adj.', 'adj.': 'adj.', adverb: 'adv.', adv: 'adv.', 'adv.': 'adv.',
  preposition: 'prep.', prep: 'prep.', 'prep.': 'prep.', conjunction: 'conj.', conj: 'conj.', 'conj.': 'conj.',
  pronoun: 'pron.', pron: 'pron.', 'pron.': 'pron.', phrase: 'phr.', phr: 'phr.', 'phr.': 'phr.',
};

const normalizePos = (value) => posLabels[asText(value).toLowerCase()] || asText(value);

function normalizeMeaning(value, fallbackPos = '', fallbackPriority = 'core') {
  const source = value && typeof value === 'object' ? value : { meaning: value };
  const meaning = asText(source.meaning);
  if (!meaning) return null;
  const frequency = Number(source.frequency);
  const normalized = {
    ...source,
    pos: normalizePos(source.pos || fallbackPos),
    meaning,
    explanation: asText(source.explanation),
    priority: priorityOrder[source.priority] === undefined ? fallbackPriority : source.priority,
    frequency: Number.isFinite(frequency) ? frequency : null,
  };
  if ('cetPriority' in source) normalized.cetPriority = source.cetPriority === true;
  if ('verified' in source) normalized.verified = source.verified === true;
  if ('source' in source) normalized.source = asText(source.source);
  return normalized;
}

function normalizeParts(parts = []) {
  return (Array.isArray(parts) ? parts : []).map((part) => {
    const pos = normalizePos(part?.pos);
    const meanings = (Array.isArray(part?.meanings) ? part.meanings : []).map((value) => normalizeMeaning(value, pos)).filter(Boolean);
    return { ...part, pos, meanings };
  }).filter((part) => part.pos || part.meanings.length);
}

function normalizeExample(value, defaults = {}) {
  const source = value && typeof value === 'object' ? value : { sentence: value };
  const sentence = asText(source.sentence || source.example);
  if (!sentence) return null;
  const normalized = {
    ...defaults,
    ...source,
    sentence,
    translation: asText(source.translation),
    wordMeaningInContext: asText(source.wordMeaningInContext),
    source: asText(source.source || defaults.source),
    sourceType: asText(source.sourceType || defaults.sourceType),
    sourceVerified: source.sourceVerified === true,
  };
  const targetMeaning = asText(source.targetMeaning || source.wordMeaningInContext);
  if (targetMeaning) normalized.targetMeaning = targetMeaning;
  if ('copyrightStatus' in source) normalized.copyrightStatus = asText(source.copyrightStatus);
  return normalized;
}

function normalizeCollocation(value) {
  const source = value && typeof value === 'object' ? value : { phrase: value };
  const phrase = asText(source.phrase || source.collocation).replace(/\s+/g, ' ');
  if (!phrase) return null;
  const normalized = { ...source, phrase, meaning: asText(source.meaning) };
  if ('source' in source) normalized.source = asText(source.source);
  if ('verified' in source) normalized.verified = source.verified === true;
  if ('examRelevance' in source) normalized.examRelevance = asText(source.examRelevance);
  return normalized;
}

function normalizeTerm(value) {
  const source = value && typeof value === 'object' ? value : { word: value };
  const word = asText(source.word || source.term || source.form);
  if (!word) return null;
  const normalized = { ...source, word, meaning: asText(source.meaning), note: asText(source.note || source.explanation) };
  if ('form' in source) normalized.form = asText(source.form);
  if ('source' in source) normalized.source = asText(source.source);
  if ('verified' in source) normalized.verified = source.verified === true;
  if ('relation' in source) normalized.relation = asText(source.relation);
  return normalized;
}

const qualityStates = new Set(['verified', 'derived', 'partial', 'missing']);
const normalizeQuality = (value, fallback = 'missing') => qualityStates.has(asText(value).toLowerCase())
  ? asText(value).toLowerCase()
  : fallback;

function normalizePhonetic(value, fallbackIpa = '', fallbackAudio = '') {
  const source = value && typeof value === 'object' ? value : {};
  const ipa = asText(source.ipa || fallbackIpa);
  const audio = asText(source.audio || fallbackAudio);
  const verified = source.verified === true;
  const sourceReference = source.source && typeof source.source === 'object'
    ? { ...source.source, name: asText(source.source.name || source.source.source) }
    : asText(source.source);
  return {
    ...source,
    ipa,
    audio,
    source: sourceReference,
    verified,
    status: normalizeQuality(source.status, ipa || audio ? (verified ? 'verified' : 'derived') : 'missing'),
  };
}

function normalizeAudioEntry(value, fallbackUrl = '') {
  const source = value && typeof value === 'object' ? value : {};
  const url = asText(source.url || source.audio || fallbackUrl);
  const verified = source.verified === true;
  const normalized = {
    ...source,
    url,
    verified,
    status: normalizeQuality(source.status, url ? (verified ? 'verified' : 'derived') : 'missing'),
  };
  if ('source' in source) normalized.source = source.source && typeof source.source === 'object'
    ? { ...source.source, name: asText(source.source.name || source.source.source) }
    : asText(source.source);
  return normalized;
}

function normalizeSources(value, fallback) {
  const list = Array.isArray(value) ? value : [];
  const sources = list.map((item) => {
    const source = item && typeof item === 'object' ? item : { name: item };
    const name = asText(source.name || source.source);
    return name ? { ...source, name, url: asText(source.url), license: asText(source.license), verified: source.verified === true } : null;
  }).filter(Boolean);
  return sources.length ? sources : (fallback ? [{ name: fallback, verified: true }] : []);
}

export function normalizeWord(word = {}) {
  const id = word.id ?? word.word;
  const phonetic = asText(word.phonetic);
  const phoneticUK = asText(word.phoneticUK || phonetic);
  const phoneticUS = asText(word.phoneticUS || phonetic);
  const phonetics = {
    uk: normalizePhonetic(word.phonetics?.uk, phoneticUK, word.audioUK),
    us: normalizePhonetic(word.phonetics?.us, phoneticUS, word.audioUS),
  };
  const audio = {
    uk: normalizeAudioEntry(word.audio?.uk, phonetics.uk.audio || word.audioUK),
    us: normalizeAudioEntry(word.audio?.us, phonetics.us.audio || word.audioUS),
  };
  const categories = Array.isArray(word.categories)
    ? word.categories.map(asText).filter(Boolean)
    : [word.category, word.subcategory].map(asText).filter(Boolean);
  const partsOfSpeech = normalizeParts(word.partsOfSpeech);
  const nestedMeanings = partsOfSpeech.flatMap((part) => part.meanings);
  const meanings = (nestedMeanings.length
    ? nestedMeanings
    : (Array.isArray(word.meanings) ? word.meanings : [word.meaning]).map((value) => normalizeMeaning(value, word.pos)).filter(Boolean));
  const explicitPrimary = normalizeMeaning(word.primaryMeaning, word.pos, 'cet_high');
  const primaryMeaning = explicitPrimary || [...meanings].sort((left, right) => (priorityOrder[left.priority] ?? 9) - (priorityOrder[right.priority] ?? 9))[0] || null;
  const rawExamples = Array.isArray(word.exampleSentences) ? word.exampleSentences : (Array.isArray(word.examples) ? word.examples : []);
  const exampleSentences = rawExamples.map((value) => normalizeExample(value, { sourceType: 'example' })).filter(Boolean);
  if (!exampleSentences.length && asText(word.example)) exampleSentences.push(normalizeExample({ sentence: word.example, translation: word.translation, source: word.source, sourceType: 'example' }));
  const examExamples = (Array.isArray(word.examExamples) ? word.examExamples : []).map((value) => normalizeExample(value, { sourceType: 'exam' })).filter(Boolean);
  const collocationSeen = new Set();
  const collocations = (Array.isArray(word.collocations) ? word.collocations : [word.collocation]).map(normalizeCollocation).filter((item) => {
    if (!item) return false;
    const key = item.phrase.toLowerCase().replace(/\s+/g, ' ');
    if (collocationSeen.has(key)) return false;
    collocationSeen.add(key);
    return true;
  });
  const tags = Array.isArray(word.tags) ? word.tags.map(asText).filter(Boolean) : [];
  const importanceScore = Number.isFinite(Number(word.importanceScore))
    ? Number(word.importanceScore)
    : Math.max(0, 10000 - (Number(word.frequencyRank) || 10000)) / 100;
  const sources = normalizeSources(word.sources, asText(word.source || 'CET-4 词库'));
  const declaredQuality = word.dataQuality && typeof word.dataQuality === 'object' ? word.dataQuality : {};
  const dataQuality = {
    phoneticUK: normalizeQuality(declaredQuality.phoneticUK, phonetics.uk.status),
    phoneticUS: normalizeQuality(declaredQuality.phoneticUS, phonetics.us.status),
    phonetics: normalizeQuality(declaredQuality.phonetics, [phonetics.uk, phonetics.us].every((item) => item.status === 'verified') ? 'verified' : [phonetics.uk, phonetics.us].some((item) => item.ipa) ? 'partial' : 'missing'),
    audio: normalizeQuality(declaredQuality.audio, [audio.uk, audio.us].every((item) => item.status === 'verified') ? 'verified' : [audio.uk, audio.us].some((item) => item.url) ? 'partial' : 'missing'),
    audioUK: normalizeQuality(declaredQuality.audioUK, audio.uk.status),
    audioUS: normalizeQuality(declaredQuality.audioUS, audio.us.status),
    partsOfSpeech: normalizeQuality(declaredQuality.partsOfSpeech, partsOfSpeech.length ? 'derived' : 'missing'),
    meanings: normalizeQuality(declaredQuality.meanings, meanings.length ? 'verified' : 'missing'),
    collocations: normalizeQuality(declaredQuality.collocations, collocations.length ? 'derived' : 'missing'),
    examples: normalizeQuality(declaredQuality.examples, exampleSentences.length ? 'derived' : 'missing'),
    examExamples: normalizeQuality(declaredQuality.examExamples, examExamples.some((item) => item.sourceVerified) ? 'verified' : 'missing'),
    roots: normalizeQuality(declaredQuality.roots, (word.roots || []).length ? 'derived' : 'missing'),
    affixes: normalizeQuality(declaredQuality.affixes, (word.affixes || []).length ? 'derived' : 'missing'),
    wordFamily: normalizeQuality(declaredQuality.wordFamily, (word.wordFamily || []).length ? 'derived' : 'missing'),
    confusableWords: normalizeQuality(declaredQuality.confusableWords, (word.confusableWords || []).length ? 'derived' : 'missing'),
    cetPriorityMeaning: normalizeQuality(declaredQuality.cetPriorityMeaning, primaryMeaning?.priority === 'cet_high' || primaryMeaning?.cetPriority === true ? 'derived' : 'missing'),
    rareMeanings: normalizeQuality(declaredQuality.rareMeanings, (word.rareMeanings || []).length ? 'derived' : 'missing'),
    sources: normalizeQuality(declaredQuality.sources, sources.length ? 'verified' : 'missing'),
  };
  return {
    ...word,
    id,
    word: asText(word.word).toLowerCase(),
    phonetic,
    phoneticUK,
    phoneticUS,
    audioUK: asText(word.audioUK),
    audioUS: asText(word.audioUS),
    audio,
    phonetics,
    type: word.type === 'phrase' ? 'phrase' : 'word',
    partsOfSpeech,
    meanings,
    primaryMeaning,
    plainExplanation: asText(word.plainExplanation || primaryMeaning?.explanation),
    cetLevel: asText(word.cetLevel || word.exam || 'CET-4'),
    frequency: Number.isFinite(Number(word.frequency)) ? Number(word.frequency) : 0,
    frequencyRank: Number.isFinite(Number(word.frequencyRank)) ? Number(word.frequencyRank) : word.frequencyRank ?? '',
    importanceScore,
    categories,
    tags,
    examples: exampleSentences,
    exampleSentences,
    examMeanings: (Array.isArray(word.examMeanings) ? word.examMeanings : []).map((value) => normalizeMeaning(value, word.pos, 'cet_high')).filter(Boolean),
    examExamples,
    collocations,
    commonMistakes: Array.isArray(word.commonMistakes) ? word.commonMistakes.map(asText).filter(Boolean) : [asText(word.pitfall)].filter(Boolean),
    rareMeanings: (Array.isArray(word.rareMeanings) ? word.rareMeanings : [word.extended]).map((value) => normalizeMeaning(value, word.pos, 'rare')).filter(Boolean),
    wordFamily: (Array.isArray(word.wordFamily) ? word.wordFamily : []).map(normalizeTerm).filter(Boolean),
    roots: (Array.isArray(word.roots) ? word.roots : []).map(normalizeTerm).filter(Boolean),
    affixes: (Array.isArray(word.affixes) ? word.affixes : []).map(normalizeTerm).filter(Boolean),
    memoryTip: asText(word.memoryTip),
    synonyms: Array.isArray(word.synonyms) ? word.synonyms.map(asText).filter(Boolean) : [],
    confusableWords: (Array.isArray(word.confusableWords) ? word.confusableWords : []).map(normalizeTerm).filter(Boolean),
    source: asText(word.source || 'CET-4 词库'),
    sources,
    dataQuality,
  };
}

export function createUserWordState(wordId, now = DEFAULT_NOW()) {
  return {
    wordId,
    status: 'unseen',
    familiarity: 'unknown',
    reviewCount: 0,
    correctCount: 0,
    wrongCount: 0,
    streak: 0,
    lastReviewedAt: null,
    nextReviewAt: null,
    interval: 0,
    ease: 2.3,
    difficulty: 0.5,
    lapses: 0,
    lastResult: null,
    firstLearnedAt: null,
    masteredAt: null,
    favorite: false,
    favoriteFolders: [],
    mistakeCount: 0,
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeWordState(value, wordId, now) {
  const base = createUserWordState(wordId, now);
  if (!value || typeof value !== 'object') return base;
  const merged = { ...base, ...value, wordId };
  merged.status = ['unseen', 'learning', 'weak', 'reviewing', 'mastered', 'hidden'].includes(merged.status) ? merged.status : base.status;
  merged.familiarity = ['unknown', 'vague', 'known'].includes(merged.familiarity) ? merged.familiarity : base.familiarity;
  merged.favorite = Boolean(merged.favorite);
  merged.favoriteFolders = Array.isArray(merged.favoriteFolders) ? merged.favoriteFolders.filter(Boolean).map(String) : [];
  for (const field of ['reviewCount', 'correctCount', 'wrongCount', 'streak', 'interval', 'lapses', 'mistakeCount']) {
    merged[field] = Math.max(0, Number(merged[field]) || 0);
  }
  merged.ease = Math.min(3, Math.max(1.3, Number(merged.ease) || base.ease));
  merged.difficulty = Math.min(1, Math.max(0, Number(merged.difficulty) || base.difficulty));
  return merged;
}

export function migrateState(saved, words, now = DEFAULT_NOW()) {
  const list = Array.isArray(words) ? words : [];
  const validIds = new Map(list.map((word) => [String(word.id), word.id]));
  const initial = createInitialState(list, now);
  if (!saved || typeof saved !== 'object') return initial;
  const validId = (id) => validIds.get(String(id));
  const queue = Array.isArray(saved.queue) ? saved.queue.map(validId).filter((id) => id !== undefined) : [];
  const completed = Array.isArray(saved.completed) ? saved.completed.map(validId).filter((id) => id !== undefined) : [];
  const favorites = Array.isArray(saved.favorites) ? saved.favorites.map(validId).filter((id) => id !== undefined) : [];
  const weakToday = Array.isArray(saved.weakToday) ? saved.weakToday.map(validId).filter((id) => id !== undefined) : [];
  const pendingImported = Array.isArray(saved.pendingImported) ? saved.pendingImported.map(validId).filter((id) => id !== undefined) : [];
  const wordStates = {};
  if (saved.wordStates && typeof saved.wordStates === 'object') {
    for (const [key, value] of Object.entries(saved.wordStates)) {
      const id = validId(value?.wordId ?? key);
      if (id !== undefined) wordStates[String(id)] = normalizeWordState(value, id, now);
    }
  }
  for (const id of favorites) {
    const key = String(id);
    wordStates[key] = normalizeWordState({ ...wordStates[key], favorite: true }, id, now);
  }
  const settings = { ...initial.settings, ...(saved.settings || {}) };
  settings.themePreference = ['system', 'light', 'dark'].includes(settings.themePreference) ? settings.themePreference : 'system';
  settings.themeUpdatedAt = Math.max(0, Number(settings.themeUpdatedAt) || 0);
  const sessionMode = ['daily', 'review'].includes(saved.sessionMode) ? saved.sessionMode : null;
  const reviewScope = ['daily', 'batch'].includes(saved.reviewScope) ? saved.reviewScope : null;
  const completionType = ['batch', 'review', 'daily'].includes(saved.completionType) ? saved.completionType : null;
  return {
    ...initial,
    ...saved,
    schemaVersion: STATE_SCHEMA_VERSION,
    localUserId: asText(saved.localUserId) || initial.localUserId,
    queue: queue.length ? queue : initial.queue,
    queueIndex: Math.min(Math.max(Number(saved.queueIndex) || 0, 0), Math.max((queue.length || initial.queue.length) - 1, 0)),
    newCursor: Math.min(Math.max(Number(saved.newCursor) || initial.newCursor, 0), list.length),
    pendingImported,
    sessionMode,
    reviewScope,
    completionType,
    completed,
    favorites,
    weakToday,
    wordStates,
    settings,
    history: saved.history && typeof saved.history === 'object' ? saved.history : {},
    stats: { ...initial.stats, ...(saved.stats || {}) },
  };
}

export function createInitialState(words, now = DEFAULT_NOW()) {
  const list = Array.isArray(words) ? words : [];
  const dailyNew = 20;
  const queue = list.slice(0, dailyNew).map((word) => word.id);
  return {
    schemaVersion: STATE_SCHEMA_VERSION,
    localUserId: `local-${now}-${Math.random().toString(36).slice(2, 8)}`,
    screen: 'home',
    queue,
    queueIndex: 0,
    newCursor: queue.length,
    pendingImported: [],
    sessionMode: null,
    reviewScope: null,
    completionType: null,
    revealed: false,
    rating: null,
    completed: [],
    favorites: [],
    weakToday: [],
    dueCount: 0,
    dailyTask: null,
    history: {},
    stats: {
      totalLearned: 0,
      totalMastered: 0,
      totalReviewed: 0,
      todayLearned: 0,
      todayReviewed: 0,
      plannedBatchSize: dailyNew,
      uniqueNewWordsToday: 0,
      reviewCardsShown: 0,
      weakWordsToday: 0,
      extraNewWordsToday: 0,
      weakWords: 0,
      streakDays: 0,
      lastStudyDate: null,
    },
    wordStates: {},
    settings: {
      exam: 'CET-4',
      targetScore: 550,
      examDate: '2026-12-19',
      dailyNew,
      pronunciationPreference: 'uk',
      themePreference: 'system',
      themeUpdatedAt: now,
      showProgress: true,
      preferences: { reading: true, listening: true, writing: true },
    },
  };
}

export function stateForWord(state, wordId, now = DEFAULT_NOW()) {
  const key = String(wordId);
  if (!state.wordStates) state.wordStates = {};
  if (!state.wordStates[key]) state.wordStates[key] = createUserWordState(wordId, now);
  return state.wordStates[key];
}
