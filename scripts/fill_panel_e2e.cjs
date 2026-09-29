const { chromium } = require('playwright');
const BASE = 'http://localhost:5173';
const OUT = 'D:/MyWorkBuddy/2026-08-10-22-39-56/.wb_e2e_fill';
const fs = require('fs');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  const log = (s) => console.log('[step] ' + s);

  try {
    await page.goto(BASE + '/login', { waitUntil: 'networkidle', timeout: 30000 });
    await page.fill('input[type=tel]', '13900001001');
    await page.fill('input[type=password]', 'Test123456');
    await page.click('button[type=submit]');
    await page.waitForURL('**/user/works', { timeout: 20000 });
    await page.waitForTimeout(1200);

    const card = page.locator('[class*="_root_"]').first();
    await card.scrollIntoViewIfNeeded();
    await card.click();
    await page.waitForTimeout(500);
    await card.getByRole('button', { name: /编辑|Edit/i }).first().click();
    await page.waitForURL('**/editor/**', { timeout: 20000 });
    await page.waitForTimeout(2500);
    log('editor loaded');

    const shapeLabel = page.getByText('形状', { exact: true }).first();
    await shapeLabel.hover();
    await page.waitForTimeout(700);
    const shapeItem = page.locator('div.absolute.z-50 button').first();
    await shapeItem.waitFor({ timeout: 8000 });
    await shapeItem.click();
    await page.waitForTimeout(1200);
    log('shape inserted');

    // 画布受既有 renderElement hooks 问题影响会进 ErrorBoundary；点「重试」重挂载后计数稳定
    const retry = page.getByRole('button', { name: /重试|Retry/i }).first();
    if (await retry.count()) { await retry.click(); await page.waitForTimeout(1200); log('clicked retry'); }

    const n = await page.locator('[data-fill-type]').count();
    const labels = await page.locator('[data-fill-type]').evaluateAll((els) => els.map((e) => e.getAttribute('data-fill-type')));
    log('fillTypeCount=' + n + ' labels=' + JSON.stringify(labels));

    // 1) 渐变：含渐变类型/角度/渐变条/停靠点颜色/位置/颜色层级列表
    await page.locator('[data-fill-type="gradient"]').first().click();
    await page.waitForTimeout(900);
    await page.screenshot({ path: OUT + '/A_gradient_top.png' });
    const stopList = page.locator('[data-testid="gradient-stop-list"]');
    if (await stopList.count()) {
      await stopList.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      log('stop rows = ' + await stopList.locator('[data-stop-row], li, > *').count());
      await page.screenshot({ path: OUT + '/B_gradient_stoplist.png' });
    }

    // 2) 视频
    await page.locator('[data-fill-type="video"]').first().click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: OUT + '/C_video.png' });

    // 3) 混合
    await page.locator('[data-fill-type="blend"]').first().click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: OUT + '/D_blend.png' });

    // 4) 图案
    await page.locator('[data-fill-type="pattern"]').first().click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: OUT + '/E_pattern.png' });

    // 5) 暗色主题下回看渐变面板（验证集中式暗色覆盖层对新控件生效）
    await page.locator('[data-fill-type="gradient"]').first().click();
    await page.waitForTimeout(400);
    const darkToggle = page.locator('button[title*="深色"]').first();
    if (await darkToggle.count()) {
      await darkToggle.click();
      await page.waitForTimeout(900);
      await page.screenshot({ path: OUT + '/F_gradient_dark.png' });
      const diag = await page.evaluate(() => {
        const chain = [];
        let el = document.querySelector('[data-fill-type]');
        while (el && chain.length < 14) {
          chain.push({ tag: el.tagName, cls: String(el.className || '').slice(0, 90), bg: getComputedStyle(el).backgroundColor });
          el = el.parentElement;
        }
        return { htmlClass: document.documentElement.className, chain };
      });
      log('DARK_DIAG=' + JSON.stringify(diag));
    } else { log('dark toggle not found'); }

    console.log('RESULT fillTypeCount=' + n + ' labels=' + JSON.stringify(labels));
  } catch (e) {
    console.log('TEST_ERROR: ' + (e && e.message ? e.message : e));
    try { await page.screenshot({ path: OUT + '/ERROR.png' }); } catch {}
  } finally {
    console.log('CONSOLE_ERRORS=' + JSON.stringify(errors.slice(0, 20)));
    await browser.close();
  }
})();
