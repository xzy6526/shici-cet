# CET 考试型轻量单词卡 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 在不改动学习调度算法和 3861 条学习词 ID 的前提下，为学习卡、搜索结果和单词详情增加分层的 CET 词性、义项、语境、搭配与记忆信息。

**Architecture:** 保留 `src/words.js` 的来源快照与稳定 ID，在运行时用一份小型人工复核内容表增量覆盖少量验收词，再由 `normalizeWord()` 统一转换为可选结构化字段。页面只读取当前词条并按评分深度选择内容；没有可靠内容的模块不渲染，未经验证的例句只显示为“示例语境”。

**Tech Stack:** 原生 JavaScript ES modules、CSS、Node `node:test`、现有本地静态服务器。

**Spec:** `C:\Users\xuziyan\.codex\attachments\1d148052-04f0-42d6-9c4d-968370b4c9a6\pasted-text.txt`

## Global Constraints

- 不修改 `src/study-session.js`、调度顺序或评分算法。
- `words.length === 4025`、`studyWords.length === 3861`，现有 ID、队列、收藏和断点续学保持兼容。
- 不新增 UI 框架、动画库、词典依赖或运行时 AI 内容生成。
- `sourceVerified !== true` 的语境禁止显示成真题；当前没有合法可核验真题语料时只显示“示例语境”。
- 新字段全部可空；空模块直接省略，不连续显示“暂无数据”。
- 学习卡一屏优先，详情弹层可自然滚动；动画只使用 `opacity` 与 `transform` 并尊重 reduced motion。
- 当前目录不是 Git 仓库，无法建立 worktree 或提交；所有改动直接发生在用户指定正式项目目录。

---

### Task 1: 结构化词条模型与人工复核样例

**Files:**
- Create: `src/reviewed-word-content.js`
- Modify: `src/domain.js`
- Modify: `src/app.js`
- Test: `tests/domain.test.mjs`
- Test: `tests/content.test.mjs`

**Interfaces:**
- Produces: `withReviewedContent(word): object`
- Produces: normalized `partsOfSpeech`, `meanings`, `primaryMeaning`, `plainExplanation`, `exampleSentences`, `examExamples`, `collocations`, `rareMeanings`, `memoryTip`, `wordFamily`, `synonyms`, `confusableWords`.

- [x] **Step 1: Write failing normalization and compatibility tests**

Assert that a legacy `{ word, meaning }` becomes one structured meaning without losing top-level `meaning`, that multiple parts of speech survive normalization, unverified exam context remains marked unverified, and source/study counts stay exactly `4025/3861`.

- [x] **Step 2: Run the tests and verify RED**

Run: `node --test tests/domain.test.mjs tests/content.test.mjs`

Expected: FAIL because `meanings` are currently strings and reviewed content does not exist.

- [x] **Step 3: Implement the smallest compatible schema**

Keep legacy top-level fields while adding normalized optional structures. Add reviewed, self-authored learning notes for the requested sample words; do not add or relabel any text as real CET exam content.

- [x] **Step 4: Run the tests and verify GREEN**

Run: `node --test tests/domain.test.mjs tests/content.test.mjs`

Expected: PASS with `4025/3861` unchanged.

### Task 2: Content selection and adaptive disclosure

**Files:**
- Create: `src/word-card.js`
- Test: `tests/word-card.test.mjs`

**Interfaces:**
- Produces: `getPrimaryMeaning(word)`
- Produces: `getPartOfSpeechLabels(word)`
- Produces: `getPreferredContext(word)`
- Produces: `getAnswerContent(word, { rating, expanded, stage, wordState, targetScore })`

- [x] **Step 1: Write failing selector tests**

Cover: CET-priority meaning wins; a verified exam example is preferred and keeps exam/year/month/section; an unverified exam example falls back to an ordinary example; known/fuzzy/unknown expose progressively deeper sections; empty fields produce no empty sections; recommendation reasons reflect review/weak/mistake/new state.

- [x] **Step 2: Run the test and verify RED**

Run: `node --test tests/word-card.test.mjs`

Expected: FAIL because `src/word-card.js` does not exist.

- [x] **Step 3: Implement pure selectors**

Use direct property reads on the current normalized word. Limit default context to one and default collocations to two. Keep additional meanings, contexts, family, roots, synonyms and confusables behind `expanded`.

- [x] **Step 4: Run the test and verify GREEN**

Run: `node --test tests/word-card.test.mjs`

Expected: PASS.

### Task 3: Study card, search result and detail UI

**Files:**
- Modify: `src/app.js`
- Modify: `src/styles.css`
- Test: `tests/word-card.test.mjs`

**Interfaces:**
- Consumes: Task 2 selectors.
- Produces: unchanged study actions `rate-unknown`, `rate-fuzzy`, `rate-known`, `next`, `undo`, plus accessible local `more` disclosure.

- [x] **Step 1: Add a failing presentation contract test**

Assert returned content for unrevealed state contains only word-supporting metadata, and answer content labels unverified material “示例语境” while verified provenance is formatted `CET-4 · YYYY.MM · Section`.

- [x] **Step 2: Verify RED**

Run: `node --test tests/word-card.test.mjs`

- [x] **Step 3: Apply the minimal UI diff**

Show POS and at most two CET tags before reveal. After reveal, render core meaning first, then one context, then only rating-appropriate explanation/collocation/memory/mistake blocks. Keep expanded details mounted and toggle them locally with `aria-expanded`/`aria-controls`, so existing answer sections do not replay animations. Upgrade library rows and the existing detail sheet without adding routes or navigation.

- [x] **Step 4: Add focused CSS**

Reuse current tokens and radii. Make the detail sheet scrollable, preserve the fixed next action and safe area, use staggered `opacity/translateY` only, and keep all new controls keyboard visible.

- [x] **Step 5: Run focused and full tests**

Run: `npm test`

Expected: all existing and new tests pass.

### Task 4: Documentation and rendered regression

**Files:**
- Modify: `README.md`
- Create: `docs/内容数据边界.md`

- [x] **Step 1: Record content provenance**

Document which fields come from the licensed source, which sample notes are project-authored, and that there are currently zero production examples labeled as verified CET questions.

- [x] **Step 2: Run static verification**

Run: `node --check src/app.js; node --check src/domain.js; node --check src/word-card.js; npm test`

- [x] **Step 3: Run rendered checks**

Open `http://127.0.0.1:5173/` in available Edge/Playwright tooling. Verify unrevealed → each rating → expanded → next; detail sheet; search; light/dark; 320, 375, 390 and 430 px; no console errors; `4025/3861` still displayed.

- [x] **Step 4: Handle absent build command honestly**

This project is served directly by `server.mjs` and has no bundling step. Report `npm run build` as “not configured”, and use syntax checks plus HTTP 200/static-browser verification instead of inventing a build success.

