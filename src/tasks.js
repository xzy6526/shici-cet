import { getNewWordCandidates, getReviewCandidates } from './repository.js';

const DAY_MS = 86400000;

export function dateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateOnlyUtc(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  return Date.UTC(year, month - 1, day);
}

function dateKeyUtc(timestamp) {
  const date = new Date(timestamp);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

export function daysUntilExam(examDate, now = new Date()) {
  const target = dateOnlyUtc(examDate);
  const current = dateOnlyUtc(dateKey(now));
  if (target == null || current == null) return null;
  return Math.max(0, Math.ceil((target - current) / DAY_MS));
}

function hasStudyRecord(record) {
  if (!record) return false;
  return Boolean(record.studied || record.completed || record.learnedIds?.length || record.reviewedIds?.length);
}

export function calculateStreak(history = {}, today = dateKey()) {
  if (!today) return 0;
  let cursor = dateOnlyUtc(today);
  if (cursor == null) return 0;
  let streak = 0;
  while (hasStudyRecord(history[dateKeyUtc(cursor)])) {
    streak += 1;
    cursor -= DAY_MS;
  }
  return streak;
}

function stageFor(task) {
  if (task.completedReviewIds.length < task.reviewWordIds.length) return 'review';
  if (task.completedNewIds.length < task.newWordIds.length) return 'new';
  if (task.completedWeakIds.length < task.weakWordIds.length) return 'weak';
  return 'complete';
}

export function createDailyTask({ words = [], wordStates = {}, settings = {}, now = Date.now(), previousTask = null } = {}) {
  const today = dateKey(now);
  if (previousTask?.date === today) return { ...previousTask, currentStage: stageFor(previousTask) };
  const reviews = getReviewCandidates(words, wordStates, now).map((word) => word.id);
  const candidates = getNewWordCandidates(words, wordStates, settings);
  const limit = Math.min(100, Math.max(1, Number(settings.dailyNew) || 20));
  const news = candidates.slice(0, limit).map((word) => word.id);
  const task = {
    date: today,
    reviewWordIds: reviews,
    newWordIds: news,
    weakWordIds: [],
    completedReviewIds: [],
    completedNewIds: [],
    completedWeakIds: [],
    currentStage: 'review',
    currentIndex: 0,
    completed: false,
  };
  task.currentStage = stageFor(task);
  return task;
}

export function updateTaskWeakWords(task, ids = []) {
  if (!task) return task;
  const existing = new Set(task.weakWordIds || []);
  for (const id of ids) existing.add(id);
  const next = { ...task, weakWordIds: [...existing] };
  next.currentStage = stageFor(next);
  return next;
}

export function markTaskItemComplete(task, wordId, stage = task?.currentStage) {
  if (!task) return task;
  const key = stage === 'review' ? 'completedReviewIds' : stage === 'weak' ? 'completedWeakIds' : 'completedNewIds';
  const completed = new Set(task[key] || []);
  completed.add(wordId);
  const next = { ...task, [key]: [...completed] };
  next.currentStage = stageFor(next);
  next.completed = next.currentStage === 'complete';
  next.currentIndex = next[key].length;
  return next;
}
