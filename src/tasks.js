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

const uniqueIds = (ids = []) => [...new Set((Array.isArray(ids) ? ids : []).filter((id) => id !== undefined && id !== null))];

function createBatch({ id, newWordIds = [], createdAt = Date.now() } = {}) {
  return {
    id,
    newWordIds: uniqueIds(newWordIds),
    completedNewIds: [],
    reviewPoolIds: [],
    completedReviewIds: [],
    resultById: {},
    status: newWordIds.length ? 'active' : 'complete',
    createdAt,
    completedAt: newWordIds.length ? null : createdAt,
  };
}

export function getBatch(task, batchId = task?.activeBatchId) {
  return (task?.batches || []).find((batch) => String(batch.id) === String(batchId)) || null;
}

function normalizeBatch(batch, fallbackId) {
  const source = batch && typeof batch === 'object' ? batch : {};
  const newWordIds = uniqueIds(source.newWordIds);
  return {
    ...createBatch({ id: source.id || fallbackId, newWordIds, createdAt: Number(source.createdAt) || Date.now() }),
    ...source,
    id: source.id || fallbackId,
    newWordIds,
    completedNewIds: uniqueIds(source.completedNewIds),
    reviewPoolIds: uniqueIds(source.reviewPoolIds),
    completedReviewIds: uniqueIds(source.completedReviewIds),
    resultById: source.resultById && typeof source.resultById === 'object' ? { ...source.resultById } : {},
    status: source.status === 'complete' ? 'complete' : 'active',
    completedAt: source.completedAt || null,
  };
}

export function normalizeDailyTask(task) {
  if (!task || typeof task !== 'object') return task;
  const date = task.date || dateKey();
  const legacyBatchId = `${date}-1`;
  const sourceBatches = Array.isArray(task.batches) && task.batches.length
    ? task.batches
    : [
      {
        id: legacyBatchId,
        newWordIds: task.newWordIds || [],
        completedNewIds: task.completedNewIds || [],
        reviewPoolIds: task.weakWordIds || [],
        completedReviewIds: task.completedReviewPoolIds || [],
        resultById: {},
        status: task.completed ? 'complete' : 'active',
      },
    ];
  const batches = sourceBatches.map((batch, index) => normalizeBatch(batch, `${date}-${index + 1}`));
  const activeBatchId = task.activeBatchId || batches[batches.length - 1]?.id || legacyBatchId;
  const reviewPoolIds = uniqueIds([
    ...(task.reviewPoolIds || []),
    ...(task.weakWordIds || []),
    ...batches.flatMap((batch) => batch.reviewPoolIds),
  ]);
  const completedReviewPoolIds = uniqueIds([
    ...(task.completedReviewPoolIds || []),
    ...batches.flatMap((batch) => batch.completedReviewIds),
  ]);
  const batchSize = Math.min(100, Math.max(1, Number(task.batchSize) || Number(task.newWordIds?.length) || 20));
  const batchNewIds = batches.flatMap((batch) => batch.newWordIds);
  const batchCompletedNewIds = batches.flatMap((batch) => batch.completedNewIds);
  const batchPoolIds = batches.flatMap((batch) => batch.reviewPoolIds);
  return {
    ...task,
    date,
    batchSize,
    batches,
    activeBatchId,
    reviewPoolIds,
    completedReviewPoolIds,
    reviewWordIds: uniqueIds(task.reviewWordIds),
    completedReviewIds: uniqueIds(task.completedReviewIds),
    newWordIds: uniqueIds((Array.isArray(task.newWordIds) && task.newWordIds.length) ? task.newWordIds : batchNewIds),
    completedNewIds: uniqueIds((Array.isArray(task.completedNewIds) && task.completedNewIds.length) ? task.completedNewIds : batchCompletedNewIds),
    weakWordIds: uniqueIds((Array.isArray(task.weakWordIds) && task.weakWordIds.length) ? task.weakWordIds : uniqueIds([...reviewPoolIds, ...batchPoolIds])),
    completedWeakIds: uniqueIds(task.completedWeakIds),
  };
}

export function getPendingReviewIds(task) {
  const completedDue = new Set(task?.completedReviewIds || []);
  const completedPool = new Set(task?.completedReviewPoolIds || []);
  const seen = new Set();
  const pending = [];
  for (const id of task?.reviewWordIds || []) {
    if (!completedDue.has(id) && !seen.has(id)) {
      seen.add(id);
      pending.push(id);
    }
  }
  for (const id of task?.reviewPoolIds || []) {
    if (!completedPool.has(id) && !seen.has(id)) {
      seen.add(id);
      pending.push(id);
    }
  }
  return pending;
}

export function getBatchReviewIds(task, batchId = task?.activeBatchId) {
  return uniqueIds(getBatch(task, batchId)?.reviewPoolIds);
}

export function getPendingBatchReviewIds(task, batchId = task?.activeBatchId) {
  const batch = getBatch(task, batchId);
  if (!batch) return [];
  const completed = new Set([...(batch.completedReviewIds || []), ...(task?.completedReviewPoolIds || [])]);
  return getBatchReviewIds(task, batchId).filter((id) => !completed.has(id));
}

export function getPendingReviewEntries(task) {
  const completedDue = new Set(task?.completedReviewIds || []);
  const completedPool = new Set(task?.completedReviewPoolIds || []);
  const seen = new Set();
  const entries = [];
  const resultById = new Map();
  for (const batch of task?.batches || []) {
    for (const [id, result] of Object.entries(batch.resultById || {})) resultById.set(String(id), result);
  }
  for (const id of task?.reviewPoolIds || []) {
    if (!completedPool.has(id) && !seen.has(id)) {
      seen.add(id);
      entries.push({ id, stage: 'batch-review' });
    }
  }
  const priority = (id) => resultById.get(String(id)) === 'again' ? 0 : resultById.get(String(id)) === 'hard' ? 1 : 2;
  entries.sort((left, right) => priority(left.id) - priority(right.id));
  for (const id of task?.reviewWordIds || []) {
    if (!completedDue.has(id) && !seen.has(id)) {
      seen.add(id);
      entries.push({ id, stage: 'review' });
    }
  }
  return entries;
}

export function addBatchReviewWords(task, batchId, ids = []) {
  if (!task) return task;
  const additions = uniqueIds(ids);
  const batch = getBatch(task, batchId);
  const reviewPoolIds = uniqueIds([...(task.reviewPoolIds || []), ...additions]);
  const completedReviewPoolIds = (task.completedReviewPoolIds || []).filter((id) => !additions.includes(id));
  const batches = (task.batches || []).map((item) => {
    if (!batch || String(item.id) !== String(batch.id)) return item;
    return {
      ...item,
      reviewPoolIds: uniqueIds([...(item.reviewPoolIds || []), ...additions]),
      completedReviewIds: (item.completedReviewIds || []).filter((id) => !additions.includes(id)),
    };
  });
  const next = {
    ...task,
    reviewPoolIds,
    completedReviewPoolIds,
    weakWordIds: uniqueIds([...(task.weakWordIds || []), ...additions]),
    batches,
  };
  next.currentStage = stageFor(next);
  return next;
}

export function appendNewBatch(task, { words = [], wordStates = {}, settings = {}, profile = null, seed = '', now = Date.now() } = {}) {
  if (!task) return null;
  const normalized = normalizeDailyTask(task);
  const limit = Math.min(100, Math.max(1, Number(settings.dailyNew) || normalized.batchSize || 20));
  const candidates = getNewWordCandidates(words, wordStates, settings, { profile, seed: seed || `${normalized.date}:${normalized.batches.length + 1}`, now }).slice(0, limit).map((word) => word.id);
  if (!candidates.length) return null;
  const id = `${normalized.date}-${normalized.batches.length + 1}`;
  const batch = createBatch({ id, newWordIds: candidates, createdAt: now });
  return {
    ...normalized,
    batchSize: limit,
    batches: [...normalized.batches, batch],
    activeBatchId: id,
    newWordIds: uniqueIds([...(normalized.newWordIds || []), ...candidates]),
    completed: false,
    currentStage: 'new',
    currentIndex: 0,
  };
}

export function completeBatch(task, batchId = task?.activeBatchId, completedAt = Date.now()) {
  const normalized = normalizeDailyTask(task);
  if (!normalized) return normalized;
  const batches = normalized.batches.map((batch) => String(batch.id) === String(batchId)
    ? { ...batch, status: 'complete', completedAt }
    : batch);
  return { ...normalized, batches, activeBatchId: batchId, currentStage: 'batch-complete', completed: false };
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

export function createDailyTask({ words = [], wordStates = {}, settings = {}, profile = null, seed = '', now = Date.now(), previousTask = null } = {}) {
  const today = dateKey(now);
  if (previousTask?.date === today) return { ...previousTask, currentStage: stageFor(previousTask) };
  const reviews = getReviewCandidates(words, wordStates, now).map((word) => word.id);
  const candidates = getNewWordCandidates(words, wordStates, settings, { profile, seed: seed || today, now });
  const limit = Math.min(100, Math.max(1, Number(settings.dailyNew) || 20));
  const news = candidates.slice(0, limit).map((word) => word.id);
  const batchId = `${today}-1`;
  const task = {
    date: today,
    batchSize: limit,
    batches: [createBatch({ id: batchId, newWordIds: news, createdAt: now })],
    activeBatchId: batchId,
    reviewPoolIds: [],
    completedReviewPoolIds: [],
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

export function updateTaskWeakWords(task, ids = [], batchId = task?.activeBatchId) {
  return addBatchReviewWords(normalizeDailyTask(task), batchId, ids);
}

export function markTaskItemComplete(task, wordId, stage = task?.currentStage, { batchId = task?.activeBatchId } = {}) {
  if (!task) return task;
  const normalized = normalizeDailyTask(task);
  const key = stage === 'review' ? 'completedReviewIds' : stage === 'batch-review' ? 'completedReviewPoolIds' : stage === 'weak' ? 'completedWeakIds' : 'completedNewIds';
  const completed = new Set(normalized[key] || []);
  completed.add(wordId);
  const next = { ...normalized, [key]: [...completed] };
  if (stage === 'review' && normalized.reviewPoolIds?.includes(wordId)) next.completedReviewPoolIds = uniqueIds([...(next.completedReviewPoolIds || []), wordId]);
  next.batches = normalized.batches.map((batch) => {
    if (String(batch.id) !== String(batchId)) return batch;
    if (stage === 'new') return { ...batch, completedNewIds: uniqueIds([...(batch.completedNewIds || []), wordId]) };
    if (stage === 'batch-review' || (stage === 'review' && batch.reviewPoolIds?.includes(wordId))) return { ...batch, completedReviewIds: uniqueIds([...(batch.completedReviewIds || []), wordId]) };
    return batch;
  });
  if (stage === 'new') next.completedNewIds = uniqueIds([...(normalized.completedNewIds || []), wordId]);
  next.currentStage = stageFor(next);
  next.completed = next.currentStage === 'complete';
  next.currentIndex = next[key].length;
  return next;
}
