const numericFields = ['reviewCount', 'correctCount', 'wrongCount', 'streak', 'interval', 'ease', 'difficulty', 'lapses', 'mistakeCount'];
const stamp = (value) => Math.max(0, Number(value?.updatedAt) || 0);
const union = (left = [], right = []) => [...new Set([...(Array.isArray(left) ? left : []), ...(Array.isArray(right) ? right : [])])];

export function mergeWordState(local = {}, cloud = {}) {
  const newer = stamp(local) >= stamp(cloud) ? local : cloud;
  const older = newer === local ? cloud : local;
  const merged = { ...older, ...newer, wordId: newer.wordId ?? older.wordId };
  for (const field of numericFields) merged[field] = Math.max(Number(local[field]) || 0, Number(cloud[field]) || 0);
  merged.favorite = Boolean(local.favorite || cloud.favorite);
  merged.favoriteFolders = union(local.favoriteFolders, cloud.favoriteFolders);
  merged.lastReviewedAt = Math.max(Number(local.lastReviewedAt) || 0, Number(cloud.lastReviewedAt) || 0) || null;
  merged.updatedAt = Math.max(stamp(local), stamp(cloud));
  return merged;
}

export function mergeLearningState(local = {}, cloud = {}) {
  const localStates = local.wordStates || {};
  const cloudStates = cloud.wordStates || {};
  const keys = new Set([...Object.keys(localStates), ...Object.keys(cloudStates)]);
  const wordStates = Object.fromEntries([...keys].map((key) => [key, mergeWordState(localStates[key], cloudStates[key])]));
  const localSettings = local.settings || {};
  const cloudSettings = cloud.settings || {};
  const useCloudSettings = !hasMeaningfulLocalData(local) || Number(cloudSettings.themeUpdatedAt) > Number(localSettings.themeUpdatedAt);
  const settings = useCloudSettings ? { ...localSettings, ...cloudSettings } : { ...cloudSettings, ...localSettings };
  const stats = { ...(cloud.stats || {}), ...(local.stats || {}) };
  for (const [key, value] of Object.entries(cloud.stats || {})) if (Number.isFinite(Number(value))) stats[key] = Math.max(Number(value), Number(local.stats?.[key]) || 0);
  return { ...local, wordStates, favorites: Object.values(wordStates).filter((item) => item.favorite).map((item) => item.wordId), settings, stats };
}

export function hasMeaningfulLocalData(state = {}) {
  return Boolean(Object.keys(state.wordStates || {}).length || state.completed?.length || state.stats?.totalLearned || state.stats?.todayLearned);
}

function toCloudWordState(userId, state) {
  return { user_id: userId, word_id: String(state.wordId), status: state.status, familiarity: state.familiarity, review_count: state.reviewCount || 0, correct_count: state.correctCount || 0, wrong_count: state.wrongCount || 0, streak: state.streak || 0, last_reviewed_at: state.lastReviewedAt, next_review_at: state.nextReviewAt, interval: state.interval || 0, ease: state.ease || 0, difficulty: state.difficulty || 0, lapses: state.lapses || 0, favorite: Boolean(state.favorite), favorite_folders: state.favoriteFolders || [], mistake_count: state.mistakeCount || 0, first_learned_at: state.firstLearnedAt, mastered_at: state.masteredAt, updated_at: state.updatedAt || Date.now() };
}

function fromCloudWordState(row) {
  return { wordId: row.word_id, status: row.status, familiarity: row.familiarity, reviewCount: row.review_count, correctCount: row.correct_count, wrongCount: row.wrong_count, streak: row.streak, lastReviewedAt: row.last_reviewed_at, nextReviewAt: row.next_review_at, interval: row.interval, ease: row.ease, difficulty: row.difficulty, lapses: row.lapses, favorite: row.favorite, favoriteFolders: row.favorite_folders, mistakeCount: row.mistake_count, firstLearnedAt: row.first_learned_at, masteredAt: row.mastered_at, updatedAt: row.updated_at };
}

export function createSyncService(client, delay = 1800) {
  let timer = 0;
  let scheduledUserId = null;
  const uploadedRevisions = new Map();
  function revisionOf(state) {
    return Number(state?.updatedAt) || 0;
  }
  function uploadedFor(userId) {
    if (!uploadedRevisions.has(userId)) uploadedRevisions.set(userId, new Map());
    return uploadedRevisions.get(userId);
  }
  async function downloadCloudState(userId) {
    if (!client) return null;
    const [settingsResult, wordsResult] = await Promise.all([client.from('user_settings').select('settings, stats, updated_at').eq('user_id', userId).maybeSingle(), client.from('user_word_states').select('*').eq('user_id', userId)]);
    if (settingsResult.error) throw settingsResult.error;
    if (wordsResult.error) throw wordsResult.error;
    return { settings: settingsResult.data?.settings || {}, stats: settingsResult.data?.stats || {}, wordStates: Object.fromEntries((wordsResult.data || []).map((row) => [String(row.word_id), fromCloudWordState(row)])) };
  }
  async function uploadLocalState(userId, state, { incremental = false } = {}) {
    if (!client) return;
    const profileResult = await client.from('profiles').upsert({ id: userId });
    if (profileResult.error) throw profileResult.error;
    const settingsResult = await client.from('user_settings').upsert({ user_id: userId, settings: state.settings || {}, stats: state.stats || {}, updated_at: Date.now() });
    if (settingsResult.error) throw settingsResult.error;
    const knownRevisions = uploadedFor(userId);
    const sourceStates = Object.values(state.wordStates || {}).filter((item) => !incremental || knownRevisions.get(String(item.wordId)) !== revisionOf(item));
    const rows = sourceStates.map((item) => toCloudWordState(userId, item));
    if (!rows.length) return;
    const wordsResult = await client.from('user_word_states').upsert(rows, { onConflict: 'user_id,word_id' });
    if (wordsResult.error) throw wordsResult.error;
    for (const item of sourceStates) knownRevisions.set(String(item.wordId), revisionOf(item));
  }
  async function syncUserState({ userId, localState }) {
    const cloud = await downloadCloudState(userId);
    const merged = cloud ? mergeLearningState(localState, cloud) : localState;
    await uploadLocalState(userId, merged);
    return merged;
  }
  function scheduleSync({ userId, localState, onStatus }) {
    if (!client || !userId) return;
    clearTimeout(timer);
    scheduledUserId = userId;
    onStatus?.('pending');
    timer = setTimeout(async () => {
      onStatus?.('syncing');
      try { await uploadLocalState(userId, localState, { incremental: true }); onStatus?.('synced'); } catch {
        onStatus?.('error');
        if (scheduledUserId === userId) timer = setTimeout(() => scheduleSync({ userId, localState, onStatus }), 10000);
      }
    }, delay);
  }
  return {
    downloadCloudState, uploadLocalState, syncUserState,
    cancelSync() {
      clearTimeout(timer);
      timer = 0;
      scheduledUserId = null;
    },
    scheduleSync,
  };
}
