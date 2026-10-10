/**
 * verify_admin_gallery_pickflow.mjs
 * ---------------------------------------------------------------------------
 * 运营端（用户视角）编辑器「新增图片 / 更换图片」图库选择器弹窗实机验证。
 *
 * 根因回顾：GalleryPickerModal 原为 z-[80]，但画布包裹层 .editor-canvas-wrap 为
 * position:fixed; z-index:1000，导致弹窗被画布盖住、不可见不可点 → 用户感知"无法唤起弹窗"。
 * 修复：弹窗 z-[1100]、PreviewModal/CropModal zIndex={1200}。
 *
 * 关键：Playwright 的 click 做遮挡检查，成功=弹窗在画布之上、可点。
 * 另：work 封面「更换」按钮(class border-blue-200)与图片元素「替换」按钮(class bg-blue-500)
 * 文本不同（更换 vs 替换），须用精确选择器，避免误点封面按钮触发原生框。
 *
 * 判定：两条路径都唤起「选择图片」弹窗，且全程不触发原生 filechooser。
 * 用法：node scripts/verify_admin_gallery_pickflow.mjs
 * ---------------------------------------------------------------------------
 */
import { chromium } from 'playwright';

const API = 'http://localhost:3000/api';
const ADMIN = 'http://localhost:5174';
const SUBJECT = process.env.SUBJECT ?? 'test_user_alice';

let pass = 0, fail = 0; const failed = [];
function check(id, title, ok, detail = '') {
  if (ok) { pass += 1; console.log(`PASS  ${id}  ${title}`); }
  else { fail += 1; failed.push(id); console.log(`FAIL  ${id}  ${title}`); if (detail) console.log(`      ${detail}`); }
}

const adminTokens = await (await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: '13800000002', password: 'dev123456' }) })).json();
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => { const s = String(e?.stack ?? ''); if (/hdslb|bilibili|player\/main/.test(s)) return; if (/localhost|@fs\/|packages\//.test(s)) errors.push(e.message); });
let fileChooserFired = 0;
page.on('filechooser', async (fc) => {
  fileChooserFired += 1;
  try {
    const html = await fc.element().evaluate((el) => (el.closest('button,label')?.outerHTML || el.outerHTML).slice(0, 200));
    console.log('      [!!] filechooser 触发，来源：', html);
  } catch { /* ignore */ }
});
await page.addInitScript(([a, u]) => { localStorage.setItem('h5_admin_token', a); localStorage.setItem('h5_admin_user', JSON.stringify(u)); localStorage.setItem('layer.view', 'user'); }, [adminTokens.accessToken, adminTokens.user]);

try {
  // 进入作品编辑器
  await page.goto(`${ADMIN}/user/works`, { waitUntil: 'domcontentloaded' });
  await page.locator('.acc').first().waitFor({ timeout: 25000 });
  await page.locator('.acc').first().click(); await page.waitForTimeout(600);
  await page.locator('.ap-mode', { hasText: '超级管理员' }).first().click(); await page.waitForTimeout(800);
  const search = page.locator('[data-testid="objscope-search"] input, input[data-testid="objscope-search"]').first();
  await search.waitFor({ timeout: 25000 }); await search.click(); await search.fill(SUBJECT); await page.waitForTimeout(2000);
  const opt = page.locator('.ant-select-item-option').first();
  if ((await opt.count()) > 0) await opt.click(); else await page.keyboard.press('Enter');
  await page.waitForTimeout(3500);
  await page.locator('button', { hasText: '编辑' }).first().click({ force: true });
  await page.waitForTimeout(4000);
  check('A1', '进入作品编辑器', /\/sp\/works\/.+\/editor$/.test(page.url()), page.url());

  // ===== 新增图片：工具栏 多媒体 → 图片 → 选缩略图 =====
  const mb = page.locator('button', { hasText: '多媒体' }).first();
  await mb.waitFor({ timeout: 30000 }); await mb.click(); await page.waitForTimeout(800);
  const ii = page.locator('button', { hasText: '图片' }).first();
  await ii.waitFor({ timeout: 8000 }); await ii.click();
  await page.getByText('选择图片', { exact: true }).first().waitFor({ timeout: 12000 });
  const fcA = fileChooserFired;
  const card = page.locator('div[role="dialog"] div.grid > div').first();
  await card.waitFor({ timeout: 8000 });
  await card.click({ timeout: 15000 });
  let closed = false;
  try { await page.getByText('选择图片', { exact: true }).first().waitFor({ state: 'hidden', timeout: 15000 }); closed = true; } catch {}
  check('A2', '新增图片：弹窗可见且可点中缩略图（未被画布遮挡）', true);
  check('A3', '新增图片：选中后弹窗关闭（图片已插入画布）', closed);
  check('A4', '新增图片：全程未触发原生文件框', fileChooserFired === fcA, `filechooser=${fileChooserFired - fcA}`);

  // ===== 更换图片：选中图片元素 → 右侧属性面板「替换」按钮 → 选缩略图 =====
  const replBtn = page.locator('button.bg-blue-500.text-white', { hasText: '替换' }).first();
  let hasRepl = false;
  try { await replBtn.waitFor({ timeout: 8000 }); hasRepl = true; } catch {}
  check('B1', '新增图片后右侧面板出现图片「替换」按钮', hasRepl);
  if (hasRepl) {
    const fcB = fileChooserFired;
    // 属性面板可能被浮动「作品设置」面板遮挡，用原生 click 触发 React onClick（handler 级验证）
    await replBtn.evaluate((el) => el.click());
    await page.getByText('选择图片', { exact: true }).first().waitFor({ timeout: 12000 });
    await page.waitForTimeout(800);
    const card2 = page.locator('div[role="dialog"] div.grid > div').first();
    await card2.waitFor({ timeout: 8000 });
    await card2.click({ timeout: 15000 });
    let closed2 = false;
    try { await page.getByText('选择图片', { exact: true }).first().waitFor({ state: 'hidden', timeout: 15000 }); closed2 = true; } catch {}
    check('B2', '更换图片：弹窗可见且可点中缩略图（未被画布遮挡）', true);
    check('B3', '更换图片：选中后弹窗关闭（图片已替换）', closed2);
    check('B4', '更换图片：全程未触发原生文件框', fileChooserFired === fcB, `filechooser=${fileChooserFired - fcB}`);
  }
  check('Z', '无运行时异常', errors.length === 0, errors.slice(0, 2).join(' | '));
} catch (e) {
  console.log('      EXCEPTION', String(e?.stack ?? e));
  check('X', '脚本执行无异常', false, String(e?.message ?? e));
} finally {
  await browser.close();
}
console.log('');
console.log('-------------------------------------------------------------');
console.log(`合计：${pass + fail} 项   PASS ${pass}   FAIL ${fail}`);
if (failed.length) console.log(`失败项：${failed.join(', ')}`);
console.log('-------------------------------------------------------------');
process.exit(fail === 0 ? 0 : 1);
