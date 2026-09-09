# Email Auth, Local-First Sync and Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the phone mock with optional Supabase email OTP, preserve local learning data, add a safe cloud-sync boundary, and let every user choose system, light, or dark appearance.

**Architecture:** The existing local state remains the source used by the study UI. `auth.js` owns Supabase email sessions, `sync.js` merges and uploads only user state, and `theme.js` resolves a saved preference before app rendering. The current daily task remains local-only to avoid unsafe cross-device queue merges.

**Tech Stack:** Vanilla ES modules, Node test runner, Supabase JavaScript SDK, existing localStorage and static server.

**Spec:** `C:\Users\xuziyan\.codex\attachments\721e73ea-c1af-402d-8640-e89ca31cbca0\pasted-text.txt`

## Global Constraints

- Keep study rating, queue, daily task and local persistence independent of authentication and network availability.
- Use `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; never expose a service-role key.
- Do not simulate successful OTP when Supabase is unconfigured.
- Use a single moving segmented indicator for theme selection and preserve reduced-motion behavior.
- Keep the existing visual language and only make direct, scoped changes.

---

### Task 1: Theme preference domain and early application

**Files:**
- Create: `src/services/theme.js`
- Modify: `src/domain.js`, `src/state.js`, `index.html`, `src/styles.css`
- Test: `tests/theme.test.mjs`, `tests/state.test.mjs`

**Interfaces:**
- Produces `resolveTheme(preference, systemDark)`, `createThemeService(options)`, and `setThemePreference(state, preference, now)`.

- [ ] Write failing tests for system/light/dark resolution and theme timestamps.
- [ ] Implement the smallest preference normalizer and state update.
- [ ] Add an inline pre-render theme application and root-token selectors.
- [ ] Run theme and state tests.

### Task 2: Email OTP service and public runtime configuration

**Files:**
- Create: `src/services/auth.js`, `.env.example`
- Modify: `src/account.js`, `server.mjs`, `index.html`, `package.json`, `package-lock.json`
- Test: `tests/account.test.mjs`, `tests/auth.test.mjs`

**Interfaces:**
- Produces `authService.getCurrentUser()`, `sendEmailOtp(email)`, `verifyEmailOtp(email, token)`, `signOut()`, `getSession()`, and `onAuthStateChange(callback)`.

- [ ] Write failing tests for email validation, configuration absence, and client-backed OTP calls.
- [ ] Install the official Supabase SDK and expose only configured public runtime values.
- [ ] Replace phone helpers with email masking and optional Supabase-backed auth.
- [ ] Run account and auth tests.

### Task 3: Local-first cloud state merge and sync boundary

**Files:**
- Create: `src/services/sync.js`, `supabase/migrations/202609060001_user_learning_state.sql`
- Test: `tests/sync.test.mjs`

**Interfaces:**
- Produces `mergeLearningState(local, cloud)`, `mergeWordState(local, cloud)`, `createSyncService(client)`, and `hasMeaningfulLocalData(state)`.

- [ ] Write failing tests for local-only upload, cloud-only restore, record-level merge, favorites union, and no duplicate counters.
- [ ] Implement timestamp-aware field merge with `max` counters instead of summing and keep `dailyTask` local-only.
- [ ] Add RLS-enabled SQL tables and policies for `profiles`, `user_settings`, and `user_word_states`.
- [ ] Run sync tests.

### Task 4: Wire account, sync, and appearance into the current UI

**Files:**
- Modify: `src/app.js`, `src/styles.css`
- Test: existing browser flow plus Node tests

**Interfaces:**
- Consumes the Task 1–3 service APIs. `persistRender()` remains local-first and only schedules background sync for authenticated users.

- [ ] Replace all phone UI, labels, events and mock messages with email OTP states.
- [ ] Render guest and signed-in profile cards from account status, including non-blocking sync status and sign-out.
- [ ] Add immediate three-option appearance selector without rerendering the app or closing a sheet.
- [ ] Initialize an existing Supabase session, merge cloud/local state after sign-in, and preserve local data on every error.
- [ ] Run all tests and real browser checks.

### Task 5: Verification and documentation refresh

**Files:**
- Modify: `README.md`

- [ ] Verify guest study, theme persistence, email validation, unavailable-service feedback, and mobile setting controls in a real browser.
- [ ] Record the exact Supabase credentials still required and distinguish unconfigured external authentication from local verification.
- [ ] Run `npm test` and report the outcome.
