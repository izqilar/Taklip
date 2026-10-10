import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const WEB = 'http://localhost:5173';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? '✅' : '❌'} ${name}${detail ? '  — ' + detail : ''}`); };

(async () => {
  const listId = readFileSync('/tmp/wedlist_id.txt', 'utf8').trim();
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message || e)));

  // 登录
  await page.goto(`${WEB}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type="tel"]', { timeout: 10000 });
  await page.fill('input[type="tel"]', '13900001001');
  await page.fill('input[type="password"]', 'Test123456');
  await page.click('form button[type="submit"]');
  await page.waitForTimeout(2000);

  // 进入婚礼名单编辑器
  await page.goto(`${WEB}/user/invitations/lists/${listId}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // 粘贴含表头的 Excel 多列（tab 分隔）
  const tsv = [
    '丈夫姓名\t夫人姓名\t桌号\t电话\t微信\t地址\t备注',
    '张伟\t李娜\t1\t13800000001\tzw\t幸福路1号\t同学',
    '王强\t赵敏\t2\t13900000002\twq\t平安街2号\t同事',
    '李雷\t韩梅\t3\t13700000003\tll\t光明路3号\t亲戚',
  ].join('\n');

  const ta = page.locator('textarea').first();
  await ta.waitFor({ timeout: 8000 });
  await ta.focus();
  await page.evaluate((text) => {
    const el = document.querySelector('textarea');
    const dt = new DataTransfer();
    dt.setData('text/plain', text);
    const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
    el.dispatchEvent(ev);
  }, tsv);
  await page.waitForTimeout(3000);

  const bodyText = await page.locator('body').innerText();
  const hasErr = bodyText.includes('缺少必填列') || bodyText.includes('MISSING_REQUIRED_COLUMN');
  check('粘贴后无「缺少必填列」报错', !hasErr, hasErr ? (bodyText.match(/缺少必填列[^。\n]*/)?.[0] || 'error') : 'ok');
  check('粘贴写入成功提示', /写入\s*3\s*条/.test(bodyText) || bodyText.includes('写入 3'), bodyText.match(/写入[^条]*条/g)?.join(' ') || '');

  // 刷新确认行数
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const rows = await page.locator('table tbody tr').count();
  check('表格含 3 条记录', rows >= 3, `tbody 行数=${rows}`);
  check('无运行时异常', errors.length === 0, errors.slice(0, 3).join(' || '));
  await browser.close();

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n结果：${passed}/${results.length} 通过`);
  process.exit(passed === results.length ? 0 : 1);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
