/**
 * 验证：① web 端个人中心「入驻申请」排在「账户详情」之前
 *      ② 运营端用户视角「个人中心」分组出现「入驻申请」且与 web 端同序
 *      ③ 运营端 /user/apply 页面可读（档案列表）、可写（提交 + 撤回）
 *
 * 用法：cd apps/admin && node e2e/_verify_menu_align.mjs
 */
import { chromium } from '@playwright/test';

const WEB = 'http://localhost:5173';
const ADMIN = 'http://localhost:5174';
const STAMP = Date.now().toString().slice(-6);

let pass = 0;
let fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) {
    pass++;
    console.log(`  ✅ ${name}${extra ? ` — ${extra}` : ''}`);
  } else {
    fail++;
    console.log(`  ❌ ${name}${extra ? ` — ${extra}` : ''}`);
  }
};
const step = (s) => console.log(`\n── ${s} ──`);
const OUT = 'D:/MyWorkBuddy/2026-08-10-22-39-56/apps/admin/e2e';
const shot = (n) => `${OUT}/_shot_menu_${n}.png`;

const browser = await chromium.launch({ headless: true });

/* ═══════════ A · web 端：菜单顺序 ═══════════ */
step('A · web 端个人中心菜单顺序');
const ctxW = await browser.newContext({ viewport: { width: 1440, height: 960 } });
const pw = await ctxW.newPage();
const errW = [];
pw.on('pageerror', (e) => errW.push(String(e)));
pw.on('console', (m) => {
  if (m.type() === 'error') errW.push(m.text());
});

await pw.goto(`${WEB}/login`);
await pw.waitForTimeout(1200);
// 登录（SiteHeader 登录态 → 直接进 /user 会跳登录，故先登录再进个人中心）
const inputs = pw.locator('input');
await pw.waitForTimeout(600);
const loginInputs = pw.locator('form input');
await loginInputs.nth(0).fill('13900001001');
await loginInputs.nth(1).fill('Test123456');
await pw.getByRole('button', { name: /登录|登 录/ }).first().click();
await pw.waitForTimeout(2500);
console.log('  URL:', pw.url());

await pw.goto(`${WEB}/user/apply`);
await pw.waitForTimeout(2200);
const body = pw.locator('body');
// 侧栏「个人中心」分组
const sideText = await body.innerText();
const navLinks = await pw.locator('aside a, nav a').all();
const hrefs = [];
for (const a of navLinks) {
  const h = await a.getAttribute('href');
  if (h) hrefs.push(h);
}
const idxApply = hrefs.findIndex((h) => h.includes('/user/apply'));
const idxAccount = hrefs.findIndex((h) => h.includes('/user/account'));
const idxWallet = hrefs.findIndex((h) => h.includes('/user/wallet'));
const idxCoupons = hrefs.findIndex((h) => h.includes('/user/coupons'));
console.log('  导航:', JSON.stringify(hrefs));
ok('A1 存在「入驻申请」菜单', idxApply >= 0);
ok('A2 入驻申请排在账户详情之前', idxApply >= 0 && idxAccount >= 0 && idxApply < idxAccount, `apply=${idxApply} account=${idxAccount}`);
ok(
  'A3 个人中心组内顺序 = 钱包 → 优惠 → 入驻申请 → 账户详情',
  idxWallet >= 0 && idxCoupons >= 0 && idxWallet < idxCoupons && idxCoupons < idxApply && idxApply < idxAccount,
  `${idxWallet}<${idxCoupons}<${idxApply}<${idxAccount}`,
);
ok('A4 页面标题为「入驻申请」', sideText.includes('入驻申请'));
await pw.screenshot({ path: shot('01-web-sidebar'), fullPage: true });

/* ═══════════ B · 运营端用户视角 ═══════════ */
step('B · 运营端用户视角：菜单 + 页面');
const ctxA = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const pa = await ctxA.newPage();
const errA = [];
pa.on('pageerror', (e) => errA.push(String(e)));
pa.on('console', (m) => {
  if (m.type() === 'error') errA.push(m.text());
});

await pa.goto(`${ADMIN}/login`);
await pa.evaluate(() => localStorage.clear());
await pa.goto(`${ADMIN}/login`);
await pa.waitForTimeout(1200);
await pa.fill('input[type="text"]', '13800000002');
await pa.fill('input[type="password"]', 'dev123456');
await pa.locator('button[type="submit"]').click();
await pa.waitForTimeout(3000);
console.log('  URL:', pa.url());

// 通过顶栏「用户视角」按钮切换（localStorage 注入会被 identity 校正回自身视角）
await pa.getByRole('button', { name: '用户视角' }).click();
await pa.waitForTimeout(2500);
console.log('  切换后 URL:', pa.url());
ok('B0 已切到用户视角（URL 落到 /user/*）', pa.url().includes('/user/'));

// ⚠️ AutoComplete 的输入框 class 是 ant-select-selection-search-input（不是 .ant-input），
//    且 antd 两字按钮会插空格（「检 索」）→ 一律用 placeholder / 正则定位。
//    AutoComplete 的 placeholder 不透传到 <input>（其 ph 为空），故必须用 data-testid 容器 + input。
//    左上那个尺寸 86×23 的 select input 是语言/权限模式选择器，别选错。
const box = pa.locator('[data-testid="objscope-search"] input').first();
await box.waitFor({ timeout: 15000 });
await box.click();
await box.fill('13900001001');
await pa.getByRole('button', { name: /检\s*索/ }).first().click();
await pa.waitForTimeout(2500);
// 下拉选项
const optCount = await pa.locator('.ant-select-item-option').count();
console.log('  下拉选项数:', optCount);
if (optCount > 0) {
  await pa.locator('.ant-select-item-option').first().click();
  await pa.waitForTimeout(2500);
}
const afterPick = await pa.locator('body').innerText();
ok('B1 已选定视察对象（不再显示「未选定视察对象」）', !afterPick.includes('未选定视察对象'));

// 侧栏「个人中心」分组
const menuText = await pa.locator('.ant-menu, aside, nav').first().innerText().catch(() => '');
const fullText = await pa.locator('body').innerText();
console.log('  --- sider text ---\n' + menuText.split('\n').filter(Boolean).slice(0, 40).join(' | '));

await pa.screenshot({ path: shot('02-admin-sider'), fullPage: true });

// ⚠️ objectScope 只存在内存中（scopesByView），page.goto() 会整页重载并清空它
//    → 必须走 SPA 内导航（点侧栏菜单），否则 InspectionGate 会退回「未选定视察对象」。
await pa.getByText('入驻申请', { exact: true }).first().click();
await pa.waitForTimeout(2800);
console.log('  URL:', pa.url());
ok('B1b URL 落到 /user/apply', pa.url().includes('/user/apply'));
const applyBody = await pa.locator('body').innerText();
ok('B2 /user/apply 可访问且非「未选定视察对象」', !applyBody.includes('未选定视察对象'));
ok('B3 页面标题显示「入驻申请」', applyBody.includes('入驻申请'));
ok('B4 含「我的身份」卡', applyBody.includes('我的身份'));
ok('B5 含「我的申请」列表面板', applyBody.includes('我的申请'));
ok('B6 只读模式给出显式提示', applyBody.includes('只读观测模式'));
await pa.screenshot({ path: shot('03-admin-apply-readonly'), fullPage: true });

/* ═══════════ C · 解除只读 → 表单可用 ═══════════ */
step('C · 解除只读后出现双隧道表单');
// ⚠️ 权限模式切换后同样不能 goto（会丢 objectScope）：原地等待页面重渲染即可
const permToggle = pa.getByText(/权限模式|超级管理员|运维管理员/).first();
if (await permToggle.count()) {
  await permToggle.click();
  await pa.waitForTimeout(1200);
  const superOpt = pa.getByText(/超级管理员/).last();
  if (await superOpt.count()) {
    await superOpt.click();
    await pa.waitForTimeout(2200);
  }
}
await pa.waitForTimeout(1200);
const writeBody = await pa.locator('body').innerText();
ok('C1 出现「申请方式」面板', writeBody.includes('申请方式'));
ok('C2 出现「申请说明」面板', writeBody.includes('申请说明'));
ok('C3 申请类型含「加入 / 入驻」', writeBody.includes('加入') && writeBody.includes('入驻'));
ok('C4 申请层次含「服务商 / 代理商」', writeBody.includes('服务商') && writeBody.includes('代理商'));
ok('C5 归所团队（加入隧道默认可见）', writeBody.includes('归所团队'));
ok('C6 区域三级联动占位', /请选择省份|选择省/.test(writeBody));

/* ── C2 · 代提交 + 撤回（写入闭环）── */
step('C2 · 运营端代用户提交加入申请 → 撤回');
const beforeWrite = await pa.locator('body').innerText();
ok('C7a 提交前无「待接收」行', !beforeWrite.includes('待接收'));
// 归所团队 Select：用 placeholder 文本定位（.ant-select 计数含语言选择器等，序号不可靠）
const teamSelect = pa.locator('.ant-select').filter({ hasText: '请选择要加入的团队' }).first();
await teamSelect.locator('.ant-select-selector').click({ force: true });
await pa.waitForTimeout(1200);
// ⚠️ 多个 dropdown portal 共存（检索条 + 团队选择）：必须点「可见 dropdown」里的 option，
//    否则会命中检索条下拉里隐藏的 option（element is not visible 反复重试）。
await pa.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last().locator('.ant-select-item-option').first().click({ force: true });
await pa.waitForTimeout(800);
await pa.locator('textarea').fill(`【E2E-${STAMP}】运营端代提交：擅长接待与统筹，希望加入贵团队。`);
await pa.getByRole('button', { name: '提交申请' }).click();
await pa.waitForTimeout(2800);
const afterSubmit = await pa.locator('body').innerText();
ok('C7 代提交成功（toast + 列表出现「待接收」）', afterSubmit.includes('待接收'), /申请已提交/.test(afterSubmit) ? 'toast ok' : '');
await pa.screenshot({ path: shot('05-admin-apply-submitted'), fullPage: true });
// 撤回（自绘 span 按钮，两字无空格）
await pa.getByText('撤回', { exact: true }).first().click();
await pa.waitForTimeout(2500);
const afterWd = await pa.locator('body').innerText();
ok('C8 撤回成功（「待接收」行消失）', !afterWd.includes('待接收'));
await pa.screenshot({ path: shot('06-admin-apply-withdrawn'), fullPage: true });

await pa.screenshot({ path: shot('04-admin-apply-writable'), fullPage: true });

/* ═══════════ D · 控制台错误 ═══════════ */
step('D · 控制台错误');
const noisyW = errW.filter((e) => !/favicon|Failed to load resource|401|404 \(Not Found\)/i.test(e));
// antd deprecation：项目全局使用 message.success() 静态调用（需 App 组件包裹才能消除），
// 属既有模式非本页引入 → 豁免。onOpenChange 已于 2026-09-24 修复。
const noisyA = errA.filter(
  (e) => !/favicon|Failed to load resource|401|404 \(Not Found\)|Static function can not consume context/i.test(e),
);
ok('D1 web 端无控制台错误', noisyW.length === 0, noisyW.slice(0, 2).join(' / '));
ok('D2 运营端无控制台错误', noisyA.length === 0, noisyA.slice(0, 2).join(' / '));

await browser.close();
console.log(`\n═══ ${pass} passed, ${fail} failed ═══`);
process.exit(fail ? 1 : 0);
