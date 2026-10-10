/* eslint-disable */
// 验证裁剪对话框「锚点拖拽调整尺寸」是否生效（修复后：resize 逻辑挂在舞台 onMouseMove）。
const { chromium } = require('playwright');

const BASE = 'http://localhost:5174';
const API = 'http://localhost:3000/api';
const report = { steps: {}, pass: false, errors: [] };

async function login(page, phone, password) {
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('form input', { timeout: 15000 });
  await page.fill('form input', phone);
  await page.fill('form input[type="password"]', password);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL((u) => !u.toString().includes('/login'), { timeout: 15000 });
  await page.waitForFunction(() => !!localStorage.getItem('h5_admin_token'), { timeout: 15000 });
}

async function readSelectionBox(page) {
  return page.evaluate(() => {
    const img = document.querySelector('img[alt="crop"]');
    if (!img) return null;
    const stage = img.parentElement;
    const sel = stage.children[1]; // fragment: [img, selectionDiv, ...handles]
    if (!sel) return null;
    const r = sel.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  });
}

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    page.on('pageerror', (e) => report.errors.push('PAGEERR:' + e.message));
    await login(page, '13800000001', 'dev123456');
    await page.goto(BASE + '/sp/gallery', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('input[type="file"]', { state: 'attached', timeout: 15000 });

    // 确保至少有一张图：用前端会话内 fetch 等价 doUpload（绕过 React 受控 file input）
    const uploaded = await page.evaluate(async () => {
      const c = document.createElement('canvas');
      c.width = 400; c.height = 300;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#2b6cb0'; ctx.fillRect(0, 0, 400, 300);
      ctx.fillStyle = '#fff'; ctx.fillRect(40, 40, 320, 220);
      const webp = await new Promise((res) => c.toBlob(res, 'image/webp', 0.92));
      const form = new FormData();
      form.append('file', webp, 'crop-test.webp');
      const tk = localStorage.getItem('h5_admin_token');
      const r = await fetch('http://localhost:3000/api/assets/upload?purpose=gallery&width=400&height=300', {
        method: 'POST', headers: tk ? { Authorization: `Bearer ${tk}` } : {}, body: form,
      });
      const j = await r.json().catch(() => null);
      return { status: r.status, id: j && j.id };
    });
    report.steps.upload = uploaded;
    await page.waitForTimeout(1200);

    // 打开第一张卡片的裁剪对话框（IconBtn 用 aria-label）
    await page.locator('button[aria-label="裁剪"]').first().click();
    await page.waitForSelector('img[alt="crop"]', { state: 'visible', timeout: 15000 });
    await page.waitForTimeout(500); // 等图片加载 + base 计算

    const stage = await page.locator('img[alt="crop"]').locator('xpath=..');
    const sbox = await stage.boundingBox();
    report.steps.stageBox = sbox;

    // 在舞台空区域框选一块选区（new 模式）
    const x1 = sbox.x + 60, y1 = sbox.y + 50;
    const x2 = sbox.x + 260, y2 = sbox.y + 200;
    await page.mouse.move(x1, y1);
    await page.mouse.down();
    await page.mouse.move(x2, y2, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(200);

    const before = await readSelectionBox(page);
    report.steps.selBefore = before;
    if (!before || before.width < 16 || before.height < 16) {
      throw new Error('选区未正确生成: ' + JSON.stringify(before));
    }

    // 抓取 se(右下) 锚点中心 = 选区右下角
    const seX = before.left + before.width;
    const seY = before.top + before.height;

    // 拖拽 se 锚点向内收紧 50px —— 修复后应能改变选区尺寸
    await page.mouse.move(seX, seY);
    await page.mouse.down();
    await page.mouse.move(seX - 50, seY - 50, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(200);

    const after = await readSelectionBox(page);
    report.steps.selAfter = after;

    const dW = before.width - after.width;
    const dH = before.height - after.height;
    report.steps.dW = Math.round(dW);
    report.steps.dH = Math.round(dH);

    // 判定：拖拽 se 锚点后，选区宽高应明显减小（说明锚点 resize 生效）
    report.pass = !!(
      after &&
      dW > 35 && dW < 65 &&
      dH > 35 && dH < 65
    );

    // 清理：关闭对话框并删除测试上传的图
    await page.keyboard.press('Escape');
    if (uploaded.id) {
      const del = await page.evaluate(async (id) => {
        const tk = localStorage.getItem('h5_admin_token');
        const r = await fetch('http://localhost:3000/api/assets/' + id, {
          method: 'DELETE', headers: tk ? { Authorization: `Bearer ${tk}` } : {},
        });
        return r.status;
      }, uploaded.id);
      report.steps.cleanupDelete = del;
    }
  } catch (e) {
    report.steps.fatal = String(e && e.stack ? e.stack : e);
  } finally {
    await browser.close();
  }
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.pass ? 0 : 1);
})();
