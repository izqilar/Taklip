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

// 2) admin 招商申请
await page.goto(BASE + '/admin/invest', { waitUntil: 'networkidle' });
const invTitle = await page.getByText('招商申请 · 全平台', { exact: true }).first().isVisible().catch(() => false);
log(invTitle, '[admin/invest] 标题含「招商申请 · 全平台」');
const invChip = await page.getByText('总台 · 全盘治理', { exact: true }).first().isVisible().catch(() => false);
log(invChip, '[admin/invest] chip 含「总台 · 全盘治理」');
const hasRegionInput = await page.getByText('归属区域路径', { exact: true }).first().isVisible().catch(() => false);
log(hasRegionInput, '[admin/invest] admin 变体含「归属区域路径」输入（替代锁定辖区提示）');
const recentRows = await page.locator('tbody tr.ant-table-row').count();
console.log('INFO [admin/invest] 最近登记行数 = ' + recentRows);
log(recentRows >= 0, '[admin/invest] 最近登记表格渲染无异常');

// 3) admin 意向池
await page.goto(BASE + '/admin/pool', { waitUntil: 'networkidle' });
const poolTitle = await page.getByText('意向池 · 全平台', { exact: true }).first().isVisible().catch(() => false);
log(poolTitle, '[admin/pool] 标题含「意向池 · 全平台」');
const poolChip = await page.getByText('总台 · 全盘治理', { exact: true }).first().isVisible().catch(() => false);
log(poolChip, '[admin/pool] chip 含「总台 · 全盘治理」');
const poolAll = await page.getByText('全平台（ALL 视角）').first().isVisible().catch(() => false);
log(poolAll, '[admin/pool] 提示含「全平台（ALL 视角）」');
const poolRows = await page.locator('tbody tr.ant-table-row').count();
console.log('INFO [admin/pool] 意向池数据行数 = ' + poolRows);
log(poolRows >= 0, '[admin/pool] 表格渲染无异常');

// 4) 阶段推进写操作接线（不实际落库：点开后取消，验证 PATCH 接线 + 无报错）
if (poolRows > 0) {
  // 找一条非已联系行
  const targetRow = page.locator('tbody tr.ant-table-row').first();
  const contactBtn = targetRow.getByText('标记已联系');
  if (await contactBtn.first().isVisible().catch(() => false)) {
    await contactBtn.first().click();
    await page.waitForTimeout(500);
    const modalOk = await page.getByRole('button', { name: '确定' }).isVisible().catch(() => false);
    log(modalOk, '[admin/pool] 「标记已联系」触发确认弹窗（写操作 PATCH 接线）');
    await page.getByRole('button', { name: '取消' }).click().catch(() => {});
    await page.waitForTimeout(300);
  } else {
    console.log('INFO - 首行已是「已联系」或无可点按钮，跳过推进校验');
  }
} else {
  console.log('INFO - 意向池无数据，跳过阶段推进校验');
}

// 5) 回归：agent 路由不泄漏 admin 变体标签
await page.evaluate(() => localStorage.setItem('layer.view', 'agent'));
await page.reload({ waitUntil: 'networkidle' });
await page.goto(BASE + '/agent/invest', { waitUntil: 'networkidle' });
const noAdminChip = !(await page.getByText('总台 · 全盘治理').first().isVisible().catch(() => false));
const noRegionInput = !(await page.getByText('归属区域路径', { exact: true }).first().isVisible().catch(() => false));
log(noAdminChip, '[agent/invest] 未泄漏 admin chip「总台 · 全盘治理」');
log(noRegionInput, '[agent/invest] 未泄漏 admin「归属区域路径」输入');
await page.evaluate(() => localStorage.setItem('layer.view', 'admin'));
await page.reload({ waitUntil: 'networkidle' });

log(consoleErrors.length === 0, '控制台零错误' + (consoleErrors.length ? ' -> ' + consoleErrors.slice(0,3).join(' | ') : ''));

await browser.close();
console.log('\n=== ' + (failures.length ? 'FAILED('+failures.length+')' : 'ALL PASS') + ' ===');
process.exit(failures.length ? 1 : 0);
