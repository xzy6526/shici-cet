import { studyWords, words } from './words.js';
import { createInitialState, loadState, saveState, setThemePreference, updateSettings } from './state.js';
import { parseCsv, parseJson, parseTextLines } from './importer.js';
import { createGuestAccount, createLocalMigrationSnapshot, maskEmail } from './account.js';
import { normalizeWord, stateForWord } from './domain.js';
import { getFavoriteWords, getHiddenWords, getMistakeWords, getNewWordCandidates, filterWords } from './repository.js';
import { addBatchReviewWords, appendNewBatch, calculateStreak, completeBatch, createDailyTask, dateKey, daysUntilExam as taskDaysUntilExam, getBatch, getPendingBatchReviewIds, getPendingReviewEntries, getPendingReviewIds, normalizeDailyTask as normalizeTask } from './tasks.js';
import { scheduleReview } from './scheduler.js';
import { getPhonetic, pronunciationService } from './pronunciation.js';
import { createStorage } from './storage.js';
import { advanceStudySession, applyStudyRating, getStudyProgress } from './study-session.js';
import { authService } from './services/auth.js';
import { createSyncService, hasMeaningfulLocalData } from './services/sync.js';
import { createThemeService } from './services/theme.js';
import { renderLoginResend } from './login-ui.js';
import { formatExamProvenance, getAnswerContent, getCETTags, getPartOfSpeechLabels, getPrimaryMeaning, getRecommendationReason } from './word-card.js';
import { answerAssessment, applyAssessmentToWordStates, buildAssessmentPool, createAssessmentState, createVocabularyProfile, getAssessmentQuestion, shouldAutoStartAssessment, updateVocabularyProfileFromLearning } from './assessment.js';
import { recommendDailyQuota } from './personal-plan.js';

const app = document.querySelector('#app');
const IMPORT_STORAGE_KEY = 'shici-cet-imported-words-v1';
const MIGRATION_STORAGE_KEY = 'shici-cet-account-migration-v1';
const appStorage = createStorage();
let baseWords = words;
let baseWordsById = new Map(baseWords.map((word) => [String(word.id), word]));
let baseStudyWords = studyWords.map((word) => baseWordsById.get(String(word.id))).filter(Boolean);
let importedWords = loadImportedWords().map(normalizeWord);
let cachedStudyPool = null;
let cachedLibraryPool = null;
let cachedStudyWordsById = null;
let cachedLibraryWordsById = null;
let displayWordCache = new Map();
let vocabularyHydrationPromise = null;
let vocabularyHydrationTimer = 0;
let vocabularyHydrated = false;
function studyPool() {
  if (!cachedStudyPool) {
    cachedStudyPool = [...baseStudyWords, ...importedWords];
    cachedStudyWordsById = new Map(cachedStudyPool.map((word) => [String(word.id), word]));
  }
  return cachedStudyPool;
}
function libraryPool() {
  if (!cachedLibraryPool) {
    cachedLibraryPool = [...importedWords, ...baseWords];
    cachedLibraryWordsById = new Map(cachedLibraryPool.map((word) => [String(word.id), word]));
  }
  return cachedLibraryPool;
}
function invalidateWordPoolCaches() {
  cachedStudyPool = null;
  cachedLibraryPool = null;
  cachedStudyWordsById = null;
  cachedLibraryWordsById = null;
  displayWordCache = new Map();
  assessmentPoolCache = null;
}
let state = loadState(studyPool());
let undoState = null;
let settingsOpen = false;
let libraryMode = 'all';
let libraryFilterTransition = false;
let importOpen = false;
let importPreview = [];
let wordDetailId = null;
let toastTimer;
let account = createGuestAccount();
let loginOpen = false;
let loginStep = 'email';
let loginEmail = '';
let loginError = '';
let loginHint = '';
let loginSubmitting = false;
let loginResendUntil = 0;
let loginCountdownTimer = 0;
let lastActionGesture = null;
let syncStatus = 'local';
let authenticatedSync = null;
let sheetGesture = null;
let sheetSpringFrame = 0;
let sheetSpringTimer = 0;
let navIndicatorFrame = 0;
let navIndicatorPosition = 0;
let navIndicatorVelocity = 0;
let navIndicatorTarget = 0;
let navIndicatorReady = false;
let libraryRenderToken = 0;
let libraryRenderFrame = 0;
let libraryRenderIdle = 0;
let preferenceSaveFrame = 0;
let renderedScreen = null;
let assessmentPoolCache = null;
let assessmentFeedback = null;
let assessmentPreparing = false;
const syncService = createSyncService(authService.client);
const themeService = createThemeService();

const icons = {
  arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6"/></svg>',
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5m6-6-6 6 6 6"/></svg>',
  book: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H19v17H7.5A2.5 2.5 0 0 0 5 21.5zM5 4.5v17M8 6h7M8 10h7"/></svg>',
  home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 10 8-6 8 6v9a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z"/></svg>',
  person: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.2"/><path d="M5 20c.8-3.2 3.1-5 7-5s6.2 1.8 7 5"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4.2 4.2L19 6.5"/></svg>',
  heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 8.9c0 5.2-8.8 10.1-8.8 10.1S3.2 14.1 3.2 8.9A4.7 4.7 0 0 1 12 6.2a4.7 4.7 0 0 1 8.8 2.7Z"/></svg>',
  heartFill: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" stroke="none" d="M20.8 8.9c0 5.2-8.8 10.1-8.8 10.1S3.2 14.1 3.2 8.9A4.7 4.7 0 0 1 12 6.2a4.7 4.7 0 0 1 8.8 2.7Z"/></svg>',
  info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 10v6M12 7.2v.1"/></svg>',
  settings: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8Zm8.2 3.4-1.7-.6a6.9 6.9 0 0 0-.7-1.7l.8-1.6-1.8-1.8-1.6.8a6.9 6.9 0 0 0-1.7-.7L13 4.7h-2l-.5 1.7a6.9 6.9 0 0 0-1.7.7l-1.6-.8-1.8 1.8.8 1.6a6.9 6.9 0 0 0-.7 1.7l-1.7.6v2.5l1.7.5c.2.6.4 1.2.7 1.7l-.8 1.6 1.8 1.8 1.6-.8c.5.3 1.1.5 1.7.7l.5 1.7h2l.5-1.7c.6-.2 1.2-.4 1.7-.7l1.6.8 1.8-1.8-.8-1.6c.3-.5.5-1.1.7-1.7l1.7-.5Z"/></svg>',
  sound: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 10v4h3l4 3V7l-4 3H5Zm10.2-1.5a5 5 0 0 1 0 7M17.5 6a8.4 8.4 0 0 1 0 12"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>',
};

const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const clone = (value) => JSON.parse(JSON.stringify(value));

function loadImportedWords() {
  const saved = appStorage.get(IMPORT_STORAGE_KEY, []);
  return Array.isArray(saved) ? saved.filter((word) => word?.id != null && word?.word) : [];
}

function saveImportedWords() {
  appStorage.set(IMPORT_STORAGE_KEY, importedWords);
}

function wordForDisplay(word) {
  if (!word || vocabularyHydrated) return word;
  const key = String(word.id ?? word.word);
  if (!displayWordCache.has(key)) displayWordCache.set(key, normalizeWord(word));
  return displayWordCache.get(key);
}

function ensureVocabularyHydrated() {
  if (vocabularyHydrated) return Promise.resolve();
  if (vocabularyHydrationPromise) return vocabularyHydrationPromise;
  vocabularyHydrationPromise = Promise.all([
    import('./reviewed-word-content.js'),
    import('./phonetic-overlay.js'),
    import('./lexical-overlay.js'),
    import('./cet-priority-overlay.js'),
  ]).then(async ([reviewedModule, phoneticModule, lexicalModule, cetModule]) => {
    const enrichBaseWord = (word) => normalizeWord(
      phoneticModule.withVerifiedPhonetics(
        lexicalModule.withVerifiedLexicalContent(
          cetModule.withCETPriorityMeaning(reviewedModule.withReviewedContent(word)),
        ),
      ),
    );
    const enrichedWords = new Array(words.length);
    let index = 0;
    const processChunk = (resolve) => {
      const deadline = performance.now() + 8;
      while (index < words.length && performance.now() < deadline) {
        enrichedWords[index] = enrichBaseWord(words[index]);
        index += 1;
      }
      if (index >= words.length) {
        resolve(enrichedWords);
        return;
      }
      if (window.requestIdleCallback) window.requestIdleCallback(() => processChunk(resolve), { timeout: 120 });
      else window.setTimeout(() => processChunk(resolve), 0);
    };
    const hydratedWords = await new Promise((resolve) => processChunk(resolve));
    baseWords = hydratedWords;
    baseWordsById = new Map(baseWords.map((word) => [String(word.id), word]));
    baseStudyWords = studyWords.map((word) => baseWordsById.get(String(word.id))).filter(Boolean);
    vocabularyHydrated = true;
    invalidateWordPoolCaches();
  }).catch(() => {
    // Raw CET data remains usable if optional enhancements cannot load.
  }).finally(() => {
    vocabularyHydrationPromise = null;
  });
  return vocabularyHydrationPromise;
}

function scheduleVocabularyHydration() {
  const hydrate = () => {
    vocabularyHydrationTimer = 0;
    ensureVocabularyHydrated().then(() => {
      if (state.screen === 'study') preloadUpcomingPronunciations();
      if (state.screen === 'study' || wordDetailId !== null) renderApp();
    });
  };
  vocabularyHydrationTimer = window.setTimeout(() => {
    if (window.requestIdleCallback) window.requestIdleCallback(hydrate, { timeout: 2500 });
    else hydrate();
  }, 1200);
}

function currentWord() {
  const pool = studyPool();
  return wordForDisplay(cachedStudyWordsById.get(String(state.queue[state.queueIndex])) || pool[0]);
}

function daysUntil(date) {
  return taskDaysUntilExam(date, new Date()) ?? 0;
}

function taskStageForIndex(index = state.queueIndex) {
  return state.queueStages?.[index] || (index < (state.dueCount || 0) ? 'review' : 'new');
}

function hasPendingSessionItems() {
  const completed = new Set(state.completed || []);
  return state.queue.slice(Math.max(0, state.queueIndex)).some((id) => !completed.has(id));
}

function activeBatch(task = state.dailyTask) {
  return getBatch(task);
}

function batchHasCompletedNewWords(task = state.dailyTask) {
  const batch = activeBatch(task);
  return Boolean(batch && batch.newWordIds.length && batch.completedNewIds.length >= batch.newWordIds.length);
}

function hasUnseenWords() {
  return getNewWordCandidates(studyPool(), state.wordStates, state.settings).length > 0;
}

function pendingDailyQueue(task) {
  const pending = [];
  const stages = [];
  const append = (ids, completed, stage) => {
    const done = new Set(completed || []);
    for (const id of ids || []) {
      if (done.has(id)) continue;
      pending.push(id);
      stages.push(stage);
    }
  };
  append(task.reviewWordIds, task.completedReviewIds, 'review');
  const batch = activeBatch(task);
  append(batch?.newWordIds || task.newWordIds, batch?.completedNewIds || task.completedNewIds, 'new');
  return { pending, stages };
}

function pendingTaskQueue(task) {
  const pending = [];
  const stages = [];
  const append = (ids, completed, stage) => {
    for (const id of ids || []) {
      if ((completed || []).includes(id)) continue;
      pending.push(id);
      stages.push(stage);
    }
  };
  append(task.reviewWordIds, task.completedReviewIds, 'review');
  append(task.newWordIds, task.completedNewIds, 'new');
  append(task.weakWordIds, task.completedWeakIds, 'weak');
  return { pending, stages };
}

function needsInitialAssessment() {
  return !state.vocabularyProfile && !state.assessment?.skipped && !state.assessment?.completed;
}

function defaultVocabularyProfile(now = Date.now()) {
  const target = Number(state.settings.targetScore) || 550;
  const center = target >= 600 ? 0.64 : target >= 550 ? 0.52 : target >= 500 ? 0.44 : 0.36;
  return {
    assessmentVersion: null,
    completedAt: null,
    estimatedCoverage: { min: center - 0.18, max: center + 0.18 },
    estimatedLevel: Math.max(1, Math.min(5, Math.round(1 + center * 4))),
    confidence: 0.25,
    bandScores: { core: center + 0.08, highFrequency: center, advanced: Math.max(0.1, center - 0.12), rareMeaning: Math.max(0.05, center - 0.2) },
    testedWords: [],
    weakCategories: [],
    source: 'default',
    lastUpdatedAt: now,
  };
}

function recentPerformance() {
  return Object.entries(state.history || {}).sort(([left], [right]) => left.localeCompare(right)).slice(-7).map(([, day]) => {
    const results = Object.values(day?.results || {});
    const planned = Number(day?.plannedBatchSize) || Number(state.stats.plannedBatchSize) || Number(state.settings.dailyNew) || 20;
    return {
      correct: results.filter((result) => result === 'good').length,
      fuzzy: results.filter((result) => result === 'hard').length,
      unknown: results.filter((result) => result === 'again').length,
      completionRate: Math.min(1, (day?.learnedIds?.length || 0) / Math.max(1, planned)),
    };
  });
}

function ensureAdaptivePlan(now = Date.now()) {
  const today = dateKey(now);
  if (state.adaptivePlan?.date === today) return state.adaptivePlan;
  const dueReviews = Object.values(state.wordStates || {}).filter((entry) => entry.status !== 'hidden' && entry.nextReviewAt != null && Number(entry.nextReviewAt) <= now).length;
  const remainingWords = studyPool().filter((word) => (state.wordStates?.[String(word.id)]?.status || 'unseen') === 'unseen').length;
  const recommendation = recommendDailyQuota({
    previousNewWords: state.adaptivePlan?.recommendedNewWords || state.settings.dailyNew || 20,
    dueReviews,
    remainingWords,
    recentDays: recentPerformance(),
    intensity: state.settings.learningIntensity || 'standard',
  });
  state.adaptivePlan = {
    date: today,
    recommendedNewWords: recommendation.newWords,
    recommendedReviews: recommendation.reviews,
    learningIntensity: recommendation.learningIntensity,
    reasonCodes: recommendation.reasonCodes,
    generatedAt: now,
  };
  state.settings.dailyNew = recommendation.newWords;
  return state.adaptivePlan;
}

function ensureDailyTask() {
  const now = Date.now();
  const today = dateKey(now);
  if (state.dailyTask?.date !== today) {
    ensureAdaptivePlan(now);
    const wasStudying = state.screen === 'study' && state.queue.length > 0 && state.queueIndex < state.queue.length;
    const previousQueue = wasStudying ? [...state.queue] : [];
    const previousIndex = wasStudying ? state.queueIndex : 0;
    const previousCompleted = wasStudying ? [...(state.completed || [])] : [];
    const previousStages = wasStudying && state.queueStages?.length
      ? [...state.queueStages]
      : previousQueue.map((_, index) => index < (state.dueCount || 0) ? 'review' : 'new');
    const previousHistory = state.history || {};
    state.dailyTask = createDailyTask({ words: studyPool(), wordStates: state.wordStates, settings: state.settings, profile: state.vocabularyProfile, seed: `${state.localUserId}:${today}`, now, previousTask: null });
    state.stats.todayLearned = 0;
    state.stats.todayReviewed = 0;
    state.stats.uniqueNewWordsToday = 0;
    state.stats.reviewCardsShown = 0;
    state.stats.weakWordsToday = 0;
    state.stats.extraNewWordsToday = 0;
    state.stats.plannedBatchSize = state.dailyTask.batchSize;
    state.weakToday = [];
    state.completed = wasStudying ? previousCompleted : [];
    state.queueIndex = previousIndex;
    const { pending, stages } = pendingTaskQueue(state.dailyTask);
    state.queue = wasStudying ? previousQueue : pending;
    state.queueStages = wasStudying ? previousStages : stages;
    state.dueCount = state.dailyTask.reviewWordIds.length;
    state.stats.streakDays = calculateStreak(previousHistory, today);
    state.completionType = null;
    state.reviewScope = null;
    saveState(state);
  } else if (!Array.isArray(state.dailyTask?.batches) || !Array.isArray(state.dailyTask?.reviewPoolIds)) {
    state.dailyTask = normalizeTask(state.dailyTask);
    state.stats.plannedBatchSize = state.stats.plannedBatchSize || state.dailyTask.batchSize || state.settings.dailyNew;
    saveState(state);
  } else if (!state.queueStages?.length && state.queue.length) {
    state.queueStages = state.queue.map((_, index) => index < state.dueCount ? 'review' : 'new');
  }
  state.stats.plannedBatchSize = state.stats.plannedBatchSize || state.dailyTask?.batchSize || state.settings.dailyNew;
  state.dueCount = Math.max(0, (state.dailyTask?.reviewWordIds?.length || 0) - (state.dailyTask?.completedReviewIds?.length || 0));
  return state.dailyTask;
}

function todayHistory() {
  const key = dateKey();
  if (!state.history[key]) state.history[key] = { studied: false, learnedIds: [], reviewedIds: [], weakIds: [], results: {}, plannedBatchSize: state.dailyTask?.batchSize || state.settings.dailyNew };
  return state.history[key];
}

function recordResult(wordId, result, stage, previousState, nextState) {
  const record = todayHistory();
  record.studied = true;
  const bucket = stage === 'new' ? record.learnedIds : record.reviewedIds;
  if (!bucket.includes(wordId)) bucket.push(wordId);
  if (result !== 'good' && !record.weakIds.includes(wordId)) record.weakIds.push(wordId);
  record.results[String(wordId)] = result;
  if (stage === 'new' && state.dailyTask) {
    const task = normalizeTask(state.dailyTask);
    const batch = getBatch(task);
    if (batch) {
      state.dailyTask = {
        ...task,
        batches: task.batches.map((item) => String(item.id) === String(batch.id)
          ? { ...item, resultById: { ...(item.resultById || {}), [String(wordId)]: result } }
          : item),
      };
    }
  }
  const wasUnseen = previousState.status === 'unseen';
  if (wasUnseen && stage === 'new') state.stats.totalLearned += 1;
  if (stage !== 'new') state.stats.totalReviewed += 1;
  state.stats.todayLearned = record.learnedIds.length;
  state.stats.todayReviewed = record.reviewedIds.length;
  state.stats.uniqueNewWordsToday = record.learnedIds.length;
  state.stats.reviewCardsShown = record.reviewedIds.length;
  state.stats.weakWordsToday = record.weakIds.length;
  state.stats.plannedBatchSize = state.stats.plannedBatchSize || state.dailyTask?.batchSize || state.settings.dailyNew;
  state.stats.extraNewWordsToday = Math.max(0, state.stats.uniqueNewWordsToday - state.stats.plannedBatchSize);
  state.stats.weakWords = Object.values(state.wordStates || {}).filter((item) => item.status !== 'hidden' && (Number(item.mistakeCount) > 0 || Number(item.wrongCount) > 0 || item.familiarity === 'vague')).length;
  if (previousState.status !== 'mastered' && nextState.status === 'mastered') state.stats.totalMastered += 1;
  const learnedWord = cachedStudyWordsById?.get(String(wordId));
  if (learnedWord && state.vocabularyProfile) state.vocabularyProfile = updateVocabularyProfileFromLearning(state.vocabularyProfile, learnedWord, nextState);
  state.stats.lastStudyDate = dateKey();
  state.stats.streakDays = calculateStreak(state.history, dateKey());
}

function preloadUpcomingPronunciations() {
  const accent = state.settings.pronunciationPreference === 'us' ? 'us' : 'uk';
  studyPool();
  const upcoming = state.queue.slice(state.queueIndex, state.queueIndex + 5).map((id) => cachedStudyWordsById.get(String(id))).filter(Boolean);
  pronunciationService.preload(upcoming, accent);
}

function button(content, action, className = '', extra = '') {
  return `<button class="${className}" data-action="${action}" ${extra}>${content}</button>`;
}

function renderTopbar({ study = false } = {}) {
  if (study) {
    const { current, total } = getStudyProgress(state);
    const queueIndex = Math.max(0, Number(state.queueIndex) || 0);
    const percent = Math.round((Math.min(queueIndex, total) / Math.max(total, 1)) * 100);
    return `<header class="study-topbar">
      ${button(icons.close, 'home', 'icon-button icon-button--quiet', 'aria-label="退出学习"')}
      <div class="study-progress-copy"><span>${state.sessionMode === 'review' ? (state.reviewScope === 'batch' ? '本组复习' : '今日复习') : '今日学习'}</span><strong>${String(current).padStart(2, '0')} / ${String(total).padStart(2, '0')}</strong></div>
      ${button(state.favorites.includes(currentWord().id) ? icons.heartFill : icons.heart, 'favorite', `icon-button icon-button--quiet ${state.favorites.includes(currentWord().id) ? 'is-favorite' : ''}`, `aria-label="${state.favorites.includes(currentWord().id) ? '取消收藏' : '收藏'}"`)}
      <div class="study-progress-track" aria-label="学习进度"><span style="--progress:${percent / 100}"></span></div>
    </header>`;
  }
  return `<header class="topbar">
    <a class="brand" href="#" data-action="home" aria-label="拾词首页"><span class="brand-mark">拾</span><span>拾词</span></a>
    ${button(icons.settings, 'settings', 'icon-button', 'aria-label="设置"')}
  </header>`;
}

function adaptiveReason(plan = state.adaptivePlan) {
  const code = plan?.reasonCodes?.[0];
  return ({
    HIGH_REVIEW_LOAD: '最近复习任务较多，今天减少了新词。',
    ELEVATED_REVIEW_LOAD: '今天先兼顾复习，再安排适量新词。',
    LOW_RECENT_ACCURACY: '近期模糊词较多，今天放慢一点。',
    HIGH_RECENT_ACCURACY: '近期完成得很稳，今天增加了少量新词。',
    STEADY_PACE: '根据你的学习情况自动安排。',
  })[code] || '根据你的学习情况自动安排。';
}

function renderAssessmentIntro() {
  return `<div class="screen assessment-intro-screen">
    ${renderTopbar()}
    <main class="assessment-shell assessment-intro-content">
      <p class="eyebrow">个性化学习 · 首次设置</p>
      <h1>先了解一下你的当前词汇水平</h1>
      <p class="assessment-lead">约 3 分钟。这不是考试，只用于帮你安排更合适的学习内容。</p>
      <form class="assessment-setup" data-assessment-setup>
        <div class="assessment-exam-choice"><span>目标考试</span><div><button type="button" class="is-active" aria-pressed="true">CET-4</button><button type="button" disabled title="CET-6 词库尚未接入">CET-6 · 后续</button></div></div>
        <label><span>目标分数</span><input name="targetScore" type="number" min="425" max="710" inputmode="numeric" value="${state.settings.targetScore}" /></label>
        <label><span>考试日期</span><input name="examDate" type="date" value="${escapeHtml(state.settings.examDate)}" /></label>
      </form>
      <div class="assessment-intro-actions">
        ${button(assessmentPreparing ? '正在准备题目…' : `开始词汇测试${icons.arrow}`, 'start-assessment', 'primary-button', `data-assessment-start${assessmentPreparing ? ' disabled' : ''}`)}
        ${button('稍后测试', 'skip-assessment', 'text-button', 'data-assessment-skip')}
      </div>
    </main>
    <div class="toast" role="status" aria-live="polite"></div>
  </div>`;
}

function renderAssessment() {
  const question = assessmentFeedback?.question || getAssessmentQuestion(state.assessment, assessmentPoolCache || []);
  if (!question) return renderAssessmentIntro();
  const feedback = assessmentFeedback;
  const progress = Math.min((state.assessment?.answers?.length || 0) + (feedback ? 0 : 1), state.assessment?.targetCount || 26);
  const labels = ['A', 'B', 'C', 'D', ''];
  const choices = question.options.map((option, index) => {
    const isCorrect = Boolean(feedback && index === question.correctIndex);
    const isSelectedWrong = Boolean(feedback && index === feedback.selectedIndex && !feedback.correct);
    const className = `assessment-choice${isCorrect ? ' is-correct' : ''}${isSelectedWrong ? ' is-incorrect' : ''}`;
    return `<button type="button" class="${className}" data-action="assessment-choice" data-assessment-choice data-choice-index="${index}" ${feedback || assessmentPreparing ? 'disabled' : ''}><span>${labels[index]}</span><strong>${escapeHtml(option.text)}</strong>${isCorrect ? icons.check : ''}</button>`;
  }).join('');
  const feedbackCopy = feedback ? `<div class="assessment-feedback ${feedback.correct ? 'is-correct' : ''}" role="status"><strong>${feedback.correct ? '判断正确' : '记住这个核心义'}</strong><span>${escapeHtml(question.meaning)}</span></div>` : '';
  return `<div class="screen assessment-screen">
    <header class="assessment-topbar"><button class="icon-button icon-button--quiet" type="button" data-action="assessment-exit" aria-label="退出测试">${icons.close}</button><div><span>词汇水平测试</span><strong>${progress} / 约 ${state.assessment?.targetCount || 26}</strong></div><span></span></header>
    <main class="assessment-shell assessment-question-content">
      <p class="eyebrow">${question.type === 'rareMeaning' ? '熟词僻义' : '选择最接近的意思'}</p>
      <h1>${escapeHtml(question.word)}</h1>
      <p class="assessment-phonetic">${escapeHtml(question.phonetic || '音标待补充')}</p>
      <div class="assessment-choices">${choices}</div>
      ${feedbackCopy}
      ${feedback ? button(state.assessment.completed ? `查看结果${icons.arrow}` : `下一题${icons.arrow}`, 'assessment-next', 'primary-button assessment-next', 'data-assessment-next') : ''}
    </main>
  </div>`;
}

function profileLevelLabel(level) {
  return Number(level) >= 4 ? '较高' : Number(level) >= 3 ? '中等' : '正在打基础';
}

function bandState(score) {
  return Number(score) >= 0.7 ? '稳定' : Number(score) >= 0.5 ? '一般' : '需要加强';
}

function renderAssessmentResult() {
  const profile = state.vocabularyProfile || defaultVocabularyProfile();
  const min = Math.round(profile.estimatedCoverage.min * 100);
  const max = Math.round(profile.estimatedCoverage.max * 100);
  return `<div class="screen assessment-result-screen">
    <main class="assessment-shell assessment-result-content">
      <div class="completion-ring"><span>${icons.check}</span></div>
      <p class="eyebrow">个性化学习起点已建立</p>
      <h1>当前水平：${profileLevelLabel(profile.estimatedLevel)}</h1>
      <p class="assessment-range">CET-4 词库掌握度约 <strong>${min}%～${max}%</strong></p>
      <div class="assessment-band-results"><div><span>基础核心词</span><strong>${bandState(profile.bandScores.core)}</strong></div><div><span>高频提分词</span><strong>${bandState(profile.bandScores.highFrequency)}</strong></div><div><span>熟词僻义</span><strong>${bandState(profile.bandScores.rareMeaning)}</strong></div></div>
      <section class="assessment-plan-preview"><span>系统建议</span><p>系统会结合考试日期、目标分数和后续真实学习表现，每天调整新词与复习安排。</p></section>
      ${button(`开始学习${icons.arrow}`, 'assessment-finish', 'primary-button assessment-finish', 'data-assessment-finish')}
    </main>
  </div>`;
}

function renderHome() {
  const task = state.dailyTask || ensureDailyTask();
  const batch = activeBatch(task);
  const remaining = Math.max((batch?.newWordIds?.length || task?.newWordIds?.length || 0) - (batch?.completedNewIds?.length || task?.completedNewIds?.length || 0), 0);
  const reviewRemaining = getPendingReviewIds(task).length;
  const batchReviewRemaining = getPendingBatchReviewIds(task, batch?.id).length;
  const batchComplete = batch?.status === 'complete' || batchHasCompletedNewWords(task);
  const canContinueBatch = batchComplete && hasUnseenWords();
  const dailyInProgress = state.sessionMode === 'daily' && !task?.completed && hasPendingSessionItems();
  const reviewInProgress = state.sessionMode === 'review' && hasPendingSessionItems();
  const studyAction = batchComplete ? 'continue-batch' : 'start';
  const studyLabel = batchComplete ? (canContinueBatch ? '继续背词' : '本组已完成') : task?.completed ? '再看一遍' : dailyInProgress ? '继续背词' : '开始背词';
  const reviewDisabled = !reviewRemaining && !reviewInProgress && batchComplete;
  const reviewLabel = reviewInProgress ? '继续复习' : reviewDisabled ? '今日已复习' : '开始复习';
  const reviewButtonLabel = reviewRemaining ? `${reviewLabel} · ${reviewRemaining}` : reviewLabel;
  const reviewNote = reviewRemaining ? `${reviewRemaining} 个词待复习${batchReviewRemaining ? `，本组有 ${batchReviewRemaining} 个重点` : ''}。` : task?.reviewWordIds?.length || task?.reviewPoolIds?.length ? '今日需要强化的词已经复习，可开始新词。' : '今天没有到期复习，直接开始新词。';
  const isDone = Boolean(task?.completed && !batchComplete);
  return `<div class="screen home-screen">
    ${renderTopbar()}
    <div class="home-content">
      <section class="intro-block">
        <p class="eyebrow">${state.settings.exam} · 今日学习</p>
        <h1>今天，进一步。</h1>
        <p class="intro-copy">把每一个词，变成你的底气。</p>
      </section>
      <section class="exam-row" aria-label="考试信息">
        <div><span class="exam-kicker">目标考试</span><strong>${state.settings.exam}</strong></div>
        <div><span class="exam-kicker">目标分数</span><strong>${state.settings.targetScore}</strong></div>
        <div><span class="exam-kicker">距离考试</span><strong>${daysUntil(state.settings.examDate)}<small> 天</small></strong></div>
      </section>
      <section class="today-panel">
        <div class="panel-heading"><div><span class="panel-label">今日安排</span><h2>${batchComplete ? '这一组已经完成' : isDone ? '今天已经完成' : '按自己的节奏来'}</h2></div><span class="panel-meta">${batch?.newWordIds?.length || state.settings.dailyNew} 个新词 / 组</span></div>
        <div class="study-counts"><div><strong>${reviewRemaining}</strong><span>待复习</span></div><div><strong>${remaining}</strong><span>${batchComplete ? '本组已完成' : isDone ? '已完成' : '本组新词'}</span></div></div>
        <div class="today-actions">
          ${button(`<span>${studyLabel}${batchComplete && canContinueBatch ? ` · ${state.settings.dailyNew}` : ''}</span>${batchComplete && !canContinueBatch ? icons.check : icons.arrow}`, studyAction, 'primary-button today-action', `aria-label="${studyLabel}"${batchComplete && !canContinueBatch ? ' disabled' : ''}`)}
          ${button(`<span>${reviewButtonLabel}</span>${reviewDisabled ? icons.check : icons.arrow}`, 'start-review', 'secondary-button today-action', `aria-label="${reviewDisabled ? '今日已完成复习' : reviewButtonLabel}"${reviewDisabled ? ' disabled' : ''}`)}
        </div>
        <p class="panel-note">${reviewNote}</p>
        <p class="adaptive-plan-note">${adaptiveReason()} 今日建议：复习 ${state.adaptivePlan?.recommendedReviews || 0}，新词 ${state.adaptivePlan?.recommendedNewWords || state.settings.dailyNew}。</p>
      </section>
      <section class="assessment-home-cta"><div><span class="panel-label">词汇水平</span><strong>${state.vocabularyProfile?.source === 'history' ? '完成首次测试' : '让安排更贴合你'}</strong><p>约 3 分钟，测试后会自动调整每日新词与复习节奏。</p></div>${button(state.vocabularyProfile?.source === 'history' ? '开始测试' : '重新测试', 'retest-assessment', 'secondary-button assessment-home-button', 'data-assessment-entry')}</section>
      <section class="mini-stats" aria-label="学习概览"><div><strong>${state.stats.totalMastered}</strong><span>已掌握</span></div><span class="stat-divider"></span><div><strong>${state.stats.streakDays}</strong><span>连续学习天数</span></div></section>
    </div>
    ${renderNav('home')}
    ${settingsOpen ? renderSettings() : ''}
    <div class="toast" role="status" aria-live="polite"></div>
  </div>`;
}

function renderNav(active) {
  return `<nav class="bottom-nav" aria-label="主导航">
    <span class="nav-indicator" aria-hidden="true"></span>
    ${button(`${icons.home}<span>首页</span>`, 'home', active === 'home' ? 'nav-item is-active' : 'nav-item', active === 'home' ? 'aria-current="page"' : '')}
    ${button(`${icons.book}<span>词库</span>`, 'library', active === 'library' ? 'nav-item is-active' : 'nav-item', active === 'library' ? 'aria-current="page"' : '')}
    ${button(`${icons.person}<span>我的</span>`, 'profile', active === 'profile' ? 'nav-item is-active' : 'nav-item', active === 'profile' ? 'aria-current="page"' : '')}
  </nav>`;
}

function renderProfileLinks() {
  const links = [
    ['学习设置', 'settings'],
    ['测试词汇水平', 'retest-assessment'],
    ['我的收藏', 'profile-favorites'],
    ['自定义词表', 'profile-custom'],
    ['已隐藏词汇', 'profile-hidden'],
    ['数据与隐私', 'profile-privacy'],
    ['关于', 'profile-about'],
  ];
  const rows = links.map(([label, action]) => button(`<span>${label}</span><span class="profile-link-arrow" aria-hidden="true">›</span>`, action, 'profile-link')).join('');
  return `<nav class="profile-links" aria-label="个人服务">${rows}</nav>`;
}

function renderProfile() {
  const isAuthenticated = account.status === 'authenticated' && account.user?.email;
  const metrics = `<div class="profile-metrics" aria-label="学习概览"><div><strong>${escapeHtml(state.settings.exam)}</strong><span>考试类型</span></div><div><strong>${escapeHtml(state.settings.targetScore)}</strong><span>目标分数</span></div><div><strong>${state.stats.totalMastered}</strong><span>已掌握</span></div><div><strong>${state.stats.streakDays} 天</strong><span>连续学习</span></div><div><strong>${state.favorites.length}</strong><span>收藏</span></div></div>`;
  const syncCopy = ({ synced: '✓ 已同步', syncing: '正在同步…', pending: '等待同步', error: '同步失败 · 稍后自动重试' })[syncStatus] || '仅此设备';
  const profileCard = isAuthenticated
    ? `<section class="profile-card profile-card--user">
        <div class="profile-user-row"><div class="profile-avatar" aria-hidden="true">拾</div><div><p class="profile-kicker">当前账号</p><h2>${escapeHtml(maskEmail(account.user.email))}</h2></div><span class="profile-status">${syncCopy}</span></div>
        ${metrics}
      </section>`
    : `<section class="profile-card profile-card--guest">
        <div class="profile-avatar" aria-hidden="true">我</div><div><p class="profile-kicker">游客模式</p><h2>学习进度已保存在当前设备</h2><p>登录后可在其他设备恢复你的学习进度。</p></div>
        <button class="primary-button profile-login-button" type="button" data-action="open-login">登录并同步${icons.arrow}</button>
        ${metrics}
      </section>`;
  return `<div class="screen profile-screen">
    ${renderTopbar()}
    <main class="profile-content"><section class="profile-heading"><p class="eyebrow">个人中心</p><h1>我的</h1></section>${profileCard}${renderProfileLinks()}${isAuthenticated ? button('退出登录', 'logout', 'profile-logout') : ''}</main>
    ${renderNav('profile')}
    ${settingsOpen ? renderSettings() : ''}
    ${loginOpen ? renderLoginSheet() : ''}
    <div class="toast" role="status" aria-live="polite"></div>
  </div>`;
}

function renderLoginSheet() {
  const isEmailStep = loginStep === 'email';
  const masked = loginEmail ? maskEmail(loginEmail) : '';
  const seconds = Math.max(0, Math.ceil((loginResendUntil - Date.now()) / 1000));
  return `<div class="sheet-backdrop" data-action="close-login"><section class="bottom-sheet login-sheet" role="dialog" aria-modal="true" aria-labelledby="login-title" data-sheet-content>
    <div class="sheet-handle" data-sheet-drag-handle></div><div class="sheet-heading"><h2 id="login-title">登录并同步</h2>${button(icons.close, 'close-login', 'icon-button icon-button--quiet', 'aria-label="关闭登录"')}</div>
    <div class="login-progress" aria-label="登录步骤"><span class="${isEmailStep ? 'is-active' : ''}">邮箱</span><span class="${isEmailStep ? '' : 'is-active'}">验证码</span></div>
    ${isEmailStep ? `<form data-login-email-form novalidate><label class="login-field"><span>邮箱地址</span><div class="login-email-input"><input type="email" name="email" inputmode="email" autocomplete="email" placeholder="name@example.com" value="${escapeHtml(loginEmail)}" aria-label="邮箱地址" /></div></label><button class="primary-button login-submit" type="submit" ${loginSubmitting ? 'disabled' : ''}>${loginSubmitting ? '发送中…' : `获取验证码${icons.arrow}`}</button></form>` : `<form data-login-code-form novalidate><p class="login-receive">验证码已发送至 <strong>${escapeHtml(masked)}</strong></p><label class="login-field"><span>邮箱验证码</span><input class="login-code-input" type="text" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="请输入 6 位验证码" aria-label="邮箱验证码" /></label><button class="primary-button login-submit" type="submit" ${loginSubmitting ? 'disabled' : ''}>${loginSubmitting ? '验证中…' : `登录并同步${icons.arrow}`}</button><button class="text-button login-back" type="button" data-action="back-login">更换邮箱</button><div class="login-resend-slot" data-login-resend-slot>${renderLoginResend(seconds)}</div></form>`}
    ${loginError ? `<p class="login-error" role="alert">${escapeHtml(loginError)}</p>` : ''}${loginHint ? `<p class="login-hint" role="status">${escapeHtml(loginHint)}</p>` : ''}
    <p class="sheet-note">首次验证会自动创建账号。学习始终先保存在当前设备。</p>
  </section></div>`;
}

function focusLoginField() {
  const selector = loginStep === 'email' ? '[data-login-email-form] input' : '[data-login-code-form] input';
  app.querySelector(selector)?.focus();
}

function focusSettingsField() {
  app.querySelector('[data-settings-form] input')?.focus();
}

function restoreSettingsTrigger() {
  app.querySelector('[data-action="settings"]')?.focus();
}

function focusImportField() {
  app.querySelector('[data-import-file]')?.focus();
}

function restoreImportTrigger() {
  app.querySelector('[data-action="open-import"]')?.focus();
}

function restoreLoginTrigger() {
  app.querySelector('[data-action="open-login"]')?.focus();
}

function focusWordDetail() {
  app.querySelector('.word-detail-sheet [data-action="close-word-detail"]')?.focus();
}

function restoreWordDetailTrigger(id) {
  [...app.querySelectorAll('[data-library-item]')].find((item) => item.dataset.wordId === String(id))?.focus();
}

function detailWord() {
  libraryPool();
  return wordForDisplay(cachedLibraryWordsById.get(String(wordDetailId)) || null);
}

function renderWordTags(word) {
  const tags = getCETTags(word);
  return tags.length ? `<div class="word-tags">${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')}</div>` : '';
}

function renderContext(context, className = '') {
  if (!context) return '';
  const provenance = formatExamProvenance(context);
  const label = context.kind === 'exam' ? '真题语境' : context.sourceType === 'dictionary_example' ? '开放词典例句 · 非真题' : '示例语境 · 非真题';
  const source = context.kind !== 'exam' && context.source ? context.source : '';
  const meaningInContext = context.wordMeaningInContext || context.targetMeaning;
  return `<div class="context-block ${className}"><div class="context-heading"><span class="answer-label">${label}</span>${provenance || source ? `<small>${escapeHtml(provenance || source)}</small>` : ''}</div><p>${escapeHtml(context.sentence)}</p>${meaningInContext ? `<span class="context-meaning">本句考义：<strong>${escapeHtml(meaningInContext)}</strong></span>` : ''}${context.translation ? `<span class="translation">${escapeHtml(context.translation)}</span>` : ''}</div>`;
}

function renderCollocations(items, className = '') {
  if (!items?.length) return '';
  return `<div class="collocation-block ${className}"><span class="answer-label">常见搭配</span><ul>${items.map((item) => `<li><strong>${escapeHtml(item.phrase)}</strong>${item.meaning ? `<span>${escapeHtml(item.meaning)}</span>` : ''}</li>`).join('')}</ul></div>`;
}

function renderMeaningList(items, label = '更多词义', className = 'answer-more-section') {
  if (!items?.length) return '';
  return `<section class="${className}"><span class="answer-label">${label}</span><ul class="meaning-list">${items.map((item) => `<li>${item.pos ? `<small>${escapeHtml(item.pos)}</small>` : ''}<span>${escapeHtml(item.meaning)}</span>${item.language === 'en' ? '<em>英文释义</em>' : ''}${item.explanation ? `<p>${escapeHtml(item.explanation)}</p>` : ''}</li>`).join('')}</ul></section>`;
}

function renderTermList(items, label) {
  if (!items?.length) return '';
  return `<section class="answer-more-section"><span class="answer-label">${label}</span><ul class="term-list">${items.map((item) => typeof item === 'string' ? `<li>${escapeHtml(item)}</li>` : `<li><strong>${escapeHtml(item.word)}</strong>${item.meaning ? `<span>${escapeHtml(item.meaning)}</span>` : ''}${item.note ? `<p>${escapeHtml(item.note)}</p>` : ''}</li>`).join('')}</ul></section>`;
}

function renderMoreContent(more) {
  const contexts = more.contexts?.map((context) => renderContext(context, 'context-block--compact')).join('') || '';
  return [
    renderMeaningList(more.meanings),
    contexts ? `<section class="answer-more-section"><span class="answer-label">更多语境</span>${contexts}</section>` : '',
    renderCollocations(more.collocations, 'collocation-block--more'),
    renderMeaningList(more.rareMeanings, '熟词僻义'),
    more.commonMistakes?.length ? `<section class="answer-more-section"><span class="answer-label">易错点</span>${more.commonMistakes.map((item) => `<p>${escapeHtml(item)}</p>`).join('')}</section>` : '',
    more.memoryTip ? `<section class="answer-more-section"><span class="answer-label">这样记</span><p>${escapeHtml(more.memoryTip)}</p></section>` : '',
    renderTermList(more.roots, '词根'),
    renderTermList(more.affixes, '词缀'),
    renderTermList(more.wordFamily, '词族'),
    renderTermList(more.synonyms, '近义词'),
    renderTermList(more.confusableWords, '易混词'),
  ].filter(Boolean).join('');
}

function libraryWordsForMode() {
  const pool = libraryMode === 'study' ? studyPool() : libraryPool();
  return filterWords(pool, libraryMode, state.wordStates);
}

function renderLibraryItem(word) {
  const wordState = stateForWord(state, word.id);
  const status = wordState.status === 'mastered' ? '已掌握' : wordState.status === 'weak' ? '薄弱' : wordState.status === 'hidden' ? '已隐藏' : wordState.status === 'unseen' ? '未学' : '学习中';
  const phonetic = getPhonetic(word, state.settings.pronunciationPreference);
  const primaryMeaning = getPrimaryMeaning(word)?.meaning || word.meaning;
  const pos = getPartOfSpeechLabels(word).join(' / ');
  const tags = getCETTags(word);
  const favoriteLabel = wordState.favorite ? `取消收藏 ${word.word}` : `收藏 ${word.word}`;
  const hiddenLabel = wordState.status === 'hidden' ? `恢复 ${word.word}` : `隐藏 ${word.word}`;
  const searchText = [word.word, word.meaning, primaryMeaning, ...(word.meanings || []).map((meaning) => meaning.meaning), pos, phonetic, ...tags, 'cet-4 cet4 四级 四六级'].join(' ').toLowerCase();
  return `<li class="library-item" data-library-item data-action="open-word-detail" data-word-id="${escapeHtml(word.id)}" data-search="${escapeHtml(searchText)}" role="button" tabindex="0" aria-label="查看 ${escapeHtml(word.word)} 详情">
    <span class="library-rank">#${word.frequencyRank}</span>
    <div class="library-item-copy"><div class="library-item-title"><strong>${escapeHtml(word.word)}</strong>${pos ? `<small>${escapeHtml(pos)}</small>` : ''}</div><span class="library-item-meaning">${escapeHtml(primaryMeaning || '释义待补充')}</span><span class="library-item-meta">${escapeHtml(phonetic || '音标待补充')}${tags[0] ? ` · ${escapeHtml(tags[0])}` : ''}</span></div>
    <div class="library-item-actions"><small>${escapeHtml(status)}</small>${button(wordState.favorite ? icons.heartFill : icons.heart, 'library-favorite-toggle', `library-item-action${wordState.favorite ? ' is-favorite' : ''}`, `data-word-id="${escapeHtml(word.id)}" aria-label="${escapeHtml(favoriteLabel)}"`)}${button(wordState.status === 'hidden' ? '↺' : '×', 'library-hidden-toggle', 'library-item-action', `data-word-id="${escapeHtml(word.id)}" aria-label="${escapeHtml(hiddenLabel)}"`)}</div>
  </li>`;
}

function applyLibrarySearch() {
  const query = app.querySelector('[data-library-search]')?.value.trim().toLowerCase() || '';
  const list = app.querySelector('[data-library-list]');
  if (!list) return;
  const count = app.querySelector('[data-library-count]');
  if (!query) {
    list.querySelectorAll('[data-library-item][hidden]').forEach((item) => { item.hidden = false; });
    if (count) {
      const total = Number(list.dataset.libraryTotal) || list.children.length;
      count.textContent = list.getAttribute('aria-busy') === 'true' ? `正在加载词库 · 当前显示 ${list.children.length} 个词` : `显示 ${total} 个词`;
    }
    return;
  }
  let visible = 0;
  list.querySelectorAll('[data-library-item]').forEach((item) => {
    const matches = item.dataset.search.includes(query);
    item.hidden = !matches;
    if (matches) visible += 1;
  });
  if (!count) return;
  const total = Number(list.dataset.libraryTotal) || visible;
  if (list.getAttribute('aria-busy') === 'true') count.textContent = query ? `正在加载词库 · 当前匹配 ${visible} 个词` : `显示 ${total} 个词`;
  else count.textContent = query ? `找到 ${visible} 个词` : `显示 ${total} 个词`;
}

function scheduleLibraryListRender() {
  const list = app.querySelector('[data-library-list]');
  if (!list) return;
  const wordsForRender = libraryWordsForMode();
  let index = list.children.length;
  if (index >= wordsForRender.length) {
    list.removeAttribute('aria-busy');
    applyLibrarySearch();
    return;
  }
  const token = libraryRenderToken;
  const appendChunk = () => {
    libraryRenderFrame = 0;
    libraryRenderIdle = 0;
    if (token !== libraryRenderToken || state.screen !== 'library' || !list.isConnected) return;
    const chunkSize = window.matchMedia?.('(max-width: 759px)').matches ? 80 : 180;
    const end = Math.min(index + chunkSize, wordsForRender.length);
    list.insertAdjacentHTML('beforeend', wordsForRender.slice(index, end).map(renderLibraryItem).join(''));
    index = end;
    applyLibrarySearch();
    if (index < wordsForRender.length) {
      if (window.requestIdleCallback) libraryRenderIdle = window.requestIdleCallback(appendChunk, { timeout: 120 });
      else libraryRenderFrame = requestAnimationFrame(appendChunk);
    }
    else {
      libraryRenderFrame = 0;
      list.removeAttribute('aria-busy');
      applyLibrarySearch();
    }
  };
  if (window.requestIdleCallback) libraryRenderIdle = window.requestIdleCallback(appendChunk, { timeout: 120 });
  else libraryRenderFrame = requestAnimationFrame(appendChunk);
}

function renderLibrary() {
  const libraryWords = libraryWordsForMode();
  const initialCount = window.matchMedia?.('(max-width: 759px)').matches ? 60 : 180;
  const initialRows = libraryWords.slice(0, initialCount).map(renderLibraryItem).join('');
  return `<div class="screen library-screen">
    ${renderTopbar()}
    <main class="library-content${libraryFilterTransition ? ' is-filter-transition' : ''}">
      <section class="library-heading"><p class="eyebrow">CET-4 · 完整词库</p><h1>词库</h1><p>${words.length} 个来源词；${studyWords.length} 个核心学习词；${importedWords.length} 个自定义词。</p></section>
      <div class="library-filters" aria-label="词库范围">
        ${button(`全部 · ${libraryPool().length}`, 'library-all', libraryMode === 'all' ? 'library-filter is-active' : 'library-filter')}
        ${button(`学习 · ${studyPool().length}`, 'library-study', libraryMode === 'study' ? 'library-filter is-active' : 'library-filter')}
        ${button(`收藏 · ${getFavoriteWords(libraryPool(), state.wordStates).length}`, 'library-favorite', libraryMode === 'favorite' ? 'library-filter is-active' : 'library-filter')}
        ${button(`错词 · ${getMistakeWords(libraryPool(), state.wordStates).length}`, 'library-mistake', libraryMode === 'mistake' ? 'library-filter is-active' : 'library-filter')}
        ${button(`隐藏 · ${getHiddenWords(libraryPool(), state.wordStates).length}`, 'library-hidden', libraryMode === 'hidden' ? 'library-filter is-active' : 'library-filter')}
      </div>
      ${button('导入单词', 'open-import', 'secondary-button import-button')}
      <label class="library-search"><span>搜索 CET-4 单词或释义</span><input type="search" data-library-search autocomplete="off" placeholder="例如：approach / 方法"></label>
      <p class="library-count" data-library-count aria-live="polite">显示 ${libraryWords.length} 个词</p>
      <ol class="library-list" data-library-list data-library-total="${libraryWords.length}" aria-busy="${libraryWords.length > 180 ? 'true' : 'false'}">${initialRows}</ol>
    </main>
    ${renderNav('library')}
    ${settingsOpen ? renderSettings() : ''}
    ${importOpen ? renderImport() : ''}
    ${wordDetailId !== null ? renderWordDetail() : ''}
  </div>`;
}

function setLibraryMode(nextMode) {
  if (libraryMode === nextMode) return;
  libraryMode = nextMode;
  libraryFilterTransition = true;
  renderApp();
  libraryFilterTransition = false;
}
function renderImport() {
  return `<div class="sheet-backdrop" data-action="close-import"><section class="bottom-sheet import-sheet" role="dialog" aria-modal="true" aria-labelledby="import-title" data-sheet-content>
    <div class="sheet-handle" data-sheet-drag-handle></div><div class="sheet-heading"><h2 id="import-title">导入单词</h2>${button(icons.close, 'close-import', 'icon-button icon-button--quiet', 'aria-label="关闭导入"')}</div>
    <p class="sheet-note">支持 CSV、JSON、TXT、Markdown、DOCX、XLSX 和文本型 PDF。文件只在本地读取。</p>
    <label class="import-field"><span>从手机或电脑选择文件</span><input type="file" data-import-file accept=".csv,text/csv,application/json,.json,text/plain,.txt,text/markdown,.md,.markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx,application/pdf,.pdf" /><small>Word（.docx）· 文本 PDF · CSV · JSON · TXT · Markdown · XLSX</small></label>
    <label class="import-field"><span>或粘贴：每行 英文, 中文释义</span><textarea data-import-text rows="6" placeholder="abandon, 放弃\ncarry, 携带"></textarea></label>
    ${importPreview.length ? `<p class="library-count">已识别 ${importPreview.length} 个词，点击确认后导入。</p>` : ''}
    <div class="import-actions">${button('解析并预览', 'parse-import', 'secondary-button import-parse-button')}${importPreview.length ? button('确认导入', 'confirm-import', 'primary-button import-confirm-button') : ''}</div>
    <p class="import-status" data-import-status role="status"></p>
  </section></div>`;
}

function renderWordDetail() {
  const word = detailWord();
  if (!word) return '';
  const uk = getPhonetic(word, 'uk');
  const us = getPhonetic(word, 'us');
  const primary = getPrimaryMeaning(word);
  const pos = getPartOfSpeechLabels(word);
  const context = getAnswerContent(word, { rating: 'known' });
  const wordState = stateForWord(state, word.id);
  const status = wordState.status === 'mastered' ? '已掌握' : wordState.status === 'weak' ? '薄弱' : wordState.status === 'unseen' ? '未学' : '学习中';
  const recommendation = getRecommendationReason({ stage: wordState.nextReviewAt && wordState.nextReviewAt <= Date.now() ? 'review' : 'new', wordState, word, targetScore: state.settings.targetScore });
  const otherContexts = context.more.contexts.map((item) => renderContext(item, 'context-block--compact')).join('');
  return `<div class="sheet-backdrop" data-action="close-word-detail"><section class="bottom-sheet word-detail-sheet" role="dialog" aria-modal="true" aria-labelledby="word-detail-title" data-sheet-content>
    <div class="sheet-handle" data-sheet-drag-handle></div><div class="sheet-heading"><div><h2 id="word-detail-title">${escapeHtml(word.word)}</h2>${pos.length ? `<p class="word-detail-pos">${escapeHtml(pos.join(' / '))}</p>` : ''}</div>${button(icons.close, 'close-word-detail', 'icon-button icon-button--quiet', 'aria-label="关闭单词详情"')}</div>
    ${renderWordTags(word)}
    <div class="word-detail-pronunciations"><div><span>英式 UK</span><strong>${escapeHtml(uk || '音标待补充')}</strong>${button(icons.sound, 'speak-detail', 'sound-button detail-sound-button', `data-word-id="${escapeHtml(word.id)}" data-accent="uk" aria-label="播放英式发音：${escapeHtml(word.word)}"`)}</div><div><span>美式 US</span><strong>${escapeHtml(us || '音标待补充')}</strong>${button(icons.sound, 'speak-detail', 'sound-button detail-sound-button', `data-word-id="${escapeHtml(word.id)}" data-accent="us" aria-label="播放美式发音：${escapeHtml(word.word)}"`)}</div></div>
    ${primary ? `<div class="word-detail-meaning"><span class="answer-label">${primary.priority === 'cet_high' ? '四六级优先词义' : '核心释义'}</span><p>${escapeHtml(primary.meaning)}</p>${word.plainExplanation ? `<span>${escapeHtml(word.plainExplanation)}</span>` : ''}</div>` : ''}
    ${renderMeaningList(context.more.meanings)}
    ${renderContext(context.context)}
    ${otherContexts ? `<section class="answer-more-section"><span class="answer-label">更多语境</span>${otherContexts}</section>` : ''}
    ${renderCollocations(word.collocations)}
    ${renderMeaningList(word.rareMeanings, '熟词僻义')}
    ${word.memoryTip ? `<section class="word-detail-section"><span class="answer-label">这样记</span><p>${escapeHtml(word.memoryTip)}</p></section>` : ''}
    ${word.commonMistakes?.length ? `<section class="word-detail-section"><span class="answer-label">易错点</span>${word.commonMistakes.map((item) => `<p>${escapeHtml(item)}</p>`).join('')}</section>` : ''}
    ${renderTermList(word.roots, '词根')}${renderTermList(word.affixes, '词缀')}${renderTermList(word.wordFamily, '词族')}${renderTermList(word.synonyms, '近义词')}${renderTermList(word.confusableWords, '易混词')}
    <section class="word-detail-learning"><div><span>学习状态</span><strong>${escapeHtml(status)}</strong></div><div><span>为什么推荐</span><strong>${escapeHtml(recommendation)}</strong></div>${button(wordState.favorite ? '已收藏' : '收藏这个词', 'library-favorite-toggle', `secondary-button${wordState.favorite ? ' is-active' : ''}`, `data-word-id="${escapeHtml(word.id)}" aria-pressed="${wordState.favorite}"`)}</section>
  </section></div>`;
}

function renderSettings() {
  const theme = state.settings.themePreference || 'system';
  return `<div class="sheet-backdrop" data-action="close-settings"><section class="bottom-sheet" role="dialog" aria-modal="true" aria-labelledby="settings-title" data-sheet-content>
    <div class="sheet-handle" data-sheet-drag-handle></div><div class="sheet-heading"><h2 id="settings-title">学习设置</h2>${button(icons.close, 'close-settings', 'icon-button icon-button--quiet', 'aria-label="关闭设置"')}</div>
    <form data-settings-form><div class="setting-list"><div><span>考试类型</span><strong>${state.settings.exam}</strong></div><label><span>目标分数</span><input type="number" min="1" max="710" step="1" inputmode="numeric" value="${state.settings.targetScore}" name="targetScore" aria-label="目标分数" /></label><label><span>考试日期</span><input type="date" value="${escapeHtml(state.settings.examDate)}" name="examDate" aria-label="考试日期" /></label><div><span>今日建议新词</span><strong>${state.adaptivePlan?.recommendedNewWords || state.settings.dailyNew} 个</strong></div><label><span>学习强度</span><select name="learningIntensity" aria-label="学习强度"><option value="relaxed" ${state.settings.learningIntensity === 'relaxed' ? 'selected' : ''}>轻松</option><option value="standard" ${state.settings.learningIntensity === 'standard' ? 'selected' : ''}>标准</option><option value="intensive" ${state.settings.learningIntensity === 'intensive' ? 'selected' : ''}>加强</option></select></label><div class="setting-pronunciation"><span>默认发音</span><div class="segmented-control" data-selected="${state.settings.pronunciationPreference}" role="radiogroup" aria-label="默认发音"><span class="segmented-indicator" aria-hidden="true"></span><button type="button" data-action="pronunciation" data-accent="uk" aria-pressed="${state.settings.pronunciationPreference === 'uk'}" class="${state.settings.pronunciationPreference === 'uk' ? 'is-active' : ''}">英式 UK</button><button type="button" data-action="pronunciation" data-accent="us" aria-pressed="${state.settings.pronunciationPreference === 'us'}" class="${state.settings.pronunciationPreference === 'us' ? 'is-active' : ''}">美式 US</button></div></div><div class="setting-pronunciation setting-theme"><span>外观</span><div class="segmented-control segmented-control--three" data-selected="${theme}" role="radiogroup" aria-label="主题"><span class="segmented-indicator" aria-hidden="true"></span><button type="button" data-action="theme-preference" data-theme-preference="system" aria-pressed="${theme === 'system'}" class="${theme === 'system' ? 'is-active' : ''}">自动</button><button type="button" data-action="theme-preference" data-theme-preference="light" aria-pressed="${theme === 'light'}" class="${theme === 'light' ? 'is-active' : ''}">浅色</button><button type="button" data-action="theme-preference" data-theme-preference="dark" aria-pressed="${theme === 'dark'}" class="${theme === 'dark' ? 'is-active' : ''}">深色</button></div></div></div>
    ${button('保存设置', 'save-settings', 'primary-button settings-save-button', 'type="button"')}<p class="sheet-note">系统每天推荐第一组数量；完成后仍可继续下一组。</p></form>
  </section></div>`;
}

function renderStudy() {
  const word = currentWord();
  const accent = state.settings.pronunciationPreference === 'us' ? 'us' : 'uk';
  const phonetic = getPhonetic(word, accent);
  const accentLabel = accent === 'us' ? '美式' : '英式';
  const pos = getPartOfSpeechLabels(word);
  return `<div class="screen study-screen">
    ${renderTopbar({ study: true })}
    <main class="study-main${state.revealed ? ' study-main--revealed' : ''}">
      <div class="word-stage">
        <span class="eyebrow">${taskStageForIndex() === 'review' ? '到期复习' : taskStageForIndex() === 'batch-review' ? '本组复习' : taskStageForIndex() === 'weak' ? '薄弱强化' : '今日新词'}</span>
        <div class="word-line"><h1>${escapeHtml(word.word)}</h1>${button(icons.sound, 'speak', 'sound-button', `aria-label="播放${accentLabel}发音：${escapeHtml(word.word)}"`)}</div>
        <p class="phonetic${phonetic ? '' : ' phonetic--pending'}">${escapeHtml(phonetic || '音标待补充')}</p>
        <div class="word-study-meta">${pos.length ? `<span class="word-pos">${escapeHtml(pos.join(' / '))}</span>` : ''}${renderWordTags(word)}</div>
        ${state.revealed ? renderAnswer(word) : renderRecallPrompt()}
      </div>
    </main>
    ${state.revealed ? `<footer class="study-footer">${button(`${icons.back}<span>撤销上一步</span>`, 'undo', 'text-button')} ${button(`<span>下一个</span>${icons.arrow}`, 'next', 'primary-button next-button')}</footer>` : ''}
    <div class="toast" role="status" aria-live="polite"></div>
  </div>`;
}

function renderRecallPrompt() {
  return `<section class="recall-prompt"><p>先凭记忆判断，再查看答案。</p><div class="rating-grid">
    ${button('<strong>不认识</strong><span>从零开始</span>', 'rate-unknown', 'rating-button rating-button--unknown')}
    ${button('<strong>模糊</strong><span>见过但不稳</span>', 'rate-fuzzy', 'rating-button rating-button--fuzzy')}
    ${button('<strong>认识</strong><span>可以继续</span>', 'rate-known', 'rating-button rating-button--known')}
  </div></section>`;
}

function renderAnswer(word) {
  const wordState = stateForWord(state, word.id);
  const stage = taskStageForIndex();
  const content = getAnswerContent(word, { rating: state.rating, stage: stage === 'batch-review' ? 'review' : stage, wordState, targetScore: state.settings.targetScore });
  const primary = content.primaryMeaning;
  const moreContent = renderMoreContent(content.more);
  return `<section class="answer-stack" aria-live="polite">
    ${primary ? `<div class="answer-meaning reveal-step"><span class="answer-label">${primary.priority === 'cet_high' ? '四六级优先词义' : '核心释义'}</span><strong>${escapeHtml(primary.meaning)}</strong>${content.explanation ? `<span>${escapeHtml(content.explanation)}</span>` : ''}</div>` : ''}
    ${renderContext(content.context, 'reveal-step')}
    ${renderCollocations(content.collocations, 'reveal-step')}
    ${content.commonMistakes.length ? `<div class="study-note reveal-step"><span class="answer-label">易错点</span><p>${escapeHtml(content.commonMistakes[0])}</p></div>` : ''}
    ${content.memoryTip ? `<div class="study-note reveal-step"><span class="answer-label">这样记</span><p>${escapeHtml(content.memoryTip)}</p></div>` : ''}
    ${renderMeaningList(content.rareMeanings, '熟词僻义', 'answer-more-section study-note reveal-step')}
    ${content.recommendation ? `<div class="recommendation-note reveal-step"><span class="answer-label">为什么推荐</span><p>${escapeHtml(content.recommendation)}</p></div>` : ''}
    ${content.hasMore && moreContent ? button(`<span data-more-label>${state.moreOpen ? '收起更多' : '展开更多'}</span><span class="chevron" aria-hidden="true">⌄</span>`, 'more', 'more-button', `aria-expanded="${Boolean(state.moreOpen)}" aria-controls="answer-more"`) : ''}
    ${content.hasMore && moreContent ? `<div id="answer-more" class="answer-more reveal-step" data-answer-more ${state.moreOpen ? '' : 'hidden'}>${moreContent}</div>` : ''}
    <p class="rating-confirmation reveal-step">${state.rating === 'unknown' ? '记下来，下一次会更熟。' : state.rating === 'fuzzy' ? '再见几次，它就会变清楚。' : '很好，继续保持节奏。'}</p>
  </section>`;
}

function renderComplete() {
  const history = state.history[dateKey()] || {};
  const weakCount = history.weakIds?.length || state.weakToday.length;
  const reviewMode = state.sessionMode === 'review';
  const batch = activeBatch();
  const batchFinished = Boolean(batch?.status === 'complete' || batchHasCompletedNewWords(state.dailyTask));
  const batchComplete = !reviewMode && (state.completionType === 'batch' || state.dailyTask?.currentStage === 'batch-complete' || batchFinished);
  const reviewScope = state.reviewScope || 'daily';
  const reviewCount = new Set(state.queue || []).size || state.stats.todayReviewed;
  const pendingNew = hasUnseenWords();
  const pendingBatchReview = batch ? getPendingBatchReviewIds(state.dailyTask, batch.id).length : 0;
  const resultCounts = batchComplete && batch
    ? Object.values(batch.resultById || {}).reduce((counts, result) => {
      if (result === 'good') counts.known += 1;
      if (result === 'hard') counts.fuzzy += 1;
      if (result === 'again') counts.unknown += 1;
      return counts;
    }, { known: 0, fuzzy: 0, unknown: 0 })
    : null;
  const batchBreakdown = resultCounts
    ? `<div class="batch-result-breakdown" aria-label="本组评分统计"><span><strong>${resultCounts.known}</strong><small>认识</small></span><span><strong>${resultCounts.fuzzy}</strong><small>模糊</small></span><span><strong>${resultCounts.unknown}</strong><small>不认识</small></span></div>`
    : '';
  const heading = batchComplete ? '这一组完成了' : reviewMode ? (reviewScope === 'batch' ? '本组复习完成' : '今日复习完成') : '今日完成';
  const copy = batchComplete
    ? pendingBatchReview
      ? `${batch?.newWordIds?.length || state.stats.todayLearned} 个新词已记录，${pendingBatchReview} 个词留在本组复习池。`
      : `${batch?.newWordIds?.length || state.stats.todayLearned} 个新词已记录，本组无需强化。`
    : reviewMode
      ? `复习 ${reviewCount} 个词，记忆又稳了一步。`
      : '每一次积累，都算数。';
  return `<div class="screen complete-screen">
    <main class="complete-main"><div class="completion-ring"><span>${icons.check}</span></div><p class="eyebrow">${state.settings.exam} · ${batchComplete ? '本组新词' : reviewMode ? (reviewScope === 'batch' ? '本组复习' : '今日复习') : '今日学习'}</p><h1>${heading}</h1><p class="complete-copy">${copy}</p>${batchBreakdown}
      <div class="complete-stats"><div><strong>${state.stats.uniqueNewWordsToday || state.stats.todayLearned}</strong><span>今日新学</span></div><span></span><div><strong>${state.stats.reviewCardsShown || state.stats.todayReviewed}</strong><span>复习卡片</span></div><span></span><div><strong>${state.stats.weakWordsToday || weakCount}</strong><span>待强化</span></div><span></span><div><strong>${state.stats.streakDays}</strong><span>连续学习</span></div></div>
      <div class="complete-actions">${button(`<span>返回首页</span>${icons.arrow}`, 'home', 'primary-button complete-button')}${batchComplete && pendingBatchReview ? button(`<span>复习本组 · ${pendingBatchReview}</span>${icons.arrow}`, 'review-batch', 'secondary-button complete-button complete-button--secondary') : ''}${batchFinished && pendingNew ? button(`<span>继续背词 · ${state.settings.dailyNew}</span>${icons.arrow}`, 'continue-batch', 'secondary-button complete-button complete-button--secondary') : ''}${reviewMode && !batchFinished && pendingNew ? button(`<span>继续背新词</span>${icons.arrow}`, 'start', 'secondary-button complete-button complete-button--secondary') : ''}</div>
    </main><p class="sample-note">词义与频次来自已记录来源；例句、音标和真题出处将在内容审核后补充。</p>
  </div>`;
}

function navScreenIndex() {
  return ({ home: 0, library: 1, profile: 2 })[state.screen] ?? -1;
}

function cancelNavIndicatorAnimation() {
  if (navIndicatorFrame) cancelAnimationFrame(navIndicatorFrame);
  navIndicatorFrame = 0;
  navIndicatorVelocity = 0;
}

function setNavIndicatorPosition(indicator, position) {
  navIndicatorPosition = position;
  indicator.style.transform = `translate3d(${position}px, 0, 0)`;
}

function animateNavIndicator(target, immediate = false) {
  const indicator = app.querySelector('.nav-indicator');
  if (!indicator) return;
  navIndicatorTarget = target;
  if (immediate || reducedMotion()) {
    cancelNavIndicatorAnimation();
    setNavIndicatorPosition(indicator, target);
    indicator.style.removeProperty('will-change');
    return;
  }
  indicator.style.willChange = 'transform';
  if (navIndicatorFrame) return;
  let previous = performance.now();
  const stiffness = 420;
  const damping = 34;
  const mass = 0.8;
  const tick = (now) => {
    if (!indicator.isConnected) {
      cancelNavIndicatorAnimation();
      return;
    }
    const delta = Math.min(Math.max((now - previous) / 1000, 0), 0.032);
    previous = now;
    const acceleration = ((navIndicatorTarget - navIndicatorPosition) * stiffness - navIndicatorVelocity * damping) / mass;
    navIndicatorVelocity += acceleration * delta;
    navIndicatorPosition += navIndicatorVelocity * delta;
    indicator.style.transform = `translate3d(${navIndicatorPosition}px, 0, 0)`;
    if (Math.abs(navIndicatorTarget - navIndicatorPosition) < 0.1 && Math.abs(navIndicatorVelocity) < 3) {
      setNavIndicatorPosition(indicator, navIndicatorTarget);
      cancelNavIndicatorAnimation();
      indicator.style.removeProperty('will-change');
      return;
    }
    navIndicatorFrame = requestAnimationFrame(tick);
  };
  navIndicatorFrame = requestAnimationFrame(tick);
}

function syncNavIndicator({ immediate = false } = {}) {
  const nav = app.querySelector('.bottom-nav');
  if (!nav) {
    cancelNavIndicatorAnimation();
    navIndicatorReady = false;
    return;
  }
  const items = [...nav.querySelectorAll('.nav-item')];
  const activeIndex = navScreenIndex();
  const activeItem = items[activeIndex];
  const firstItem = items[0];
  const indicator = nav.querySelector('.nav-indicator');
  if (!indicator || !firstItem || !activeItem) return;
  const navRect = nav.getBoundingClientRect();
  const firstRect = firstItem.getBoundingClientRect();
  const activeRect = activeItem.getBoundingClientRect();
  indicator.style.left = `${firstRect.left - navRect.left - nav.clientLeft}px`;
  indicator.style.top = `${firstRect.top - navRect.top - nav.clientTop}px`;
  indicator.style.width = `${firstRect.width}px`;
  indicator.style.height = `${firstRect.height}px`;
  items.forEach((item, index) => {
    const selected = index === activeIndex;
    item.classList.toggle('is-active', selected);
    if (selected) item.setAttribute('aria-current', 'page');
    else item.removeAttribute('aria-current');
  });
  const target = activeRect.left - firstRect.left;
  const shouldSnap = immediate || !navIndicatorReady;
  navIndicatorReady = true;
  animateNavIndicator(target, shouldSnap);
}

function renderApp() {
  if (!app) return;
  const screenChanged = renderedScreen !== state.screen;
  renderedScreen = state.screen;
  if (libraryRenderFrame) cancelAnimationFrame(libraryRenderFrame);
  if (libraryRenderIdle && window.cancelIdleCallback) window.cancelIdleCallback(libraryRenderIdle);
  libraryRenderFrame = 0;
  libraryRenderIdle = 0;
  libraryRenderToken += 1;
  const focusedNavAction = document.activeElement?.closest?.('.nav-item')?.dataset.action;
  const currentNav = app.querySelector('.bottom-nav');
  const markup = state.screen === 'assessment-intro' ? renderAssessmentIntro()
    : state.screen === 'assessment' ? renderAssessment()
      : state.screen === 'assessment-result' ? renderAssessmentResult()
        : state.screen === 'home' ? renderHome()
          : state.screen === 'study' ? renderStudy()
            : state.screen === 'library' ? renderLibrary()
              : state.screen === 'profile' ? renderProfile()
                : renderComplete();
  app.innerHTML = markup;
  if (screenChanged) app.querySelector('.home-content, .library-content, .profile-content, .study-main, .complete-main, .assessment-shell')?.classList.add('screen-content-enter');
  const nextNav = app.querySelector('.bottom-nav');
  if (currentNav && nextNav) nextNav.replaceWith(currentNav);
  syncNavIndicator();
  if (focusedNavAction) app.querySelector(`.nav-item[data-action="${focusedNavAction}"]`)?.focus();
  if (state.screen === 'library') scheduleLibraryListRender();
}

function showToast(message) {
  clearTimeout(toastTimer);
  const toast = app.querySelector('.toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('is-visible');
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2200);
}

function reducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function sheetOffset(sheet) {
  const transform = getComputedStyle(sheet).transform;
  if (!transform || transform === 'none') return 0;
  const values = transform.startsWith('matrix3d(') ? transform.slice(9, -1).split(',') : transform.slice(7, -1).split(',');
  return Number(values[transform.startsWith('matrix3d(') ? 13 : 5]) || 0;
}

function projectSheetVelocity(velocity) {
  const decelerationRate = 0.998;
  return (velocity / 1000) * decelerationRate / (1 - decelerationRate);
}

function springSheetTo(sheet, target, initialVelocity = 0, onComplete) {
  cancelAnimationFrame(sheetSpringFrame);
  clearTimeout(sheetSpringTimer);
  const start = sheetOffset(sheet);
  if (reducedMotion()) {
    sheet.style.transform = `translate3d(0, ${target}px, 0)`;
    onComplete?.();
    return;
  }
  let finished = false;
  const complete = () => {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(sheetSpringFrame);
    sheetSpringFrame = 0;
    clearTimeout(sheetSpringTimer);
    onComplete?.();
  };
  sheetSpringTimer = setTimeout(() => {
    sheet.style.transform = `translate3d(0, ${target}px, 0)`;
    complete();
  }, 1200);
  let position = start;
  let velocity = initialVelocity;
  let previous = performance.now();
  const stiffness = 260;
  const damping = 2 * 0.94 * Math.sqrt(stiffness);
  const tick = (now) => {
    const delta = Math.min((now - previous) / 1000, 0.032);
    previous = now;
    const acceleration = (target - position) * stiffness - velocity * damping;
    velocity += acceleration * delta;
    position += velocity * delta;
    sheet.style.transform = `translate3d(0, ${position}px, 0)`;
    if (Math.abs(target - position) < 1.1 && Math.abs(velocity) < 12) {
      sheet.style.transform = `translate3d(0, ${target}px, 0)`;
      sheetSpringFrame = 0;
      complete();
      return;
    }
    sheetSpringFrame = requestAnimationFrame(tick);
  };
  sheetSpringFrame = requestAnimationFrame(tick);
}

function closeSheetFromGesture(sheet) {
  if (sheet.classList.contains('login-sheet')) {
    loginOpen = false;
    loginStep = 'email';
    loginError = '';
    loginHint = '';
    renderApp();
    restoreLoginTrigger();
    return;
  }
  if (sheet.classList.contains('import-sheet')) {
    importOpen = false;
    importPreview = [];
    renderApp();
    restoreImportTrigger();
    return;
  }
  if (sheet.classList.contains('word-detail-sheet')) {
    const closedId = wordDetailId;
    wordDetailId = null;
    renderApp();
    restoreWordDetailTrigger(closedId);
    return;
  }
  settingsOpen = false;
  renderApp();
  restoreSettingsTrigger();
}

function finishSheetGesture(cancelled = false) {
  if (!sheetGesture) return;
  const { sheet, startOffset, samples } = sheetGesture;
  const current = sheetOffset(sheet);
  const latest = samples[samples.length - 1];
  const earliest = samples[Math.max(0, samples.length - 4)];
  const elapsed = Math.max(1, latest.time - earliest.time);
  const velocity = cancelled ? 0 : ((latest.position - earliest.position) / elapsed) * 1000;
  const projected = current + projectSheetVelocity(velocity);
  const close = !cancelled && (velocity > 900 || projected > sheet.offsetHeight * 0.5);
  sheetGesture = null;
  sheet.releasePointerCapture?.(latest.pointerId);
  sheet.classList.remove('is-dragging');
  sheet.style.transition = 'none';
  if (close) {
    springSheetTo(sheet, sheet.offsetHeight, velocity, () => closeSheetFromGesture(sheet));
  } else {
    springSheetTo(sheet, 0, velocity, () => {
      sheet.style.removeProperty('transform');
      sheet.style.removeProperty('transition');
      sheet.style.removeProperty('animation');
      sheet.style.removeProperty('will-change');
    });
  }
  if (startOffset !== current) sheet.style.willChange = 'transform';
}

function handleSheetPointerDown(event) {
  const handle = event.target.closest('[data-sheet-drag-handle]');
  const sheet = handle?.closest('.bottom-sheet');
  if (!sheet) return;
  cancelAnimationFrame(sheetSpringFrame);
  sheetSpringFrame = 0;
  clearTimeout(sheetSpringTimer);
  sheetSpringTimer = 0;
  const startOffset = sheetOffset(sheet);
  sheet.style.animation = 'none';
  sheet.style.transition = 'none';
  sheet.style.transform = 'translate3d(0, ' + startOffset + 'px, 0)';
  sheet.style.willChange = 'transform';
  sheet.setPointerCapture?.(event.pointerId);
  const position = event.clientY;
  sheetGesture = { sheet, pointerId: event.pointerId, startOffset, samples: [{ position, time: performance.now(), pointerId: event.pointerId }] };
  sheet.classList.add('is-dragging');
  event.preventDefault();
}

function handleSheetPointerMove(event) {
  if (!sheetGesture || event.pointerId !== sheetGesture.pointerId) return;
  const { sheet, startOffset } = sheetGesture;
  const raw = startOffset + event.clientY - sheetGesture.samples[0].position;
  const position = raw < 0 ? raw * 0.2 : raw;
  sheet.style.transform = `translate3d(0, ${position}px, 0)`;
  sheetGesture.samples.push({ position: event.clientY, time: performance.now(), pointerId: event.pointerId });
  if (sheetGesture.samples.length > 8) sheetGesture.samples.shift();
  event.preventDefault();
}

function handleSheetPointerUp(event) {
  if (!sheetGesture || event.pointerId !== sheetGesture.pointerId) return;
  finishSheetGesture(event.type === 'pointercancel');
}

function persistRender() {
  saveState(state);
  scheduleCloudSync();
  renderApp();
}

function toggleAnswerMore() {
  const details = app.querySelector('[data-answer-more]');
  const trigger = app.querySelector('[data-action="more"]');
  if (!details || !trigger) return;
  state.moreOpen = !state.moreOpen;
  details.hidden = !state.moreOpen;
  trigger.setAttribute('aria-expanded', String(state.moreOpen));
  trigger.querySelector('[data-more-label]').textContent = state.moreOpen ? '收起更多' : '展开更多';
  saveState(state);
}

function prepareNextBatch() {
  ensureDailyTask();
  const task = normalizeTask(state.dailyTask);
  state.dailyTask = task;
  if (!task) return;
  if (task.completed) {
    const replay = [...task.reviewWordIds, ...task.newWordIds, ...task.weakWordIds];
    state.queue = replay.length ? replay : baseStudyWords.slice(0, Math.max(1, Number(state.settings.dailyNew) || 20)).map((word) => word.id);
    state.queueStages = state.queue.map((id) => task.reviewWordIds.includes(id) ? 'review' : task.weakWordIds.includes(id) ? 'weak' : 'new');
    state.sessionReplay = true;
  } else {
    const pending = pendingDailyQueue(task);
    state.queue = pending.pending;
    state.queueStages = pending.stages;
    state.sessionReplay = false;
  }
  state.sessionMode = 'daily';
  state.queueIndex = 0;
  state.completed = [];
  state.weakToday = [];
  state.revealed = false;
  state.rating = null;
  state.moreOpen = false;
}

function startNewBatch() {
  ensureDailyTask();
  const task = appendNewBatch(state.dailyTask, {
    words: studyPool(),
    wordStates: state.wordStates,
    settings: state.settings,
    profile: state.vocabularyProfile,
    seed: `${state.localUserId}:${dateKey()}:${state.dailyTask?.batches?.length || 1}`,
    now: Date.now(),
  });
  if (!task) {
    showToast('已经没有新的未学习词了。');
    return false;
  }
  state.dailyTask = task;
  const batch = activeBatch(task);
  state.queue = [...(batch?.newWordIds || [])];
  state.queueStages = state.queue.map(() => 'new');
  state.sessionMode = 'daily';
  state.sessionReplay = false;
  state.queueIndex = 0;
  state.completed = [];
  state.weakToday = [];
  state.revealed = false;
  state.rating = null;
  state.moreOpen = false;
  state.completionType = null;
  state.reviewScope = null;
  state.stats.plannedBatchSize = state.stats.plannedBatchSize || state.dailyTask.batchSize;
  state.stats.extraNewWordsToday = Math.max(0, (state.stats.uniqueNewWordsToday || 0) - state.stats.plannedBatchSize);
  return true;
}

function startSession() {
  ensureDailyTask();
  const canResume = state.sessionMode === 'daily' && state.queue.length && state.queueIndex < state.queue.length && !state.dailyTask?.completed;
  if (!canResume) {
    prepareNextBatch();
  }
  if (!state.queue.length) {
    showToast('今日暂时没有可学习的词。');
    return;
  }
  state.screen = 'study';
  state.revealed = false;
  state.rating = null;
  state.moreOpen = false;
  preloadUpcomingPronunciations();
  persistRender();
}

function prepareReviewSession() {
  ensureDailyTask();
  const task = state.dailyTask;
  const entries = getPendingReviewEntries(task);
  if (!entries.length) return false;
  state.queue = entries.map((entry) => entry.id);
  state.queueStages = entries.map((entry) => entry.stage);
  state.queueIndex = 0;
  state.completed = [];
  state.weakToday = [];
  state.revealed = false;
  state.rating = null;
  state.moreOpen = false;
  state.sessionReplay = false;
  state.sessionMode = 'review';
  state.reviewScope = 'daily';
  state.completionType = null;
  return true;
}

function prepareBatchReviewSession() {
  ensureDailyTask();
  const task = state.dailyTask;
  const batch = activeBatch(task);
  const reviewIds = batch ? getPendingBatchReviewIds(task, batch.id) : [];
  if (!reviewIds.length) return false;
  state.queue = reviewIds;
  state.queueStages = reviewIds.map(() => 'batch-review');
  state.queueIndex = 0;
  state.completed = [];
  state.weakToday = [];
  state.revealed = false;
  state.rating = null;
  state.moreOpen = false;
  state.sessionReplay = false;
  state.sessionMode = 'review';
  state.reviewScope = 'batch';
  state.completionType = null;
  return true;
}

function startReviewSession() {
  ensureDailyTask();
  const canResume = state.sessionMode === 'review' && hasPendingSessionItems();
  if (!canResume && !prepareReviewSession()) {
    showToast('暂时没有待复习的词，先背一组新词吧。');
    return;
  }
  state.screen = 'study';
  state.revealed = false;
  state.rating = null;
  state.moreOpen = false;
  preloadUpcomingPronunciations();
  persistRender();
}

function startBatchReviewSession() {
  ensureDailyTask();
  const canResume = state.sessionMode === 'review' && state.reviewScope === 'batch' && state.queue.length && state.queueIndex < state.queue.length;
  if (!canResume && !prepareBatchReviewSession()) {
    showToast('本组暂时没有待复习的词。');
    return;
  }
  state.screen = 'study';
  state.revealed = false;
  state.rating = null;
  state.moreOpen = false;
  preloadUpcomingPronunciations();
  persistRender();
}

function setImportStatus(message) {
  const status = app.querySelector('[data-import-status]');
  if (status) status.textContent = message;
}

async function readImportFile(file) {
  const extension = `.${file.name.split('.').pop().toLowerCase()}`;
  if (['.csv', '.json', '.txt', '.md', '.markdown'].includes(extension)) {
    const text = await file.text();
    if (extension === '.json') return parseJson(text);
    if (extension === '.csv') return parseCsv(text);
    return parseTextLines(text);
  }
  if (extension === '.docx') {
    if (!window.mammoth) await loadScript('./assets/vendor/mammoth.browser.min.js');
    const result = await window.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return parseTextLines(result.value);
  }
  if (extension === '.xlsx') {
    if (!window.XLSX) await loadScript('./assets/vendor/xlsx.full.min.js');
    const workbook = window.XLSX.read(await file.arrayBuffer(), { type: 'array' });
    return parseCsv(window.XLSX.utils.sheet_to_csv(workbook.Sheets[workbook.SheetNames[0]]));
  }
  if (extension === '.pdf') {
    const pdfjs = await import('./../assets/vendor/pdf.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = './assets/vendor/pdf.worker.mjs';
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    let text = '';
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      text += `${content.items.map((item) => item.str).join(' ')}\n`;
    }
    return parseTextLines(text);
  }
  throw new Error('暂不支持该文件格式');
}

function loadScript(source) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = source;
    script.onload = resolve;
    script.onerror = () => reject(new Error('解析组件加载失败'));
    document.head.appendChild(script);
  });
}

function normalizeImportedWords(entries) {
  const existing = new Set([...words, ...importedWords].map((word) => word.word.toLowerCase()));
  const seen = new Set();
  const accepted = [];
  for (const entry of entries) {
    const word = String(entry.word || '').trim().toLowerCase();
    if (!word || seen.has(word) || existing.has(word)) continue;
    seen.add(word);
    accepted.push({ id: `imported-${word.replace(/[^a-z0-9]+/g, '-')}`, word, meaning: String(entry.meaning || '待补充释义').trim(), secondary: '', phonetic: '', phoneticUK: '', phoneticUS: '', audioUK: '', audioUS: '', example: '', translation: '', collocation: '', pitfall: '', extended: '', category: '用户导入', subcategory: '', variants: '', exam: 'CET-4', frequency: 0, frequencyRank: '自定义', importanceScore: 0, isStudyWord: true, source: '用户导入' });
  }
  return accepted;
}

async function parseImport() {
  try {
    const file = app.querySelector('[data-import-file]')?.files?.[0];
    const text = app.querySelector('[data-import-text]')?.value || '';
    importPreview = file ? await readImportFile(file) : parseTextLines(text);
    renderApp();
    setImportStatus(importPreview.length ? `已识别 ${importPreview.length} 个词。` : '没有识别到有效单词。');
  } catch (error) {
    setImportStatus(error.message || '文件解析失败，请检查格式。');
  }
}

function confirmImport() {
  const accepted = normalizeImportedWords(importPreview);
  importedWords = [...importedWords, ...accepted];
  invalidateWordPoolCaches();
  saveImportedWords();
  state.pendingImported = [...(state.pendingImported || []), ...accepted.map((word) => word.id)];
  importPreview = [];
  importOpen = false;
  state.screen = 'library';
  persistRender();
  showToast(`已导入 ${accepted.length} 个词`);
}

function saveMigrationSnapshot(userId) {
  try {
    if (appStorage.get(MIGRATION_STORAGE_KEY, null)) return;
    const snapshot = createLocalMigrationSnapshot({ learningState: state, importedWords });
    appStorage.set(MIGRATION_STORAGE_KEY, { accountId: userId, ...snapshot });
  } catch { /* best effort; local learning data remains untouched */ }
}

function stopLoginCountdown() {
  clearTimeout(loginCountdownTimer);
  loginCountdownTimer = 0;
}

function resetLogin() {
  stopLoginCountdown();
  loginStep = 'email';
  loginEmail = '';
  loginError = '';
  loginHint = '';
  loginSubmitting = false;
  loginResendUntil = 0;
}

function refreshLoginCountdown() {
  if (!loginOpen || loginStep !== 'code' || loginResendUntil <= Date.now()) return;
  clearTimeout(loginCountdownTimer);
  const update = () => {
    if (!loginOpen || loginStep !== 'code') return;
    const remaining = Math.max(0, Math.ceil((loginResendUntil - Date.now()) / 1000));
    const slot = app.querySelector('[data-login-resend-slot]');
    if (slot) slot.innerHTML = renderLoginResend(remaining);
    if (remaining <= 0) {
      loginCountdownTimer = 0;
      return;
    }
    loginCountdownTimer = setTimeout(update, 1000);
  };
  loginCountdownTimer = setTimeout(update, 1000);
}

async function requestLoginCode(form) {
  if (loginSubmitting || (loginStep === 'code' && loginResendUntil > Date.now())) return;
  loginEmail = form?.querySelector('[name="email"]')?.value || loginEmail;
  loginSubmitting = true;
  loginError = '';
  loginHint = '';
  renderApp();
  const result = await authService.sendEmailOtp(loginEmail);
  loginSubmitting = false;
  if (!result.ok) {
    loginError = result.error;
    renderApp();
    focusLoginField();
    return;
  }
  loginStep = 'code';
  loginResendUntil = Date.now() + 60000;
  loginHint = '验证码已发送，请查收邮箱。';
  renderApp();
  focusLoginField();
  refreshLoginCountdown();
}

function syncAuthenticatedAccount() {
  if (account.status !== 'authenticated' || !account.user?.id) return Promise.resolve(null);
  const userId = account.user.id;
  if (authenticatedSync?.userId === userId) return authenticatedSync.promise;
  const hadLocalData = hasMeaningfulLocalData(state);
  syncStatus = 'syncing';
  if (state.screen === 'profile' && !loginOpen) renderApp();
  const promise = (async () => {
    try {
      const merged = await syncService.syncUserState({ userId, localState: state });
      if (account.status !== 'authenticated' || account.user?.id !== userId) return;
      state = merged;
      const shouldAssess = shouldAutoStartAssessment({ hadLocalData, mergedHasLearningData: hasMeaningfulLocalData(state), profile: state.vocabularyProfile, assessment: state.assessment });
      if (shouldAssess) {
        state.screen = 'assessment-intro';
        assessmentFeedback = null;
      }
      saveState(state);
      themeService.setPreference(state.settings.themePreference);
      syncStatus = 'synced';
      if (state.screen === 'profile' || shouldAssess) renderApp();
      showToast(hadLocalData ? '学习记录已同步' : '已恢复学习记录');
    } catch {
      if (account.status !== 'authenticated' || account.user?.id !== userId) return;
      syncStatus = 'error';
      if (state.screen === 'profile') renderApp();
    }
  })().finally(() => {
    if (authenticatedSync?.promise !== promise) return;
    authenticatedSync = null;
    scheduleCloudSync();
  });
  authenticatedSync = { userId, promise };
  return promise;
}

async function completeLogin(form) {
  if (loginSubmitting) return;
  const code = form?.querySelector('[name="code"]')?.value || '';
  loginSubmitting = true;
  loginError = '';
  renderApp();
  const result = await authService.verifyEmailOtp(loginEmail, code);
  loginSubmitting = false;
  if (!result.ok) {
    loginError = result.error;
    renderApp();
    focusLoginField();
    return;
  }
  account = { status: 'authenticated', user: result.user };
  saveMigrationSnapshot(result.user.id);
  loginOpen = false;
  resetLogin();
  state.screen = 'profile';
  syncAuthenticatedAccount();
  persistRender();
}

async function startAssessment(form = app.querySelector('[data-assessment-setup]')) {
  if (assessmentPreparing) return;
  const values = form ? Object.fromEntries(new FormData(form)) : {};
  state = updateSettings(state, { ...values, dailyNew: state.settings.dailyNew }, studyPool());
  assessmentPreparing = true;
  renderApp();
  await ensureVocabularyHydrated();
  assessmentPoolCache = buildAssessmentPool(studyPool());
  assessmentPreparing = false;
  if (assessmentPoolCache.length < 100) {
    renderApp();
    showToast('可用测试题不足，请稍后重试。');
    return;
  }
  if (!state.assessment || state.assessment.completed || state.assessment.skipped) {
    state.assessment = createAssessmentState({ seed: `${state.localUserId}:${Date.now()}`, targetCount: 26, maxQuestions: 30 });
  }
  getAssessmentQuestion(state.assessment, assessmentPoolCache);
  assessmentFeedback = null;
  state.screen = 'assessment';
  window.scrollTo(0, 0);
  persistRender();
}

function answerAssessmentChoice(target) {
  if (assessmentFeedback || !state.assessment) return;
  const question = getAssessmentQuestion(state.assessment, assessmentPoolCache || []);
  if (!question) return;
  const selectedIndex = Number(target.dataset.choiceIndex);
  const next = answerAssessment(state.assessment, selectedIndex, assessmentPoolCache || [], Date.now());
  assessmentFeedback = { question, selectedIndex, correct: selectedIndex === question.correctIndex };
  state.assessment = next;
  if (next.completed) {
    state.vocabularyProfile = createVocabularyProfile(next, Date.now());
    state.wordStates = applyAssessmentToWordStates(state.wordStates, next, Date.now());
    state.adaptivePlan = null;
    state.dailyTask = null;
    state.queue = [];
    state.queueIndex = 0;
  }
  persistRender();
}

function continueAssessment() {
  assessmentFeedback = null;
  if (state.assessment?.completed) {
    state.screen = 'assessment-result';
    window.scrollTo(0, 0);
  }
  persistRender();
}

function skipAssessment() {
  state.assessment = { skipped: true, skippedAt: Date.now() };
  if (!state.vocabularyProfile) state.vocabularyProfile = defaultVocabularyProfile();
  state.adaptivePlan = null;
  state.dailyTask = null;
  state.screen = 'home';
  ensureDailyTask();
  persistRender();
}

function finishAssessment() {
  state.adaptivePlan = null;
  state.dailyTask = null;
  state.screen = 'home';
  ensureDailyTask();
  persistRender();
}

function restartAssessment() {
  assessmentFeedback = null;
  state.assessment = null;
  state.screen = 'assessment-intro';
  window.scrollTo(0, 0);
  settingsOpen = false;
  persistRender();
}

function goHome() {
  pronunciationService.stop();
  settingsOpen = false;
  loginOpen = false;
  if (state.screen === 'home') {
    syncNavIndicator();
    return;
  }
  state.screen = 'home';
  persistRender();
}

function saveSettings(form) {
  if (!form) return;
  state = updateSettings(state, Object.fromEntries(new FormData(form)), studyPool());
  state.adaptivePlan = null;
  ensureAdaptivePlan();
  settingsOpen = false;
  persistRender();
  showToast('学习设置已保存');
}

function updatePronunciationPreference(accent, control) {
  const nextAccent = accent === 'us' ? 'us' : 'uk';
  if (state.settings.pronunciationPreference === nextAccent) return;
  state.settings.pronunciationPreference = nextAccent;
  schedulePreferenceSave();
  if (!control) return;
  control.dataset.selected = nextAccent;
  control.querySelectorAll('[data-action="pronunciation"]').forEach((button) => {
    const selected = button.dataset.accent === nextAccent;
    button.classList.toggle('is-active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  const indicator = control.querySelector('.segmented-indicator');
  if (!indicator || reducedMotion()) return;
  indicator.style.willChange = 'transform';
  indicator.addEventListener('transitionend', () => indicator.style.removeProperty('will-change'), { once: true });
}

function updateThemePreference(preference, control) {
  state = setThemePreference(state, preference);
  themeService.setPreference(state.settings.themePreference);
  schedulePreferenceSave();
  if (!control) return;
  control.dataset.selected = state.settings.themePreference;
  control.querySelectorAll('[data-action="theme-preference"]').forEach((button) => {
    const selected = button.dataset.themePreference === state.settings.themePreference;
    button.classList.toggle('is-active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  const indicator = control.querySelector('.segmented-indicator');
  if (!indicator || reducedMotion()) return;
  indicator.style.willChange = 'transform';
  indicator.addEventListener('transitionend', () => indicator.style.removeProperty('will-change'), { once: true });
}

function schedulePreferenceSave() {
  if (preferenceSaveFrame) cancelAnimationFrame(preferenceSaveFrame);
  preferenceSaveFrame = requestAnimationFrame(() => {
    preferenceSaveFrame = 0;
    saveState(state);
  });
}

function scheduleCloudSync() {
  if (authenticatedSync || account.status !== 'authenticated' || !account.user?.id) return;
  syncService.scheduleSync({ userId: account.user.id, localState: state, onStatus(next) {
    syncStatus = next;
    if (state.screen === 'profile' && !loginOpen) renderApp();
  } });
}

function toggleFavoriteById(wordId) {
  const wordState = stateForWord(state, wordId);
  wordState.favorite = !wordState.favorite;
  wordState.updatedAt = Date.now();
  state.favorites = Object.values(state.wordStates).filter((item) => item.favorite).map((item) => item.wordId);
  persistRender();
  showToast(wordState.favorite ? '已加入收藏' : '已取消收藏');
}

function toggleHiddenById(wordId) {
  const wordState = stateForWord(state, wordId);
  if (wordState.status === 'hidden') {
    wordState.status = wordState.hiddenFromStatus || 'unseen';
    delete wordState.hiddenFromStatus;
    showToast('已恢复到学习列表');
  } else {
    wordState.hiddenFromStatus = wordState.status;
    wordState.status = 'hidden';
    if (state.dailyTask) {
      const task = normalizeTask(state.dailyTask);
      const completed = new Set([...(task.completedReviewIds || []), ...(task.completedNewIds || []), ...(task.completedWeakIds || []), ...(task.completedReviewPoolIds || [])]);
      const keepPending = (ids) => (ids || []).filter((id) => id !== wordId || completed.has(id));
      state.dailyTask = {
        ...task,
        reviewWordIds: keepPending(task.reviewWordIds),
        newWordIds: keepPending(task.newWordIds),
        weakWordIds: keepPending(task.weakWordIds),
        reviewPoolIds: keepPending(task.reviewPoolIds),
        batches: task.batches.map((batch) => ({
          ...batch,
          newWordIds: keepPending(batch.newWordIds),
          reviewPoolIds: keepPending(batch.reviewPoolIds),
        })),
      };
      const nextQueue = [];
      const nextStages = [];
      state.queue.forEach((id, index) => {
        if (id !== wordId || index < state.queueIndex) {
          nextQueue.push(id);
          nextStages.push(state.queueStages?.[index] || 'new');
        }
      });
      state.queue = nextQueue;
      state.queueStages = nextStages;
      state.dueCount = Math.max(0, state.dailyTask.reviewWordIds.length - state.dailyTask.completedReviewIds.length);
      if (pendingTaskQueue(state.dailyTask).pending.length === 0) state.dailyTask.completed = true;
    }
    showToast('已隐藏，不会再主动推荐');
  }
  wordState.updatedAt = Date.now();
  persistRender();
}

function rateWord(rating) {
  if (!['unknown', 'fuzzy', 'known'].includes(rating) || state.revealed) return;
  undoState = clone(state);
  const word = currentWord();
  if (!word) return;
  const id = word.id;
  const stage = taskStageForIndex();
  const batchId = state.dailyTask?.activeBatchId;
  const update = applyStudyRating(state, {
    wordId: id,
    stage,
    rating,
    batchId,
    requeueWeak: false,
  });
  if (!update) return;
  const { before, after, result } = update;
  recordResult(id, result, stage, before, after);
  state.rating = rating;
  state.revealed = true;
  state.moreOpen = false;
  persistRender();
}

function nextWord() {
  if (!state.revealed) {
    showToast('先选择你的认识程度。');
    return;
  }
  undoState = clone(state);
  pronunciationService.stop();
  const id = currentWord().id;
  const stage = taskStageForIndex();
  const advance = advanceStudySession(state, {
    wordId: id,
    stage,
    sessionMode: state.sessionMode,
    completeTask: state.sessionMode !== 'daily',
    batchId: state.dailyTask?.activeBatchId,
  });
  if (advance.completed) {
    if (state.sessionMode === 'daily' && !state.sessionReplay && batchHasCompletedNewWords(state.dailyTask)) {
      state.dailyTask = completeBatch(state.dailyTask, state.dailyTask.activeBatchId, Date.now());
      state.completionType = 'batch';
      state.reviewScope = null;
    } else if (state.sessionMode === 'review') {
      state.completionType = 'review';
    } else if (state.sessionMode === 'daily') {
      state.completionType = 'daily';
    }
    state.screen = 'complete';
  } else {
    state.revealed = false;
    state.rating = null;
    state.moreOpen = false;
    preloadUpcomingPronunciations();
  }
  persistRender();
}

function undoLast() {
  if (!undoState) {
    showToast('还没有可以撤销的操作。');
    return;
  }
  state = clone(undoState);
  undoState = null;
  persistRender();
}

function speak() {
  const word = currentWord();
  const accent = state.settings.pronunciationPreference === 'us' ? 'us' : 'uk';
  if (!pronunciationService.play(word, accent)) showToast('当前浏览器暂不支持发音。');
}

function handleAction(event) {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  if (target.matches('a[href="#"]')) event.preventDefault();
  const action = target.dataset.action;
  if (action === 'start-assessment') { void startAssessment(); return; }
  if (action === 'skip-assessment') { skipAssessment(); return; }
  if (action === 'assessment-choice') { answerAssessmentChoice(target); return; }
  if (action === 'assessment-next') { continueAssessment(); return; }
  if (action === 'assessment-finish') { finishAssessment(); return; }
  if (action === 'assessment-exit') { assessmentFeedback = null; state.screen = 'assessment-intro'; persistRender(); return; }
  if (action === 'retest-assessment') { restartAssessment(); return; }
  const guardedActions = new Set(['rate-unknown', 'rate-fuzzy', 'rate-known', 'next', 'undo']);
  const point = Number.isFinite(event.clientX) && Number.isFinite(event.clientY) ? { x: event.clientX, y: event.clientY } : null;
  if (point && lastActionGesture && Date.now() - lastActionGesture.time < 80 && guardedActions.has(action)) {
    const dx = point.x - lastActionGesture.point.x;
    const dy = point.y - lastActionGesture.point.y;
    // Suppress a second event from the same physical tap, while allowing a
    // deliberate fast rating -> next action on a different control.
    const threshold = action === lastActionGesture.action ? 24 : 10;
    if (Math.hypot(dx, dy) < threshold) {
      lastActionGesture = null;
      return;
    }
  }
  if (point && guardedActions.has(action)) lastActionGesture = { time: Date.now(), point };
  if (action === 'start') startSession();
  if (action === 'continue-batch') {
    if (startNewBatch()) {
      state.screen = 'study';
      preloadUpcomingPronunciations();
      persistRender();
    }
  }
  if (action === 'start-review') startReviewSession();
  if (action === 'review-batch') startBatchReviewSession();
  if (action === 'home') goHome();
  if (action === 'settings') { settingsOpen = true; renderApp(); focusSettingsField(); }
  if (action === 'save-settings') {
    saveSettings(app.querySelector('[data-settings-form]'));
  }
  if (action === 'close-settings') {
    if (target.classList.contains('icon-button') || (target.matches('.sheet-backdrop') && event.target === target)) { settingsOpen = false; renderApp(); restoreSettingsTrigger(); }
  }
  if (action === 'library') {
    settingsOpen = false;
    loginOpen = false;
    if (state.screen === 'library') syncNavIndicator();
    else { state.screen = 'library'; persistRender(); }
  }
  if (action === 'profile') {
    settingsOpen = false;
    loginOpen = false;
    if (state.screen === 'profile') syncNavIndicator();
    else { state.screen = 'profile'; persistRender(); }
  }
  if (action === 'library-all') setLibraryMode('all');
  if (action === 'library-study') setLibraryMode('study');
  if (action === 'library-favorite') setLibraryMode('favorite');
  if (action === 'library-mistake') setLibraryMode('mistake');
  if (action === 'library-hidden') setLibraryMode('hidden');
  if (action === 'open-word-detail') {
    wordDetailId = target.dataset.wordId;
    renderApp();
    focusWordDetail();
    void ensureVocabularyHydrated().then(() => {
      if (wordDetailId !== null) {
        renderApp();
        focusWordDetail();
      }
    });
  }
  if (action === 'close-word-detail') {
    if (target.classList.contains('icon-button') || (target.matches('.sheet-backdrop') && event.target === target)) {
      const closedId = wordDetailId;
      wordDetailId = null;
      renderApp();
      restoreWordDetailTrigger(closedId);
    }
  }
  if (action === 'speak-detail') {
    const word = libraryPool().find((item) => String(item.id) === String(target.dataset.wordId));
    if (!word || !pronunciationService.play(word, target.dataset.accent === 'us' ? 'us' : 'uk')) showToast('当前浏览器暂不支持发音。');
  }
  if (action === 'pronunciation') {
    updatePronunciationPreference(target.dataset.accent, target.closest('.segmented-control'));
  }
  if (action === 'theme-preference') {
    updateThemePreference(target.dataset.themePreference, target.closest('.segmented-control'));
  }
  if (action === 'open-import') { importOpen = true; importPreview = []; renderApp(); focusImportField(); }
  if (action === 'close-import') {
    if (target.classList.contains('icon-button') || (target.matches('.sheet-backdrop') && event.target === target)) { importOpen = false; importPreview = []; renderApp(); restoreImportTrigger(); }
  }
  if (action === 'open-login') {
    loginOpen = true;
    resetLogin();
    renderApp();
    focusLoginField();
  }
  if (action === 'close-login') {
    if (target.classList.contains('icon-button') || (target.matches('.sheet-backdrop') && event.target === target)) {
      loginOpen = false;
      resetLogin();
      renderApp();
      restoreLoginTrigger();
    }
  }
  if (action === 'back-login') {
    loginStep = 'email';
    loginError = '';
    loginHint = '';
    stopLoginCountdown();
    renderApp();
    focusLoginField();
  }
  if (action === 'resend-login-code') {
    requestLoginCode();
  }
  if (action === 'logout') {
    authService.signOut();
    syncService.cancelSync();
    account = createGuestAccount();
    syncStatus = 'local';
    renderApp();
    showToast('已退出登录，本机学习记录仍会保留');
  }
  if (action === 'profile-favorites') { state.screen = 'library'; libraryMode = 'favorite'; persistRender(); }
  if (action === 'profile-custom') showToast('自定义词表仍保存在本机，登录后可准备同步。');
  if (action === 'profile-hidden') { state.screen = 'library'; libraryMode = 'hidden'; persistRender(); }
  if (action === 'library-favorite-toggle') toggleFavoriteById(target.dataset.wordId);
  if (action === 'library-hidden-toggle') toggleHiddenById(target.dataset.wordId);
  if (action === 'profile-privacy') showToast('学习数据目前只保存在这台设备上。');
  if (action === 'profile-about') showToast('拾词 · CET-4 背词');
  if (action === 'parse-import') parseImport();
  if (action === 'confirm-import') confirmImport();
  if (action === 'favorite') {
    const id = currentWord().id;
    const wordState = stateForWord(state, id);
    wordState.favorite = !wordState.favorite;
    state.favorites = Object.values(state.wordStates).filter((item) => item.favorite).map((item) => item.wordId);
    persistRender();
  }
  if (action === 'speak') speak();
  if (action === 'rate-unknown') rateWord('unknown');
  if (action === 'rate-fuzzy') rateWord('fuzzy');
  if (action === 'rate-known') rateWord('known');
  if (action === 'next') nextWord();
  if (action === 'undo') undoLast();
  if (action === 'more') toggleAnswerMore();
}

app?.addEventListener('click', handleAction);
app?.addEventListener('pointerdown', handleSheetPointerDown);
app?.addEventListener('pointermove', handleSheetPointerMove);
app?.addEventListener('pointerup', handleSheetPointerUp);
app?.addEventListener('pointercancel', handleSheetPointerUp);
app?.addEventListener('keydown', (event) => {
  const item = event.target.closest?.('[data-action="open-word-detail"]');
  if (item && (event.key === 'Enter' || event.key === ' ')) {
    event.preventDefault();
    wordDetailId = item.dataset.wordId;
    renderApp();
    focusWordDetail();
  }
});
window.addEventListener('resize', () => syncNavIndicator({ immediate: true }));
window.addEventListener('online', () => scheduleCloudSync());
window.addEventListener('pagehide', () => {
  if (preferenceSaveFrame) cancelAnimationFrame(preferenceSaveFrame);
  preferenceSaveFrame = 0;
  saveState(state);
  scheduleCloudSync();
});
document.addEventListener('keydown', (event) => {
  const backdrop = app.querySelector('.sheet-backdrop');
  if (!backdrop) return;
  if (event.key === 'Escape') {
    if (loginOpen) {
      loginOpen = false;
      resetLogin();
      renderApp();
      restoreLoginTrigger();
    } else if (importOpen) {
      importOpen = false;
      importPreview = [];
      renderApp();
    } else if (settingsOpen) {
      settingsOpen = false;
      renderApp();
    } else if (wordDetailId !== null) {
      const closedId = wordDetailId;
      wordDetailId = null;
      renderApp();
      restoreWordDetailTrigger(closedId);
    }
    return;
  }
  if (event.key !== 'Tab') return;
  const focusable = [...backdrop.querySelectorAll('button, input, textarea, select, [href]')].filter((element) => !element.disabled && element.offsetParent !== null);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (!backdrop.contains(document.activeElement)) {
    event.preventDefault();
    first.focus();
  } else if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});
app?.addEventListener('submit', (event) => {
  if (event.target.matches('[data-settings-form]')) {
    event.preventDefault();
    saveSettings(event.target);
  }
  if (event.target.matches('[data-login-email-form]')) {
    event.preventDefault();
    requestLoginCode(event.target);
  }
  if (event.target.matches('[data-login-code-form]')) {
    event.preventDefault();
    completeLogin(event.target);
  }
});
app?.addEventListener('input', (event) => {
  if (event.target.matches('[data-library-search]')) applyLibrarySearch();
});
if (needsInitialAssessment() && !['assessment-intro', 'assessment'].includes(state.screen)) {
  state.screen = state.assessment?.answers?.length ? 'assessment' : 'assessment-intro';
}
if (state.assessment?.completed && state.screen === 'assessment') state.screen = 'assessment-result';
if (!['assessment-intro', 'assessment', 'assessment-result'].includes(state.screen)) ensureDailyTask();
themeService.setPreference(state.settings.themePreference);
themeService.subscribeSystemTheme();
renderApp();
if (state.screen === 'assessment') {
  assessmentPreparing = true;
  ensureVocabularyHydrated().then(() => {
    assessmentPoolCache = buildAssessmentPool(studyPool());
    assessmentPreparing = false;
    renderApp();
  });
}
scheduleVocabularyHydration();
authService.getCurrentUser().then((user) => {
  if (!user) return;
  account = { status: 'authenticated', user };
  syncStatus = 'pending';
  renderApp();
  syncAuthenticatedAccount();
});
authService.onAuthStateChange((nextAccount) => {
  if (nextAccount.status !== 'authenticated') {
    if (account.status !== 'authenticated') return;
    account = createGuestAccount();
    syncService.cancelSync();
    syncStatus = 'local';
    if (state.screen === 'profile') renderApp();
    return;
  }
  if (account.user?.id === nextAccount.user.id) return;
  account = nextAccount;
  syncStatus = 'pending';
  syncAuthenticatedAccount();
});

export { createInitialState, currentWord, nextWord, rateWord };
