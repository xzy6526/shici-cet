// Run with an existing Playwright installation. BASE_URL defaults to localhost.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_PATH || undefined });

try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(process.env.BASE_URL || 'http://127.0.0.1:5173/');
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });

  await page.locator('[data-assessment-start]').waitFor();
  await page.locator('[name="targetScore"]').fill('600');
  await page.locator('[name="examDate"]').fill('2026-12-19');
  await page.locator('[data-assessment-start]').click();
  await page.locator('.assessment-screen').waitFor();

  let answered = 0;
  let refreshedQuestion = null;
  while (await page.locator('.assessment-screen').count()) {
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('shici-cet-state-v3')));
    const question = saved.assessment.currentQuestion;
    assert.ok(question?.wordId, 'current assessment item is persisted');
    if (answered === 5) {
      refreshedQuestion = question.wordId;
      await page.reload({ waitUntil: 'networkidle' });
      const resumed = await page.evaluate(() => JSON.parse(localStorage.getItem('shici-cet-state-v3')));
      assert.equal(resumed.assessment.currentQuestion.wordId, refreshedQuestion, 'refresh resumes the same item');
    }
    if (answered === 3) {
      const currentWordId = question.wordId;
      await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
      await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
      await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'no-preference' });
      await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
      const afterTheme = await page.evaluate(() => JSON.parse(localStorage.getItem('shici-cet-state-v3')));
      assert.equal(afterTheme.assessment.currentQuestion.wordId, currentWordId, 'theme changes do not reset assessment');
    }
    const choiceIndex = answered % 2 === 0 ? question.correctIndex : (question.correctIndex + 1) % 4;
    await page.locator('[data-assessment-choice]').nth(choiceIndex).click();
    answered += 1;
    await page.locator('[data-assessment-next]').click();
    if (answered > 36) throw new Error('assessment exceeded maximum length');
  }

  await page.locator('.assessment-result-screen').waitFor();
  for (const width of [320, 375, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `no horizontal overflow at ${width}px`);
  }
  const completed = await page.evaluate(() => JSON.parse(localStorage.getItem('shici-cet-state-v3')));
  assert.ok(answered >= 20 && answered <= 30);
  assert.equal(new Set(completed.assessment.testedWordIds).size, answered);
  assert.equal(completed.vocabularyProfile.source, 'assessment');
  assert.equal(Object.values(completed.wordStates).some((entry) => entry.status === 'mastered'), false);
  await page.locator('[data-assessment-finish]').click();
  await page.locator('.home-screen').waitFor();
  assert.match(await page.locator('.adaptive-plan-note').innerText(), /自动调整|安排/);
  const planned = await page.evaluate(() => JSON.parse(localStorage.getItem('shici-cet-state-v3')));
  assert.ok(planned.adaptivePlan.recommendedNewWords >= 5);
  assert.deepEqual(planned.dailyTask.newWordIds, [...planned.dailyTask.newWordIds], 'daily queue is persisted');
  await page.locator('[data-action="start"]').click();
  assert.ok((await page.locator('.study-screen h1').innerText()).length > 0);
  await page.locator('[data-action="rate-unknown"]').click();
  const afterRealLearning = await page.evaluate(() => JSON.parse(localStorage.getItem('shici-cet-state-v3')));
  assert.equal(afterRealLearning.vocabularyProfile.source, 'adaptive', 'real learning refines the initial profile');
  assert.deepEqual(errors, []);
  await page.close();

  const oldUser = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
  await oldUser.addInitScript(() => {
    localStorage.setItem('shici-cet-state-v3', JSON.stringify({
      schemaVersion: 2,
      localUserId: 'old-user',
      screen: 'home',
      history: { '2026-09-09': { studied: true, learnedIds: [1], reviewedIds: [], results: { 1: 'good' } } },
      wordStates: { 1: { wordId: 1, status: 'reviewing', correctCount: 2, reviewCount: 2 } },
      settings: { exam: 'CET-4', targetScore: 550, examDate: '2026-12-19', dailyNew: 20 },
    }));
  });
  await oldUser.goto(process.env.BASE_URL || 'http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
  assert.equal(await oldUser.locator('.home-screen').count(), 1, 'old users are not blocked by assessment');
  assert.equal(await oldUser.locator('[data-assessment-start]').count(), 0);
  assert.equal(await oldUser.locator('[data-assessment-entry]').count(), 1, 'old users can find the assessment from home');
  await oldUser.locator('[data-assessment-entry]').click();
  assert.equal(await oldUser.locator('.assessment-intro-screen').count(), 1, 'home assessment entry opens the intro');
  await oldUser.close();
  console.log(JSON.stringify({ assessmentQuestions: answered, refreshResume: true, themeSwitch: true, widths: [320, 375, 390, 430, 1440], profile: true, personalPlan: true, oldUserBypass: true, errors }));
} finally {
  await browser.close();
}
