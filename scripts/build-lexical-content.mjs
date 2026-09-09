import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { writeFile } from 'node:fs/promises';
import { words } from '../src/words.js';

const EN_ARCHIVE = fileURLToPath(new URL('../data/raw/omw-en-2.0.tar.xz', import.meta.url));
const ZH_ARCHIVE = fileURLToPath(new URL('../data/raw/omw-cmn-2.0.tar.xz', import.meta.url));
const targets = new Set(words.map((item) => item.word.trim().toLowerCase()));
const posOrder = ['n', 'v', 'a', 's', 'r'];
const posNames = { n: 'noun', v: 'verb', a: 'adjective', s: 'adjective', r: 'adverb' };

function decodeXml(value = '') {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function attr(line, name) {
  const match = line.match(new RegExp(`${name}="([^"]*)"`));
  return match ? decodeXml(match[1]) : '';
}

function textNode(line, tag) {
  const match = line.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`));
  return match ? decodeXml(match[1].trim()) : '';
}

async function readArchiveLines(archive, member, consume) {
  const child = spawn('tar', ['-xOf', archive, member], { windowsHide: true });
  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  const closed = new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code) => code === 0 ? resolve() : reject(new Error(stderr.trim() || `tar exited with ${code}`)));
  });
  const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
  for await (const line of lines) consume(line);
  await closed;
}

function synsetKey(value) {
  return value.match(/(\d{8}-[nvars])$/)?.[1] || '';
}

const sensesByWord = new Map();
const synsets = new Map();
let englishEntry = null;
let activeSynset = null;

await readArchiveLines(EN_ARCHIVE, 'omw-en/omw-en.xml', (line) => {
  if (line.includes('<LexicalEntry ')) englishEntry = { word: '', pos: '', senses: [] };
  if (englishEntry && line.includes('<Lemma ')) {
    englishEntry.word = attr(line, 'writtenForm').toLowerCase();
    englishEntry.pos = attr(line, 'partOfSpeech');
  }
  if (englishEntry && line.includes('<Sense ')) {
    const key = synsetKey(attr(line, 'synset'));
    if (key) englishEntry.senses.push(key);
  }
  if (englishEntry && line.includes('</LexicalEntry>')) {
    if (targets.has(englishEntry.word) && englishEntry.senses.length) {
      const parts = sensesByWord.get(englishEntry.word) || new Map();
      parts.set(englishEntry.pos, [...(parts.get(englishEntry.pos) || []), ...englishEntry.senses]);
      sensesByWord.set(englishEntry.word, parts);
      for (const key of englishEntry.senses) if (!synsets.has(key)) synsets.set(key, { definition: '', examples: [] });
    }
    englishEntry = null;
  }

  if (line.includes('<Synset ')) {
    const key = synsetKey(attr(line, 'id'));
    activeSynset = synsets.has(key) ? key : null;
  }
  if (activeSynset && line.includes('<Definition')) {
    const definition = textNode(line, 'Definition');
    if (definition) synsets.get(activeSynset).definition = definition;
  }
  if (activeSynset && line.includes('<Example')) {
    const example = textNode(line, 'Example');
    if (example) synsets.get(activeSynset).examples.push(example);
  }
  if (line.includes('</Synset>')) activeSynset = null;
});

const chineseBySynset = new Map();
let chineseEntry = null;
await readArchiveLines(ZH_ARCHIVE, 'omw-cmn/omw-cmn.xml', (line) => {
  if (line.includes('<LexicalEntry ')) chineseEntry = { lemma: '', senses: [] };
  if (chineseEntry && line.includes('<Lemma ')) chineseEntry.lemma = attr(line, 'writtenForm');
  if (chineseEntry && line.includes('<Sense ')) {
    const key = synsetKey(attr(line, 'synset'));
    if (synsets.has(key)) chineseEntry.senses.push(key);
  }
  if (chineseEntry && line.includes('</LexicalEntry>')) {
    if (chineseEntry.lemma) {
      for (const key of chineseEntry.senses) {
        const lemmas = chineseBySynset.get(key) || [];
        if (!lemmas.includes(chineseEntry.lemma)) lemmas.push(chineseEntry.lemma);
        chineseBySynset.set(key, lemmas);
      }
    }
    chineseEntry = null;
  }
});

function selectedSenses(parts) {
  const queues = posOrder
    .map((pos) => ({ pos, ids: [...new Set(parts.get(pos) || [])].slice(0, 4) }))
    .filter((part) => part.ids.length);
  const selected = [];
  for (let senseIndex = 0; senseIndex < 4 && selected.length < 8; senseIndex += 1) {
    for (const part of queues) {
      const key = part.ids[senseIndex];
      if (key && selected.length < 8) selected.push({ pos: part.pos, key, senseIndex });
    }
  }
  return selected;
}

function isUsefulExample(sentence, word) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[\s_-]+/g, '[\\s_-]+');
  const hasTarget = new RegExp(`(^|[^a-z])${escaped}(?:s|es|ed|ing)?(?=$|[^a-z])`, 'i').test(sentence);
  return hasTarget && sentence.trim().length >= 20 && sentence.trim().split(/\s+/).length >= 5;
}

const lexicalContent = {};
for (const item of words) {
  const key = item.word.trim().toLowerCase();
  const parts = sensesByWord.get(key);
  if (!parts) continue;
  const grouped = new Map();
  const exampleCandidates = [];
  const posRelevance = new Map();
  const coreTokens = String(item.meaning || '').split(/[、，,；;\/（）()\s]+/).map((value) => value.trim()).filter((value) => value.length > 1);
  for (const selected of selectedSenses(parts)) {
    const synset = synsets.get(selected.key) || {};
    const chinese = (chineseBySynset.get(selected.key) || []).slice(0, 4);
    const meaning = chinese.length ? chinese.join('；') : synset.definition;
    if (!meaning) continue;
    const pos = posNames[selected.pos];
    const meanings = grouped.get(pos) || [];
    meanings.push({
      meaning,
      explanation: chinese.length ? synset.definition : '',
      priority: selected.senseIndex === 0 ? 'secondary' : 'rare',
      language: chinese.length ? 'zh' : 'en',
      sourceId: selected.key,
    });
    grouped.set(pos, meanings);
    const relevance = chinese.some((lemma) => coreTokens.some((token) => lemma.includes(token) || token.includes(lemma))) ? 1 : 0;
    posRelevance.set(pos, Math.max(posRelevance.get(pos) || 0, relevance));
    for (const sentence of (synset.examples || [])) {
      if (isUsefulExample(sentence, key)) exampleCandidates.push({ sentence, sourceType: 'dictionary_example', sourceVerified: false, sourceId: selected.key, pos, relevance, order: exampleCandidates.length });
    }
  }
  const examples = exampleCandidates
    .filter((value, index, all) => all.findIndex((item) => item.sentence === value.sentence) === index)
    .sort((left, right) => Math.max(right.relevance, posRelevance.get(right.pos) || 0) - Math.max(left.relevance, posRelevance.get(left.pos) || 0) || left.order - right.order)
    .slice(0, 2)
    .map(({ pos, relevance, order, ...value }) => value);
  const partsOfSpeech = [...grouped].map(([pos, meanings]) => ({ pos, meanings }));
  if (partsOfSpeech.length) lexicalContent[key] = { partsOfSpeech, exampleSentences: examples };
}

const lexicalSources = {
  english: {
    name: 'OMW English Wordnet 2.0 (Princeton WordNet 3.0)',
    url: 'https://github.com/omwn/omw-data/releases/tag/v2.0',
    license: 'Princeton WordNet License',
    sha256: '0e09dfb7f096bc3f10b9de68ffecf13839fa22ae46fd9b227cec890d204ca1dc',
    verified: true,
  },
  chinese: {
    name: 'Chinese Open WordNet 2.0',
    url: 'https://github.com/omwn/omw-data/releases/tag/v2.0',
    license: 'WordNet-style open license',
    sha256: '7d07af60a6ced0cedc4ca114d0b60a796d3f138df0f3be21f6322e53d004e91c',
    verified: true,
  },
};
const output = new URL('../src/lexical-content.js', import.meta.url);
const compactContent = Object.fromEntries(Object.entries(lexicalContent).map(([word, record]) => [word, [
  record.partsOfSpeech.map((part) => [part.pos, part.meanings.map((meaning) => [meaning.meaning, meaning.explanation, meaning.priority === 'secondary' ? 's' : 'r', meaning.language === 'zh' ? 'z' : 'e', meaning.sourceId])]),
  record.exampleSentences.map((example) => [example.sentence, example.sourceId]),
]]));
await writeFile(output, `// Generated by scripts/build-lexical-content.mjs. Do not hand-edit.\nexport const lexicalSources=${JSON.stringify(lexicalSources)};\nexport const verifiedLexicalContent=${JSON.stringify(compactContent)};\n`);

const records = Object.values(lexicalContent);
console.log(JSON.stringify({
  total: words.length,
  matched: records.length,
  withMultipleMeanings: records.filter((record) => record.partsOfSpeech.flatMap((part) => part.meanings).length > 1).length,
  withMultiplePartsOfSpeech: records.filter((record) => record.partsOfSpeech.length > 1).length,
  withChineseMeanings: records.filter((record) => record.partsOfSpeech.some((part) => part.meanings.some((meaning) => meaning.language === 'zh'))).length,
  withExamples: records.filter((record) => record.exampleSentences.length).length,
}));
