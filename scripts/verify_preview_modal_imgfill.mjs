/**
 * 验证「编辑器内预览弹窗」对文本图片填充的渲染（用户投诉 #2：预览窗口不显示图片）。
 *
 * 用法：node scripts/verify_preview_modal_imgfill.mjs [projectId]
 */
import pw from 'file:///C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/playwright/index.js';
import fs from 'node:fs';

const { chromium } = pw;
const BASE = 'http://localhost:5173';
const PROJECT = process.argv[2] || 'e2e_parity_fixture';
fs.mkdirSync('shots', { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const boot = await ctx.newPage();
await boot.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await boot.evaluate(async () => {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '13900001001', password: 'Test123456' }),
  });
  const d = await res.json();
  localStorage.setItem('access_token', d.accessToken || '');
  localStorage.setItem('refresh_token', d.refreshToken || '');
  localStorage.setItem('user_info', JSON.stringify(d.user || {}));
});

const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`${BASE}/editor/${PROJECT}`, { waitUntil: 'networkidle' });
await page.waitForSelector('canvas', { timeout: 40000 });
await page.waitForTimeout(2000);

// 点击「预览」按钮（编辑器顶栏）
let opened = false;
for (const sel of ['button:has-text("预览")', '[title*="预览"]', 'button:has-text("Preview")']) {
  const el = await page.$(sel);
  if (el) { await el.click().catch(() => {}); opened = true; break; }
}
check('找到并点击「预览」入口', opened);
await page.waitForTimeout(3000);

const info = await page.evaluate(() => {
  const spans = [...document.querySelectorAll('span')].filter((s) => {
    const cs = getComputedStyle(s);
    return (cs.webkitBackgroundClip === 'text' || cs.backgroundClip === 'text') && cs.backgroundImage && cs.backgroundImage !== 'none';
  });
  return spans.map((s) => {
    const cs = getComputedStyle(s);
    return { text: (s.textContent || '').slice(0, 8), bgSize: cs.backgroundSize, bgRepeat: cs.backgroundRepeat, bgIsData: cs.backgroundImage.includes('data:') || cs.backgroundImage.includes('.webp') || cs.backgroundImage.includes('/uploads/') };
  });
});
if (await page.$('[role="dialog"]')) {
  const dlg = await page.$('[role="dialog"]');
  await dlg.screenshot({ path: 'shots/verify_preview_modal.png' });
} else {
  await page.screenshot({ path: 'shots/verify_preview_modal.png' });
}

check('预览弹窗：无运行时报错', errs.length === 0, errs.join(' | '));
check('预览弹窗：存在文本图片填充层（background-clip:text）', info.length > 0, `found=${info.length}`);
check('预览弹窗：填充层确实渲染出图片（非空白）', info.some((s) => s.bgIsData), JSON.stringify(info.slice(0, 2)));

function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  → ' + detail : ''}`);
  if (!ok) process.exitCode = 1;
}

console.log('\nspan 明细:', JSON.stringify(info, null, 1));
await browser.close();
