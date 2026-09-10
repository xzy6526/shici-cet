# Adaptive Learning Phase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a short adaptive CET-4 vocabulary assessment that produces a local vocabulary profile, a stable personal learning order, and a smoothly adjusted daily recommendation without changing the existing review or batch mechanics.

**Architecture:** Keep assessment and personal planning as two pure modules. Persist their outputs in the existing local state, let the current daily-task generator consume a pre-ranked candidate list and recommended batch size, and keep `study-session.js` unchanged. `app.js` only renders and coordinates the new flow.

**Tech Stack:** Browser-native ES modules, localStorage through the existing state layer, Node test runner, existing CSS design tokens, Playwright Chromium for E2E.

**Spec:** `C:\Users\xuziyan\.codex\attachments\be0fb691-bede-462f-a9d5-d16dc375f6a6\pasted-text.txt`

## Global Constraints

- Preserve Full Vocabulary = 4025 and Study Pool = 3861.
- Assessment answers never set a word to `mastered`.
- Existing review priority, weak queue, batch completion, and explicit “continue learning” remain unchanged.
- Study remains Local First and does not wait for cloud sync.
- Use a stable user/date seed; never reshuffle an existing assessment or daily task after refresh.
- Light, Dark, System, reduced motion, keyboard focus, and mobile layouts must remain supported.
- Add no new runtime dependency.

---

### Task 1: Adaptive assessment engine

**Files:**
- Create: `src/assessment.js`
- Create: `tests/assessment.test.mjs`

**Interfaces:**
- Produces: `buildAssessmentPool(words)`, `createAssessmentState(options)`, `getAssessmentQuestion(state, pool)`, `answerAssessment(state, choiceIndex, pool, now)`, `createVocabularyProfile(state, now)`, `applyAssessmentToWordStates(wordStates, state, now)`.
- Assessment state persists its seed, answers, tested IDs, current question, estimated level, confidence, and completion status.

- [x] Write tests that prove a new assessment starts at level 3, never repeats a word, rises after correct answers, falls after wrong answers, stops by the maximum, can stop early when stable, resumes from serialized state, and never marks a correct answer mastered.
- [x] Run `node --test tests/assessment.test.mjs` and confirm failures are caused by the missing module.
- [x] Implement the smallest deterministic five-band engine, reliable pool filter, same-part-of-speech distractors, profile calculation, and word-state evidence update.
- [x] Run `node --test tests/assessment.test.mjs` and confirm PASS.

### Task 2: Personal plan and adaptive quota

**Files:**
- Create: `src/personal-plan.js`
- Create: `tests/personal-plan.test.mjs`
- Modify: `src/repository.js`
- Modify: `src/tasks.js`

**Interfaces:**
- Produces: `scoreLearningPriority(word, wordState, context)`, `createPersonalLearningPool(options)`, `recommendDailyQuota(options)`.
- `getNewWordCandidates(words, wordStates, settings, context)` delegates ranking to the personal pool.
- `createDailyTask` receives `settings.dailyNew` already resolved to the recommended first-batch size and retains its same-day task unchanged.

- [x] Write tests for differing profiles, high-importance weak words, mastered/hidden exclusion, mistake weighting, same-seed stability, high review pressure, recent success/failure, smooth quota bounds, and three learning intensities.
- [x] Run the new tests and confirm expected failures.
- [x] Implement priority scoring, ten-point bucket shuffle with a stable hash, and quota adjustment capped to five words per day.
- [x] Run personal-plan, repository, and task tests and confirm PASS.

### Task 3: Persisted state and old-user migration

**Files:**
- Modify: `src/domain.js`
- Modify: `src/state.js`
- Modify: `tests/state.test.mjs`

**Interfaces:**
- State adds `assessment`, `vocabularyProfile`, and `adaptivePlan`.
- Settings add `learningIntensity` with `relaxed`, `standard`, or `intensive`.
- Old users with real study history derive an initial profile and are never blocked by onboarding.

- [x] Write migration tests for fresh users, assessment resume, valid intensity, old-user bypass, and preservation of existing `UserWordState`.
- [x] Run state tests and confirm expected failures.
- [x] Bump the schema, normalize the new fields, preserve old state, and extend settings updates without rebuilding an active task.
- [x] Run state and storage tests and confirm PASS.

### Task 4: Assessment, results, settings, and home integration

**Files:**
- Modify: `src/app.js`
- Modify: `src/styles.css`
- Create: `tests/adaptive-learning.e2e.mjs`

**Interfaces:**
- New internal screens: `assessment-intro`, `assessment`, `assessment-result`.
- Stable selectors: `data-assessment-start`, `data-assessment-choice`, `data-assessment-next`, `data-assessment-skip`, `data-assessment-finish`.
- Home shows recommended reviews/new words and one mapped explanation; settings expose learning intensity and re-test.

- [x] Add an E2E test for fresh setup → full assessment → result → home → start study, plus refresh-resume and old-user bypass.
- [x] Run it first and confirm the missing assessment UI fails.
- [x] Add the minimum render/action code and theme-token-based styles; persist after every answer and never show live estimated vocabulary during the test.
- [x] Run the E2E at mobile and desktop widths and confirm PASS.

### Task 5: Full regression and delivery

**Files:**
- Modify: `README.md`

**Interfaces:**
- Documents assessment length/pool size, profile, personal ordering, quota, migration, and verification evidence.

- [x] Run `npm test`.
- [x] Run `npm run build` and verify generated vocabulary counts remain 4025 / 3861.
- [x] Run existing browser regression plus the adaptive E2E in Light, Dark, reduced-motion, 390px, and desktop.
- [x] Update README with only verified outcomes and known limitations.
- [x] Review `git diff`, ensure no unrelated changes, then commit and deploy through the existing GitHub Pages workflow.
