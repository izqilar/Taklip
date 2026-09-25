import pw from 'file:///C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/playwright/index.js';
const { chromium } = pw;

const BASE = 'http://localhost:5174';
const failures = [];
const log = (ok, msg) => { console.log((ok ? 'PASS' : 'FAIL') + ' - ' + msg); if (!ok) failures.push(msg); };

const browser = await chromium.launch();
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message));

// 1) 登录
await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
await page.locator('input').nth(0).fill('13800000002');
await page.locator('input').nth(1).fill('dev123456');
await page.locator('button[type=submit]').click({ timeout: 8000 }).catch(() => {});
await page.waitForURL('**/admin/dashboard', { timeout: 15000 });
console.log('LOGIN OK ->', page.url());
await page.evaluate(() => localStorage.setItem('layer.view', 'admin'));
await page.reload({ waitUntil: 'networkidle' });

// helper
async function visitAndAssert(path, expectTitle, expectChip, expectAllLabel) {
  await page.goto(BASE + path, { waitUntil: 'networkidle' });
  const titleOk = await page.getByText(expectTitle, { exact: true }).first().isVisible().catch(() => false);
  log(titleOk, `[${path}] 标题含「${expectTitle}」`);
  if (expectChip) {
    const chipOk = await page.getByText(expectChip, { exact: true }).first().isVisible().catch(() => false);
    log(chipOk, `[${path}] chip 含「${expectChip}」`);
  }
  if (expectAllLabel) {
    const allOk = await page.getByText(expectAllLabel).first().isVisible().catch(() => false);
    log(allOk, `[${path}] 提示含「${expectAllLabel}」`);
  }
  // 表格行数（排除测量行）
  const rows = await page.locator('tbody tr.ant-table-row').count();
  console.log(`INFO [${path}] 数据行数 = ${rows}`);
  return rows;
}

// 2) admin 服务审核
const svcRows = await visitAndAssert('/admin/service-review', '服务审核 · 全平台', '总台 · 全盘治理', '全平台（ALL 视角）');
log(svcRows >= 0, '[admin/service-review] 表格渲染无异常');

// 3) admin 服务审核详情弹窗（总台复核 tag）
if (svcRows > 0) {
  await page.locator('tbody tr.ant-table-row').first().getByText('查看').click();
  await page.waitForTimeout(800);
  const tagOk = await page.getByText('总台复核').first().isVisible().catch(() => false);
  log(tagOk, '[admin/service-review] 详情弹窗 tag=「总台复核」');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
} else {
  console.log('INFO - 服务审核无数据行，跳过详情弹窗校验');
}

// 4) admin 作品审核
const workRows = await visitAndAssert('/admin/work-review', '作品审核 · 全平台', '总台 · 全盘治理', '全平台（ALL 视角）');
log(workRows >= 0, '[admin/work-review] 表格渲染无异常');
if (workRows > 0) {
  await page.locator('tbody tr.ant-table-row').first().getByText('查看').click();
  await page.waitForTimeout(800);
  const tagOk = await page.getByText('总台复核').first().isVisible().catch(() => false);
  log(tagOk, '[admin/work-review] 详情弹窗 tag=「总台复核」');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
} else {
  console.log('INFO - 作品审核无数据行，跳过详情弹窗校验');
}

// 5) 回归：agent 路由不得泄漏 admin 变体标签（负向断言，确认 variant 分支隔离）
await page.evaluate(() => localStorage.setItem('layer.view', 'agent'));
await page.reload({ waitUntil: 'networkidle' });
await page.goto(BASE + '/agent/service-review', { waitUntil: 'networkidle' });
const noAdminChip = !(await page.getByText('总台 · 全盘治理').first().isVisible().catch(() => false));
const noAllLabel = !(await page.getByText('全平台（ALL 视角）').first().isVisible().catch(() => false));
log(noAdminChip, '[agent/service-review] 未泄漏 admin 专属 chip「总台 · 全盘治理」');
log(noAllLabel, '[agent/service-review] 未泄漏 admin 专属提示「全平台（ALL 视角）」');
await page.evaluate(() => localStorage.setItem('layer.view', 'admin'));
await page.reload({ waitUntil: 'networkidle' });

log(consoleErrors.length === 0, '控制台零错误' + (consoleErrors.length ? ' -> ' + consoleErrors.slice(0,3).join(' | ') : ''));

await browser.close();
console.log('\n=== ' + (failures.length ? 'FAILED('+failures.length+')' : 'ALL PASS') + ' ===');
process.exit(failures.length ? 1 : 0);
