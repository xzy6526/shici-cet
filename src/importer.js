const cleanWord = (value) => String(value ?? '').trim().toLowerCase();
const cleanMeaning = (value) => String(value ?? '').trim();

export function parseTextLines(text) {
  return String(text).split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('#')).map((line) => {
    const [word, ...meaning] = line.split(/[,，\t]/);
    return { word: cleanWord(word), meaning: cleanMeaning(meaning.join(', ')) };
  }).filter(({ word }) => word);
}

export function parseCsv(text) {
  const lines = String(text).split(/\r?\n/).filter((line) => line.trim());
  const first = lines[0]?.toLowerCase() || '';
  const data = /(^|[,，\t])\s*(word|单词)\s*([,，\t]|$)/.test(first) ? lines.slice(1) : lines;
  return parseTextLines(data.join('\n'));
}

export function parseJson(text) {
  const data = JSON.parse(text);
  if (!Array.isArray(data)) throw new Error('JSON 顶层必须是数组');
  return data.map((entry) => typeof entry === 'string' ? { word: cleanWord(entry), meaning: '' } : {
    word: cleanWord(entry?.word), meaning: cleanMeaning(entry?.meaning),
  }).filter(({ word }) => word);
}

export function parseImportedText(text, extension) {
  if (extension === '.json') return parseJson(text);
  if (extension === '.csv') return parseCsv(text);
  return parseTextLines(text);
}
