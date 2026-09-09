# Home Study / Review Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add a clear home-page “背单词 / 复习” pair while reusing the existing study engine and shared DailyTask/UserWordState data.

**Architecture:** Keep one `Study Session` queue engine. Add a persisted `sessionMode` (`daily` or `review`) to choose whether the active queue contains the normal pending DailyTask sequence or only pending review IDs. Review mode updates the same `completedReviewIds` and word states, then reaches a review-specific completion screen without marking the whole DailyTask complete.

**Tech Stack:** Vanilla ES modules, Node’s built-in test runner, existing CSS tokens and browser-native DOM events.

**Spec:** `C:\Users\xuziyan\.codex\attachments\e74812e4-8a70-4fe0-8594-1b442b05d89d\pasted-text.txt`

## Global Constraints

- Keep the existing iOS 18 visual language, responsive layout, theme tokens, animations, and button components.
- Do not duplicate `study-session.js` or create a separate review page/engine.
- Normal DailyTask order remains review → new → weak; review mode never adds unseen words.
- Preserve shared `DailyTask`, `UserWordState`, local persistence, refresh recovery, and the stable 4025/3861 vocabulary behavior.
- Do not modify the recently fixed login OTP countdown unless a test proves an interaction dependency.

---

### Task 1: Add tested task/session mode primitives

**Files:**
- Modify: `src/tasks.js`
- Modify: `src/study-session.js`
- Modify: `src/domain.js`
- Test: `tests/tasks.test.mjs`, `tests/study-session.test.mjs`, `tests/domain.test.mjs`

**Interfaces:**
- Produces `getPendingReviewIds(task)` returning an array of review IDs not present in `task.completedReviewIds`.
- `advanceStudySession(state, { wordId, stage, sessionMode })` keeps review-mode completion separate from full DailyTask completion.
- Persisted state accepts `sessionMode: null | 'daily' | 'review'`.

- [x] **Step 1: Write the failing tests**

```js
test('pending review ids exclude completed review ids', () => {
  const task = { reviewWordIds: [1, 2, 3], completedReviewIds: [2] };
  assert.deepEqual(getPendingReviewIds(task), [1, 3]);
});

test('review mode completes its queue without completing the full daily task', () => {
  const state = {
    queue: [1], queueStages: ['review'], queueIndex: 0, completed: [],
    dailyTask: { reviewWordIds: [1], completedReviewIds: [], newWordIds: [2], completedNewIds: [], weakWordIds: [], completedWeakIds: [], completed: false },
    wordStates: {}, sessionReplay: false,
  };
  const result = advanceStudySession(state, { wordId: 1, stage: 'review', sessionMode: 'review' });
  assert.equal(result.completed, true);
  assert.deepEqual(state.dailyTask.completedReviewIds, [1]);
  assert.equal(state.dailyTask.completed, false);
});
```

- [x] **Step 2: Run the focused tests and verify they fail**

Run: `npm test -- --test-name-pattern="pending review ids|review mode completes"`

Expected: FAIL because the review pending helper is missing and the existing advance function marks the whole DailyTask complete.

- [x] **Step 3: Implement the minimal primitives**

```js
export function getPendingReviewIds(task) {
  const completed = new Set(task?.completedReviewIds || []);
  return (task?.reviewWordIds || []).filter((id) => !completed.has(id));
}
```

Add `sessionMode: null` to the initial state and normalize it in `migrateState`. In `advanceStudySession`, pass through the existing task completion update, but only force `dailyTask.completed = true` for non-review sessions.

- [x] **Step 4: Run all state/task/session tests**

Run: `npm test -- --test-name-pattern="task|session|state|review"`

Expected: PASS, including the pre-existing normal daily flow tests.

- [x] **Step 5: Commit**

```bash
git add src/tasks.js src/study-session.js src/domain.js tests/tasks.test.mjs tests/study-session.test.mjs tests/domain.test.mjs
git commit -m "Add shared review session primitives"
```

### Task 2: Add home dual entry and mode-aware queue preparation

**Files:**
- Modify: `src/app.js`
- Modify: `src/styles.css`
- Test: browser QA script under `work/qa-home-review.mjs` (ignored temporary test)

**Interfaces:**
- `startSession()` enters/resumes `sessionMode: 'daily'` using the existing pending DailyTask queue.
- `startReviewSession()` enters/resumes `sessionMode: 'review'` using only `getPendingReviewIds(state.dailyTask)`.
- Home renders two equal touch targets: `data-action="start"` and `data-action="start-review"`.

- [x] **Step 1: Write the failing browser assertions**

```js
await page.locator('[data-action="profile"]');
await page.locator('[data-action="home"]');
await expect(page.locator('[data-action="start"]')).toHaveCount(1);
await expect(page.locator('[data-action="start-review"]')).toHaveCount(1);
```

Seed one due review in local state, reload, and assert the review button contains the real pending count. Seed no due reviews and assert the review button is disabled.

- [x] **Step 2: Run the browser assertions before implementation**

Run: `node work/qa-home-review.mjs`

Expected: FAIL because the home page currently has only `data-action="start"`.

- [x] **Step 3: Implement minimal mode-aware entry logic**

Use `getPendingReviewIds` to build a review-only queue, preserve the existing queue when the same mode is resumed, and rebuild from the shared task when switching modes. Keep `state.wordStates` and `state.dailyTask` untouched as the shared source of truth.

- [x] **Step 4: Implement the two-button home layout**

Add a compact `.today-actions` grid that reuses `.primary-button` for normal learning and `.secondary-button` for review. Show dynamic labels for start/continue/completed and disable review when no pending IDs exist. Keep all colors, radii, spacing tokens, and pressed/focus states from the existing design system.

- [x] **Step 5: Run browser smoke checks**

Run: `node work/qa-home-review.mjs`

Expected: PASS for desktop and 390×844 mobile, including real review counts and empty review state.

- [x] **Step 6: Commit**

```bash
git add src/app.js src/styles.css
git commit -m "Add home study and review entries"
```

### Task 3: Review completion, recovery, and regression validation

**Files:**
- Modify: `src/app.js`
- Test: `work/qa-home-review.mjs`, `work/qa-home-review-refresh.mjs` (ignored temporary tests)

**Interfaces:**
- Study topbar labels review sessions as “今日复习”.
- Review completion renders “今日复习完成” and returns home without forcing new words.
- A normal entry after review completion consumes the same `completedReviewIds` and starts remaining new/weak work.

- [x] **Step 1: Extend browser tests for review flows**

Cover: enter review, rate/advance at least 10 words, return home, verify the count drops; refresh during review and verify the same word/index; complete review and verify no automatic new-word transition; then start normal study and verify no completed review ID repeats.

- [x] **Step 2: Run the extended tests and verify any failures**

Run: `node work/qa-home-review.mjs`

Expected before completion handling: FAIL if the existing completion screen says only “今日完成” or forces DailyTask completion.

- [x] **Step 3: Implement review-aware presentation and recovery**

Use the existing `renderStudy`/`renderComplete` components with mode conditionals only. Keep queue/index persistence through `persistRender()`, and preserve the existing login, library, theme, and navigation behavior.

- [x] **Step 4: Run the complete verification set**

Run:
```powershell
npm test
npm run build
node work/qa-home-review.mjs
node work/qa-home-review-refresh.mjs
```

Expected: all Node tests pass, build succeeds, desktop 1440×900 and mobile 390×844 flows pass, Light/Dark mode keeps both entries usable, and the original daily flow remains intact.

- [x] **Step 5: Commit**

```bash
git add src/app.js src/styles.css tests
git commit -m "Verify review mode recovery and completion"
```


