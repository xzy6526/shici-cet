# CET 词汇内容数据来源

更新时间：2026-09-09

| 层级 | 来源 | 许可 / 状态 | 当前使用字段 | 内容状态 |
| --- | --- | --- | --- | --- |
| 原始词表 | [exam-data/CETVocabulary](https://github.com/exam-data/CETVocabulary) 固定 Commit `6bd3fcb521ce3767ad612cc9160ef56f2cd9b26a` | CC BY-NC-SA 4.0；本地快照已记录哈希 | 单词、中文释义、词频、分类、其他拼写、CET 筛选 | `Verified`（来源可追溯，不等同教育考试院官方排序） |
| 人工复核覆盖 | `src/reviewed-word-content.js` | 项目自有内容；逐条来源仍待补 | 词性、释义层级、普通示例、搭配、词族、易混、记忆提示 | `Derived` |
| 英式 IPA | [Britfone](https://github.com/JoseLlarena/Britfone) 固定 Commit `1062be14adc96c358f2087ac5449d72130c7a6f4` | MIT；本地快照 SHA-256 `59f197e98520856d1cc88e380beb54e4314d8712efc4d588b6778819c502d920` | UK IPA 与变体 | `Verified` |
| 美式 IPA | [ipa-dict en_US](https://github.com/open-dict-data/ipa-dict/tree/43c3570eb3553bdd19fccd2bd0091534889af023) | en_US 上游注明为 MIT；本地快照 SHA-256 `2af6f154a5c363275f052d1f85acedef38ed185ca9745aa4314be77f6b70de67` | US IPA 与变体 | `Verified` |
| UK / US Audio | 暂无可批量再分发且许可清晰的静态音频源 | 未接入；不生成或猜测 URL；浏览器 Web Speech API 仅作运行时 TTS fallback | `audio.uk` / `audio.us` 结构与状态字段 | `Missing` |
| 英文词义与普通例句 | [OMW English Wordnet 2.0](https://github.com/omwn/omw-data/releases/tag/v2.0)，基于 Princeton WordNet 3.0 | Princeton WordNet License；本地归档 `omw-en-2.0.tar.xz`，SHA-256 `0e09dfb7f096bc3f10b9de68ffecf13839fa22ae46fd9b227cec890d204ca1dc` | 词性、义项顺序、英文解释、普通例句 | `Verified`（来源可追溯，不代表 CET 考义排序） |
| 中文义项标签 | [Chinese Open WordNet 2.0](https://github.com/omwn/omw-data/releases/tag/v2.0) | WordNet-style open license；本地归档 `omw-cmn-2.0.tar.xz`，SHA-256 `7d07af60a6ced0cedc4ca114d0b60a796d3f138df0f3be21f6322e53d004e91c` | 按同一 WordNet synset 对齐的中文义项 | `Verified`（来源可追溯，未命中时保留英文释义） |
| 常见搭配 | 暂无接入的免费、许可清晰批量搭配源；少量人工样例见 `src/reviewed-word-content.js` | 项目自有样例为 `Derived`，其余保持 `Missing` | collocations | `Derived / Missing` |
| 词根 / 词缀 | 暂无接入的免费、可追溯批量词源数据源 | 不按拼写拆分，不伪造词根 | roots / affixes | `Missing` |
| 词族 / 易混词 | 少量人工复核样例见 `src/reviewed-word-content.js` | 项目自有内容，引用不改变正式词库 | wordFamily / confusableWords | `Derived / Missing` |
| CET 真题语境 | 暂无找到可免费批量再分发且出处完整的真题语料 | `examExamples` 仅接受完整 metadata + `sourceVerified: true` | exam、year、month、section、source、targetMeaning | `Missing`（当前 0 条） |
| 发音验收样例 | `src/pronunciation-data.js` | 仅用于旧验收；正式词库优先使用字段级 Verified IPA | 6 个样例的 UK / US IPA | `Derived` |
| Wiktextract / Kaikki | [Kaikki English dictionary extraction](https://kaikki.org/dictionary/English/index.html) | CC BY-SA / GFDL；完整原始包体积大，需署名与许可评估 | 未接入 | 候选，未启用 |
| open-dict-data/ipa-dict en_UK | [ipa-dict](https://github.com/open-dict-data/ipa-dict) | 英语 UK 数据有第三方 GPL 来源说明 | 未接入 | 候选，未启用 |

## 合并与展示规则

1. `data/cet_full_list.source.json` 是只读原始快照；生成脚本不会覆盖它。
2. `scripts/build-cet4-words.mjs` 生成稳定 ID 的基础词表；`scripts/build-lexical-content.mjs` 从两份 OMW 2.0 压缩归档生成只包含当前 4025 词的紧凑内容层，不改变词数、顺序或 ID。
3. 核心中文释义优先级为：**项目人工复核核心义 > 原始 CET 词表中文义 > OMW 补充义项**。OMW 只补充词性、多义项、英文解释和普通例句，不覆盖原有核心义。字段级 Verified IPA 仍优先于旧验收样例。
4. 只有 `examExamples` 同时具备完整出处且 `sourceVerified: true`，页面才能称为真题语境。当前生产词库为 0 条。
5. `PronunciationService` 通过 `getAudioSource()` 区分 `verified-audio`、普通静态 `audio` 与 `tts-fallback`。浏览器 TTS 是播放回退能力，不是可验证的录音文件，也不会提高音标或发音数据的质量状态；当前没有批量授权的真人 UK / US 音频。
6. OMW 例句只保留明确包含目标词、至少 5 个词且长度不低于 20 个字符的句子。页面显示“开放词典例句 · 非真题”及来源；`sourceVerified: false` 表示它未被核验为 CET 真题，并不否定词典来源本身。

## 许可边界速查

- Britfone 与 ipa-dict en_US 的上游记录为 MIT，可在保留许可与来源说明的前提下随项目再分发；具体快照和哈希见上表。
- OMW English / Chinese 数据按各自 WordNet-style 许可随归档使用，当前项目保留来源名、下载地址和归档哈希；公开发布或商业使用前仍需逐文件核对许可文本和署名要求。
- 原始 CET 词表快照为 CC BY-NC-SA 4.0，仅按当前非商业本地项目边界使用；不得把它描述为教育考试院官方词表。
- 普通搭配、词族和易混词仅有少量项目自有 `Derived` 样例；没有明确来源的数据不进入批量静态层。浏览器 TTS 不产生可再分发音频文件。

## 当前学习词覆盖

- 词性：3825 / 3861（99.07%）；
- 多义项：3377 / 3861（87.46%）；
- 普通例句：2418 / 3861（62.63%）；
- 中文对齐义项：完整 4025 词中 3348 词至少有一个 Chinese Open WordNet 对齐义项；
- 已核验 CET 真题例句：0 / 3861。

## 许可与发布边界

当前基础词表的 CC BY-NC-SA 4.0 限制仍适用。公开部署、商业化或批量引入候选词典数据前，必须重新审核来源、字段级署名、再许可义务与音频权利。
