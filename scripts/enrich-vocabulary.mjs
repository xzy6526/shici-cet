import { mkdir, writeFile } from 'node:fs/promises';
import { words } from '../src/words.js';
import { normalizeWord } from '../src/domain.js';
import { reviewedWordContent, withReviewedContent } from '../src/reviewed-word-content.js';
import { withVerifiedPhonetics } from '../src/phonetic-overlay.js';
import { withVerifiedLexicalContent } from '../src/lexical-overlay.js';
import { withCETPriorityMeaning } from '../src/cet-priority-overlay.js';

const runtime = words.map((word) => normalizeWord(withVerifiedPhonetics(withVerifiedLexicalContent(withCETPriorityMeaning(withReviewedContent(word))))));
const output = new URL('../data/enriched/cet4-runtime.manifest.json', import.meta.url);
await mkdir(new URL('../data/enriched/', import.meta.url), { recursive: true });
await writeFile(output, `${JSON.stringify({ generatedAt: new Date().toISOString(), base: 'src/words.js', overlays: ['src/reviewed-word-content.js', 'src/cet-priority-overlay.js', 'src/lexical-content.js', 'src/phonetics.js'], runtimeCount: runtime.length, appliedOverrides: Object.keys(reviewedWordContent).filter((word) => runtime.some((item) => item.word === word)), heldOutOverrides: Object.keys(reviewedWordContent).filter((word) => !runtime.some((item) => item.word === word)), stableIds: runtime.every((word, index) => word.id === words[index].id) }, null, 2)}\n`);
console.log(JSON.stringify({ runtime: runtime.length, output: 'data/enriched/cet4-runtime.manifest.json' }));
