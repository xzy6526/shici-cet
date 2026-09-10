import { createUserWordState } from './domain.js';

export const ASSESSMENT_VERSION = 1;

export function shouldAutoStartAssessment({ hadLocalData = false, mergedHasLearningData = false, profile = null, assessment = null } = {}) {
  return !hadLocalData && !mergedHasLearningData && !profile && !assessment?.completed && !assessment?.skipped;
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const text = (value) => String(value ?? '').trim();
const hash = (value) => {
  let result = 2166136261;
  for (const character of String(value)) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
};

function primaryMeaning(word) {
  const source = word?.primaryMeaning || word?.meanings?.[0] || null;
  const meaning = text(source?.meaning || word?.meaning);
  const pos = text(source?.pos || word?.pos || inferPartOfSpeech(word, meaning));
  return meaning && pos ? { meaning, pos } : null;
}

function meaningTerms(value) {
  return text(value).replaceAll('+', '').split(/[；;、，,\/]/).map((item) => item.trim()).filter(Boolean);
}

function inferPartOfSpeech(word, meaning) {
  const targetTerms = meaningTerms(meaning);
  const matches = (word?.partsOfSpeech || []).map((part) => {
    const sourceTerms = (part.meanings || []).flatMap((entry) => meaningTerms(entry.meaning));
    const score = targetTerms.reduce((sum, target) => sum + (sourceTerms.some((source) => source.includes(target) || target.includes(source)) ? 1 : 0), 0);
    return { pos: text(part.pos), score };
  }).filter((entry) => entry.pos).sort((left, right) => right.score - left.score);
  if (matches[0]?.score > 0) return matches[0].pos;
  if (targetTerms.some((term) => term.endsWith('的'))) return 'adj.';
  if (targetTerms.some((term) => term.endsWith('地') || term.endsWith('上'))) return 'adv.';
  return matches.length === 1 ? matches[0].pos : '';
}

export function assessmentBand(word) {
  const rank = Number(word?.frequencyRank) || 99999;
  if (word?.rareMeanings?.length) return 5;
  if (rank <= 800) return 1;
  if (rank <= 1600) return 2;
  if (rank <= 2600) return 3;
  if (rank <= 3500) return 4;
  return 5;
}

export function buildAssessmentPool(words = []) {
  const seenWords = new Set();
  return (Array.isArray(words) ? words : []).flatMap((word) => {
    const answer = primaryMeaning(word);
    const key = text(word?.word).toLowerCase();
    if (!word?.isStudyWord || !key || seenWords.has(key) || !answer || answer.meaning.length > 42) return [];
    seenWords.add(key);
    return [{
      wordId: word.id,
      word: text(word.word),
      phonetic: text(word.phoneticUK || word.phonetics?.uk?.ipa || word.phonetic),
      meaning: answer.meaning,
      pos: answer.pos,
      category: text(word.category || word.categories?.[0]),
      band: assessmentBand(word),
      type: word.rareMeanings?.length ? 'rareMeaning' : 'meaning',
    }];
  });
}

export function createAssessmentState({ seed = `assessment-${Date.now()}`, minQuestions = 20, targetCount = 26, maxQuestions = 30 } = {}) {
  return {
    version: ASSESSMENT_VERSION,
    seed: String(seed),
    startedAt: Date.now(),
    minQuestions: clamp(Number(minQuestions) || 20, 1, 36),
    targetCount: clamp(Number(targetCount) || 26, 1, 36),
    maxQuestions: clamp(Number(maxQuestions) || 30, 1, 36),
    currentQuestion: null,
    answers: [],
    testedWordIds: [],
    estimatedLevel: 3,
    confidence: 0,
    completed: false,
    completedAt: null,
  };
}

function pick(list, key) {
  if (!list.length) return null;
  return list[hash(key) % list.length];
}

export function isAssessmentQuestionValid(question) {
  if (!question || !Array.isArray(question.options) || question.options.length !== 5) return false;
  if (question.correctIndex < 0 || question.correctIndex > 3 || question.options[4]?.kind !== 'unknown') return false;
  const meanings = question.options.slice(0, 4).map((option) => text(option.text).replace(/\s+/g, ''));
  return meanings.every(Boolean)
    && new Set(meanings).size === meanings.length
    && meanings[question.correctIndex] === text(question.meaning).replace(/\s+/g, '');
}

function buildQuestion(state, pool) {
  const tested = new Set(state.testedWordIds.map(String));
  const level = clamp(Math.round(state.estimatedLevel), 1, 5);
  const exact = pool.filter((item) => item.band === level && !tested.has(String(item.wordId)));
  const nearby = pool.filter((item) => Math.abs(item.band - level) <= 1 && !tested.has(String(item.wordId)));
  const item = pick(exact.length ? exact : nearby, `${state.seed}:item:${state.answers.length}`)
    || pick(pool.filter((entry) => !tested.has(String(entry.wordId))), `${state.seed}:fallback:${state.answers.length}`);
  if (!item) return null;
  const distractorPool = pool.filter((entry) => entry.wordId !== item.wordId
    && entry.pos === item.pos
    && entry.meaning !== item.meaning
    && Math.abs(entry.band - item.band) <= 1);
  const distractors = [];
  const sameCategory = item.category ? distractorPool.filter((entry) => entry.category === item.category) : [];
  const source = sameCategory.length >= 3 ? sameCategory : [...sameCategory, ...distractorPool.filter((entry) => !sameCategory.includes(entry))];
  const candidates = [...source].sort((left, right) => hash(`${state.seed}:${item.wordId}:${left.wordId}`) - hash(`${state.seed}:${item.wordId}:${right.wordId}`));
  for (const candidate of candidates) {
    if (!distractors.some((entry) => entry.meaning === candidate.meaning)) distractors.push(candidate);
    if (distractors.length === 3) break;
  }
  if (distractors.length < 3) return null;
  const correctIndex = hash(`${state.seed}:answer:${item.wordId}`) % 4;
  const choices = distractors.map((entry) => ({ text: entry.meaning, kind: 'meaning', category: entry.category }));
  choices.splice(correctIndex, 0, { text: item.meaning, kind: 'meaning', category: item.category });
  choices.push({ text: '不认识', kind: 'unknown', category: null });
  const question = { ...item, options: choices, correctIndex };
  return isAssessmentQuestionValid(question) ? question : null;
}

export function getAssessmentQuestion(state, pool = []) {
  if (!state || state.completed) return null;
  if (!state.currentQuestion) state.currentQuestion = buildQuestion(state, pool);
  return state.currentQuestion;
}

function calculateConfidence(answers) {
  const count = answers.length;
  if (!count) return 0;
  const recent = answers.slice(-8);
  const levels = recent.map((answer) => answer.levelAfter);
  const spread = levels.length ? Math.max(...levels) - Math.min(...levels) : 4;
  const stable = clamp(1 - spread / 4, 0, 1);
  return Number(clamp((count / 20) * 0.65 + stable * 0.35, 0, 1).toFixed(2));
}

function canFinishEarly(state) {
  if (state.answers.length < state.minQuestions || state.confidence < 0.8) return false;
  const recent = state.answers.slice(-8);
  const accuracy = recent.filter((answer) => answer.correct).length / recent.length;
  return accuracy >= 0.75 || accuracy <= 0.25;
}

export function answerAssessment(state, choiceIndex, pool = [], now = Date.now()) {
  if (!state || state.completed) return state;
  const question = getAssessmentQuestion(state, pool);
  if (!question) return { ...state, completed: true, completedAt: now };
  const selected = Number(choiceIndex);
  const correct = selected === question.correctIndex;
  const nextLevel = clamp(state.estimatedLevel + (correct ? 1 : -1), 1, 5);
  const answer = {
    wordId: question.wordId,
    band: question.band,
    correct,
    selectedIndex: selected,
    correctIndex: question.correctIndex,
    levelBefore: state.estimatedLevel,
    levelAfter: nextLevel,
    answeredAt: now,
  };
  const next = {
    ...state,
    currentQuestion: null,
    answers: [...state.answers, answer],
    testedWordIds: [...state.testedWordIds, question.wordId],
    estimatedLevel: nextLevel,
  };
  next.confidence = calculateConfidence(next.answers);
  next.completed = next.answers.length >= next.maxQuestions || next.answers.length >= next.targetCount || canFinishEarly(next);
  next.completedAt = next.completed ? now : null;
  if (!next.completed) next.currentQuestion = buildQuestion(next, pool);
  return next;
}

const scoreFor = (answers, predicate, fallback) => {
  const relevant = answers.filter(predicate);
  return relevant.length ? relevant.filter((answer) => answer.correct).length / relevant.length : fallback;
};

export function createVocabularyProfile(state, now = Date.now()) {
  const answers = state?.answers || [];
  const levelPrior = clamp(((Number(state?.estimatedLevel) || 3) - 1) / 4, 0, 1);
  const bandScores = {
    core: scoreFor(answers, (answer) => answer.band <= 2, levelPrior),
    highFrequency: scoreFor(answers, (answer) => answer.band === 3, levelPrior),
    advanced: scoreFor(answers, (answer) => answer.band === 4, levelPrior),
    rareMeaning: scoreFor(answers, (answer) => answer.band === 5, levelPrior),
  };
  const coverage = Object.values(bandScores).reduce((sum, value) => sum + value, 0) / 4;
  const margin = 0.05 + (1 - (Number(state?.confidence) || 0)) * 0.15;
  const weakCategories = Object.entries(bandScores).filter(([, value]) => value < 0.55).map(([key]) => key);
  return {
    assessmentVersion: ASSESSMENT_VERSION,
    completedAt: state?.completedAt || now,
    estimatedCoverage: { min: Number(clamp(coverage - margin, 0, 1).toFixed(2)), max: Number(clamp(coverage + margin, 0, 1).toFixed(2)) },
    estimatedLevel: Number(state?.estimatedLevel) || 3,
    confidence: Number(state?.confidence) || 0,
    bandScores,
    testedWords: answers.map(({ wordId, correct, band }) => ({ wordId, correct, band })),
    weakCategories,
    source: 'assessment',
    lastUpdatedAt: now,
  };
}

function profileBandForWord(word) {
  const band = assessmentBand(word);
  return band <= 2 ? 'core' : band === 3 ? 'highFrequency' : band === 4 ? 'advanced' : 'rareMeaning';
}

export function updateVocabularyProfileFromLearning(profile, word, wordState, now = Date.now()) {
  if (!profile || !word || !wordState) return profile;
  const attempts = (Number(wordState.correctCount) || 0) + (Number(wordState.wrongCount) || 0);
  if (!attempts) return profile;
  const category = profileBandForWord(word);
  const observed = (Number(wordState.correctCount) || 0) / attempts;
  const weight = clamp(0.12 + (Number(wordState.reviewCount) || 0) * 0.12, 0.12, 0.6);
  const current = Number(profile.bandScores?.[category]);
  const prior = Number.isFinite(current) ? current : 0.5;
  return {
    ...profile,
    source: 'adaptive',
    bandScores: { ...profile.bandScores, [category]: Number(clamp(prior * (1 - weight) + observed * weight, 0.05, 0.95).toFixed(2)) },
    lastUpdatedAt: now,
  };
}

export function applyAssessmentToWordStates(wordStates = {}, state, now = Date.now()) {
  const next = { ...wordStates };
  for (const answer of state?.answers || []) {
    const key = String(answer.wordId);
    const current = { ...createUserWordState(answer.wordId, now), ...(next[key] || {}) };
    next[key] = {
      ...current,
      assessedKnown: answer.correct,
      assessedWeak: !answer.correct,
      assessmentEvidence: { version: ASSESSMENT_VERSION, correct: answer.correct, band: answer.band, assessedAt: answer.answeredAt || now },
      updatedAt: Math.max(Number(current.updatedAt) || 0, now),
    };
  }
  return next;
}
