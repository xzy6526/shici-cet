import { mkdir, writeFile } from 'node:fs/promises';
import { words } from '../src/words.js';
import { normalizeWord } from '../src/domain.js';

const normalized = words.map(normalizeWord);
const output = new URL('../data/normalized/cet4-normalized.manifest.json', import.meta.url);
await mkdir(new URL('../data/normalized/', import.meta.url), { recursive: true });
await writeFile(output, `${JSON.stringify({ generatedAt: new Date().toISOString(), input: 'data/cet_full_list.source.json', output: 'runtime normalization only; no raw data overwritten', count: normalized.length, stableIds: normalized.every((word, index) => word.id === words[index].id) }, null, 2)}\n`);
console.log(JSON.stringify({ normalized: normalized.length, output: 'data/normalized/cet4-normalized.manifest.json' }));
