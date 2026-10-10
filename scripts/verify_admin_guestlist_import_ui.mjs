import { chromium } from 'playwright';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ADMIN = 'http://localhost:5174';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? '✅' : '❌'} ${name}${detail ? '  — ' + detail : ''}`); };

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message || e)));

  // 1) 运营端登录（ADMIN）
  await page.goto(`${ADMIN}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input#phone', { timeout: 10000 });
  await page.fill('input#phone', '13800000002');
  await page.fill('input#password', 'dev123456');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);
  check('运营端登录成功', !page.url().includes('/login'), page.url());

  // 2) 进入请柬事务中心 → 诚邀名单制作
  await page.goto(`${ADMIN}/user/invitations/lists`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  check('到达运营端名单页', page.url().includes('/invitations/lists'), page.url());

  // 3) 选婚礼模板
  let sel = null;
  const n = await page.locator('select').count();
  for (let i = 0; i < n; i++) {
    const o = await page.locator('select').nth(i).locator('option').allInnerTexts();
    if (o.some((t) => t.includes('婚礼请柬诚邀模板'))) { sel = page.locator('select').nth(i); break; }
  }
  check('找到模板下载 select', !!sel);
  if (sel) {
    const opts = await sel.locator('option').allInnerTexts();
    const wed = opts.find((o) => o.includes('婚礼请柬诚邀模板'));
    if (wed) await sel.selectOption({ label: wed });
  }
  await page.waitForTimeout(400);

  // 4) 下载 wedding 模板
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.getByRole('button', { name: '下载模板' }).click(),
  ]);
  const dir = mkdtempSync(join(tmpdir(), 'admin-wed-'));
  const filePath = join(dir, download.suggestedFilename() || 'wedding.xlsx');
  await download.saveAs(filePath);
  check('运营端下载婚礼模板成功', true, filePath.split(/[\\/]/).pop());

  // 5) 导入为新名单
  const fi = page.locator('input[type="file"]').first();
  await fi.setInputFiles(filePath);
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: '导入' }).click();
  await page.waitForTimeout(2500);

  // 6) 断言
  const bodyText = await page.locator('body').innerText();
  const hasErr = bodyText.includes('缺少必填列') || bodyText.includes('MISSING_REQUIRED_COLUMN');
  check('运营端导入后无「缺少必填列」报错', !hasErr, hasErr ? (bodyText.match(/缺少必填列[^。\n]*/)?.[0] || 'error') : 'ok');
  const rowCount = await page.locator('table tbody tr').count();
  check('运营端导入生成名单行', rowCount >= 1, `tbody 行数=${rowCount}`);
  check('运营端无运行时异常', errors.length === 0, errors.slice(0, 3).join(' || '));
  await browser.close();

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n结果：${passed}/${results.length} 通过`);
  process.exit(passed === results.length ? 0 : 1);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
