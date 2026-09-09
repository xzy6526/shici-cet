const preferences = new Set(['system', 'light', 'dark']);

export function normalizeThemePreference(value) {
  return preferences.has(value) ? value : 'system';
}

export function resolveTheme(preference, systemDark = false) {
  const normalized = normalizeThemePreference(preference);
  return normalized === 'system' ? (systemDark ? 'dark' : 'light') : normalized;
}

export function applyTheme(theme, documentRef = document) {
  const resolved = theme === 'dark' ? 'dark' : 'light';
  documentRef.documentElement.dataset.theme = resolved;
  documentRef.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? '#1b201a' : '#f5f6f1');
  return resolved;
}

export function createThemeService({ documentRef = globalThis.document, mediaQuery = globalThis.matchMedia?.('(prefers-color-scheme: dark)') } = {}) {
  let preference = 'system';
  let unsubscribe = null;
  const systemDark = () => Boolean(mediaQuery?.matches);
  const apply = () => applyTheme(resolveTheme(preference, systemDark()), documentRef);
  return {
    getPreference: () => preference,
    getResolvedTheme: () => resolveTheme(preference, systemDark()),
    setPreference(value) {
      preference = normalizeThemePreference(value);
      return apply();
    },
    subscribeSystemTheme(callback) {
      const handler = () => {
        if (preference !== 'system') return;
        const theme = apply();
        callback?.(theme);
      };
      mediaQuery?.addEventListener?.('change', handler);
      unsubscribe = () => mediaQuery?.removeEventListener?.('change', handler);
      return unsubscribe;
    },
    destroy() { unsubscribe?.(); },
  };
}
