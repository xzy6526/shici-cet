export function createGuestAccount() {
  return { status: 'guest', user: null };
}

export function maskEmail(value) {
  const [local = '', domain = ''] = String(value || '').trim().toLowerCase().split('@');
  if (!local || !domain) return '';
  return `${local.slice(0, Math.min(2, local.length))}***@${domain}`;
}

export function createLocalMigrationSnapshot({ learningState, importedWords } = {}) {
  return {
    version: 1,
    strategy: 'merge-on-first-login',
    learningState: learningState ? JSON.parse(JSON.stringify(learningState)) : null,
    importedWords: Array.isArray(importedWords) ? JSON.parse(JSON.stringify(importedWords)) : [],
  };
}
