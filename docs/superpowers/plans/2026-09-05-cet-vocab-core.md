# CET 四六级背单词核心页面 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在本地优先的移动端优先 Web 应用中完成首页、背词未揭晓、答案展开和今日完成四个可交互状态。

**Architecture:** 使用现有 Node 原生静态服务器提供页面；使用原生 HTML、CSS 和 ES modules 组成小型 app shell。词条内容由 `src/words.js` 提供，学习状态由单一状态对象管理并写入 `localStorage`，页面只负责渲染和派发用户操作。

**Tech Stack:** Node.js、原生 HTML、CSS、JavaScript ES modules、Web Speech API、localStorage；首版不新增运行时依赖。

**Spec:** `需求说明.md` 与 `docs/项目立项.md`

## Global Constraints

- 核心不是做全科备考平台，而是：**简单、高效、流畅地背单词。**
- 每日固定流程：打开网站 → 开始背词 → 先完成今日到期复习 → 再学习今日新词 → 今日完成。
- 新词第一次出现时只显示英文单词、发音按钮和“不认识 / 模糊 / 认识”。
- 用户选择后再展开答案，用户主动点击“下一个”，不要自动跳词。
- 视觉重点永远是：**开始背词**。
- 核心交互以 60 FPS 为最低标准；每完成一个词立即保存进度。
- 必须支持 Mobile First、桌面端、浅色 / 深色跟随系统和 `prefers-reduced-motion`。
- 第一版不要做账号系统、云同步、复杂游戏化、独立数据页和完整离线系统。
- 当前词条是交互示例，未核验的例句和出处不得标记为真题。

---

### Task 1: 建立页面入口与共享状态

**Files:**
- Create: `index.html`
- Create: `src/app.js`
- Create: `src/state.js`
- Create: `src/styles.css`
- Modify: `server.mjs` only if the current static handler cannot serve `index.html`

**Interfaces:**
- Consumes: `words` from `src/words.js`
- Produces: `createInitialState(words)`, `loadState(words)`, `saveState(state)`, `renderApp(state)`

- [x] **Step 1: Write the state check**

在 `tests/state.test.mjs` 中调用 `createInitialState([{id: 0, word: 'approach'}])`，断言 `screen === 'home'`、`queueIndex === 0` 且队列包含该词。

- [x] **Step 2: Run the state check**

Run: `node --test tests/state.test.mjs`

Expected: 当前函数尚未存在时失败。

- [x] **Step 3: Implement the minimum state module**

`createInitialState(words)` 返回 `{screen:'home', queue:words.map(word => word.id), queueIndex:0, revealed:false, rating:null, completed:[], favorites:[], settings:{exam:'CET-4', targetScore:550, dailyNew:20}}`；`loadState` 读取固定 key，解析失败时回退到初始状态；`saveState` 立即写入同一 key。

- [x] **Step 4: Add the app shell**

`index.html` 只保留语义化根节点和 `src/app.js` 模块入口；`renderApp(state)` 根据 `state.screen` 选择首页、学习页或完成页容器。

- [x] **Step 5: Run the state check again**

Run: `node --test tests/state.test.mjs`

Expected: PASS。

### Task 2: 实现首页与进入学习

**Files:**
- Modify: `src/app.js`
- Modify: `src/styles.css`
- Modify: `src/state.js`
- Test: `tests/state.test.mjs`

**Interfaces:**
- Consumes: `loadState`, `saveState`, `renderApp`
- Produces: `startSession()`, `goHome()`, home button with accessible name `开始背词`

- [x] **Step 1: Add the home transition check**

扩展 `tests/state.test.mjs`：调用 `startSession` 后断言 `screen === 'study'`、`queueIndex === 0`，再调用 `goHome` 断言回到 `screen === 'home'`。

- [x] **Step 2: Implement home content**

首页只渲染 CET-4、目标分数、考试倒计时、今日复习 / 新词数量、`开始背词` 主按钮、已掌握和连续学习天数，以及底部“首页 / 词库”导航和设置入口。

- [x] **Step 3: Implement the transition**

主按钮事件先更新状态并调用 `saveState`，再渲染学习页；过渡只使用 class 加 `transform` / `opacity`，不等待动画结束才接受下一次用户操作。

- [x] **Step 4: Run the check**

Run: `node --test tests/state.test.mjs`

Expected: PASS。

### Task 3: 实现未揭晓、答案展开与切词

**Files:**
- Modify: `src/app.js`
- Modify: `src/styles.css`
- Modify: `src/state.js`
- Test: `tests/state.test.mjs`

**Interfaces:**
- Consumes: `state.queue[state.queueIndex]` 与当前词条
- Produces: `rateWord(rating)`, `nextWord()`, `undoLast()`, `toggleFavorite()`

- [x] **Step 1: Add the reveal check**

断言初始 `revealed === false`；调用 `rateWord('fuzzy')` 后断言 `revealed === true`、`rating === 'fuzzy'`，并且 `saveState` 接收到更新后的状态。

- [x] **Step 2: Implement rating and progressive sections**

`rateWord(rating)` 只接受 `unknown | fuzzy | known`，记录结果并显示对应字段：unknown 显示释义、示例、翻译、搭配、易错点和熟词僻义；fuzzy 显示核心释义、示例和考点；known 只显示核心释义与确认信息。示例区域固定展示“示例例句 · 非真题”。

- [x] **Step 3: Implement next and undo**

`nextWord()` 先把当前词加入 `completed`、递增 `queueIndex` 并保存；到达队列末尾时设置 `screen:'complete'`。`undoLast()` 只恢复最近一次切词前的快照，恢复后立即渲染。

- [x] **Step 4: Implement audio and favorite**

发音按钮调用 `window.speechSynthesis`（不存在时只保持按钮可用，不抛异常）；收藏按钮切换 `favorites` 并保存；所有按钮使用真实 `<button>` 元素和可见焦点。

- [x] **Step 5: Run the check**

Run: `node --test tests/state.test.mjs`

Expected: PASS。

### Task 4: 今日完成页、响应式和无障碍

**Files:**
- Modify: `src/app.js`
- Modify: `src/styles.css`
- Test: `tests/state.test.mjs`

**Interfaces:**
- Consumes: `screen:'complete'` 与 `completed.length`
- Produces: `goHome()`，完成页返回首页按钮和可见的完成数量

- [x] **Step 1: Add the completion check**

断言最后一个词调用 `nextWord()` 后 `screen === 'complete'`，完成页显示 `completed.length`，调用 `goHome()` 后恢复首页。

- [x] **Step 2: Implement completion UI**

完成页展示圆形描边、勾号、`今日完成`、短反馈、学习新词数、完成复习数和 `返回首页`；圆形动画只改变 `transform` / `opacity`，并在减少动态效果时退化为淡入。

- [x] **Step 3: Add responsive and system themes**

CSS 使用窄屏优先布局；桌面端限制内容最大宽度；通过 `@media (prefers-color-scheme: dark)` 调整背景和文字；通过 `@media (prefers-reduced-motion: reduce)` 关闭位移和弹簧效果。

- [x] **Step 4: Run the check**

Run: `node --test tests/state.test.mjs`

Expected: PASS。

### Task 5: 浏览器验收与内容证据检查

**Files:**
- Create: `tests/content.test.mjs`
- Modify: `README.md` only to record fresh validation evidence

**Interfaces:**
- Consumes: running app at `http://127.0.0.1:5173/`
- Produces: validation record for the four-state workflow

- [x] **Step 1: Add content provenance checks**

检查 `src/words.js` 中每条示例都保留 `exam:'CET-4'` 和非真题说明所需字段，测试不允许出现未声明来源的 `真题出处` 文本。

- [x] **Step 2: Run the content check**

Run: `node --test tests/content.test.mjs`

Expected: 所有示例词条通过字段检查。

- [x] **Step 3: Run the app**

Run: `npm start`

在浏览器中按“首页 → 开始背词 → 认识程度 → 查看答案 → 下一个”走完队列，确认最后进入今日完成；刷新学习页确认队列位置恢复。

- [x] **Step 4: Check responsive states**

分别用桌面视口和 390×844 手机视口检查无横向溢出、主按钮可见、答案文本可读、底部导航不遮挡内容。

- [x] **Step 5: Record results**

把实际执行过的命令、视口、通过项和剩余限制写入 `README.md`，没有执行的检查写“尚未验证”。
