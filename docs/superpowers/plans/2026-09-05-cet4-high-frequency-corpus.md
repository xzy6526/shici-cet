# CET-4 高频词库接入实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将已核验来源中的 CET-4 高频词条接入网站，同时保留来源快照、许可说明和可复现的筛选规则。

**Architecture:** 保留 `exam-data/CETVocabulary` 的原始 JSON 快照，按照 `序号 <= 2104` 且 `六级` 为空筛出 2081 条 CET-4 高频词，生成网站使用的 `src/words.js`。由于该数据源只提供词、释义、频率和分类，页面对缺失音标、例句和出处做明确降级，不生成伪造内容；学习状态按 `dailyNew` 分批进入队列，避免把 2081 条词一次塞进今日学习。

**Tech Stack:** Node.js、原生 ES modules、浏览器 `localStorage`、Python 标准库脚本（仅用于一次性转换数据）。

**Spec:** `需求说明.md`、`docs/项目立项.md`、`README.md`

## Global Constraints

- 高频定义采用来源仓库声明的前 2104 条、出现频率不低于 40 次的排序区间；再过滤 `六级` 标记，只保留 CET-4。
- 词汇数据按 CC BY-NC-SA 4.0 使用；项目必须保留来源 URL、版本 Commit、SHA-256、筛选规则和非商业限制说明。
- 未获得可靠出处的例句、音标和真题内容不得伪造或标记为真题。
- 首版不新增运行时依赖；学习进度继续使用本地 `localStorage`。
- 每日学习仍以设置中的 `dailyNew` 为上限，完整词库只作为可持续的后续批次。

---

### Task 1: 保存来源快照与许可记录

**Files:**
- Create: `data/cet_full_list.source.json`
- Create: `docs/词库来源.md`

**Interfaces:**
- Consumes: `https://raw.githubusercontent.com/exam-data/CETVocabulary/main/cet_full_list.json`
- Produces: 原始数据快照、来源仓库链接、Commit、SHA-256、CC BY-NC-SA 4.0 说明和 2081 条筛选规则。

- [x] **Step 1: Move the downloaded source snapshot**

将当前临时下载文件改名为 `data/cet_full_list.source.json`，不修改内容。

- [x] **Step 2: Verify the snapshot shape**

运行 Python 标准库脚本，断言顶层数组长度为 5278、字段包含 `序号`、`词频`、`六级`、`单词`、`释义`，并输出 SHA-256。

- [x] **Step 3: Write the attribution record**

在 `docs/词库来源.md` 记录来源仓库、Raw URL、Commit `6bd3fcb521ce3767ad612cc9160ef56f2cd9b26a`、快照哈希、筛选结果 2081 条、CC BY-NC-SA 4.0 的署名/非商业/相同方式共享要求，并注明例句、音标和真题出处不来自该快照。

- [x] **Step 4: Run the source verification**

运行 `node --test tests/content.test.mjs` 前先用 Python 输出源数据计数；预期原始 5278、CET-4 4025、高频 CET-4 2081。

### Task 2: 生成网站词条模块

**Files:**
- Modify: `src/words.js`
- Create: `scripts/build-cet4-words.mjs`（运行后保留，供后续更新）

**Interfaces:**
- Consumes: `data/cet_full_list.source.json`
- Produces: `words`（2081 条），每条包含 `id`、`word`、`meaning`、`frequencyRank`、`frequency`、`category`、`subcategory`、`variants`、`exam` 以及空的可选内容字段。

- [x] **Step 1: Write the data contract test**

断言词条数量为 2081、ID 唯一连续、`exam === 'CET-4'`、`frequencyRank <= 2104`、`frequency >= 40`，并断言没有 `六级` 标记。

- [x] **Step 2: Implement the one-shot generator**

脚本读取 JSON，过滤 `六级 == null && 序号 <= 2104`，将中文字段映射到稳定的英文字段，按来源序号排序并输出 `src/words.js`；`example`、`translation`、`collocation`、`pitfall`、`extended` 和 `phonetic` 保留为空字符串。

- [x] **Step 3: Generate and inspect**

运行 `node scripts/build-cet4-words.mjs`，检查首条、末条、总数和三个代表词条，确认中文释义没有被脚本改写。

- [x] **Step 4: Run content tests**

运行 `npm test`，预期内容与状态测试全部通过。

### Task 3: 让学习队列按每日新词分批运行

**Files:**
- Modify: `src/state.js`
- Modify: `src/app.js`
- Modify: `tests/state.test.mjs`

**Interfaces:**
- Consumes: `words` 和 `settings.dailyNew`
- Produces: `newCursor`、按批次生成的 `queue`，以及完成当前批次后进入下一批次的 `startSession()`。

- [x] **Step 1: Add the batching test**

用 25 条样本和 `dailyNew=20` 断言初始队列为 20 条、`newCursor === 20`；用 5 条样本断言队列只包含 5 条。

- [x] **Step 2: Implement bounded initial state**

将 `createInitialState(words)` 的队列限制为首个 `dailyNew` 批次，并保存 `newCursor`；词库增长不改变单日学习上限。

- [x] **Step 3: Implement the next batch transition**

完成页点击再次开始时，从 `newCursor` 取下一批词并清空当前批次的 `completed`；全部词完成后回到首批，保留“再看一遍”的行为。

- [x] **Step 4: Bump the storage key**

将状态 key 从 `shici-cet-state-v1` 升为 `shici-cet-state-v2`，避免旧 20 词示例队列与新词库 ID 恢复到错误位置。

- [x] **Step 5: Run state tests**

运行 `node --test tests/state.test.mjs`，预期队列分批、恢复和默认设置测试通过。

### Task 4: 缺失内容的安全展示

**Files:**
- Modify: `src/app.js`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: 词条的 `frequencyRank`、`frequency`、`category` 和可能为空的内容字段。
- Produces: 无音标时的朗读提示、词频来源信息、无例句时的待补说明，不出现“真题例句”伪标记。

- [x] **Step 1: Add fallback rendering**

只有字段有值时才渲染例句、翻译、搭配和易错点；没有例句时显示“该来源未提供例句与真题出处”。

- [x] **Step 2: Add source metadata**

在答案区域展示来源排名和出现频次，帮助用户理解“高频”依据。

- [x] **Step 3: Keep mobile layout readable**

为来源说明和元信息补充窄屏样式，不改变现有学习卡片层级。

- [x] **Step 4: Run browser smoke checks**

启动 `npm start`，验证首页显示每日 20 个新词，首词能朗读、选择认识程度并看到词义与频率说明，刷新后仍在当前批次。

### Task 5: 更新文档并完成验收

**Files:**
- Modify: `README.md`
- Modify: `docs/项目立项.md`
- Modify: `docs/superpowers/plans/2026-09-05-cet4-high-frequency-corpus.md`

**Interfaces:**
- Consumes: 来源核验输出、测试结果和浏览器检查结果。
- Produces: 可追溯的词库接入记录和明确的剩余限制。

- [x] **Step 1: Record the new corpus status**

把项目状态从“示例词条”更新为“2081 条来源可追溯的 CET-4 高频词”；保留“例句/音标/真题出处待补”和 CC BY-NC-SA 非商业限制。

- [x] **Step 2: Mark only verified plan steps**

完成每项实际执行的复选框，不把未做的真实设备、商业发布或版权复核标成完成。

- [x] **Step 3: Run the full verification**

依次运行 `npm test`、本地 HTTP 检查和 Playwright 核心流程；预期测试通过、HTTP 200、桌面/390×844 学习流程可用。

## 范围更新（2026-09-05）

为解决词库范围过窄的问题，默认生成范围已从“排名前 2104 的高频子集”扩展为来源快照中全部 `六级` 为空的 CET-4 条目：词库 4025 条，排除功能词后的核心学习词 3861 条。每日学习仍由 `dailyNew` 控制，不会一次加载全部词条进入学习队列。
