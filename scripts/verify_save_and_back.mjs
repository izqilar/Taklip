/**
 * 验证：诚邀名单「保存并返回」把已填写记录全部落库（空行不写入）。
 *
 * 复现的缺陷（用户报告）：
 *   在记录填写页添加若干记录后直接点「返回」，新建/编辑时插入的记录未保存即丢失。
 *
 * 根因（本轮实锤）：
 *   编辑器把「新增行」硬编码成 `data:{guest_name:null}`，并在创建前判 `if(!row.data.guest_name) return`。
 *   对**不含 guest_name 的自定义模板**（系统模板「婚礼请柬诚邀模板」sys_wedd 即为 husband_name/wife_name；
 *   线上数据 GuestTemplate「Mirzat」= Male/Female，名单「MM」records=0 就是本缺陷的现场），
 *   新增行永远走不到 POST → 一张也存不进去。
 *
 * 覆盖断言：
 *   A. 「返回」已更名为「保存并返回」（data-testid=save-and-back）
 *   B. 无 guest_name 的模板：列按模板渲染（含 E2E丈夫/E2E妻子，不含 姓名）
 *   C. 新增行填值（不手动失焦）→ 点「保存并返回」→ 已落库 + 自动跳回列表页
 *   D. 全空的新增行 → 跳过不写入（非空行正常写入）
 *   E. 编辑既有行、改完立刻点「保存并返回」（<600ms 防抖窗口）→ 改动仍落库
 *   F. 新增行先失焦（已创建）再点「保存并返回」→ 不重复插入
 *
 * 运行：node scripts/verify_save_and_back.mjs
 * 前置：web :5173 + server :3000 已启动。
 */
import { chromium } from 'playwright';
import { createRequire } from 'module';

const require2 = createRequire(import.meta.url);
const { PrismaClient } = require2('../apps/server/prisma/prisma-client/index.js');

const BASE = process.env.E2E_WEB_BASE || 'http://localhost:5173';
const API = process.env.E2E_API_BASE || 'http://localhost:3000';
const PHONE = process.env.E2E_PHONE || '13900001001';
const PASSWORD = process.env.E2E_PASSWORD || 'Test123456';

let pass = 0;
let fail = 0;
const check = (n, ok, extra = '') => {
  console.log(`  ${ok ? '✅' : '❌'} ${n}${extra ? ` — ${extra}` : ''}`);
  ok ? (pass += 1) : (fail += 1);
};

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const ts = Date.now();
/** 两个字段均必填，且**故意不含 guest_name**（复刻线上 Mirzat 模板的形态） */
const FIELDS = [
  { key: 'e2e_husband', label: 'E2E丈夫', type: 'string', required: true, maxLen: 20, example: 'A' },
  { key: 'e2e_wife', label: 'E2E妻子', type: 'string', required: true, maxLen: 20, example: 'B' },
];

/* 登录并写 token */
await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
await page.evaluate(
  async ([api, phone, password]) => {
    const res = await fetch(`${api}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password }),
    });
    const d = await res.json();
    localStorage.setItem('access_token', d.accessToken);
    localStorage.setItem('refresh_token', d.refreshToken);
    localStorage.setItem('user_info', JSON.stringify(d.user));
  },
  [API, PHONE, PASSWORD],
);

const api = async (method, path, body) => {
  const tok = await page.evaluate(() => localStorage.getItem('access_token'));
  return page.evaluate(
    async ([m, api, p, tok, body]) => {
      const r = await fetch(`${api}${p}`, {
        method: m,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        body: body ? JSON.stringify(body) : undefined,
      });
      const d = await r.json().catch(() => ({}));
      return { status: r.status, d };
    },
    [method, API, path, tok, body],
  );
};

const openEditor = async (listId) => {
  await page.goto(`${BASE}/user/invitations/lists/${listId}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1600);
};
/** 点「保存并返回」并等待跳回列表页 */
const clickSaveAndBack = async () => {
  await page.locator('[data-testid="save-and-back"]').click();
  try {
    await page.waitForFunction(() => location.pathname === '/user/invitations/lists', { timeout: 10000 });
    return true;
  } catch {
    return false;
  }
};
const cell = (rowIdx, colIdx) => page.locator('table tbody tr').nth(rowIdx).locator('input').nth(colIdx);
const rowCount = () => page.locator('table tbody tr').count();

/* ───── 准备：自定义模板（无 guest_name） + 两个名单 ───── */
const tplRes = await api('POST', '/api/guest-lists/templates', { name: `E2E模板_${ts}`, fields: FIELDS });
const tplId = tplRes.d?.template?.id;
check('准备：创建不含 guest_name 的自定义模板', !!tplId, `tpl=${tplId} status=${tplRes.status}`);

const listARes = await api('POST', '/api/guest-lists', { name: `E2E保存返回_${ts}`, templateId: tplId });
const listA = listARes.d?.id;
check('准备：按该模板新建名单 A', !!listA && listARes.d?.columnDefs?.length === 2, `id=${listA}`);

const listBRes = await api('POST', '/api/guest-lists', { name: `E2E编辑保存_${ts}`, templateId: tplId });
const listB = listBRes.d?.id;
await api('POST', `/api/guest-lists/${listB}/records`, { data: { e2e_husband: '原有丈夫', e2e_wife: '原有妻子' } });
check('准备：名单 B 预置 1 条既有记录', !!listB, `id=${listB}`);

/* ════════ A + B：按钮更名 / 按模板渲染列 ════════ */
await openEditor(listA);
const backBtn = page.locator('[data-testid="save-and-back"]');
check('A 返回按钮已更名为「保存并返回」', (await backBtn.innerText()).includes('保存并返回'), `text="${(await backBtn.innerText()).trim()}"`);

const headers = (await page.locator('table thead th').allInnerTexts()).map((s) => s.replace(/\s+/g, ''));
check('B 列按模板渲染（含 E2E丈夫/E2E妻子）', headers.some((h) => h.includes('E2E丈夫')) && headers.some((h) => h.includes('E2E妻子')), `headers=${JSON.stringify(headers)}`);
check('B 不含硬编码的「姓名」列（模板无 guest_name）', !headers.some((h) => h.includes('姓名')), `headers=${JSON.stringify(headers)}`);

/* ════════ C：新增行填值 → 保存并返回 → 落库 ════════ */
await page.getByRole('button', { name: /新增一行/ }).click();
await page.waitForTimeout(300);
await cell(0, 0).fill('亚森江');
await cell(0, 1).fill('阿曼古丽');
const navigated = await clickSaveAndBack();
check('C 点「保存并返回」后自动跳回列表页', navigated, `url=${page.url()}`);

let recs = await api('GET', `/api/guest-lists/${listA}/records`);
check('C 后端已落库 1 条（不再丢失）', recs.d?.total === 1, `total=${recs.d?.total}`);
check('C 落库内容正确', recs.d?.records?.[0]?.data?.e2e_husband === '亚森江' && recs.d?.records?.[0]?.data?.e2e_wife === '阿曼古丽', `data=${JSON.stringify(recs.d?.records?.[0]?.data)}`);
check('C 未写入无关的 guest_name 字段', recs.d?.records?.[0]?.data?.guest_name === undefined, `data=${JSON.stringify(recs.d?.records?.[0]?.data)}`);

/* ════════ D：空行跳过，非空行写入 ════════ */
await openEditor(listA);
await page.getByRole('button', { name: /新增一行/ }).click();
await page.getByRole('button', { name: /新增一行/ }).click();
await page.waitForTimeout(300);
check('D 当前 3 行（1 已落库 + 2 新增）', (await rowCount()) === 3, `rows=${await rowCount()}`);
await cell(1, 0).fill('阿力木');
await cell(1, 1).fill('古再努尔');
// 第 3 行（下标 2）完全留空 → 应被跳过
await clickSaveAndBack();

recs = await api('GET', `/api/guest-lists/${listA}/records`);
check('D 空行未写入（总数 2 而非 3）', recs.d?.total === 2, `total=${recs.d?.total}`);
check('D 非空新行已写入', (recs.d?.records ?? []).some((r) => r.data?.e2e_husband === '阿力木' && r.data?.e2e_wife === '古再努尔'), `names=${JSON.stringify((recs.d?.records ?? []).map((r) => r.data))}`);
check('D 库中无全空记录', !(recs.d?.records ?? []).some((r) => !r.data?.e2e_husband && !r.data?.e2e_wife), `total=${recs.d?.total}`);

/* ════════ E：编辑既有行 → 立刻保存并返回（抢在 600ms 防抖之前） ════════ */
await openEditor(listA);
await cell(0, 1).fill('阿曼古丽-改');
await clickSaveAndBack(); // 不等待防抖，直接触发「保存并返回」的立即落库
recs = await api('GET', `/api/guest-lists/${listA}/records`);
const edited = (recs.d?.records ?? []).find((r) => r.data?.e2e_husband === '亚森江');
check('E 既有行改动落库（未等防抖）', edited?.data?.e2e_wife === '阿曼古丽-改', `data=${JSON.stringify(edited?.data)}`);
check('E 总数不变（未误插新行）', recs.d?.total === 2, `total=${recs.d?.total}`);

/* ════════ F：先失焦已创建 → 保存并返回不重复插入 ════════ */
await openEditor(listA);
await page.getByRole('button', { name: /新增一行/ }).click();
await page.waitForTimeout(300);
await cell(2, 0).fill('重复检查');
await cell(2, 1).fill('妻子X');
// 用「点击非交互区域」制造真实失焦（locator.blur() 不触发 React 委托的 focusout，勿用）
await page.locator('table thead th').first().click();
await page.waitForTimeout(1200);
const midTotal = (await api('GET', `/api/guest-lists/${listA}/records`)).d?.total;
await clickSaveAndBack();
recs = await api('GET', `/api/guest-lists/${listA}/records`);
check('F 失焦已创建 1 条', midTotal === 3, `total=${midTotal}`);
check('F 保存并返回未重复插入', recs.d?.total === 3, `total=${recs.d?.total}`);

/* ════════ G：编辑名单（B）流程同样生效 ════════ */
await openEditor(listB);
const bNameVal = await page.locator('input[placeholder*="名单名称"]').inputValue();
check('G 编辑流程名称正确回填', bNameVal.startsWith('E2E编辑保存_'), `value="${bNameVal}"`);
await page.getByRole('button', { name: /新增一行/ }).click();
await page.waitForTimeout(300);
await cell(1, 0).fill('新增丈夫');
await cell(1, 1).fill('新增妻子');
await clickSaveAndBack();
recs = await api('GET', `/api/guest-lists/${listB}/records`);
check('G 编辑流程新增记录已落库（total=2）', recs.d?.total === 2, `total=${recs.d?.total}`);
check('G 新增记录内容正确', (recs.d?.records ?? []).some((r) => r.data?.e2e_husband === '新增丈夫'), `names=${JSON.stringify((recs.d?.records ?? []).map((r) => r.data))}`);

/* ───── 清理（硬删，避免软删残留污染库） ───── */
await browser.close();
const prisma = new PrismaClient();
try {
  const ids = [listA, listB].filter(Boolean);
  const r1 = await prisma.guestRecord.deleteMany({ where: { listId: { in: ids } } });
  const r2 = await prisma.guestList.deleteMany({ where: { id: { in: ids } } });
  const r3 = tplId ? await prisma.guestTemplate.deleteMany({ where: { id: tplId } }) : { count: 0 };
  const remainL = await prisma.guestList.count({ where: { name: { startsWith: 'E2E' } } });
  const remainT = await prisma.guestTemplate.count({ where: { name: { startsWith: 'E2E' } } });
  console.log(`  🧹 清理：records=${r1.count} lists=${r2.count} templates=${r3.count} | 残留 E2E 名单=${remainL} 模板=${remainT}`);
  check('清理后无 E2E 残留', remainL === 0 && remainT === 0, `lists=${remainL} templates=${remainT}`);
} finally {
  await prisma.$disconnect();
}

console.log(`\n结果：${pass} PASS / ${fail} FAIL\n`);
process.exit(fail ? 1 : 0);
