import pw from 'file:///C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/playwright/index.js';
const { chromium } = pw;

const BASE = 'http://localhost:5174';
const routes = [
  ['admin/service-review', '服务审核'],
  ['admin/work-review', '作品审核'],
  ['admin/invest', '招商申请'],
  ['admin/pool', '意向池'],
  ['admin/settle', '结算总览'],
  ['admin/fee-config', '分账费率'],
  ['admin/contracts', '平台合同管理'],
];

const failures = [];
const consoleErrors = [];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text());
});
page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message));

// 1) 登录
await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const inputs = page.locator('input');
console.log('INPUT COUNT:', await inputs.count());
const btnCount = await page.getByRole('button').count();
console.log('BUTTON COUNT:', btnCount);
for (let i = 0; i < btnCount; i++) {
  const b = page.getByRole('button').nth(i);
  console.log('  btn', i, '=>', JSON.stringify(await b.innerText().catch(() => '?')));
}
await inputs.nth(0).fill('13800000002');
await inputs.nth(1).fill('dev123456');
await page.locator('button[type="submit"]').click({ timeout: 8000 }).catch(async (e) => {
  console.log('CLICK FAIL:', e.message.split('\n')[0]);
  await page.screenshot({ path: '/d/MyWorkBuddy/2026-08-10-22-39-56/scripts/login-debug.png' });
  throw e;
});
await page.waitForURL('**/admin/dashboard', { timeout: 15000 });
console.log('LOGIN OK ->', page.url());

// 2) 侧栏结构校验：分组与菜单项
const sidebarText = await page.locator('aside').first().innerText();
const checks = {
  '分组:内容审核': sidebarText.includes('内容审核'),
  '分组:招商拓展': sidebarText.includes('招商拓展'),
  '分组:合同中枢': sidebarText.includes('合同中枢'),
  '菜单:模板审核(内容审核下)': sidebarText.includes('模板审核'),
  '菜单:服务审核': sidebarText.includes('服务审核'),
  '菜单:作品审核': sidebarText.includes('作品审核'),
  '菜单:招商申请': sidebarText.includes('招商申请'),
  '菜单:意向池': sidebarText.includes('意向池'),
  '菜单:结算总览': sidebarText.includes('结算总览'),
  '菜单:分账费率': sidebarText.includes('分账费率'),
  '菜单:平台合同管理': sidebarText.includes('平台合同管理'),
};
for (const [k, v] of Object.entries(checks)) {
  console.log((v ? 'PASS' : 'FAIL') + ' - 侧栏 ' + k);
  if (!v) failures.push('SIDEBAR: ' + k);
}

// 分组相对顺序校验（§3 定稿）：总览与治理 → 内容审核 → 运营监管 → 招商拓展 → 财务中心 → 合同中枢 → 评价与反馈 → 系统设置
const orderExpect = ['总览与治理', '内容审核', '运营监管', '招商拓展', '财务中心', '合同中枢', '评价与反馈', '系统设置'];
const idx = orderExpect.map((g) => sidebarText.indexOf(g));
let orderOk = true;
for (let i = 1; i < idx.length; i++) {
  if (idx[i] < idx[i - 1]) { orderOk = false; break; }
}
console.log((orderOk ? 'PASS' : 'FAIL') + ' - 侧栏分组相对顺序 ' + orderExpect.join(' → '));
if (!orderOk) failures.push('SIDEBAR_ORDER');

// 3) 逐路由校验占位页
for (const [r, label] of routes) {
  try {
    await page.goto(BASE + '/' + r, { waitUntil: 'networkidle', timeout: 15000 });
    await page.getByText('该功能即将上线').first().waitFor({ timeout: 8000 });
    console.log('PASS - 路由 /' + r + ' 显示「该功能即将上线」');
  } catch (e) {
    console.log('FAIL - 路由 /' + r + ' : ' + e.message.split('\n')[0]);
    failures.push('ROUTE: /' + r);
  }
}

console.log('\n=== 控制台错误 (' + consoleErrors.length + ') ===');
consoleErrors.slice(0, 20).forEach((e) => console.log('  ' + e));

await browser.close();

console.log('\n=== 结果: ' + (failures.length === 0 ? 'ALL PASS' : failures.length + ' FAILURES') + ' ===');
if (failures.length) {
  console.log(failures.join('\n'));
  process.exit(1);
}
