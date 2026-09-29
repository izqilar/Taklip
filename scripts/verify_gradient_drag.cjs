const { chromium } = require('playwright');
const BASE = 'http://localhost:5173';
const OUT = 'D:/MyWorkBuddy/2026-08-10-22-39-56/.wb_e2e_fill';
const fs = require('fs');
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  const log = (s) => console.log('[step] ' + s);

  const readHandles = async () => {
    const loc = page.locator('[data-testid="gradient-stop-handle"]');
    const n = await loc.count();
    const out = [];
    for (let i = 0; i < n; i++) {
      const h = loc.nth(i);
      out.push({
        id: await h.getAttribute('data-stop-id'),
        now: Number(await h.getAttribute('aria-valuenow')),
      });
    }
    return out;
  };

  try {
    await page.goto(BASE + '/login', { waitUntil: 'networkidle', timeout: 30000 });
    await page.fill('input[type=tel]', '13900001001');
    await page.fill('input[type=password]', 'Test123456');
    await page.click('button[type=submit]');
    await page.waitForURL('**/user/works', { timeout: 20000 });
    await sleep(1000);

    const card = page.locator('[class*="_root_"]').first();
    await card.scrollIntoViewIfNeeded();
    await card.click();
    await sleep(400);
    await card.getByRole('button', { name: /编辑|Edit/i }).first().click();
    await page.waitForURL('**/editor/**', { timeout: 20000 });
    await sleep(2200);
    log('editor loaded');

    const shapeLabel = page.getByText('形状', { exact: true }).first();
    await shapeLabel.hover();
    await sleep(600);
    const shapeItem = page.locator('div.absolute.z-50 button').first();
    await shapeItem.waitFor({ timeout: 8000 });
    await shapeItem.click();
    await sleep(1000);
    log('shape inserted');

    const retry = page.getByRole('button', { name: /重试|Retry/i }).first();
    if (await retry.count()) { await retry.click(); await sleep(1000); log('clicked retry'); }

    // 选渐变填充
    await page.locator('[data-fill-type="gradient"]').first().click();
    await sleep(700);

    const track = page.locator('[data-testid="gradient-track"]');
    await track.scrollIntoViewIfNeeded();
    const tb = await track.boundingBox();
    log('track box=' + JSON.stringify(tb));

    // 33% 与 66% 处各加一个停靠点 → 共 4 个
    await page.mouse.click(tb.x + tb.width * 0.33, tb.y + tb.height / 2);
    await sleep(500);
    await page.mouse.click(tb.x + tb.width * 0.66, tb.y + tb.height / 2);
    await sleep(500);

    const before = await readHandles();
    log('BEFORE=' + JSON.stringify(before));

    // 找到约 66% 的把手（被拖目标）与其邻居（约 33%）
    const dragged = before.reduce((a, b) => (Math.abs(b.now - 66) < Math.abs(a.now - 66) ? b : a));
    const neighbor = before.reduce((a, b) =>
      (b.id !== dragged.id && Math.abs(b.now - 33) < Math.abs(a.now - 33) ? b : a), before[0]);
    log('draggedId=' + dragged.id + ' (pos ' + dragged.now + ')  neighborId=' + neighbor.id + ' (pos ' + neighbor.now + ')');

    // 拖动被拖滑块左侧到 ~12%（越过 33% 邻居）
    const draggedHandle = page.locator('[data-testid="gradient-stop-handle"][data-stop-id="' + dragged.id + '"]');
    const hb = await draggedHandle.boundingBox();
    log('dragged handle box=' + JSON.stringify(hb));
    const targetX = tb.x + tb.width * 0.12;
    const midY = hb.y + hb.height / 2;
    await page.mouse.move(hb.x + hb.width / 2, midY);
    await page.mouse.down();
    await page.mouse.move((hb.x + targetX) / 2, midY, { steps: 8 });
    await page.mouse.move(targetX, midY, { steps: 8 });
    await sleep(150);
    await page.mouse.up();
    await sleep(700);

    const after = await readHandles();
    log('AFTER=' + JSON.stringify(after));

    const draggedAfter = after.find((h) => h.id === dragged.id);
    const neighborAfter = after.find((h) => h.id === neighbor.id);
    log('draggedAfter.pos=' + draggedAfter.now + '  neighborAfter.pos=' + neighborAfter.now);

    const crossedToOtherSide = draggedAfter.now <= 20;        // 被拖滑块应越过邻居到达对侧(~12)
    const neighborUnchanged = Math.abs(neighborAfter.now - neighbor.now) <= 8; // 邻居不应被带着动
    const pass = crossedToOtherSide && neighborUnchanged;
    log('crossedToOtherSide=' + crossedToOtherSide + ' neighborUnchanged=' + neighborUnchanged);
    page.screenshot({ path: OUT + '/gradient_drag_after.png' });

    console.log('RESULT pass=' + pass + ' draggedId=' + dragged.id +
      ' draggedPosBefore=' + dragged.now + ' draggedPosAfter=' + draggedAfter.now +
      ' neighborPosBefore=' + neighbor.now + ' neighborPosAfter=' + neighborAfter.now);
  } catch (e) {
    console.log('TEST_ERROR: ' + (e && e.message ? e.message : e));
    try { await page.screenshot({ path: OUT + '/ERROR_gradient_drag.png' }); } catch {}
  } finally {
    console.log('CONSOLE_ERRORS=' + JSON.stringify(errors.slice(0, 20)));
    await browser.close();
  }
})();
