import { normalizeWord, createUserWordState } from './domain.js';
import { createPersonalLearningPool } from './personal-plan.js';

const asState = (wordStates, id) => wordStates?.[String(id)] || wordStates?.[id] || createUserWordState(id);

export function getWordById(words, id) {
  return (Array.isArray(words) ? words : []).find((word) => String(word.id) === String(id)) || null;
}

export function normalizeWords(words) {
  return (Array.isArray(words) ? words : []).map(normalizeWord);
}

export function searchWords(words, query) {
  const needle = String(query || '').trim().toLowerCase();
  if (!needle) return Array.isArray(words) ? words : [];
  return (Array.isArray(words) ? words : []).filter((word) => {
    const haystack = [word.word, word.meaning, word.secondary, word.category, word.subcategory, ...(word.tags || [])].join(' ').toLowerCase();
    return haystack.includes(needle);
  });
}

export function getReviewCandidates(words, wordStates = {}, now = Date.now()) {
  return (Array.isArray(words) ? words : [])
    .filter((word) => {
      const state = asState(wordStates, word.id);
      return state.status !== 'hidden' && state.nextReviewAt != null && Number(state.nextReviewAt) <= Number(now);
    })
    .sort((a, b) => {
      const left = asState(wordStates, a.id);
      const right = asState(wordStates, b.id);
      const risk = (state) => (state.difficulty * 100) + (state.mistakeCount * 12) + Math.min(30, (Number(now) - Number(state.lastReviewedAt || now)) / 86400000);
      return risk(right) - risk(left) || (Number(a.frequencyRank) || 99999) - (Number(b.frequencyRank) || 99999);
    });
}

export function getNewWordCandidates(words, wordStates = {}, settings = {}, context = {}) {
  return createPersonalLearningPool({
    words,
    wordStates,
    profile: context.profile || null,
    targetScore: settings.targetScore,
    seed: context.seed || 'default',
    now: context.now,
  });
}

export function getFavoriteWords(words, wordStates = {}) {
  return (Array.isArray(words) ? words : []).filter((word) => asState(wordStates, word.id).favorite);
}

export function getMistakeWords(words, wordStates = {}) {
  return (Array.isArray(words) ? words : []).filter((word) => {
    const state = asState(wordStates, word.id);
    return state.status !== 'hidden' && (state.mistakeCount > 0 || state.wrongCount > 0 || state.familiarity === 'vague');
  });
}

export function getHiddenWords(words, wordStates = {}) {
  return (Array.isArray(words) ? words : []).filter((word) => asState(wordStates, word.id).status === 'hidden');
}

export function filterWords(words, filter, wordStates = {}) {
  const list = Array.isArray(words) ? words : [];
  if (!filter || filter === 'all' || filter === 'study') return list;
  if (filter === 'favorite') return getFavoriteWords(list, wordStates);
  if (filter === 'mistake') return getMistakeWords(list, wordStates);
  if (filter === 'hidden') return getHiddenWords(list, wordStates);
  if (filter === 'unseen' || filter === 'weak' || filter === 'mastered') return list.filter((word) => asState(wordStates, word.id).status === filter);
  if (filter === 'high' || filter === 'medium' || filter === 'low') return list.filter((word) => {
    const rank = Number(word.frequencyRank) || 99999;
    return filter === 'high' ? rank <= 1300 : filter === 'medium' ? rank > 1300 && rank <= 2800 : rank > 2800;
  });
  return list.filter((word) => (word.categories || []).some((category) => category.toLowerCase().includes(filter.toLowerCase())));
}
