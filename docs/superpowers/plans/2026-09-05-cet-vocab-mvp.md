# CET 背词可用 MVP 与发音系统实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在保留现有 UI、主题和底部导航的前提下，让本地 CET-4 网站具备真实的每日任务、复习调度、断点续学、学习记录、收藏/错词/隐藏，以及可切换 UK/US 的基础发音能力。

**Architecture:** 继续使用当前 vanilla ES modules 与原生 DOM，不重写 `app.js`。新增纯逻辑 domain 模块、统一 storage/repository 边界、独立 scheduler/task generator 与 PronunciationService；`app.js` 只负责把状态映射为现有页面，并通过最小事件处理接入业务。旧版状态在加载时迁移，保留已有 `queue`、`completed` 等字段兼容现有页面和本地数据。

**Tech Stack:** 原生 JavaScript ES modules、LocalStorage（带 schemaVersion 与迁移）、浏览器 SpeechSynthesis fallback、Node `node:test`、现有静态服务器与 Playwright。

**Spec:** `需求说明.md`、本次用户附加需求的两份 pasted-text 文档。

**Implementation status (2026-09-05):** Task 1–4 的领域逻辑与测试已完成；Task 5–7 已完成可用的本地学习闭环、收藏/错词/隐藏、词库详情和 UK/US 发音首版。完整 4025 条 IPA 与真人音频仍等待有明确许可和可追溯来源的数据导入。

## Global Constraints

- 保持 Mobile First、iOS 18、Light/Dark 跟随系统、底部单一滑动胶囊与可中断动画。
- 背词有效性 ＞ 流畅度 ＞ 简单易用 ＞ UI 美观 ＞ 附加功能。
- 不接真实短信、云同步、社区、排行榜或复杂数据大屏。
- 本地数据不依赖网络；写入失败时保留内存状态并显示可理解提示。
- 未核验的音标、例句、真题出处不能伪装成正式内容；缺失字段显示“待补充”。
- 学习页首次只显示英文、当前发音体系音标和三档认识程度；选择后才显示答案。
- 所有新交互保留键盘焦点、aria-label、44px 触控目标和 reduced-motion 降级。

### Task 1: 建立可迁移的 Word/UserWordState 数据模型

**Files:** Create `src/domain.js`; modify `src/state.js`; test `tests/domain.test.mjs` and `tests/state.test.mjs`.

**Interfaces:** `createUserWordState(wordId, now)`, `normalizeWord(word)`, `migrateState(saved, words, now)`, `createInitialState(words, now)`.

- [ ] 写默认状态、音标字段、schemaVersion 与旧队列迁移测试。
- [ ] 运行 focused tests 确认新接口失败。
- [ ] 实现模型和迁移，保留旧 renderer 使用的队列字段。
- [ ] 运行 focused tests 与完整 `npm test`。

### Task 2: 统一本地 Storage 与 WordRepository

**Files:** Create `src/storage.js` and `src/repository.js`; modify `src/state.js` and `src/app.js`; test `tests/storage.test.mjs` and `tests/repository.test.mjs`.

**Interfaces:** `createStorage`, `loadAppData`, `saveAppData`, `getWordById`, `searchWords`, `getNewWordCandidates`, `getReviewCandidates`。

- [ ] 覆盖损坏 JSON、schema migration、精确/前缀搜索、隐藏排除和到期排序。
- [ ] 实现安全 storage adapter 与 repository，迁移导入词和收藏，不清空旧数据。
- [ ] 将 app 的学习状态写入统一边界并运行完整测试。

### Task 3: DailyTaskGenerator 与日期/streak 纯逻辑

**Files:** Create `src/tasks.js`; test `tests/tasks.test.mjs`.

**Interfaces:** `dateKey`, `daysUntilExam`, `calculateStreak`, `createDailyTask`。

- [ ] 覆盖本地日期边界、无效考试日期、连续学习、断档和 review → new → weak 顺序。
- [ ] 实现日期纯函数与确定性任务生成，排除 hidden。
- [ ] 运行 focused/full tests。

### Task 4: ReviewScheduler V1

**Files:** Create `src/scheduler.js`; test `tests/scheduler.test.mjs`.

**Interfaces:** `scheduleReview`, `buildWeakRequeue`, `isMastered`。

- [ ] 验证 again、hard、good 的间隔、nextReviewAt、streak、difficulty、lapses 差异。
- [ ] 实现有边界的 SM-2-inspired V1，不引入第三方依赖。
- [ ] 运行完整测试。

### Task 5: 接通真实每日学习闭环与断点续学

**Files:** Modify `src/app.js`, `src/state.js`, `src/styles.css`; test `tests/study-flow.test.mjs`.

**Interfaces:** `ensureDailyTask`, `rateWord`, `nextWord`, `persistProgress`。

- [ ] 覆盖 review-first、新词上限、weak requeue、完成和刷新恢复。
- [ ] 启动时加载/生成任务，把当前 stage 映射到现有 queue，每次反馈立即保存。
- [ ] 用任务和历史数据替换完成页硬编码统计。
- [ ] 验证桌面与 390px 手机闭环。

### Task 6: 收藏、错词、隐藏与可用词库筛选

**Files:** Modify `src/app.js`, `src/repository.js`, `src/styles.css`; extend repository and study-flow tests.

**Interfaces:** `toggleFavorite`, `toggleHidden`, `getMistakeWords`, `getFavoriteWords`。

- [ ] 验证收藏不改变调度、错词由状态生成、隐藏排除和恢复。
- [ ] 将操作写入 UserWordState，不复制 Word 数据。
- [ ] 让词库搜索/筛选显示学习状态、收藏、错词、频率和分类。
- [ ] 将个人中心收藏/隐藏占位入口替换为实际视图或空状态。

### Task 7: UK/US 音标数据边界与 PronunciationService

**Files:** Create `src/pronunciation.js` and `src/pronunciation-data.js`; modify `src/app.js`, `src/state.js`, `src/styles.css`; test `tests/pronunciation.test.mjs`.

**Interfaces:** `getPhonetic`, `PronunciationService.play`, `PronunciationService.stop`, `PronunciationService.preload`。

- [ ] 验证 accent 选择、字段对应、播放前取消和 speech fallback。
- [ ] 实现 UK/US voice 选择与 fallback，禁止音频重叠，不依赖网络。
- [ ] 仅加入有可靠来源的验收样例发音；其余缺失字段明确显示待补充，不猜 IPA。
- [ ] 在设置中加入 segmented control，背词页直接显示所选音标，详情/搜索保留两套信息。
- [ ] 验证设置持久化、快速播放、主题可读性和手机换行。

### Task 8: 异常、性能与文档验收

**Files:** Modify `README.md` and this plan; create `tests/acceptance.test.mjs`.

- [ ] 覆盖损坏 storage、缺失 Word ID、空队列、非法设置、刷新恢复和第二天复习。
- [ ] 运行 `node --check src/*.js`、`npm test` 和浏览器 smoke flow。
- [ ] 测量 390px 与桌面路由处理、RAF 间隔、列表渲染和控制台错误。
- [ ] README 记录真实实现、Mock 数据、测试词数、风险和下一步。
- [ ] 真实设备音频与长时性能没有测量时，明确标记为尚未验证。
