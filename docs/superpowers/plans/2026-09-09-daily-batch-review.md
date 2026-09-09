# Daily Batch and Review Pool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Interpret `dailyNew` as a user-triggered batch size, stop after each unique-new batch, and keep a deduplicated same-day review pool for vague/unknown words.

**Architecture:** Extend the existing `DailyTask` with additive batch records and ID-only review-pool fields while preserving legacy top-level arrays. Keep one Study Session engine; use `sessionMode` plus `reviewScope` and `completionType` to distinguish normal learning, batch completion, batch review, and daily due review. New batches are created only from explicit user actions.

**Tech Stack:** Vanilla ES modules, existing Node test runner, existing CSS/DOM renderer, repository and scheduler modules.

**Spec:** `C:\Users\xuziyan\.codex\attachments\52021f06-57e9-49e1-bbef-25fb73c7ac92\pasted-text.txt`

## Global Constraints

- `dailyNew` is the default number of unique new words per user-triggered batch.
- Never append the next unseen word automatically when a batch reaches its size.
- The review pool stores only `wordId` values and deduplicates across batches.
- Normal learning and review use the existing Study Session, Word Card, UserWordState, scheduler, and local persistence.
- Historical due review and same-day batch review share the existing review entry but retain separate completion bookkeeping.
- Weak words must remain reviewable when the user skips immediate review and starts another batch.
- Do not add a new route, duplicate the study engine, or alter the stable 4025/3861 vocabulary corpus.
- Keep existing login, theme, navigation, import, and pronunciation behavior unchanged.

---

### Task 1: Add tested batch and review-pool state helpers

**Files:**
- Modify: `src/tasks.js`
- Modify: `src/domain.js`
- Modify: `src/study-session.js`
- Modify: `tests/tasks.test.mjs`
- Modify: `tests/domain.test.mjs`
- Modify: `tests/study-session.test.mjs`

**Interfaces:**
- `createDailyTask()` returns additive `batchSize`, `batches`, `activeBatchId`, `reviewPoolIds`, and `completedReviewPoolIds` fields.
- `appendNewBatch(task, { words, wordStates, settings, now })` creates one new batch from unseen candidates and returns the updated task or `null`.
- `getBatchReviewIds(task, batchId)` and `getPendingBatchReviewIds(task, batchId)` return ID-only current-batch review candidates.
- `getPendingReviewIds(task)` returns the deduplicated union of pending historical due IDs and pending same-day review-pool IDs.
- `addBatchReviewWords(task, batchId, ids)` updates the shared pool and batch IDs without duplicating IDs.
- `markTaskItemComplete()` recognizes `batch-review` while preserving existing `review`, `new`, and `weak` callers.
- `advanceStudySession(state, { ..., completeTask })` can finish a queue without forcing the whole DailyTask complete when the app is stopping at a batch boundary.

- [x] **Step 1: Write failing tests**

```js
test('creates one batch with the configured size and empty review pool', () => {
  const task = createDailyTask({ words, settings: { dailyNew: 2 }, now: 100 });
  assert.equal(task.batchSize, 2);
  assert.equal(task.batches.length, 1);
  assert.deepEqual(task.batches[0].newWordIds, [0, 1]);
  assert.deepEqual(task.reviewPoolIds, []);
});

test('appends a second batch only when explicitly requested and preserves the first batch', () => {
  const first = createDailyTask({ words, settings: { dailyNew: 2 }, now: 100 });
  const next = appendNewBatch(first, { words, wordStates: { 0: { status: 'reviewing' }, 1: { status: 'reviewing' } }, settings: { dailyNew: 2 }, now: 101 });
  assert.deepEqual(next.batches[0].newWordIds, [0, 1]);
  assert.deepEqual(next.batches[1].newWordIds, [2, 3]);
  assert.equal(next.activeBatchId, next.batches[1].id);
});

test('same-day batch review ids are deduplicated across batches', () => {
  let task = createDailyTask({ words, settings: { dailyNew: 2 }, now: 100 });
  task = addBatchReviewWords(task, task.activeBatchId, [0, 1, 1]);
  task = { ...task, batches: task.batches.map((batch) => ({ ...batch, status: 'complete' })) };
  task = addBatchReviewWords(task, task.activeBatchId, [1, 2]);
  assert.deepEqual(task.reviewPoolIds, [0, 1, 2]);
});

test('review pool completion does not remove the word from historical task data', () => {
  const task = { reviewWordIds: [9], completedReviewIds: [], reviewPoolIds: [1], completedReviewPoolIds: [] };
  assert.deepEqual(getPendingReviewIds(task), [9, 1]);
});

test('batch completion can advance without marking the full task complete', () => {
  const state = {
    queue: [1], queueStages: ['new'], queueIndex: 0, completed: [], sessionReplay: false,
    dailyTask: { reviewWordIds: [], completedReviewIds: [], reviewPoolIds: [1], completedReviewPoolIds: [], newWordIds: [1], completedNewIds: [], weakWordIds: [], completedWeakIds: [], completed: false },
    wordStates: {},
  };
  const result = advanceStudySession(state, { wordId: 1, stage: 'new', sessionMode: 'daily', completeTask: false });
  assert.equal(result.completed, true);
  assert.equal(state.dailyTask.completed, false);
});
```

- [x] **Step 2: Run focused tests and verify the intended failures**

Run: `node --test tests/tasks.test.mjs tests/study-session.test.mjs tests/domain.test.mjs`

Expected: FAIL because batch fields/helpers and the non-completing advance option do not yet exist.

- [x] **Step 3: Implement the smallest helper/state changes**

Add batch creation/appending and ID-only pool helpers to `src/tasks.js`; add additive defaults and migration-safe fields to `src/domain.js`; add the optional `completeTask` switch and `batch-review` task completion path to `src/study-session.js`.

- [x] **Step 4: Run all Node tests**

Run: `npm test`

Expected: PASS, with existing legacy task/session tests still green.

---

### Task 2: Make the app stop at batch completion and support explicit continuation

**Files:**
- Modify: `src/app.js`
- Modify: `src/state.js` only if migration/default state needs a persisted completion field
- Modify: `src/styles.css`
- Add ignored QA script: `work/qa-batch-review.mjs`

**Interfaces:**
- `prepareNextBatch()` prepares only the current batch’s pending historical reviews and new IDs; it never auto-creates a second unseen batch.
- `continueNewBatch()` calls `appendNewBatch()` and is reachable only from an explicit `continue-batch` action.
- `startBatchReviewSession()` uses only `getPendingBatchReviewIds()` and the shared study card.
- `recordResult()` adds vague/unknown new IDs to the active batch review pool immediately.
- Batch completion is persisted as `completionType: 'batch'`; refresh renders the same choice state.

- [x] **Step 1: Add failing browser assertions**

Seed a clean local state with `dailyNew: 3`, complete three new words with one `fuzzy` and one `unknown`, and assert that the fourth unseen word is not rendered until `[data-action="continue-batch"]` is clicked. Assert the completion page contains the batch counts and `复习本组`/`继续背词` actions.

- [x] **Step 2: Run the browser assertion before implementation**

Run: `node work/qa-batch-review.mjs`

Expected: FAIL because the current app has no batch-completion state or explicit continuation action.

- [x] **Step 3: Implement mode-aware queue preparation**

Keep due historical reviews first for normal daily learning, append only the active batch’s new IDs, suppress automatic weak requeue during the batch, and set `completionType: 'batch'` as soon as the active batch’s unique new IDs are all completed.

- [x] **Step 4: Implement batch completion actions and review pool updates**

Render compact counts from the active batch’s rating history; wire `review-batch` to the shared review mode and `continue-batch` to explicit unseen batch creation. Preserve the existing home dual entry and use the current design tokens/classes.

- [x] **Step 5: Run the browser flow**

Run: `node work/qa-batch-review.mjs`

Expected: PASS for 3-word completion, 7-word review pool equivalent, skipped-review persistence, a second explicit batch, and review-mode answer interactions.

---

### Task 3: Deduplicated daily review, statistics, recovery, and regression verification

**Files:**
- Modify: `src/app.js`
- Modify: `src/domain.js` if migration normalization requires it
- Modify: `tests/study-flow.test.mjs`, `tests/state.test.mjs`, `tests/study-session.test.mjs`
- Add ignored QA scripts under `work/`

**Interfaces:**
- Home review count is the deduplicated pending union of historical due reviews and all same-day batch review IDs.
- Batch review completion marks only pool completion, never the full DailyTask or future new batches.
- `uniqueNewWordsToday` counts unique IDs from new-stage history only; review repeats never increase it.
- Existing refresh, login OTP, theme, nav, library, and stable corpus checks remain green.

- [x] **Step 1: Add failing regression tests**

Cover: two weak batches merge to unique IDs; skipping review preserves the pool; reviewing an unknown word as known updates the shared `UserWordState`; repeated review does not increase the unique-new count; migration restores completion and active-batch fields.

- [x] **Step 2: Implement statistics and migration-safe persistence**

Persist only IDs and small batch metadata; update same-day counters from existing history and UserWordState without scanning the full vocabulary on every rating.

- [x] **Step 3: Run full verification**

Run:

```powershell
npm test
npm run build
node work/qa-batch-review.mjs
node work/qa-home-review-viewports.mjs
node C:\Users\xuziyan\.codex\visualizations\2026\09\09\qa-study-interaction.mjs
node work/qa-login-countdown.mjs
node work/qa-login-viewports.mjs
```

Expected: all state tests, build/validator, batch browser flows, original daily flow, login, theme, navigation, and responsive checks pass.

- [x] **Step 4: Check the public deployment**

Confirm `git status` is clean, push the scoped commit, open `https://xzy6526.github.io/shici-cet/`, and record any GitHub Actions API rate-limit limitation separately from browser evidence.
