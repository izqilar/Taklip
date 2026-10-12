/**
 * verify_quota_label_used.mjs — 验证 web 批量生成页配额标签新增「已使用」。
 *
 * 断言：真实浏览器 DOM 里的配额标签 === `生成总数：45，已使用：10，剩余：35`
 * （收费-only 口径：totalRenderable=purchasedHeadcount=45 / remaining=35 → 已使用=10）。
 * 另断言 已使用 == totalRenderable - remaining（来自 API）。
 *
 * 运行：node scripts/verify_quota_label_used.mjs
 * 前置：server :3000 / web :5173 已启动。
 */
import { PrismaClient } from '../apps/server/prisma/prisma-client/index.js';
import { chromium } from 'playwright';

const DATABASE_URL = 'postgresql://h5design:h5design_dev_2026@localhost:5432/h5design_platform';
const API = 'http://localhost:3000';
const WEB = 'http://localhost:5173';
const PHONE = '13900001001';
const PWD = 'Test123456';

const raw = async (path, opts = {}) => {
  const res = await fetch(`${API}${path}`, {
    method: opts.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const txt = await res.text();
  let json = null;
  try { json = txt ? JSON.parse(txt) : {}; } catch { json = txt; }
  return { status: res.status, json, text: txt };
};
const post = async (path, body, token) => {
  const r = await raw(path, { method: 'POST', body, token });
  if (r.status >= 400) { const e = new Error(`${path} ${r.status} ${r.text}`); e.status = r.status; throw e; }
  return r.json;
};
const get = async (path, token) => {
  const r = await raw(path, { token });
  if (r.status >= 400) { const e = new Error(`${path} ${r.status} ${r.text}`); e.status = r.status; throw e; }
  return r.json;
};

async function setBrowserAuth(ctx, loginRes) {
  const at = loginRes?.accessToken, rt = loginRes?.refreshToken, user = loginRes?.user;
  await ctx.addInitScript((args) => {
    const { at, rt, user } = args;
    try {
      if (at) { localStorage.setItem('access_token', at); localStorage.setItem('h5_admin_token', at); }
      if (rt) localStorage.setItem('refresh_token', rt);
      if (user) { localStorage.setItem('user_info', JSON.stringify(user)); localStorage.setItem('h5_admin_user', JSON.stringify(user)); }
    } catch { /* ignore */ }
  }, { at, rt, user });
}

let pass = 0, fail = 0;
const check = (name, ok, extra = '') => {
  if (ok) { pass += 1; console.log(`  ✅ ${name}`); }
  else { fail += 1; console.log(`  ❌ ${name}${extra ? ` — ${extra}` : ''}`); }
};

async function main() {
  console.log('=== 验证：配额标签「已使用」 ===');
  const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });
  const user = await prisma.user.findFirst({ where: { phone: PHONE } });
  if (!user) throw new Error('用户不存在');
  const uid = user.id;
  const existing = await prisma.guestList.findFirst({ where: { ownerId: uid, deletedAt: null } });

  const tag = `e2e-ql-${Date.now()}`;
  const list = await prisma.guestList.create({
    data: {
      ownerId: uid, ownerType: existing?.ownerType ?? 'SELF', orgId: existing?.orgId ?? null, clientId: existing?.clientId ?? null,
      name: `${tag}-L`,
      columnDefs: [
        { key: 'guest_name', label: '姓名', type: 'string', required: true, example: '' },
        { key: 'husband_name', label: '丈夫姓名', type: 'string', example: '' },
        { key: 'wife_name', label: '妻子姓名', type: 'string', example: '' },
      ],
    },
  });
  const recs = await prisma.guestRecord.createMany({
    data: ['甲先生', '乙女士', '丙总'].map((nm, i) => ({ listId: list.id, seq: i + 1, data: { guest_name: nm, husband_name: `夫${i}`, wife_name: `妻${i}` } })),
  });
  const rows = await prisma.guestRecord.findMany({ where: { listId: list.id } });
  const tpl = await post('/api/projects', {
    title: tag,
    schema: {
      id: 'tpl', title: tag, width: 375, height: 667, version: 1,
      pages: [{ id: 'p1', name: '', elements: [{ id: 't1', type: 'text', x: 40, y: 120, width: 280, height: 50, text: '请柬', fontSize: 20, fontFamily: 'sans-serif', fill: '#333', align: 'left', lineHeight: 1.4 }], background: '#fff', height: 667 }],
    },
  }, (await post('/api/auth/login', { type: 'phone', account: PHONE, password: PWD })).accessToken);
  const loginRes = await post('/api/auth/login', { type: 'phone', account: PHONE, password: PWD });
  const token = loginRes.accessToken;
  console.log(`  名单 ${list.id}（3 条） / 模板 ${tpl.id}`);

  // 用 API 建项目 + 选人（与 UI 同一幂等口径），便于先播种配额再开 UI
  const proj = await post('/api/invitations/projects', { templateId: tpl.id, listId: list.id }, token);
  await post(`/api/invitations/projects/${proj.id}/selection`, { listId: list.id, selectedRecordIds: rows.map((r) => r.id) }, token);
  // 播种（收费-only）：purchasedHeadcount=45 → totalRenderable 45；paidRendered=10 → remaining 35；已使用 10
  await prisma.batchRenderProject.update({
    where: { id: proj.id },
    data: { purchasedHeadcount: 45, freeRendered: 0, paidRendered: 10 },
  });
  const v = await get(`/api/invitations/projects/${proj.id}`, token);
  console.log(`  [播种] API → totalRenderable=${v.totalRenderable} remaining=${v.remaining}`);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await setBrowserAuth(ctx, loginRes);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
  page.on('dialog', (d) => d.accept());
  await page.goto(`${WEB}/user/invitations/jobs`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  // 向导：① 选模板（按标题 tag 精确选）→ ② 选名单（同一 list → 幂等复用已播种项目）
  await page.getByRole('button', { name: /请柬模板选择/ }).click();
  await page.locator('button:has(div[data-testid="cover-thumb"])').first().waitFor({ timeout: 20000 });
  const card = page.locator('button', { hasText: tag }).first();
  if (await card.isVisible().catch(() => false)) await card.click();
  else await page.locator('button:has(div[data-testid="cover-thumb"])').first().click();
  await page.getByRole('button', { name: '确认' }).click();
  await page.waitForTimeout(800);

  await page.getByRole('button', { name: /宾客名单选择/ }).click();
  const dlg = page.locator('div.z-\\[1000\\]');
  await dlg.waitFor({ timeout: 20000 });
  await dlg.getByRole('combobox').selectOption(list.id);
  await page.waitForTimeout(3000);
  await dlg.getByRole('button', { name: '确认选择' }).click();
  await page.waitForTimeout(2500);

  // 读取配额标签 DOM 文本
  const labelSpan = page.locator('span', { hasText: '生成总数' }).first();
  await labelSpan.waitFor({ timeout: 15000 });
  const labelText = (await labelSpan.innerText()).replace(/\s+/g, ' ').trim();
  console.log(`  [DOM] 配额标签 = ${JSON.stringify(labelText)}`);

  const expected = `生成总数：${v.totalRenderable}，已使用：${v.totalRenderable - v.remaining}，剩余：${v.remaining}`;
  check('标签含「已使用：」且位于「生成总数：」与「剩余：」之间', /生成总数：.*已使用：.*剩余：/.test(labelText), labelText);
  check(`标签 === 「${expected}」`, labelText === expected, `actual=${labelText}`);
  check('已使用 = totalRenderable - remaining', labelText.includes(`已使用：${v.totalRenderable - v.remaining}`), labelText);

  // 截图顶部按钮行
  const topRow = page.locator('div', { hasText: '请柬模板选择' }).filter({ hasText: '批量生成' }).last();
  const shot = 'D:/MyWorkBuddy/2026-08-10-22-39-56/scripts/quota_label_used.png';
  try {
    const box = await topRow.boundingBox();
    if (box) await page.screenshot({ path: shot, clip: { x: box.x, y: box.y, width: box.width, height: box.height } });
    else await page.screenshot({ path: shot, fullPage: false });
    console.log(`  [截图] ${shot}`);
  } catch (e) { console.log('  [截图] 失败', e.message); }

  await ctx.close();
  await browser.close();

  // 清理
  try {
    await prisma.renderJob.deleteMany({ where: { projectId: proj.id } });
    await prisma.renderSnapshot.deleteMany({ where: { projectId: proj.id } });
    await prisma.guestListSelection.deleteMany({ where: { projectId: proj.id } });
    await prisma.batchRenderProject.deleteMany({ where: { id: proj.id } });
    await prisma.guestRecord.deleteMany({ where: { listId: list.id } });
    await prisma.guestList.deleteMany({ where: { id: list.id } });
    await prisma.project.deleteMany({ where: { id: tpl.id } });
    console.log('  [清理] 已删除本轮自建数据');
  } catch (e) { console.log('  [清理] 部分失败', e.message); }
  await prisma.$disconnect();

  console.log(`\n=== 结果：${pass} PASS / ${fail} FAIL ===`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error('FATAL', e); process.exit(2); });
