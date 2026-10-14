/**
 * dbg_msgE_modal.mjs — 精确诊断 admin 购买弹窗按钮不可点（临时脚本）
 * 打开弹窗 → dump buyModal 匹配数/可见性、取消按钮 box/命中元素/祖先 pointer-events、trial click 完整报错。
 */
import { chromium } from 'playwright';

const API = 'http://localhost:3000';
const ADMIN = 'http://localhost:5174';
const USER = { phone: '13900001001', password: 'Test123456' };
const ADMIN_ACCOUNT = { phone: '13800000002', password: 'dev123456' };
const PAIR_A = 'cmv20261012002343';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const apiLogin = async (phone, password) => {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'phone', account: phone, password }),
  });
  return res.json();
};

const setBrowserAuth = async (ctx, loginRes) => {
  const { accessToken: at, refreshToken: rt, user } = loginRes;
  await ctx.addInitScript((args) => {
    const { at: a, rt: r, user: u } = args;
    try {
      if (a) { localStorage.setItem('access_token', a); localStorage.setItem('h5_admin_token', a); }
      if (r) localStorage.setItem('refresh_token', r);
      if (u) { localStorage.setItem('user_info', JSON.stringify(u)); localStorage.setItem('h5_admin_user', JSON.stringify(u)); }
    } catch { /* ignore */ }
  }, { at, rt, user });
};

const pairTable = (page) => page.locator('table').filter({ has: page.locator('th', { hasText: '作品编号' }) }).first();
const taskTable = (page) => page.locator('table').filter({ has: page.locator('th', { hasText: '次数' }) }).first();
const buyBtn = (page) => page.getByRole('button', { name: /④ 购买请柬币/ }).first();

async function main() {
  const adminLogin = await apiLogin(ADMIN_ACCOUNT.phone, ADMIN_ACCOUNT.password);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  await setBrowserAuth(ctx, adminLogin);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message));

  await page.goto(`${ADMIN}/user/invitations/jobs`, { waitUntil: 'domcontentloaded' });
  await sleep(2500);
  const uv = page.getByRole('button', { name: '用户视角' });
  if (await uv.isVisible().catch(() => false)) { await uv.click(); await sleep(1500); }
  await page.goto(`${ADMIN}/user/invitations/jobs`, { waitUntil: 'domcontentloaded' });
  await sleep(2500);
  const box = page.locator('[data-testid="objscope-search"]');
  await box.waitFor({ timeout: 20000 });
  const inp = box.locator('input').first();
  await inp.click(); await inp.fill(USER.phone); await sleep(2000);
  const opt = page.locator('.ant-select-item-option-content', { hasText: USER.phone }).first();
  if (await opt.isVisible().catch(() => false)) await opt.click();
  await sleep(2500);
  try {
    await page.locator('span.acc').first().click();
    await page.locator('.accpanel').waitFor({ timeout: 10000 });
    const sm = page.locator('.ap-mode', { hasText: '超级管理员' }).first();
    if (await sm.isVisible().catch(() => false)) await sm.click();
    await sleep(800);
    await page.keyboard.press('Escape');
    await page.mouse.click(10, 400);
    await sleep(800);
  } catch (e) { console.log('  [debug] 权限模式异常：', e.message); }

  // 选 A → 等任务表 → 点 ④ 开弹窗
  const pt = pairTable(page);
  await pt.waitFor({ timeout: 25000 });
  await pt.locator('tr', { hasText: PAIR_A }).first().locator('input[type=radio]').first().click();
  await page.waitForFunction(() => {
    const t = [...document.querySelectorAll('table')].find((x) => [...x.querySelectorAll('th')].some((th) => (th.textContent || '').includes('次数')));
    const tr = t?.querySelector('tbody tr');
    return !!tr && !(tr.textContent || '').includes('暂无生成任务');
  }, null, { timeout: 25000 }).catch(() => {});
  await sleep(900);
  await buyBtn(page).click();
  await sleep(2000);

  // ① buyModal 匹配详情
  const modalInfo = await page.evaluate(() => {
    const els = [...document.querySelectorAll('div.ant-modal, div.fixed')].filter((el) => (el.textContent || '').includes('购买请柬币'));
    return els.map((el, i) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return { i, cls: el.className, visible: s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) > 0.05, box: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }, pe: s.pointerEvents, z: s.zIndex };
    });
  });
  console.log(`  buyModal 匹配数=${modalInfo.length}`);
  for (const m of modalInfo) console.log(`   [${m.i}] ${m.cls} visible=${m.visible} box=${JSON.stringify(m.box)} pointerEvents=${m.pe} z=${m.z}`);

  // ② 弹窗实际 HTML + 全部按钮
  const html = await page.evaluate(() => {
    const m = document.querySelector('.ant-modal');
    const root = document.querySelector('.ant-modal-root');
    const btns = root ? [...root.querySelectorAll('button')].map((b) => `${(b.textContent || '').trim()}|disabled=${b.disabled}|pe=${getComputedStyle(b).pointerEvents}`) : [];
    const footer = document.querySelectorAll('.ant-modal-footer').length;
    const footerBtns = document.querySelectorAll('.ant-modal-footer button').length;
    return { html: m ? m.outerHTML.slice(0, 2400) : 'no-modal', btns, footer, footerBtns };
  });
  console.log(`  .ant-modal-footer 数=${html.footer} footer 按钮数=${html.footerBtns}`);
  console.log(`  modal-root 内全部按钮：${JSON.stringify(html.btns)}`);
  console.log('  .ant-modal HTML：');
  console.log(html.html);

  // ③ mask/wrap/dialog 的 pointer-events 与 DOM 顺序
  const stack = await page.evaluate(() => {
    const root = document.querySelector('.ant-modal-root');
    if (!root) return 'no-root';
    return [...root.children].map((el) => {
      const s = getComputedStyle(el);
      return `${el.className} pe=${s.pointerEvents} pos=${s.position} z=${s.zIndex} inset=${s.inset || '-'} order=${[...root.children].indexOf(el)}`;
    });
  });
  console.log('  modal-root 子层：'); for (const s of stack) console.log(`   ${s}`);

  // ④ trial click 拿完整 actionability 报错
  const cancelBtn = page.locator('.ant-modal').filter({ hasText: '购买请柬币' }).last().getByRole('button', { name: '取消' }).first();
  try {
    await cancelBtn.click({ timeout: 6000 });
    console.log('  trial click 成功');
  } catch (e) {
    console.log('  trial click 完整报错：');
    for (const line of e.message.split('\n').slice(0, 14)) console.log(`   ${line}`);
  }

  // ⑤ 对照：点 mask 能否关闭（maskClosable）
  try {
    await page.mouse.click(800, 50); // 顶部遮罩区
    await sleep(1200);
    const maskLeft = await page.evaluate(() => document.querySelectorAll('.ant-modal-mask').length);
    console.log(`  点遮罩后 mask 数 = ${maskLeft}（0 = maskClosable 生效，弹窗已关）`);
  } catch (e) { console.log('  遮罩点击异常：', e.message.split('\n')[0]); }

  await browser.close();
}

main().catch((e) => { console.error('FATAL', e); process.exit(2); });
