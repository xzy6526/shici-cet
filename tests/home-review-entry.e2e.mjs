// Run with a Playwright installation; PLAYWRIGHT_MODULE and BROWSER_PATH may
// point to an existing shared runtime. BASE_URL defaults to the local server.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_PATH || undefined });
try {
  for (const width of [390, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, colorScheme: width === 390 ? 'dark' : 'light' });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(() => {
      const seed = sessionStorage.getItem('review-entry-test-seed');
      if (seed) {
        localStorage.setItem('shici-cet-state-v3', seed);
        sessionStorage.removeItem('review-entry-test-seed');
      }
    });
    await page.goto(process.env.BASE_URL || 'http://127.0.0.1:5173/');
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle' });
    if (await page.locator('[data-assessment-skip]').count()) await page.locator('[data-assessment-skip]').click();
    await page.locator('[data-action="profile"]').click();
    await page.locator('[data-action="open-login"]').click();
    assert.equal(await page.locator('[data-login-email-form]').count(), 1, 'email login sheet opens without a runtime error');
    await page.locator('.login-sheet button[data-action="close-login"]').click();
    await page.locator('.nav-item[data-action="home"]').click();
    const review = () => page.locator('[data-action="start-review"]');
    const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('shici-cet-state-v3')));
    assert.equal(await review().isEnabled(), true);
    assert.equal(await review().innerText(), '开始复习');
    const arrow = await review().locator('svg').innerHTML();
    const before = await saved();
    await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem('shici-cet-state-v3'));
      // A previous review must not mark the unfinished current batch complete.
      state.dailyTask.reviewWordIds = [999];
      state.dailyTask.completedReviewIds = [999];
      sessionStorage.setItem('review-entry-test-seed', JSON.stringify(state));
    });
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await review().isEnabled(), true, 'past review records must not disable the current unfinished batch');
    assert.equal(await review().innerText(), '开始复习');
    await page.evaluate((state) => sessionStorage.setItem('review-entry-test-seed', JSON.stringify(state)), before);
    await page.reload({ waitUntil: 'networkidle' });
    await review().focus();
    await page.keyboard.press('Enter');
    assert.match(await page.locator('.toast').innerText(), /暂时没有待复习的词/);
    assert.deepEqual(await saved(), before, 'empty review must not create or change a study session');
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await review().isEnabled(), true);
    await page.locator('[data-action="start"]').click();
    for (let index = 0; index < 20; index += 1) {
      await page.waitForTimeout(100);
      await page.locator(`[data-action="${width === 390 && index === 0 ? 'rate-unknown' : 'rate-known'}"]`).click();
      await page.waitForTimeout(100);
      await page.locator('[data-action="next"]').click();
      if (index === 9) {
        await page.locator('[data-action="home"]').click();
        assert.equal(await review().isEnabled(), true, 'unfinished batch must keep the entry actionable');
        assert.doesNotMatch(await review().innerText(), /已复习/);
        await page.locator('[data-action="start"]').click();
      }
    }
    await page.locator('.complete-screen').waitFor();
    await page.locator('[data-action="home"]').click();
    if (width === 390) {
      assert.equal(await review().isEnabled(), true, 'weak words still need review after 20 new words');
      assert.match(await review().innerText(), /开始复习 · 1/);
      await review().click();
      assert.equal((await saved()).queue.length, 1);
      await page.locator('[data-action="rate-known"]').click();
      await page.waitForTimeout(100);
      await page.locator('[data-action="next"]').click();
      await page.locator('[data-action="home"]').click();
    }
    assert.equal(await review().isDisabled(), true);
    assert.equal(await review().innerText(), '今日已复习');
    assert.notEqual(await review().locator('svg').innerHTML(), arrow);
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await review().isDisabled(), true, 'completion survives reload');
    assert.equal(await page.locator('.nav-indicator').count(), 1);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ width, newWords: 20, reviewed: width === 390 ? 1 : 0, emailLoginSheet: true, initialClickable: true, emptyFeedback: true, completionAfterBatch: true, errors }));
    await page.close();
  }
} finally {
  await browser.close();
}
