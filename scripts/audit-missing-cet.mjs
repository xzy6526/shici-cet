import { readFile } from 'node:fs/promises';

const raw = JSON.parse(await readFile(new URL('../data/cet_full_list.source.json', import.meta.url), 'utf8'))['四六级词汇词频排序表'];
const candidates = JSON.parse(await readFile(new URL('../data/audits/missing-cet-candidates.json', import.meta.url), 'utf8'));
const result = candidates.map((candidate) => {
  const currentPresent = raw.some((row) => String(row['单词'] || '').toLowerCase() === candidate.word);
  return { ...candidate, currentPresent, presentInPinnedSource: currentPresent, candidateCetLevel: candidate.candidateCetLevel || '待核验', evidenceSource: candidate.evidenceSource || 'exam-data/CETVocabulary 固定快照', recommendedAction: candidate.recommendedAction || candidate.nextAction || '补充公开可核验的 CET 来源后再评估' };
});
console.log(JSON.stringify({ pinnedSourceCount: raw.length, candidates: result }, null, 2));
