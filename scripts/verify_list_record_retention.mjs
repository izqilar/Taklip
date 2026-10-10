/**
 * 验证：诚邀名单制作页「新建 / 编辑」两条流程的记录保留与名称回填。
 *
 * 覆盖缺陷：
 *  D1 新建名单：新增一行并填写 → 记录不再莫名消失（临时行不再走 PUT 更新触发 load() 清空）。
 *  D2 编辑名单：编辑器顶部名称输入框正确回填原名单名称；插入的新记录保留不丢失。
 *
 * 运行：node scripts/verify_list_record_retention.mjs
 * 前置：web :5173 + server :3000 已启动（且已加载含 GET /:id 的新 dist）。
 */
import { chromium } from 'playwright';

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
const newName = `E2E新名单_${ts}`;
const editName = `E2E编辑名单_${ts}`;

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
  const res = await page.evaluate(
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
  return res;
};

/* 读取表格每行「姓名列(input 首个)」的当前输入值 */
const nameValues = async () => {
  const rows = page.locator('table tbody tr');
  const n = await rows.count();
  const out = [];
  for (let i = 0; i < n; i++) {
    const v = await rows.nth(i).locator('input').first().inputValue();
    out.push(v);
  }
  return out;
};

/* ───── 准备：新建名单（D1 用，初始 0 记录） + 编辑名单（D2 用，含 1 条已有记录） ───── */
const createdNew = await api('POST', '/api/guest-lists', { name: newName });
const newListId = createdNew.d?.id;
check('创建新建流程名单', !!newListId, `id=${newListId}`);

const createdEdit = await api('POST', '/api/guest-lists', { name: editName });
const editListId = createdEdit.d?.id;
check('创建编辑流程名单', !!editListId, `id=${editListId}`);
const rec = await api('POST', `/api/guest-lists/${editListId}/records`, { data: { guest_name: '李四', guest_title: '先生' } });
check('编辑名单预置记录(李四)', !!rec.d?.id, `rid=${rec.d?.id}`);

/* ════════ D1：新建名单流程 ─═══════ */
await page.goto(`${BASE}/user/invitations/lists/${newListId}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);

const newNameVal = await page.locator('input[placeholder*="名单名称"]').inputValue();
check('D1 顶部名称输入框回填名单名', newNameVal === newName, `value="${newNameVal}"`);

await page.getByRole('button', { name: /新增一行/ }).click();
await page.waitForTimeout(400);
let rowCount = await page.locator('table tbody tr').count();
check('D1 点击新增一行后出现 1 行(临时占位)', rowCount === 1, `rows=${rowCount}`);

const nameInput = page.locator('table tbody tr').last().locator('input').first();
await nameInput.fill('张三');
await nameInput.blur();
await page.waitForTimeout(1500);

rowCount = await page.locator('table tbody tr').count();
const vals1 = await nameValues();
check('D1 填写并失焦后记录仍在（未消失）', rowCount === 1 && vals1.includes('张三'), `rows=${rowCount}, names=${JSON.stringify(vals1)}`);

const recsNew = await api('GET', `/api/guest-lists/${newListId}/records`);
check('D1 后端 records.total=1', recsNew.d?.total === 1, `total=${recsNew.d?.total}`);
check('D1 后端记录 data.guest_name=张三', recsNew.d?.records?.[0]?.data?.guest_name === '张三', `data=${JSON.stringify(recsNew.d?.records?.[0]?.data)}`);

await page.getByRole('button', { name: /新增一行/ }).click();
await page.waitForTimeout(400);
const nameInput2 = page.locator('table tbody tr').last().locator('input').first();
await nameInput2.fill('赵六');
await nameInput2.blur();
await page.waitForTimeout(1500);
const vals2 = await nameValues();
check('D1 两行记录均保留(张三+赵六)', vals2.includes('张三') && vals2.includes('赵六'), `names=${JSON.stringify(vals2)}`);

await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
const valsReload = await nameValues();
check('D1 刷新后记录仍在(持久化)', valsReload.includes('张三') && valsReload.includes('赵六'), `names=${JSON.stringify(valsReload)}`);

/* ════════ D2：编辑名单流程 ─═══════ */
await page.goto(`${BASE}/user/invitations/lists/${editListId}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);

const editNameVal = await page.locator('input[placeholder*="名单名称"]').inputValue();
check('D2 顶部名称输入框正确回填原名单名称', editNameVal === editName, `value="${editNameVal}"`);

const valsEdit0 = await nameValues();
check('D2 已有记录(李四)显示', valsEdit0.includes('李四'), `names=${JSON.stringify(valsEdit0)}`);

await page.getByRole('button', { name: /新增一行/ }).click();
await page.waitForTimeout(400);
const wInput = page.locator('table tbody tr').last().locator('input').first();
await wInput.fill('王五');
await wInput.blur();
await page.waitForTimeout(1500);
const valsEdit1 = await nameValues();
check('D2 新插入记录(王五)保留不丢失', valsEdit1.includes('王五') && valsEdit1.includes('李四'), `names=${JSON.stringify(valsEdit1)}`);

await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
const valsEditReload = await nameValues();
check('D2 刷新后两记录均持久化', valsEditReload.includes('李四') && valsEditReload.includes('王五'), `names=${JSON.stringify(valsEditReload)}`);

/* 清理 E2E 数据 */
await api('DELETE', `/api/guest-lists/${newListId}`);
await api('DELETE', `/api/guest-lists/${editListId}`);

await browser.close();
console.log(`\n结果：${pass} PASS / ${fail} FAIL\n`);
process.exit(fail ? 1 : 0);
