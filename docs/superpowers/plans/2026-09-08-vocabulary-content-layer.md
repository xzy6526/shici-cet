# CET Vocabulary Content Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改变 3861 条学习池和调度逻辑的前提下，建立可审计的 CET 内容数据层。

**Architecture:** 保留只读原始快照；由既有生成器产生稳定基础词表；运行时将人工复核、CET 优先义和开放词典覆盖合并并标准化。审计、增强清单和验证脚本只读数据并生成报告，缺失内容保持 Missing。

**Tech Stack:** Node.js ESM、Node 原生测试、JSON、现有静态网站。

**Spec:** `C:\Users\xuziyan\.codex\attachments\609ffbd6-6b31-4b99-b1b1-4155985121ab\pasted-text.txt`

## Global Constraints

- 不覆盖 `data/cet_full_list.source.json`，不改变 4025 / 3861 数量和稳定 ID。
- 不把未核验内容标为真题或 Verified。
- 不引入新依赖，不修改学习调度算法。

---

### Task 1: 字段级质量模型

**Files:** `src/domain.js`、`src/vocabulary-quality.js`、`tests/domain.test.mjs`、`tests/vocabulary-quality.test.mjs`

- [x] 为 UK / US 音标、双音频和内容字段增加 `verified`、`derived`、`partial`、`missing` 状态。
- [x] 保留所有旧字段和 ID，并验证重复 ID、无来源 Verified IPA、重复内容等错误。

### Task 2: 可重复的数据管线

**Files:** `scripts/normalize-vocabulary.mjs`、`scripts/enrich-vocabulary.mjs`、`scripts/audit-vocabulary.mjs`、`scripts/validate-vocabulary.mjs`、`package.json`

- [x] 建立 raw → normalized → enriched → runtime 的可执行清单与验证命令。
- [x] 输出全学习池覆盖率、质量分布、100 词结构化抽样和稳定 ID 检查。

### Task 3: 来源与遗漏审计

**Files:** `docs/DATA_SOURCES.md`、`data/audits/missing-cet-candidates.json`、`scripts/audit-missing-cet.mjs`

- [x] 记录来源、许可、字段用途、候选源的启用状态与合并优先级。
- [x] 把 economic / economical 保留为缺失候选，不插入正式词库。

### Task 4: 回归验证

**Files:** `tests/*.test.mjs`、`data/reports/*`、`docs/VOCABULARY_COVERAGE.md`

- [x] 运行 `npm test`、`npm run build`、`npm run audit:missing-cet`，核对报告和现有学习池。

### Task 5: 双音标静态增强

**Files:** `data/raw/*`、`scripts/build-phonetics.mjs`、`src/phonetics.js`、`src/phonetic-overlay.js`、`tests/phonetic-overlay.test.mjs`

- [x] 固定并记录 MIT 来源的 Britfone UK 与 ipa-dict en_US 数据、Commit 和 SHA-256。
- [x] 生成仅覆盖当前 CET 词表的双音标运行时层，Verified 数据优先于人工验收样例。
- [x] 接入 OMW English Wordnet 2.0 与 Chinese Open WordNet 2.0，生成只覆盖当前 4025 词的紧凑词性、多义项和普通例句层。
- [x] 保留 CET 中文核心义与高频提示，普通词典例句显示来源并明确标记为非真题。

### Task 6: Phase 2 schema and QA

**Files:** `src/cet-priority-overlay.js`、`src/domain.js`、`src/vocabulary-quality.js`、`src/pronunciation.js`、`scripts/build-vocabulary-qa-sample.mjs`、`docs/VOCABULARY_QA_SAMPLE.md`

- [x] 为每条运行时词条标记 CET 优先义，保持普通背词卡只展示少量核心内容。
- [x] 建立 `audio.uk` / `audio.us` 结构；无合法静态音频时保持 Missing 并使用浏览器 TTS fallback。
- [x] 扩展验证器：音频来源、词义优先级、搭配去重、词根来源、词族结构和完整真题 metadata。
- [x] 生成 50 条高频 + 50 条确定性抽样的 QA 清单，不把结构检查结果冒充人工语言签字。
