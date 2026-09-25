/**
 * 账户详情「身份认证资料 / 账号安全」浏览器冒烟（web :5173 + 运营端 :5174）。
 * 断言：新增区块渲染、只读态、编辑态输入、手机号/密码弹窗、脱敏与占位入口。
 */
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:3000/api';
const WEB = 'http://localhost:5173';
const ADMIN = 'http://localhost:5174';

const results = [];
function check(name, cond, extra = '') {
  results.push({ name, ok: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  → ' + extra : ''}`);
}

async function login(phone, password) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, password }),
  });
  const data = await res.json();
  if (!res.ok || !data?.accessToken) throw new Error(`login failed ${res.status}`);
  return data;
}

const browser = await chromium.launch();
const errors = [];

/* ─────────── web 端（USER 视角）─────────── */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push('[web] ' + m.text());
  });
  const auth = await login('13900001001', 'Test123456');
  await page.addInitScript(
    ([token, user]) => {
      localStorage.setItem('access_token', token);
      localStorage.setItem('user_info', JSON.stringify(user));
    },
    [auth.accessToken, auth.user],
  );
  await page.goto(`${WEB}/user/account`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const body = await page.locator('body').innerText();
  check('web 渲染身份认证资料区块', body.includes('身份认证资料'));
  check('web 渲染账号安全区块', body.includes('账号安全'));
  check('web 身份证号字段存在', body.includes('身份证号'));
  check('web 人像面/国徽面字段存在', body.includes('人像面') && body.includes('国徽面'));
  check('web 证件未上传状态', body.includes('未上传'));
  check('web 待完善引导', body.includes('待完善'));
  check('web 登录密码与第三方入口', body.includes('登录密码') && body.includes('微信') && body.includes('支付宝'));
  // 本人登录 → 手机号完整显示（不脱敏）
  const phoneVisible = body.includes('13900001001');
  check('web 本人手机号完整显示', phoneVisible);

  // 编辑态：出现输入控件
  await page.getByRole('button', { name: '编辑' }).first().click();
  await page.waitForTimeout(600);
  const inputs = await page.locator('input[type="text"], input:not([type])').count();
  check('web 编辑态出现输入框', inputs >= 3, `inputs=${inputs}`);
  const afterEdit = await page.locator('body').innerText();
  check('web 编辑态出现上传入口', afterEdit.includes('上传'));
  await page.screenshot({ path: 'shots/_acct_web_editing.png', fullPage: true });

  // 身份证号非法 → 即时报错
  const idInput = page.locator('input[maxlength="18"]').first();
  if (await idInput.count()) {
    await idInput.fill('123456789012345678');
    await page.waitForTimeout(400);
    const t = await page.locator('body').innerText();
    check('web 身份证号非法即时提示', t.includes('校验失败'));
  } else {
    check('web 身份证号非法即时提示', false, '未找到身份证号输入框');
  }
  await page.getByRole('button', { name: '取消' }).first().click();
  await page.waitForTimeout(300);

  // 修改手机号弹窗
  await page.getByRole('button', { name: '修改手机号' }).first().click();
  await page.waitForTimeout(500);
  const dlg = await page.locator('[role="dialog"]').first().innerText();
  check('web 手机号弹窗打开', dlg.includes('新手机号'), dlg.replace(/\n/g, ' ').slice(0, 60));
  await page.screenshot({ path: 'shots/_acct_web_phone_modal.png' });
  await page.locator('[role="dialog"]').first().getByRole('button', { name: '取消' }).click();
  await page.waitForTimeout(300);

  // 修改密码弹窗
  await page.getByRole('button', { name: '修改登录密码' }).first().click();
  await page.waitForTimeout(500);
  const pwdDlg = await page.locator('[role="dialog"]').first().innerText();
  check('web 密码弹窗含三项输入', pwdDlg.includes('原密码') && pwdDlg.includes('新密码') && pwdDlg.includes('确认新密码'));
  await page.screenshot({ path: 'shots/_acct_web_pwd_modal.png' });
  await page.locator('[role="dialog"]').first().getByRole('button', { name: '取消' }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'shots/_acct_web_readonly.png', fullPage: true });
  await ctx.close();
}

/* ─────────── 运营端（ADMIN 自身视角）─────────── */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push('[admin] ' + m.text());
  });
  const auth = await login('13800000002', 'dev123456');
  // ⚠️ 运营端与 web 端存储键不同：h5_admin_token / h5_admin_user（见 apps/admin/src/utility.ts）
  await page.addInitScript(
    ([token, user]) => {
      localStorage.setItem('h5_admin_token', token);
      localStorage.setItem('h5_admin_user', JSON.stringify(user));
    },
    [auth.accessToken, auth.user],
  );
  await page.goto(`${ADMIN}/account/profile`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const body = await page.locator('body').innerText();
  check('运营端渲染身份认证资料', body.includes('身份认证资料'), body.slice(0, 60).replace(/\n/g, ' '));
  check('运营端渲染账号安全', body.includes('账号安全'));
  check('运营端证件影像状态', body.includes('未上传'));
  check('运营端第三方绑定占位', body.includes('微信') && body.includes('QQ') && body.includes('支付宝'));
  await page.screenshot({ path: 'shots/_acct_admin_profile.png', fullPage: true });
  await ctx.close();
}

await browser.close();

const realErrors = errors.filter((e) => !/favicon|404 \(Not Found\)/i.test(e));
check('浏览器控制台无错误', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));

const failed = results.filter((r) => !r.ok);
console.log(`\n合计 ${results.length} 项，失败 ${failed.length} 项`);
process.exit(failed.length ? 1 : 0);
