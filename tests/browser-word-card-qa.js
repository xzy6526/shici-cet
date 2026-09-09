async (page) => {
  const report = { checks: [], viewports: {}, consoleErrors: [], pageErrors: [] };
  const check = (condition, message) => {
    if (!condition) throw new Error(message);
    report.checks.push(message);
  };
  page.on('console', (message) => {
    if (message.type() === 'error') report.consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => report.pageErrors.push(error.message));

  await page.goto('http://127.0.0.1:5173/');
  await page.addInitScript(() => {
    const seed = sessionStorage.getItem('__shici_qa_seed');
    if (!seed) return;
    localStorage.setItem('shici-cet-state-v3', seed);
    sessionStorage.removeItem('__shici_qa_seed');
  });
  const reloadWithState = async (state) => {
    await page.evaluate((nextState) => sessionStorage.setItem('__shici_qa_seed', JSON.stringify(nextState)), state);
    await page.reload();
  };
  await reloadWithState({ schemaVersion: 2, screen: 'home', settings: { themePreference: 'system' } });
  await page.locator('.home-screen').waitFor();
  check(await page.locator('#app').isVisible(), '首页真实渲染');

  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' });
  await page.waitForTimeout(80);
  check(await page.locator('html[data-theme="light"]').count() === 1, '系统浅色实时生效');
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'no-preference' });
  await page.waitForTimeout(80);
  check(await page.locator('html[data-theme="dark"]').count() === 1, '系统深色实时生效');

  await page.locator('[data-action="library"]').click();
  await page.locator('[data-library-search]').fill('issue');
  const issueRow = page.locator('[data-library-item]:not([hidden])').filter({ hasText: 'issue' }).first();
  await issueRow.waitFor();
  const rowText = await issueRow.innerText();
  check(rowText.includes('n. / v.'), '搜索行显示多词性');
  check(rowText.includes('问题；议题'), '搜索行显示四六级优先义');
  await issueRow.click();
  const detail = page.locator('.word-detail-sheet');
  await detail.waitFor();
  const detailText = await detail.innerText();
  check(detailText.includes('英式 UK') && detailText.includes('美式 US'), '详情显示双音标区域');
  check(detailText.includes('常见搭配') && detailText.includes('为什么推荐'), '详情显示学习内容和推荐原因');
  check((detailText.match(/Cost remains a major issue/g) || []).length === 1, '详情不重复显示主语境');
  check(await page.locator('.word-detail-sheet [data-action="close-word-detail"]').evaluate((element) => document.activeElement === element), '详情打开后焦点进入弹层');
  await page.keyboard.press('Escape');
  check(await page.locator('.word-detail-sheet').count() === 0, 'Escape 关闭详情');
  for (const action of ['profile', 'home', 'library', 'profile', 'home']) {
    await page.locator(`.nav-item[data-action="${action}"]`).click();
  }
  check(await page.locator('.home-screen').count() === 1, '连续导航最终回到首页');
  check(await page.locator('.nav-indicator').count() === 1, '连续导航始终只有一个滑动胶囊');
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.locator('.nav-item[data-action="library"]').click();
  await page.locator('.nav-item[data-action="home"]').click();
  check(await page.locator('.home-screen').count() === 1 && await page.locator('.nav-indicator').count() === 1, '减少动态时导航状态稳定');
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'no-preference' });

  await reloadWithState({
    schemaVersion: 2,
    screen: 'study',
    queue: [342, 745, 756],
    queueStages: ['new', 'new', 'new'],
    queueIndex: 0,
    completed: [],
    revealed: false,
    rating: null,
    moreOpen: false,
    dailyTask: null,
    settings: { themePreference: 'system' },
  });
  await page.locator('.study-screen').waitFor();
  check((await page.locator('.word-line h1').innerText()) === 'issue', '隔离会话显示真实词 issue');
  check((await page.locator('.study-progress-copy strong').innerText()).includes('01 / 03'), '初始进度正确');
  check((await page.locator('.word-study-meta').innerText()).includes('n. / v.'), '揭晓前显示词性');
  check(!(await page.locator('.study-main').innerText()).includes('问题；议题'), '揭晓前不显示中文释义');
  check(await page.locator('.rating-button').count() === 3, '揭晓前三个评分按钮唯一显示');
  const wordTopBeforeRating = (await page.locator('.word-line').boundingBox()).y;

  for (const width of [320, 375, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    const metrics = await page.evaluate(() => {
      const heading = document.querySelector('.word-line h1')?.getBoundingClientRect();
      const buttons = [...document.querySelectorAll('.rating-button')].map((item) => item.getBoundingClientRect());
      return {
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        headingRight: heading?.right,
        minButtonWidth: Math.min(...buttons.map((item) => item.width)),
        buttonsRight: Math.max(...buttons.map((item) => item.right)),
      };
    });
    report.viewports[width] = metrics;
    check(metrics.overflow <= 1 && metrics.headingRight <= width + 1 && metrics.buttonsRight <= width + 1, `${width}px 揭晓前无横向溢出`);
    check(metrics.minButtonWidth >= 80, `${width}px 评分按钮可点击`);
  }

  await page.locator('[data-action="rate-known"]').click();
  check((await page.locator('.study-progress-copy strong').innerText()).includes('01 / 03'), '弱词插入不增加今日任务总数');
  const wordTopAfterRating = (await page.locator('.word-line').boundingBox()).y;
  check(Math.abs(wordTopAfterRating - wordTopBeforeRating) <= 1, '评分后单词位置保持稳定');
  const knownText = await page.locator('.answer-stack').innerText();
  check(knownText.includes('问题；议题') && knownText.includes('示例语境'), '认识：显示核心义和一个示例语境');
  check(!knownText.includes('常用搭配') && !knownText.includes('这样记'), '认识：默认保持轻量');
  check(await page.locator('.answer-stack').count() === 1, '评分后只有一个答案 DOM');
  check(await page.locator('.rating-button').count() === 0, '评分按钮只生效一次');

  await page.locator('[data-action="next"]').click();
  check((await page.locator('.word-line h1').innerText()) === 'address', '下一个只推进到 address');
  check((await page.locator('.study-progress-copy strong').innerText()).includes('02 / 03'), '第二词进度正确');
  await page.locator('[data-action="rate-fuzzy"]').click();
  const fuzzyText = await page.locator('.answer-stack').innerText();
  check(fuzzyText.includes('在阅读中常表示') && fuzzyText.includes('常见搭配'), '模糊：显示解释和搭配');
  check(!fuzzyText.includes('这样记'), '模糊：默认不增加记忆提示');
  await page.reload();
  await page.locator('.study-screen').waitFor();
  check((await page.locator('.word-line h1').innerText()) === 'address', '刷新恢复当前单词');
  check(await page.locator('.answer-stack').count() === 1 && (await page.locator('.study-progress-copy strong').innerText()).includes('02 / 03'), '刷新恢复揭晓状态、进度和弱词队列');

  await page.locator('[data-action="next"]').click();
  check((await page.locator('.word-line h1').innerText()) === 'charge', '下一个只推进到 charge');
  check((await page.locator('.study-progress-copy strong').innerText()).includes('03 / 03'), '第三词进度不因薄弱词插入而膨胀');
  await page.locator('[data-action="rate-unknown"]').click();
  const unknownText = await page.locator('.answer-stack').innerText();
  check(unknownText.includes('常见搭配') && unknownText.includes('这样记') && unknownText.includes('熟词僻义'), '不认识：显示完整学习层');
  check(!unknownText.includes('undefined'), '答案没有 undefined');

  await page.evaluate(() => { window.__answerNode = document.querySelector('.answer-stack'); });
  await page.locator('[data-action="more"]').click();
  check(await page.locator('[data-answer-more]').isVisible(), '展开更多可见');
  check(await page.evaluate(() => window.__answerNode === document.querySelector('.answer-stack')), '展开更多不重建答案 DOM');
  check((await page.locator('[data-answer-more]').innerText()).includes('更多词义'), '更多内容包含次要义项');
  check(((await page.locator('.answer-stack').innerText()).match(/The library does not charge students/g) || []).length === 1, '展开更多不重复显示主语境');

  const wordBeforeTheme = await page.locator('.word-line h1').innerText();
  await page.emulateMedia({ colorScheme: 'light' });
  await page.waitForTimeout(80);
  check(await page.locator('html[data-theme="light"]').count() === 1, '答案展开时可切到浅色');
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.waitForTimeout(80);
  check(await page.locator('html[data-theme="dark"]').count() === 1, '答案展开时可切回深色');
  check((await page.locator('.word-line h1').innerText()) === wordBeforeTheme && await page.locator('[data-answer-more]').isVisible(), '主题切换不重置当前词和展开状态');

  for (const width of [320, 375, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    const metrics = await page.evaluate(() => {
      const footer = document.querySelector('.study-footer')?.getBoundingClientRect();
      return {
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        footerLeft: footer?.left,
        footerRight: footer?.right,
        nextHeight: document.querySelector('[data-action="next"]')?.getBoundingClientRect().height,
      };
    });
    report.viewports[`${width}-answer`] = metrics;
    check(metrics.overflow <= 1 && metrics.footerLeft >= -1 && metrics.footerRight <= width + 1, `${width}px 答案和底部操作无横向溢出`);
    check(metrics.nextHeight >= 44, `${width}px 下一个按钮触控高度合格`);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'C:/Users/xuziyan/.codex/visualizations/2026/09/05/01a06f00-574b-7113-98a6-07bfe4e7d8e4/exam-card-charge-dark.png', fullPage: true });
  check(report.consoleErrors.length === 0, '浏览器控制台无 error');
  check(report.pageErrors.length === 0, '页面无未捕获异常');
  return report;
}
