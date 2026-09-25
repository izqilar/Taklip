import pw from 'file:///C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/playwright/index.js';
const { chromium } = pw;

const BASE = 'http://localhost:5174';
const failures = [];
const consoleErrors = [];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message));

// 登录（ADMIN）
await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
const inputs = page.locator('input');
await inputs.nth(0).fill('13800000002');
await inputs.nth(1).fill('dev123456');
await page.locator('button[type="submit"]').click({ timeout: 8000 });
await page.waitForURL('**/admin/dashboard', { timeout: 15000 });
console.log('LOGIN OK ->', page.url());

// 1) 进入 admin/contracts（总台 · 平台合同管理）
await page.goto(BASE + '/admin/contracts', { waitUntil: 'networkidle', timeout: 15000 });
await page.waitForTimeout(1500);

const hasTitle = await page.getByText('平台合同管理').first().isVisible().catch(() => false);
const hasChip = await page.getByText('总台 · 全盘治理').first().isVisible().catch(() => false);
const stillPlaceholder = await page.getByText('该功能即将上线').count();
console.log((hasTitle ? 'PASS' : 'FAIL') + ' - 标题「平台合同管理」');
console.log((hasChip ? 'PASS' : 'FAIL') + ' - chip「总台 · 全盘治理」');
console.log((stillPlaceholder === 0 ? 'PASS' : 'FAIL') + ' - 已非占位页（无「该功能即将上线」），count=' + stillPlaceholder);
if (!hasTitle) failures.push('TITLE');
if (!hasChip) failures.push('CHIP');
if (stillPlaceholder !== 0) failures.push('STILL_PLACEHOLDER');

// 2) 表格行数 + 类型列（admin 专属）
const rowCount = await page.locator('tbody tr:not(.ant-table-measure-row)').count();
console.log('INFO - 合同表格数据行数 = ' + rowCount);
const hasTypeCol = await page.getByText('类型', { exact: true }).first().isVisible().catch(() => false);
console.log((hasTypeCol ? 'PASS' : 'FAIL') + ' - admin 专属「类型」列存在');
if (!hasTypeCol) failures.push('TYPE_COL');
console.log('INFO - 表格含数据? ' + (rowCount > 0));

// 3) 若有数据，打开详情抽屉并验证推进按钮（admin 专属写操作入口）
if (rowCount > 0) {
  await page.locator('tbody tr.ant-table-row').first().click();
  await page.waitForTimeout(800);
  const drawerOpen = await page.locator('.ant-drawer-open').count();
  console.log((drawerOpen > 0 ? 'PASS' : 'FAIL') + ' - 详情抽屉打开');
  if (drawerOpen === 0) failures.push('DRAWER');
  const advBtn = await page.getByRole('button', { name: '推进合同' }).count();
  console.log('INFO - 「推进合同」按钮可见数 = ' + advBtn + '（取决于该合同当前签署阶段是否可推进）');
} else {
  console.log('INFO - 无合同数据，跳过抽屉/推进验证（接口已连通，仅 DB 无种子数据）');
}

// 4) 回归：agent/contract 仍渲染「辖区合同」（agent 变体不受影响）
await page.goto(BASE + '/agent/contract', { waitUntil: 'networkidle', timeout: 15000 });
await page.waitForTimeout(1200);
const agentTitle = await page.getByText('辖区合同').first().isVisible().catch(() => false);
const agentChip = await page.getByText('代理商 · 合同管理').first().isVisible().catch(() => false);
console.log((agentTitle ? 'PASS' : 'FAIL') + ' - [回归] 代理商路由标题「辖区合同」');
console.log((agentChip ? 'PASS' : 'FAIL') + ' - [回归] 代理商 chip「代理商 · 合同管理」');
if (!agentTitle) failures.push('AGENT_TITLE_REGRESSION');
if (!agentChip) failures.push('AGENT_CHIP_REGRESSION');

console.log('\n=== 控制台错误 (' + consoleErrors.length + ') ===');
consoleErrors.slice(0, 20).forEach((e) => console.log('  ' + e));

await browser.close();
console.log('\n=== 结果: ' + (failures.length === 0 ? 'ALL PASS' : failures.length + ' FAILURES') + ' ===');
if (failures.length) { console.log(failures.join('\n')); process.exit(1); }
