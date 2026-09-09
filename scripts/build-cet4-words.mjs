import { readFile, writeFile } from 'node:fs/promises';

const sourcePath = new URL('../data/cet_full_list.source.json', import.meta.url);
const outputPath = new URL('../src/words.js', import.meta.url);
const source = JSON.parse(await readFile(sourcePath, 'utf8'));
const rows = source['四六级词汇词频排序表'];
const functionWords = new Set([
  'a', 'an', 'the', 'i', 'me', 'my', 'mine', 'myself', 'you', 'your', 'yours', 'yourself', 'yourselves',
  'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself', 'it', 'its', 'itself', 'we', 'us', 'our',
  'ours', 'ourselves', 'they', 'them', 'their', 'theirs', 'themselves', 'this', 'that', 'these', 'those',
  'who', 'whom', 'whose', 'which', 'what', 'whatever', 'whoever', 'whichever', 'each', 'every', 'either',
  'neither', 'one', 'ones', 'some', 'any', 'no', 'none', 'all', 'both', 'many', 'much', 'few', 'little',
  'more', 'most', 'other', 'another', 'such', 'same', 'own', 'be', 'am', 'is', 'are', 'was', 'were', 'been',
  'being', 'do', 'does', 'did', 'have', 'has', 'had', 'will', 'would', 'shall', 'should', 'can', 'could',
  'may', 'might', 'must', 'ought', 'need', 'dare', 'used', 'and', 'or', 'but', 'nor', 'so', 'yet', 'for',
  'if', 'though', 'although', 'because', 'since', 'unless', 'while', 'whereas', 'when', 'as', 'than', 'once',
  'until', 'after', 'before', 'about', 'above', 'across', 'against', 'along', 'among', 'around', 'at', 'behind',
  'below', 'beneath', 'beside', 'between', 'beyond', 'by', 'despite', 'down', 'during', 'except', 'from', 'in',
  'inside', 'into', 'like', 'near', 'of', 'off', 'on', 'onto', 'out', 'outside', 'over', 'past', 'through',
  'throughout', 'till', 'to', 'toward', 'towards', 'under', 'underneath', 'up', 'upon', 'with', 'within',
  'without', 'via', 'not', 'never', 'ever', 'just', 'only', 'also', 'too', 'very', 'quite', 'rather', 'even',
  'well', 'there', 'here', 'then', 'now', 'thus', 'however', 'therefore',
]);

const words = rows
  .filter((row) => row['六级'] == null)
  .sort((a, b) => Number(a['序号']) - Number(b['序号']))
  .map((row, id) => ({
    id,
    word: row['单词'],
    phonetic: '',
    meaning: row['释义'] || '',
    secondary: '',
    example: '',
    translation: '',
    collocation: '',
    pitfall: '',
    extended: '',
    exam: 'CET-4',
    frequencyRank: Number(row['序号']),
    frequency: Number(row['词频']),
    category: row['分类'] || '',
    subcategory: row['子分类'] || '',
    variants: row['其他拼写'] || '',
    isStudyWord: !functionWords.has(String(row['单词']).toLowerCase()),
  }));

const studyWords = words.filter((word) => word.isStudyWord);

const module = `// Generated from data/cet_full_list.source.json. Do not hand-edit.\n// Source data: exam-data/CETVocabulary, CC BY-NC-SA 4.0.\nexport const wordSource = ${JSON.stringify({
  repository: 'https://github.com/exam-data/CETVocabulary',
  rawUrl: 'https://raw.githubusercontent.com/exam-data/CETVocabulary/main/cet_full_list.json',
  commit: '6bd3fcb521ce3767ad612cc9160ef56f2cd9b26a',
  license: 'CC BY-NC-SA 4.0',
  filter: '六级 为空',
  count: words.length,
  studyFilter: '排除冠词、代词、介词、连词、助动词和常见功能副词',
  studyCount: studyWords.length,
}, null, 2)};\n\nexport const words = ${JSON.stringify(words, null, 2)};\n`;

const moduleWithStudyWords = `${module}\nexport const studyWords = words.filter((word) => word.isStudyWord);\n`;

await writeFile(outputPath, moduleWithStudyWords, 'utf8');
console.log(JSON.stringify({ sourceRows: rows.length, generatedWords: words.length, generatedStudyWords: studyWords.length }));
