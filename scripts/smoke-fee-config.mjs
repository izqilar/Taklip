import pw from 'file:///C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/playwright/index.js';

const BASE = 'http://localhost:5174';
const API = 'http://localhost:3000/api';
const failures = [];
const log = (ok, msg) => { console.log((ok ? 'PASS' : 'FAIL') + ' - ' + msg); if (!ok) failures.push(msg); };

const browser = await pw.chromium.launch();
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push('[' + page.url() + '] ' + m.text()); });
page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message));
page.on('response', (r) => { if (r.status() >= 400) consoleErrors.push('[' + r.status() + '] ' + r.url()); });

// 1) 登录 ADMIN + 切到总台视角
await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
await page.locator('input').nth(0).fill('13800000002');
await page.locator('input').nth(1).fill('dev123456');
await page.locator('button[type=submit]').click({ timeout: 8000 }).catch(() => {});
await page.waitForURL('**/admin/dashboard', { timeout: 15000 });
await page.evaluate(() => localStorage.setItem('layer.view', 'console'));
await page.reload({ waitUntil: 'networkidle' });

// 2) 结算总览：复用 AgentWallet + admin/stats
await page.goto(BASE + '/admin/settle', { waitUntil: 'networkidle' });
await page.waitForTimeout(1800);
const settleTitle = await page.getByText('结算总览 · 全平台', { exact: false }).first().isVisible().catch(() => false);
log(settleTitle, '[admin/settle] 结算总览页渲染（标题含「结算总览 · 全平台」）');
const platPanel = await page.getByText('平台资金总览', { exact: false }).first().isVisible().catch(() => false);
log(platPanel, '[admin/settle] 复用 admin/stats 呈现「平台资金总览」区块');
const gmv = await page.getByText('平台总流水', { exact: false }).first().isVisible().catch(() => false);
const fee = await page.getByText('待处理提现', { exact: false }).first().isVisible().catch(() => false);
log(gmv && fee, '[admin/settle] 平台级指标齐备（平台总流水 / 待处理提现）');

// 3) 分账费率页三区块
await page.goto(BASE + '/admin/fee-config', { waitUntil: 'networkidle' });
await page.waitForTimeout(1800);
const s1 = await page.getByText('平台抽成比', { exact: false }).first().isVisible().catch(() => false);
const s2 = await page.getByText('服务商分账规则', { exact: false }).first().isVisible().catch(() => false);
const s3 = await page.getByText('类目费率', { exact: false }).first().isVisible().catch(() => false);
log(s1 && s2 && s3, '[admin/fee-config] 三区块齐备（平台抽成比 / 服务商分账规则 / 类目费率）');

// 4) 表单回填（GET 拉到的当前费率）
const curRate = await page.locator('input.ant-input-number-input').first().inputValue().catch(() => '');
log(curRate !== '', '[admin/fee-config] 表单由 GET admin/fee-config 回填 -> platformRate=' + curRate);

// 5) 改 平台抽成=20 / 代理商=10，校验推导服务商=70%
const numInputs = page.locator('input.ant-input-number-input');
await numInputs.nth(0).fill('20');
await numInputs.nth(0).blur().catch(() => {});
await numInputs.nth(1).fill('10');
await numInputs.nth(1).blur().catch(() => {});
await page.waitForTimeout(600);
const derived = await page.getByText('70%', { exact: false }).first().isVisible().catch(() => false);
log(derived, '[admin/fee-config] 服务商分账比例按 100−20−10 推导为 70%（前端实时校验）');

// 6) 保存 → 后端落库
// antd v5 autoInsertSpaceInButton 会把「保存」在 DOM 中渲染为「保 存」（两汉字间插空格），
// 故不能用 has-text("保存") 命中，改按 primary 按钮定位（本页唯一主按钮即保存）。
await page.locator('button.ant-btn-primary').first().click();
await page.waitForTimeout(2000);
const savedMsg = await page.getByText('分账费率已保存', { exact: false }).first().isVisible().catch(() => false);
log(savedMsg, '[admin/fee-config] 保存成功提示出现');

const after = await page.evaluate(async () => {
  const tk = localStorage.getItem('h5_admin_token');
  const r = await fetch('http://localhost:3000/api/admin/fee-config', { headers: { Authorization: 'Bearer ' + tk } });
  return r.ok ? await r.json() : { err: r.status };
});
log(after && after.platformRate === 20 && after.agentRate === 10 && after.providerRate === 70,
  '[api] PUT 落库正确 -> platform=' + after?.platformRate + ', agent=' + after?.agentRate + ', provider=' + after?.providerRate);

// 7) 还原默认值（避免污染后续回归）
await page.evaluate(async () => {
  const tk = localStorage.getItem('h5_admin_token');
  await fetch('http://localhost:3000/api/admin/fee-config', {
    method: 'PUT',
    headers: { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' },
    body: JSON.stringify({ platformRate: 10, agentRate: 0, settlePeriod: 'MONTH', categoryRates: {}, minWithdrawCents: 0 }),
  });
});

// 8) 控制台零错误（忽略既有基线告警）
const real = consoleErrors.filter((e) =>
  !e.includes('is not connected to any Form') &&
  !e.includes('[antd: Modal]') &&
  !e.includes('Static function can not consume context'));
log(real.length === 0, '控制台零错误' + (real.length ? ' -> ' + real.slice(0, 4).join(' | ') : ''));

await browser.close();
if (failures.length) { console.log('\n=== FAILURES: ' + failures.length + ' ==='); failures.forEach((f) => console.log(' - ' + f)); process.exit(1); }
console.log('\nALL PASS');
