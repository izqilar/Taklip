/**
 * dbg_msgE_admin_sp.mjs — 诊断 admin 点击超时 + SP 配对表格缺失（临时脚本）
 * 1. admin 用户视角：跑通场景一后，dump 遮罩/叠层状态，再尝试 B 的 radio 点击（8s），dump elementFromPoint。
 * 2. SP 视角：dump 页面文本、表格结构、控制台错误。
 * 3. API 侧复现 SP 页请求：GET /invitations/projects?ownerType=ORG（SP token）。
 */
import { chromium } from 'playwright';

const API = 'http://localhost:3000';
const WEB = 'http://localhost:5173';
const ADMIN = 'http://localhost:5174';
const USER = { phone: '13900001001', password: 'Test123456' };
const ADMIN_ACCOUNT = { phone: '13800000002', password: 'dev123456' };
const SP_ACCOUNT = { phone: '13800000001', password: 'dev123456' };
const PAIR_A = 'cmv20261012002343';
const PAIR_B = 'cmv20261012000922';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const apiLogin = async (phone, password) => {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'phone', account: phone, password }),
  });
  const j = await res.json();
  if (!j.accessToken) throw new Error(`login failed: ${JSON.stringify(j).slice(0, 200)}`);
  return j;
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
const buyModal = (page) => page.locator('div.ant-modal, div.fixed').filter({ hasText: '购买请柬币' }).last();

async function dumpOverlays(page, tag) {
  const info = await page.evaluate(() => {
    const out = {};
    out.modalMask = document.querySelectorAll('.ant-modal-mask').length;
    out.modalWrap = document.querySelectorAll('.ant-modal-wrap').length;
    out.modalRoot = document.querySelectorAll('.ant-modal-root').length;
    const fixed = [...document.querySelectorAll('body *')].filter((el) => {
      const s = getComputedStyle(el);
      return s.position === 'fixed' && s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) > 0.05 && el.getBoundingClientRect().height > 50;
    }).map((el) => `${el.tagName}.${(el.className || '').toString().slice(0, 60)} z=${getComputedStyle(el).zIndex} h=${Math.round(el.getBoundingClientRect().height)}`);
    out.fixedBig = fixed.slice(0, 8);
    return out;
  });
  console.log(`  [overlay:${tag}] ${JSON.stringify(info)}`);
}

async function dumpRadioHit(page, tag) {
  const hit = await page.evaluate(() => {
    const radio = document.querySelector('input[type=radio]');
    if (!radio) return 'no-radio';
    const r = radio.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const top = document.elementFromPoint(cx, cy);
    return { box: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }, topEl: top ? `${top.tagName}.${(top.className || '').toString().slice(0, 80)}` : 'null' };
  });
  console.log(`  [radioHit:${tag}] ${JSON.stringify(hit)}`);
}

async function main() {
  /* ── API：SP ownerType=ORG 探针 ── */
  console.log('=== API 探针：SP token 请求 projects ===');
  {
    const sp = await apiLogin(SP_ACCOUNT.phone, SP_ACCOUNT.password);
    for (const qs of ['', '?ownerType=ORG', '?ownerType=CLIENT']) {
      const r = await fetch(`${API}/api/invitations/projects${qs}`, { headers: { Authorization: `Bearer ${sp.accessToken}` } });
      const txt = await r.text();
      let j = null; try { j = JSON.parse(txt); } catch { /* ignore */ }
      const arr = Array.isArray(j) ? j : j?.items || [];
      console.log(`  projects${qs || '(无参)'} → http=${r.status} count=${arr.length} ${txt.slice(0, 160)}`);
    }
  }

  /* ── admin 用户视角诊断 ── */
  console.log('\n=== ADMIN 用户视角：场景一后点击阻塞诊断 ===');
  const adminLogin = await apiLogin(ADMIN_ACCOUNT.phone, ADMIN_ACCOUNT.password);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  await setBrowserAuth(ctx, adminLogin);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.log('  [console.error]', m.text().slice(0, 200)); });

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
  if (await opt.isVisible().catch(() => false)) { await opt.click(); }
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

  // 场景一：选 A → ④ → 读值 → 关 modal
  const pt = pairTable(page);
  await pt.waitFor({ timeout: 25000 });
  const rowA = pt.locator('tr', { hasText: PAIR_A }).first();
  await rowA.locator('input[type=radio]').first().click();
  await page.waitForFunction(() => {
    const t = [...document.querySelectorAll('table')].find((x) => [...x.querySelectorAll('th')].some((th) => (th.textContent || '').includes('次数')));
    const tr = t?.querySelector('tbody tr');
    return !!tr && !(tr.textContent || '').includes('暂无生成任务');
  }, null, { timeout: 25000 }).catch(() => console.log('  [warn] A 任务表格等待超时'));
  await sleep(900);
  await buyBtn(page).click();
  const modal = buyModal(page);
  await modal.waitFor({ timeout: 12000 });
  const v = await modal.locator('input').first().inputValue();
  console.log(`  场景一预填值 = ${v}`);
  const cancel = modal.getByRole('button', { name: '取消' }).first();
  await cancel.click().catch((e) => console.log('  [warn] 取消点击异常：', e.message.split('\n')[0]));
  await sleep(1200);
  await dumpOverlays(page, 'after-close-场景一');

  // 场景二：选 B —— 先 dump radio 命中，再尝试点击（8s 超时）
  const rowB = pt.locator('tr', { hasText: PAIR_B }).first();
  await rowB.waitFor({ timeout: 15000 });
  await rowB.scrollIntoViewIfNeeded().catch(() => {});
  await sleep(400);
  await dumpRadioHit(page, 'before-B-click');
  try {
    await rowB.locator('input[type=radio]').first().click({ timeout: 8000 });
    console.log('  B radio 点击成功');
  } catch (e) {
    console.log(`  B radio 点击失败：${e.message.split('\n')[0]}`);
    console.log('  call log:', (e.message.match(/- .*/g) || []).slice(0, 6).join(' | '));
  }
  await dumpOverlays(page, 'after-B-click-attempt');
  await dumpRadioHit(page, 'after-B-click-attempt');

  // 再试一次（排除动画瞬态）
  try {
    await rowB.locator('input[type=radio]').first().click({ timeout: 8000 });
    console.log('  B radio 第二次点击成功');
    await page.waitForTimeout(1500);
    const sigOk = await page.waitForFunction(() => {
      const t = [...document.querySelectorAll('table')].find((x) => [...x.querySelectorAll('th')].some((th) => (th.textContent || '').includes('次数')));
      if (!t) return false;
      const texts = [...t.querySelectorAll('tbody tr')].map((tr) => { const tds = tr.querySelectorAll('td'); return (tds[tds.length - 1]?.textContent || '').trim(); }).sort();
      return JSON.stringify(texts) === JSON.stringify(['0/5', '1/4', '5/0']);
    }, null, { timeout: 10000 }).then(() => true).catch(() => false);
    console.log(`  B 签名就绪 = ${sigOk}`);
    if (sigOk) {
      await buyBtn(page).click({ timeout: 8000 });
      const m2 = buyModal(page);
      await m2.waitFor({ timeout: 10000 });
      console.log(`  场景二预填值 = ${await m2.locator('input').first().inputValue()}`);
      await m2.getByRole('button', { name: '取消' }).first().click().catch(() => {});
    }
  } catch (e) { console.log(`  B radio 第二次仍失败：${e.message.split('\n')[0]}`); }
  await ctx.close();

  /* ── SP 视角诊断 ── */
  console.log('\n=== SP 视角诊断 ===');
  const spLogin = await apiLogin(SP_ACCOUNT.phone, SP_ACCOUNT.password);
  const ctxS = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  await setBrowserAuth(ctxS, spLogin);
  const pageS = await ctxS.newPage();
  pageS.on('pageerror', (e) => console.log('  [sp pageerror]', e.message));
  pageS.on('console', (m) => { if (m.type() === 'error') console.log('  [sp console.error]', m.text().slice(0, 200)); });
  pageS.on('response', (r) => { if (r.url().includes('/invitations/projects')) console.log(`  [sp resp] ${r.status()} ${r.url().slice(0, 120)}`); });
  await pageS.goto(`${ADMIN}/sp/invitations/generate`, { waitUntil: 'domcontentloaded' });
  await sleep(6000);
  const bodyText = (await pageS.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');
  console.log(`  SP 页面文本（前600字）：${bodyText.slice(0, 600)}`);
  const tables = await pageS.evaluate(() => [...document.querySelectorAll('table')].map((t) => [...t.querySelectorAll('th')].map((th) => (th.textContent || '').trim()).join('|')));
  console.log(`  SP 表格数=${tables.length} 表头=${JSON.stringify(tables)}`);
  const pairVisible = await pairTable(pageS).count().catch(() => 0);
  console.log(`  SP 配对记录表匹配数 = ${pairVisible}`);
  await ctxS.close();
  await browser.close();
}

main().catch((e) => { console.error('FATAL', e); process.exit(2); });
