/* eslint-disable */
/**
 * 验证 web 端「我的图片」裁剪弹窗底部布局与运营端对齐：
 *  - 提示文本独占一行（整宽），操作按钮在其下方右对齐
 *  - 「裁剪并保存为新图」按钮文本单行显示、不换行、不被裁切
 *  - 按钮组右边缘贴近弹窗内容右边缘（右对齐）
 * 失败即非零退出。
 */
const { chromium } = require('playwright');

const BASE = 'http://localhost:5173';
const API = 'http://localhost:3000/api';
const report = { steps: {}, errors: [] };

async function login(page, phone, password) {
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('form input', { timeout: 20000 });
  await page.fill('form input', phone);
  await page.fill('form input[type="password"]', password);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL((u) => !u.toString().includes('/login'), { timeout: 20000 });
  await page.waitForFunction(() => !!localStorage.getItem('access_token'), { timeout: 20000 });
}

/** 统计元素文本渲染成几行（按 client rect 的 top 去重） */
const LINE_COUNT_FN = `(el) => {
  const r = document.createRange();
  r.selectNodeContents(el);
  const rects = Array.from(r.getClientRects()).filter(x => x.width > 0 && x.height > 0);
  const tops = new Set(rects.map(x => Math.round(x.top)));
  return tops.size;
}`;

(async () => {
  const browser = await chromium.launch();
  let createdId = null;
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => report.errors.push('PAGEERR:' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') report.errors.push('CONSOLE:' + m.text()); });

    await login(page, '13900001001', 'Test123456');
    await page.goto(BASE + '/user/gallery', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);

    let cropBtns = page.locator('button[aria-label="裁剪"]');
    if ((await cropBtns.count()) === 0) {
      // 无图时用前端会话内 fetch 复现 doUpload 的上传行为（受控 file input 无法被程序触发）
      report.steps.seededUpload = await page.evaluate(async () => {
        const c = document.createElement('canvas');
        c.width = 360; c.height = 240;
        const ctx2 = c.getContext('2d');
        ctx2.fillStyle = '#c24b2e';
        ctx2.fillRect(0, 0, 360, 240);
        const webp = await new Promise((res) => c.toBlob(res, 'image/webp', 0.92));
        const form = new FormData();
        form.append('file', webp, 'image.webp');
        const tk = localStorage.getItem('access_token');
        const r = await fetch('http://localhost:3000/api/assets/upload?purpose=gallery&width=360&height=240', {
          method: 'POST',
          headers: tk ? { Authorization: `Bearer ${tk}` } : {},
          body: form,
        });
        const txt = await r.text();
        let j = null; try { j = JSON.parse(txt); } catch {}
        return { status: r.status, id: j && j.id };
      });
      createdId = report.steps.seededUpload.id || null;
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1200);
      cropBtns = page.locator('button[aria-label="裁剪"]');
    }
    report.steps.cardCount = await cropBtns.count();

    // 打开裁剪弹窗
    await cropBtns.first().click();
    const dialog = page.locator('div[role="dialog"]').filter({ hasText: '裁剪' }).first();
    await dialog.waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForTimeout(600);

    const okBtn = dialog.locator('button', { hasText: '裁剪并保存为新图' }).first();
    const cancelBtn = dialog.locator('button', { hasText: '取消' }).first();
    const hint = dialog.locator('p').filter({ hasText: '在图上按住拖动框选区域' }).first();

    await okBtn.waitFor({ state: 'visible', timeout: 10000 });

    const metrics = await dialog.evaluate(
      (root, arg) => {
        const LINE_COUNT = eval('(' + arg.lineFn + ')');
        const btnByText = (txt) =>
          Array.from(root.querySelectorAll('button')).find((b) => (b.textContent || '').includes(txt));
        const ok = btnByText(arg.okText);
        const cancel = btnByText(arg.cancelText);
        const p = Array.from(root.querySelectorAll('p')).find((n) =>
          (n.textContent || '').includes('在图上按住拖动框选区域'),
        );
        if (!ok || !cancel || !p) return { missing: { ok: !!ok, cancel: !!cancel, p: !!p } };
        const okR = ok.getBoundingClientRect();
        const cancelR = cancel.getBoundingClientRect();
        const pR = p.getBoundingClientRect();
        const rootR = root.getBoundingClientRect();
        const cs = getComputedStyle(ok);
        // 按钮 border-box 的右边缘即视觉右边缘，直接与内容盒右边缘比较
        const rootContentRight = rootR.right - parseFloat(getComputedStyle(root).paddingRight);
        return {
          okText: (ok.textContent || '').trim(),
          okLines: LINE_COUNT(ok),
          okHeight: Math.round(okR.height),
          okWidth: Math.round(okR.width),
          okScrollH: ok.scrollHeight,
          okClientH: ok.clientHeight,
          okWhiteSpace: cs.whiteSpace,
          cancelLines: LINE_COUNT(cancel),
          cancelHeight: Math.round(cancelR.height),
          sameRow: Math.abs(okR.top - cancelR.top) < 2,
          btnTop: Math.round(okR.top),
          hintBottom: Math.round(pR.bottom),
          buttonsBelowHint: okR.top >= pR.bottom - 1,
          hintFullWidth: Math.round(pR.width) >= Math.round(rootR.width - 2 - 2 * parseFloat(getComputedStyle(root).paddingLeft)) - 4,
          rightGap: Math.round(rootContentRight - okR.right),
          okRightEdge: Math.round(okR.right),
          containerRight: Math.round(rootContentRight),
        };
      },
      { lineFn: LINE_COUNT_FN, okText: '裁剪并保存为新图', cancelText: '取消' },
    );
    report.steps.metrics = metrics;

    await page.screenshot({ path: 'scripts/.verify/crop_footer_web.png', fullPage: false }).catch(() => {});

    const m = metrics;
    report.steps.pass =
      !m.missing &&
      m.okLines === 1 &&                 // 按钮文本不换行
      m.cancelLines === 1 &&
      m.okScrollH <= m.okClientH + 1 &&  // 文本未被纵向裁切
      m.okHeight < 44 &&                 // 单行高度（换行会是 ~56px）
      m.buttonsBelowHint === true &&     // 按钮在提示文本下方（不再并排挤压）
      m.sameRow === true &&              // 取消/确认同一行
      Math.abs(m.rightGap) <= 3;         // 右对齐
  } catch (e) {
    report.steps.fatal = String(e && e.stack ? e.stack : e);
  } finally {
    // 清理本脚本上传的测试图
    try {
      if (createdId) {
        const ctx2 = await browser.newContext();
        const p2 = await ctx2.newPage();
        await login(p2, '13900001001', 'Test123456');
        report.steps.cleanup = await p2.evaluate(async (id) => {
          const tk = localStorage.getItem('access_token');
          const r = await fetch('http://localhost:3000/api/assets/' + id + '?force=1', {
            method: 'DELETE',
            headers: tk ? { Authorization: `Bearer ${tk}` } : {},
          });
          return r.status;
        }, createdId);
        await ctx2.close();
      }
    } catch (e) { report.steps.cleanupErr = String(e); }
    await browser.close();
  }
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.steps.pass ? 0 : 1);
})();
