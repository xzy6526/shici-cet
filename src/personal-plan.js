const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const DAY_MS = 86400000;

function hash(value) {
  let result = 2166136261;
  for (const character of String(value)) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function bandCategory(word) {
  if (word?.rareMeanings?.length) return 'rareMeaning';
  const rank = Number(word?.frequencyRank) || 99999;
  if (rank <= 1600) return 'core';
  if (rank <= 2800) return 'highFrequency';
  return 'advanced';
}

export function scoreLearningPriority(word, wordState = {}, { profile = null, targetScore = 550, now = Date.now() } = {}) {
  const importance = clamp(Number(word?.importanceScore) || 0, 0, 100);
  const frequency = clamp(30 - Math.log1p(Number(word?.frequencyRank) || 4000) * 3, 0, 30);
  const assessment = wordState.assessedWeak ? 35 : wordState.assessedKnown ? -20 : 0;
  const mistakes = Math.min(30, (Number(wordState.mistakeCount) || 0) * 6 + (Number(wordState.wrongCount) || 0) * 3);
  const category = bandCategory(word);
  const profileWeakness = profile?.bandScores?.[category] == null ? 0 : (1 - Number(profile.bandScores[category])) * 24;
  const target = Number(targetScore) >= 600 && (category === 'advanced' || category === 'rareMeaning')
    ? 15
    : Number(targetScore) >= 550 && category !== 'core' ? 8 : 0;
  const overdue = wordState.nextReviewAt && Number(wordState.nextReviewAt) <= now
    ? Math.min(20, (now - Number(wordState.nextReviewAt)) / DAY_MS)
    : 0;
  return Number((importance + frequency + assessment + mistakes + profileWeakness + target + overdue).toFixed(3));
}

export function createPersonalLearningPool({ words = [], wordStates = {}, profile = null, targetScore = 550, seed = 'default', now = Date.now() } = {}) {
  return (Array.isArray(words) ? words : [])
    .filter((word) => word?.isStudyWord !== false && (wordStates[String(word.id)]?.status || 'unseen') === 'unseen')
    .map((word) => ({ word, score: scoreLearningPriority(word, wordStates[String(word.id)] || {}, { profile, targetScore, now }) }))
    .sort((left, right) => {
      const leftBucket = Math.floor(left.score / 10);
      const rightBucket = Math.floor(right.score / 10);
      return rightBucket - leftBucket
        || hash(`${seed}:${left.word.id}`) - hash(`${seed}:${right.word.id}`)
        || right.score - left.score;
    })
    .map(({ word }) => word);
}

const intensityFactor = { relaxed: 0.75, standard: 1, intensive: 1.25 };

export function recommendDailyQuota({ previousNewWords = 20, dueReviews = 0, remainingWords = 0, recentDays = [], intensity = 'standard' } = {}) {
  const previous = clamp(Math.round(Number(previousNewWords) || 20), 5, 100);
  const reasons = [];
  const totals = (Array.isArray(recentDays) ? recentDays : []).slice(-7).reduce((sum, day) => ({
    correct: sum.correct + (Number(day.correct) || 0),
    fuzzy: sum.fuzzy + (Number(day.fuzzy) || 0),
    unknown: sum.unknown + (Number(day.unknown) || 0),
    completion: sum.completion + (Number(day.completionRate) || 0),
    days: sum.days + 1,
  }), { correct: 0, fuzzy: 0, unknown: 0, completion: 0, days: 0 });
  const attempts = totals.correct + totals.fuzzy + totals.unknown;
  const accuracy = attempts ? totals.correct / attempts : null;
  let base = previous;
  if (Number(dueReviews) >= 50) {
    base -= 5;
    reasons.push('HIGH_REVIEW_LOAD');
  } else if (Number(dueReviews) >= 25) {
    base -= 3;
    reasons.push('ELEVATED_REVIEW_LOAD');
  }
  if (accuracy != null && (accuracy < 0.55 || (totals.fuzzy + totals.unknown) / attempts > 0.45)) {
    base -= 4;
    reasons.push('LOW_RECENT_ACCURACY');
  } else if (accuracy != null && accuracy >= 0.85 && (!totals.days || totals.completion / totals.days >= 0.85)) {
    base += 2;
    reasons.push('HIGH_RECENT_ACCURACY');
  }
  const factor = intensityFactor[intensity] || 1;
  const scaled = Math.round(base * factor);
  const newWords = clamp(scaled, Math.max(5, previous - 5), Math.min(100, previous + 5, Math.max(1, Number(remainingWords) || 100)));
  if (!reasons.length) reasons.push('STEADY_PACE');
  return {
    newWords,
    reviews: Math.max(0, Math.round(Number(dueReviews) || 0)),
    learningIntensity: intensityFactor[intensity] ? intensity : 'standard',
    reasonCodes: reasons,
  };
}

