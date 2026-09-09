import { mkdir, writeFile } from 'node:fs/promises';
import { studyWords, words } from '../src/words.js';
import { normalizeWord } from '../src/domain.js';
import { withReviewedContent } from '../src/reviewed-word-content.js';
import { withVerifiedPhonetics } from '../src/phonetic-overlay.js';
import { withVerifiedLexicalContent } from '../src/lexical-overlay.js';
import { withCETPriorityMeaning } from '../src/cet-priority-overlay.js';
import { coverageFor, qualityStatus } from '../src/vocabulary-quality.js';

const runtime = studyWords.map((word) => normalizeWord(withVerifiedPhonetics(withVerifiedLexicalContent(withCETPriorityMeaning(withReviewedContent(word))))));
const coverage = coverageFor(runtime);
const quality = Object.fromEntries(['phonetics', 'phoneticUK', 'phoneticUS', 'audio', 'partsOfSpeech', 'meanings', 'collocations', 'examples', 'examExamples', 'roots', 'affixes', 'wordFamily', 'confusableWords', 'rareMeanings', 'cetPriorityMeaning', 'sources'].map((field) => [field, ['verified', 'derived', 'partial', 'missing'].reduce((result, status) => ({ ...result, [status]: runtime.filter((word) => qualityStatus(word, field) === status).length }), {})]));
const highFrequency = runtime.slice(0, 25);
const sampled = runtime.filter((_, index) => index % 151 === 150).slice(0, 25);
const samples = [...highFrequency, ...sampled].filter((word, index, all) => all.findIndex((item) => item.id === word.id) === index).slice(0, 50).map((word) => ({ id: word.id, word: word.word, frequencyRank: word.frequencyRank, primaryMeaning: word.primaryMeaning?.meaning || '', dataQuality: word.dataQuality }));
const report = { generatedAt: new Date().toISOString(), scope: 'studyWords runtime view', fullVocabulary: words.length, studyPool: studyWords.length, total: runtime.length, coverage, quality, notes: ['Verified means a retained source record exists for this field.', 'Derived means project-curated or source-derived data without a field-level primary citation.', 'Partial means at least one subfield is present while another remains unavailable.', 'Missing is intentionally empty; this audit does not infer content.'] };

if (process.argv.includes('--write')) {
  const outputDir = new URL('../data/reports/', import.meta.url);
  await mkdir(outputDir, { recursive: true });
  await writeFile(new URL('vocabulary-coverage-report.json', outputDir), `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(new URL('vocabulary-sample-audit.json', outputDir), `${JSON.stringify({ generatedAt: report.generatedAt, samples }, null, 2)}\n`);
  const labels = { ukIpa: 'UK IPA', usIpa: 'US IPA', ukAudio: 'UK Audio', usAudio: 'US Audio', partsOfSpeech: 'POS', multipleMeanings: 'Multi Meaning', cetPriorityMeaning: 'CET Priority Meaning', collocations: 'Collocations', examples: 'Examples', roots: 'Roots', affixes: 'Affixes', wordFamily: 'Word Family', confusableWords: 'Confusable Words', rareMeanings: 'Rare Meaning', examExamples: 'Verified Exam Context', sources: 'Sources' };
  const rows = Object.entries(coverage).map(([field, value]) => `| ${labels[field] || field} | ${value.count} / ${value.total} | ${value.percent}% |`).join('\n');
  await writeFile(new URL('../docs/VOCABULARY_COVERAGE.md', import.meta.url), `# CET Vocabulary Coverage Report\n\n生成时间：${report.generatedAt}\n\n- **Full Vocabulary**：${report.fullVocabulary}\n- **Study Pool**：${report.studyPool}\n\n以下覆盖率均以 Study Pool = ${report.studyPool} 的运行时视图计算。\n\n| 字段 | 覆盖数量 | 覆盖率 |\n| --- | ---: | ---: |\n${rows}\n\n字段质量分布与抽样见 [data/reports](../data/reports/)，100 词结构化抽样清单见 [VOCABULARY_QA_SAMPLE.md](./VOCABULARY_QA_SAMPLE.md)。\n\n- **Verified**：该字段保留了可追溯来源记录。\n- **Derived**：项目整理或由来源数据派生，但尚无字段级原始引文。\n- **Partial**：部分子字段可用，其他子字段仍缺失。\n- **Missing**：保持为空，不按拼写或模型推测。\n`);
}

console.log(JSON.stringify(report));
