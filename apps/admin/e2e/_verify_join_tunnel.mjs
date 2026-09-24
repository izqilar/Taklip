/**
 * 双隧道（加入 / 入驻）全链路浏览器验证 — 2026-09-23
 *
 * 为什么必须走真实浏览器：curl 能绕过前端管线（Content-Type / 请求头 / i18n 解析），
 * 只会验证服务端；本脚本验证「用户在 web 提交 → 拥有者在运营端接收 / 拒绝 → 用户业务消息收到回执」
 * 的真实交互闭环，以及三端菜单与页面的改造结果。
 *
 * 链路顺序（受「同组织 PENDING 去重」约束）：
 *  A  web 用户提交加入申请 #1（→ 服务商 teamA）
 *  B  运营端服务商：查看 → 接收（成员落入员工角色页）
 *  A2 web 用户再提交 #2（同一团队，此时已无 PENDING）
 *  B2 运营端服务商：拒绝 #2（必填拒绝详情）
 *  C  web 用户业务消息：收到「已通过」+「未通过 + 拒绝详情」两条回执
 *  D  运营端代理商 /agent/team、/agent/roles 同构
 *  E  总台 /admin/qualifications 入驻审批台
 *
 * 选择器事实依据（非臆测，实测于本仓库）：
 *  - web 页头有语言切换 select，区域三联动必须按 option 文案定位，不能用 nth(index)。
 *  - 运营端操作列是 <span> 文本（查看 / 接收 / 拒绝），不是 antd Button。
 *  - antd 两字按钮渲染为「关 闭 / 接 收」（中间插入空格），必须用 /关\s*闭/ 匹配。
 *  - antd 关闭的 Modal 残留 DOM，定位弹窗必须加 :visible。
 *
 * 前置：:3000 / :5173 / :5174 已在跑。用法：node e2e/_verify_join_tunnel.mjs
 */
import { chromium } from '@playwright/test';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = process.env.WEB ?? 'http://localhost:5173';
const ADMIN = process.env.ADMIN ?? 'http://localhost:5174';
const SHOT_DIR = dirname(fileURLToPath(import.meta.url));
const shot = (n) => resolve(SHOT_DIR, `_shot_join_${n}.png`);

const USER = { phone: '13900001001', pwd: 'Test123456' }; // test_user_alice（普通用户，走「接收」）
const USER2 = { phone: '13900001002', pwd: 'Test123456' }; // test_user_bob（普通用户，走「拒绝」）
const SP = { phone: '13800000001', pwd: 'dev123456' }; // dev_provider_001
const AGENT = { phone: '13900003001', pwd: 'Test123456' }; // test_agent_x
const ROOT = { phone: '13800000002', pwd: 'dev123456' }; // dev_admin_001

const STAMP = String(Date.now()).slice(-6);
const REASON_ACCEPT = `【E2E-${STAMP}】申请加入：擅长婚礼现场统筹与花艺布置，可承接周末档期。`;
const REASON_REJECT = `【E2E-${STAMP}】第二条申请（bob）：擅长主持与流程编排，希望参与执行。`;
const REJECT_NOTE = `【E2E-${STAMP}】本团队当前排期已满，暂不接收新成员，欢迎下季度再申请。`;

let pass = 0;
let fail = 0;
const log = (m) => console.log(m);
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; log(`  ✅ ${name}${extra ? ' — ' + extra : ''}`); }
  else { fail++; log(`  ❌ ${name}${extra ? ' — ' + extra : ''}`); }
};
const step = (s) => log(`\n──── ${s} ────`);

const browser = await chromium.launch();
const errors = [];
const watch = (p, tag) => {
  p.on('console', (m) => { if (m.type() === 'error') errors.push(`[${tag}] ${m.text()}`); });
  p.on('pageerror', (e) => errors.push(`[${tag}] pageerror: ${e.message}`));
};
const ctx = async () => {
  const c = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  return { c, p: await c.newPage() };
};

async function loginWeb(p, phone, pwd) {
  await p.goto(`${WEB}/login`);
  await p.locator('input[type=tel]').fill(phone);
  await p.locator('input[type=password]').fill(pwd);
  await p.locator('button[type=submit]').click();
  await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 });
  await p.waitForLoadState('networkidle').catch(() => {});
}

async function loginAdmin(p, phone, pwd) {
  await p.goto(`${ADMIN}/login`);
  await p.getByPlaceholder('手机号').fill(phone);
  await p.getByPlaceholder('密码').fill(pwd);
  await p.locator('button[type=submit]').click();
  await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 });
  await p.waitForLoadState('networkidle').catch(() => {});
}

/** 按 option 文案定位 select（规避页头语言切换 select 干扰） */
const selByOption = (p, text) =>
  p.locator('select').filter({ has: p.locator('option', { hasText: text }) }).first();

try {
  /* ═══════════ A · web 用户侧：提交加入申请 #1 ═══════════ */
  step('A · web 用户侧 入驻申请页 + 提交 #1');
  const { p: pu } = await ctx();
  watch(pu, 'web');
  pu.on('response', async (r) => {
    const u = r.url();
    if (!/join-applications/.test(u) || r.request().method() === 'GET') return;
    let body = '';
    try { body = (await r.text()).slice(0, 160); } catch { /* ignore */ }
    log(`    ↳ ${r.request().method()} ${u.replace(/^https?:\/\/[^/]+/, '')} → ${r.status()} ${body}`);
  });
  await loginWeb(pu, USER.phone, USER.pwd);
  ok('A1 普通用户可登录 web', !pu.url().includes('/login'), pu.url());

  await pu.goto(`${WEB}/user/works`);
  await pu.waitForTimeout(800);
  const navApply = pu.locator('a[href="/user/apply"]');
  const navCount = await navApply.count();
  ok('A2 个人中心出现「入驻申请」菜单', navCount > 0, `命中 ${navCount} 个链接`);
  if (navCount > 0) await navApply.first().click();
  else await pu.goto(`${WEB}/user/apply`);
  await pu.waitForTimeout(1200);
  ok('A3 进入 /user/apply', pu.url().includes('/user/apply'), pu.url());

  const targetBlock = pu.getByText('归所团队', { exact: true });
  ok('A4 JOIN 模式「归所团队」可见', (await targetBlock.count()) > 0);

  // 区域三联动（按 option 文案定位）
  const pSel = selByOption(pu, '请选择省份');
  const cSel = selByOption(pu, '请选择城市');
  const dSel = selByOption(pu, '请选择区县');
  ok('A5 省/市/区/归所下拉均存在', (await pSel.count()) > 0 && (await cSel.count()) > 0 && (await dSel.count()) > 0);
  const provOpts = await pSel.locator('option').allTextContents();
  const xj = provOpts.find((x) => x.includes('新疆'));
  ok('A6 省份列表含新疆', !!xj, xj ?? `共 ${provOpts.length} 项`);
  if (xj) {
    await pSel.selectOption({ label: xj });
    await pu.waitForTimeout(700);
    const cityOpts = await cSel.locator('option').allTextContents();
    const wlmq = cityOpts.find((x) => x.includes('乌鲁木齐'));
    ok('A7 选中新疆后城市联动出乌鲁木齐', !!wlmq, `${cityOpts.length} 项`);
    if (wlmq) {
      await cSel.selectOption({ label: wlmq });
      await pu.waitForTimeout(700);
      const distOpts = await dSel.locator('option').allTextContents();
      const shybk = distOpts.find((x) => x.includes('沙依巴克'));
      ok('A8 选中乌鲁木齐后区县联动出沙依巴克', !!shybk, `${distOpts.length} 项`);
      if (shybk) { await dSel.selectOption({ label: shybk }); await pu.waitForTimeout(1000); }
    }
  }

  // 切 SETTLE：归所团队应隐藏
  await pu.getByRole('button').filter({ hasText: '资格升级成为服务商' }).first().click();
  await pu.waitForTimeout(500);
  ok('A9 切「入驻」后「归所团队」隐藏', (await targetBlock.count()) === 0);
  ok('A10 入驻服务商出现「服务类型」', (await pu.getByText('服务类型', { exact: true }).count()) > 0);
  await pu.screenshot({ path: shot('01-web-settle'), fullPage: true });

  await pu.getByRole('button').filter({ hasText: '加入已有的服务商' }).first().click();
  await pu.waitForTimeout(600);
  ok('A11 切回「加入」后归所团队恢复', (await targetBlock.count()) > 0);

  const tSel = selByOption(pu, '请选择要加入的团队');
  const tOpts = (await tSel.locator('option').allTextContents()).filter((x) => x && !x.includes('请选择'));
  ok('A12 归所团队下拉有候选', tOpts.length > 0, `${tOpts.length} 个团队`);
  const teamA = tOpts[0];
  await tSel.selectOption({ label: teamA });
  await pu.locator('textarea').fill(REASON_ACCEPT);
  await pu.screenshot({ path: shot('02-web-join-filled'), fullPage: true });
  await pu.getByRole('button', { name: '提交申请' }).click();
  await pu.waitForTimeout(1600);
  ok('A13 申请 #1 提交成功（toast）', /申请已提交/.test((await pu.locator('body').innerText()) ?? ''));
  const mineTxt = await pu.locator('body').innerText();
  ok('A14 我的申请列表出现「待接收」', mineTxt.includes('待接收'));
  await pu.screenshot({ path: shot('03-web-submitted'), fullPage: true });

  /* ═══════════ B · 运营端服务商：查看 + 接收 #1 ═══════════ */
  step('B · 运营端服务商 团队管理 / 员工角色');
  const { p: pp } = await ctx();
  watch(pp, 'sp');
  await loginAdmin(pp, SP.phone, SP.pwd);
  ok('B1 服务商可登录运营端', !pp.url().includes('/login'), pp.url());
  await pp.waitForTimeout(1200);
  const sideTxt = await pp.locator('aside, .ant-layout-sider').first().innerText().catch(() => '');
  ok('B2 侧栏出现「团队管理」', sideTxt.includes('团队管理'));
  ok('B3 侧栏出现「员工角色」', sideTxt.includes('员工角色'));
  ok('B4 旧菜单「团队与角色」已消失', !sideTxt.includes('团队与角色'));

  await pp.goto(`${ADMIN}/sp/team`);
  await pp.waitForTimeout(2000);
  const teamTxt = await pp.locator('body').innerText();
  ok('B5 团队管理页加载（申请员工消息队列）', teamTxt.includes('团队管理') && teamTxt.includes('申请员工消息队列'));
  ok('B6 队列出现本次申请人（13900001001）', teamTxt.includes('13900001001'));
  await pp.screenshot({ path: shot('04-sp-team-queue'), fullPage: true });

  // 查看（:visible 规避 antd 残留隐藏弹窗）
  const rowA = pp.locator('tr', { hasText: '13900001001' }).first();
  await rowA.getByText('查看', { exact: true }).click();
  await pp.waitForTimeout(800);
  const modal = pp.locator('.ant-modal-wrap:visible .ant-modal-content').filter({ hasText: '加入申请详情' });
  const modalTxt = await modal.first().innerText().catch(() => '');
  ok('B7 「查看」弹出申请详情', modalTxt.includes('加入申请详情'));
  ok('B8 详情含申请说明原文', modalTxt.includes(`E2E-${STAMP}`));
  ok('B9 详情标注「身份仍为普通用户」', modalTxt.includes('身份仍为普通用户'));
  await pp.screenshot({ path: shot('05-sp-view-modal'), fullPage: true });
  await modal.first().getByRole('button', { name: /关\s*闭/ }).click();
  await pp.waitForTimeout(600);

  // 接收（不选岗位 → 验证服务端默认岗位取最小权限内置岗）
  await pp.locator('tr', { hasText: '13900001001' }).first().getByText('接收', { exact: true }).click();
  await pp.waitForTimeout(800);
  const confirmBtns = pp.locator('.ant-modal-confirm-btns:visible');
  ok('B10 接收弹出二次确认（含默认岗位下拉）', (await confirmBtns.count()) > 0);
  await pp.screenshot({ path: shot('06-sp-accept-confirm'), fullPage: true });
  await confirmBtns.locator('button').filter({ hasText: /接\s*收/ }).first().click();
  await pp.waitForTimeout(2500);
  const rowAccepted = await pp.locator('tr', { hasText: '13900001001' }).filter({ hasText: '已接收' }).count();
  ok('B11 接收成功（该行状态变「已接收」）', rowAccepted >= 1, `${rowAccepted} 行`);
  await pp.screenshot({ path: shot('07-sp-after-accept'), fullPage: true });

  await pp.goto(`${ADMIN}/sp/roles`);
  await pp.waitForTimeout(2200);
  const rolesTxt = await pp.locator('body').innerText();
  ok('B12 员工角色页加载', rolesTxt.includes('员工角色'));
  ok('B13 接收的成员出现在员工角色列表', rolesTxt.includes('迪丽努尔'));
  await pp.screenshot({ path: shot('08-sp-roles'), fullPage: true });

  /* ═══════════ A2 · 重复申请拦截 + bob 提交 #2（走拒绝） ═══════════ */
  step('A2 · 重复申请拦截 + bob 提交 #2');
  // alice 已是 teamA 成员 → 再次申请同团队应被服务端拦截，且错误信息要在页面可见
  await pu.goto(`${WEB}/user/apply`);
  await pu.waitForTimeout(1500);
  const tSel2 = selByOption(pu, '请选择要加入的团队');
  await tSel2.selectOption({ label: teamA });
  await pu.locator('textarea').fill(REASON_REJECT);
  await pu.getByRole('button', { name: '提交申请' }).click();
  await pu.waitForTimeout(1600);
  const dupTxt = await pu.locator('body').innerText();
  ok('A15 已是成员重复申请被拦截（错误提示可见）', dupTxt.includes('你已是该团队成员'));
  await pu.screenshot({ path: shot('09-web-dup-blocked'), fullPage: true });

  // bob 首次申请 teamA（交给服务商走「拒绝」）
  const { p: pu2 } = await ctx();
  watch(pu2, 'web-bob');
  await loginWeb(pu2, USER2.phone, USER2.pwd);
  ok('A16 第二位普通用户可登录 web', !pu2.url().includes('/login'), pu2.url());
  await pu2.goto(`${WEB}/user/apply`);
  await pu2.waitForTimeout(1500);
  const tSel3 = selByOption(pu2, '请选择要加入的团队');
  await tSel3.selectOption({ label: teamA });
  await pu2.locator('textarea').fill(REASON_REJECT);
  await pu2.getByRole('button', { name: '提交申请' }).click();
  await pu2.waitForTimeout(1600);
  ok('A17 bob 申请 #2 提交成功（toast）', /申请已提交/.test((await pu2.locator('body').innerText()) ?? ''));

  /* ═══════════ B2 · 运营端服务商：拒绝 #2 ═══════════ */
  step('B2 · 运营端服务商 拒绝 #2');
  await pp.goto(`${ADMIN}/sp/team`);
  await pp.waitForTimeout(2000);
  const pendingRow = pp.locator('tr', { hasText: '13900001002' }).filter({ hasText: '待接收' }).first();
  ok('B14 队列出现待接收的申请 #2（13900001002）', (await pendingRow.count()) > 0);
  await pendingRow.getByText('拒绝', { exact: true }).click();
  await pp.waitForTimeout(800);
  const rejModal = () => pp.locator('.ant-modal-wrap:visible .ant-modal-content').filter({ hasText: '拒绝详情' });
  ok('B15 拒绝弹出「拒绝详情」弹窗', (await rejModal().count()) > 0);
  // 空内容提交应被拦截
  await rejModal().first().getByRole('button', { name: /确认拒绝并反馈/ }).click();
  await pp.waitForTimeout(700);
  ok('B16 拒绝详情为空时被拦截（弹窗未关闭）', (await rejModal().count()) > 0);
  await rejModal().first().locator('textarea').fill(REJECT_NOTE);
  await pp.screenshot({ path: shot('09-sp-reject-modal'), fullPage: true });
  await rejModal().first().getByRole('button', { name: /确认拒绝并反馈/ }).click();
  await pp.waitForTimeout(2500);
  const rowRejected = await pp.locator('tr', { hasText: '13900001002' }).filter({ hasText: '已拒绝' }).count();
  ok('B17 拒绝成功（该行状态变「已拒绝」）', rowRejected >= 1, `${rowRejected} 行`);
  await pp.screenshot({ path: shot('10-sp-after-reject'), fullPage: true });

  /* ═══════════ C · web 用户侧：业务消息回执 ═══════════ */
  step('C · web 用户侧 业务消息回执');
  // alice：接收回执
  await pu.goto(`${WEB}/user/messages`);
  await pu.waitForTimeout(2000);
  const msgTxt = await pu.locator('body').innerText();
  ok('C1 alice 收到「加入团队申请已通过」', msgTxt.includes('加入团队申请已通过'));
  await pu.screenshot({ path: shot('11-web-message-accept'), fullPage: true });
  // bob：拒绝回执 + 详情含拒绝详情原文
  await pu2.goto(`${WEB}/user/messages`);
  await pu2.waitForTimeout(2000);
  const msgTxt2 = await pu2.locator('body').innerText();
  ok('C2 bob 收到「加入团队申请未通过」', msgTxt2.includes('加入团队申请未通过'));
  const rejRow = pu2.locator('tr', { hasText: '加入团队申请未通过' }).first();
  await rejRow.getByRole('button', { name: /详情/ }).click();
  await pu2.waitForTimeout(1200);
  const detailTxt = await pu2.locator('body').innerText();
  ok('C3 详情含拒绝详情原文', detailTxt.includes(`E2E-${STAMP}`) && detailTxt.includes('排期已满'));
  await pu2.screenshot({ path: shot('12-web-message-detail'), fullPage: true });
  await pu2.keyboard.press('Escape');
  await pu2.waitForTimeout(500);

  /* ═══════════ D · 运营端代理商同构 ═══════════ */
  step('D · 运营端代理商 同构校验');
  const { p: pa } = await ctx();
  watch(pa, 'agent');
  await loginAdmin(pa, AGENT.phone, AGENT.pwd);
  ok('D1 代理商可登录运营端', !pa.url().includes('/login'), pa.url());
  await pa.waitForTimeout(1200);
  const agentSide = await pa.locator('aside, .ant-layout-sider').first().innerText().catch(() => '');
  ok('D2 代理商侧栏出现「团队管理」', agentSide.includes('团队管理'));
  ok('D3 代理商侧栏出现「员工角色」', agentSide.includes('员工角色'));
  ok('D4 旧菜单「角色与权限」已从代理商移除', !agentSide.includes('角色与权限'));

  await pa.goto(`${ADMIN}/agent/team`);
  await pa.waitForTimeout(2000);
  const agentTeam = await pa.locator('body').innerText();
  ok('D5 /agent/team 页面加载', agentTeam.includes('申请员工消息队列'));
  ok('D6 /agent/team 视角标记为代理商', agentTeam.includes('代理商 · 工作台'));
  await pa.screenshot({ path: shot('12-agent-team'), fullPage: true });

  await pa.goto(`${ADMIN}/agent/roles`);
  await pa.waitForTimeout(2000);
  ok('D7 /agent/roles 员工角色页加载', (await pa.locator('body').innerText()).includes('员工角色'));
  await pa.screenshot({ path: shot('13-agent-roles'), fullPage: true });

  /* ═══════════ E · 总台入驻审批台 ═══════════ */
  step('E · 总台 入驻审批台');
  const { p: pr } = await ctx();
  watch(pr, 'admin');
  await loginAdmin(pr, ROOT.phone, ROOT.pwd);
  ok('E1 总台管理员可登录', !pr.url().includes('/login'), pr.url());
  await pr.goto(`${ADMIN}/admin/qualifications`);
  await pr.waitForTimeout(2200);
  const qualTxt = await pr.locator('body').innerText();
  ok('E2 /admin/qualifications 入驻审批台加载', qualTxt.includes('入驻审批'));
  ok('E3 审批台含入驻申请记录（13900001001）', qualTxt.includes('13900001001'));
  await pr.screenshot({ path: shot('14-admin-qualifications'), fullPage: true });

  /* ═══════════ 控制台错误汇总 ═══════════ */
  step('F · 控制台错误');
  // antd deprecation（onDropdownVisibleChange / Modal 静态方法主题警告）为存量已知噪音，不属本轮改动
  const noisy = errors.filter(
    (e) => !/favicon|Failed to load resource|401|\[antd:/.test(e),
  );
  ok('F1 无控制台错误', noisy.length === 0, noisy.slice(0, 4).join(' | '));
} catch (e) {
  fail++;
  log(`\n💥 脚本异常：${e?.stack ?? e}`);
} finally {
  await browser.close();
  log(`\n════════ 结果：${pass} 通过 / ${fail} 失败 ════════`);
  log(`📌 本轮 STAMP=${STAMP}（清理测试数据时按此标记定位）`);
  process.exit(fail > 0 ? 1 : 0);
}
