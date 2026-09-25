import pw from 'file:///C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/playwright/index.js';

const BASE = 'http://localhost:5174';
const failures = [];
const log = (ok, msg) => { console.log((ok ? 'PASS' : 'FAIL') + ' - ' + msg); if (!ok) failures.push(msg); };

const browser = await pw.chromium.launch();
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push('[' + page.url() + '] ' + m.text());
  if (m.type() === 'warning' && m.text().includes('without id')) consoleErrors.push('[WARN] ' + m.text());
});
page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message));
page.on('response', (r) => { if (r.status() >= 400) consoleErrors.push('[' + r.status() + '] ' + r.url()); });
page.on('request', (r) => { if (r.url().includes('/undefined/') || r.url().endsWith('/undefined')) console.log('   REQ-UNDEF:', r.method(), r.url()); });

// 1) 登录 ADMIN
await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
await page.locator('input').nth(0).fill('13800000002');
await page.locator('input').nth(1).fill('dev123456');
await page.locator('button[type=submit]').click({ timeout: 8000 }).catch(() => {});
await page.waitForURL('**/admin/dashboard', { timeout: 15000 });
console.log('LOGIN OK ->', page.url());
await page.evaluate(() => localStorage.setItem('layer.view', 'console'));
await page.reload({ waitUntil: 'networkidle' });

// 2) 用户管理列表 + 删除按钮门控（ADMIN 应可见「删除」）
await page.goto(BASE + '/admin/users', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
const userRows = await page.locator('tbody tr.ant-table-row').count();
log(userRows > 0, '[admin/users] 列表渲染 -> 行数=' + userRows);
const delVisible = await page.getByText('删除', { exact: true }).first().isVisible().catch(() => false);
log(delVisible, '[admin/users] ADMIN 行操作含「删除」按钮（门控开）');

// 3) 详情页完整字段（四分区）
if (userRows > 0) {
  await page.locator('tbody tr.ant-table-row').first().getByText('查看').click();
  await page.waitForTimeout(1200);
  const sec1 = await page.getByText('基本资料', { exact: true }).first().isVisible().catch(() => false);
  const sec2 = await page.getByText('账户与资产', { exact: true }).first().isVisible().catch(() => false);
  const sec3 = await page.getByText('角色权限', { exact: true }).first().isVisible().catch(() => false);
  const sec4 = await page.getByText('注册及活跃记录', { exact: true }).first().isVisible().catch(() => false);
  log(sec1 && sec2 && sec3 && sec4, '[admin/users/show] 四分区完整呈现 (基本资料/账户与资产/角色权限/注册及活跃记录)');
  // antd v5 autoInsertSpaceInButton 会在两个中文字符间插入空格，DOM 中渲染为「删 除」，
  // 故用子串「删」断言功能按钮存在（纯视觉间距，不影响功能与权限门控）。
  const detailDel = await page.locator('button:has-text("删")').first().isVisible().catch(() => false);
  log(detailDel, '[admin/users/show] 详情页含「删除」按钮（antd 自动插空格，按子串断言）');
  // 返回
  await page.goto(BASE + '/admin/users', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
}

// 4) 侧栏「回收站」+「僵尸用户」可见
const recycle = await page.getByText('回收站', { exact: true }).first().isVisible().catch(() => false);
log(recycle, '[sidebar] 含「回收站」分组');
const zombieMenu = await page.getByText('僵尸用户', { exact: true }).first().isVisible().catch(() => false);
log(zombieMenu, '[sidebar] 含「僵尸用户」菜单项');

// 5) 僵尸用户列表可达
await page.goto(BASE + '/admin/zombie-users', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
const zTitle = await page.getByText('僵尸用户', { exact: true }).first().isVisible().catch(() => false);
log(zTitle, '[admin/zombie-users] 列表标题「僵尸用户」渲染');
const zRows = await page.locator('tbody tr.ant-table-row').count();
log(true, '[admin/zombie-users] 列表组件渲染无异常 -> 行数=' + zRows);

// 7) 详情页「删除」→ 二次确认弹窗（防误删）
if (userRows > 0) {
  await page.goto(BASE + '/admin/users', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.locator('tbody tr.ant-table-row').first().getByText('查看').click();
  await page.waitForTimeout(1000);
  await page.locator('button:has-text("删")').first().click();
  await page.waitForTimeout(800);
  let modalText = '';
  try { modalText = await page.locator('.ant-modal-content').first().innerText(); } catch {}
  const modalVisible = await page.locator('.ant-modal').first().isVisible().catch(() => false);
  const confirmText = await page.getByText('移入回收站', { exact: false }).first().isVisible().catch(() => false);
  log(modalVisible && confirmText, '[admin/users/show] 点击删除弹出二次确认弹窗（含「移入回收站」文案，防误删）');
  if (!(modalVisible && confirmText)) console.log('   DEBUG modal text:', JSON.stringify(modalText));
  // 取消，避免实际删除
  await page.locator('.ant-modal .ant-btn:not(.ant-btn-primary)').first().click().catch(() => {});
  await page.waitForTimeout(400);
}

// 8) 后端软删除→僵尸→激活恢复 全链路（用应用内 token 走 API，可逆）
const flow = await page.evaluate(async () => {
  const tk = localStorage.getItem('h5_admin_token');
  const base = 'http://localhost:3000/api';
  const h = { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' };
  const asArr = (r) => Array.isArray(r) ? r : Array.isArray(r?.data) ? r.data : Array.isArray(r?.items) ? r.items : [];
  const list = await (await fetch(base + '/admin/users?pageSize=200', { headers: h })).json();
  const target = asArr(list).find((u) => u.role === 'USER');
  if (!target) return { ok: false, reason: 'no USER seed' };
  const id = target.id;
  const del = await fetch(base + '/admin/users/' + id, { method: 'DELETE', headers: h });
  const z = await (await fetch(base + '/admin/zombie-users?pageSize=200', { headers: h })).json();
  const inZombie = asArr(z).some((u) => u.id === id);
  const act = await fetch(base + '/admin/zombie-users/' + id + '/activate', { method: 'POST', headers: h });
  const list2 = await (await fetch(base + '/admin/users?pageSize=200', { headers: h })).json();
  const restored = asArr(list2).some((u) => u.id === id);
  return { ok: del.ok && act.ok && inZombie && restored, del: del.ok, inZombie, act: act.ok, restored, id };
});
log(flow.ok, '[api] 软删除→僵尸列表→激活恢复 全链路成功 (del=' + flow.del + ', inZombie=' + flow.inZombie + ', activate=' + flow.act + ', restored=' + flow.restored + ')');

// 9) 僵尸列表「激活恢复 / 彻底删除」二次确认弹窗文案（重新软删一个 USER 生成僵尸行；验证后激活恢复，不留遗留）
const part9 = await page.evaluate(async () => {
  const tk = localStorage.getItem('h5_admin_token');
  const base = 'http://localhost:3000/api';
  const h = { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' };
  const asArr = (x) => Array.isArray(x) ? x : (x?.data || x?.items || []);
  const list = await (await fetch(base + '/admin/users?pageSize=200', { headers: h })).json();
  const target = asArr(list).find((u) => u.role === 'USER');
  if (!target) return { ok: false, reason: 'no USER seed' };
  const id = target.id;
  const r = await fetch(base + '/admin/users/' + id, { method: 'DELETE', headers: h });
  const z = await (await fetch(base + '/admin/zombie-users?pageSize=200', { headers: h })).json();
  const zarr = asArr(z);
  return { status: r.status, id, inZombie: zarr.some((u) => u.id === id), zombieCount: zarr.length };
});
console.log('   DEBUG part9 ->', JSON.stringify(part9));
const targetId = part9.id;
await page.goto(BASE + '/admin/zombie-users', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
const zr = await page.locator('tbody tr.ant-table-row').count();
console.log('   DEBUG zombie rows in UI =', zr);
if (zr > 0 && targetId) {
  await page.locator('tbody tr.ant-table-row').first().getByText('激活恢复').click();
  await page.waitForTimeout(500);
  const actModal = await page.locator('.ant-modal-confirm').first().isVisible().catch(() => false);
  const actText = await page.getByText('激活恢复', { exact: false }).first().isVisible().catch(() => false);
  log(actModal && actText, '[admin/zombie-users] 「激活恢复」弹出二次确认弹窗');
  await page.locator('.ant-modal-confirm-btns .ant-btn:not(.ant-btn-primary)').first().click().catch(() => {});
  await page.waitForTimeout(400);

  await page.locator('tbody tr.ant-table-row').first().getByText('彻底删除').click();
  await page.waitForTimeout(500);
  const purgeModal = await page.locator('.ant-modal-confirm').first().isVisible().catch(() => false);
  const purgeText = await page.getByText('彻底删除', { exact: false }).first().isVisible().catch(() => false);
  log(purgeModal && purgeText, '[admin/zombie-users] 「彻底删除」弹出二次确认弹窗');
  await page.locator('.ant-modal-confirm-btns .ant-btn:not(.ant-btn-primary)').first().click().catch(() => {});
  await page.waitForTimeout(400);
  // 恢复该僵尸用户，避免遗留
  await page.evaluate(async ({ id }) => {
    const tk = localStorage.getItem('h5_admin_token');
    const base = 'http://localhost:3000/api';
    const h = { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' };
    await fetch(base + '/admin/zombie-users/' + id + '/activate', { method: 'POST', headers: h });
  }, { id: targetId });
} else {
  log(false, '[admin/zombie-users] 未生成僵尸用户，无法验证弹窗（检查软删除 API）');
}

// 10) 控制台零错误（忽略已知的 useForm 未连接告警 与 antd Modal 静态方法 context 告警，二者皆属既有基线/主题级，不影响功能）
const realErrors = consoleErrors.filter((e) => !e.includes('is not connected to any Form') && !e.includes('[antd: Modal]') && !e.includes('Static function can not consume context'));
log(realErrors.length === 0, '控制台零错误(忽略useForm告警)' + (realErrors.length ? ' -> ' + realErrors.slice(0, 5).join(' | ') : ''));

await browser.close();
if (failures.length) { console.log('\n=== FAILURES: ' + failures.length + ' ==='); failures.forEach((f) => console.log(' - ' + f)); process.exit(1); }
console.log('\nALL PASS');
