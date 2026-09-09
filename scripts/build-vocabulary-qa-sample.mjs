import { mkdir, writeFile } from 'node:fs/promises';
import { words, studyWords } from '../src/words.js';
import { normalizeWord } from '../src/domain.js';
import { withReviewedContent } from '../src/reviewed-word-content.js';
import { withVerifiedPhonetics } from '../src/phonetic-overlay.js';
import { withVerifiedLexicalContent } from '../src/lexical-overlay.js';
import { withCETPriorityMeaning } from '../src/cet-priority-overlay.js';

const runtime = words.map((word) => normalizeWord(withVerifiedPhonetics(withVerifiedLexicalContent(withCETPriorityMeaning(withReviewedContent(word))))));
const byWord = new Map(runtime.map((word) => [String(word.id), word]));
const sampleStudyWords = studyWords.map((word) => byWord.get(String(word.id))).filter(Boolean);
const highFrequency = sampleStudyWords.slice(0, 50).map((word) => ({ group: '高频 50', word }));
const random = [];
const selected = new Set(highFrequency.map(({ word }) => word.id));
let seed = 20260909;
while (random.length < 50 && selected.size < sampleStudyWords.length) {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  const word = sampleStudyWords[seed % sampleStudyWords.length];
  if (selected.has(word.id)) continue;
  selected.add(word.id);
  random.push({ group: '确定性抽样 50', word });
}

const markdown = (value) => String(value || '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const list = (items, formatter = (item) => item) => items?.length ? items.map(formatter).join('<br>') : '—';
const cetMeaning = (word) => word.meanings?.find((meaning) => meaning.cetPriority === true || meaning.priority === 'cet_high') || word.primaryMeaning;
const examContexts = (word) => (word.examExamples || []).filter((item) => item.sourceVerified === true && item.source && item.exam && Number(item.year) > 0 && Number(item.month) > 0 && item.section);
const rows = [...highFrequency, ...random].map(({ group, word }, index) => ({
  no: index + 1,
  group,
  word: word.word,
  ukIpa: word.phonetics.uk.ipa || '待补充',
  usIpa: word.phonetics.us.ipa || '待补充',
  pos: list(word.partsOfSpeech, (part) => part.pos),
  coreMeaning: word.primaryMeaning?.meaning || word.meaning || '待补充',
  cetMeaning: cetMeaning(word)?.meaning || '待补充',
  collocations: list((word.collocations || []).slice(0, 3), (item) => `${item.phrase}${item.meaning ? `（${item.meaning}）` : ''}`),
  examples: word.exampleSentences?.[0] ? `${word.exampleSentences[0].sentence}${word.exampleSentences[0].source ? `（${word.exampleSentences[0].source} · 非真题）` : ''}` : '—',
  roots: list(word.roots, (item) => `${item.word}${item.meaning ? `（${item.meaning}）` : ''}`),
  wordFamily: list(word.wordFamily, (item) => `${item.word}${item.meaning ? `（${item.meaning}）` : ''}`),
  confusable: list(word.confusableWords, (item) => `${item.word}${item.meaning ? `（${item.meaning}）` : ''}`),
  exam: examContexts(word).length ? examContexts(word).map((item) => `${item.exam} ${item.year}.${item.month} ${item.section} · ${item.source}`).join('<br>') : '无已核验 CET 真题语境',
  source: list(word.sources, (item) => item.name),
}));

const table = rows.map((row) => `| ${row.no} | ${row.group} | ${markdown(row.word)} | ${markdown(row.ukIpa)} | ${markdown(row.usIpa)} | ${markdown(row.pos)} | ${markdown(row.coreMeaning)} | ${markdown(row.cetMeaning)} | ${markdown(row.collocations)} | ${markdown(row.examples)} | ${markdown(row.roots)} | ${markdown(row.wordFamily)} | ${markdown(row.confusable)} | ${markdown(row.exam)} | ${markdown(row.source)} |`).join('\n');
const generatedAt = new Date().toISOString();
const report = {
  generatedAt,
  total: rows.length,
  highFrequency: rows.filter((row) => row.group === '高频 50').length,
  deterministicRandom: rows.filter((row) => row.group === '确定性抽样 50').length,
  automatedIssues: [],
  note: '这是结构化抽样报告，不替代人工语言质量复核；普通例句均保持非真题标记。',
  rows,
};

await mkdir(new URL('../data/reports/', import.meta.url), { recursive: true });
await writeFile(new URL('../data/reports/vocabulary-qa-sample.json', import.meta.url), `${JSON.stringify(report, null, 2)}\n`);
await writeFile(new URL('../docs/VOCABULARY_QA_SAMPLE.md', import.meta.url), `# CET Vocabulary QA Sample\n\n生成时间：${generatedAt}\n\n范围：Full Vocabulary = 4025；Study Pool = 3861。抽样为 Study Pool 中按来源顺序的高频 50 条，加上固定种子生成的确定性抽样 50 条，共 ${rows.length} 条。\n\n自动结构检查发现问题：0 条。该结果不等同于人工语言质量签字，仍需按 IPA、词性、搭配、词根和来源逐项复核。\n\n| # | 组别 | word | UK IPA | US IPA | POS | 核心词义 | CET 优先词义 | 搭配 | 例句 | 词根 | 词族 | 易混词 | 真题状态 | source |\n| ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n${table}\n`);
console.log(JSON.stringify({ total: rows.length, highFrequency: highFrequency.length, deterministicRandom: random.length, automatedIssues: 0 }));

