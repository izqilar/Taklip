// 回归验证：EditorCanvas hooks 隐患修复
// 场景：在画布中连续插入 2 个形状（元素数 0→1→2），
// 修复前会在 EditorCanvas 的 .map() 中以普通函数调用 renderElement，
// 使父组件 hooks 数量随元素数变化 → 触发 "Rendered more hooks than during the previous render"。
// 修复后（renderElement → 正规组件 <ElementNode/>）每个元素独立持有 hooks，父组件 hooks 数量恒定。
const { chromium } = require('playwright');
const BASE = 'http://localhost:5173';
const OUT = 'D:/MyWorkBuddy/2026-08-10-22-39-56/.wb_e2e_fill';
const fs = require('fs');
fs.mkdirSync(OUT, { recursive: true });

const HOOKS_ERR = /Rendered more hooks than during the previous render/i;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  const log = (s) => console.log('[step] ' + s);

  // 插入一个形状：悬停「形状」菜单 → 点首个形状项
  async function insertShape(nth) {
    const shapeLabel = page.getByText('形状', { exact: true }).first();
    await shapeLabel.hover();
    await page.waitForTimeout(600);
    const shapeItem = page.locator('div.absolute.z-50 button').first();
    await shapeItem.waitFor({ timeout: 8000 });
    await shapeItem.click();
    await page.waitForTimeout(1200);
    log('shape #' + nth + ' inserted');
    // 检查是否出现 ErrorBoundary 重试按钮（渲染崩溃信号）
    const retry = page.getByRole('button', { name: /重试|Retry/i }).first();
    if (await retry.count()) {
      log('!! ErrorBoundary retry overlay appeared after shape #' + nth);
      return false;
    }
    return true;
  }

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

    const ok1 = await insertShape(1);
    const ok2 = await insertShape(2);

    await page.screenshot({ path: OUT + '/hooks_fix_after2shapes.png' });

    const hooksErrors = errors.filter((e) => HOOKS_ERR.test(e));
    const retrySeen = !(ok1 && ok2);
    log('total console/page errors = ' + errors.length);
    errors.slice(0, 20).forEach((e, i) => log('  err[' + i + '] ' + e.slice(0, 160)));

    const pass = hooksErrors.length === 0 && !retrySeen;
    console.log('RESULT pass=' + pass +
      ' hooksErrorCount=' + hooksErrors.length +
      ' errorBoundaryRetry=' + retrySeen +
      ' totalErrors=' + errors.length);
    await browser.close();
    process.exit(pass ? 0 : 1);
  } catch (e) {
    console.log('RESULT pass=false exception=' + (e && e.message ? e.message.slice(0, 200) : e));
    errors.slice(0, 10).forEach((er, i) => console.log('  err[' + i + '] ' + er.slice(0, 160)));
    await browser.close();
    process.exit(2);
  }
})();
