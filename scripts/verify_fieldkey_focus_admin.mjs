/**
 * 「字段 key」焦点稳定性 · 运营端（admin :5174）跨宿主回归
 *
 * TemplateFieldDesign 由 web 与 admin 共用，本脚本验证修复在 admin（antd）宿主下同样生效：
 * 输入「字段 key」时 DOM 节点不被重建、焦点保持。判定方式与 web 版一致（data-probe）。
 *
 * 运行：node scripts/verify_fieldkey_focus_admin.mjs
 * 前置：admin :5174 已启动；SP 账号 13800000001 / dev123456。
 */
import { chromium } from 'playwright';

const BASE = process.env.E2E_ADMIN_BASE || 'http://localhost:5174';
const PHONE = process.env.E2E_SP_PHONE || '13800000001';
const PASSWORD = process.env.E2E_SP_PASSWORD || 'dev123456';

let pass = 0;
let fail = 0;
const check = (name, ok, extra = '') => {
  if (ok) {
    pass += 1;
    console.log(`  ✅ ${name}`);
  } else {
    fail += 1;
    console.log(`  ❌ ${name}${extra ? ` — ${extra}` : ''}`);
  }
};

const main = async () => {
  console.log('=== 字段 key 焦点稳定性 · admin 宿主 ===');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message));

  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const inputs = page.locator('input');
  await inputs.nth(0).fill(PHONE);
  await inputs.nth(1).fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(3000);
  check('运营端登录成功（离开登录页）', !page.url().includes('/login'), page.url());

  await page.goto(`${BASE}/sp/invitations/fields`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  let txt = await page.locator('body').innerText();
  check('进入运营端「模板字段设计」页', /模板字段设计/.test(txt), page.url());
  if (!/模板字段设计/.test(txt)) {
    await browser.close();
    console.log(`\n=== 结果：${pass} PASS / ${fail} FAIL ===`);
    process.exit(1);
  }

  await page.getByRole('button', { name: /新增字段/ }).first().click();
  await page.waitForTimeout(400);
  const rowCount = await page.locator('table tbody tr').count();
  check('新增字段行成功', rowCount >= 1, `实际 ${rowCount} 行`);

  const keyInput = page.locator('table tbody tr').last().locator('input').first();
  await keyInput.click();
  const h = await keyInput.elementHandle();
  await page.evaluate((el) => el.setAttribute('data-probe', 'admin-key'), h);

  let lostAt = null;
  const trace = [];
  for (const ch of 'wxyz') {
    await page.keyboard.type(ch);
    const st = await page.evaluate(() => {
      const a = document.activeElement;
      return { ok: a?.getAttribute?.('data-probe') === 'admin-key', tag: a?.tagName ?? 'NONE' };
    });
    trace.push(`${ch}:${st.ok ? 'FOCUS' : 'BLUR(' + st.tag + ')'}`);
    if (!st.ok) {
      lostAt = ch;
      break;
    }
  }
  console.log('  [逐键焦点轨迹]', trace.join(' '));
  check('admin 端字段 key 连续输入焦点不丢', lostAt === null, lostAt ? `第「${lostAt}」键后失焦` : '');
  const val = await keyInput.inputValue();
  check('admin 端输入值连续累积（默认 field_N + wxyz）', /wxyz$/.test(val), val);

  await browser.close();
  console.log(`\n=== 结果：${pass} PASS / ${fail} FAIL ===`);
  process.exit(fail ? 1 : 0);
};

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
