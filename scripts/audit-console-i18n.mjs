/**
 * 总台（console）菜单模块 × 页面文案 一致性审计。
 * 逐模块打开菜单对应路由，抓取 PageHead 的 h2 主标题，
 * 与侧栏菜单文案比对，标记：缺标题 / 非中文 / 与菜单文案不一致。
 */
import pw from 'file:///C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/playwright/index.js';

const BASE = 'http://localhost:5174';
const PAGES = [
  ['/admin/dashboard', '经营总览'],
  ['/admin/agents', '代理商管理'],
  ['/admin/provider-review', '服务商管理'],
  ['/admin/users', '用户管理'],
  ['/admin/zombie-users', '僵尸用户'],
  ['/admin/templates', '模板审核'],
  ['/admin/orders', '订单管理'],
  ['/admin/wallets', '钱包总览'],
  ['/admin/withdrawals', '提现审核'],
  ['/admin/messages', '消息中心'],
  ['/admin/feedback', '评价与反馈中心'],
  ['/admin/qualifications', '入驻审批'],
  ['/regions', '区域管理'],
  ['/admin/roles', '角色与权限'],
  ['/account/profile', '账户详情'],
  ['/admin/settings', '系统设置'],
  ['/admin/fonts', '字体管理'],
  ['/admin/audit-logs', '操作日志'],
  ['/admin/redline-words', '红线词库'],
  ['/admin/service-review', '服务审核'],
  ['/admin/work-review', '作品审核'],
  ['/admin/invest', '招商申请'],
  ['/admin/pool', '意向池'],
  ['/admin/settle', '结算总览'],
  ['/admin/fee-config', '分账费率'],
  ['/admin/contracts', '平台合同管理'],
];

const hasCJK = (s) => /[一-龥]/.test(s || '');

const browser = await pw.chromium.launch();
const page = await browser.newPage();

await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
await page.locator('input').nth(0).fill('13800000002');
await page.locator('input').nth(1).fill('dev123456');
await page.locator('button[type=submit]').click({ timeout: 8000 }).catch(() => {});
await page.waitForURL('**/admin/dashboard', { timeout: 15000 });
await page.evaluate(() => localStorage.setItem('layer.view', 'console'));
await page.reload({ waitUntil: 'networkidle' });

const rows = [];
for (const [path, menuLabel] of PAGES) {
  let heading = '';
  let err = '';
  try {
    await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 25000 });
    await page.waitForTimeout(1100);
    heading = (await page.locator('h2').first().innerText().catch(() => '')) || '';
    heading = heading.trim();
  } catch (e) {
    err = String(e.message).slice(0, 80);
  }
  const issues = [];
  if (err) issues.push('LOAD_ERR:' + err);
  if (!heading) issues.push('无标题');
  else {
    if (!hasCJK(heading)) issues.push('非中文');
    if (heading !== menuLabel && !heading.includes(menuLabel) && !menuLabel.includes(heading)) {
      issues.push('与菜单文案不一致');
    }
  }
  rows.push({ path, menuLabel, heading, issues });
}

console.log('\n=== 总台菜单 × 页面标题 审计（' + PAGES.length + ' 模块）===');
for (const r of rows) {
  const flag = r.issues.length ? '!!' : 'ok';
  console.log(
    flag + ' ' + r.path.padEnd(28) + ' 菜单=' + r.menuLabel.padEnd(9) + ' 页面标题=' + (r.heading || '(空)') +
      (r.issues.length ? '   << ' + r.issues.join('; ') : ''),
  );
}
const bad = rows.filter((r) => r.issues.length);
console.log('\n汇总：' + (rows.length - bad.length) + '/' + rows.length + ' 一致；异常 ' + bad.length + ' 项');

await browser.close();
