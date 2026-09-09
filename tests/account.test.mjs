import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGuestAccount,
  maskEmail,
  createLocalMigrationSnapshot,
} from '../src/account.js';

test('creates a guest account model for the profile page', () => {
  assert.deepEqual(createGuestAccount(), { status: 'guest', user: null });
});

test('masks email addresses before showing them in the profile', () => {
  assert.equal(maskEmail('xuziyan@qq.com'), 'xu***@qq.com');
  assert.equal(maskEmail('a@b.com'), 'a***@b.com');
});

test('keeps local data available for first-login merge', () => {
  const snapshot = createLocalMigrationSnapshot({
    learningState: { completed: ['word-1'], queue: ['word-2'] },
    importedWords: [{ id: 'custom-1', word: 'custom' }],
  });
  assert.equal(snapshot.strategy, 'merge-on-first-login');
  assert.deepEqual(snapshot.learningState.completed, ['word-1']);
  assert.deepEqual(snapshot.importedWords.map((word) => word.id), ['custom-1']);
});
