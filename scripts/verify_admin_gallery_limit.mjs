/**
 * verify_admin_gallery_limit.mjs
 * ---------------------------------------------------------------------------
 * 真机验证「达上限 → 引导去扩容」分支：运营端用户视角编辑作品时插入图片，
 * 若被视察用户的图库已达上限，弹窗必须显示「去扩容」入口且上传按钮禁用。
 *
 * 实施（非破坏性）：被视察用户用可解析的 test_user_alice。通过 Playwright 路由**拦截**
 * 浏览器发出的 /assets/quota 请求并改写为「已满」负载（used=limit），从而触发弹窗的
 * full 分支——与真实满额用户的运行时行为完全一致，且不动任何数据库。
 *
 * 前置：:3000 / :5174 已在跑；被视察用户 test_user_alice 至少有一个作品。
 * 用法：node scripts/verify_admin_gallery_limit.mjs
 * ---------------------------------------------------------------------------
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'shots');
const API = 'http://localhost:3000/api';
const ADMIN = 'http://localhost:5174';
const SUBJECT = 'test_user_alice';

let pass = 0;
let fail = 0;
const failed = [];
function check(id, title, ok, detail = '') {
  if (ok) { pass += 1; console.log(`PASS  ${id}  ${title}`); }
  else { fail += 1; failed.push(id); console.log(`FAIL  ${id}  ${title}`); if (detail) console.log(`      ${detail}`); }
}

const adminTokens = await (await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: '13800000002', password: 'dev123456' }) })).json();

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

// 拦截配额请求，改写为「已满」：used=limit（免费用户 6/6）
await page.route('**/assets/quota**', (route) =>
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ used: 6, limit: 6, role: 'USER', plan: 'FREE', tier: 0, tierKind: 'user' }),
  }),
);

const errors = [];
page.on('pageerror', (e) => {
  const s = String(e?.stack ?? '');
  if (/hdslb|bilibili|player\/main/.test(s)) return;
  if (/localhost|@fs\/|packages\//.test(s)) errors.push(e.message);
});
let fileChooserFired = 0;
page.on('filechooser', () => { fileChooserFired += 1; });

await page.addInitScript(([a, u]) => {
  localStorage.setItem('h5_admin_token', a);
  localStorage.setItem('h5_admin_user', JSON.stringify(u));
  localStorage.setItem('layer.view', 'user');
}, [adminTokens.accessToken, adminTokens.user]);

try {
  await page.goto(`${ADMIN}/user/works`, { waitUntil: 'domcontentloaded' });
  const acc = page.locator('.acc').first();
  await acc.waitFor({ timeout: 25000 });
  await acc.click();
  await page.waitForTimeout(500);
  await page.locator('.ap-mode', { hasText: '超级管理员' }).first().click();
  await page.waitForTimeout(600);

  const search = page.locator('[data-testid="objscope-search"] input, input[data-testid="objscope-search"]').first();
  await search.waitFor({ timeout: 25000 });
  await search.click();
  await search.fill(SUBJECT);
  await page.waitForTimeout(2000);
  const opt = page.locator('.ant-select-item-option').first();
  if ((await opt.count()) > 0) await opt.click();
  else await page.keyboard.press('Enter');
  await page.waitForTimeout(3000);

  const editBtn = page.locator('button', { hasText: '编辑' }).first();
  await editBtn.waitFor({ timeout: 30000 });
  await editBtn.click({ force: true });
  await page.waitForTimeout(4000);

  const multimediaBtn = page.locator('button', { hasText: '多媒体' }).first();
  await multimediaBtn.waitFor({ timeout: 30000 });
  await multimediaBtn.click();
  await page.waitForTimeout(800);
  await page.locator('button', { hasText: '图片' }).first().click();

  const pickerTitle = page.getByText('选择图片', { exact: true }).first();
  let pickerShown = false;
  try { await pickerTitle.waitFor({ timeout: 12000 }); pickerShown = true; } catch { /* noop */ }
  check('L1', '达上限场景下弹出「选择图片」弹窗', pickerShown);
  check('L2', '达上限场景**未**触发原生文件框（配额绕过未复发）', fileChooserFired === 0, `filechooser=${fileChooserFired}`);

  if (pickerShown) {
    await page.waitForTimeout(2500);
    const bodyText = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
    const hasUpgrade = bodyText.includes('去扩容');
    const hasFullHint = /已达上限/.test(bodyText);
    const uploadDisabled = await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('label'));
      const up = labels.find((l) => l.textContent && l.textContent.includes('上传图片'));
      const inp = up?.querySelector('input[type=file]');
      return inp ? inp.disabled : null;
    });
    check('L3', '达上限时显示「去扩容」入口（引导扩容）', hasUpgrade, `hasUpgrade=${hasUpgrade}`);
    check('L4', '达上限时显示「已达上限」提示', hasFullHint);
    check('L5', '达上限时上传按钮禁用（uploadDisabled=' + uploadDisabled + '）', uploadDisabled === true, `uploadDisabled=${uploadDisabled}`);
    console.log(`      去扩容=${hasUpgrade}，已达上限提示=${hasFullHint}，上传禁用=${uploadDisabled}`);
  }
  check('L6', '无项目侧运行时异常', errors.length === 0, errors.slice(0, 2).join(' | '));

  fs.mkdirSync(OUT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(OUT_DIR, 'admin-gallery-limit.png') });
} finally {
  await browser.close();
}

console.log('');
console.log('-------------------------------------------------------------');
console.log(`合计：${pass + fail} 项   PASS ${pass}   FAIL ${fail}`);
if (failed.length) console.log(`失败项：${failed.join(', ')}`);
console.log('-------------------------------------------------------------');
process.exit(fail === 0 ? 0 : 1);
