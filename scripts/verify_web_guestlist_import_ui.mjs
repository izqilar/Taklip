import { chromium } from 'playwright';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const WEB = 'http://localhost:5173';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? '✅' : '❌'} ${name}${detail ? '  — ' + detail : ''}`); };

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message || e)));

  // 1) UI 登录
  await page.goto(`${WEB}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  await page.locator('input[type="tel"]').fill('13900001001');
  await page.locator('input[type="password"]').fill('Test123456');
  await page.locator('form button[type="submit"]').click();
  await page.waitForTimeout(2500);
  check('登录后跳离登录页', !page.url().includes('/login'), page.url());

  // 2) 进入诚邀名单制作
  await page.goto(`${WEB}/user/invitations/lists`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  check('到达名单页', page.url().includes('/invitations/lists'), page.url());

  // 3) 选婚礼模板（找到含「婚礼请柬诚邀模板」选项的 select —— 注意页面还有导航菜单 select）
  let downloadSelect = null;
  const selCount = await page.locator('select').count();
  for (let i = 0; i < selCount; i++) {
    const s = page.locator('select').nth(i);
    const o = await s.locator('option').allInnerTexts();
    if (o.some((t) => t.includes('婚礼请柬诚邀模板'))) { downloadSelect = s; break; }
  }
  check('找到模板下载 select', !!downloadSelect, downloadSelect ? 'ok' : `共 ${selCount} 个 select`);
  const opts = downloadSelect ? await downloadSelect.locator('option').allInnerTexts() : [];
  const wedOpt = opts.find((o) => o.includes('婚礼请柬诚邀模板'));
  check('含婚礼模板选项', !!wedOpt, wedOpt || opts.join('|'));
  if (downloadSelect && wedOpt) await downloadSelect.selectOption({ label: wedOpt });
  await page.waitForTimeout(400);

  // 3.5) 下载格式选 csv（与已验证的导入路径一致）
  const formatSelect = page.locator('select').nth(1);
  const fOpts = await formatSelect.locator('option').allInnerTexts();
  if (fOpts.includes('csv')) await formatSelect.selectOption({ label: 'csv' });
  await page.waitForTimeout(300);

  // 4) 下载模板并捕获文件流
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.getByRole('button', { name: '下载模板' }).click(),
  ]);
  const dir = mkdtempSync(join(tmpdir(), 'wed-tpl-'));
  const filePath = join(dir, download.suggestedFilename() || 'wedding.csv');
  await download.saveAs(filePath);
  check('下载婚礼模板成功', true, filePath.split(/[\\/]/).pop());

  // 5) 把同一文件导入为新名单（importTarget 留空 → 透传 templateId）
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles(filePath);
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: '导入' }).click();
  await page.waitForTimeout(2500);

  // 6) 断言
  const bodyText = await page.locator('body').innerText();
  const hasMissingColErr = bodyText.includes('缺少必填列') || bodyText.includes('MISSING_REQUIRED_COLUMN');
  check('导入后无「缺少必填列」报错', !hasMissingColErr, hasMissingColErr ? (bodyText.match(/缺少必填列[^。\n]*/)?.[0] || 'error') : 'ok');
  const rowCount = await page.locator('table tbody tr').count();
  check('导入生成了名单行', rowCount >= 1, `tbody 行数=${rowCount}`);
  check('无前端运行时异常', errors.length === 0, errors.slice(0, 3).join(' || '));
  await browser.close();

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n结果：${passed}/${results.length} 通过`);
  process.exit(passed === results.length ? 0 : 1);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
