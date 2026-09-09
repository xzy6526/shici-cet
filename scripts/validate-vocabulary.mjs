import { studyWords, words } from '../src/words.js';
import { normalizeWord } from '../src/domain.js';
import { withReviewedContent } from '../src/reviewed-word-content.js';
import { withVerifiedPhonetics } from '../src/phonetic-overlay.js';
import { withVerifiedLexicalContent } from '../src/lexical-overlay.js';
import { withCETPriorityMeaning } from '../src/cet-priority-overlay.js';
import { validateVocabulary } from '../src/vocabulary-quality.js';

const runtime = words.map((word) => normalizeWord(withVerifiedPhonetics(withVerifiedLexicalContent(withCETPriorityMeaning(withReviewedContent(word))))));
const result = validateVocabulary(runtime);
const stableStudyCount = runtime.filter((word) => word.isStudyWord).length === studyWords.length;
const stableIds = runtime.every((word, index) => word.id === words[index].id);
const output = { ...result, fullVocabulary: words.length, studyPool: studyWords.length, total: runtime.length, stableStudyCount, stableIds };
console.log(JSON.stringify(output));
if (!result.valid || !stableStudyCount || !stableIds || words.length !== 4025 || studyWords.length !== 3861) process.exitCode = 1;
